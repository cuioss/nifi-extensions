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
import jakarta.json.JsonObjectBuilder;
import lombok.Builder;
import lombok.Singular;
import org.jspecify.annotations.Nullable;

import java.util.Map;

/**
 * RFC 9457 Problem Details response body builder.
 * <p>
 * Generates JSON responses for HTTP error conditions using the
 * Jakarta JSON Processing API ({@code jakarta.json}).
 *
 * @param type       a URI reference identifying the problem type
 * @param title      a short human-readable summary
 * @param status     the HTTP status code
 * @param detail     a human-readable explanation specific to this occurrence
 * @param extensions additional problem-specific members
 * @see <a href="https://www.rfc-editor.org/rfc/rfc9457">RFC 9457</a>
 */
@Builder
public record ProblemDetail(
        @Nullable String type,
        String title,
        int status,
        @Nullable String detail,
        @Singular Map<String, Object> extensions) {

    /** RFC 9457 content type. */
    public static final String CONTENT_TYPE = "application/problem+json";

    /**
     * Serializes this problem detail to a JSON string.
     *
     * @return the JSON representation
     */
    public String toJson() {
        JsonObjectBuilder builder = Json.createObjectBuilder();
        if (type != null) {
            builder.add("type", type);
        }
        builder.add("title", title);
        builder.add("status", status);
        if (detail != null) {
            builder.add("detail", detail);
        }
        if (extensions != null && !extensions.isEmpty()) {
            for (Map.Entry<String, Object> entry : extensions.entrySet()) {
                Object value = entry.getValue();
                switch (value) {
                    case Number n when n instanceof Integer || n instanceof Long ->
                        builder.add(entry.getKey(), n.longValue());
                    case Number n -> builder.add(entry.getKey(), n.doubleValue());
                    case Boolean b -> builder.add(entry.getKey(), b);
                    default -> builder.add(entry.getKey(), String.valueOf(value));
                }
            }
        }
        return builder.build().toString();
    }

    // --- Convenience factory methods ---

    /**
     * Creates a 400 Bad Request problem detail.
     */
    public static ProblemDetail badRequest(String detail) {
        return ProblemDetail.builder()
                .type("about:blank")
                .title("Bad Request")
                .status(400)
                .detail(detail)
                .build();
    }

    /**
     * Creates a 401 Unauthorized problem detail.
     */
    public static ProblemDetail unauthorized(String detail) {
        return ProblemDetail.builder()
                .type("about:blank")
                .title("Unauthorized")
                .status(401)
                .detail(detail)
                .build();
    }

    /**
     * Creates a 403 Forbidden problem detail.
     */
    public static ProblemDetail forbidden(String detail) {
        return ProblemDetail.builder()
                .type("about:blank")
                .title("Forbidden")
                .status(403)
                .detail(detail)
                .build();
    }

    /**
     * Creates a 404 Not Found problem detail.
     */
    public static ProblemDetail notFound(String detail) {
        return ProblemDetail.builder()
                .type("about:blank")
                .title("Not Found")
                .status(404)
                .detail(detail)
                .build();
    }

    /**
     * Creates a 405 Method Not Allowed problem detail.
     */
    public static ProblemDetail methodNotAllowed(String detail) {
        return ProblemDetail.builder()
                .type("about:blank")
                .title("Method Not Allowed")
                .status(405)
                .detail(detail)
                .build();
    }

    /**
     * Creates a 413 Payload Too Large problem detail.
     */
    public static ProblemDetail payloadTooLarge(String detail) {
        return ProblemDetail.builder()
                .type("about:blank")
                .title("Payload Too Large")
                .status(413)
                .detail(detail)
                .build();
    }

    /**
     * Creates a 422 Unprocessable Content problem detail for validation errors.
     */
    public static ProblemDetail validationError(String detail) {
        return ProblemDetail.builder()
                .type("about:blank")
                .title("Unprocessable Content")
                .status(422)
                .detail(detail)
                .build();
    }

    /**
     * Creates a 503 Service Unavailable problem detail.
     */
    public static ProblemDetail serviceUnavailable(String detail) {
        return ProblemDetail.builder()
                .type("about:blank")
                .title("Service Unavailable")
                .status(503)
                .detail(detail)
                .build();
    }

    /**
     * Creates a 500 Internal Server Error problem detail.
     */
    public static ProblemDetail internalError() {
        return ProblemDetail.builder()
                .type("about:blank")
                .title("Internal Server Error")
                .status(500)
                .detail("An unexpected error occurred")
                .build();
    }
}
