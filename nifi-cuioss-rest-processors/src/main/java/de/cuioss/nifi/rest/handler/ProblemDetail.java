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
 * <p>
 * Each error type has a stable URI pointing to its documentation
 * under {@code doc/rest-errors/} in the project repository.
 *
 * @param type       a URI reference identifying the problem type (links to error documentation)
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
     * Base URL for error type documentation.
     * Points to the project repository's {@code doc/rest-errors/} directory.
     */
    static final String ERROR_DOC_BASE =
            "https://github.com/cuioss/nifi-extensions/blob/main/doc/rest-errors/";

    // --- Error type URIs (stable, documentation-linked) ---

    static final String TYPE_BAD_REQUEST = ERROR_DOC_BASE + "bad-request.adoc";
    static final String TYPE_UNAUTHORIZED = ERROR_DOC_BASE + "unauthorized.adoc";
    static final String TYPE_FORBIDDEN = ERROR_DOC_BASE + "forbidden.adoc";
    static final String TYPE_NOT_FOUND = ERROR_DOC_BASE + "not-found.adoc";
    static final String TYPE_METHOD_NOT_ALLOWED = ERROR_DOC_BASE + "method-not-allowed.adoc";
    static final String TYPE_PAYLOAD_TOO_LARGE = ERROR_DOC_BASE + "payload-too-large.adoc";
    static final String TYPE_VALIDATION_ERROR = ERROR_DOC_BASE + "validation-error.adoc";
    static final String TYPE_SERVICE_UNAVAILABLE = ERROR_DOC_BASE + "service-unavailable.adoc";
    static final String TYPE_INTERNAL_ERROR = ERROR_DOC_BASE + "internal-error.adoc";

    // --- Title constants ---

    static final String TITLE_BAD_REQUEST = "Bad Request";
    static final String TITLE_UNAUTHORIZED = "Unauthorized";
    static final String TITLE_FORBIDDEN = "Forbidden";
    static final String TITLE_NOT_FOUND = "Not Found";
    static final String TITLE_METHOD_NOT_ALLOWED = "Method Not Allowed";
    static final String TITLE_PAYLOAD_TOO_LARGE = "Payload Too Large";
    static final String TITLE_VALIDATION_ERROR = "Unprocessable Content";
    static final String TITLE_SERVICE_UNAVAILABLE = "Service Unavailable";
    static final String TITLE_INTERNAL_ERROR = "Internal Server Error";

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
     *
     * @see <a href="https://github.com/cuioss/nifi-extensions/blob/main/doc/rest-errors/bad-request.adoc">Error Documentation</a>
     */
    public static ProblemDetail badRequest(String detail) {
        return ProblemDetail.builder()
                .type(TYPE_BAD_REQUEST)
                .title(TITLE_BAD_REQUEST)
                .status(400)
                .detail(detail)
                .build();
    }

    /**
     * Creates a 401 Unauthorized problem detail.
     *
     * @see <a href="https://github.com/cuioss/nifi-extensions/blob/main/doc/rest-errors/unauthorized.adoc">Error Documentation</a>
     */
    public static ProblemDetail unauthorized(String detail) {
        return ProblemDetail.builder()
                .type(TYPE_UNAUTHORIZED)
                .title(TITLE_UNAUTHORIZED)
                .status(401)
                .detail(detail)
                .build();
    }

    /**
     * Creates a 403 Forbidden problem detail.
     *
     * @see <a href="https://github.com/cuioss/nifi-extensions/blob/main/doc/rest-errors/forbidden.adoc">Error Documentation</a>
     */
    public static ProblemDetail forbidden(String detail) {
        return ProblemDetail.builder()
                .type(TYPE_FORBIDDEN)
                .title(TITLE_FORBIDDEN)
                .status(403)
                .detail(detail)
                .build();
    }

    /**
     * Creates a 404 Not Found problem detail.
     *
     * @see <a href="https://github.com/cuioss/nifi-extensions/blob/main/doc/rest-errors/not-found.adoc">Error Documentation</a>
     */
    public static ProblemDetail notFound(String detail) {
        return ProblemDetail.builder()
                .type(TYPE_NOT_FOUND)
                .title(TITLE_NOT_FOUND)
                .status(404)
                .detail(detail)
                .build();
    }

    /**
     * Creates a 405 Method Not Allowed problem detail.
     *
     * @see <a href="https://github.com/cuioss/nifi-extensions/blob/main/doc/rest-errors/method-not-allowed.adoc">Error Documentation</a>
     */
    public static ProblemDetail methodNotAllowed(String detail) {
        return ProblemDetail.builder()
                .type(TYPE_METHOD_NOT_ALLOWED)
                .title(TITLE_METHOD_NOT_ALLOWED)
                .status(405)
                .detail(detail)
                .build();
    }

    /**
     * Creates a 413 Payload Too Large problem detail.
     *
     * @see <a href="https://github.com/cuioss/nifi-extensions/blob/main/doc/rest-errors/payload-too-large.adoc">Error Documentation</a>
     */
    public static ProblemDetail payloadTooLarge(String detail) {
        return ProblemDetail.builder()
                .type(TYPE_PAYLOAD_TOO_LARGE)
                .title(TITLE_PAYLOAD_TOO_LARGE)
                .status(413)
                .detail(detail)
                .build();
    }

    /**
     * Creates a 422 Unprocessable Content problem detail for validation errors.
     *
     * @see <a href="https://github.com/cuioss/nifi-extensions/blob/main/doc/rest-errors/validation-error.adoc">Error Documentation</a>
     */
    public static ProblemDetail validationError(String detail) {
        return ProblemDetail.builder()
                .type(TYPE_VALIDATION_ERROR)
                .title(TITLE_VALIDATION_ERROR)
                .status(422)
                .detail(detail)
                .build();
    }

    /**
     * Creates a 503 Service Unavailable problem detail.
     *
     * @see <a href="https://github.com/cuioss/nifi-extensions/blob/main/doc/rest-errors/service-unavailable.adoc">Error Documentation</a>
     */
    public static ProblemDetail serviceUnavailable(String detail) {
        return ProblemDetail.builder()
                .type(TYPE_SERVICE_UNAVAILABLE)
                .title(TITLE_SERVICE_UNAVAILABLE)
                .status(503)
                .detail(detail)
                .build();
    }

    /**
     * Creates a 500 Internal Server Error problem detail.
     *
     * @see <a href="https://github.com/cuioss/nifi-extensions/blob/main/doc/rest-errors/internal-error.adoc">Error Documentation</a>
     */
    public static ProblemDetail internalError() {
        return ProblemDetail.builder()
                .type(TYPE_INTERNAL_ERROR)
                .title(TITLE_INTERNAL_ERROR)
                .status(500)
                .detail("An unexpected error occurred")
                .build();
    }
}
