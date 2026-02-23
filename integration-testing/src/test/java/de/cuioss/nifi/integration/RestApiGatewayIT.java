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

import io.restassured.builder.RequestSpecBuilder;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import org.jspecify.annotations.NullMarked;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.net.http.HttpClient;
import java.time.Duration;

import static de.cuioss.nifi.integration.IntegrationTestSupport.*;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

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
 *   <li>{@code /api/admin} — GET only (requires ADMIN role)</li>
 *   <li>{@code /api/validated} — POST only (JSON Schema validated)</li>
 *   <li>{@code /metrics} — GET only (management, API key required)</li>
 * </ul>
 *
 * <p>Requires Docker containers to be running (NiFi on port 9443, Keycloak on 9080).
 * Activated via the {@code integration-tests} Maven profile.
 */
@NullMarked
@DisplayName("RestApiGateway Integration Tests")
class RestApiGatewayIT {

    private static RequestSpecification authSpec;
    private static RequestSpecification noAuthSpec;
    private static RequestSpecification apiKeySpec;

    @BeforeAll
    static void setUp() throws Exception {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        waitForEndpoint(httpClient, GATEWAY_BASE + "/api/health", Duration.ofSeconds(120));

        String token = fetchKeycloakToken(httpClient,
                KEYCLOAK_TOKEN_ENDPOINT, CLIENT_ID, CLIENT_SECRET, TEST_USER, PASSWORD);

        authSpec = new RequestSpecBuilder()
                .setBaseUri(GATEWAY_BASE)
                .addHeader("Authorization", "Bearer " + token)
                .setContentType(ContentType.JSON)
                .build();

        noAuthSpec = new RequestSpecBuilder()
                .setBaseUri(GATEWAY_BASE)
                .build();

        apiKeySpec = new RequestSpecBuilder()
                .setBaseUri(GATEWAY_BASE)
                .addHeader("X-Api-Key", MANAGEMENT_API_KEY)
                .build();
    }

    // ── Health Endpoint ─────────────────────────────────────────────────

    @Nested
    @DisplayName("Health Endpoint")
    class HealthEndpointTests {

        @Test
        @DisplayName("should return 200 OK for GET /api/health with valid JWT")
        void shouldAcceptHealthRequestWithValidJwt() {
            given().spec(authSpec)
                    .when()
                    .get("/api/health")
                    .then()
                    .statusCode(200)
                    .body(not(emptyString()));
        }

        @Test
        @DisplayName("should return 401 for GET /api/health without JWT")
        void shouldRejectHealthRequestWithoutJwt() {
            given().spec(noAuthSpec)
                    .when()
                    .get("/api/health")
                    .then()
                    .statusCode(401)
                    .header("WWW-Authenticate", notNullValue());
        }

        @Test
        @DisplayName("should return 401 with RFC 9457 problem detail for invalid JWT")
        void shouldRejectHealthRequestWithInvalidJwt() {
            given().spec(noAuthSpec)
                    .header("Authorization", "Bearer not-a-valid-jwt")
                    .when()
                    .get("/api/health")
                    .then()
                    .statusCode(401)
                    .contentType(containsString("application/problem+json"))
                    .body("type", notNullValue())
                    .body("status", notNullValue());
        }
    }

    // ── Data Endpoint ───────────────────────────────────────────────────

    @Nested
    @DisplayName("Data Endpoint")
    class DataEndpointTests {

        @Test
        @DisplayName("should return 200 OK for GET /api/data with valid JWT")
        void shouldAcceptDataGetWithValidJwt() {
            given().spec(authSpec)
                    .when()
                    .get("/api/data")
                    .then()
                    .statusCode(200)
                    .body(not(emptyString()));
        }

        @Test
        @DisplayName("should return 202 Accepted for POST /api/data with valid JWT and body")
        void shouldAcceptDataPostWithValidJwt() {
            given().spec(authSpec)
                    .body("{\"key\": \"value\"}")
                    .when()
                    .post("/api/data")
                    .then()
                    .statusCode(202)
                    .body(not(emptyString()));
        }

        @Test
        @DisplayName("should return 401 for GET /api/data without JWT")
        void shouldReturn401ForDataGetWithoutJwt() {
            given().spec(noAuthSpec)
                    .when()
                    .get("/api/data")
                    .then()
                    .statusCode(401);
        }

        @Test
        @DisplayName("should return 401 for GET /api/data with malformed JWT")
        void shouldReturn401ForDataGetWithInvalidJwt() {
            given().spec(noAuthSpec)
                    .header("Authorization", "Bearer not-a-valid-jwt")
                    .when()
                    .get("/api/data")
                    .then()
                    .statusCode(401);
        }

        @Test
        @DisplayName("should return 401 for POST /api/data without JWT")
        void shouldReturn401ForDataPostWithoutJwt() {
            given().spec(noAuthSpec)
                    .contentType(ContentType.JSON)
                    .body("{\"key\": \"value\"}")
                    .when()
                    .post("/api/data")
                    .then()
                    .statusCode(401);
        }
    }

    // ── Management Endpoints ────────────────────────────────────────────

    @Nested
    @DisplayName("Management Endpoints")
    class ManagementEndpointTests {

        @Test
        @DisplayName("should return 200 with Prometheus metrics for GET /metrics with API key")
        void shouldReturnPrometheusMetrics() {
            given().spec(apiKeySpec)
                    .when()
                    .get("/metrics")
                    .then()
                    .statusCode(200)
                    .contentType(containsString("text/plain"))
                    .body(containsString("nifi_jwt_validations_total"))
                    .body(containsString("nifi_gateway_events_total"));
        }

        @Test
        @DisplayName("should return 200 with JSON metrics when Accept: application/json")
        void shouldReturnJsonMetrics() {
            given().spec(apiKeySpec)
                    .accept(ContentType.JSON)
                    .when()
                    .get("/metrics")
                    .then()
                    .statusCode(200)
                    .contentType(containsString("application/json"))
                    .body("tokenValidation", notNullValue())
                    .body("gatewayEvents", notNullValue());
        }

        @Test
        @DisplayName("should return 405 for POST on /metrics")
        void shouldReturn405ForPostOnMetrics() {
            given().spec(apiKeySpec)
                    .when()
                    .post("/metrics")
                    .then()
                    .statusCode(405);
        }

        @Test
        @DisplayName("should return 401 for GET /metrics without API key")
        void shouldReturn401ForMetricsWithoutApiKey() {
            given().spec(noAuthSpec)
                    .when()
                    .get("/metrics")
                    .then()
                    .statusCode(401);
        }

        @Test
        @DisplayName("should return 401 for GET /metrics with wrong API key")
        void shouldReturn401ForMetricsWithWrongApiKey() {
            given().spec(noAuthSpec)
                    .header("X-Api-Key", "wrong-api-key")
                    .when()
                    .get("/metrics")
                    .then()
                    .statusCode(401);
        }
    }

    // ── Error Handling ──────────────────────────────────────────────────

    @Nested
    @DisplayName("Error Handling")
    class ErrorHandlingTests {

        @Test
        @DisplayName("should return 404 for non-existent route")
        void shouldReturn404ForUnknownRoute() {
            given().spec(authSpec)
                    .when()
                    .get("/api/nonexistent")
                    .then()
                    .statusCode(404);
        }

        @Test
        @DisplayName("should return 404 for disabled route")
        void disabledRouteReturns404() {
            given().spec(authSpec)
                    .when()
                    .get("/api/disabled")
                    .then()
                    .statusCode(404);
        }

        @Test
        @DisplayName("should return 405 for unsupported HTTP method on /api/health")
        void shouldReturn405ForPostOnHealth() {
            given().spec(authSpec)
                    .when()
                    .post("/api/health")
                    .then()
                    .statusCode(405);
        }

        @Test
        @DisplayName("should return 405 for DELETE on /api/data")
        void shouldReturn405ForDeleteOnData() {
            given().spec(authSpec)
                    .when()
                    .delete("/api/data")
                    .then()
                    .statusCode(405);
        }

        @Test
        @DisplayName("should return 401 for token signed by different realm")
        void shouldReturn401ForTokenFromWrongRealm() throws Exception {
            HttpClient httpClient = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();
            String otherToken = fetchKeycloakToken(httpClient,
                    OTHER_REALM_TOKEN_ENDPOINT, OTHER_CLIENT_ID, OTHER_CLIENT_SECRET,
                    OTHER_USER, PASSWORD);

            given().spec(noAuthSpec)
                    .header("Authorization", "Bearer " + otherToken)
                    .when()
                    .get("/api/health")
                    .then()
                    .statusCode(401);
        }

        @Test
        @DisplayName("should return 413 for oversized request body")
        void shouldReturn413ForOversizedBody() {
            // Create a body larger than 1MB (max request size = 1048576 bytes)
            String oversizedBody = "x".repeat(1_048_577);

            given().spec(authSpec)
                    .contentType(ContentType.JSON)
                    .body(oversizedBody)
                    .when()
                    .post("/api/data")
                    .then()
                    .statusCode(413);
        }
    }

    // ── Authorization Tests ──────────────────────────────────────────────

    @Nested
    @DisplayName("Authorization")
    class AuthorizationTests {

        @Test
        @DisplayName("should return 403 when token lacks required ADMIN role")
        void shouldReturn403WhenTokenLacksRequiredRole() {
            // testUser has 'read' role but NOT 'ADMIN' role
            given().spec(authSpec)
                    .when()
                    .get("/api/admin")
                    .then()
                    .statusCode(403)
                    .contentType(containsString("application/problem+json"));
        }
    }

    // ── Schema Validation Tests ──────────────────────────────────────────

    @Nested
    @DisplayName("Schema Validation")
    class SchemaValidationTests {

        @Test
        @DisplayName("should return 202 for POST /api/validated with valid body")
        void shouldAcceptValidBody() {
            given().spec(authSpec)
                    .body("{\"name\": \"Alice\", \"age\": 30}")
                    .when()
                    .post("/api/validated")
                    .then()
                    .statusCode(202);
        }

        @Test
        @DisplayName("should return 422 for POST /api/validated with missing required field")
        void shouldReject422ForMissingRequiredField() {
            given().spec(authSpec)
                    .body("{\"age\": 25}")
                    .when()
                    .post("/api/validated")
                    .then()
                    .statusCode(422)
                    .contentType(containsString("application/problem+json"))
                    .body("title", equalTo("Unprocessable Content"))
                    .body("status", equalTo(422))
                    .body("violations", notNullValue())
                    .body("violations.size()", greaterThanOrEqualTo(1));
        }

        @Test
        @DisplayName("should return 422 for POST /api/validated with wrong field type")
        void shouldReject422ForWrongFieldType() {
            given().spec(authSpec)
                    .body("{\"name\": \"Alice\", \"age\": \"not-a-number\"}")
                    .when()
                    .post("/api/validated")
                    .then()
                    .statusCode(422)
                    .contentType(containsString("application/problem+json"))
                    .body("violations", notNullValue());
        }

        @Test
        @DisplayName("should return 422 with violations array containing pointer and message")
        void shouldReturnViolationsArrayWithPointerAndMessage() {
            given().spec(authSpec)
                    .body("{\"age\": 25}")
                    .when()
                    .post("/api/validated")
                    .then()
                    .statusCode(422)
                    .body("violations[0].pointer", notNullValue())
                    .body("violations[0].message", notNullValue());
        }
    }

    // ── CORS Tests ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("CORS")
    class CorsTests {

        @Test
        @DisplayName("should return 204 for preflight with allowed origin")
        void shouldReturn204ForPreflightWithAllowedOrigin() {
            given().spec(noAuthSpec)
                    .header("Origin", "http://localhost:3000")
                    .header("Access-Control-Request-Method", "GET")
                    .when()
                    .options("/api/health")
                    .then()
                    .statusCode(204)
                    .header("Access-Control-Allow-Origin", notNullValue());
        }

        @Test
        @DisplayName("should include CORS headers for allowed origin")
        void shouldIncludeCorsHeadersForAllowedOrigin() {
            given().spec(authSpec)
                    .header("Origin", "http://localhost:3000")
                    .when()
                    .get("/api/health")
                    .then()
                    .statusCode(200)
                    .header("Access-Control-Allow-Origin", notNullValue());
        }

        @Test
        @DisplayName("should not include CORS headers for disallowed origin")
        void shouldNotIncludeCorsHeadersForDisallowedOrigin() {
            given().spec(authSpec)
                    .header("Origin", "http://evil.com")
                    .when()
                    .get("/api/health")
                    .then()
                    .statusCode(200)
                    .header("Access-Control-Allow-Origin", nullValue());
        }
    }
}
