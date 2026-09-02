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

import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonObjectBuilder;
import jakarta.json.JsonString;
import jakarta.json.JsonValue;
import lombok.NonNull;
import org.jspecify.annotations.Nullable;

import java.io.StringReader;
import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Immutable status entry for an asynchronously tracked request.
 *
 * @param traceId             the unique trace identifier (UUID)
 * @param status              the current processing status
 * @param acceptedAt          when the request was first accepted
 * @param updatedAt           when the status was last updated
 * @param parentTraceId       optional parent trace ID for chained requests
 * @param errorDetail         optional RFC 9457 {@code detail} string
 * @param errorType           optional RFC 9457 {@code type} URI reference
 * @param errorStatus         optional RFC 9457 {@code status} code, stored as its textual form
 *                            (parsed to an integer only at response-serialization time)
 * @param errorTitle          optional RFC 9457 {@code title} string
 * @param errorInstance       optional RFC 9457 {@code instance} URI reference
 * @param errorViolations     optional RFC 9457 {@code violations} array, stored as a
 *                            JSON-array-serialized String (parsed only at response-serialization time)
 * @param attachmentsMaxCount maximum attachments allowed for this request (0 = no attachments expected)
 * @param attachmentsMinCount minimum attachments required before auto-transitioning to PROCESSED (0 = no auto-transition)
 * @param routeName           the route name that created this entry (for traceability)
 * @param additionalFields    externally-written, non-reserved top-level scalar fields preserved across
 *                            round-trips in encounter order (empty when none were supplied)
 */
record RequestStatusEntry(
@NonNull String traceId,
@NonNull RequestStatus status,
@NonNull Instant acceptedAt,
@NonNull Instant updatedAt,
@Nullable String parentTraceId,
@Nullable String errorDetail,
@Nullable String errorType,
@Nullable String errorStatus,
@Nullable String errorTitle,
@Nullable String errorInstance,
@Nullable String errorViolations,
int attachmentsMaxCount,
int attachmentsMinCount,
@Nullable String routeName,
@NonNull Map<String, String> additionalFields) {

    /**
     * Compact constructor enforcing the immutability the class javadoc claims: defensively copies
     * {@code additionalFields} into an unmodifiable, insertion-ordered map so the mutable
     * {@link LinkedHashMap} built by {@link #captureAdditionalFields(JsonObject)} can neither be
     * mutated by the caller after construction nor exposed as mutable via the accessor.
     * A {@link LinkedHashMap} copy (not {@link Map#copyOf}) preserves the JSON encounter order.
     */
    RequestStatusEntry {
        additionalFields = Collections.unmodifiableMap(new LinkedHashMap<>(additionalFields));
    }

    private static final String KEY_TRACE_ID = "traceId";
    private static final String KEY_STATUS = "status";
    private static final String KEY_ACCEPTED_AT = "acceptedAt";
    private static final String KEY_UPDATED_AT = "updatedAt";
    private static final String KEY_PARENT_TRACE_ID = "parentTraceId";
    private static final String KEY_ERROR_DETAIL = "errorDetail";
    private static final String KEY_ERROR_TYPE = "errorType";
    private static final String KEY_ERROR_STATUS = "errorStatus";
    private static final String KEY_ERROR_TITLE = "errorTitle";
    private static final String KEY_ERROR_INSTANCE = "errorInstance";
    private static final String KEY_ERROR_VIOLATIONS = "errorViolations";
    private static final String KEY_ATTACHMENTS_MAX_COUNT = "attachmentsMaxCount";
    private static final String KEY_ATTACHMENTS_MIN_COUNT = "attachmentsMinCount";
    private static final String KEY_ROUTE_NAME = "routeName";

    /** Reserved top-level JSON keys owned by the typed record components. */
    private static final Set<String> RESERVED_KEYS = Set.of(
            KEY_TRACE_ID, KEY_STATUS, KEY_ACCEPTED_AT, KEY_UPDATED_AT, KEY_PARENT_TRACE_ID,
            KEY_ERROR_DETAIL, KEY_ERROR_TYPE, KEY_ERROR_STATUS, KEY_ERROR_TITLE, KEY_ERROR_INSTANCE,
            KEY_ERROR_VIOLATIONS, KEY_ATTACHMENTS_MAX_COUNT, KEY_ATTACHMENTS_MIN_COUNT, KEY_ROUTE_NAME);

    /**
     * Creates a new ACCEPTED entry with the given trace ID.
     */
    public static RequestStatusEntry accepted(String traceId, @Nullable String parentTraceId) {
        Instant now = Instant.now();
        return new RequestStatusEntry(traceId, RequestStatus.ACCEPTED, now, now, parentTraceId, null,
                null, null, null, null, null, 0, 0, null, Map.of());
    }

    /**
     * Creates a new COLLECTING_ATTACHMENTS entry for routes with attachment tracking.
     * The parent request enters this state immediately and waits for attachments to arrive.
     */
    public static RequestStatusEntry collectingAttachments(String traceId, @Nullable String parentTraceId,
            @Nullable String routeName, int attachmentsMaxCount, int attachmentsMinCount) {
        Instant now = Instant.now();
        return new RequestStatusEntry(traceId, RequestStatus.COLLECTING_ATTACHMENTS, now, now,
                parentTraceId, null, null, null, null, null, null,
                attachmentsMaxCount, attachmentsMinCount, routeName, Map.of());
    }

    /**
     * Serializes this entry to a JSON string.
     */
    public String toJson() {
        JsonObjectBuilder builder = Json.createObjectBuilder()
                .add(KEY_TRACE_ID, traceId)
                .add(KEY_STATUS, status.name())
                .add(KEY_ACCEPTED_AT, acceptedAt.toString())
                .add(KEY_UPDATED_AT, updatedAt.toString());
        if (parentTraceId != null) {
            builder.add(KEY_PARENT_TRACE_ID, parentTraceId);
        }
        if (errorDetail != null) {
            builder.add(KEY_ERROR_DETAIL, errorDetail);
        }
        if (errorType != null) {
            builder.add(KEY_ERROR_TYPE, errorType);
        }
        if (errorStatus != null) {
            builder.add(KEY_ERROR_STATUS, errorStatus);
        }
        if (errorTitle != null) {
            builder.add(KEY_ERROR_TITLE, errorTitle);
        }
        if (errorInstance != null) {
            builder.add(KEY_ERROR_INSTANCE, errorInstance);
        }
        if (errorViolations != null) {
            builder.add(KEY_ERROR_VIOLATIONS, errorViolations);
        }
        if (attachmentsMaxCount > 0) {
            builder.add(KEY_ATTACHMENTS_MAX_COUNT, attachmentsMaxCount);
        }
        if (attachmentsMinCount > 0) {
            builder.add(KEY_ATTACHMENTS_MIN_COUNT, attachmentsMinCount);
        }
        if (routeName != null) {
            builder.add(KEY_ROUTE_NAME, routeName);
        }
        for (Map.Entry<String, String> field : additionalFields.entrySet()) {
            // Defensive: never let a captured field shadow a reserved, typed key.
            if (!RESERVED_KEYS.contains(field.getKey())) {
                builder.add(field.getKey(), field.getValue());
            }
        }
        return builder.build().toString();
    }

    /**
     * Deserializes a JSON string to a {@link RequestStatusEntry}.
     *
     * @param json the JSON string
     * @return the deserialized entry
     * @throws jakarta.json.JsonException if the JSON is malformed
     */
    public static RequestStatusEntry fromJson(String json) {
        JsonObject obj;
        try (var reader = Json.createReader(new StringReader(json))) {
            obj = reader.readObject();
        }
        return new RequestStatusEntry(
                obj.getString(KEY_TRACE_ID),
                RequestStatus.valueOf(obj.getString(KEY_STATUS)),
                Instant.parse(obj.getString(KEY_ACCEPTED_AT)),
                Instant.parse(obj.getString(KEY_UPDATED_AT)),
                optionalString(obj, KEY_PARENT_TRACE_ID),
                optionalString(obj, KEY_ERROR_DETAIL),
                optionalString(obj, KEY_ERROR_TYPE),
                optionalString(obj, KEY_ERROR_STATUS),
                optionalString(obj, KEY_ERROR_TITLE),
                optionalString(obj, KEY_ERROR_INSTANCE),
                optionalString(obj, KEY_ERROR_VIOLATIONS),
                obj.containsKey(KEY_ATTACHMENTS_MAX_COUNT) ? obj.getInt(KEY_ATTACHMENTS_MAX_COUNT) : 0,
                obj.containsKey(KEY_ATTACHMENTS_MIN_COUNT) ? obj.getInt(KEY_ATTACHMENTS_MIN_COUNT) : 0,
                optionalString(obj, KEY_ROUTE_NAME),
                captureAdditionalFields(obj));
    }

    /**
     * Reads an optional top-level String member, yielding {@code null} when the key is absent or
     * carries JSON null.
     */
    private static @Nullable String optionalString(JsonObject obj, String key) {
        return obj.containsKey(key) && !obj.isNull(key) ? obj.getString(key) : null;
    }

    /**
     * Collects every non-reserved top-level scalar field into an insertion-ordered map, preserving
     * the JSON encounter order. String values are taken verbatim, numbers via their JSON literal, and
     * booleans as {@code "true"}/{@code "false"}. Nested objects, arrays and JSON null are dropped.
     */
    private static Map<String, String> captureAdditionalFields(JsonObject obj) {
        Map<String, String> captured = new LinkedHashMap<>();
        for (Map.Entry<String, JsonValue> entry : obj.entrySet()) {
            String key = entry.getKey();
            if (RESERVED_KEYS.contains(key)) {
                continue;
            }
            JsonValue value = entry.getValue();
            switch (value.getValueType()) {
                case STRING -> captured.put(key, ((JsonString) value).getString());
                case NUMBER -> captured.put(key, value.toString());
                case TRUE -> captured.put(key, "true");
                case FALSE -> captured.put(key, "false");
                default -> {
                    // OBJECT, ARRAY and NULL are not scalar string fields — drop them.
                }
            }
        }
        return captured;
    }
}
