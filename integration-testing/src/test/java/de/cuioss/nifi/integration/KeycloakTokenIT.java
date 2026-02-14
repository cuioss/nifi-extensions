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
package de.cuioss.nifi.integration;

import jakarta.json.Json;
import jakarta.json.JsonObject;
import org.jspecify.annotations.NullMarked;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.StringReader;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for Keycloak token operations. Replaces the Playwright-based
 * {@code self-keycloak-token.spec.js} tests with pure Java HTTP tests.
 *
 * <p>Requires Docker containers to be running (Keycloak on port 9080, health on
 * port 9086). Activated via the {@code integration-tests} Maven profile.
 */
@NullMarked
@Disabled("flow.json needs CS architecture update — re-enable after #137 flow migration")
@DisplayName("Keycloak Token Integration Tests")
class KeycloakTokenIT {

    private static final String KEYCLOAK_BASE = "http://localhost:9080";
    private static final String TOKEN_ENDPOINT = KEYCLOAK_BASE
            + "/realms/oauth_integration_tests/protocol/openid-connect/token";
    private static final String CLIENT_ID = "test_client";
    private static final String CLIENT_SECRET = "yTKslWLtf4giJcWCaoVJ20H8sy6STexM";
    private static final String USERNAME = "testUser";
    private static final String PASSWORD = "drowssap";

    private HttpClient httpClient;

    @BeforeEach
    void setUp() {
        httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    // ── Token Acquisition ───────────────────────────────────────────────

    @Nested
    @DisplayName("Token Acquisition")
    class TokenAcquisitionTests {

        @Test
        @DisplayName("should fetch valid JWT via password grant")
        void shouldFetchValidToken() throws Exception {
            String token = fetchToken(USERNAME, PASSWORD);

            assertNotNull(token, "Access token must not be null");
            String[] parts = token.split("\\.");
            assertEquals(3, parts.length, "JWT must have 3 dot-separated parts");
        }

        @Test
        @DisplayName("should return JWT with required claims (sub, iss, exp, iat)")
        void shouldContainRequiredClaims() throws Exception {
            String token = fetchToken(USERNAME, PASSWORD);
            JsonObject payload = decodePayload(token);

            assertTrue(payload.containsKey("sub"), "JWT must contain 'sub' claim");
            assertTrue(payload.containsKey("iss"), "JWT must contain 'iss' claim");
            assertTrue(payload.containsKey("exp"), "JWT must contain 'exp' claim");
            assertTrue(payload.containsKey("iat"), "JWT must contain 'iat' claim");
        }

        @Test
        @DisplayName("should return non-expired token")
        void shouldReturnNonExpiredToken() throws Exception {
            String token = fetchToken(USERNAME, PASSWORD);
            JsonObject payload = decodePayload(token);

            long exp = payload.getJsonNumber("exp").longValue();
            long now = Instant.now().getEpochSecond();
            assertTrue(exp > now, "Token 'exp' (%d) must be greater than current time (%d)".formatted(exp, now));
        }
    }

    // ── Error Handling ──────────────────────────────────────────────────

    @Nested
    @DisplayName("Error Handling")
    class ErrorHandlingTests {

        @Test
        @DisplayName("should reject invalid credentials with 401")
        void shouldRejectInvalidCredentials() throws Exception {
            HttpResponse<String> response = postTokenRequest("wronguser", "wrongpassword");

            assertEquals(401, response.statusCode(),
                    "Invalid credentials should result in HTTP 401");
        }

        @Test
        @DisplayName("should fail with connection error for unreachable endpoint")
        void shouldFailForUnreachableEndpoint() {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:19999/realms/test/protocol/openid-connect/token"))
                    .POST(HttpRequest.BodyPublishers.ofString("grant_type=password"))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .timeout(Duration.ofSeconds(5))
                    .build();

            assertThrows(IOException.class,
                    () -> httpClient.send(request, HttpResponse.BodyHandlers.ofString()),
                    "Connection to unreachable endpoint should throw IOException");
        }
    }

    // ── Helper methods ──────────────────────────────────────────────────

    private String fetchToken(String username, String password) throws Exception {
        HttpResponse<String> response = postTokenRequest(username, password);
        assertEquals(200, response.statusCode(),
                "Token request failed with status %d: %s".formatted(response.statusCode(), response.body()));

        JsonObject json = Json.createReader(new StringReader(response.body())).readObject();
        String accessToken = json.getString("access_token");
        assertNotNull(accessToken, "Response must contain 'access_token'");
        return accessToken;
    }

    private HttpResponse<String> postTokenRequest(String username, String password) throws Exception {
        String body = formEncode(Map.of(
                "grant_type", "password",
                "client_id", CLIENT_ID,
                "client_secret", CLIENT_SECRET,
                "username", username,
                "password", password,
                "scope", "openid"));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(TOKEN_ENDPOINT))
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .timeout(Duration.ofSeconds(10))
                .build();

        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private static String formEncode(Map<String, String> params) {
        return params.entrySet().stream()
                .map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8)
                        + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
    }

    private static JsonObject decodePayload(String jwt) {
        String[] parts = jwt.split("\\.");
        assertEquals(3, parts.length, "JWT must have 3 parts");
        String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
        return Json.createReader(new StringReader(payloadJson)).readObject();
    }
}
