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

import de.cuioss.http.forwarded.ResolvedForwarding;
import de.cuioss.http.security.config.SecurityConfiguration;
import de.cuioss.http.security.exceptions.UrlSecurityException;
import de.cuioss.http.security.monitoring.SecurityEventCounter;
import de.cuioss.http.security.pipeline.PipelineFactory;
import de.cuioss.http.security.pipeline.PipelineFactory.PipelineSet;
import de.cuioss.nifi.jwt.config.JwtIssuerConfigService;
import de.cuioss.nifi.jwt.util.AuthorizationRequirements;
import de.cuioss.nifi.jwt.util.AuthorizationValidator;
import de.cuioss.nifi.jwt.util.ForwardedRequestResolver;
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
     * The configured resolver that resolves the full forwarded view (context-path,
     * scheme, host, port, client IP) from the request headers against the operator's
     * trust model. Secure-by-default: with no opt-in it honors nothing, so a direct
     * client cannot spoof any forwarded value.
     */
    private final ForwardedRequestResolver forwardedResolver;
    /**
     * Whether the deployment configured ANY context-path honoring (trust-all on, or a
     * non-empty allowlist). When {@code false} — the "positive-list active but empty"
     * secure-default posture — a proxy context-path header that arrives is a
     * misconfiguration signal (behind a proxy but not trusting it) and triggers the
     * one-shot WARN below. When {@code true}, a non-honored prefix is a deliberate
     * allowlist reject (or a spoof) and must NOT warn.
     */
    private final boolean contextPathHonoringConfigured;
    /**
     * Guards the one-shot WARN emitted when a proxy context-path header arrives but
     * is not honored (the "positive-list active but empty" misconfiguration). Logged
     * once per handler instance so a proxied deployment surfaces the fix without log spam.
     */
    private final AtomicBoolean proxyContextPathIgnoredWarned =
            new AtomicBoolean(false);

    private static final String HEADER_PROXY_CONTEXT_PATH = "X-ProxyContextPath";
    private static final String HEADER_FORWARDED_PREFIX = "X-Forwarded-Prefix";

    /**
     * Header names whose values are credentials and must never flow into FlowFile
     * {@code http.header.*} attributes or NiFi provenance. Compared case-insensitively.
     */
    private static final Set<String> SENSITIVE_HEADERS = Set.of(
            "authorization", "cookie", "set-cookie", "proxy-authorization",
            "x-api-key", "api-key", "x-api-token", "x-auth-token");

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
                new SecurityEventCounter(), new GatewaySecurityEvents(),
                ForwardedRequestResolver.secureDefault(), false);
    }

    /**
     * Creates a new dispatcher with pre-created event counters and the configured
     * forwarded-header resolver.
     * Use this when handlers need access to the same event counter instances.
     *
     * @param handlers                     ordered list of endpoint handlers
     * @param configService                JWT issuer config service for token validation
     * @param globalMaxRequestSize         global maximum request body size in bytes
     * @param httpSecurityEvents           pre-created transport security event counter
     * @param gatewaySecurityEvents        pre-created gateway event counter
     * @param forwardedResolver            the configured resolver for the reverse-proxy /
     *                                     forwarded-header family (secure-by-default honors nothing)
     * @param contextPathHonoringConfigured whether any context-path honoring is configured
     *                                     (trust-all on or a non-empty allowlist); {@code false}
     *                                     is the secure-default posture that triggers the one-shot
     *                                     "proxy header present but not honored" WARN
     */
    public GatewayRequestHandler(
            List<EndpointHandler> handlers,
            JwtIssuerConfigService configService,
            int globalMaxRequestSize,
            SecurityEventCounter httpSecurityEvents,
            GatewaySecurityEvents gatewaySecurityEvents,
            ForwardedRequestResolver forwardedResolver,
            boolean contextPathHonoringConfigured) {
        this.configService = Objects.requireNonNull(configService);
        this.globalMaxRequestSize = globalMaxRequestSize;
        this.forwardedResolver = Objects.requireNonNull(forwardedResolver);
        this.contextPathHonoringConfigured = contextPathHonoringConfigured;
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
        } catch (IOException | RuntimeException e) {
            // Top-level safety net at the Jetty handler boundary: any IOException or runtime
            // exception escaping dispatch() (token validation, JSON building, status store, …)
            // is routed through the HANDLER_ERROR log record, the gateway error counter, and the
            // RFC 9457 problem-details response — never Jetty's default HTML error page.
            LOGGER.error(e, RestApiLogMessages.ERROR.HANDLER_ERROR, e.getMessage());
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.HANDLER_ERROR);
            sendProblemResponse(response, callback, ProblemDetail.internalError());
        }
        return true;
    }

    private void dispatch(Request request, Response response, Callback callback) throws IOException {
        String rawPath = request.getHttpURI().getPath();
        String method = request.getMethod();
        String rawRemoteHost = Request.getRemoteAddr(request);

        // 1. Sanitize input — the forwarded view (including the honored client IP) is only
        // resolved on success, so the pre-sanitize security-violation log uses the raw socket
        // address. All subsequent audit logs prefer the honored forwarded client IP when present.
        Optional<SanitizedRequest> sanitized = validateAndSanitizeInput(
                request, response, callback, method, rawPath, rawRemoteHost);
        if (sanitized.isEmpty()) {
            return;
        }
        String remoteHost = sanitized.get().forwarding().clientIp().orElse(rawRemoteHost);
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

        // 3. Auth-mode dispatch — authenticate BEFORE resolving 405 (method-not-allowed) so an
        // unauthenticated client cannot enumerate which methods a protected route allows, and
        // BEFORE buffering the request body so unauthenticated clients cannot make the server
        // buffer up to maxRequestSize bytes. (404 stays pre-auth above: an unmatched path has no
        // handler, hence no auth-mode to gate against.)
        AuthResult authResult = resolveAuth(handler.authModes(), request, response, callback,
                method, path, remoteHost);
        if (authResult instanceof AuthResult.ErrorSent) {
            return;
        }
        AccessTokenContent token = ((AuthResult.Success) authResult).token();

        // 4. Method check (405) — resolved only after authentication (auth-first posture).
        if (!handler.methods().contains(method.toUpperCase(Locale.ROOT))) {
            rejectMethod(handler, method, path, response, callback);
            return;
        }

        // 5. Authorization (shared — skipped when roles+scopes are empty)
        if (token != null && hasAuthorizationRequirements(handler)
                && !authorizeRequest(token, handler, response, callback, method, path, remoteHost)) {
            return;
        }
        // Skip the AUTH_SUCCESSFUL audit line for anonymous (auth-mode=none) routes — no
        // authentication actually occurred and it is noise on the anonymous hot path.
        if (!handler.authModes().contains(AuthMode.NONE)) {
            LOGGER.info(RestApiLogMessages.INFO.AUTH_SUCCESSFUL, method, path, remoteHost);
        }

        // 6. Body read + size check
        Optional<byte[]> bodyOpt = readAndValidateBody(request, handler, method, path, response, callback);
        if (bodyOpt.isEmpty()) {
            return;
        }
        byte[] body = bodyOpt.get();

        // 7. Delegate to handler (hand it the prefix-stripped path + extracted path parameters).
        // `path` is the reverse-proxy-prefix-stripped path resolved above; when no prefix was
        // honored it equals the original sanitized path, so unproxied requests are byte-identical.
        // Handlers (StatusEndpointHandler / AttachmentsEndpointHandler) parse their path parameter
        // off sanitized.path(), so they must see the stripped path, not the /{prefix}/... one.
        handler.process(sanitized.get().withPath(path).withPathParameters(pathParameters),
                token, body, request, response, callback);
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
        // Single comma-separated format for the allowed-method list in BOTH the Allow header
        // and the problem `detail`, so one response never carries two renderings of one list.
        String allowed = String.join(", ", handler.methods());
        response.getHeaders().put(HEADER_ALLOW, allowed);
        sendProblemResponse(response, callback,
                ProblemDetail.methodNotAllowed(
                        "Method %s not allowed on %s. Allowed: %s".formatted(
                                method, path, allowed)));
    }

    /**
     * Reads and validates the request body size. Returns empty if body exceeds limit
     * (error response already sent).
     */
    private Optional<byte[]> readAndValidateBody(Request request, EndpointHandler handler,
            String method, String path,
            Response response, Callback callback) throws IOException {
        // A handler's maxRequestSize() of 0 means "use the global default" (always positive), so
        // effectiveMaxSize is always positive and the body is read+bounded for every method; there
        // is no dead "no body expected" short-circuit. Body-less GET/DELETE requests simply read
        // an empty body under the same bound.
        int effectiveMaxSize = handler.maxRequestSize() > 0 ? handler.maxRequestSize() : globalMaxRequestSize;
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

            // Single-value contract for query parameters: a repeated parameter takes its FIRST
            // value (Jetty's Fields.getValue returns the first), and getNames() yields each name
            // once — so a downstream FlowFile http.query.<name> attribute is deterministic.
            var queryParams = Request.extractQueryParameters(request);
            Map<String, String> sanitizedParams = new LinkedHashMap<>();
            for (String name : queryParams.getNames()) {
                String sanitizedValue = securityPipelines.urlParameterPipeline()
                        .validate(queryParams.getValue(name))
                        .orElse(queryParams.getValue(name));
                sanitizedParams.put(name, sanitizedValue);
            }

            // Single-value contract for headers: credential-bearing headers are excluded outright
            // (never leaked into http.header.* attributes / provenance), and repeated or
            // case-variant field lines for the same header name are combined into one comma-
            // separated value (RFC 9110 §5.2) so the downstream key-lowercasing cannot silently
            // drop a case-variant duplicate.
            Map<String, String> sanitizedHeaders = new LinkedHashMap<>();
            for (HttpField field : request.getHeaders()) {
                if (isSensitiveHeader(field.getName())) {
                    continue;
                }
                String sanitizedValue = securityPipelines.headerValuePipeline()
                        .validate(field.getValue())
                        .orElse(field.getValue());
                mergeHeaderValue(sanitizedHeaders, field.getName(), sanitizedValue);
            }

            // Resolve the full forwarded view ONCE here — the ForwardedRequestResolver owns
            // header precedence, sanitization (its own security pipeline), injection guards,
            // and the trust model (allowlist / trust-all / trusted-proxies). Raw headers are
            // passed in; the resolver sanitizes them internally, so only honored values survive.
            ResolvedForwarding forwarding = forwardedResolver.resolve(request.getHeaders()::get);
            maybeWarnProxyContextPathIgnored(request, forwarding);

            return Optional.of(new SanitizedRequest(
                    sanitizedPath, sanitizedParams, sanitizedHeaders, forwarding, Map.of()));
        } catch (UrlSecurityException e) {
            LOGGER.warn(RestApiLogMessages.WARN.SECURITY_VIOLATION, method, path, remoteHost, e.getMessage());
            sendProblemResponse(response, callback,
                    ProblemDetail.badRequest("Request rejected: " + e.getFailureType().getDescription()));
            return Optional.empty();
        }
    }

    /**
     * Surfaces the "positive-list active but empty" misconfiguration ONCE: a reverse-proxy
     * context-path header ({@code X-ProxyContextPath} / {@code X-Forwarded-Prefix}) arrived but
     * the resolver did not honor it (the honored context path is empty), so the gateway is behind
     * a proxy that sets the header but is not configured to trust it. Logged once per handler
     * instance so a proxied deployment surfaces the fix without log spam.
     *
     * @param request    the originating request (source of the raw proxy header)
     * @param forwarding the resolved forwarding view
     */
    private void maybeWarnProxyContextPathIgnored(Request request, ResolvedForwarding forwarding) {
        // Only the "positive-list active but empty" posture (no context-path honoring configured)
        // is a misconfiguration. When honoring IS configured, a non-honored prefix is a deliberate
        // allowlist reject (or a spoof) and must not warn.
        if (contextPathHonoringConfigured || !forwarding.contextPath().isEmpty()) {
            return;
        }
        String rawProxyHeader = firstProxyContextPathHeader(request);
        if (rawProxyHeader != null && proxyContextPathIgnoredWarned.compareAndSet(false, true)) {
            LOGGER.warn(RestApiLogMessages.WARN.PROXY_CONTEXT_PATH_IGNORED, rawProxyHeader);
        }
    }

    /**
     * Returns the first present, non-blank reverse-proxy context-path header value
     * ({@code X-ProxyContextPath} then {@code X-Forwarded-Prefix}), or {@code null} when neither
     * is present.
     */
    @Nullable
    private static String firstProxyContextPathHeader(Request request) {
        String proxyContextPath = request.getHeaders().get(HEADER_PROXY_CONTEXT_PATH);
        if (proxyContextPath != null && !proxyContextPath.isBlank()) {
            return proxyContextPath;
        }
        String forwardedPrefix = request.getHeaders().get(HEADER_FORWARDED_PREFIX);
        return forwardedPrefix != null && !forwardedPrefix.isBlank() ? forwardedPrefix : null;
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

    private static boolean isSensitiveHeader(String name) {
        return SENSITIVE_HEADERS.contains(name.toLowerCase(Locale.ROOT));
    }

    /**
     * Applies the single-value header contract (RFC 9110 §5.2): repeated or case-variant field
     * lines for the same header name are combined into one comma-separated value, so the
     * downstream lowercasing of header keys cannot silently drop a case-variant duplicate.
     */
    private static void mergeHeaderValue(Map<String, String> headers, String name, String value) {
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            if (entry.getKey().equalsIgnoreCase(name)) {
                entry.setValue(entry.getValue() + ", " + value);
                return;
            }
        }
        headers.put(name, value);
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
