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
import io.restassured.config.RestAssuredConfig;
import io.restassured.config.SSLConfig;
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
 * <p>Tests send HTTPS requests directly to the RestApiGateway on port 9443,
 * which handles JWT authentication internally via the shared
 * {@code JwtIssuerConfigService} controller service. Unlike the NiFi flow
 * pipeline (port 7777), the gateway sends HTTPS responses directly — no
 * HandleHttpResponse processor involved.
 *
 * <p>Routes configured in flow.json:
 * <ul>
 *   <li>{@code /api/data} — GET and POST (authenticated)</li>
 *   <li>{@code /api/admin} — GET only (requires ADMIN role)</li>
 *   <li>{@code /api/validated} — POST only (JSON Schema validated via file path)</li>
 *   <li>{@code /api/inline-validated} — POST only (JSON Schema validated via inline JSON)</li>
 *   <li>{@code /metrics} — GET only (management, loopback or JWT auth)</li>
 *   <li>{@code /health} — GET only (management, loopback or JWT auth)</li>
 * </ul>
 *
 * <p>Requires Docker containers to be running (NiFi HTTPS on port 9443, Keycloak on 9080).
 * Activated via the {@code integration-tests} Maven profile.
 */
@NullMarked
@DisplayName("RestApiGateway Integration Tests")
class RestApiGatewayIT {

    private static RequestSpecification authSpec;
    private static RequestSpecification noAuthSpec;

    @BeforeAll
    static void setUp() throws Exception {
        HttpClient httpClient = HttpClient.newBuilder()
                .sslContext(createSslContext())
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        waitForEndpoint(httpClient, GATEWAY_BASE + "/api/data", Duration.ofSeconds(120));

        String token = fetchKeycloakToken(httpClient,
                KEYCLOAK_TOKEN_ENDPOINT, CLIENT_ID, null, TEST_USER, PASSWORD);

        var sslConfig = RestAssuredConfig.config()
                .sslConfig(SSLConfig.sslConfig().trustStore(
                        "src/main/docker/certificates/truststore.p12",
                        "password"));

        authSpec = new RequestSpecBuilder()
                .setBaseUri(GATEWAY_BASE)
                .setConfig(sslConfig)
                .addHeader("Authorization", "Bearer " + token)
                .setContentType(ContentType.JSON)
                .build();

        noAuthSpec = new RequestSpecBuilder()
                .setBaseUri(GATEWAY_BASE)
                .setConfig(sslConfig)
                .build();
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
        @DisplayName("should return 202 Accepted for POST /api/data with traceId and Location header")
        void shouldAcceptDataPostWithValidJwt() {
            given().spec(authSpec)
                    .body("{\"key\": \"value\"}")
                    .when()
                    .post("/api/data")
                    .then()
                    .statusCode(202)
                    .header("Location", containsString("/status/"))
                    .body("status", equalTo("accepted"))
                    .body("traceId", notNullValue())
                    .body("_links.status.href", startsWith("/status/"));
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

        // Note: integration tests connect from the host through Docker port forwarding,
        // so the gateway sees the Docker bridge IP — loopback bypass does NOT apply.
        // All management tests must use JWT Bearer auth.

        @Test
        @DisplayName("should return 200 with Prometheus metrics via JWT Bearer auth")
        void shouldReturnPrometheusMetrics() {
            given().spec(authSpec)
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
            given().spec(authSpec)
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
            given().spec(authSpec)
                    .when()
                    .post("/metrics")
                    .then()
                    .statusCode(405);
        }

        @Test
        @DisplayName("should return 401 for GET /metrics without auth")
        void shouldReturn401ForMetricsWithoutAuth() {
            given().spec(noAuthSpec)
                    .when()
                    .get("/metrics")
                    .then()
                    .statusCode(401);
        }

        @Test
        @DisplayName("should return 401 for GET /metrics with invalid JWT")
        void shouldReturn401ForMetricsWithInvalidJwt() {
            given().spec(noAuthSpec)
                    .header("Authorization", "Bearer not-a-valid-jwt")
                    .when()
                    .get("/metrics")
                    .then()
                    .statusCode(401);
        }

        @Test
        @DisplayName("should return 200 for GET /health via JWT Bearer auth")
        void shouldReturnHealthWithBearerToken() {
            given().spec(authSpec)
                    .when()
                    .get("/health")
                    .then()
                    .statusCode(200)
                    .contentType(containsString("application/json"))
                    .body("status", equalTo("UP"))
                    .body("timestamp", notNullValue());
        }

        @Test
        @DisplayName("should return 405 for POST on /health")
        void shouldReturn405ForPostOnHealth() {
            given().spec(authSpec)
                    .when()
                    .post("/health")
                    .then()
                    .statusCode(405);
        }

        @Test
        @DisplayName("should return 401 for GET /health without auth")
        void shouldReturn401ForHealthWithoutAuth() {
            given().spec(noAuthSpec)
                    .when()
                    .get("/health")
                    .then()
                    .statusCode(401);
        }
    }

    // ── Request Tracking ──────────────────────────────────────────────────

    @Nested
    @DisplayName("Request Tracking")
    class RequestTrackingTests {

        @Test
        @DisplayName("should return ACCEPTED status when polling with traceId from POST")
        void shouldReturnAcceptedStatusForTrackedRequest() {
            // Submit a tracked request
            String traceId = given().spec(authSpec)
                    .body("{\"key\": \"value\"}")
                    .when()
                    .post("/api/data")
                    .then()
                    .statusCode(202)
                    .extract()
                    .path("traceId");

            // Poll for status
            given().spec(authSpec)
                    .when()
                    .get("/status/" + traceId)
                    .then()
                    .statusCode(200)
                    .contentType(containsString("application/json"))
                    .body("traceId", equalTo(traceId))
                    .body("status", equalTo("ACCEPTED"))
                    .body("acceptedAt", notNullValue())
                    .body("updatedAt", notNullValue());
        }

        @Test
        @DisplayName("should return 404 for unknown traceId")
        void shouldReturn404ForUnknownTraceId() {
            given().spec(authSpec)
                    .when()
                    .get("/status/00000000-0000-0000-0000-000000000000")
                    .then()
                    .statusCode(404)
                    .contentType(containsString("application/problem+json"))
                    .body("title", equalTo("Not Found"))
                    .body("status", equalTo(404));
        }

        @Test
        @DisplayName("should return 400 for invalid UUID format")
        void shouldReturn400ForInvalidUuid() {
            given().spec(authSpec)
                    .when()
                    .get("/status/not-a-uuid")
                    .then()
                    .statusCode(400)
                    .contentType(containsString("application/problem+json"))
                    .body("title", equalTo("Bad Request"));
        }

        @Test
        @DisplayName("should return 400 for missing traceId in status path")
        void shouldReturn400ForMissingTraceId() {
            given().spec(authSpec)
                    .when()
                    .get("/status/")
                    .then()
                    .statusCode(400);
        }

        @Test
        @DisplayName("should return 401 for status endpoint without auth")
        void shouldReturn401ForStatusWithoutAuth() {
            given().spec(noAuthSpec)
                    .when()
                    .get("/status/00000000-0000-0000-0000-000000000000")
                    .then()
                    .statusCode(401);
        }

        @Test
        @DisplayName("should include parentTraceId when X-Parent-Trace-Id header is provided")
        void shouldIncludeParentTraceIdWhenHeaderProvided() {
            // First request to get a traceId
            String parentTraceId = given().spec(authSpec)
                    .body("{\"key\": \"parent\"}")
                    .when()
                    .post("/api/data")
                    .then()
                    .statusCode(202)
                    .extract()
                    .path("traceId");

            // Second request with parent trace header
            String childTraceId = given().spec(authSpec)
                    .header("X-Parent-Trace-Id", parentTraceId)
                    .body("{\"key\": \"child\"}")
                    .when()
                    .post("/api/data")
                    .then()
                    .statusCode(202)
                    .extract()
                    .path("traceId");

            // Verify child status includes parentTraceId
            given().spec(authSpec)
                    .when()
                    .get("/status/" + childTraceId)
                    .then()
                    .statusCode(200)
                    .body("traceId", equalTo(childTraceId))
                    .body("parentTraceId", equalTo(parentTraceId));
        }

        @Test
        @DisplayName("should return 200 OK for GET on tracked route (no tracking for GET)")
        void shouldReturn200ForGetOnTrackedRoute() {
            given().spec(authSpec)
                    .when()
                    .get("/api/data")
                    .then()
                    .statusCode(200)
                    .body(not(containsString("traceId")));
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
        @DisplayName("should return 404 for removed /api/health route")
        void shouldReturn404ForRemovedHealthRoute() {
            given().spec(authSpec)
                    .when()
                    .get("/api/health")
                    .then()
                    .statusCode(404);
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
                    .sslContext(createSslContext())
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();
            String otherToken = fetchKeycloakToken(httpClient,
                    OTHER_REALM_TOKEN_ENDPOINT, OTHER_CLIENT_ID, OTHER_CLIENT_SECRET,
                    OTHER_USER, PASSWORD);

            given().spec(noAuthSpec)
                    .header("Authorization", "Bearer " + otherToken)
                    .when()
                    .get("/api/data")
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

        @Test
        @DisplayName("should return 422 for POST /api/validated with empty body")
        void shouldReject422ForEmptyBody() {
            given().spec(authSpec)
                    .contentType(ContentType.JSON)
                    .when()
                    .post("/api/validated")
                    .then()
                    .statusCode(422)
                    .contentType(containsString("application/problem+json"));
        }

        @Test
        @DisplayName("should return 422 for POST /api/validated with malformed JSON")
        void shouldReject422ForMalformedJson() {
            given().spec(authSpec)
                    .body("not valid json {{{")
                    .when()
                    .post("/api/validated")
                    .then()
                    .statusCode(422)
                    .contentType(containsString("application/problem+json"))
                    .body("violations", notNullValue())
                    .body("violations.size()", greaterThanOrEqualTo(1));
        }

        @Test
        @DisplayName("should return 422 for POST /api/validated with additional properties")
        void shouldReject422ForAdditionalProperties() {
            given().spec(authSpec)
                    .body("{\"name\": \"Alice\", \"extra\": true}")
                    .when()
                    .post("/api/validated")
                    .then()
                    .statusCode(422)
                    .contentType(containsString("application/problem+json"))
                    .body("violations", notNullValue());
        }

        @Test
        @DisplayName("should return 405 for GET on /api/validated")
        void shouldReturn405ForGetOnValidated() {
            given().spec(authSpec)
                    .when()
                    .get("/api/validated")
                    .then()
                    .statusCode(405);
        }
    }

    // ── Inline Schema Validation Tests ─────────────────────────────────

    @Nested
    @DisplayName("Inline Schema Validation")
    class InlineSchemaValidationTests {

        @Test
        @DisplayName("should return 202 for POST /api/inline-validated with valid body")
        void shouldAcceptValidBodyOnInlineSchemaRoute() {
            given().spec(authSpec)
                    .body("{\"name\": \"Alice\"}")
                    .when()
                    .post("/api/inline-validated")
                    .then()
                    .statusCode(202);
        }

        @Test
        @DisplayName("should return 422 for POST /api/inline-validated with missing required field")
        void shouldReject422ForInvalidBodyOnInlineSchemaRoute() {
            given().spec(authSpec)
                    .body("{\"age\": 25}")
                    .when()
                    .post("/api/inline-validated")
                    .then()
                    .statusCode(422)
                    .contentType(containsString("application/problem+json"))
                    .body("title", equalTo("Unprocessable Content"))
                    .body("violations", notNullValue())
                    .body("violations.size()", greaterThanOrEqualTo(1));
        }
    }

}
