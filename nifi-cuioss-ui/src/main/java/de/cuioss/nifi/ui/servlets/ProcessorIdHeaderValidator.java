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
package de.cuioss.nifi.ui.servlets;

import de.cuioss.http.security.config.SecurityConfiguration;
import de.cuioss.http.security.core.HttpSecurityValidator;
import de.cuioss.http.security.exceptions.UrlSecurityException;
import de.cuioss.http.security.monitoring.SecurityEventCounter;
import de.cuioss.http.security.pipeline.PipelineFactory;
import de.cuioss.nifi.ui.UILogMessages;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.Json;
import jakarta.json.JsonWriterFactory;
import jakarta.servlet.http.HttpServletResponse;
import org.jspecify.annotations.Nullable;

import java.io.IOException;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Shared validation for the externally-sourced {@code X-Processor-Id} header used by the
 * component-facing servlets. Runs the cui-http header-value security pipeline and then a
 * positive identifier allow-list.
 *
 * <p>Since cui-http 2.1.0 the header-value pipeline no longer resolves RFC 3986
 * dot-segments for header values (dot-segment resolution is path-only), so a
 * traversal-style value such as {@code ../../../etc/passwd} is a legitimate header value
 * and passes the pipeline. The allow-list rejects such a value before it is used as a
 * component lookup key.</p>
 */
final class ProcessorIdHeaderValidator {

    private static final CuiLogger LOGGER = new CuiLogger(ProcessorIdHeaderValidator.class);
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());
    /** Processor IDs are NiFi component identifiers: letters, digits, hyphens, underscores. */
    private static final Pattern PROCESSOR_ID_PATTERN = Pattern.compile("^[A-Za-z0-9_-]+$");

    private final HttpSecurityValidator headerValueValidator;

    ProcessorIdHeaderValidator() {
        headerValueValidator = PipelineFactory.createHeaderValuePipeline(
                SecurityConfiguration.strict(), new SecurityEventCounter());
    }

    /**
     * Whether the value is a syntactically valid processor identifier (the positive
     * allow-list, independent of the response-writing pipeline).
     *
     * @param value the candidate processor ID
     * @return {@code true} when the value matches the identifier allow-list
     */
    static boolean isValidIdentifier(@Nullable String value) {
        return value != null && PROCESSOR_ID_PATTERN.matcher(value).matches();
    }

    /**
     * Whether the value passes both the cui-http header-value security pipeline and the
     * identifier allow-list, without writing any response. Callers that shape their own
     * error response (for example {@link JwtVerificationServlet}) use this rather than
     * {@link #validate}, so the single validation rule stays shared while each caller keeps
     * its own response contract.
     *
     * @param value the header value to check
     * @return {@code true} when the value is safe under the shared rule
     */
    boolean isSafe(String value) {
        try {
            headerValueValidator.validate(value);
        } catch (UrlSecurityException e) {
            return false;
        }
        return isValidIdentifier(value);
    }

    /**
     * Validates the {@code X-Processor-Id} header value, writing a 400 JSON error
     * response on violation.
     *
     * @param value the header value to validate
     * @param resp  the response to write a 400 error to on violation
     * @return {@code true} when the value is safe, {@code false} when rejected (a 400
     * JSON response has already been written to {@code resp})
     */
    boolean validate(String value, HttpServletResponse resp) {
        String error = null;
        try {
            headerValueValidator.validate(value);
        } catch (UrlSecurityException e) {
            error = "Invalid header value: " + e.getFailureType().getDescription();
        }
        if (error == null && !isValidIdentifier(value)) {
            error = "Invalid header value: processor ID contains illegal characters";
        }
        if (error == null) {
            return true;
        }
        LOGGER.warn(UILogMessages.WARN.HEADER_SECURITY_VIOLATION, value, error);
        sendBadRequest(resp, error);
        return false;
    }

    /**
     * Writes a uniform 400 JSON error response ({@code {"error": message}}). Shared with
     * {@link ProcessorIdValidationFilter} so the filter and the servlets emit the identical
     * invalid-processor-ID contract.
     *
     * @param resp    the response to write to
     * @param message the error message
     */
    static void sendBadRequest(HttpServletResponse resp, String message) {
        try {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.setContentType("application/json");
            resp.setCharacterEncoding("UTF-8");
            var errorJson = Json.createObjectBuilder().add("error", message).build();
            try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
                writer.writeObject(errorJson);
            }
        } catch (IOException e) {
            LOGGER.warn(UILogMessages.WARN.FAILED_SEND_ERROR_RESPONSE,
                    HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
        }
    }
}
