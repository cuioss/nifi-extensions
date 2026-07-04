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
import de.cuioss.sheriff.token.validation.domain.token.AccessTokenContent;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.Json;
import jakarta.json.JsonException;
import lombok.Builder;
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
public final class AttachmentsEndpointHandler implements EndpointHandler {

    private static final CuiLogger LOGGER = new CuiLogger(AttachmentsEndpointHandler.class);
    @SuppressWarnings("java:S1075") // URL path, not filesystem path
    static final String ATTACHMENTS_PATH = "/attachments";
    @SuppressWarnings("java:S1075") // URL path, not filesystem path
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

    /**
     * Configuration holder for AttachmentsEndpointHandler construction parameters.
     */
    @Builder
    public record Config(
    RequestStatusStore statusStore,
    BlockingQueue<HttpRequestContainer> queue,
    int maxRequestSize,
    boolean enabled,
    Set<AuthMode> authModes,
    Set<String> requiredRoles,
    Set<String> requiredScopes,
    GatewaySecurityEvents gatewaySecurityEvents) {
    }

    public AttachmentsEndpointHandler(Config config) {
        this.statusStore = config.statusStore();
        this.queue = config.queue();
        this.maxRequestSize = config.maxRequestSize();
        this.enabled = config.enabled();
        this.authModes = config.authModes();
        this.requiredRoles = config.requiredRoles();
        this.requiredScopes = config.requiredScopes();
        this.gatewaySecurityEvents = config.gatewaySecurityEvents();
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

        Optional<String> parentTraceId = extractAndValidateParentTraceId(sanitized.path(), response, callback);
        if (parentTraceId.isEmpty()) {
            return;
        }

        Optional<RequestStatusEntry> parent = lookupAndValidateParent(parentTraceId.get(), response, callback);
        if (parent.isEmpty()) {
            return;
        }

        Optional<Integer> attachmentCount = enforceAttachmentLimit(parentTraceId.get(), parent.get(), response, callback);
        if (attachmentCount.isEmpty()) {
            return;
        }

        String traceId = registerAttachment(parentTraceId.get(), attachmentCount.get(), parent.get(), response, callback);
        if (traceId == null) {
            return;
        }

        if (!enqueueAttachment(sanitized, token, body, request,
                new TrackingContext(traceId, parentTraceId.get()), response, callback)) {
            return;
        }

        autoTransitionToProcessedIfMinMet(parentTraceId.get(), parent.get(), attachmentCount.get());

        RequestUtils.sendAcceptedResponse(request, response, callback, traceId, false);
    }

    private Optional<String> extractAndValidateParentTraceId(String path, Response response, Callback callback) {
        return RequestUtils.extractUuidPathParameter(
                path, ATTACHMENTS_PATH_PREFIX, "parentTraceId", response, callback);
    }

    private Optional<RequestStatusEntry> lookupAndValidateParent(String parentTraceId, Response response, Callback callback) {
        Optional<RequestStatusEntry> parentEntry;
        try {
            parentEntry = statusStore.getStatus(parentTraceId);
        } catch (IOException | JsonException | IllegalArgumentException e) {
            LOGGER.warn(RestApiLogMessages.WARN.STATUS_STORE_ERROR, e.getMessage());
            ProblemDetail.serviceUnavailable("Status store temporarily unavailable")
                    .sendResponse(response, callback);
            return Optional.empty();
        }
        if (parentEntry.isEmpty()) {
            attachmentCounters.remove(parentTraceId);
            LOGGER.warn(RestApiLogMessages.WARN.PARENT_TRACE_NOT_FOUND, parentTraceId);
            ProblemDetail.notFound("No parent request found for traceId: " + parentTraceId)
                    .sendResponse(response, callback);
            return Optional.empty();
        }
        RequestStatusEntry parent = parentEntry.get();
        if (parent.attachmentsMaxCount() == 0) {
            LOGGER.warn(RestApiLogMessages.WARN.ATTACHMENTS_NOT_SUPPORTED, parentTraceId);
            ProblemDetail.conflict("Parent request does not accept attachments")
                    .sendResponse(response, callback);
            return Optional.empty();
        }
        if (!isAttachmentWindowOpen(parent)) {
            // Terminal for this parent — evict its in-memory counter so the map
            // does not grow unboundedly over the processor's lifetime
            attachmentCounters.remove(parentTraceId);
            LOGGER.warn(RestApiLogMessages.WARN.ATTACHMENT_WINDOW_CLOSED,
                    parentTraceId, parent.status());
            ProblemDetail.conflict("Attachment window closed — parent request is already being processed")
                    .sendResponse(response, callback);
            return Optional.empty();
        }
        return parentEntry;
    }

    private static boolean isAttachmentWindowOpen(RequestStatusEntry parent) {
        return parent.status() == RequestStatus.COLLECTING_ATTACHMENTS
                || parent.status() == RequestStatus.PROCESSED;
    }

    private Optional<Integer> enforceAttachmentLimit(String parentTraceId, RequestStatusEntry parent,
            Response response, Callback callback) {
        int count = attachmentCounters
                .computeIfAbsent(parentTraceId, k -> new AtomicInteger(0))
                .incrementAndGet();
        if (count > parent.attachmentsMaxCount()) {
            attachmentCounters.get(parentTraceId).decrementAndGet();
            LOGGER.warn(RestApiLogMessages.WARN.ATTACHMENT_LIMIT_REACHED,
                    parentTraceId, count - 1, parent.attachmentsMaxCount());
            ProblemDetail.conflict("Attachment limit reached: " + parent.attachmentsMaxCount())
                    .sendResponse(response, callback);
            return Optional.empty();
        }
        return Optional.of(count);
    }

    @Nullable
    private String registerAttachment(String parentTraceId, int count, RequestStatusEntry parent,
            Response response, Callback callback) {
        String traceId = UUID.randomUUID().toString();
        try {
            statusStore.accept(traceId, parentTraceId);
        } catch (IOException e) {
            attachmentCounters.get(parentTraceId).decrementAndGet();
            LOGGER.warn(RestApiLogMessages.WARN.STATUS_STORE_ERROR, e.getMessage());
            ProblemDetail.serviceUnavailable("Status store temporarily unavailable")
                    .sendResponse(response, callback);
            return null;
        }
        LOGGER.info(RestApiLogMessages.INFO.ATTACHMENT_ACCEPTED,
                traceId, parentTraceId, count, parent.attachmentsMaxCount());
        return traceId;
    }

    private boolean enqueueAttachment(SanitizedRequest sanitized, @Nullable AccessTokenContent token,
            byte[] body, Request request, TrackingContext tracking,
            Response response, Callback callback) {
        String parentTraceId = tracking.parentTraceId();
        var container = new HttpRequestContainer(
                ATTACHMENTS_ROUTE_NAME, "POST", sanitized.path(),
                sanitized.queryParameters(), sanitized.headers(),
                Request.getRemoteAddr(request),
                body,
                request.getHeaders().get(HttpHeader.CONTENT_TYPE),
                token,
                tracking.traceId(),
                parentTraceId,
                sanitized.pathParameters());

        if (!queue.offer(container)) {
            attachmentCounters.get(parentTraceId).decrementAndGet();
            gatewaySecurityEvents.increment(GatewaySecurityEvents.EventType.QUEUE_FULL);
            LOGGER.warn(RestApiLogMessages.WARN.QUEUE_FULL, "POST", sanitized.path(),
                    Request.getRemoteAddr(request));
            ProblemDetail.serviceUnavailable("Server is at capacity, please retry later")
                    .sendResponse(response, callback);
            return false;
        }
        return true;
    }

    private void autoTransitionToProcessedIfMinMet(String parentTraceId, RequestStatusEntry parent, int count) {
        boolean shouldTransition = parent.status() == RequestStatus.COLLECTING_ATTACHMENTS
                && parent.attachmentsMinCount() > 0
                && count >= parent.attachmentsMinCount();
        if (shouldTransition) {
            try {
                statusStore.updateStatus(parentTraceId, RequestStatus.PROCESSED);
                LOGGER.info(RestApiLogMessages.INFO.ATTACHMENTS_MIN_MET,
                        parentTraceId, count, parent.attachmentsMinCount());
            } catch (IOException e) {
                LOGGER.warn(RestApiLogMessages.WARN.STATUS_STORE_ERROR, e.getMessage());
            }
        }
    }

}
