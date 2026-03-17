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
import lombok.NonNull;
import org.jspecify.annotations.Nullable;

import java.io.StringReader;
import java.time.Instant;

/**
 * Immutable status entry for an asynchronously tracked request.
 *
 * @param traceId             the unique trace identifier (UUID)
 * @param status              the current processing status
 * @param acceptedAt          when the request was first accepted
 * @param updatedAt           when the status was last updated
 * @param parentTraceId       optional parent trace ID for chained requests
 * @param errorDetail         optional error detail for REJECTED/ERROR statuses (RFC 9457 detail string)
 * @param attachmentsMaxCount maximum attachments allowed for this request (0 = no attachments expected)
 * @param routeName           the route name that created this entry (for traceability)
 */
public record RequestStatusEntry(
@NonNull String traceId,
@NonNull RequestStatus status,
@NonNull Instant acceptedAt,
@NonNull Instant updatedAt,
@Nullable String parentTraceId,
@Nullable String errorDetail,
int attachmentsMaxCount,
@Nullable String routeName) {

    /**
     * Creates a new ACCEPTED entry with the given trace ID.
     */
    public static RequestStatusEntry accepted(String traceId, @Nullable String parentTraceId) {
        Instant now = Instant.now();
        return new RequestStatusEntry(traceId, RequestStatus.ACCEPTED, now, now, parentTraceId, null, 0, null);
    }

    /**
     * Creates a new ACCEPTED entry with attachment metadata.
     */
    public static RequestStatusEntry accepted(String traceId, @Nullable String parentTraceId,
            @Nullable String routeName, int attachmentsMaxCount) {
        Instant now = Instant.now();
        return new RequestStatusEntry(traceId, RequestStatus.ACCEPTED, now, now,
                parentTraceId, null, attachmentsMaxCount, routeName);
    }

    /**
     * Creates a new COLLECTING_ATTACHMENTS entry for routes with attachment tracking.
     * The parent request enters this state immediately and waits for attachments to arrive.
     */
    public static RequestStatusEntry collectingAttachments(String traceId, @Nullable String parentTraceId,
            @Nullable String routeName, int attachmentsMaxCount) {
        Instant now = Instant.now();
        return new RequestStatusEntry(traceId, RequestStatus.COLLECTING_ATTACHMENTS, now, now,
                parentTraceId, null, attachmentsMaxCount, routeName);
    }

    /**
     * Serializes this entry to a JSON string.
     */
    public String toJson() {
        JsonObjectBuilder builder = Json.createObjectBuilder()
                .add("traceId", traceId)
                .add("status", status.name())
                .add("acceptedAt", acceptedAt.toString())
                .add("updatedAt", updatedAt.toString());
        if (parentTraceId != null) {
            builder.add("parentTraceId", parentTraceId);
        }
        if (errorDetail != null) {
            builder.add("errorDetail", errorDetail);
        }
        if (attachmentsMaxCount > 0) {
            builder.add("attachmentsMaxCount", attachmentsMaxCount);
        }
        if (routeName != null) {
            builder.add("routeName", routeName);
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
                obj.getString("traceId"),
                RequestStatus.valueOf(obj.getString("status")),
                Instant.parse(obj.getString("acceptedAt")),
                Instant.parse(obj.getString("updatedAt")),
                obj.containsKey("parentTraceId") && !obj.isNull("parentTraceId")
                        ? obj.getString("parentTraceId") : null,
                obj.containsKey("errorDetail") && !obj.isNull("errorDetail")
                        ? obj.getString("errorDetail") : null,
                obj.containsKey("attachmentsMaxCount") ? obj.getInt("attachmentsMaxCount") : 0,
                obj.containsKey("routeName") && !obj.isNull("routeName")
                        ? obj.getString("routeName") : null);
    }
}
