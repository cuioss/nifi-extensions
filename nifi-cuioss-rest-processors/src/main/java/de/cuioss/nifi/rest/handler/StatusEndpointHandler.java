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
import jakarta.json.JsonObject;
import jakarta.json.JsonObjectBuilder;
import org.eclipse.jetty.http.HttpHeader;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import org.jspecify.annotations.Nullable;

import java.io.IOException;
import java.io.StringReader;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Set;

/**
 * Built-in handler for the {@code /status/{traceId}} management endpoint.
 * Returns the current processing status of an asynchronously tracked request.
 */
public final class StatusEndpointHandler extends AbstractManagementHandler {

    private static final CuiLogger LOGGER = new CuiLogger(StatusEndpointHandler.class);
    @SuppressWarnings("java:S1075") // URL path, not filesystem path
    static final String STATUS_PATH = "/status";
    private static final String JSON_CONTENT_TYPE = "application/json";
    @SuppressWarnings("java:S1075") // URL path, not filesystem path
    private static final String STATUS_PATH_PREFIX = STATUS_PATH + "/";

    private static final String FIELD_TRACE_ID = "traceId";
    private static final String FIELD_STATUS = "status";

    /** Lower bound of the RFC 9457 §3.1.2 {@code status} range. */
    private static final int MIN_HTTP_STATUS = 100;

    /** Upper bound of the RFC 9457 §3.1.2 {@code status} range. */
    private static final int MAX_HTTP_STATUS = 599;

    /** Reserved response keys emitted before the additional fields; guards against re-emission. */
    private static final Set<String> RESERVED_RESPONSE_KEYS = Set.of(
            FIELD_TRACE_ID, FIELD_STATUS, "acceptedAt", "updatedAt", "parentTraceId", "error");

    private final RequestStatusStore statusStore;
    private final int maxAdditionalFields;

    public StatusEndpointHandler(RequestStatusStore statusStore,
            boolean enabled, Set<AuthMode> authModes,
            Set<String> requiredRoles, Set<String> requiredScopes,
            int maxAdditionalFields) {
        super(enabled, authModes, requiredRoles, requiredScopes);
        this.statusStore = statusStore;
        this.maxAdditionalFields = maxAdditionalFields;
    }

    @Override
    public String name() {
        return FIELD_STATUS;
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

        // The path segment after the status prefix is the traceId
        Optional<String> extractedTraceId = RequestUtils.extractUuidPathParameter(
                path, STATUS_PATH_PREFIX, FIELD_TRACE_ID, response, callback);
        if (extractedTraceId.isEmpty()) {
            return;
        }
        String traceId = extractedTraceId.get();

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
                .add(FIELD_TRACE_ID, statusEntry.traceId())
                .add(FIELD_STATUS, statusEntry.status().name())
                .add("acceptedAt", statusEntry.acceptedAt().toString())
                .add("updatedAt", statusEntry.updatedAt().toString());

        if (statusEntry.parentTraceId() != null) {
            jsonBuilder.add("parentTraceId", statusEntry.parentTraceId());
        }

        buildErrorObject(statusEntry).ifPresent(error -> jsonBuilder.add("error", error));

        emitAdditionalFields(jsonBuilder, statusEntry);

        byte[] responseBody = jsonBuilder.build().toString().getBytes(StandardCharsets.UTF_8);
        response.setStatus(200);
        response.getHeaders().put(HttpHeader.CONTENT_TYPE, JSON_CONTENT_TYPE);
        response.getHeaders().put(HttpHeader.CONTENT_LENGTH, responseBody.length);
        response.write(true, ByteBuffer.wrap(responseBody), callback);
    }

    /**
     * Builds the RFC 9457 Problem Details {@code error} object from the entry's {@code error*}
     * components. The object is emitted whenever ANY component is populated (non-null, non-blank),
     * independent of the entry's {@link RequestStatus} — status gating is deliberately absent.
     * <p>
     * Members are added in RFC 9457 order: {@code type}, {@code status}, {@code title},
     * {@code detail}, {@code instance}, {@code violations}. {@code status} is parsed from the
     * String-encoded {@code errorStatus} component and {@code violations} is parsed from the
     * JSON-array-serialized {@code errorViolations} component; a malformed value omits only that one
     * member, propagates no exception, and is reported through the corresponding WARN LogRecord.
     * No RFC 9457 §3.1.2 {@code 100-599} range check is applied — a parseable integer outside that
     * range passes through verbatim.
     *
     * @param statusEntry the entry to read the error components from
     * @return the populated error object, or empty when no error component is populated
     */
    private static Optional<JsonObject> buildErrorObject(RequestStatusEntry statusEntry) {
        JsonObjectBuilder errorBuilder = Json.createObjectBuilder();
        boolean populated = false;

        populated |= addIfPresent(errorBuilder, "type", statusEntry.errorType());
        populated |= addStatusIfParseable(errorBuilder, statusEntry);
        populated |= addIfPresent(errorBuilder, "title", statusEntry.errorTitle());
        populated |= addIfPresent(errorBuilder, "detail", statusEntry.errorDetail());
        populated |= addIfPresent(errorBuilder, "instance", statusEntry.errorInstance());
        populated |= addViolationsIfParseable(errorBuilder, statusEntry);

        return populated ? Optional.of(errorBuilder.build()) : Optional.empty();
    }

    /** Adds a String member when the source component is neither null nor blank. */
    private static boolean addIfPresent(JsonObjectBuilder builder, String member, @Nullable String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        builder.add(member, value);
        return true;
    }

    /**
     * Adds the {@code status} member as a JSON number. A value that is not an integer, or that
     * falls outside the RFC 9457 &sect;3.1.2 range {@value #MIN_HTTP_STATUS}-{@value #MAX_HTTP_STATUS},
     * omits the member and logs {@link RestApiLogMessages.WARN#STATUS_ERROR_STATUS_MALFORMED}; the
     * surrounding error object is still emitted, because the raw value proves an error was intended.
     */
    private static boolean addStatusIfParseable(JsonObjectBuilder builder, RequestStatusEntry statusEntry) {
        String rawValue = statusEntry.errorStatus();
        if (rawValue == null || rawValue.isBlank()) {
            return false;
        }
        try {
            int status = Integer.parseInt(rawValue.trim());
            if (status < MIN_HTTP_STATUS || status > MAX_HTTP_STATUS) {
                throw new NumberFormatException("HTTP status outside " + MIN_HTTP_STATUS + "-" + MAX_HTTP_STATUS);
            }
            builder.add(FIELD_STATUS, status);
            return true;
        } catch (NumberFormatException e) {
            LOGGER.warn(RestApiLogMessages.WARN.STATUS_ERROR_STATUS_MALFORMED,
                    statusEntry.traceId(), rawValue);
            return true;
        }
    }

    /**
     * Adds the {@code violations} member as a real JSON array parsed from the JSON-array-serialized
     * component. A value that is absent, blank, or does not parse as an array omits the member and
     * logs {@link RestApiLogMessages.WARN#STATUS_ERROR_VIOLATIONS_MALFORMED}. Pointer values are
     * passed through verbatim — RFC 6901 conformance is the producer's responsibility.
     */
    private static boolean addViolationsIfParseable(JsonObjectBuilder builder, RequestStatusEntry statusEntry) {
        String rawValue = statusEntry.errorViolations();
        if (rawValue == null || rawValue.isBlank()) {
            return false;
        }
        try (var reader = Json.createReader(new StringReader(rawValue))) {
            builder.add("violations", reader.readArray());
            return true;
        } catch (JsonException | IllegalStateException e) {
            LOGGER.warn(RestApiLogMessages.WARN.STATUS_ERROR_VIOLATIONS_MALFORMED,
                    statusEntry.traceId(), rawValue);
            return true;
        }
    }

    /**
     * Re-emits the entry's captured additional fields (in encounter order) into the response body,
     * bounded to at most {@code maxAdditionalFields} entries. Any key that collides with a reserved
     * response key already emitted is defensively skipped and does not count against the bound.
     */
    private void emitAdditionalFields(JsonObjectBuilder jsonBuilder, RequestStatusEntry statusEntry) {
        statusEntry.additionalFields().entrySet().stream()
                .filter(field -> !RESERVED_RESPONSE_KEYS.contains(field.getKey()))
                .limit(maxAdditionalFields)
                .forEach(field -> jsonBuilder.add(field.getKey(), field.getValue()));
    }

}
