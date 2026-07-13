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
import de.cuioss.sheriff.token.validation.domain.token.AccessTokenContent;
import de.cuioss.sheriff.token.validation.exception.TokenValidationException;
import de.cuioss.sheriff.token.validation.json.JwtHeader;
import de.cuioss.sheriff.token.validation.pipeline.NonValidatingJwtParser;
import de.cuioss.sheriff.token.validation.security.SecurityEventCounter;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.*;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.nifi.web.NiFiWebConfigurationContext;
import org.jspecify.annotations.Nullable;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.List;
import java.util.Map;

import static de.cuioss.nifi.jwt.util.TokenMasking.maskToken;

/**
 * Servlet for JWT token verification using the Token-Sheriff library.
 * This servlet provides a REST endpoint that verifies JWT tokens using the
 * same configuration and logic as the MultiIssuerJWTTokenAuthenticator processor.
 *
 * <p>Endpoint: /nifi-api/processors/jwt/verify-token
 * <p>Method: POST
 *
 * <p>Request format:
 * <pre>{@code
 * {
 *   "token": "eyJ...",
 *   "processorId": "uuid-of-processor"
 * }
 * }</pre>
 *
 * <p>Response format:
 * <pre>{@code
 * {
 *   "valid": true/false,
 *   "error": "error message if invalid",
 *   "claims": { ... token claims ... },
 *   "decoded": {
 *     "header": {"alg": "RS256", "typ": "JWT", ...},
 *     "payload": {"sub": "...", "iss": "...", "exp": 123, ...}
 *   }
 * }
 * }</pre>
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/reference/configuration.adoc">Configuration Reference</a>
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
    /** Reusable parser for decoding already-validated tokens (no signature check). */
    private static final NonValidatingJwtParser DECODE_PARSER = NonValidatingJwtParser.builder()
            .securityEventCounter(new SecurityEventCounter())
            .build();

    @Nullable
    private transient JwtValidationService validationService;

    /**
     * Shared strict/throw validator for the externally-sourced {@code X-Processor-Id}
     * value (cui-http header-value pipeline plus identifier allow-list). Using the shared
     * {@link ProcessorIdHeaderValidator} keeps one processor-ID rule across the filter and
     * all component-facing servlets.
     */
    private final transient ProcessorIdHeaderValidator processorIdValidator =
            new ProcessorIdHeaderValidator();

    public JwtVerificationServlet() {
        // validationService initialized in init() from ServletContext
    }

    // For testing - allows injection of validation service
    public JwtVerificationServlet(JwtValidationService validationService) {
        this.validationService = validationService;
    }

    @Override
    public void init() throws ServletException {
        super.init();
        if (validationService == null) {
            NiFiWebConfigurationContext configContext = (NiFiWebConfigurationContext) getServletContext()
                    .getAttribute("nifi-web-configuration-context");
            validationService = new JwtValidationService(configContext);
        }
    }

    /**
     * Returns the validation service, or throws when it has not been published yet. {@link #init()}
     * and the injecting constructor set it before any request is served; this guard keeps the
     * reference non-null for the {@code @NullMarked} contract without a redundant defensive branch.
     */
    private JwtValidationService requireService() {
        JwtValidationService service = validationService;
        if (service == null) {
            throw new IllegalStateException("JWT validation service is unavailable");
        }
        return service;
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException {

        LOGGER.debug("Received JWT verification request");

        try {
            JsonObject requestJson = parseJsonRequest(req);
            TokenVerificationRequest verificationRequest = extractVerificationRequest(requestJson, req);
            TokenValidationResult result = performTokenVerification(verificationRequest, req);
            sendJsonResponse(resp, 200, buildValidationResponse(result));
        } catch (RequestException e) {
            sendJsonResponse(resp, e.statusCode, buildErrorResponse(e.getMessage()));
        } catch (ClassCastException e) {
            // A JSON field carried a non-string value (e.g. {"token": 123}); JsonObject.getString
            // throws CCE. Honour the JSON error contract with a 400 instead of a container 500 page.
            LOGGER.warn(UILogMessages.WARN.INVALID_JSON_FORMAT, e.getMessage());
            sendJsonResponse(resp, 400, buildErrorResponse("Invalid field type: expected a string value"));
        }
    }

    private JsonObject parseJsonRequest(HttpServletRequest req) throws RequestException {
        // Read at most MAX+1 bytes instead of trusting Content-Length — with chunked
        // transfer encoding getContentLength() is -1, which would bypass the limit.
        byte[] body;
        try {
            body = req.getInputStream().readNBytes(MAX_REQUEST_BODY_SIZE + 1);
        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.ERROR_READING_REQUEST_BODY);
            throw new RequestException(500, "Error reading request");
        }
        if (body.length > MAX_REQUEST_BODY_SIZE) {
            throw new RequestException(413, "Request body too large");
        }
        try (JsonReader reader = JSON_READER.createReader(new ByteArrayInputStream(body))) {
            return reader.readObject();
        } catch (JsonException e) {
            LOGGER.warn(UILogMessages.WARN.INVALID_JSON_FORMAT, e.getMessage());
            throw new RequestException(400, "Invalid JSON format");
        }
    }

    private TokenVerificationRequest extractVerificationRequest(
            JsonObject requestJson,
            HttpServletRequest req) throws RequestException {

        if (!requestJson.containsKey("token")) {
            LOGGER.warn(UILogMessages.WARN.MISSING_REQUIRED_FIELD_TOKEN);
            throw new RequestException(400, "Missing required field: token");
        }

        String token = requestJson.getString("token");
        if (token.trim().isEmpty()) {
            throw new RequestException(400, "Token cannot be empty");
        }

        // Read processorId from body first, fall back to X-Processor-Id header
        // (the header is already validated by ProcessorIdValidationFilter)
        String processorId = requestJson.containsKey("processorId") ?
                requestJson.getString("processorId") : null;
        if (processorId == null || processorId.trim().isEmpty()) {
            processorId = req.getHeader("X-Processor-Id");
        }

        LOGGER.debug("Request received - processorId: %s, token: %s", processorId, maskToken(token));

        if (processorId == null || processorId.trim().isEmpty()) {
            throw new RequestException(400, "Processor ID cannot be empty");
        }

        // Validate the externally-sourced processor ID (body-sourced value or the
        // X-Processor-Id header fallback) through the cui-http header-value pipeline
        // before it is used as a component lookup key. The token field is deliberately
        // NOT validated here — JWT tokens are validated by the Token-Sheriff validation
        // service and contain base64url characters a URL/path sanitizer would wrongly
        // reject; the X-Processor-Id value is the externally-sourced value in scope.
        validateProcessorIdSecurity(processorId);

        LOGGER.debug("Verifying token for processor: %s", processorId);

        return new TokenVerificationRequest(token, processorId);
    }

    /**
     * Validates an externally-sourced {@code X-Processor-Id} value through the shared
     * {@link ProcessorIdHeaderValidator} rule (cui-http header-value pipeline plus identifier
     * allow-list). On violation, rejects with HTTP 400 and a {@code WARN} log entry.
     *
     * @param processorId the processor ID value to validate
     * @throws RequestException with status 400 when the value violates the security policy
     */
    private void validateProcessorIdSecurity(String processorId) throws RequestException {
        if (!processorIdValidator.isSafe(processorId)) {
            LOGGER.warn(UILogMessages.WARN.INVALID_PROCESSOR_ID_FORMAT, processorId);
            throw new RequestException(400, "Invalid processor ID: contains illegal characters");
        }
    }

    private TokenValidationResult performTokenVerification(
            TokenVerificationRequest verificationRequest,
            HttpServletRequest req) throws RequestException {

        try {
            return requireService().verifyToken(
                    verificationRequest.token(),
                    verificationRequest.processorId(),
                    req
            );
        } catch (IllegalArgumentException e) {
            LOGGER.warn(UILogMessages.WARN.INVALID_REQUEST,
                    verificationRequest.processorId(), e.getMessage());
            throw new RequestException(400, "Invalid request: " + e.getMessage());
        } catch (IllegalStateException e) {
            LOGGER.error(UILogMessages.ERROR.SERVICE_NOT_AVAILABLE,
                    verificationRequest.processorId(), e.getMessage());
            throw new RequestException(503, "Service not available: " + e.getMessage());
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
     * Carries HTTP status code and error message for request processing failures.
     */
    private static class RequestException extends Exception {
        private final int statusCode;

        RequestException(int statusCode, String message) {
            super(message);
            this.statusCode = statusCode;
        }
    }

    // ── Response Building ────────────────────────────────────────────

    private static JsonObject buildValidationResponse(TokenValidationResult result) {
        JsonObjectBuilder builder = Json.createObjectBuilder()
                .add(JSON_KEY_VALID, result.isValid())
                .add("error", result.getError() != null ? result.getError() : "");

        if (!result.getIssuer().isEmpty()) {
            builder.add(JSON_KEY_ISSUER, result.getIssuer());
        }

        builder.add("authorized", result.isAuthorized());
        addCollectionField(builder, "scopes", result.getScopes());
        addCollectionField(builder, "roles", result.getRoles());

        if (result.isValid()) {
            builder.add(JSON_KEY_CLAIMS, mapToJsonObject(result.getClaims()));
        } else {
            builder.add(JSON_KEY_CLAIMS, Json.createObjectBuilder());
        }

        addDecodedToken(builder, result);

        return builder.build();
    }

    private static JsonObject buildErrorResponse(String errorMessage) {
        return Json.createObjectBuilder()
                .add(JSON_KEY_VALID, false)
                .add("error", errorMessage)
                .add(JSON_KEY_CLAIMS, Json.createObjectBuilder())
                .build();
    }

    private void sendJsonResponse(HttpServletResponse resp, int statusCode, JsonObject json) {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        resp.setStatus(statusCode);

        try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
            writer.writeObject(json);
            LOGGER.debug("Sent response: status=%s, valid=%s", statusCode,
                    json.containsKey(JSON_KEY_VALID) ? json.getBoolean(JSON_KEY_VALID) : "n/a");
        } catch (IOException e) {
            // This path covers both success (200) and error responses, so log the neutral
            // "failed to write JSON response" record rather than an error-specific one.
            LOGGER.warn(e, UILogMessages.WARN.FAILED_WRITE_JSON_RESPONSE, statusCode, e.getMessage());
            // If writing a success response failed, signal the error to the client
            if (statusCode == 200) {
                resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            }
        }
    }

    // ── Decoded Token (library-based) ────────────────────────────────

    /**
     * Decodes the JWT header and payload using the library's {@link NonValidatingJwtParser}
     * and adds them as a {@code decoded} object with {@code header} and {@code payload} fields.
     * Only added for valid tokens with available token content. Malformed tokens are silently
     * skipped (decoded field omitted).
     */
    private static void addDecodedToken(JsonObjectBuilder builder, TokenValidationResult result) {
        AccessTokenContent tokenContent = result.getTokenContent();
        if (tokenContent == null || tokenContent.getRawToken() == null) {
            return;
        }

        try {
            var decoded = DECODE_PARSER.decode(tokenContent.getRawToken());

            builder.add("decoded", Json.createObjectBuilder()
                    .add("header", jwtHeaderToJson(decoded.header()))
                    .add("payload", mapToJsonObject(decoded.body().data())));
        } catch (TokenValidationException e) {
            LOGGER.debug("Failed to decode JWT parts for UI display: %s", e.getMessage());
        }
    }

    // ── JSON Helpers ─────────────────────────────────────────────────

    private static JsonObject jwtHeaderToJson(JwtHeader header) {
        JsonObjectBuilder builder = Json.createObjectBuilder();
        header.getAlg().ifPresent(v -> builder.add("alg", v));
        header.getTyp().ifPresent(v -> builder.add("typ", v));
        header.getKid().ifPresent(v -> builder.add("kid", v));
        header.getJwk().ifPresent(v -> builder.add("jwk", v));
        if (header.cty() != null) {
            builder.add("cty", header.cty());
        }
        return builder.build();
    }

    private static JsonObject mapToJsonObject(Map<String, Object> map) {
        JsonObjectBuilder builder = Json.createObjectBuilder();
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            addJsonValue(builder, entry.getKey(), entry.getValue());
        }
        return builder.build();
    }

    @SuppressWarnings("unchecked")
    private static void addJsonValue(JsonObjectBuilder builder, String key, Object value) {
        switch (value) {
            case null -> builder.addNull(key);
            case String s -> builder.add(key, s);
            case Integer i -> builder.add(key, i);
            case Long l -> builder.add(key, l);
            case Double d -> builder.add(key, d);
            case Boolean b -> builder.add(key, b);
            case Map<?, ?> m -> builder.add(key, mapToJsonObject((Map<String, Object>) m));
            case List<?> list -> {
                JsonArrayBuilder arrayBuilder = Json.createArrayBuilder();
                for (Object item : list) {
                    addJsonArrayValue(arrayBuilder, item);
                }
                builder.add(key, arrayBuilder);
            }
            default -> builder.add(key, value.toString());
        }
    }

    @SuppressWarnings("unchecked")
    private static void addJsonArrayValue(JsonArrayBuilder arrayBuilder, Object value) {
        switch (value) {
            case null -> arrayBuilder.addNull();
            case String s -> arrayBuilder.add(s);
            case Integer i -> arrayBuilder.add(i);
            case Long l -> arrayBuilder.add(l);
            case Double d -> arrayBuilder.add(d);
            case Boolean b -> arrayBuilder.add(b);
            case Map<?, ?> m -> arrayBuilder.add(mapToJsonObject((Map<String, Object>) m));
            default -> arrayBuilder.add(value.toString());
        }
    }

    private static void addCollectionField(JsonObjectBuilder builder, String fieldName, List<String> values) {
        if (!values.isEmpty()) {
            JsonArrayBuilder arrayBuilder = Json.createArrayBuilder();
            values.forEach(arrayBuilder::add);
            builder.add(fieldName, arrayBuilder);
        }
    }

}
