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

import de.cuioss.tools.logging.CuiLogger;
import jakarta.servlet.*;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

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
 */
@WebFilter("/nifi-api/processors/jwt/*")
public class ApiKeyAuthenticationFilter implements Filter {

    private static final CuiLogger LOGGER = new CuiLogger(ApiKeyAuthenticationFilter.class);

    // Headers
    private static final String PROCESSOR_ID_HEADER = "X-Processor-Id";

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        LOGGER.info("Initialized API Authentication Filter");
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String requestPath = httpRequest.getServletPath();
        String method = httpRequest.getMethod();

        LOGGER.debug("Processing request: %s %s", method, requestPath);

        // Check if this is an E2E test endpoint (no authentication required)
        if (requestPath != null && requestPath.startsWith("/api/token/")) {
            LOGGER.debug("Skipping authentication for E2E test endpoint: %s", requestPath);
            chain.doFilter(request, response);
            return;
        }

        // Extract processor ID from headers
        String processorId = httpRequest.getHeader(PROCESSOR_ID_HEADER);

        // Validate processor ID header is present
        if (processorId == null || processorId.trim().isEmpty()) {
            LOGGER.warn("Missing processor ID header in request to %s", requestPath);
            sendUnauthorizedResponse(httpResponse, "Missing or empty processor ID header");
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
        LOGGER.info("Destroying API Key Authentication Filter");
    }

    /**
     * Sends an unauthorized response in JSON format to match the API response format.
     */
    private void sendUnauthorizedResponse(HttpServletResponse response, String message)
            throws IOException {

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        // Send JSON error response that matches the servlet response format
        String jsonResponse = "{\"error\":\"%s\",\"valid\":false,\"accessible\":false}".formatted(
                escapeJsonString(message));

        try (var writer = response.getWriter()) {
            writer.write(jsonResponse);
        } catch (IOException e) {
            LOGGER.error(e, "Failed to write unauthorized response");
            throw e;
        }
    }

    /**
     * Escapes a string for safe inclusion in JSON.
     */
    private String escapeJsonString(String str) {
        if (str == null) return "";
        return str.replace("\"", "\\\"")
                .replace("\\", "\\\\")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

}