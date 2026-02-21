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
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import static de.cuioss.nifi.integration.IntegrationTestSupport.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * End-to-end integration tests for the NiFi flow pipeline with JWT authentication.
 *
 * <p>Tests send HTTP requests to port 7777 where a HandleHttpRequest processor
 * accepts incoming requests, passes them through the MultiIssuerJWTTokenAuthenticator
 * processor for JWT validation, and returns HTTP responses (200 for valid tokens
 * with required roles, 401 for invalid/missing tokens or insufficient roles).
 *
 * <p>The flow includes AttributesToJSON processors that write all {@code jwt.*}
 * attributes as JSON into the response body, enabling verification of token
 * extraction, validation, and authorization results.
 *
 * <p>Requires Docker containers to be running (NiFi on port 7777, Keycloak on port 9080).
 * Activated via the {@code integration-tests} Maven profile.
 */
@NullMarked
@DisplayName("NiFi Flow Pipeline Integration Tests")
class NiFiFlowPipelineIT {

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @BeforeAll
    static void waitForFlowEndpoint() throws Exception {
        waitForEndpoint(HTTP_CLIENT, FLOW_ENDPOINT, Duration.ofSeconds(120));
    }

    // ── Valid Token ────────────────────────────────────────────────────

    @Nested
    @DisplayName("Valid Token Tests")
    class ValidTokenTests {

        @Test
        @DisplayName("should return 200 with jwt attributes for valid JWT with required 'read' role")
        void shouldReturn200ForValidJwtWithRequiredRoles() throws Exception {
            // testUser has roles: user, read — 'read' is required by the flow
            String token = fetchKeycloakToken(HTTP_CLIENT,
                    KEYCLOAK_TOKEN_ENDPOINT, CLIENT_ID, CLIENT_SECRET, TEST_USER, PASSWORD);

            HttpResponse<String> response = sendToFlow("Bearer " + token);

            assertEquals(200, response.statusCode(),
                    "Valid token with 'read' role should return 200. Response: " + response.body());

            JsonObject body = parseJsonBody(response);
            assertNotNull(body, "Response body should contain JSON with jwt attributes");
            assertEquals("true", body.getString("jwt.present"),
                    "jwt.present should be 'true' for valid token");
            assertEquals("true", body.getString("jwt.authorized"),
                    "jwt.authorized should be 'true' for authorized token");
            assertTrue(body.containsKey("jwt.subject"),
                    "jwt.subject should be present");
            assertFalse(body.getString("jwt.subject").isBlank(),
                    "jwt.subject should not be blank");
            assertEquals(EXPECTED_ISSUER, body.getString("jwt.issuer"),
                    "jwt.issuer should match the Keycloak realm issuer");
            assertTrue(body.getString("jwt.roles").contains("read"),
                    "jwt.roles should contain 'read'. Actual: " + body.getString("jwt.roles"));
            assertTrue(body.containsKey("jwt.validatedAt"),
                    "jwt.validatedAt should be present");
        }
    }

    // ── Invalid Signature ──────────────────────────────────────────────

    @Nested
    @DisplayName("Invalid Signature Tests")
    class InvalidSignatureTests {

        @Test
        @DisplayName("should return 401 with error attributes for token signed by a different realm")
        void shouldReturn401ForTokenSignedByDifferentRealm() throws Exception {
            // Fetch a token from other_realm — signed with a different RSA key pair
            String otherToken = fetchKeycloakToken(HTTP_CLIENT,
                    OTHER_REALM_TOKEN_ENDPOINT, OTHER_CLIENT_ID, OTHER_CLIENT_SECRET,
                    OTHER_USER, PASSWORD);

            HttpResponse<String> response = sendToFlow("Bearer " + otherToken);

            assertEquals(401, response.statusCode(),
                    "Token from different realm should return 401. Response: " + response.body());

            JsonObject body = parseJsonBody(response);
            assertNotNull(body, "Response body should contain JSON with jwt attributes");
            assertTrue(body.containsKey("jwt.error.code"),
                    "jwt.error.code should be present for invalid signature");
            assertFalse(body.getString("jwt.error.code").isBlank(),
                    "jwt.error.code should not be blank for cross-realm token");
            assertTrue(body.containsKey("jwt.error.category"),
                    "jwt.error.category should be present for invalid signature");
            assertNotEquals("EXTRACTION_ERROR", body.getString("jwt.error.category"),
                    "Cross-realm token should trigger a validation error, not extraction error");
        }
    }

    // ── Missing Authorization ──────────────────────────────────────────

    @Nested
    @DisplayName("Missing Authorization Tests")
    class MissingAuthorizationTests {

        @Test
        @DisplayName("should return 401 with authorization failure for token missing required 'read' role")
        void shouldReturn401ForTokenMissingRequiredRole() throws Exception {
            // limitedUser has only 'user' role — missing 'read' which is required
            String token = fetchKeycloakToken(HTTP_CLIENT,
                    KEYCLOAK_TOKEN_ENDPOINT, CLIENT_ID, CLIENT_SECRET, LIMITED_USER, PASSWORD);

            HttpResponse<String> response = sendToFlow("Bearer " + token);

            assertEquals(401, response.statusCode(),
                    "Token without 'read' role should return 401. Response: " + response.body());

            JsonObject body = parseJsonBody(response);
            assertNotNull(body, "Response body should contain JSON with jwt attributes");
            assertEquals("true", body.getString("jwt.present"),
                    "jwt.present should be 'true' — token was present but unauthorized");
            assertEquals("false", body.getString("jwt.authorized"),
                    "jwt.authorized should be 'false' for missing required role");
            assertTrue(body.containsKey("jwt.subject"),
                    "jwt.subject should be present for a valid but unauthorized token");
            assertFalse(body.getString("jwt.roles", "").contains("read"),
                    "jwt.roles should NOT contain 'read'. Actual: " + body.getString("jwt.roles", ""));
        }
    }

    // ── No Token ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("No Token Tests")
    class NoTokenTests {

        @Test
        @DisplayName("should return 401 with EXTRACTION_ERROR when no Authorization header is present")
        void shouldReturn401WhenNoAuthorizationHeader() throws Exception {
            HttpResponse<String> response = sendToFlow(null);

            assertEquals(401, response.statusCode(),
                    "Request without Authorization header should return 401. Response: " + response.body());

            JsonObject body = parseJsonBody(response);
            assertNotNull(body, "Response body should contain JSON with jwt attributes");
            assertEquals("EXTRACTION_ERROR", body.getString("jwt.error.category"),
                    "jwt.error.category should be 'EXTRACTION_ERROR' when no token provided");
            assertEquals("AUTH-001", body.getString("jwt.error.code"),
                    "jwt.error.code should be 'AUTH-001' for missing token");
        }

        @Test
        @DisplayName("should return 401 with error attributes for malformed token")
        void shouldReturn401ForMalformedToken() throws Exception {
            HttpResponse<String> response = sendToFlow("Bearer not-a-valid-jwt");

            assertEquals(401, response.statusCode(),
                    "Malformed token should return 401. Response: " + response.body());

            JsonObject body = parseJsonBody(response);
            assertNotNull(body, "Response body should contain JSON with jwt attributes");
            assertTrue(body.containsKey("jwt.error.code"),
                    "jwt.error.code should be present for malformed token");
            assertFalse(body.getString("jwt.error.code").isBlank(),
                    "jwt.error.code should not be blank for malformed token");
            assertTrue(body.containsKey("jwt.error.category"),
                    "jwt.error.category should be present for malformed token");
            assertFalse(body.getString("jwt.error.category").isBlank(),
                    "jwt.error.category should not be blank for malformed token");
        }
    }

    // ── Helper methods ─────────────────────────────────────────────────

    private static HttpResponse<String> sendToFlow(@Nullable String authorizationHeader) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(FLOW_ENDPOINT))
                .GET()
                .timeout(Duration.ofSeconds(30));

        if (authorizationHeader != null) {
            builder.header("Authorization", authorizationHeader);
        }

        return HTTP_CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    /**
     * Parses the HTTP response body as a JSON object containing jwt.* attributes.
     * Returns null if the body is empty or not valid JSON.
     */
    @Nullable
    static JsonObject parseJsonBody(HttpResponse<String> response) {
        String body = response.body();
        if (body == null || body.isBlank()) {
            return null;
        }
        try {
            return Json.createReader(new StringReader(body)).readObject();
        } catch (Exception e) {
            fail("Failed to parse response body as JSON: " + body);
            return null; // unreachable
        }
    }
}
