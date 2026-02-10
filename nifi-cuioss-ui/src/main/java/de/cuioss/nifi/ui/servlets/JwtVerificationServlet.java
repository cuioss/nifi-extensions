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
import de.cuioss.nifi.ui.service.JwtValidationService;
import de.cuioss.nifi.ui.service.JwtValidationService.TokenValidationResult;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.*;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

import static de.cuioss.nifi.ui.util.TokenMasking.maskToken;

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
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 */
public class JwtVerificationServlet extends HttpServlet {

    private static final CuiLogger LOGGER = new CuiLogger(JwtVerificationServlet.class);
    private static final JsonReaderFactory JSON_READER = Json.createReaderFactory(Map.of());
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());

    private static final String JSON_KEY_ISSUER = "issuer";
    private static final String JSON_KEY_CLAIMS = "claims";
    private static final String JSON_KEY_VALID = "valid";
    /** Maximum request body size: 1 MB */
    private static final int MAX_REQUEST_BODY_SIZE = 1024 * 1024;

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
        TokenVerificationRequest verificationRequest = extractVerificationRequest(requestJson, resp);
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
        if (req.getContentLength() > MAX_REQUEST_BODY_SIZE) {
            safelySendErrorResponse(resp, 413, "Request body too large", false);
            return Json.createObjectBuilder().build();
        }
        try (JsonReader reader = JSON_READER.createReader(req.getInputStream())) {
            return reader.readObject();
        } catch (JsonException e) {
            LOGGER.warn(UILogMessages.WARN.INVALID_JSON_FORMAT, e.getMessage());
            safelySendErrorResponse(resp, 400, "Invalid JSON format", false);
            return Json.createObjectBuilder().build();
        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.ERROR_READING_REQUEST_BODY);
            safelySendErrorResponse(resp, 500, "Error reading request", false);
            return Json.createObjectBuilder().build();
        }
    }

    /**
     * Extracts and validates token verification request parameters.
     *
     * @param requestJson Parsed JSON request
     * @param resp HTTP response
     * @return Token verification request, or null if validation failed (error already sent)
     */
    private TokenVerificationRequest extractVerificationRequest(
            JsonObject requestJson,
            HttpServletResponse resp) {

        // Validate required fields
        if (!requestJson.containsKey("token")) {
            LOGGER.warn(UILogMessages.WARN.MISSING_REQUIRED_FIELD_TOKEN);
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

        LOGGER.debug("Request received - processorId: %s, token: %s", processorId, maskToken(token));

        if (processorId == null || processorId.trim().isEmpty()) {
            safelySendErrorResponse(resp, 400, "Processor ID cannot be empty", false);
            return null;
        }

        LOGGER.debug("Verifying token for processor: %s", processorId);

        return new TokenVerificationRequest(token, processorId);
    }

    /**
     * Performs token verification.
     *
     * @param verificationRequest Token verification request parameters
     * @param resp HTTP response
     * @return Token validation result, or null if verification failed (error already sent)
     */
    private TokenValidationResult performTokenVerification(
            TokenVerificationRequest verificationRequest,
            HttpServletResponse resp) {

        try {
            return validationService.verifyToken(
                    verificationRequest.token(),
                    verificationRequest.processorId()
            );
        } catch (IllegalArgumentException e) {
            LOGGER.warn(UILogMessages.WARN.INVALID_REQUEST,
                    verificationRequest.processorId(), e.getMessage());
            safelySendErrorResponse(resp, 400, "Invalid request: " + e.getMessage(), false);
            return null;
        } catch (IllegalStateException e) {
            LOGGER.error(UILogMessages.ERROR.SERVICE_NOT_AVAILABLE,
                    verificationRequest.processorId(), e.getMessage());
            safelySendErrorResponse(resp, 500, "Service not available: " + e.getMessage(), false);
            return null;
        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.COMMUNICATION_ERROR, verificationRequest.processorId());
            safelySendErrorResponse(resp, 500, "Communication error: " + e.getMessage(), false);
            return null;
        }
    }

    /**
     * Safely sends error response, handling IOException.
     */
    private void safelySendErrorResponse(HttpServletResponse resp, int statusCode,
            String errorMessage, boolean valid) {
        try {
            sendErrorResponse(resp, statusCode, errorMessage, valid);
        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.FAILED_SEND_ERROR_RESPONSE);
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
            LOGGER.error(e, UILogMessages.ERROR.FAILED_SEND_VALIDATION_RESPONSE);
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Internal record for token verification request parameters.
     */
    private record TokenVerificationRequest(
            String token,
            String processorId
    ) {
    }

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

        // Add issuer if available
        if (result.getIssuer() != null) {
            responseBuilder.add(JSON_KEY_ISSUER, result.getIssuer());
        }

        // Add authorization fields
        responseBuilder.add("authorized", result.isAuthorized());
        addScopesAndRoles(responseBuilder, result);

        // Add claims
        addClaims(responseBuilder, result);

        return responseBuilder;
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
            LOGGER.error(e, UILogMessages.ERROR.FAILED_WRITE_VALIDATION_RESPONSE);
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
            LOGGER.error(e, UILogMessages.ERROR.FAILED_WRITE_ERROR_RESPONSE);
            // Don't throw here to avoid masking the original error
        }
    }

}
