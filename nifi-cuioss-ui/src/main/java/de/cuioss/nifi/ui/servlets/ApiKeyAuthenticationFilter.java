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
import java.util.UUID;

/**
 * Authentication filter for JWT API endpoints using API key-based security.
 * This filter ensures that only authorized requests can access the JWT validation
 * endpoints by validating a session-based API key.
 * 
 * The filter intercepts requests to /nifi-api/processors/jwt/* and validates:
 * 1. X-API-Key header is present
 * 2. X-Processor-Id header is present  
 * 3. API key matches the generated session key
 * 
 * A unique UUID is generated once at initialization for minimal security.
 * This is a session-based approach since users are already authenticated to NiFi.
 */
@WebFilter("/nifi-api/processors/jwt/*")
public class ApiKeyAuthenticationFilter implements Filter {

    private static final CuiLogger LOGGER = new CuiLogger(ApiKeyAuthenticationFilter.class);

    // Session API key - generated once at initialization
    private static volatile String sessionApiKey = null;

    // Headers
    private static final String API_KEY_HEADER = "X-API-Key";
    private static final String PROCESSOR_ID_HEADER = "X-Processor-Id";

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        // Generate a unique session API key on initialization
        sessionApiKey = UUID.randomUUID().toString();
        LOGGER.info("Initialized API Key Authentication Filter with session key: %s", sessionApiKey);
    }
    
    /**
     * Gets the current session API key. This is used by the UI to authenticate.
     * 
     * @return The session API key
     */
    public static String getSessionApiKey() {
        if (sessionApiKey == null) {
            // Generate one if not initialized (for testing scenarios)
            sessionApiKey = UUID.randomUUID().toString();
        }
        return sessionApiKey;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String requestPath = httpRequest.getServletPath();
        String method = httpRequest.getMethod();

        LOGGER.debug("Processing request: %s %s", method, requestPath);

        // Check if this is an endpoint that doesn't require authentication
        if (requestPath != null && (requestPath.startsWith("/api/token/") || 
                                   requestPath.endsWith("/session-key"))) {
            LOGGER.debug("Skipping authentication for endpoint: %s", requestPath);
            chain.doFilter(request, response);
            return;
        }

        // Extract API key and processor ID from headers
        String apiKey = httpRequest.getHeader(API_KEY_HEADER);
        String processorId = httpRequest.getHeader(PROCESSOR_ID_HEADER);

        // Validate headers are present
        if (apiKey == null || apiKey.trim().isEmpty()) {
            LOGGER.warn("Missing API key header in request to %s", requestPath);
            sendUnauthorizedResponse(httpResponse, "Missing or empty API key header");
            return;
        }

        if (processorId == null || processorId.trim().isEmpty()) {
            LOGGER.warn("Missing processor ID header in request to %s", requestPath);
            sendUnauthorizedResponse(httpResponse, "Missing or empty processor ID header");
            return;
        }

        // Validate API key against session key
        if (!sessionApiKey.equals(apiKey)) {
            LOGGER.warn("Invalid API key in request to %s", requestPath);
            sendUnauthorizedResponse(httpResponse, "Invalid API key");
            return;
        }

        LOGGER.debug("API key validation successful for processor %s", processorId);

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