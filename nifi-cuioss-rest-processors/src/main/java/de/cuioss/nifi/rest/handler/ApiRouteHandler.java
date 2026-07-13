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

import de.cuioss.nifi.rest.RestApiLogMessages;
import de.cuioss.nifi.rest.config.AuthMode;
import de.cuioss.nifi.rest.config.RouteConfiguration;
import de.cuioss.nifi.rest.config.TrackingMode;
import de.cuioss.nifi.rest.validation.JsonSchemaValidator;
import de.cuioss.nifi.rest.validation.SchemaViolation;
import de.cuioss.sheriff.token.validation.domain.token.AccessTokenContent;
import de.cuioss.tools.logging.CuiLogger;
import org.eclipse.jetty.http.HttpHeader;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import org.jspecify.annotations.Nullable;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.stream.Collectors;

/**
 * Handler for user-configured API routes. Wraps a {@link RouteConfiguration}
 * and implements schema validation, FlowFile enqueue, and response generation.
 */
public final class ApiRouteHandler implements EndpointHandler {

    private static final CuiLogger LOGGER = new CuiLogger(ApiRouteHandler.class);
    private static final byte[] ACCEPTED_RESPONSE = "{\"status\":\"accepted\"}".getBytes(StandardCharsets.UTF_8);
    private static final byte[] OK_RESPONSE = "{\"status\":\"ok\"}".getBytes(StandardCharsets.UTF_8);

    private static final String X_PARENT_TRACE_ID = "X-Parent-Trace-Id";

    private final RouteConfiguration route;
    private final BlockingQueue<HttpRequestContainer> queue;
    private final int globalMaxRequestSize;
    @Nullable private final JsonSchemaValidator schemaValidator;
    private final GatewaySecurityEvents gatewaySecurityEvents;
    @Nullable private final RequestStatusStore statusStore;
    private final int attachmentsHardLimit;

    public ApiRouteHandler(RouteConfiguration route,
            BlockingQueue<HttpRequestContainer> queue,
            int globalMaxRequestSize,
            @Nullable JsonSchemaValidator schemaValidator,
            GatewaySecurityEvents gatewaySecurityEvents) {
        this(route, queue, globalMaxRequestSize, schemaValidator, gatewaySecurityEvents, null, 0);
    }

    public ApiRouteHandler(RouteConfiguration route,
            BlockingQueue<HttpRequestContainer> queue,
            int globalMaxRequestSize,
            @Nullable JsonSchemaValidator schemaValidator,
            GatewaySecurityEvents gatewaySecurityEvents,
            @Nullable RequestStatusStore statusStore) {
        this(route, queue, globalMaxRequestSize, schemaValidator, gatewaySecurityEvents, statusStore, 0);
    }

    public ApiRouteHandler(RouteConfiguration route,
            BlockingQueue<HttpRequestContainer> queue,
            int globalMaxRequestSize,
            @Nullable JsonSchemaValidator schemaValidator,
            GatewaySecurityEvents gatewaySecurityEvents,
            @Nullable RequestStatusStore statusStore,
            int attachmentsHardLimit) {
        this.route = route;
        this.queue = queue;
        this.globalMaxRequestSize = globalMaxRequestSize;
        this.schemaValidator = schemaValidator;
        this.gatewaySecurityEvents = gatewaySecurityEvents;
        this.statusStore = statusStore;
        this.attachmentsHardLimit = attachmentsHardLimit;
    }

    @Override
    public String name() {
        return route.name();
    }

    @Override
    public String path() {
        return route.path();
    }

    @Override
    public Set<String> methods() {
        return route.methods();
    }

    @Override
    public Set<AuthMode> authModes() {
        return route.authModes();
    }

    @Override
    public boolean enabled() {
        return route.enabled();
    }

    @Override
    public boolean builtIn() {
        return false;
    }

    @Override
    public Set<String> requiredRoles() {
        return route.requiredRoles();
    }

    @Override
    public Set<String> requiredScopes() {
        return route.requiredScopes();
    }

    @Override
    public int maxRequestSize() {
        return route.maxRequestSize() > 0 ? route.maxRequestSize() : globalMaxRequestSize;
    }

    @Override
    public void process(SanitizedRequest sanitized,
            @Nullable AccessTokenContent token,
            byte[] body,
            Request request, Response response, Callback callback) throws IOException {
        String method = request.getMethod();
        String path = sanitized.path();

        // Schema validation applies only when a body is expected (POST/PUT/PATCH) or a body
        // is actually present. Body-less methods (GET/DELETE) with an empty body are not
        // 422'd — an empty body is unparseable JSON and must not be treated as a violation.
        if ((isBodyMethod(method) || body.length > 0) && !validateSchema(body, response, callback)) {
            return;
        }

        // Determine if this is a tracked body method
        boolean tracked = route.isTracked() && isBodyMethod(method) && statusStore != null;
        String traceId = null;
        String parentTraceId = null;

        if (tracked) {
            traceId = UUID.randomUUID().toString();
            parentTraceId = getHeaderIgnoreCase(sanitized.headers(), X_PARENT_TRACE_ID);
            if (!registerTracking(traceId, parentTraceId, response, callback)) {
                return;
            }
        }

        if (!enqueueFlowFile(sanitized, token, body, request,
                new TrackingContext(traceId, parentTraceId), response, callback)) {
            // M5: enqueueFlowFile has already evicted the tracking entry (before flushing the 503),
            // so a queue-full response never leaves an orphaned non-terminal entry in the cache.
            return;
        }

        // Success response — audit logging prefers the honored forwarded client IP.
        String remoteHost = sanitized.forwarding().clientIp().orElse(Request.getRemoteAddr(request));
        LOGGER.info(RestApiLogMessages.INFO.REQUEST_PROCESSED,
                route.name(), method, path, remoteHost);
        if (tracked) {
            RequestUtils.sendAcceptedResponse(request, sanitized, response, callback, traceId,
                    route.trackingMode() == TrackingMode.ATTACHMENTS);
        } else {
            sendSuccessResponse(response, callback, method);
        }
    }

    private boolean validateSchema(byte[] body, Response response, Callback callback) {
        if (schemaValidator == null || !route.hasSchemaValidation()) {
            return true;
        }
        List<SchemaViolation> violations = schemaValidator.validate(route.name(), body);
        if (violations.isEmpty()) {
            return true;
        }
        gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.SCHEMA_VALIDATION_FAILED);
        int maxLogViolations = 5;
        String violationSummary = violations.stream()
                .limit(maxLogViolations)
                .map(v -> v.pointer() + ": " + v.message())
                .collect(Collectors.joining("; "));
        if (violations.size() > maxLogViolations) {
            violationSummary += " ... and %d more".formatted(violations.size() - maxLogViolations);
        }
        LOGGER.warn(RestApiLogMessages.WARN.VALIDATION_FAILED, route.name(), violationSummary);
        ProblemDetail.validationError(
                "Request body failed JSON Schema validation", violations)
                .sendResponse(response, callback);
        return false;
    }

    /**
     * Case-insensitive header lookup (RFC 9110 §5.1: field names are case-insensitive).
     * The sanitized header map is keyed by the name exactly as the client sent it, so a
     * client sending {@code x-parent-trace-id} must still resolve the parent linkage.
     */
    @Nullable
    private static String getHeaderIgnoreCase(Map<String, String> headers, String name) {
        String direct = headers.get(name);
        if (direct != null) {
            return direct;
        }
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            if (entry.getKey().equalsIgnoreCase(name)) {
                return entry.getValue();
            }
        }
        return null;
    }

    private boolean registerTracking(String traceId, @Nullable String parentTraceId,
            Response response, Callback callback) {
        try {
            if (route.trackingMode() == TrackingMode.ATTACHMENTS) {
                // C1: attachments-max-count = 0 means "use the global hard limit" (per the docs).
                // Resolve the effective cap here so the persisted COLLECTING_ATTACHMENTS entry always
                // carries a positive maximum; a docs-exact route (max-count unset/0) then accepts
                // attachments up to the hard limit instead of being 409-rejected downstream.
                int effectiveMax = route.attachmentsMaxCount() > 0
                        ? route.attachmentsMaxCount()
                        : attachmentsHardLimit;
                statusStore.collectingAttachments(traceId, parentTraceId, route.name(),
                        effectiveMax, route.attachmentsMinCount());
            } else {
                statusStore.accept(traceId, parentTraceId);
            }
        } catch (IOException e) {
            LOGGER.warn(RestApiLogMessages.WARN.STATUS_STORE_ERROR, e.getMessage());
            ProblemDetail.serviceUnavailable("Status store temporarily unavailable")
                    .sendResponse(response, callback);
            return false;
        }
        LOGGER.info(RestApiLogMessages.INFO.REQUEST_TRACKED, traceId, route.name());
        return true;
    }

    /**
     * Removes a tracking entry that was persisted by {@link #registerTracking} but whose FlowFile
     * enqueue then failed (queue-full 503). Null-safe on the status store: only tracked routes
     * reach this path.
     */
    private void removeTracking(String traceId) {
        if (statusStore == null) {
            return;
        }
        try {
            statusStore.remove(traceId);
        } catch (IOException e) {
            LOGGER.warn(RestApiLogMessages.WARN.STATUS_STORE_ERROR, e.getMessage());
        }
    }

    private boolean enqueueFlowFile(SanitizedRequest sanitized, @Nullable AccessTokenContent token,
            byte[] body, Request request, TrackingContext tracking,
            Response response, Callback callback) {
        if (!route.createFlowFile()) {
            LOGGER.info(RestApiLogMessages.INFO.ROUTE_FLOWFILE_SKIPPED, route.name());
            return true;
        }
        String remoteHost = sanitized.forwarding().clientIp().orElse(Request.getRemoteAddr(request));
        var container = new HttpRequestContainer(
                route.name(), request.getMethod(), sanitized.path(),
                sanitized.queryParameters(), sanitized.headers(),
                remoteHost,
                body,
                request.getHeaders().get(HttpHeader.CONTENT_TYPE),
                token,
                tracking.traceId(),
                tracking.parentTraceId(),
                sanitized.pathParameters());

        if (!queue.offer(container)) {
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.QUEUE_FULL);
            LOGGER.warn(RestApiLogMessages.WARN.QUEUE_FULL, request.getMethod(), sanitized.path(), remoteHost);
            // M5: evict the tracking entry BEFORE the 503 is flushed. Doing it after the response
            // (in the caller) races the client — which can observe the orphaned non-terminal entry
            // in the window between receiving the 503 and the eviction completing on the server.
            if (tracking.traceId() != null) {
                removeTracking(tracking.traceId());
            }
            ProblemDetail.serviceUnavailable("Server is at capacity, please retry later")
                    .sendResponse(response, callback);
            return false;
        }
        return true;
    }

    private static void sendSuccessResponse(Response response, Callback callback, String method) {
        // I6: a body method (POST/PUT/PATCH) is 202 Accepted with {"status":"accepted"}; a body-less
        // method (GET/DELETE) is a synchronous 200 OK and must NOT reuse the misleading "accepted"
        // payload — it returns {"status":"ok"}.
        boolean bodyMethod = isBodyMethod(method);
        int statusCode = bodyMethod ? 202 : 200;
        byte[] payload = bodyMethod ? ACCEPTED_RESPONSE : OK_RESPONSE;
        response.setStatus(statusCode);
        response.getHeaders().put(HttpHeader.CONTENT_TYPE, "application/json");
        response.getHeaders().put(HttpHeader.CONTENT_LENGTH, payload.length);
        response.write(true, ByteBuffer.wrap(payload), callback);
    }

    private static boolean isBodyMethod(String method) {
        return "POST".equalsIgnoreCase(method)
                || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method);
    }

}
