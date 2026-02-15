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

import de.cuioss.nifi.jwt.config.JwtIssuerConfigService;
import de.cuioss.nifi.jwt.util.AuthorizationValidator;
import de.cuioss.nifi.rest.RestApiLogMessages;
import de.cuioss.nifi.rest.config.RouteConfiguration;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.sheriff.oauth.core.exception.TokenValidationException;
import de.cuioss.tools.logging.CuiLogger;
import org.eclipse.jetty.http.HttpField;
import org.eclipse.jetty.http.HttpHeader;
import org.eclipse.jetty.io.Content;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.BlockingQueue;

/**
 * Jetty 12 Core handler implementing the REST API Gateway request pipeline.
 * <p>
 * Processing pipeline for each request:
 * <ol>
 *   <li>Match route by path + HTTP method</li>
 *   <li>Extract and validate Bearer token via {@link JwtIssuerConfigService}</li>
 *   <li>Check authorization (roles/scopes) via {@link AuthorizationValidator}</li>
 *   <li>Read and size-check request body</li>
 *   <li>Send HTTP response (success or error with {@link ProblemDetail})</li>
 *   <li>Enqueue {@link HttpRequestContainer} for FlowFile creation</li>
 * </ol>
 */
public class GatewayRequestHandler extends Handler.Abstract {

    private static final CuiLogger LOGGER = new CuiLogger(GatewayRequestHandler.class);

    private final List<RouteConfiguration> routes;
    private final JwtIssuerConfigService configService;
    private final BlockingQueue<HttpRequestContainer> queue;
    private final int maxRequestSize;
    private final Set<String> corsAllowedOrigins;

    /**
     * Creates a new handler with CORS disabled.
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
        this(routes, configService, queue, maxRequestSize, Set.of());
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
        this.routes = List.copyOf(routes);
        this.configService = Objects.requireNonNull(configService);
        this.queue = Objects.requireNonNull(queue);
        this.maxRequestSize = maxRequestSize;
        this.corsAllowedOrigins = Set.copyOf(corsAllowedOrigins);
    }

    @Override
    public boolean handle(Request request, Response response, Callback callback) throws Exception {
        String path = request.getHttpURI().getPath();
        String method = request.getMethod();
        String remoteHost = Request.getRemoteAddr(request);
        String origin = request.getHeaders().get("Origin");

        // CORS preflight handling
        if (isCorsEnabled() && "OPTIONS".equalsIgnoreCase(method) && origin != null) {
            if (isOriginAllowed(origin)) {
                LOGGER.info(RestApiLogMessages.INFO.CORS_PREFLIGHT, origin);
                setCorsHeaders(response, origin);
                response.getHeaders().put("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
                response.getHeaders().put("Access-Control-Allow-Headers", "Authorization, Content-Type");
                response.getHeaders().put("Access-Control-Max-Age", "3600");
                response.setStatus(204);
                response.write(true, ByteBuffer.allocate(0), callback);
                return true;
            }
        }

        try {
            // 1. Route matching
            RouteConfiguration matchedRoute = findRoute(path);
            if (matchedRoute == null) {
                LOGGER.warn(RestApiLogMessages.WARN.ROUTE_NOT_FOUND, path);
                sendProblemResponse(response, callback,
                        ProblemDetail.notFound("No route configured for path: " + path));
                return true;
            }

            // 2. Method check
            if (!matchedRoute.methods().contains(method.toUpperCase(Locale.ROOT))) {
                LOGGER.warn(RestApiLogMessages.WARN.METHOD_NOT_ALLOWED, method, matchedRoute.name(), path);
                response.getHeaders().put("Allow", String.join(", ", matchedRoute.methods()));
                sendProblemResponse(response, callback,
                        ProblemDetail.methodNotAllowed(
                                "Method %s not allowed on %s. Allowed: %s".formatted(
                                        method, path, matchedRoute.methods())));
                return true;
            }

            LOGGER.info(RestApiLogMessages.INFO.ROUTE_MATCHED, method, path, matchedRoute.name());

            // 3. Authentication
            String rawToken = extractBearerToken(request);
            if (rawToken == null) {
                LOGGER.warn(RestApiLogMessages.WARN.MISSING_BEARER_TOKEN, method, path, remoteHost);
                response.getHeaders().put("WWW-Authenticate", "Bearer");
                sendProblemResponse(response, callback,
                        ProblemDetail.unauthorized("Missing or malformed Authorization header"));
                return true;
            }

            AccessTokenContent token;
            try {
                token = configService.validateToken(rawToken);
            } catch (TokenValidationException e) {
                LOGGER.warn(RestApiLogMessages.WARN.AUTH_FAILED, method, path, remoteHost, e.getMessage());
                response.getHeaders().put("WWW-Authenticate", "Bearer error=\"invalid_token\"");
                sendProblemResponse(response, callback,
                        ProblemDetail.unauthorized("Token validation failed: " + e.getMessage()));
                return true;
            }

            // 4. Authorization
            if (matchedRoute.hasAuthorizationRequirements()) {
                var authResult = AuthorizationValidator.validate(token, matchedRoute.toAuthorizationRequirements());
                if (!authResult.isAuthorized()) {
                    LOGGER.warn(RestApiLogMessages.WARN.AUTHZ_FAILED, method, path, remoteHost, authResult.getReason());
                    if (!authResult.getMissingScopes().isEmpty()) {
                        response.getHeaders().put("WWW-Authenticate",
                                "Bearer error=\"insufficient_scope\", scope=\"%s\""
                                        .formatted(String.join(" ", matchedRoute.requiredScopes())));
                        sendProblemResponse(response, callback,
                                ProblemDetail.unauthorized("Insufficient scopes: " + authResult.getReason()));
                    } else {
                        sendProblemResponse(response, callback,
                                ProblemDetail.forbidden("Insufficient roles: " + authResult.getReason()));
                    }
                    return true;
                }
            }

            LOGGER.info(RestApiLogMessages.INFO.AUTH_SUCCESSFUL, method, path, remoteHost);

            // 5. Read body
            byte[] body = readBody(request);
            if (body.length > maxRequestSize) {
                LOGGER.warn(RestApiLogMessages.WARN.BODY_TOO_LARGE, body.length, maxRequestSize, method, path);
                sendProblemResponse(response, callback,
                        ProblemDetail.payloadTooLarge(
                                "Request body size %d exceeds maximum %d bytes"
                                        .formatted(body.length, maxRequestSize)));
                return true;
            }

            // 6. Build container and enqueue
            String contentType = Optional.ofNullable(request.getHeaders().get(HttpHeader.CONTENT_TYPE)).orElse(null);
            Map<String, String> queryParams = parseQueryParameters(request);
            Map<String, String> headers = extractHeaders(request);

            var container = new HttpRequestContainer(
                    matchedRoute.name(), method, path,
                    queryParams, headers, remoteHost,
                    body, contentType, token);

            if (!queue.offer(container)) {
                LOGGER.warn(RestApiLogMessages.WARN.QUEUE_FULL, method, path, remoteHost);
                sendProblemResponse(response, callback,
                        ProblemDetail.serviceUnavailable("Server is at capacity, please retry later"));
                return true;
            }

            // 7. Success response
            LOGGER.info(RestApiLogMessages.INFO.REQUEST_PROCESSED, matchedRoute.name(), method, path, remoteHost);

            // Add CORS headers if origin is allowed
            if (isCorsEnabled() && origin != null && isOriginAllowed(origin)) {
                setCorsHeaders(response, origin);
            }

            int statusCode = isBodyMethod(method) ? 202 : 200;
            response.setStatus(statusCode);
            response.getHeaders().put(HttpHeader.CONTENT_TYPE, "application/json");
            byte[] responseBody = "{\"status\":\"accepted\"}".getBytes(StandardCharsets.UTF_8);
            response.getHeaders().put(HttpHeader.CONTENT_LENGTH, responseBody.length);
            response.write(true, ByteBuffer.wrap(responseBody), callback);
            return true;

        } catch (Exception e) {
            LOGGER.error(e, RestApiLogMessages.ERROR.HANDLER_ERROR, e.getMessage());
            sendProblemResponse(response, callback,
                    ProblemDetail.builder()
                            .type("about:blank")
                            .title("Internal Server Error")
                            .status(500)
                            .detail("An unexpected error occurred")
                            .build());
            return true;
        }
    }

    private RouteConfiguration findRoute(String path) {
        for (RouteConfiguration route : routes) {
            if (route.path().equals(path)) {
                return route;
            }
        }
        return null;
    }

    private static String extractBearerToken(Request request) {
        String authHeader = request.getHeaders().get(HttpHeader.AUTHORIZATION);
        if (authHeader == null || !authHeader.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return null;
        }
        String token = authHeader.substring(7).trim();
        return token.isEmpty() ? null : token;
    }

    private byte[] readBody(Request request) throws Exception {
        try (var inputStream = Content.Source.asInputStream(request)) {
            // Read with size limit to prevent OOM from oversized requests.
            // We read up to maxRequestSize + 1 so exceeding the limit is
            // detected without allocating an unbounded buffer.
            return inputStream.readNBytes(maxRequestSize + 1);
        }
    }

    private static Map<String, String> parseQueryParameters(Request request) {
        var fields = Request.extractQueryParameters(request);
        if (fields.isEmpty()) {
            return Map.of();
        }
        Map<String, String> params = new LinkedHashMap<>();
        for (String name : fields.getNames()) {
            params.put(name, fields.getValue(name));
        }
        return params;
    }

    private static Map<String, String> extractHeaders(Request request) {
        Map<String, String> headers = new LinkedHashMap<>();
        for (HttpField field : request.getHeaders()) {
            // Skip sensitive Authorization header from FlowFile attributes
            if (!HttpHeader.AUTHORIZATION.is(field.getName())) {
                headers.put(field.getName(), field.getValue());
            }
        }
        return headers;
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

    private static void setCorsHeaders(Response response, String origin) {
        response.getHeaders().put("Access-Control-Allow-Origin", origin);
        response.getHeaders().put("Access-Control-Allow-Credentials", "true");
        response.getHeaders().put("Vary", "Origin");
    }

    private static void sendProblemResponse(Response response, Callback callback, ProblemDetail problem) {
        response.setStatus(problem.status());
        response.getHeaders().put(HttpHeader.CONTENT_TYPE, ProblemDetail.CONTENT_TYPE);
        byte[] body = problem.toJson().getBytes(StandardCharsets.UTF_8);
        response.getHeaders().put(HttpHeader.CONTENT_LENGTH, body.length);
        response.write(true, ByteBuffer.wrap(body), callback);
    }
}
