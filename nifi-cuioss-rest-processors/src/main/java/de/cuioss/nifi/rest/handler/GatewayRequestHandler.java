/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package de.cuioss.nifi.rest.handler;

import de.cuioss.http.security.config.SecurityConfiguration;
import de.cuioss.http.security.exceptions.UrlSecurityException;
import de.cuioss.http.security.monitoring.SecurityEventCounter;
import de.cuioss.http.security.pipeline.PipelineFactory;
import de.cuioss.http.security.pipeline.PipelineFactory.PipelineSet;
import de.cuioss.nifi.jwt.config.JwtIssuerConfigService;
import de.cuioss.nifi.jwt.util.AuthorizationValidator;
import de.cuioss.nifi.rest.RestApiLogMessages;
import de.cuioss.nifi.rest.config.RouteConfiguration;
import de.cuioss.nifi.rest.validation.JsonSchemaValidator;
import de.cuioss.nifi.rest.validation.SchemaViolation;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.sheriff.oauth.core.exception.TokenValidationException;
import de.cuioss.tools.logging.CuiLogger;
import lombok.Getter;
import org.eclipse.jetty.http.HttpField;
import org.eclipse.jetty.http.HttpHeader;
import org.eclipse.jetty.io.Content;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import org.jspecify.annotations.Nullable;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.BlockingQueue;
import java.util.stream.Collectors;

/**
 * Jetty 12 Core handler implementing the REST API Gateway request pipeline.
 * <p>
 * Processing pipeline for each request:
 * <ol>
 *   <li>Match route by path + HTTP method</li>
 *   <li>Extract and validate Bearer token via {@link JwtIssuerConfigService}</li>
 *   <li>Check authorization (roles/scopes) via {@link AuthorizationValidator}</li>
 *   <li>Read and size-check request body</li>
 *   <li>Validate request body against JSON Schema (if configured)</li>
 *   <li>Enqueue {@link HttpRequestContainer} for FlowFile creation</li>
 *   <li>Send HTTP response (success or error with {@link ProblemDetail})</li>
 * </ol>
 */
public class GatewayRequestHandler extends Handler.Abstract {

    private static final CuiLogger LOGGER = new CuiLogger(GatewayRequestHandler.class);

    // HTTP header constants
    private static final String WWW_AUTHENTICATE = "WWW-Authenticate";
    private static final String HEADER_ALLOW = "Allow";
    private static final String HEADER_ORIGIN = "Origin";
    private static final String HEADER_VARY = "Vary";

    // CORS header constants
    private static final String CORS_ALLOW_ORIGIN = "Access-Control-Allow-Origin";
    private static final String CORS_ALLOW_CREDENTIALS = "Access-Control-Allow-Credentials";
    private static final String CORS_ALLOW_METHODS = "Access-Control-Allow-Methods";
    private static final String CORS_ALLOW_HEADERS = "Access-Control-Allow-Headers";
    private static final String CORS_MAX_AGE = "Access-Control-Max-Age";
    private static final String CORS_ALLOWED_METHODS_VALUE = "GET, POST, PUT, DELETE, PATCH, OPTIONS";
    private static final String CORS_ALLOWED_HEADERS_VALUE = "Authorization, Content-Type";
    private static final String CORS_MAX_AGE_VALUE = "3600";

    // Auth challenge constants
    private static final String BEARER_CHALLENGE = "Bearer";
    private static final String BEARER_INVALID_TOKEN = "Bearer error=\"invalid_token\"";
    private static final String BEARER_INSUFFICIENT_SCOPE_TEMPLATE = "Bearer error=\"insufficient_scope\", scope=\"%s\"";

    // Response body
    private static final byte[] ACCEPTED_RESPONSE = "{\"status\":\"accepted\"}".getBytes(StandardCharsets.UTF_8);
    private static final String METHOD_OPTIONS = "OPTIONS";
    private static final int BEARER_PREFIX_LENGTH = 7;

    private final List<RouteConfiguration> routes;
    private final JwtIssuerConfigService configService;
    private final BlockingQueue<HttpRequestContainer> queue;
    private final int maxRequestSize;
    private final Set<String> corsAllowedOrigins;
    @Nullable private final JsonSchemaValidator schemaValidator;
    private final PipelineSet securityPipelines;
    /** Transport-level HTTP security event counters from cui-http. */
    @Getter private final SecurityEventCounter httpSecurityEvents;
    /** Application-level gateway security event counters. */
    @Getter private final GatewaySecurityEvents gatewaySecurityEvents;
    /** Handler for reserved management endpoints (/metrics). */
    @Getter @Nullable private ManagementEndpointHandler managementHandler;

    /**
     * Creates a new handler with CORS disabled and no schema validation.
     *
     * @param routes         the configured routes
     * @param configService  the JWT issuer config service for token validation
     * @param queue          the queue for passing requests to the NiFi processor
     * @param maxRequestSize maximum allowed request body size in bytes
     */
    public GatewayRequestHandler(
            List<RouteConfiguration> routes,
            JwtIssuerConfigService configService,
            BlockingQueue<HttpRequestContainer> queue,
            int maxRequestSize) {
        this(routes, configService, queue, maxRequestSize, Set.of(), null);
    }

    /**
     * Creates a new handler.
     *
     * @param routes              the configured routes
     * @param configService       the JWT issuer config service for token validation
     * @param queue               the queue for passing requests to the NiFi processor
     * @param maxRequestSize      maximum allowed request body size in bytes
     * @param corsAllowedOrigins  allowed CORS origins; use {@code Set.of("*")} for all; empty to disable
     */
    public GatewayRequestHandler(
            List<RouteConfiguration> routes,
            JwtIssuerConfigService configService,
            BlockingQueue<HttpRequestContainer> queue,
            int maxRequestSize,
            Set<String> corsAllowedOrigins) {
        this(routes, configService, queue, maxRequestSize, corsAllowedOrigins, null);
    }

    /**
     * Creates a new handler with optional schema validation.
     *
     * @param routes              the configured routes
     * @param configService       the JWT issuer config service for token validation
     * @param queue               the queue for passing requests to the NiFi processor
     * @param maxRequestSize      maximum allowed request body size in bytes
     * @param corsAllowedOrigins  allowed CORS origins; use {@code Set.of("*")} for all; empty to disable
     * @param schemaValidator     optional JSON Schema validator for request body validation
     */
    public GatewayRequestHandler(
            List<RouteConfiguration> routes,
            JwtIssuerConfigService configService,
            BlockingQueue<HttpRequestContainer> queue,
            int maxRequestSize,
            Set<String> corsAllowedOrigins,
            @Nullable JsonSchemaValidator schemaValidator) {
        this.routes = List.copyOf(routes);
        this.configService = Objects.requireNonNull(configService);
        this.queue = Objects.requireNonNull(queue);
        this.maxRequestSize = maxRequestSize;
        this.corsAllowedOrigins = Set.copyOf(corsAllowedOrigins);
        this.schemaValidator = schemaValidator;
        this.httpSecurityEvents = new SecurityEventCounter();
        this.gatewaySecurityEvents = new GatewaySecurityEvents();
        this.securityPipelines = PipelineFactory.createCommonPipelines(
                SecurityConfiguration.defaults(), httpSecurityEvents);
    }

    /**
     * Configures the management endpoint ({@code /metrics}) on this handler.
     * Must be called after construction to enable management API access.
     *
     * @param managementApiKey  API key for management endpoint auth, or {@code null} for unauthenticated access
     */
    public void configureManagementEndpoints(@Nullable String managementApiKey) {
        this.managementHandler = new ManagementEndpointHandler(
                configService, httpSecurityEvents, gatewaySecurityEvents,
                managementApiKey);
    }


    @SuppressWarnings("java:S3516")
    // Always returns true — this handler handles all requests per Jetty contract
    @Override
    public boolean handle(Request request, Response response, Callback callback) {
        if (handleCorsPreflight(request, response, callback)) {
            return true;
        }

        // Management endpoints bypass the entire auth + security pipeline
        if (managementHandler != null) {
            String rawPath = request.getHttpURI().getPath();
            String accept = request.getHeaders().get("Accept");
            if (managementHandler.handleIfManagement(rawPath, request.getMethod(), accept,
                    request, response, callback)) {
                return true;
            }
        }

        try {
            processRequest(request, response, callback);
        } catch (IOException e) {
            LOGGER.error(e, RestApiLogMessages.ERROR.HANDLER_ERROR, e.getMessage());
            sendProblemResponse(response, callback, ProblemDetail.internalError());
        }
        return true;
    }

    private boolean handleCorsPreflight(Request request, Response response, Callback callback) {
        String origin = request.getHeaders().get(HEADER_ORIGIN);
        if (!isCorsEnabled() || !METHOD_OPTIONS.equalsIgnoreCase(request.getMethod())
                || origin == null || !isOriginAllowed(origin)) {
            return false;
        }
        LOGGER.info(RestApiLogMessages.INFO.CORS_PREFLIGHT, origin);
        setCorsHeaders(response, origin);
        response.getHeaders().put(CORS_ALLOW_METHODS, CORS_ALLOWED_METHODS_VALUE);
        response.getHeaders().put(CORS_ALLOW_HEADERS, CORS_ALLOWED_HEADERS_VALUE);
        response.getHeaders().put(CORS_MAX_AGE, CORS_MAX_AGE_VALUE);
        response.setStatus(204);
        response.write(true, ByteBuffer.allocate(0), callback);
        return true;
    }

    private void processRequest(Request request, Response response, Callback callback) throws IOException {
        String rawPath = request.getHttpURI().getPath();
        String method = request.getMethod();
        String remoteHost = Request.getRemoteAddr(request);

        // 0. Security validation + normalization
        Optional<SanitizedRequest> sanitized = validateAndSanitizeInput(
                request, response, callback, method, rawPath, remoteHost);
        if (sanitized.isEmpty()) {
            return;
        }
        String path = sanitized.get().path();

        // 1. Route matching (uses normalized path)
        Optional<RouteConfiguration> route = matchRoute(path, method, response, callback);
        if (route.isEmpty()) {
            return;
        }
        LOGGER.info(RestApiLogMessages.INFO.ROUTE_MATCHED, method, path, route.get().name());

        // 2. Authentication
        Optional<AccessTokenContent> token = authenticateRequest(
                request, response, callback, method, path, remoteHost);
        if (token.isEmpty()) {
            return;
        }

        // 3. Authorization
        if (!authorizeRequest(token.get(), route.get(), response, callback, method, path, remoteHost)) {
            return;
        }
        LOGGER.info(RestApiLogMessages.INFO.AUTH_SUCCESSFUL, method, path, remoteHost);

        // 4. Read and validate body
        byte[] body = readBody(request);
        if (body.length > maxRequestSize) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.BODY_TOO_LARGE);
            LOGGER.warn(RestApiLogMessages.WARN.BODY_TOO_LARGE, body.length, maxRequestSize, method, path);
            sendProblemResponse(response, callback,
                    ProblemDetail.payloadTooLarge(
                            "Request body size %d exceeds maximum %d bytes".formatted(body.length, maxRequestSize)));
            return;
        }

        // 5. Schema validation (only if route has schema configured and body is non-empty)
        if (!validateRequestBody(route.get(), body, response, callback, method, path)) {
            return;
        }

        // 6. Enqueue for FlowFile creation (uses sanitized query params and headers)
        var container = new HttpRequestContainer(
                route.get().name(), method, path,
                sanitized.get().queryParameters(), sanitized.get().headers(), remoteHost,
                body, request.getHeaders().get(HttpHeader.CONTENT_TYPE), token.get());

        if (!queue.offer(container)) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.QUEUE_FULL);
            LOGGER.warn(RestApiLogMessages.WARN.QUEUE_FULL, method, path, remoteHost);
            sendProblemResponse(response, callback,
                    ProblemDetail.serviceUnavailable("Server is at capacity, please retry later"));
            return;
        }

        // 7. Success response
        LOGGER.info(RestApiLogMessages.INFO.REQUEST_PROCESSED, route.get().name(), method, path, remoteHost);
        sendSuccessResponse(request, response, callback, method);
    }

    /**
     * Matches route by path and HTTP method.
     *
     * @return the matched route, or empty if an error response was sent
     */
    private Optional<RouteConfiguration> matchRoute(
            String path, String method, Response response, Callback callback) {
        Optional<RouteConfiguration> route = findRoute(path);
        if (route.isEmpty()) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.ROUTE_NOT_FOUND);
            LOGGER.warn(RestApiLogMessages.WARN.ROUTE_NOT_FOUND, path);
            sendProblemResponse(response, callback,
                    ProblemDetail.notFound("No route configured for path: " + path));
            return Optional.empty();
        }
        if (!route.get().methods().contains(method.toUpperCase(Locale.ROOT))) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.METHOD_NOT_ALLOWED);
            LOGGER.warn(RestApiLogMessages.WARN.METHOD_NOT_ALLOWED, method, route.get().name(), path);
            response.getHeaders().put(HEADER_ALLOW, String.join(", ", route.get().methods()));
            sendProblemResponse(response, callback,
                    ProblemDetail.methodNotAllowed(
                            "Method %s not allowed on %s. Allowed: %s".formatted(
                                    method, path, route.get().methods())));
            return Optional.empty();
        }
        return route;
    }

    /**
     * Extracts and validates the Bearer token.
     *
     * @return the validated token, or empty if an error response was sent
     */
    private Optional<AccessTokenContent> authenticateRequest(
            Request request, Response response, Callback callback,
            String method, String path, String remoteHost) {
        Optional<String> rawToken = extractBearerToken(request);
        if (rawToken.isEmpty()) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.MISSING_BEARER_TOKEN);
            LOGGER.warn(RestApiLogMessages.WARN.MISSING_BEARER_TOKEN, method, path, remoteHost);
            response.getHeaders().put(WWW_AUTHENTICATE, BEARER_CHALLENGE);
            sendProblemResponse(response, callback,
                    ProblemDetail.unauthorized("Missing or malformed Authorization header"));
            return Optional.empty();
        }
        try {
            return Optional.of(configService.validateToken(rawToken.get()));
        } catch (TokenValidationException e) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.AUTH_FAILED);
            LOGGER.warn(RestApiLogMessages.WARN.AUTH_FAILED, method, path, remoteHost, e.getMessage());
            response.getHeaders().put(WWW_AUTHENTICATE, BEARER_INVALID_TOKEN);
            sendProblemResponse(response, callback,
                    ProblemDetail.unauthorized("Token validation failed: " + e.getMessage()));
            return Optional.empty();
        }
    }

    /**
     * Checks role/scope authorization for the given route.
     *
     * @return {@code true} if authorized, {@code false} if an error response was sent
     */
    private boolean authorizeRequest(
            AccessTokenContent token, RouteConfiguration route, Response response, Callback callback,
            String method, String path, String remoteHost) {
        if (!route.hasAuthorizationRequirements()) {
            return true;
        }
        var authResult = AuthorizationValidator.validate(token, route.toAuthorizationRequirements());
        if (authResult.isAuthorized()) {
            return true;
        }
        //noinspection DataFlowIssue
        LOGGER.warn(RestApiLogMessages.WARN.AUTHZ_FAILED, method, path, remoteHost, authResult.getReason());
        if (!authResult.getMissingScopes().isEmpty()) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.AUTHZ_SCOPE_DENIED);
            response.getHeaders().put(WWW_AUTHENTICATE,
                    BEARER_INSUFFICIENT_SCOPE_TEMPLATE
                            .formatted(String.join(" ", route.requiredScopes())));
            sendProblemResponse(response, callback,
                    ProblemDetail.unauthorized("Insufficient scopes: " + authResult.getReason()));
        } else {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.AUTHZ_ROLE_DENIED);
            sendProblemResponse(response, callback,
                    ProblemDetail.forbidden("Insufficient roles: " + authResult.getReason()));
        }
        return false;
    }

    /**
     * Validates the request body against the JSON Schema configured for the route.
     *
     * @return {@code true} if valid or no schema configured, {@code false} if an error response was sent
     */
    private boolean validateRequestBody(
            RouteConfiguration route, byte[] body, Response response, Callback callback,
            String method, String path) {
        if (schemaValidator == null || !route.hasSchemaValidation() || body.length == 0) {
            return true;
        }
        List<SchemaViolation> violations = schemaValidator.validate(route.name(), body);
        if (violations.isEmpty()) {
            return true;
        }
        gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.SCHEMA_VALIDATION_FAILED);
        String violationSummary = violations.stream()
                .map(v -> v.pointer() + ": " + v.message())
                .collect(Collectors.joining("; "));
        LOGGER.warn(RestApiLogMessages.WARN.VALIDATION_FAILED, route.name(), violationSummary);
        sendProblemResponse(response, callback,
                ProblemDetail.validationError(
                        "Request body failed JSON Schema validation", violations));
        return false;
    }

    /**
     * Validates and normalizes path, query parameters, and headers through cui-http
     * security pipelines. Each component is checked for attack patterns and returned
     * in its normalized form.
     *
     * @return the sanitized request components, or empty if an error response was sent
     */
    private Optional<SanitizedRequest> validateAndSanitizeInput(
            Request request, Response response, Callback callback,
            String method, String path, String remoteHost) {
        try {
            // Normalize path
            String sanitizedPath = securityPipelines.urlPathPipeline().validate(path)
                    .orElse(path);

            // Normalize query parameters
            var queryParams = Request.extractQueryParameters(request);
            Map<String, String> sanitizedParams = new LinkedHashMap<>();
            for (String name : queryParams.getNames()) {
                String sanitizedValue = securityPipelines.urlParameterPipeline()
                        .validate(queryParams.getValue(name))
                        .orElse(queryParams.getValue(name));
                sanitizedParams.put(name, sanitizedValue);
            }

            // Normalize headers (excluding Authorization)
            Map<String, String> sanitizedHeaders = new LinkedHashMap<>();
            for (HttpField field : request.getHeaders()) {
                if (!HttpHeader.AUTHORIZATION.is(field.getName())) {
                    String sanitizedValue = securityPipelines.headerValuePipeline()
                            .validate(field.getValue())
                            .orElse(field.getValue());
                    sanitizedHeaders.put(field.getName(), sanitizedValue);
                }
            }

            return Optional.of(new SanitizedRequest(sanitizedPath, sanitizedParams, sanitizedHeaders));
        } catch (UrlSecurityException e) {
            LOGGER.warn(RestApiLogMessages.WARN.SECURITY_VIOLATION, method, path, remoteHost, e.getMessage());
            sendProblemResponse(response, callback,
                    ProblemDetail.badRequest("Request rejected: " + e.getFailureType().getDescription()));
            return Optional.empty();
        }
    }

    private void sendSuccessResponse(Request request, Response response, Callback callback, String method) {
        String origin = request.getHeaders().get(HEADER_ORIGIN);
        if (isCorsEnabled() && origin != null && isOriginAllowed(origin)) {
            setCorsHeaders(response, origin);
        }
        int statusCode = isBodyMethod(method) ? 202 : 200;
        response.setStatus(statusCode);
        response.getHeaders().put(HttpHeader.CONTENT_TYPE, "application/json");
        response.getHeaders().put(HttpHeader.CONTENT_LENGTH, ACCEPTED_RESPONSE.length);
        response.write(true, ByteBuffer.wrap(ACCEPTED_RESPONSE), callback);
    }

    // --- Utility methods ---

    private Optional<RouteConfiguration> findRoute(String path) {
        for (RouteConfiguration route : routes) {
            if (route.enabled() && route.path().equals(path)) {
                return Optional.of(route);
            }
        }
        return Optional.empty();
    }

    private static Optional<String> extractBearerToken(Request request) {
        String authHeader = request.getHeaders().get(HttpHeader.AUTHORIZATION);
        if (authHeader == null || !authHeader.regionMatches(true, 0, "Bearer ", 0, BEARER_PREFIX_LENGTH)) {
            return Optional.empty();
        }
        String token = authHeader.substring(BEARER_PREFIX_LENGTH).trim();
        return token.isEmpty() ? Optional.empty() : Optional.of(token);
    }

    private byte[] readBody(Request request) throws IOException {
        try (var inputStream = Content.Source.asInputStream(request)) {
            // Read with size limit to prevent OOM from oversized requests.
            // We read up to maxRequestSize + 1 so exceeding the limit is
            // detected without allocating an unbounded buffer.
            return inputStream.readNBytes(maxRequestSize + 1);
        }
    }

    private static boolean isBodyMethod(String method) {
        return "POST".equalsIgnoreCase(method)
                || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method);
    }

    private boolean isCorsEnabled() {
        return !corsAllowedOrigins.isEmpty();
    }

    private boolean isOriginAllowed(String origin) {
        return corsAllowedOrigins.contains("*") || corsAllowedOrigins.contains(origin);
    }

    private void setCorsHeaders(Response response, String origin) {
        response.getHeaders().put(CORS_ALLOW_ORIGIN, origin);
        // Only set Allow-Credentials for specific trusted origins, never for wildcard.
        // Per CORS spec, credentials + wildcard origin is a security misconfiguration.
        if (!corsAllowedOrigins.contains("*")) {
            response.getHeaders().put(CORS_ALLOW_CREDENTIALS, "true");
        }
        response.getHeaders().put(HEADER_VARY, HEADER_ORIGIN);
    }

    private static void sendProblemResponse(Response response, Callback callback, ProblemDetail problem) {
        response.setStatus(problem.status());
        response.getHeaders().put(HttpHeader.CONTENT_TYPE, ProblemDetail.CONTENT_TYPE);
        byte[] body = problem.toJson().getBytes(StandardCharsets.UTF_8);
        response.getHeaders().put(HttpHeader.CONTENT_LENGTH, body.length);
        response.write(true, ByteBuffer.wrap(body), callback);
    }
}
