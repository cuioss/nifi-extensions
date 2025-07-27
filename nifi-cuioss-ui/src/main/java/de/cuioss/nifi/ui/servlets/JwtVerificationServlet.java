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

import de.cuioss.nifi.ui.service.JwtValidationService;
import de.cuioss.nifi.ui.service.JwtValidationService.TokenValidationResult;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.*;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

/**
 * Servlet for JWT token verification using the cui-jwt-validation library.
 * This servlet provides a REST endpoint that verifies JWT tokens using the 
 * same configuration and logic as the MultiIssuerJWTTokenAuthenticator processor.
 * 
 * Endpoint: /nifi-api/processors/jwt/verify-token
 * Method: POST
 * 
 * Request format:
 * {
 *   "token": "eyJ...",
 *   "processorId": "uuid-of-processor"
 * }
 * 
 * Response format:
 * {
 *   "valid": true/false,
 *   "error": "error message if invalid",
 *   "claims": { ... token claims ... }
 * }
 */
@WebServlet("/nifi-api/processors/jwt/verify-token")
public class JwtVerificationServlet extends HttpServlet {

    private static final CuiLogger LOGGER = new CuiLogger(JwtVerificationServlet.class);
    private static final JsonReaderFactory JSON_READER = Json.createReaderFactory(Map.of());
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());

    private final JwtValidationService validationService;

    public JwtVerificationServlet() {
        this.validationService = new JwtValidationService();
    }

    // For testing - allows injection of validation service
    public JwtVerificationServlet(JwtValidationService validationService) {
        this.validationService = validationService;
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        LOGGER.debug("Received JWT verification request");

        // 1. Parse JSON request body using Jakarta JSON API
        JsonObject requestJson;
        try (JsonReader reader = JSON_READER.createReader(req.getInputStream())) {
            requestJson = reader.readObject();
        } catch (JsonException e) {
            LOGGER.warn("Invalid JSON format in request: %s", e.getMessage());
            sendErrorResponse(resp, 400, "Invalid JSON format", false);
            return;
        } catch (Exception e) {
            LOGGER.error(e, "Error reading request body");
            sendErrorResponse(resp, 500, "Error reading request", false);
            return;
        }

        // 2. Validate required fields
        if (!requestJson.containsKey("token") || !requestJson.containsKey("processorId")) {
            LOGGER.warn("Missing required fields in request");
            sendErrorResponse(resp, 400, "Missing required fields: token and processorId", false);
            return;
        }

        String token = requestJson.getString("token");
        String processorId = requestJson.getString("processorId");

        if (token == null || token.trim().isEmpty()) {
            sendErrorResponse(resp, 400, "Token cannot be empty", false);
            return;
        }

        if (processorId == null || processorId.trim().isEmpty()) {
            sendErrorResponse(resp, 400, "Processor ID cannot be empty", false);
            return;
        }

        LOGGER.debug("Verifying token for processor: %s", processorId);

        // 3. Verify token using service
        TokenValidationResult result;
        try {
            result = validationService.verifyToken(token, processorId);
        } catch (IllegalArgumentException e) {
            LOGGER.warn("Invalid request for processor %s: %s", processorId, e.getMessage());
            sendErrorResponse(resp, 400, "Invalid request: " + e.getMessage(), false);
            return;
        } catch (IllegalStateException e) {
            LOGGER.error("Service not available for processor %s: %s", processorId, e.getMessage());
            sendErrorResponse(resp, 500, "Service not available: " + e.getMessage(), false);
            return;
        } catch (IOException e) {
            LOGGER.error(e, "Communication error for processor %s", processorId);
            sendErrorResponse(resp, 500, "Communication error: " + e.getMessage(), false);
            return;
        } catch (Exception e) {
            LOGGER.error(e, "Unexpected error during token verification for processor %s", processorId);
            sendErrorResponse(resp, 500, "Internal server error", false);
            return;
        }

        // 4. Build and send JSON response
        sendValidationResponse(resp, result);
    }

    /**
     * Sends a validation response with token verification results.
     */
    private void sendValidationResponse(HttpServletResponse resp, TokenValidationResult result)
            throws IOException {

        JsonObjectBuilder responseBuilder = Json.createObjectBuilder()
                .add("valid", result.isValid())
                .add("error", result.getError() != null ? result.getError() : "");

        // Add claims if token is valid
        if (result.isValid() && result.getClaims() != null) {
            JsonObjectBuilder claimsBuilder = Json.createObjectBuilder();
            Map<String, Object> claims = result.getClaims();

            for (Map.Entry<String, Object> entry : claims.entrySet()) {
                String key = entry.getKey();
                Object value = entry.getValue();

                // Convert different types to JSON-compatible values
                if (value == null) {
                    claimsBuilder.addNull(key);
                } else if (value instanceof String string) {
                    claimsBuilder.add(key, string);
                } else if (value instanceof Number) {
                    if (value instanceof Integer integer) {
                        claimsBuilder.add(key, integer);
                    } else if (value instanceof Long long1) {
                        claimsBuilder.add(key, long1);
                    } else if (value instanceof Double double1) {
                        claimsBuilder.add(key, double1);
                    } else {
                        claimsBuilder.add(key, value.toString());
                    }
                } else if (value instanceof Boolean boolean1) {
                    claimsBuilder.add(key, boolean1);
                } else {
                    // For other types, convert to string
                    claimsBuilder.add(key, value.toString());
                }
            }

            responseBuilder.add("claims", claimsBuilder);
        } else {
            responseBuilder.add("claims", Json.createObjectBuilder());
        }

        JsonObject responseJson = responseBuilder.build();

        // Set response headers and status
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        resp.setStatus(result.isValid() ? 200 : 400);

        // Write response
        try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
            writer.writeObject(responseJson);
            LOGGER.debug("Sent validation response: valid=%s", result.isValid());
        } catch (IOException e) {
            LOGGER.error(e, "Failed to write validation response");
            throw new IOException("Failed to write response", e);
        }
    }

    /**
     * Sends an error response in JSON format.
     */
    private void sendErrorResponse(HttpServletResponse resp, int statusCode, String errorMessage, boolean valid)
            throws IOException {

        JsonObject errorResponse = Json.createObjectBuilder()
                .add("valid", valid)
                .add("error", errorMessage)
                .add("claims", Json.createObjectBuilder())
                .build();

        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        resp.setStatus(statusCode);

        try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
            writer.writeObject(errorResponse);
        } catch (IOException e) {
            LOGGER.error(e, "Failed to write error response");
            // Don't throw here to avoid masking the original error
        }
    }
}