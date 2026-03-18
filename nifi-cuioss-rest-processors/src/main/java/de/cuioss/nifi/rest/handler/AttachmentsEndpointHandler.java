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
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.Json;
import jakarta.json.JsonException;
import org.eclipse.jetty.http.HttpHeader;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import org.jspecify.annotations.Nullable;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Built-in handler for the {@code /attachments/{parentTraceId}} endpoint.
 * Accepts POST requests to upload attachments linked to a parent tracked request.
 * <p>
 * Attachment counting is done in-memory via {@link ConcurrentHashMap}. Counters reset
 * on processor restart (documented limitation — worst case: allows slightly more
 * attachments than configured after restart).
 */
public class AttachmentsEndpointHandler implements EndpointHandler {

    private static final CuiLogger LOGGER = new CuiLogger(AttachmentsEndpointHandler.class);
    static final String ATTACHMENTS_PATH = "/attachments";
    private static final String ATTACHMENTS_PATH_PREFIX = ATTACHMENTS_PATH + "/";
    private static final String JSON_CONTENT_TYPE = "application/json";
    public static final String ATTACHMENTS_ROUTE_NAME = "_attachments";

    private final RequestStatusStore statusStore;
    private final BlockingQueue<HttpRequestContainer> queue;
    private final int maxRequestSize;
    private final boolean enabled;
    private final Set<AuthMode> authModes;
    private final Set<String> requiredRoles;
    private final Set<String> requiredScopes;
    private final GatewaySecurityEvents gatewaySecurityEvents;

    private final ConcurrentHashMap<String, AtomicInteger> attachmentCounters = new ConcurrentHashMap<>();

    public AttachmentsEndpointHandler(RequestStatusStore statusStore,
            BlockingQueue<HttpRequestContainer> queue,
            int maxRequestSize,
            boolean enabled, Set<AuthMode> authModes,
            Set<String> requiredRoles, Set<String> requiredScopes,
            GatewaySecurityEvents gatewaySecurityEvents) {
        this.statusStore = statusStore;
        this.queue = queue;
        this.maxRequestSize = maxRequestSize;
        this.enabled = enabled;
        this.authModes = authModes;
        this.requiredRoles = requiredRoles;
        this.requiredScopes = requiredScopes;
        this.gatewaySecurityEvents = gatewaySecurityEvents;
    }

    @Override
    public String name() {
        return "attachments";
    }

    @Override
    public String path() {
        return ATTACHMENTS_PATH;
    }

    @Override
    public boolean prefixMatch() {
        return true;
    }

    @Override
    public Set<String> methods() {
        return Set.of("POST");
    }

    @Override
    public Set<AuthMode> authModes() {
        return authModes;
    }

    @Override
    public boolean enabled() {
        return enabled;
    }

    @Override
    public boolean builtIn() {
        return true;
    }

    @Override
    public Set<String> requiredRoles() {
        return requiredRoles;
    }

    @Override
    public Set<String> requiredScopes() {
        return requiredScopes;
    }

    @Override
    public int maxRequestSize() {
        return maxRequestSize;
    }

    @Override
    public void process(SanitizedRequest sanitized,
            @Nullable AccessTokenContent token,
            byte[] body,
            Request request, Response response, Callback callback) throws IOException {
        String path = sanitized.path();

        // Extract parentTraceId from path: /attachments/{parentTraceId}
        if (!path.startsWith(ATTACHMENTS_PATH_PREFIX) || path.length() <= ATTACHMENTS_PATH_PREFIX.length()) {
            ProblemDetail.badRequest("Missing parentTraceId in path. Expected: /attachments/{parentTraceId}")
                    .sendResponse(response, callback);
            return;
        }

        String parentTraceId = path.substring(ATTACHMENTS_PATH_PREFIX.length());

        // Validate UUID format
        try {
            UUID.fromString(parentTraceId);
        } catch (IllegalArgumentException e) {
            ProblemDetail.badRequest("Invalid parentTraceId format. Expected UUID.")
                    .sendResponse(response, callback);
            return;
        }

        // Look up parent entry
        Optional<RequestStatusEntry> parentEntry;
        try {
            parentEntry = statusStore.getStatus(parentTraceId);
        } catch (IOException | JsonException | IllegalArgumentException e) {
            LOGGER.warn(RestApiLogMessages.WARN.STATUS_STORE_ERROR, e.getMessage());
            ProblemDetail.serviceUnavailable("Status store temporarily unavailable")
                    .sendResponse(response, callback);
            return;
        }

        if (parentEntry.isEmpty()) {
            LOGGER.warn(RestApiLogMessages.WARN.PARENT_TRACE_NOT_FOUND, parentTraceId);
            ProblemDetail.notFound("No parent request found for traceId: " + parentTraceId)
                    .sendResponse(response, callback);
            return;
        }

        RequestStatusEntry parent = parentEntry.get();

        // Verify parent accepts attachments
        if (parent.attachmentsMaxCount() == 0) {
            LOGGER.warn(RestApiLogMessages.WARN.ATTACHMENTS_NOT_SUPPORTED, parentTraceId);
            ProblemDetail.conflict("Parent request does not accept attachments")
                    .sendResponse(response, callback);
            return;
        }

        // Verify attachment window is still open
        if (parent.status() != RequestStatus.COLLECTING_ATTACHMENTS) {
            LOGGER.warn("Attachment window closed for parentTraceId '%s' — status is %s",
                    parentTraceId, parent.status());
            ProblemDetail.conflict("Attachment window closed — parent request is already being processed")
                    .sendResponse(response, callback);
            return;
        }

        // Enforce upper bound
        int count = attachmentCounters
                .computeIfAbsent(parentTraceId, k -> new AtomicInteger(0))
                .incrementAndGet();
        if (count > parent.attachmentsMaxCount()) {
            attachmentCounters.get(parentTraceId).decrementAndGet();
            LOGGER.warn(RestApiLogMessages.WARN.ATTACHMENT_LIMIT_REACHED,
                    parentTraceId, count - 1, parent.attachmentsMaxCount());
            ProblemDetail.conflict("Attachment limit reached: " + parent.attachmentsMaxCount())
                    .sendResponse(response, callback);
            return;
        }

        // Generate trace ID for this attachment
        String traceId = UUID.randomUUID().toString();
        try {
            statusStore.accept(traceId, parentTraceId);
        } catch (IOException e) {
            attachmentCounters.get(parentTraceId).decrementAndGet();
            LOGGER.warn(RestApiLogMessages.WARN.STATUS_STORE_ERROR, e.getMessage());
            ProblemDetail.serviceUnavailable("Status store temporarily unavailable")
                    .sendResponse(response, callback);
            return;
        }

        LOGGER.info(RestApiLogMessages.INFO.ATTACHMENT_ACCEPTED,
                traceId, parentTraceId, count, parent.attachmentsMaxCount());

        // Enqueue for FlowFile creation
        var container = new HttpRequestContainer(
                ATTACHMENTS_ROUTE_NAME, "POST", sanitized.path(),
                sanitized.queryParameters(), sanitized.headers(),
                Request.getRemoteAddr(request),
                body,
                request.getHeaders().get(HttpHeader.CONTENT_TYPE),
                token,
                traceId,
                parentTraceId);

        if (!queue.offer(container)) {
            attachmentCounters.get(parentTraceId).decrementAndGet();
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.QUEUE_FULL);
            LOGGER.warn(RestApiLogMessages.WARN.QUEUE_FULL, "POST", sanitized.path(),
                    Request.getRemoteAddr(request));
            ProblemDetail.serviceUnavailable("Server is at capacity, please retry later")
                    .sendResponse(response, callback);
            return;
        }

        // Build 202 response with HATEOAS links
        String statusPath = "/status/" + traceId;
        byte[] responseBody = Json.createObjectBuilder()
                .add("status", "accepted")
                .add("traceId", traceId)
                .add("_links", Json.createObjectBuilder()
                        .add("status", Json.createObjectBuilder()
                                .add("href", statusPath)))
                .build()
                .toString()
                .getBytes(StandardCharsets.UTF_8);

        // Build Location header
        var httpUri = request.getHttpURI();
        String scheme = httpUri.getScheme();
        String host = Request.getServerName(request);
        int port = Request.getServerPort(request);
        String locationUri;
        if (("http".equals(scheme) && port == 80) || ("https".equals(scheme) && port == 443)) {
            locationUri = "%s://%s/status/%s".formatted(scheme, host, traceId);
        } else {
            locationUri = "%s://%s:%d/status/%s".formatted(scheme, host, port, traceId);
        }

        response.setStatus(202);
        response.getHeaders().put(HttpHeader.LOCATION, locationUri);
        response.getHeaders().put(HttpHeader.CONTENT_TYPE, JSON_CONTENT_TYPE);
        response.getHeaders().put(HttpHeader.CONTENT_LENGTH, responseBody.length);
        response.write(true, ByteBuffer.wrap(responseBody), callback);
    }
}
