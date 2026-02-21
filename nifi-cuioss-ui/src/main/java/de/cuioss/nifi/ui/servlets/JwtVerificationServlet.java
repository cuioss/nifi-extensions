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
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.sheriff.oauth.core.exception.TokenValidationException;
import de.cuioss.sheriff.oauth.core.json.JwtHeader;
import de.cuioss.sheriff.oauth.core.pipeline.NonValidatingJwtParser;
import de.cuioss.sheriff.oauth.core.security.SecurityEventCounter;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.*;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.nifi.web.NiFiWebConfigurationContext;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import static de.cuioss.nifi.ui.util.TokenMasking.maskToken;

/**
 * Servlet for JWT token verification using the OAuth-Sheriff library.
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
    /** Reusable parser for decoding already-validated tokens (no signature check). */
    private static final NonValidatingJwtParser DECODE_PARSER = NonValidatingJwtParser.builder()
            .securityEventCounter(new SecurityEventCounter())
            .build();

    private transient JwtValidationService validationService;

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
        }
    }

    private JsonObject parseJsonRequest(HttpServletRequest req) throws RequestException {
        if (req.getContentLength() > MAX_REQUEST_BODY_SIZE) {
            throw new RequestException(413, "Request body too large");
        }
        try (JsonReader reader = JSON_READER.createReader(req.getInputStream())) {
            return reader.readObject();
        } catch (JsonException e) {
            LOGGER.warn(UILogMessages.WARN.INVALID_JSON_FORMAT, e.getMessage());
            throw new RequestException(400, "Invalid JSON format");
        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.ERROR_READING_REQUEST_BODY);
            throw new RequestException(500, "Error reading request");
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
        if (token == null || token.trim().isEmpty()) {
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

        LOGGER.debug("Verifying token for processor: %s", processorId);

        return new TokenVerificationRequest(token, processorId);
    }

    private TokenValidationResult performTokenVerification(
            TokenVerificationRequest verificationRequest,
            HttpServletRequest req) throws RequestException {

        try {
            return validationService.verifyToken(
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

        if (result.getIssuer() != null) {
            builder.add(JSON_KEY_ISSUER, result.getIssuer());
        }

        builder.add("authorized", result.isAuthorized());
        addCollectionField(builder, "scopes", result.getScopes());
        addCollectionField(builder, "roles", result.getRoles());

        if (result.isValid() && result.getClaims() != null) {
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
            LOGGER.error(e, UILogMessages.ERROR.FAILED_SEND_ERROR_RESPONSE);
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
            var decoded = DECODE_PARSER.decode(tokenContent.getRawToken(), false);

            builder.add("decoded", Json.createObjectBuilder()
                    .add("header", jwtHeaderToJson(decoded.getHeader()))
                    .add("payload", mapToJsonObject(decoded.getBody().data())));
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
        header.getJku().ifPresent(v -> builder.add("jku", v));
        header.getJwk().ifPresent(v -> builder.add("jwk", v));
        header.getX5u().ifPresent(v -> builder.add("x5u", v));
        header.getX5c().ifPresent(v -> builder.add("x5c", v));
        header.getX5t().ifPresent(v -> builder.add("x5t", v));
        header.getX5tS256().ifPresent(v -> builder.add("x5t#S256", v));
        header.getCty().ifPresent(v -> builder.add("cty", v));
        header.getCrit().ifPresent(v -> builder.add("crit", v));
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
        if (values != null && !values.isEmpty()) {
            JsonArrayBuilder arrayBuilder = Json.createArrayBuilder();
            values.forEach(arrayBuilder::add);
            builder.add(fieldName, arrayBuilder);
        }
    }

}
