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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
 *   <li>{@code /api/health} — GET only (authenticated)</li>
 *   <li>{@code /api/data} — GET and POST (authenticated)</li>
 *   <li>{@code /metrics} — GET only (management, no auth required)</li>
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
    private static final String ADMIN_ENDPOINT = GATEWAY_BASE + "/api/admin";
    private static final String METRICS_ENDPOINT = GATEWAY_BASE + "/metrics";
    private static final String MANAGEMENT_API_KEY = "integration-test-api-key";


    private static final String KEYCLOAK_TOKEN_ENDPOINT =
            "http://localhost:9080/realms/oauth_integration_tests/protocol/openid-connect/token";
    private static final String CLIENT_ID = "test_client";
    private static final String CLIENT_SECRET = "yTKslWLtf4giJcWCaoVJ20H8sy6STexM";
    private static final String TEST_USER = "testUser";
    private static final String PASSWORD = "drowssap";

    // Credentials for other_realm (different RSA key pair — signature testing)
    private static final String OTHER_REALM_TOKEN_ENDPOINT =
            "http://localhost:9080/realms/other_realm/protocol/openid-connect/token";
    private static final String OTHER_CLIENT_ID = "other_client";
    private static final String OTHER_CLIENT_SECRET = "otherClientSecretValue123456789";
    private static final String OTHER_USER = "otherUser";

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
        @DisplayName("should return 200 OK for GET /api/health with valid JWT")
        void shouldAcceptHealthRequestWithValidJwt() throws Exception {
            String token = fetchToken();

            HttpResponse<String> response = sendGet(HEALTH_ENDPOINT, token);

            assertEquals(200, response.statusCode(),
                    "GET /api/health with valid JWT should return 200. Response: " + response.body());
            assertTrue(response.body() != null && !response.body().isEmpty(),
                    "Health endpoint should return a non-empty body");
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
        @DisplayName("should return 200 OK for GET /api/data with valid JWT")
        void shouldAcceptDataGetWithValidJwt() throws Exception {
            String token = fetchToken();

            HttpResponse<String> response = sendGet(DATA_ENDPOINT, token);

            assertEquals(200, response.statusCode(),
                    "GET /api/data with valid JWT should return 200. Response: " + response.body());
            assertTrue(response.body() != null && !response.body().isEmpty(),
                    "Data GET endpoint should return a non-empty body");
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
            assertTrue(response.body() != null && !response.body().isEmpty(),
                    "Data POST endpoint should return a non-empty body");
        }

        @Test
        @DisplayName("should return 401 for GET /api/data without JWT")
        void shouldReturn401ForDataGetWithoutJwt() throws Exception {
            HttpResponse<String> response = sendGetWithoutAuth(DATA_ENDPOINT);

            assertEquals(401, response.statusCode(),
                    "GET /api/data without JWT should return 401. Response: " + response.body());
        }

        @Test
        @DisplayName("should return 401 for GET /api/data with malformed JWT")
        void shouldReturn401ForDataGetWithInvalidJwt() throws Exception {
            HttpResponse<String> response = sendGet(DATA_ENDPOINT, "not-a-valid-jwt");

            assertEquals(401, response.statusCode(),
                    "GET /api/data with invalid JWT should return 401. Response: " + response.body());
        }

        @Test
        @DisplayName("should return 401 for POST /api/data without JWT")
        void shouldReturn401ForDataPostWithoutJwt() throws Exception {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(DATA_ENDPOINT))
                    .POST(HttpRequest.BodyPublishers.ofString("{\"key\": \"value\"}"))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            assertEquals(401, response.statusCode(),
                    "POST /api/data without JWT should return 401. Response: " + response.body());
        }
    }

    // ── Management Endpoints ────────────────────────────────────────────

    @Nested
    @DisplayName("Management Endpoints")
    class ManagementEndpointTests {

        @Test
        @DisplayName("should return 200 with Prometheus metrics for GET /metrics with API key")
        void shouldReturnPrometheusMetrics() throws Exception {
            HttpResponse<String> response = sendGetWithApiKey(METRICS_ENDPOINT);

            assertEquals(200, response.statusCode(),
                    "GET /metrics should return 200. Response: " + response.body());

            String contentType = response.headers().firstValue("Content-Type").orElse("");
            assertTrue(contentType.contains("text/plain"),
                    "Default /metrics Content-Type should be text/plain (Prometheus). Actual: " + contentType);
            assertTrue(response.body().contains("nifi_jwt_validations_total"),
                    "/metrics should contain token validation metrics");
            assertTrue(response.body().contains("nifi_gateway_events_total"),
                    "/metrics should contain gateway event metrics");
        }

        @Test
        @DisplayName("should return 200 with JSON metrics when Accept: application/json")
        void shouldReturnJsonMetrics() throws Exception {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(METRICS_ENDPOINT))
                    .GET()
                    .header("Accept", "application/json")
                    .header("X-Api-Key", MANAGEMENT_API_KEY)
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode(),
                    "GET /metrics with Accept: application/json should return 200. Response: " + response.body());

            String contentType = response.headers().firstValue("Content-Type").orElse("");
            assertTrue(contentType.contains("application/json"),
                    "Content-Type should be application/json. Actual: " + contentType);

            JsonObject metrics = Json.createReader(new StringReader(response.body())).readObject();
            assertTrue(metrics.containsKey("tokenValidation"),
                    "JSON metrics should contain 'tokenValidation' section");
            assertTrue(metrics.containsKey("gatewayEvents"),
                    "JSON metrics should contain 'gatewayEvents' section");
        }

        @Test
        @DisplayName("should return 405 for POST on /metrics")
        void shouldReturn405ForPostOnMetrics() throws Exception {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(METRICS_ENDPOINT))
                    .POST(HttpRequest.BodyPublishers.ofString(""))
                    .header("X-Api-Key", MANAGEMENT_API_KEY)
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            assertEquals(405, response.statusCode(),
                    "POST to /metrics should return 405. Response: " + response.body());
        }

        @Test
        @DisplayName("should return 401 for GET /metrics without API key")
        void shouldReturn401ForMetricsWithoutApiKey() throws Exception {
            HttpResponse<String> response = sendGetWithoutAuth(METRICS_ENDPOINT);

            assertEquals(401, response.statusCode(),
                    "GET /metrics without API key should return 401. Response: " + response.body());
        }

        @Test
        @DisplayName("should return 401 for GET /metrics with wrong API key")
        void shouldReturn401ForMetricsWithWrongApiKey() throws Exception {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(METRICS_ENDPOINT))
                    .GET()
                    .header("X-Api-Key", "wrong-api-key")
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            assertEquals(401, response.statusCode(),
                    "GET /metrics with wrong API key should return 401. Response: " + response.body());
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
        void shouldReturn405ForPostOnHealth() throws Exception {
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

        @Test
        @DisplayName("should return 405 for DELETE on /api/data")
        void shouldReturn405ForDeleteOnData() throws Exception {
            String token = fetchToken();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(DATA_ENDPOINT))
                    .DELETE()
                    .header("Authorization", "Bearer " + token)
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            assertEquals(405, response.statusCode(),
                    "DELETE on /api/data should return 405. Response: " + response.body());
        }

        @Test
        @DisplayName("should return 401 for token signed by different realm")
        void shouldReturn401ForTokenFromWrongRealm() throws Exception {
            String otherToken = IntegrationTestSupport.fetchKeycloakToken(HTTP_CLIENT,
                    OTHER_REALM_TOKEN_ENDPOINT, OTHER_CLIENT_ID, OTHER_CLIENT_SECRET,
                    OTHER_USER, PASSWORD);

            HttpResponse<String> response = sendGet(HEALTH_ENDPOINT, otherToken);

            assertEquals(401, response.statusCode(),
                    "Token from other_realm should return 401 (different RSA key pair). Response: " + response.body());
        }

        @Test
        @DisplayName("should return 413 for oversized request body")
        void shouldReturn413ForOversizedBody() throws Exception {
            String token = fetchToken();

            // Create a body larger than 1MB (max request size = 1048576 bytes)
            String oversizedBody = "x".repeat(1_048_577);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(DATA_ENDPOINT))
                    .POST(HttpRequest.BodyPublishers.ofString(oversizedBody))
                    .header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            assertEquals(413, response.statusCode(),
                    "POST with body > 1MB should return 413. Response: " + response.body());
        }
    }

    // ── Authorization Tests ──────────────────────────────────────────────

    @Nested
    @DisplayName("Authorization")
    class AuthorizationTests {

        @Test
        @DisplayName("should return 403 when token lacks required ADMIN role")
        void shouldReturn403WhenTokenLacksRequiredRole() throws Exception {
            // testUser has 'read' role but NOT 'ADMIN' role
            String token = fetchToken();

            HttpResponse<String> response = sendGet(ADMIN_ENDPOINT, token);

            assertEquals(403, response.statusCode(),
                    "GET /api/admin without ADMIN role should return 403. Response: " + response.body());

            String contentType = response.headers().firstValue("Content-Type").orElse("");
            assertTrue(contentType.contains("application/problem+json"),
                    "403 response Content-Type should be application/problem+json. Actual: " + contentType);
        }
    }

    // ── CORS Tests ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("CORS")
    class CorsTests {

        @Test
        @DisplayName("should return 204 for preflight with allowed origin")
        void shouldReturn204ForPreflightWithAllowedOrigin() throws Exception {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(HEALTH_ENDPOINT))
                    .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                    .header("Origin", "http://localhost:3000")
                    .header("Access-Control-Request-Method", "GET")
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            assertEquals(204, response.statusCode(),
                    "OPTIONS preflight should return 204. Response: " + response.body());
            assertTrue(response.headers().firstValue("Access-Control-Allow-Origin").isPresent(),
                    "Preflight response should include Access-Control-Allow-Origin");
        }

        @Test
        @DisplayName("should include CORS headers for allowed origin")
        void shouldIncludeCorsHeadersForAllowedOrigin() throws Exception {
            String token = fetchToken();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(HEALTH_ENDPOINT))
                    .GET()
                    .header("Authorization", "Bearer " + token)
                    .header("Origin", "http://localhost:3000")
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode(),
                    "GET /api/health with allowed origin should return 200. Response: " + response.body());
            assertTrue(response.headers().firstValue("Access-Control-Allow-Origin").isPresent(),
                    "Response should include Access-Control-Allow-Origin for allowed origin");
        }

        @Test
        @DisplayName("should not include CORS headers for disallowed origin")
        void shouldNotIncludeCorsHeadersForDisallowedOrigin() throws Exception {
            String token = fetchToken();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(HEALTH_ENDPOINT))
                    .GET()
                    .header("Authorization", "Bearer " + token)
                    .header("Origin", "http://evil.com")
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode(),
                    "GET /api/health with disallowed origin should still return 200. Response: " + response.body());
            assertTrue(response.headers().firstValue("Access-Control-Allow-Origin").isEmpty(),
                    "Response should NOT include Access-Control-Allow-Origin for disallowed origin");
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

    private static HttpResponse<String> sendGetWithoutAuth(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .timeout(Duration.ofSeconds(10))
                .build();

        return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private static HttpResponse<String> sendGetWithApiKey(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .header("X-Api-Key", MANAGEMENT_API_KEY)
                .timeout(Duration.ofSeconds(10))
                .build();

        return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
