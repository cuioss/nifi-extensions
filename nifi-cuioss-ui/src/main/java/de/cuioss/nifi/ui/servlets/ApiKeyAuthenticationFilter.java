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

import de.cuioss.nifi.ui.UILogMessages;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonWriterFactory;
import jakarta.servlet.*;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

/**
 * Authentication filter for JWT API endpoints.
 * This filter ensures that only requests from the custom UI can access
 * the JWT validation endpoints.
 *
 * The filter intercepts requests to /nifi-api/processors/jwt/* and validates:
 * 1. X-Processor-Id header is present (required for tracking)
 *
 * Since the custom UI runs within an authenticated NiFi session (iframe),
 * this provides a minimal security layer by ensuring requests include
 * the processor context.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/security.adoc">Security Specification</a>
 */
@WebFilter("/nifi-api/processors/jwt/*")
public class ApiKeyAuthenticationFilter implements Filter {

    private static final CuiLogger LOGGER = new CuiLogger(ApiKeyAuthenticationFilter.class);
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());

    // Headers
    private static final String PROCESSOR_ID_HEADER = "X-Processor-Id";

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        LOGGER.info(UILogMessages.INFO.FILTER_INITIALIZED);
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String requestPath = httpRequest.getServletPath();
        String method = httpRequest.getMethod();

        LOGGER.debug("Processing request: %s %s", method, requestPath);

        // Extract processor ID from headers
        String processorId = httpRequest.getHeader(PROCESSOR_ID_HEADER);

        // Validate processor ID header is present and is a valid UUID
        if (processorId == null || processorId.trim().isEmpty()) {
            LOGGER.warn(UILogMessages.WARN.MISSING_PROCESSOR_ID, requestPath);
            sendUnauthorizedResponse(httpResponse, "Missing or empty processor ID header");
            return;
        }
        try {
            UUID.fromString(processorId);
        } catch (IllegalArgumentException e) {
            LOGGER.warn(UILogMessages.WARN.INVALID_PROCESSOR_ID_FORMAT, requestPath);
            sendUnauthorizedResponse(httpResponse, "Invalid processor ID format");
            return;
        }

        // Check if user is authenticated (when available)
        String remoteUser = httpRequest.getRemoteUser();
        if (remoteUser != null) {
            LOGGER.debug("Request from authenticated user: %s for processor %s", remoteUser, processorId);
        }

        // For requests from the custom UI (which runs in an iframe within NiFi),
        // we rely on the processor ID header and the fact that the UI is already
        // loaded within an authenticated NiFi session
        LOGGER.debug("Request validation successful for processor %s", processorId);

        // Continue with the request
        chain.doFilter(request, response);
    }

    @Override
    public void destroy() {
        LOGGER.info(UILogMessages.INFO.FILTER_DESTROYED);
    }

    /**
     * Sends an unauthorized response in JSON format to match the API response format.
     */
    private void sendUnauthorizedResponse(HttpServletResponse response, String message)
            throws IOException {

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        JsonObject errorResponse = Json.createObjectBuilder()
                .add("error", message)
                .add("valid", false)
                .add("accessible", false)
                .build();

        try (var writer = JSON_WRITER.createWriter(response.getOutputStream())) {
            writer.writeObject(errorResponse);
        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.FAILED_WRITE_UNAUTHORIZED_RESPONSE);
            throw e;
        }
    }

}
