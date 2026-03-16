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
import jakarta.json.JsonObjectBuilder;
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

/**
 * Built-in handler for the {@code /status/{traceId}} management endpoint.
 * Returns the current processing status of an asynchronously tracked request.
 */
public class StatusEndpointHandler extends AbstractManagementHandler {

    private static final CuiLogger LOGGER = new CuiLogger(StatusEndpointHandler.class);
    static final String STATUS_PATH = "/status";
    private static final String JSON_CONTENT_TYPE = "application/json";
    private static final String STATUS_PATH_PREFIX = STATUS_PATH + "/";

    private final RequestStatusStore statusStore;

    public StatusEndpointHandler(RequestStatusStore statusStore,
            boolean enabled, Set<AuthMode> authModes,
            Set<String> requiredRoles, Set<String> requiredScopes) {
        super(enabled, authModes, requiredRoles, requiredScopes);
        this.statusStore = statusStore;
    }

    @Override
    public String name() {
        return "status";
    }

    @Override
    public String path() {
        return STATUS_PATH;
    }

    @Override
    public boolean prefixMatch() {
        return true;
    }

    @Override
    public void process(SanitizedRequest sanitized,
            @Nullable AccessTokenContent token,
            byte[] body,
            Request request, Response response, Callback callback) throws IOException {
        String path = sanitized.path();

        // Extract traceId from path: /status/{traceId}
        if (!path.startsWith(STATUS_PATH_PREFIX) || path.length() <= STATUS_PATH_PREFIX.length()) {
            ProblemDetail.badRequest("Missing traceId in path. Expected: /status/{traceId}")
                    .sendResponse(response, callback);
            return;
        }

        String traceId = path.substring(STATUS_PATH_PREFIX.length());

        // Validate UUID format
        try {
            UUID.fromString(traceId);
        } catch (IllegalArgumentException e) {
            ProblemDetail.badRequest("Invalid traceId format. Expected UUID.")
                    .sendResponse(response, callback);
            return;
        }

        // Query status store
        Optional<RequestStatusEntry> entry;
        try {
            entry = statusStore.getStatus(traceId);
        } catch (IOException | JsonException | IllegalArgumentException e) {
            LOGGER.warn(RestApiLogMessages.WARN.STATUS_STORE_ERROR, e.getMessage());
            ProblemDetail.serviceUnavailable("Status store temporarily unavailable")
                    .sendResponse(response, callback);
            return;
        }

        if (entry.isEmpty()) {
            LOGGER.warn(RestApiLogMessages.WARN.STATUS_NOT_FOUND, traceId);
            ProblemDetail.notFound("No status found for traceId: " + traceId)
                    .sendResponse(response, callback);
            return;
        }

        // Build JSON response
        RequestStatusEntry statusEntry = entry.get();
        LOGGER.info(RestApiLogMessages.INFO.STATUS_QUERIED, traceId, statusEntry.status());

        JsonObjectBuilder jsonBuilder = Json.createObjectBuilder()
                .add("traceId", statusEntry.traceId())
                .add("status", statusEntry.status().name())
                .add("acceptedAt", statusEntry.acceptedAt().toString())
                .add("updatedAt", statusEntry.updatedAt().toString());

        if (statusEntry.parentTraceId() != null) {
            jsonBuilder.add("parentTraceId", statusEntry.parentTraceId());
        }

        if (statusEntry.errorDetail() != null
                && (statusEntry.status() == RequestStatus.REJECTED
                || statusEntry.status() == RequestStatus.ERROR)) {
            jsonBuilder.add("error", Json.createObjectBuilder()
                    .add("detail", statusEntry.errorDetail()));
        }

        byte[] responseBody = jsonBuilder.build().toString().getBytes(StandardCharsets.UTF_8);
        response.setStatus(200);
        response.getHeaders().put(HttpHeader.CONTENT_TYPE, JSON_CONTENT_TYPE);
        response.getHeaders().put(HttpHeader.CONTENT_LENGTH, responseBody.length);
        response.write(true, ByteBuffer.wrap(responseBody), callback);
    }

}
