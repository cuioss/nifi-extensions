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

    private static final String X_PARENT_TRACE_ID = "X-Parent-Trace-Id";

    private final RouteConfiguration route;
    private final BlockingQueue<HttpRequestContainer> queue;
    private final int globalMaxRequestSize;
    @Nullable private final JsonSchemaValidator schemaValidator;
    private final GatewaySecurityEvents gatewaySecurityEvents;
    @Nullable private final RequestStatusStore statusStore;

    public ApiRouteHandler(RouteConfiguration route,
            BlockingQueue<HttpRequestContainer> queue,
            int globalMaxRequestSize,
            @Nullable JsonSchemaValidator schemaValidator,
            GatewaySecurityEvents gatewaySecurityEvents) {
        this(route, queue, globalMaxRequestSize, schemaValidator, gatewaySecurityEvents, null);
    }

    public ApiRouteHandler(RouteConfiguration route,
            BlockingQueue<HttpRequestContainer> queue,
            int globalMaxRequestSize,
            @Nullable JsonSchemaValidator schemaValidator,
            GatewaySecurityEvents gatewaySecurityEvents,
            @Nullable RequestStatusStore statusStore) {
        this.route = route;
        this.queue = queue;
        this.globalMaxRequestSize = globalMaxRequestSize;
        this.schemaValidator = schemaValidator;
        this.gatewaySecurityEvents = gatewaySecurityEvents;
        this.statusStore = statusStore;
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

        if (!validateSchema(body, response, callback)) {
            return;
        }

        // Determine if this is a tracked body method
        boolean tracked = route.isTracked() && isBodyMethod(method) && statusStore != null;
        String traceId = null;
        String parentTraceId = null;

        if (tracked) {
            traceId = UUID.randomUUID().toString();
            parentTraceId = sanitized.headers().get(X_PARENT_TRACE_ID);
            if (!registerTracking(traceId, parentTraceId, response, callback)) {
                return;
            }
        }

        if (!enqueueFlowFile(sanitized, token, body, request,
                new TrackingContext(traceId, parentTraceId), response, callback)) {
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

    private boolean registerTracking(String traceId, @Nullable String parentTraceId,
            Response response, Callback callback) {
        try {
            if (route.trackingMode() == TrackingMode.ATTACHMENTS) {
                statusStore.collectingAttachments(traceId, parentTraceId, route.name(),
                        route.attachmentsMaxCount(), route.attachmentsMinCount());
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
            ProblemDetail.serviceUnavailable("Server is at capacity, please retry later")
                    .sendResponse(response, callback);
            return false;
        }
        return true;
    }

    private static void sendSuccessResponse(Response response, Callback callback, String method) {
        int statusCode = isBodyMethod(method) ? 202 : 200;
        response.setStatus(statusCode);
        response.getHeaders().put(HttpHeader.CONTENT_TYPE, "application/json");
        response.getHeaders().put(HttpHeader.CONTENT_LENGTH, ACCEPTED_RESPONSE.length);
        response.write(true, ByteBuffer.wrap(ACCEPTED_RESPONSE), callback);
    }

    private static boolean isBodyMethod(String method) {
        return "POST".equalsIgnoreCase(method)
                || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method);
    }

}
