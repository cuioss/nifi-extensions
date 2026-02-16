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

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for the RestApiGateway processor with embedded Jetty.
 *
 * <p>Tests send HTTP requests directly to the RestApiGateway on port 9443,
 * which handles JWT authentication internally via the shared
 * {@code JwtIssuerConfigService} controller service. Unlike the NiFi flow
 * pipeline (port 7777), the gateway sends HTTP responses directly — no
 * HandleHttpResponse processor involved.
 *
 * <p>Routes configured in flow.json:
 * <ul>
 *   <li>{@code /api/health} — GET only</li>
 *   <li>{@code /api/data} — GET and POST</li>
 * </ul>
 *
 * <p>Requires Docker containers to be running (NiFi on port 9443, Keycloak on 9080).
 * Activated via the {@code integration-tests} Maven profile.
 */
@NullMarked
@DisplayName("RestApiGateway Integration Tests")
class RestApiGatewayIT {

    private static final String GATEWAY_BASE = "http://localhost:9443";
    private static final String HEALTH_ENDPOINT = GATEWAY_BASE + "/api/health";
    private static final String DATA_ENDPOINT = GATEWAY_BASE + "/api/data";

    private static final String KEYCLOAK_TOKEN_ENDPOINT =
            "http://localhost:9080/realms/oauth_integration_tests/protocol/openid-connect/token";
    private static final String CLIENT_ID = "test_client";
    private static final String CLIENT_SECRET = "yTKslWLtf4giJcWCaoVJ20H8sy6STexM";
    private static final String TEST_USER = "testUser";
    private static final String PASSWORD = "drowssap";

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @BeforeAll
    static void waitForGateway() throws Exception {
        IntegrationTestSupport.waitForEndpoint(HTTP_CLIENT, HEALTH_ENDPOINT, Duration.ofSeconds(120));
    }

    // ── Health Endpoint ─────────────────────────────────────────────────

    @Nested
    @DisplayName("Health Endpoint")
    class HealthEndpointTests {

        @Test
        @DisplayName("should return 202 Accepted for GET /api/health with valid JWT")
        void shouldAcceptHealthRequestWithValidJwt() throws Exception {
            String token = fetchToken();

            HttpResponse<String> response = sendGet(HEALTH_ENDPOINT, token);

            assertEquals(202, response.statusCode(),
                    "GET /api/health with valid JWT should return 202. Response: " + response.body());
        }

        @Test
        @DisplayName("should return 401 for GET /api/health without JWT")
        void shouldRejectHealthRequestWithoutJwt() throws Exception {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(HEALTH_ENDPOINT))
                    .GET()
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            assertEquals(401, response.statusCode(),
                    "GET /api/health without JWT should return 401. Response: " + response.body());
            assertTrue(response.headers().firstValue("WWW-Authenticate").isPresent(),
                    "401 response should include WWW-Authenticate header");
        }

        @Test
        @DisplayName("should return 401 with RFC 9457 problem detail for invalid JWT")
        void shouldRejectHealthRequestWithInvalidJwt() throws Exception {
            HttpResponse<String> response = sendGet(HEALTH_ENDPOINT, "not-a-valid-jwt");

            assertEquals(401, response.statusCode(),
                    "GET /api/health with invalid JWT should return 401. Response: " + response.body());

            // Verify RFC 9457 problem detail response
            String contentType = response.headers().firstValue("Content-Type").orElse("");
            assertTrue(contentType.contains("application/problem+json"),
                    "Content-Type should be application/problem+json. Actual: " + contentType);

            JsonObject problem = Json.createReader(new StringReader(response.body())).readObject();
            assertTrue(problem.containsKey("type"),
                    "RFC 9457 problem detail should contain 'type'");
            assertTrue(problem.containsKey("status"),
                    "RFC 9457 problem detail should contain 'status'");
        }
    }

    // ── Data Endpoint ───────────────────────────────────────────────────

    @Nested
    @DisplayName("Data Endpoint")
    class DataEndpointTests {

        @Test
        @DisplayName("should return 202 Accepted for GET /api/data with valid JWT")
        void shouldAcceptDataGetWithValidJwt() throws Exception {
            String token = fetchToken();

            HttpResponse<String> response = sendGet(DATA_ENDPOINT, token);

            assertEquals(202, response.statusCode(),
                    "GET /api/data with valid JWT should return 202. Response: " + response.body());
        }

        @Test
        @DisplayName("should return 202 Accepted for POST /api/data with valid JWT and body")
        void shouldAcceptDataPostWithValidJwt() throws Exception {
            String token = fetchToken();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(DATA_ENDPOINT))
                    .POST(HttpRequest.BodyPublishers.ofString("{\"key\": \"value\"}"))
                    .header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            assertEquals(202, response.statusCode(),
                    "POST /api/data with valid JWT should return 202. Response: " + response.body());
        }
    }

    // ── Error Handling ──────────────────────────────────────────────────

    @Nested
    @DisplayName("Error Handling")
    class ErrorHandlingTests {

        @Test
        @DisplayName("should return 404 for non-existent route")
        void shouldReturn404ForUnknownRoute() throws Exception {
            String token = fetchToken();

            HttpResponse<String> response = sendGet(GATEWAY_BASE + "/api/nonexistent", token);

            assertEquals(404, response.statusCode(),
                    "Request to non-existent route should return 404. Response: " + response.body());
        }

        @Test
        @DisplayName("should return 405 for unsupported HTTP method on /api/health")
        void shouldReturn405ForWrongMethod() throws Exception {
            String token = fetchToken();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(HEALTH_ENDPOINT))
                    .POST(HttpRequest.BodyPublishers.ofString(""))
                    .header("Authorization", "Bearer " + token)
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            assertEquals(405, response.statusCode(),
                    "POST to GET-only /api/health should return 405. Response: " + response.body());
        }
    }

    // ── Helper methods ──────────────────────────────────────────────────

    private static String fetchToken() throws Exception {
        return IntegrationTestSupport.fetchKeycloakToken(HTTP_CLIENT,
                KEYCLOAK_TOKEN_ENDPOINT, CLIENT_ID, CLIENT_SECRET, TEST_USER, PASSWORD);
    }

    private static HttpResponse<String> sendGet(String url, String token) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .header("Authorization", "Bearer " + token)
                .timeout(Duration.ofSeconds(10))
                .build();

        return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
