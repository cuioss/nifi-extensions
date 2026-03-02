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
import de.cuioss.nifi.jwt.util.AuthorizationRequirements;
import de.cuioss.nifi.jwt.util.AuthorizationValidator;
import de.cuioss.nifi.rest.RestApiLogMessages;
import de.cuioss.nifi.rest.config.AuthMode;
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

/**
 * Thin dispatcher implementing the command-pattern for endpoint handling.
 * <p>
 * All endpoint types (built-in management + user API routes) are registered
 * as {@link EndpointHandler} instances in a handler map. The dispatcher performs
 * shared concerns (sanitization, method check, auth-mode dispatch, authorization,
 * body size check) before delegating to the handler's {@code process()} method.
 */
public class GatewayRequestHandler extends Handler.Abstract {

    private static final CuiLogger LOGGER = new CuiLogger(GatewayRequestHandler.class);

    private static final String WWW_AUTHENTICATE = "WWW-Authenticate";
    private static final String HEADER_ALLOW = "Allow";

    private static final String BEARER_CHALLENGE = "Bearer";
    private static final String BEARER_INVALID_TOKEN = "Bearer error=\"invalid_token\"";
    private static final String BEARER_INSUFFICIENT_SCOPE_TEMPLATE = "Bearer error=\"insufficient_scope\", scope=\"%s\"";

    private static final byte[] EMPTY_BODY = new byte[0];
    private static final int BEARER_PREFIX_LENGTH = 7;

    /** Path to handler lookup map. Iteration order matches registration order. */
    private final Map<String, EndpointHandler> handlerMap;
    private final JwtIssuerConfigService configService;
    private final int globalMaxRequestSize;
    private final PipelineSet securityPipelines;

    /** Transport-level HTTP security event counters from cui-http. */
    @Getter private final SecurityEventCounter httpSecurityEvents;
    /** Application-level gateway security event counters. */
    @Getter private final GatewaySecurityEvents gatewaySecurityEvents;

    /** Package-private flag to disable loopback bypass in tests. */
    boolean loopbackBypassEnabled = true;

    /**
     * Authentication result: either a successful resolution (with optional token)
     * or an error (response already sent).
     */
    private sealed interface AuthResult {
        /** Authentication succeeded; token may be null for NONE/LOCAL_ONLY loopback. */
        record Success(@Nullable AccessTokenContent token) implements AuthResult {
        }

        /** Authentication failed; error response was already sent to the client. */
        record ErrorSent() implements AuthResult {
        }
    }

    /**
     * Creates a new dispatcher with the given endpoint handlers.
     * Event counters are created internally.
     *
     * @param handlers             ordered list of endpoint handlers (built-in first, then user routes)
     * @param configService        JWT issuer config service for token validation
     * @param globalMaxRequestSize global maximum request body size in bytes
     */
    public GatewayRequestHandler(
            List<EndpointHandler> handlers,
            JwtIssuerConfigService configService,
            int globalMaxRequestSize) {
        this(handlers, configService, globalMaxRequestSize,
                new SecurityEventCounter(), new GatewaySecurityEvents());
    }

    /**
     * Creates a new dispatcher with pre-created event counters.
     * Use this when handlers need access to the same event counter instances.
     *
     * @param handlers               ordered list of endpoint handlers
     * @param configService          JWT issuer config service for token validation
     * @param globalMaxRequestSize   global maximum request body size in bytes
     * @param httpSecurityEvents     pre-created transport security event counter
     * @param gatewaySecurityEvents  pre-created gateway event counter
     */
    public GatewayRequestHandler(
            List<EndpointHandler> handlers,
            JwtIssuerConfigService configService,
            int globalMaxRequestSize,
            SecurityEventCounter httpSecurityEvents,
            GatewaySecurityEvents gatewaySecurityEvents) {
        this.configService = Objects.requireNonNull(configService);
        this.globalMaxRequestSize = globalMaxRequestSize;
        this.httpSecurityEvents = Objects.requireNonNull(httpSecurityEvents);
        this.gatewaySecurityEvents = Objects.requireNonNull(gatewaySecurityEvents);
        this.securityPipelines = PipelineFactory.createCommonPipelines(
                SecurityConfiguration.defaults(), this.httpSecurityEvents);

        this.handlerMap = new LinkedHashMap<>();
        for (EndpointHandler handler : handlers) {
            if (handlerMap.containsKey(handler.path())) {
                throw new IllegalArgumentException(
                        "Duplicate handler path: '%s' (existing: '%s', new: '%s')"
                                .formatted(handler.path(),
                                        handlerMap.get(handler.path()).name(),
                                        handler.name()));
            }
            handlerMap.put(handler.path(), handler);
        }
    }

    @SuppressWarnings("java:S3516")
    // Always returns true — this handler handles all requests per Jetty contract
    @Override
    public boolean handle(Request request, Response response, Callback callback) {
        try {
            dispatch(request, response, callback);
        } catch (IOException e) {
            LOGGER.error(e, RestApiLogMessages.ERROR.HANDLER_ERROR, e.getMessage());
            sendProblemResponse(response, callback, ProblemDetail.internalError());
        }
        return true;
    }

    private void dispatch(Request request, Response response, Callback callback) throws IOException {
        String rawPath = request.getHttpURI().getPath();
        String method = request.getMethod();
        String remoteHost = Request.getRemoteAddr(request);

        // 1. Sanitize input
        Optional<SanitizedRequest> sanitized = validateAndSanitizeInput(
                request, response, callback, method, rawPath, remoteHost);
        if (sanitized.isEmpty()) {
            return;
        }
        String path = sanitized.get().path();

        // 2. Lookup handler by path
        EndpointHandler handler = handlerMap.get(path);
        if (handler == null || !handler.enabled()) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.ROUTE_NOT_FOUND);
            LOGGER.warn(RestApiLogMessages.WARN.ROUTE_NOT_FOUND, path);
            sendProblemResponse(response, callback,
                    ProblemDetail.notFound("No route configured for path: " + path));
            return;
        }
        LOGGER.info(RestApiLogMessages.INFO.ROUTE_MATCHED, method, path, handler.name());

        // 3. Method check
        if (!handler.methods().contains(method.toUpperCase(Locale.ROOT))) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.METHOD_NOT_ALLOWED);
            LOGGER.warn(RestApiLogMessages.WARN.METHOD_NOT_ALLOWED, method, handler.name(), path);
            response.getHeaders().put(HEADER_ALLOW, String.join(", ", handler.methods()));
            sendProblemResponse(response, callback,
                    ProblemDetail.methodNotAllowed(
                            "Method %s not allowed on %s. Allowed: %s".formatted(
                                    method, path, handler.methods())));
            return;
        }

        // 4. Auth-mode dispatch
        AuthResult authResult = resolveAuth(handler.authMode(), request, response, callback,
                method, path, remoteHost);
        if (authResult instanceof AuthResult.ErrorSent) {
            return;
        }
        AccessTokenContent token = ((AuthResult.Success) authResult).token();

        // 5. Authorization (shared — skipped when roles+scopes are empty)
        if (token != null && hasAuthorizationRequirements(handler)) {
            if (!authorizeRequest(token, handler, response, callback, method, path, remoteHost)) {
                return;
            }
        }
        LOGGER.info(RestApiLogMessages.INFO.AUTH_SUCCESSFUL, method, path, remoteHost);

        // 6. Body read + size check
        byte[] body = EMPTY_BODY;
        int effectiveMaxSize = handler.maxRequestSize() > 0 ? handler.maxRequestSize() : globalMaxRequestSize;
        if (effectiveMaxSize > 0) {
            body = readBody(request, effectiveMaxSize);
            if (body.length > effectiveMaxSize) {
                gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.BODY_TOO_LARGE);
                LOGGER.warn(RestApiLogMessages.WARN.BODY_TOO_LARGE, body.length, effectiveMaxSize, method, path);
                sendProblemResponse(response, callback,
                        ProblemDetail.payloadTooLarge(
                                "Request body size %d exceeds maximum %d bytes".formatted(body.length, effectiveMaxSize)));
                return;
            }
        }

        // 7. Delegate to handler
        handler.process(sanitized.get(), token, body, request, response, callback);
    }

    /**
     * Resolves authentication based on the auth mode.
     */
    private AuthResult resolveAuth(AuthMode authMode, Request request,
            Response response, Callback callback,
            String method, String path, String remoteHost) {
        return switch (authMode) {
            case NONE -> new AuthResult.Success(null);
            case LOCAL_ONLY -> {
                if (loopbackBypassEnabled && RequestUtils.isLoopbackRequest(request)) {
                    yield new AuthResult.Success(extractAndValidateTokenOptionally(request));
                }
                yield requireBearerToken(request, response, callback, method, path, remoteHost);
            }
            case BEARER -> requireBearerToken(request, response, callback, method, path, remoteHost);
        };
    }

    /**
     * Tries to extract and validate a Bearer token if present.
     * Used for LOCAL_ONLY loopback requests where auth is optional.
     */
    @Nullable
    private AccessTokenContent extractAndValidateTokenOptionally(Request request) {
        Optional<String> rawToken = extractBearerToken(request);
        if (rawToken.isEmpty()) {
            return null;
        }
        try {
            return configService.validateToken(rawToken.get());
        } catch (TokenValidationException e) {
            LOGGER.debug("Optional token validation failed on loopback request: %s", e.getMessage());
            return null;
        }
    }

    /**
     * Requires a valid Bearer token.
     */
    private AuthResult requireBearerToken(Request request, Response response,
            Callback callback,
            String method, String path, String remoteHost) {
        Optional<String> rawToken = extractBearerToken(request);
        if (rawToken.isEmpty()) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.MISSING_BEARER_TOKEN);
            LOGGER.warn(RestApiLogMessages.WARN.MISSING_BEARER_TOKEN, method, path, remoteHost);
            response.getHeaders().put(WWW_AUTHENTICATE, BEARER_CHALLENGE);
            sendProblemResponse(response, callback,
                    ProblemDetail.unauthorized("Missing or malformed Authorization header"));
            return new AuthResult.ErrorSent();
        }
        try {
            AccessTokenContent token = configService.validateToken(rawToken.get());
            return new AuthResult.Success(token);
        } catch (TokenValidationException e) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.AUTH_FAILED);
            LOGGER.warn(RestApiLogMessages.WARN.AUTH_FAILED, method, path, remoteHost, e.getMessage());
            response.getHeaders().put(WWW_AUTHENTICATE, BEARER_INVALID_TOKEN);
            sendProblemResponse(response, callback,
                    ProblemDetail.unauthorized("Token validation failed: " + e.getMessage()));
            return new AuthResult.ErrorSent();
        }
    }

    private boolean authorizeRequest(
            AccessTokenContent token, EndpointHandler handler,
            Response response, Callback callback,
            String method, String path, String remoteHost) {
        var requirements = new AuthorizationRequirements(true,
                handler.requiredRoles(), handler.requiredScopes());
        var authResult = AuthorizationValidator.validate(token, requirements);
        if (authResult.isAuthorized()) {
            return true;
        }
        //noinspection DataFlowIssue
        LOGGER.warn(RestApiLogMessages.WARN.AUTHZ_FAILED, method, path, remoteHost, authResult.getReason());
        if (!authResult.getMissingScopes().isEmpty()) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.AUTHZ_SCOPE_DENIED);
            response.getHeaders().put(WWW_AUTHENTICATE,
                    BEARER_INSUFFICIENT_SCOPE_TEMPLATE
                            .formatted(String.join(" ", handler.requiredScopes())));
            sendProblemResponse(response, callback,
                    ProblemDetail.unauthorized("Insufficient scopes: " + authResult.getReason()));
        } else {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.AUTHZ_ROLE_DENIED);
            sendProblemResponse(response, callback,
                    ProblemDetail.forbidden("Insufficient roles: " + authResult.getReason()));
        }
        return false;
    }

    private Optional<SanitizedRequest> validateAndSanitizeInput(
            Request request, Response response, Callback callback,
            String method, String path, String remoteHost) {
        try {
            String sanitizedPath = securityPipelines.urlPathPipeline().validate(path)
                    .orElse(path);

            var queryParams = Request.extractQueryParameters(request);
            Map<String, String> sanitizedParams = new LinkedHashMap<>();
            for (String name : queryParams.getNames()) {
                String sanitizedValue = securityPipelines.urlParameterPipeline()
                        .validate(queryParams.getValue(name))
                        .orElse(queryParams.getValue(name));
                sanitizedParams.put(name, sanitizedValue);
            }

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

    // --- Utility methods ---

    private static boolean hasAuthorizationRequirements(EndpointHandler handler) {
        return !handler.requiredRoles().isEmpty() || !handler.requiredScopes().isEmpty();
    }

    private static Optional<String> extractBearerToken(Request request) {
        String authHeader = request.getHeaders().get(HttpHeader.AUTHORIZATION);
        if (authHeader == null || !authHeader.regionMatches(true, 0, "Bearer ", 0, BEARER_PREFIX_LENGTH)) {
            return Optional.empty();
        }
        String token = authHeader.substring(BEARER_PREFIX_LENGTH).trim();
        return token.isEmpty() ? Optional.empty() : Optional.of(token);
    }

    private static byte[] readBody(Request request, int maxSize) throws IOException {
        try (var inputStream = Content.Source.asInputStream(request)) {
            return inputStream.readNBytes(maxSize + 1);
        }
    }

    private static void sendProblemResponse(Response response, Callback callback, ProblemDetail problem) {
        response.setStatus(problem.status());
        response.getHeaders().put(HttpHeader.CONTENT_TYPE, ProblemDetail.CONTENT_TYPE);
        byte[] body = problem.toJson().getBytes(StandardCharsets.UTF_8);
        response.getHeaders().put(HttpHeader.CONTENT_LENGTH, body.length);
        response.write(true, ByteBuffer.wrap(body), callback);
    }
}
