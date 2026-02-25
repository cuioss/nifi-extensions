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

import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import org.jspecify.annotations.NullMarked;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import javax.net.ssl.SSLContext;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

import static de.cuioss.nifi.integration.IntegrationTestSupport.*;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * Integration tests for the Custom UI WAR endpoints deployed inside NiFi.
 *
 * <p>The Custom UI WAR ({@code nifi-cuioss-ui}) is bundled inside the NAR and
 * auto-deployed by NiFi's Jetty. These tests verify that the servlet endpoints
 * are accessible and respond correctly when called with proper NiFi authentication
 * and the required {@code X-Processor-Id} header.
 *
 * <p>Authentication uses only the {@code Authorization: Bearer} header (no cookies)
 * to avoid triggering NiFi's CSRF protection. NiFi's {@code CsrfCookieRequestMatcher}
 * only activates when the {@code __Secure-Authorization-Bearer} cookie is present.
 *
 * <p>Requires Docker containers to be running (NiFi on port 9095, Keycloak on 9080).
 * Activated via the {@code integration-tests} Maven profile.
 */
@NullMarked
@DisplayName("Custom UI WAR Endpoint Integration Tests")
class CustomUIEndpointsIT {

    private static RequestSpecification authSpec;
    private static RequestSpecification sessionOnlySpec;
    private static RequestSpecification gatewayAuthSpec;
    private static String keycloakToken;
    private static String keycloakJwks;

    @BeforeAll
    static void setUp() throws Exception {
        SSLContext sslContext = createTrustAllSslContext();

        HttpClient httpClient = HttpClient.newBuilder()
                .sslContext(sslContext)
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        // Wait for NiFi to be ready
        waitForEndpoint(httpClient, NIFI_BASE + "/nifi/", Duration.ofSeconds(120));

        // Obtain bearer token — used as Authorization header only (no cookies)
        String bearerToken = authenticateToNifi(httpClient);

        String processorId = CustomUITestSupport.discoverProcessorId(
                httpClient, bearerToken, "MultiIssuerJWT");
        String customUIBase = CustomUITestSupport.discoverCustomUIBasePath(
                httpClient, bearerToken, processorId);

        authSpec = CustomUITestSupport.buildAuthSpec(
                customUIBase, bearerToken, processorId);
        sessionOnlySpec = CustomUITestSupport.buildSessionOnlySpec(
                customUIBase, bearerToken);

        // Discover REST API Gateway processor for gateway endpoint tests
        String gatewayProcessorId = CustomUITestSupport.discoverProcessorId(
                httpClient, bearerToken, "RestApiGateway");
        gatewayAuthSpec = CustomUITestSupport.buildAuthSpec(
                customUIBase, bearerToken, gatewayProcessorId);

        // Wait for the REST API Gateway's embedded Jetty to be ready
        waitForEndpoint(httpClient, GATEWAY_BASE + "/metrics", Duration.ofSeconds(120));

        // Fetch a Keycloak token for endpoint tests that need a real JWT
        keycloakToken = fetchKeycloakToken(httpClient,
                KEYCLOAK_TOKEN_ENDPOINT, CLIENT_ID, CLIENT_SECRET, TEST_USER, PASSWORD);

        // Fetch JWKS from Keycloak for JWKS content validation tests
        HttpRequest jwksRequest = HttpRequest.newBuilder()
                .uri(URI.create(KEYCLOAK_JWKS_ENDPOINT))
                .GET()
                .timeout(Duration.ofSeconds(10))
                .build();
        HttpResponse<String> jwksResponse = httpClient.send(jwksRequest,
                HttpResponse.BodyHandlers.ofString());
        keycloakJwks = jwksResponse.body();
    }

    // ── Endpoint Accessibility Tests ──────────────────────────────────

    @Nested
    @DisplayName("Endpoint Accessibility")
    class EndpointAccessibility {

        @Test
        @DisplayName("should return valid=true for a real Keycloak JWT")
        void verifyTokenWithValidKeycloakToken() {
            given().spec(authSpec)
                    .body(Map.of("token", keycloakToken))
                    .when()
                    .post("/nifi-api/processors/jwt/verify-token")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("valid", equalTo(true))
                    .body("claims", notNullValue())
                    .body("issuer", notNullValue())
                    .body("decoded", notNullValue())
                    .body("decoded.header.alg", notNullValue())
                    .body("decoded.payload.iss", notNullValue())
                    .body("decoded.payload.sub", notNullValue());
        }

        @Test
        @DisplayName("should never report an invalid token as valid")
        void verifyTokenWithInvalidToken() {
            given().spec(authSpec)
                    .body("""
                            {"token": "test-token"}
                            """)
                    .when()
                    .post("/nifi-api/processors/jwt/verify-token")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("valid", equalTo(false));
        }

        @Test
        @DisplayName("should return 400 when token field is missing from verify-token request")
        void verifyTokenWithMissingToken() {
            given().spec(authSpec)
                    .body("""
                            {"other": "value"}
                            """)
                    .when()
                    .post("/nifi-api/processors/jwt/verify-token")
                    .then()
                    .statusCode(400)
                    .contentType(ContentType.JSON)
                    .body("valid", equalTo(false));
        }

        @Test
        @DisplayName("should return 400 for JWKS content with empty keys array")
        void jwksContentValidationWithEmptyKeys() {
            given().spec(authSpec)
                    .body("""
                            {"jwksContent": "{\\"keys\\":[]}"}
                            """)
                    .when()
                    .post("/nifi-api/processors/jwt/validate-jwks-content")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("valid", equalTo(false));
        }

        @Test
        @DisplayName("should return valid=true for real Keycloak JWKS content")
        void jwksContentValidationWithValidKeys() {
            given().spec(authSpec)
                    .body(Map.of("jwksContent", keycloakJwks))
                    .when()
                    .post("/nifi-api/processors/jwt/validate-jwks-content")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("valid", equalTo(true))
                    .body("keyCount", greaterThan(0))
                    .body("algorithms", notNullValue());
        }

        @Test
        @DisplayName("should return valid=false for URL returning non-JWKS content")
        void jwksUrlValidationWithNonJwksUrl() {
            given().spec(authSpec)
                    .body("""
                            {"jwksUrl": "https://example.com/.well-known/jwks.json"}
                            """)
                    .when()
                    .post("/nifi-api/processors/jwt/validate-jwks-url")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("valid", equalTo(false));
        }

        @Test
        @DisplayName("should return 200 with valid=false for nonexistent JWKS file path")
        void jwksFileValidationWithNonexistentPath() {
            given().spec(authSpec)
                    .body("""
                            {"jwksFilePath": "/nonexistent/path/jwks.json"}
                            """)
                    .when()
                    .post("/nifi-api/processors/jwt/validate-jwks-file")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("valid", equalTo(false));
        }

        @Test
        @DisplayName("should return valid=true for JWKS file in NiFi conf directory")
        void jwksFileValidationWithValidFile() {
            // test-jwks.json is copied to /opt/nifi/nifi-current/conf/ by Dockerfile
            given().spec(authSpec)
                    .body("""
                            {"jwksFilePath": "/opt/nifi/nifi-current/conf/test-jwks.json"}
                            """)
                    .when()
                    .post("/nifi-api/processors/jwt/validate-jwks-file")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("valid", equalTo(true))
                    .body("keyCount", greaterThan(0));
        }

        @Test
        @DisplayName("should return valid=true for Keycloak JWKS URL (allow-private-addresses enabled)")
        void jwksUrlValidationWithKeycloakUrl() {
            // The Keycloak hostname resolves to a Docker network IP (site-local) inside NiFi.
            // With jwt.validation.jwks.allow.private.network.addresses=true in flow.json,
            // the SSRF check permits this.
            given().spec(authSpec)
                    .body(Map.of("jwksUrl",
                            "http://keycloak:8080/realms/oauth_integration_tests/protocol/openid-connect/certs"))
                    .when()
                    .post("/nifi-api/processors/jwt/validate-jwks-url")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("valid", equalTo(true))
                    .body("keyCount", greaterThan(0));
        }

        @Test
        @DisplayName("should return 405 for unknown endpoint (all requests route to single servlet)")
        void unknownEndpointReturns405() {
            // Returns 405 (not 404) because all /nifi-api/processors/jwt/* requests
            // route to a single servlet that rejects unmapped operations
            given().spec(authSpec)
                    .body("""
                            {"test": "data"}
                            """)
                    .when()
                    .post("/nifi-api/processors/jwt/unknown-endpoint")
                    .then()
                    .statusCode(405);
        }
    }

    // ── Security Tests ────────────────────────────────────────────────

    @Nested
    @DisplayName("Security")
    class Security {

        @Test
        @DisplayName("should return 401 when X-Processor-Id header is missing")
        void missingProcessorIdReturns401() {
            given().spec(sessionOnlySpec)
                    .body("""
                            {"token": "test"}
                            """)
                    .when()
                    .post("/nifi-api/processors/jwt/verify-token")
                    .then()
                    .statusCode(401)
                    .contentType(ContentType.JSON)
                    .body("valid", equalTo(false));
        }

        @Test
        @DisplayName("should return 401 when X-Processor-Id is not a valid UUID")
        void invalidProcessorIdReturns401() {
            given().spec(sessionOnlySpec)
                    .header("X-Processor-Id", "not-a-uuid")
                    .body("""
                            {"token": "test"}
                            """)
                    .when()
                    .post("/nifi-api/processors/jwt/verify-token")
                    .then()
                    .statusCode(401)
                    .contentType(ContentType.JSON)
                    .body("valid", equalTo(false));
        }
    }

    // ── Security Header Tests ────────────────────────────────────────

    @Nested
    @DisplayName("Security Headers")
    class SecurityHeaderTests {

        @Test
        @DisplayName("should include standard security headers in responses")
        void responsesContainSecurityHeaders() {
            given().spec(authSpec)
                    .when()
                    .get("/nifi-api/processors/jwt/component-info")
                    .then()
                    .statusCode(200)
                    .header("X-Content-Type-Options", equalTo("nosniff"))
                    .header("X-Frame-Options", equalTo("SAMEORIGIN"))
                    .header("Referrer-Policy", equalTo("strict-origin-when-cross-origin"))
                    .header("Content-Security-Policy", startsWith("default-src 'self'"));
        }
    }

    // ── Static Content Tests ──────────────────────────────────────────

    @Nested
    @DisplayName("Static Content")
    class StaticContent {

        @Test
        @DisplayName("should serve Custom UI index page as HTML")
        void customUIIndexPageAccessible() {
            given().spec(authSpec)
                    .when()
                    .get("/index.html")
                    .then()
                    .statusCode(200)
                    .contentType(containsString("text/html"));
        }
    }

    // ── Component Info Endpoint Tests ────────────────────────────────

    @Nested
    @DisplayName("Component Info Endpoint")
    class ComponentInfoEndpoint {

        @Test
        @DisplayName("should return processor type and class for JWT authenticator")
        void componentInfoReturnsProcessorType() {
            given().spec(authSpec)
                    .when()
                    .get("/nifi-api/processors/jwt/component-info")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("type", equalTo("PROCESSOR"))
                    .body("componentClass", containsString("MultiIssuerJWTTokenAuthenticator"));
        }

        @Test
        @DisplayName("should return processor type for gateway processor")
        void componentInfoReturnsGatewayType() {
            given().spec(gatewayAuthSpec)
                    .when()
                    .get("/nifi-api/processors/jwt/component-info")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("type", equalTo("PROCESSOR"))
                    .body("componentClass", containsString("RestApiGatewayProcessor"));
        }
    }

    // ── Gateway Proxy Endpoint Tests ─────────────────────────────────

    @Nested
    @DisplayName("Gateway Proxy Endpoints")
    class GatewayProxyEndpoints {

        @Test
        @DisplayName("should return gateway config with routes and component class")
        void gatewayConfigReturnsJson() {
            given().spec(gatewayAuthSpec)
                    .when()
                    .get("/nifi-api/processors/jwt/gateway/config")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("component", containsString("RestApiGatewayProcessor"))
                    .body("port", notNullValue())
                    .body("routes", notNullValue())
                    .body("routes.enabled", everyItem(notNullValue()))
                    .body("routes.createFlowFile", everyItem(notNullValue()))
                    .body("maxRequestBodySize", notNullValue())
                    .body("queueSize", notNullValue());
        }

        @Test
        @DisplayName("should include successOutcome and createFlowFile in route config")
        void gatewayConfigIncludesOutcomeFields() {
            given().spec(gatewayAuthSpec)
                    .when()
                    .get("/nifi-api/processors/jwt/gateway/config")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("routes.find { it.name == 'health' }.createFlowFile", equalTo(true))
                    .body("routes.find { it.name == 'health' }.successOutcome", nullValue())
                    .body("routes.find { it.name == 'data' }.createFlowFile", equalTo(true));
        }

        @Test
        @DisplayName("should return metrics from gateway via Custom UI proxy")
        void gatewayMetricsEndpoint() {
            given().spec(gatewayAuthSpec)
                    .when()
                    .get("/nifi-api/processors/jwt/gateway/metrics")
                    .then()
                    .statusCode(200);
        }

        @Test
        @DisplayName("should enforce SSRF protection on gateway test endpoint")
        void gatewayTestSsrfProtection() {
            // The @-sign in the path creates a URI where the host changes:
            // http://localhost:<port>@evil.example.com/steal
            // URI parser interprets "localhost:<port>" as userinfo and
            // "evil.example.com" as the actual host — a classic SSRF bypass attempt.
            given().spec(gatewayAuthSpec)
                    .body("""
                            {"path":"@evil.example.com/steal","method":"GET"}""")
                    .when()
                    .post("/nifi-api/processors/jwt/gateway/test")
                    .then()
                    .statusCode(400);
        }

        @Test
        @DisplayName("should successfully proxy a request to the gateway")
        void gatewayTestHappyPath() {
            given().spec(gatewayAuthSpec)
                    .body(Map.of(
                            "path", "/api/health",
                            "method", "GET",
                            "headers", Map.of("Authorization", "Bearer " + keycloakToken)))
                    .when()
                    .post("/nifi-api/processors/jwt/gateway/test")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("status", equalTo(200));
        }
    }
}
