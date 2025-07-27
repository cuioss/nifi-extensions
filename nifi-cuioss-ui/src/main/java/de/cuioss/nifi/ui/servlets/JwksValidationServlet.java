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
import jakarta.json.*;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Servlet for JWKS URL validation using the cui-jwt-validation library.
 * This servlet provides REST endpoints for validating JWKS URLs, files, and content.
 * 
 * Endpoints:
 * - /nifi-api/processors/jwt/validate-jwks-url - Validate JWKS URL accessibility
 * - /nifi-api/processors/jwt/validate-jwks-file - Validate JWKS file content
 * - /nifi-api/processors/jwt/validate-jwks-content - Validate inline JWKS content
 * 
 * All methods use POST and expect JSON request bodies.
 */
@WebServlet(urlPatterns = {
        "/nifi-api/processors/jwt/validate-jwks-url",
        "/nifi-api/processors/jwt/validate-jwks-file",
        "/nifi-api/processors/jwt/validate-jwks-content"
})
public class JwksValidationServlet extends HttpServlet {

    private static final CuiLogger LOGGER = new CuiLogger(JwksValidationServlet.class);
    private static final JsonReaderFactory JSON_READER = Json.createReaderFactory(Map.of());
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        String requestPath = req.getServletPath();
        LOGGER.debug("Received JWKS validation request for path: %s", requestPath);

        switch (requestPath) {
            case "/nifi-api/processors/jwt/validate-jwks-url":
                handleJwksUrlValidation(req, resp);
                break;
            case "/nifi-api/processors/jwt/validate-jwks-file":
                handleJwksFileValidation(req, resp);
                break;
            case "/nifi-api/processors/jwt/validate-jwks-content":
                handleJwksContentValidation(req, resp);
                break;
            default:
                sendErrorResponse(resp, 404, "Endpoint not found");
                break;
        }
    }

    /**
     * Handles JWKS URL validation.
     * Request format: { "jwksUrl": "https://example.com/.well-known/jwks.json", "processorId": "uuid" }
     */
    private void handleJwksUrlValidation(HttpServletRequest req, HttpServletResponse resp)
            throws IOException {

        // Parse request
        JsonObject requestJson = parseRequest(req, resp);
        if (requestJson == null) return; // Error already sent
        
        if (!requestJson.containsKey("jwksUrl")) {
            sendErrorResponse(resp, 400, "Missing required field: jwksUrl");
            return;
        }

        String jwksUrl = requestJson.getString("jwksUrl");
        if (jwksUrl == null || jwksUrl.trim().isEmpty()) {
            sendErrorResponse(resp, 400, "JWKS URL cannot be empty");
            return;
        }

        LOGGER.debug("Validating JWKS URL: %s", jwksUrl);

        // Validate JWKS URL using HttpJwksLoader
        JwksValidationResult result = validateJwksUrl(jwksUrl);
        sendValidationResponse(resp, result);
    }

    /**
     * Handles JWKS file validation.
     * Request format: { "jwksFilePath": "/path/to/jwks.json", "processorId": "uuid" }
     */
    private void handleJwksFileValidation(HttpServletRequest req, HttpServletResponse resp)
            throws IOException {

        // Parse request
        JsonObject requestJson = parseRequest(req, resp);
        if (requestJson == null) return; // Error already sent
        
        if (!requestJson.containsKey("jwksFilePath")) {
            sendErrorResponse(resp, 400, "Missing required field: jwksFilePath");
            return;
        }

        String jwksFilePath = requestJson.getString("jwksFilePath");
        if (jwksFilePath == null || jwksFilePath.trim().isEmpty()) {
            sendErrorResponse(resp, 400, "JWKS file path cannot be empty");
            return;
        }

        LOGGER.debug("Validating JWKS file: %s", jwksFilePath);

        // Validate JWKS file
        JwksValidationResult result = validateJwksFile(jwksFilePath);
        sendValidationResponse(resp, result);
    }

    /**
     * Handles JWKS content validation.
     * Request format: { "jwksContent": "{\"keys\":[...]}", "processorId": "uuid" }
     */
    private void handleJwksContentValidation(HttpServletRequest req, HttpServletResponse resp)
            throws IOException {

        // Parse request
        JsonObject requestJson = parseRequest(req, resp);
        if (requestJson == null) return; // Error already sent
        
        if (!requestJson.containsKey("jwksContent")) {
            sendErrorResponse(resp, 400, "Missing required field: jwksContent");
            return;
        }

        String jwksContent = requestJson.getString("jwksContent");
        if (jwksContent == null || jwksContent.trim().isEmpty()) {
            sendErrorResponse(resp, 400, "JWKS content cannot be empty");
            return;
        }

        LOGGER.debug("Validating JWKS content (length: %d)", jwksContent.length());

        // Validate JWKS content
        JwksValidationResult result = validateJwksContent(jwksContent);
        sendValidationResponse(resp, result);
    }

    /**
     * Validates a JWKS URL using standard HTTP client.
     */
    private JwksValidationResult validateJwksUrl(String jwksUrl) {
        try {
            // Validate URL format
            URI uri = URI.create(jwksUrl);
            if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) {
                return JwksValidationResult.failure("Invalid URL scheme, must be http or https");
            }

            // Create HTTP client and request
            HttpClient httpClient = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(uri)
                    .timeout(Duration.ofSeconds(10))
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            // Send request
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            // Check status code
            if (response.statusCode() != 200) {
                String error = "JWKS URL returned status %d".formatted(response.statusCode());
                LOGGER.debug("JWKS URL validation failed: %s - %s", jwksUrl, error);
                return JwksValidationResult.failure(error);
            }

            // Validate content as JWKS
            String content = response.body();
            JwksValidationResult contentResult = validateJwksContent(content);

            if (contentResult.isValid()) {
                LOGGER.debug("JWKS URL validation successful: %s", jwksUrl);
                return JwksValidationResult.success("JWKS URL is accessible and valid",
                        contentResult.getKeyCount(),
                        contentResult.getAlgorithms());
            } else {
                return contentResult; // Return the content validation error
            }

        } catch (IllegalArgumentException e) {
            String error = "Invalid JWKS URL format: " + e.getMessage();
            LOGGER.debug("JWKS URL validation failed: %s - %s", jwksUrl, error);
            return JwksValidationResult.failure(error);
        } catch (Exception e) {
            String error = "JWKS URL validation error: " + e.getMessage();
            LOGGER.warn(e, "JWKS URL validation failed: %s", jwksUrl);
            return JwksValidationResult.failure(error);
        }
    }

    /**
     * Validates a JWKS file.
     * Note: This is a placeholder implementation. In a real scenario, you would
     * use a file-based JWKS loader from cui-jwt-validation library.
     */
    private JwksValidationResult validateJwksFile(String jwksFilePath) {
        try {
            // For now, this is a basic implementation
            // In a full implementation, you would use cui-jwt-validation's file-based loader
            Path path = Path.of(jwksFilePath);

            if (!Files.exists(path)) {
                return JwksValidationResult.failure("JWKS file does not exist: " + jwksFilePath);
            }

            if (!Files.isReadable(path)) {
                return JwksValidationResult.failure("JWKS file is not readable: " + jwksFilePath);
            }

            // Read and validate content
            String content = Files.readString(path);
            return validateJwksContent(content);

        } catch (Exception e) {
            String error = "JWKS file validation error: " + e.getMessage();
            LOGGER.warn(e, "JWKS file validation failed: %s", jwksFilePath);
            return JwksValidationResult.failure(error);
        }
    }

    /**
     * Validates JWKS content by parsing it as JSON.
     */
    private JwksValidationResult validateJwksContent(String jwksContent) {
        try {
            // Parse as JSON to validate format
            JsonObject jwks = Json.createReader(new StringReader(jwksContent)).readObject();

            // Check for required "keys" field
            if (!jwks.containsKey("keys")) {
                return JwksValidationResult.failure("JWKS content missing required 'keys' field");
            }

            // Basic validation - could be enhanced with more sophisticated validation
            var keys = jwks.getJsonArray("keys");
            if (keys == null || keys.isEmpty()) {
                return JwksValidationResult.failure("JWKS content has empty 'keys' array");
            }

            LOGGER.debug("JWKS content validation successful, found %d keys", keys.size());
            return JwksValidationResult.success("JWKS content is valid", keys.size(), null);

        } catch (JsonException e) {
            String error = "Invalid JWKS JSON format: " + e.getMessage();
            LOGGER.debug("JWKS content validation failed: %s", error);
            return JwksValidationResult.failure(error);
        } catch (Exception e) {
            String error = "JWKS content validation error: " + e.getMessage();
            LOGGER.warn(e, "JWKS content validation failed");
            return JwksValidationResult.failure(error);
        }
    }

    /**
     * Parses the JSON request body.
     */
    private JsonObject parseRequest(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try (JsonReader reader = JSON_READER.createReader(req.getInputStream())) {
            return reader.readObject();
        } catch (JsonException e) {
            LOGGER.warn("Invalid JSON format in request: %s", e.getMessage());
            sendErrorResponse(resp, 400, "Invalid JSON format");
            return null;
        } catch (Exception e) {
            LOGGER.error(e, "Error reading request body");
            sendErrorResponse(resp, 500, "Error reading request");
            return null;
        }
    }

    /**
     * Sends a validation response.
     */
    private void sendValidationResponse(HttpServletResponse resp, JwksValidationResult result)
            throws IOException {

        JsonObject responseJson = Json.createObjectBuilder()
                .add("valid", result.isValid())
                .add("accessible", result.isValid()) // For compatibility with API spec
                .add("error", result.getError() != null ? result.getError() : "")
                .add("keyCount", result.getKeyCount())
                .add("algorithms", result.getAlgorithms() != null ?
                        Json.createArrayBuilder(result.getAlgorithms()) : Json.createArrayBuilder())
                .build();

        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        resp.setStatus(result.isValid() ? 200 : 400);

        try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
            writer.writeObject(responseJson);
            LOGGER.debug("Sent JWKS validation response: valid=%s", result.isValid());
        } catch (IOException e) {
            LOGGER.error(e, "Failed to write validation response");
            throw new IOException("Failed to write response", e);
        }
    }

    /**
     * Sends an error response.
     */
    private void sendErrorResponse(HttpServletResponse resp, int statusCode, String errorMessage)
            throws IOException {

        JsonObject errorResponse = Json.createObjectBuilder()
                .add("valid", false)
                .add("accessible", false)
                .add("error", errorMessage)
                .add("keyCount", 0)
                .add("algorithms", Json.createArrayBuilder())
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

    /**
     * Result of JWKS validation.
     */
    private static class JwksValidationResult {
        private final boolean valid;
        private final String error;
        private final int keyCount;
        private final List<String> algorithms;

        private JwksValidationResult(boolean valid, String error, int keyCount, List<String> algorithms) {
            this.valid = valid;
            this.error = error;
            this.keyCount = keyCount;
            this.algorithms = algorithms;
        }

        public static JwksValidationResult success(String message, int keyCount, List<String> algorithms) {
            return new JwksValidationResult(true, null, keyCount, algorithms);
        }

        public static JwksValidationResult failure(String error) {
            return new JwksValidationResult(false, error, 0, null);
        }

        public boolean isValid() {
            return valid;
        }

        public String getError() {
            return error;
        }

        public int getKeyCount() {
            return keyCount;
        }

        public List<String> getAlgorithms() {
            return algorithms;
        }
    }
}