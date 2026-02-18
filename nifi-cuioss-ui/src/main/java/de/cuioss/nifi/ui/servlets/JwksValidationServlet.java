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

import de.cuioss.http.client.handler.HttpHandler;
import de.cuioss.http.security.config.SecurityConfiguration;
import de.cuioss.http.security.core.HttpSecurityValidator;
import de.cuioss.http.security.exceptions.UrlSecurityException;
import de.cuioss.http.security.monitoring.SecurityEventCounter;
import de.cuioss.http.security.pipeline.PipelineFactory;
import de.cuioss.nifi.ui.UILogMessages;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.*;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.io.StringReader;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/**
 * Servlet for JWKS URL validation using the OAuth-Sheriff library.
 * This servlet provides REST endpoints for validating JWKS URLs, files, and content.
 *
 * Endpoints:
 * - /nifi-api/processors/jwt/validate-jwks-url - Validate JWKS URL accessibility
 * - /nifi-api/processors/jwt/validate-jwks-file - Validate JWKS file content
 * - /nifi-api/processors/jwt/validate-jwks-content - Validate inline JWKS content
 *
 * All methods use POST and expect JSON request bodies.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/security.adoc">Security Specification</a>
 */
public class JwksValidationServlet extends HttpServlet {

    private static final CuiLogger LOGGER = new CuiLogger(JwksValidationServlet.class);
    private static final String CONTENT_TYPE_JSON = "application/json";
    private static final JsonReaderFactory JSON_READER = Json.createReaderFactory(Map.of());
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());
    private static final String JWKS_VALIDATION_FAILED_MSG = "JWKS URL validation failed: %s - %s";

    /** Maximum request body size: 1 MB */
    private static final int MAX_REQUEST_BODY_SIZE = 1024 * 1024;

    /** Default base path for JWKS files when no NiFi properties are available. */
    @SuppressWarnings("java:S1075") // Intentional NiFi deployment default constant
    private static final String DEFAULT_JWKS_BASE_PATH = "/opt/nifi/nifi-current/conf";

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException {

        String requestPath = req.getServletPath();
        LOGGER.debug("Received JWKS validation request for path: %s", requestPath);

        try {
            switch (requestPath) {
                case "/nifi-api/processors/jwt/validate-jwks-url" -> handleJwksUrlValidation(req, resp);
                case "/nifi-api/processors/jwt/validate-jwks-file" -> handleJwksFileValidation(req, resp);
                case "/nifi-api/processors/jwt/validate-jwks-content" -> handleJwksContentValidation(req, resp);
                default -> sendErrorResponse(resp, 404, "Endpoint not found");
            }
        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.FAILED_JWKS_REQUEST, requestPath);
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
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
     * Validates a JWKS URL using cui-http's HttpHandler for secure HTTP communication.
     */
    private JwksValidationResult validateJwksUrl(String jwksUrl) {
        try {
            // Validate URL format
            URI uri = validateUrlScheme(jwksUrl);
            if (uri == null) {
                return JwksValidationResult.failure("Invalid URL scheme, must be http or https");
            }

            // Validate URL path using cui-http security pipeline
            JwksValidationResult urlSecurityResult = validateUrlSecurity(jwksUrl);
            if (urlSecurityResult != null) {
                return urlSecurityResult;
            }

            // SSRF protection: resolve DNS once and validate all resolved addresses.
            // The resolved IP is used directly for the HTTP request to prevent
            // DNS rebinding TOCTOU attacks.
            InetAddress resolvedAddress = resolveAndValidateAddress(uri.getHost());
            if (resolvedAddress == null) {
                LOGGER.warn(UILogMessages.WARN.SSRF_BLOCKED, jwksUrl);
                return JwksValidationResult.failure("URL must not point to a private or loopback address");
            }

            // Fetch JWKS content using the resolved IP to prevent DNS rebinding
            String content = fetchJwksContentByResolvedAddress(jwksUrl, uri, resolvedAddress);
            if (content == null) {
                return JwksValidationResult.failure("Failed to fetch JWKS content");
            }

            // Validate content as JWKS
            return validateAndReturnResult(content, jwksUrl);

        } catch (IllegalArgumentException e) {
            return handleValidationError(jwksUrl, "Invalid JWKS URL format: " + e.getMessage(), false);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return handleValidationError(jwksUrl, "JWKS URL validation interrupted: " + e.getMessage(), true);
        } catch (IOException e) {
            return handleValidationError(jwksUrl, "JWKS URL validation error: " + e.getMessage(), true);
        }
    }

    /**
     * Resolves a hostname and validates that ALL resolved addresses are public.
     * Returns the first resolved address if all pass validation, or null if any are private.
     * This performs DNS resolution once to prevent DNS rebinding TOCTOU attacks.
     *
     * @param host hostname to resolve and validate
     * @return the first resolved InetAddress if all are public, null otherwise
     */
    private InetAddress resolveAndValidateAddress(String host) {
        if (host == null || host.isEmpty()) {
            return null;
        }
        try {
            InetAddress[] addresses = InetAddress.getAllByName(host);
            for (InetAddress address : addresses) {
                if (address.isLoopbackAddress()
                        || address.isSiteLocalAddress()
                        || address.isLinkLocalAddress()
                        || address.isAnyLocalAddress()) {
                    LOGGER.debug("Private/loopback address detected for host %s: %s", host, address);
                    return null;
                }
            }
            return addresses[0];
        } catch (UnknownHostException e) {
            LOGGER.debug("Cannot resolve host for SSRF check: %s", host);
            return null;
        }
    }

    /**
     * Validates URL scheme (must be http or https).
     *
     * @param jwksUrl URL to validate
     * @return URI if valid, null otherwise
     */
    private URI validateUrlScheme(String jwksUrl) {
        URI uri = URI.create(jwksUrl);
        if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) {
            return null;
        }
        return uri;
    }

    /**
     * Fetches JWKS content using a pre-resolved IP address to prevent DNS rebinding attacks.
     * The HTTP request is made to the resolved IP with the original Host header,
     * ensuring the same IP validated by {@link #resolveAndValidateAddress} is used.
     *
     * @param jwksUrl          Original URL (for logging and Host header)
     * @param originalUri      Parsed URI of the original URL
     * @param resolvedAddress  Pre-validated IP address to connect to
     * @return JWKS content, or null if fetch failed
     * @throws IOException if HTTP request fails
     * @throws InterruptedException if HTTP request is interrupted
     */
    private String fetchJwksContentByResolvedAddress(String jwksUrl, URI originalUri,
            InetAddress resolvedAddress) throws IOException, InterruptedException {
        // Build URL using resolved IP to prevent DNS rebinding TOCTOU attacks
        URI ipBasedUri;
        try {
            int port = originalUri.getPort();
            ipBasedUri = new URI(originalUri.getScheme(), null, resolvedAddress.getHostAddress(),
                    port, originalUri.getPath(), originalUri.getQuery(), null);
        } catch (URISyntaxException e) {
            LOGGER.warn(UILogMessages.WARN.JWKS_IP_URI_CONSTRUCTION_FAILED, jwksUrl);
            return null;
        }

        HttpHandler httpHandler = HttpHandler.builder()
                .uri(ipBasedUri.toString())
                .connectionTimeoutSeconds(5)
                .readTimeoutSeconds(10)
                .build();

        try (HttpClient httpClient = httpHandler.createHttpClient()) {
            HttpRequest request = httpHandler.requestBuilder()
                    .header("Accept", CONTENT_TYPE_JSON)
                    .header("Host", originalUri.getHost())
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                String error = "JWKS URL returned status %d".formatted(response.statusCode());
                LOGGER.debug(JWKS_VALIDATION_FAILED_MSG, jwksUrl, error);
                return null;
            }

            return response.body();
        }
    }

    /**
     * Validates JWKS content and returns appropriate result.
     *
     * @param content JWKS content to validate
     * @param jwksUrl Original URL string (for logging)
     * @return Validation result
     */
    private JwksValidationResult validateAndReturnResult(String content, String jwksUrl) {
        JwksValidationResult contentResult = validateJwksContent(content);

        if (contentResult.isValid()) {
            LOGGER.debug("JWKS URL validation successful: %s", jwksUrl);
            return JwksValidationResult.success(
                    contentResult.getKeyCount(),
                    contentResult.getAlgorithms());
        }
        return contentResult; // Return the content validation error
    }

    /**
     * Handles validation errors with appropriate logging.
     *
     * @param jwksUrl URL that failed validation
     * @param errorMessage Error message
     * @param useWarnLevel Whether to log at WARN level (true) or DEBUG level (false)
     * @return Failure result
     */
    private JwksValidationResult handleValidationError(String jwksUrl, String errorMessage, boolean useWarnLevel) {
        if (useWarnLevel) {
            LOGGER.warn(UILogMessages.WARN.JWKS_URL_VALIDATION_FAILED, jwksUrl, errorMessage);
        } else {
            LOGGER.debug(JWKS_VALIDATION_FAILED_MSG, jwksUrl, errorMessage);
        }
        return JwksValidationResult.failure(errorMessage);
    }

    /**
     * Validates a JWKS file with path traversal protection using cui-http security pipeline
     * and base directory restriction.
     */
    private JwksValidationResult validateJwksFile(String jwksFilePath) {
        try {
            // 1. Validate path using cui-http security pipeline for traversal detection
            JwksValidationResult pathSecurityResult = validatePathSecurity(jwksFilePath);
            if (pathSecurityResult != null) {
                return pathSecurityResult;
            }

            // 2. Base directory restriction
            Path requestedPath = Path.of(jwksFilePath).normalize().toAbsolutePath();
            Path allowedBase = getJwksAllowedBasePath();
            if (!requestedPath.startsWith(allowedBase)) {
                LOGGER.warn(UILogMessages.WARN.JWKS_FILE_OUTSIDE_BASE, requestedPath, allowedBase);
                return JwksValidationResult.failure("File path must be within: " + allowedBase);
            }

            // 3. Validate file exists and is readable
            if (!Files.exists(requestedPath)) {
                return JwksValidationResult.failure("JWKS file does not exist at the specified path");
            }

            if (!Files.isReadable(requestedPath)) {
                return JwksValidationResult.failure("JWKS file is not readable at the specified path");
            }

            // 4. Read and validate content
            String content = Files.readString(requestedPath);
            return validateJwksContent(content);

        } catch (IOException e) {
            String error = "JWKS file validation error: " + e.getMessage();
            LOGGER.warn(e, UILogMessages.WARN.JWKS_FILE_VALIDATION_FAILED, jwksFilePath);
            return JwksValidationResult.failure(error);
        }
    }

    /**
     * Resolves the allowed base path for JWKS files.
     * Checks for NiFi properties file path first, then falls back to system property
     * or default NiFi conf directory.
     */
    static Path getJwksAllowedBasePath() {
        // Try NiFi properties file path (parent directory)
        String nifiPropertiesPath = System.getProperty("nifi.properties.file.path");
        if (nifiPropertiesPath != null && !nifiPropertiesPath.trim().isEmpty()) {
            Path propertiesDir = Path.of(nifiPropertiesPath).getParent();
            if (propertiesDir != null) {
                return propertiesDir.normalize().toAbsolutePath();
            }
        }

        // Try configurable system property
        String jwksBasePath = System.getProperty("nifi.jwks.allowed.base.path");
        if (jwksBasePath != null && !jwksBasePath.trim().isEmpty()) {
            return Path.of(jwksBasePath).normalize().toAbsolutePath();
        }

        // Default NiFi conf directory
        return Path.of(DEFAULT_JWKS_BASE_PATH).normalize().toAbsolutePath();
    }

    /**
     * Validates URL security using cui-http security pipeline.
     *
     * @param jwksUrl the URL to validate
     * @return a failure result if validation fails, or null if the URL is safe
     */
    private JwksValidationResult validateUrlSecurity(String jwksUrl) {
        SecurityEventCounter counter = new SecurityEventCounter();
        SecurityConfiguration secConfig = SecurityConfiguration.strict();
        HttpSecurityValidator urlValidator = PipelineFactory.createUrlPathPipeline(secConfig, counter);
        try {
            urlValidator.validate(jwksUrl);
        } catch (UrlSecurityException e) {
            LOGGER.warn(UILogMessages.WARN.URL_SECURITY_VIOLATION, jwksUrl, e.getFailureType());
            return JwksValidationResult.failure("Invalid URL: " + e.getFailureType().getDescription());
        }
        return null;
    }

    /**
     * Validates file path security using cui-http security pipeline.
     *
     * @param jwksFilePath the file path to validate
     * @return a failure result if validation fails, or null if the path is safe
     */
    private JwksValidationResult validatePathSecurity(String jwksFilePath) {
        SecurityEventCounter counter = new SecurityEventCounter();
        SecurityConfiguration secConfig = SecurityConfiguration.strict();
        HttpSecurityValidator pathValidator = PipelineFactory.createUrlPathPipeline(secConfig, counter);
        try {
            pathValidator.validate(jwksFilePath);
        } catch (UrlSecurityException e) {
            LOGGER.warn(UILogMessages.WARN.PATH_SECURITY_VIOLATION, jwksFilePath, e.getFailureType());
            return JwksValidationResult.failure("Invalid file path: " + e.getFailureType().getDescription());
        }
        return null;
    }

    /**
     * Validates JWKS content by parsing it as JSON.
     */
    private JwksValidationResult validateJwksContent(String jwksContent) {
        try {
            // Parse as JSON to validate format
            JsonObject jwks;
            try (JsonReader jsonReader = Json.createReader(new StringReader(jwksContent))) {
                jwks = jsonReader.readObject();
            }

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
            return JwksValidationResult.success(keys.size(), null);

        } catch (JsonException e) {
            String error = "Invalid JWKS JSON format: " + e.getMessage();
            LOGGER.debug("JWKS content validation failed: %s", error);
            return JwksValidationResult.failure(error);
        }
    }

    /**
     * Parses the JSON request body.
     */
    @SuppressWarnings("java:S1168") // False positive - JsonObject is not a collection, null indicates error handled
    private JsonObject parseRequest(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        if (req.getContentLength() > MAX_REQUEST_BODY_SIZE) {
            sendErrorResponse(resp, 413, "Request body too large");
            return null;
        }
        try (JsonReader reader = JSON_READER.createReader(req.getInputStream())) {
            return reader.readObject();
        } catch (JsonException e) {
            LOGGER.warn(UILogMessages.WARN.INVALID_JSON_FORMAT, e.getMessage());
            sendErrorResponse(resp, 400, "Invalid JSON format");
            return null;
        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.ERROR_READING_REQUEST_BODY);
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

        resp.setContentType(CONTENT_TYPE_JSON);
        resp.setCharacterEncoding("UTF-8");
        resp.setStatus(HttpServletResponse.SC_OK);

        try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
            writer.writeObject(responseJson);
            LOGGER.debug("Sent JWKS validation response: valid=%s", result.isValid());
        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.FAILED_WRITE_VALIDATION_RESPONSE);
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

        resp.setContentType(CONTENT_TYPE_JSON);
        resp.setCharacterEncoding("UTF-8");
        resp.setStatus(statusCode);

        try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
            writer.writeObject(errorResponse);
        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.FAILED_WRITE_ERROR_RESPONSE);
            // Don't throw here to avoid masking the original error
        }
    }

    /**
     * Result of JWKS validation.
     */
    private record JwksValidationResult(
            boolean valid,
            String error,
            int keyCount,
            List<String> algorithms
    ) {
        public static JwksValidationResult success(int keyCount, List<String> algorithms) {
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
