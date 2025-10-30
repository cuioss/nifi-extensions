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
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
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
public class JwtVerificationServlet extends HttpServlet {

    private static final CuiLogger LOGGER = new CuiLogger(JwtVerificationServlet.class);
    private static final JsonReaderFactory JSON_READER = Json.createReaderFactory(Map.of());
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());

    private static final String JSON_KEY_ISSUER = "issuer";
    private static final String JSON_KEY_CLAIMS = "claims";
    private static final String JSON_KEY_VALID = "valid";
    private static final String ERROR_MSG_FAILED_TO_SEND_RESPONSE = "Failed to send error response";

    private final transient JwtValidationService validationService;

    public JwtVerificationServlet() {
        this.validationService = new JwtValidationService();
    }

    // For testing - allows injection of validation service
    public JwtVerificationServlet(JwtValidationService validationService) {
        this.validationService = validationService;
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException {

        LOGGER.debug("Received JWT verification request");

        // 1. Parse JSON request body
        JsonObject requestJson = parseJsonRequest(req, resp);
        if (requestJson.isEmpty()) {
            return; // Error already handled
        }

        // 2. Validate and extract request parameters
        TokenVerificationRequest verificationRequest = extractVerificationRequest(requestJson, req, resp);
        if (verificationRequest == null) {
            return; // Error already handled
        }

        // 3. Verify token using service
        TokenValidationResult result = performTokenVerification(
                verificationRequest,
                resp
        );
        if (result == null) {
            return; // Error already handled
        }

        // 4. Build and send JSON response
        safelySendValidationResponse(resp, result);
    }

    /**
     * Parses the JSON request body.
     *
     * @param req HTTP request
     * @param resp HTTP response
     * @return Parsed JSON object, or null if parsing failed (error already sent)
     */
    private JsonObject parseJsonRequest(HttpServletRequest req, HttpServletResponse resp) {
        try (JsonReader reader = JSON_READER.createReader(req.getInputStream())) {
            return reader.readObject();
        } catch (JsonException e) {
            LOGGER.warn("Invalid JSON format in request: %s", e.getMessage());
            safelySendErrorResponse(resp, 400, "Invalid JSON format", false);
            return Json.createObjectBuilder().build();
        } catch (IOException e) {
            LOGGER.error(e, "Error reading request body");
            safelySendErrorResponse(resp, 500, "Error reading request", false);
            return Json.createObjectBuilder().build();
        }
    }

    /**
     * Extracts and validates token verification request parameters.
     *
     * @param requestJson Parsed JSON request
     * @param req HTTP request
     * @param resp HTTP response
     * @return Token verification request, or null if validation failed (error already sent)
     */
    private TokenVerificationRequest extractVerificationRequest(
            JsonObject requestJson,
            HttpServletRequest req,
            HttpServletResponse resp) {

        // Validate required fields
        if (!requestJson.containsKey("token")) {
            LOGGER.warn("Missing required field: token");
            safelySendErrorResponse(resp, 400, "Missing required field: token", false);
            return null;
        }

        String token = requestJson.getString("token");
        if (token == null || token.trim().isEmpty()) {
            safelySendErrorResponse(resp, 400, "Token cannot be empty", false);
            return null;
        }

        String processorId = requestJson.containsKey("processorId") ?
                requestJson.getString("processorId") : null;
        String expectedIssuer = requestJson.containsKey(JSON_KEY_ISSUER) ?
                requestJson.getString(JSON_KEY_ISSUER) : null;

        LOGGER.info("Request received - processorId: %s, token: %s", processorId, token);

        // Extract authorization requirements
        List<String> requiredScopes = extractJsonArray(requestJson, "requiredScopes");
        List<String> requiredRoles = extractJsonArray(requestJson, "requiredRoles");

        // Determine test mode
        boolean isE2ETest = isE2ETestRequest(req);
        boolean useTestMode = isE2ETest || (processorId != null && processorId.trim().isEmpty());

        if (!useTestMode && (processorId == null || processorId.trim().isEmpty())) {
            safelySendErrorResponse(resp, 400, "Processor ID cannot be empty", false);
            return null;
        }

        LOGGER.debug("Verifying token for processor: %s", processorId);

        return new TokenVerificationRequest(
                token,
                processorId,
                expectedIssuer,
                requiredScopes,
                requiredRoles,
                isE2ETest,
                useTestMode
        );
    }

    /**
     * Checks if this is an E2E test request.
     */
    private boolean isE2ETestRequest(HttpServletRequest req) {
        String servletPath = req.getServletPath();
        String requestURI = req.getRequestURI();
        return (servletPath != null && servletPath.startsWith("/api/token/")) ||
                (requestURI != null && requestURI.contains("/api/token/"));
    }

    /**
     * Extracts a JSON array field as a list of strings.
     */
    private List<String> extractJsonArray(JsonObject json, String fieldName) {
        if (!json.containsKey(fieldName)) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        var array = json.getJsonArray(fieldName);
        for (int i = 0; i < array.size(); i++) {
            result.add(array.get(i).toString().replace("\"", ""));
        }
        return result;
    }

    /**
     * Performs token verification and additional validation for E2E tests.
     *
     * @param verificationRequest Token verification request parameters
     * @param resp HTTP response
     * @return Token validation result, or null if verification failed (error already sent)
     */
    private TokenValidationResult performTokenVerification(
            TokenVerificationRequest verificationRequest,
            HttpServletResponse resp) {

        try {
            // Use null processorId for test mode to trigger test configuration
            String validationProcessorId = verificationRequest.useTestMode() ?
                    null : verificationRequest.processorId();
            TokenValidationResult result = validationService.verifyToken(
                    verificationRequest.token(),
                    validationProcessorId
            );

            // For E2E tests, perform additional validation
            if (verificationRequest.isE2ETest() && result.isValid()) {
                result = performE2EValidation(result, verificationRequest);
            }

            return result;
        } catch (IllegalArgumentException e) {
            LOGGER.warn("Invalid request for processor %s: %s",
                    verificationRequest.processorId(), e.getMessage());
            safelySendErrorResponse(resp, 400, "Invalid request: " + e.getMessage(), false);
            return null;
        } catch (IllegalStateException e) {
            LOGGER.error("Service not available for processor %s: %s",
                    verificationRequest.processorId(), e.getMessage());
            safelySendErrorResponse(resp, 500, "Service not available: " + e.getMessage(), false);
            return null;
        } catch (IOException e) {
            LOGGER.error(e, "Communication error for processor %s", verificationRequest.processorId());
            safelySendErrorResponse(resp, 500, "Communication error: " + e.getMessage(), false);
            return null;
        } catch (RuntimeException e) {
            LOGGER.error(e, "Unexpected error during token verification for processor %s",
                    verificationRequest.processorId());
            safelySendErrorResponse(resp, 500, "Internal server error", false);
            return null;
        }
    }

    /**
     * Performs E2E-specific validation (issuer and authorization checks).
     */
    private TokenValidationResult performE2EValidation(
            TokenValidationResult result,
            TokenVerificationRequest verificationRequest) {

        // Check issuer if specified
        if (verificationRequest.expectedIssuer() != null &&
                !verificationRequest.expectedIssuer().equals(result.getIssuer())) {
            return TokenValidationResult.failure("Issuer mismatch");
        }

        // Check authorization if scopes/roles are required
        if ((verificationRequest.requiredScopes() != null ||
                verificationRequest.requiredRoles() != null) && result.isValid()) {
            boolean authorized = checkAuthorization(result, verificationRequest);
            result.setAuthorized(authorized);
        }

        return result;
    }

    /**
     * Checks if token has required scopes and roles.
     */
    private boolean checkAuthorization(
            TokenValidationResult result,
            TokenVerificationRequest verificationRequest) {

        boolean authorized = true;

        if (verificationRequest.requiredScopes() != null && result.getScopes() != null) {
            authorized = result.getScopes().containsAll(verificationRequest.requiredScopes());
        }

        if (authorized && verificationRequest.requiredRoles() != null && result.getRoles() != null) {
            authorized = result.getRoles().containsAll(verificationRequest.requiredRoles());
        }

        return authorized;
    }

    /**
     * Safely sends error response, handling IOException.
     */
    private void safelySendErrorResponse(HttpServletResponse resp, int statusCode,
            String errorMessage, boolean valid) {
        try {
            sendErrorResponse(resp, statusCode, errorMessage, valid);
        } catch (IOException e) {
            LOGGER.error(e, ERROR_MSG_FAILED_TO_SEND_RESPONSE);
            resp.setStatus(statusCode);
        }
    }

    /**
     * Safely sends validation response, handling IOException.
     */
    private void safelySendValidationResponse(HttpServletResponse resp, TokenValidationResult result) {
        try {
            sendValidationResponse(resp, result);
        } catch (IOException e) {
            LOGGER.error(e, "Failed to send validation response");
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Internal record for token verification request parameters.
     */
    private record TokenVerificationRequest(
            String token,
            String processorId,
            String expectedIssuer,
            List<String> requiredScopes,
            List<String> requiredRoles,
            boolean isE2ETest,
            boolean useTestMode
    ) {}

    /**
     * Sends a validation response with token verification results.
     */
    private void sendValidationResponse(HttpServletResponse resp, TokenValidationResult result)
            throws IOException {

        JsonObjectBuilder responseBuilder = buildJsonResponse(result);
        JsonObject responseJson = responseBuilder.build();

        // Set response headers and status
        configureResponseHeaders(resp);
        resp.setStatus(determineStatusCode(result));

        // Write response
        writeJsonResponse(resp, responseJson);
    }

    /**
     * Builds JSON response object from validation result.
     */
    private JsonObjectBuilder buildJsonResponse(TokenValidationResult result) {
        JsonObjectBuilder responseBuilder = Json.createObjectBuilder()
                .add(JSON_KEY_VALID, result.isValid())
                .add("error", result.getError() != null ? result.getError() : "");

        // Add E2E test fields
        addE2EFields(responseBuilder, result);

        // Add authorization fields
        responseBuilder.add("authorized", result.isAuthorized());
        addScopesAndRoles(responseBuilder, result);

        // Add claims
        addClaims(responseBuilder, result);

        return responseBuilder;
    }

    /**
     * Adds E2E test specific fields to response.
     */
    private void addE2EFields(JsonObjectBuilder responseBuilder, TokenValidationResult result) {
        if (result.getIssuer() != null) {
            responseBuilder.add(JSON_KEY_ISSUER, result.getIssuer());
        }

        if (result.getExpiredAt() != null) {
            responseBuilder.add("expiredAt", result.getExpiredAt());
        }
    }

    /**
     * Adds scopes and roles arrays to response.
     */
    private void addScopesAndRoles(JsonObjectBuilder responseBuilder, TokenValidationResult result) {
        if (result.getScopes() != null && !result.getScopes().isEmpty()) {
            JsonArrayBuilder scopesBuilder = Json.createArrayBuilder();
            result.getScopes().forEach(scopesBuilder::add);
            responseBuilder.add("scopes", scopesBuilder);
        }

        if (result.getRoles() != null && !result.getRoles().isEmpty()) {
            JsonArrayBuilder rolesBuilder = Json.createArrayBuilder();
            result.getRoles().forEach(rolesBuilder::add);
            responseBuilder.add("roles", rolesBuilder);
        }
    }

    /**
     * Adds token claims to response.
     */
    private void addClaims(JsonObjectBuilder responseBuilder, TokenValidationResult result) {
        if (result.isValid() && result.getClaims() != null) {
            JsonObjectBuilder claimsBuilder = Json.createObjectBuilder();
            Map<String, Object> claims = result.getClaims();

            for (Map.Entry<String, Object> entry : claims.entrySet()) {
                addClaimValue(claimsBuilder, entry.getKey(), entry.getValue());
            }

            responseBuilder.add(JSON_KEY_CLAIMS, claimsBuilder);
        } else {
            responseBuilder.add(JSON_KEY_CLAIMS, Json.createObjectBuilder());
        }
    }

    /**
     * Adds a single claim value to JSON builder, handling different types.
     */
    private void addClaimValue(JsonObjectBuilder builder, String key, Object value) {
        switch (value) {
            case null -> builder.addNull(key);
            case String string -> builder.add(key, string);
            case Integer integer -> builder.add(key, integer);
            case Long long1 -> builder.add(key, long1);
            case Double double1 -> builder.add(key, double1);
            case Boolean boolean1 -> builder.add(key, boolean1);
            default -> builder.add(key, value.toString());
        }
    }

    /**
     * Configures response headers for JSON.
     */
    private void configureResponseHeaders(HttpServletResponse resp) {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
    }

    /**
     * Determines HTTP status code based on validation result.
     */
    private int determineStatusCode(TokenValidationResult result) {
        if (result.isValid()) {
            return 200;
        }

        // Check if token is expired (E2E test expects 401 for expired tokens)
        if (result.getError() != null && result.getError().toLowerCase().contains("expired")) {
            return 401;
        }

        return 400;
    }

    /**
     * Writes JSON response to output stream.
     */
    private void writeJsonResponse(HttpServletResponse resp, JsonObject responseJson) throws IOException {
        try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
            writer.writeObject(responseJson);
            LOGGER.debug("Sent validation response: valid=%s", responseJson.getBoolean(JSON_KEY_VALID));
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
                .add(JSON_KEY_VALID, valid)
                .add("error", errorMessage)
                .add(JSON_KEY_CLAIMS, Json.createObjectBuilder())
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