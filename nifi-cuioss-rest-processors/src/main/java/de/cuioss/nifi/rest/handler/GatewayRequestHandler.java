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
import de.cuioss.nifi.jwt.util.ProxyContextPathResolver;
import de.cuioss.nifi.rest.RestApiLogMessages;
import de.cuioss.nifi.rest.config.AuthMode;
import de.cuioss.nifi.rest.config.RoutePattern;
import de.cuioss.sheriff.token.validation.domain.token.AccessTokenContent;
import de.cuioss.sheriff.token.validation.exception.TokenValidationException;
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
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Function;

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
    /**
     * Compiled path-template routes in registration order. Only handlers whose
     * {@code path()} declares {@code {placeholder}} segments are compiled here;
     * plain routes stay on the exact/prefix passes.
     */
    private final List<PatternRoute> patternRoutes;
    private final JwtIssuerConfigService configService;
    private final int globalMaxRequestSize;
    private final PipelineSet securityPipelines;
    /**
     * Operator-configured allowlist of reverse-proxy context paths honored from the
     * {@code X-ProxyContextPath} / {@code X-Forwarded-Prefix} headers. Empty (the
     * secure default) honors nothing, so a direct client cannot spoof the prefix.
     */
    private final Set<String> allowedContextPaths;
    /**
     * When {@code true}, any resolved+normalized proxy context path is honored
     * WITHOUT the {@link #allowedContextPaths} check. The header value is still
     * cui-http-sanitized and injection-guarded by the resolver's normalization.
     * Secure default is {@code false} (the allowlist governs).
     */
    private final boolean trustAllProxyContextPaths;
    /**
     * Guards the one-shot WARN emitted when a proxy context-path header arrives but
     * is not honored because the allowlist is empty and trust-all is off (the
     * "positive-list active but empty" misconfiguration). Logged once per handler
     * instance so a proxied deployment surfaces the fix without log spam.
     */
    private final AtomicBoolean proxyContextPathIgnoredWarned =
            new AtomicBoolean(false);

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

    /** A compiled path template paired with the handler it routes to. */
    private record PatternRoute(RoutePattern pattern, EndpointHandler handler) {
    }

    /**
     * The outcome of route resolution: the matched handler and the path
     * parameters extracted from a pattern match (empty for exact/prefix matches).
     */
    private record ResolvedRoute(EndpointHandler handler, Map<String, String> pathParameters) {
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
                new SecurityEventCounter(), new GatewaySecurityEvents(), Set.of(), false);
    }

    /**
     * Creates a new dispatcher with pre-created event counters and the honored
     * proxy-context-path allowlist.
     * Use this when handlers need access to the same event counter instances.
     *
     * @param handlers               ordered list of endpoint handlers
     * @param configService          JWT issuer config service for token validation
     * @param globalMaxRequestSize   global maximum request body size in bytes
     * @param httpSecurityEvents     pre-created transport security event counter
     * @param gatewaySecurityEvents  pre-created gateway event counter
     * @param allowedContextPaths    normalized allowlist of reverse-proxy context paths
     *                               honored from the proxy headers (empty honors nothing)
     * @param trustAllProxyContextPaths when {@code true}, honor ANY resolved proxy context
     *                               path without the allowlist check; {@code false} (secure
     *                               default) defers to {@code allowedContextPaths}
     */
    public GatewayRequestHandler(
            List<EndpointHandler> handlers,
            JwtIssuerConfigService configService,
            int globalMaxRequestSize,
            SecurityEventCounter httpSecurityEvents,
            GatewaySecurityEvents gatewaySecurityEvents,
            Set<String> allowedContextPaths,
            boolean trustAllProxyContextPaths) {
        this.configService = Objects.requireNonNull(configService);
        this.globalMaxRequestSize = globalMaxRequestSize;
        this.allowedContextPaths = Set.copyOf(allowedContextPaths);
        this.trustAllProxyContextPaths = trustAllProxyContextPaths;
        this.httpSecurityEvents = Objects.requireNonNull(httpSecurityEvents);
        this.gatewaySecurityEvents = Objects.requireNonNull(gatewaySecurityEvents);
        // The gateway is the system's most external HTTP boundary (raw inbound
        // requests from arbitrary clients), so it uses the strict security posture —
        // consistent with the UI validation servlets (JwksValidationServlet,
        // GatewayProxyServlet) which also build their pipelines with
        // SecurityConfiguration.strict(). Hard violations are rejected with HTTP 400
        // via the UrlSecurityException catch in validateAndSanitizeInput.
        this.securityPipelines = PipelineFactory.createCommonPipelines(
                SecurityConfiguration.strict(), this.httpSecurityEvents);

        this.handlerMap = new LinkedHashMap<>();
        this.patternRoutes = new ArrayList<>();
        for (EndpointHandler handler : handlers) {
            if (handlerMap.containsKey(handler.path())) {
                throw new IllegalArgumentException(
                        "Duplicate handler path: '%s' (existing: '%s', new: '%s')"
                                .formatted(handler.path(),
                                        handlerMap.get(handler.path()).name(),
                                        handler.name()));
            }
            handlerMap.put(handler.path(), handler);
            if (RoutePattern.containsPlaceholders(handler.path())) {
                patternRoutes.add(new PatternRoute(RoutePattern.compile(handler.path()), handler));
            }
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

        // Strip the reverse-proxy context path (if any) from the already-sanitized
        // path before routing, so a proxied request such as /nifi-proxy/health with
        // X-ProxyContextPath: /nifi-proxy resolves to the /health handler. The prefix
        // was resolved once — against the operator-configured allowlist — in
        // validateAndSanitizeInput and stored on the SanitizedRequest, so a client
        // cannot spoof an unallowlisted prefix (it resolves to empty). An unprefixed
        // or unallowlisted request has an empty prefix and is byte-identical to today.
        // The pre-strip path is retained for the no-route diagnostics below so a
        // proxy-misconfiguration surfaces the original request path, not the stripped one.
        String rawSanitizedPath = path;
        String proxyPrefix = sanitized.get().proxyContextPath();
        if (!proxyPrefix.isEmpty()) {
            path = stripProxyPrefix(path, proxyPrefix);
        }

        // 2. Lookup handler (exact → prefix → pattern)
        ResolvedRoute resolved = resolveHandler(path);
        if (resolved == null || !resolved.handler().enabled()) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.ROUTE_NOT_FOUND);
            LOGGER.warn(RestApiLogMessages.WARN.ROUTE_NOT_FOUND, rawSanitizedPath);
            sendProblemResponse(response, callback,
                    ProblemDetail.notFound("No route configured for path: " + rawSanitizedPath));
            return;
        }
        EndpointHandler handler = resolved.handler();
        Map<String, String> pathParameters = resolved.pathParameters();
        LOGGER.info(RestApiLogMessages.INFO.ROUTE_MATCHED, method, path, handler.name());

        // 3. Method check
        if (!handler.methods().contains(method.toUpperCase(Locale.ROOT))) {
            rejectMethod(handler, method, path, response, callback);
            return;
        }

        // 4. Auth-mode dispatch — authenticate BEFORE buffering the request body so
        // unauthenticated clients cannot make the server buffer up to maxRequestSize bytes
        AuthResult authResult = resolveAuth(handler.authModes(), request, response, callback,
                method, path, remoteHost);
        if (authResult instanceof AuthResult.ErrorSent) {
            return;
        }
        AccessTokenContent token = ((AuthResult.Success) authResult).token();

        // 5. Authorization (shared — skipped when roles+scopes are empty)
        if (token != null && hasAuthorizationRequirements(handler)
                && !authorizeRequest(token, handler, response, callback, method, path, remoteHost)) {
            return;
        }
        LOGGER.info(RestApiLogMessages.INFO.AUTH_SUCCESSFUL, method, path, remoteHost);

        // 6. Body read + size check
        Optional<byte[]> bodyOpt = readAndValidateBody(request, handler, method, path, response, callback);
        if (bodyOpt.isEmpty()) {
            return;
        }
        byte[] body = bodyOpt.get();

        // 7. Delegate to handler (attach extracted path parameters)
        handler.process(sanitized.get().withPathParameters(pathParameters), token, body, request, response, callback);
    }

    /**
     * Resolves the request path to a handler using three ordered passes:
     * exact match, prefix match, then pattern match. The first pass to hit wins,
     * so a literal path that also matches a pattern resolves to its exact handler.
     *
     * @param path the sanitized request path
     * @return the resolved route, or {@code null} when no pass matches
     */
    @Nullable
    private ResolvedRoute resolveHandler(String path) {
        if (path == null) {
            return null;
        }
        EndpointHandler exact = handlerMap.get(path);
        if (exact != null) {
            return new ResolvedRoute(exact, Map.of());
        }
        for (EndpointHandler h : handlerMap.values()) {
            if (h.prefixMatch() && path.startsWith(h.path() + "/")) {
                return new ResolvedRoute(h, Map.of());
            }
        }
        for (PatternRoute route : patternRoutes) {
            Optional<Map<String, String>> parameters = route.pattern().match(path);
            if (parameters.isPresent()) {
                return new ResolvedRoute(route.handler(), parameters.get());
            }
        }
        return null;
    }

    private void rejectMethod(EndpointHandler handler, String method, String path,
            Response response, Callback callback) {
        gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.METHOD_NOT_ALLOWED);
        LOGGER.warn(RestApiLogMessages.WARN.METHOD_NOT_ALLOWED, method, handler.name(), path);
        response.getHeaders().put(HEADER_ALLOW, String.join(", ", handler.methods()));
        sendProblemResponse(response, callback,
                ProblemDetail.methodNotAllowed(
                        "Method %s not allowed on %s. Allowed: %s".formatted(
                                method, path, handler.methods())));
    }

    /**
     * Reads and validates the request body size. Returns empty if body exceeds limit
     * (error response already sent).
     */
    private Optional<byte[]> readAndValidateBody(Request request, EndpointHandler handler,
            String method, String path,
            Response response, Callback callback) throws IOException {
        int effectiveMaxSize = handler.maxRequestSize() > 0 ? handler.maxRequestSize() : globalMaxRequestSize;
        if (effectiveMaxSize <= 0) {
            return Optional.of(EMPTY_BODY);
        }
        byte[] body = readBody(request, effectiveMaxSize);
        if (body.length > effectiveMaxSize) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.BODY_TOO_LARGE);
            LOGGER.warn(RestApiLogMessages.WARN.BODY_TOO_LARGE, body.length, effectiveMaxSize, method, path);
            sendProblemResponse(response, callback,
                    ProblemDetail.payloadTooLarge(
                            "Request body size %d exceeds maximum %d bytes".formatted(body.length, effectiveMaxSize)));
            return Optional.empty();
        }
        return Optional.of(body);
    }

    /**
     * Resolves authentication based on the auth modes.
     * <p>
     * Evaluation order:
     * <ol>
     *   <li>NONE — accepts everything</li>
     *   <li>LOCAL_ONLY + loopback — accepts unauthenticated loopback</li>
     *   <li>BEARER — requires JWT</li>
     *   <li>LOCAL_ONLY without loopback — rejects remote requests</li>
     * </ol>
     */
    private AuthResult resolveAuth(Set<AuthMode> authModes, Request request,
            Response response, Callback callback,
            String method, String path, String remoteHost) {
        // NONE accepts everything
        if (authModes.contains(AuthMode.NONE)) {
            return new AuthResult.Success(null);
        }
        boolean isLoopback = loopbackBypassEnabled && RequestUtils.isLoopbackRequest(request);
        // LOCAL_ONLY accepts unauthenticated loopback
        if (authModes.contains(AuthMode.LOCAL_ONLY) && isLoopback) {
            return new AuthResult.Success(extractAndValidateTokenOptionally(request));
        }
        // BEARER requires JWT
        if (authModes.contains(AuthMode.BEARER)) {
            return requireBearerToken(request, response, callback, method, path, remoteHost);
        }
        // LOCAL_ONLY without loopback → reject remote requests
        if (authModes.contains(AuthMode.LOCAL_ONLY)) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.MISSING_BEARER_TOKEN);
            response.getHeaders().put(WWW_AUTHENTICATE, BEARER_CHALLENGE);
            sendProblemResponse(response, callback,
                    ProblemDetail.unauthorized("This endpoint requires local access or Bearer token"));
            return new AuthResult.ErrorSent();
        }
        // Defensive fallback -- unreachable when AuthMode.fromValues() ensures a non-empty set
        return requireBearerToken(request, response, callback, method, path, remoteHost);
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
        if (authResult.authorized()) {
            return true;
        }
        //noinspection DataFlowIssue
        LOGGER.warn(RestApiLogMessages.WARN.AUTHZ_FAILED, method, path, remoteHost, authResult.reason());
        if (!authResult.missingScopes().isEmpty()) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.AUTHZ_SCOPE_DENIED);
            response.getHeaders().put(WWW_AUTHENTICATE,
                    BEARER_INSUFFICIENT_SCOPE_TEMPLATE
                            .formatted(String.join(" ", handler.requiredScopes())));
            // RFC 6750 §3.1: insufficient_scope → 403 Forbidden (401 is for missing/invalid tokens)
            sendProblemResponse(response, callback,
                    ProblemDetail.forbidden("Insufficient scopes: " + authResult.reason()));
        } else {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.AUTHZ_ROLE_DENIED);
            sendProblemResponse(response, callback,
                    ProblemDetail.forbidden("Insufficient roles: " + authResult.reason()));
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

            // Resolve the honored reverse-proxy context path ONCE here — this is the
            // single place that has both the cui-http header pipeline and the allowlist.
            // The raw proxy header is routed through the header-value pipeline so the
            // value used is cui-http-sanitized; a hard UrlSecurityException in any header
            // has already produced a 400 in the loop above, so the .orElse(raw) soft path
            // never sees a hard-attack value here.
            String proxyContextPath = resolveHonoredProxyPrefix(
                    name -> {
                        String raw = request.getHeaders().get(name);
                        return raw == null ? null
                                : securityPipelines.headerValuePipeline().validate(raw).orElse(raw);
                    });

            return Optional.of(new SanitizedRequest(
                    sanitizedPath, sanitizedParams, sanitizedHeaders, proxyContextPath, Map.of()));
        } catch (UrlSecurityException e) {
            LOGGER.warn(RestApiLogMessages.WARN.SECURITY_VIOLATION, method, path, remoteHost, e.getMessage());
            sendProblemResponse(response, callback,
                    ProblemDetail.badRequest("Request rejected: " + e.getFailureType().getDescription()));
            return Optional.empty();
        }
    }

    /**
     * Resolves the reverse-proxy context path that this handler will honor, applying
     * the trust-all / allowlist policy. Returns the normalized prefix when honored,
     * or an empty string when it must not be trusted.
     *
     * <p>When trust-all is enabled every normalized prefix is honored (the value is
     * already cui-http-sanitized and injection-guarded by the resolver's
     * normalization). Otherwise the prefix is honored only when the operator-configured
     * allowlist contains it. When a prefix arrives but is not honored specifically
     * because the allowlist is empty and trust-all is off — the "positive-list active
     * but empty" misconfiguration — a WARN naming both config keys is emitted once so
     * the prefix is not silently dropped.
     *
     * @param headerLookup the sanitizing header-value lookup shared with input
     *                     sanitization
     * @return the honored normalized prefix, or an empty string when not honored
     */
    private String resolveHonoredProxyPrefix(Function<String, String> headerLookup) {
        String normalized = ProxyContextPathResolver.resolve(headerLookup);
        if (normalized.isEmpty()) {
            return "";
        }
        if (trustAllProxyContextPaths || allowedContextPaths.contains(normalized)) {
            return normalized;
        }
        // A proxy context-path header arrived but is not honored. When the allowlist is
        // empty AND trust-all is off, the gateway is behind a proxy but not configured to
        // honor it — surface the fix ONCE so the prefix is not silently dropped.
        if (allowedContextPaths.isEmpty() && proxyContextPathIgnoredWarned.compareAndSet(false, true)) {
            LOGGER.warn(RestApiLogMessages.WARN.PROXY_CONTEXT_PATH_IGNORED, normalized);
        }
        return "";
    }

    // --- Utility methods ---

    /**
     * Strips the reverse-proxy context path from the front of the sanitized path.
     * The prefix is dropped only when the path equals it (routing to the proxied
     * root {@code "/"}) or the path continues with a {@code "/"} after it, so a
     * prefix of {@code /nifi} never truncates an unrelated {@code /nifiXyz} path.
     *
     * @param path        the sanitized request path
     * @param proxyPrefix the non-empty, normalized proxy context path
     * @return the path with the prefix removed, or the original path when it does
     *         not carry the prefix
     */
    private static String stripProxyPrefix(String path, String proxyPrefix) {
        if (path.equals(proxyPrefix)) {
            return "/";
        }
        if (path.startsWith(proxyPrefix + "/")) {
            return path.substring(proxyPrefix.length());
        }
        return path;
    }

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
        problem.sendResponse(response, callback);
    }
}
