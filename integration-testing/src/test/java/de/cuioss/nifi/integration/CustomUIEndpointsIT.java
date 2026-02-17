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
import java.net.http.HttpClient;
import java.time.Duration;

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

    @BeforeAll
    static void setUp() throws Exception {
        SSLContext sslContext = IntegrationTestSupport.createTrustAllSslContext();

        HttpClient httpClient = HttpClient.newBuilder()
                .sslContext(sslContext)
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        // Wait for NiFi to be ready
        IntegrationTestSupport.waitForEndpoint(httpClient,
                "https://localhost:9095/nifi/", Duration.ofSeconds(120));

        // Obtain bearer token — used as Authorization header only (no cookies)
        String bearerToken = IntegrationTestSupport.authenticateToNifi(httpClient);

        String processorId = CustomUITestSupport.discoverProcessorId(
                httpClient, bearerToken, "MultiIssuerJWT");
        String customUIBase = CustomUITestSupport.discoverCustomUIBasePath(
                httpClient, bearerToken, processorId);

        authSpec = CustomUITestSupport.buildAuthSpec(
                customUIBase, bearerToken, processorId);
        sessionOnlySpec = CustomUITestSupport.buildSessionOnlySpec(
                customUIBase, bearerToken);
    }

    // ── Endpoint Accessibility Tests ──────────────────────────────────

    @Nested
    @DisplayName("Endpoint Accessibility")
    class EndpointAccessibility {

        @Test
        @DisplayName("should return 400 with valid=false for unverifiable token")
        void verifyTokenWithInvalidToken() {
            given().spec(authSpec)
                    .body("""
                            {"token": "test-token"}
                            """)
                    .when()
                    .post("/nifi-api/processors/jwt/verify-token")
                    .then()
                    .statusCode(400)
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
                            {"jwksContent": "{\\\\\\\"keys\\\\\\\":[]}"}
                            """)
                    .when()
                    .post("/nifi-api/processors/jwt/validate-jwks-content")
                    .then()
                    .statusCode(400)
                    .contentType(ContentType.JSON)
                    .body("valid", equalTo(false));
        }

        @Test
        @DisplayName("should return 400 for unreachable JWKS URL")
        void jwksUrlValidationWithUnreachableUrl() {
            given().spec(authSpec)
                    .body("""
                            {"jwksUrl": "https://example.com/.well-known/jwks.json"}
                            """)
                    .when()
                    .post("/nifi-api/processors/jwt/validate-jwks-url")
                    .then()
                    .statusCode(400)
                    .contentType(ContentType.JSON)
                    .body("valid", equalTo(false));
        }

        @Test
        @DisplayName("should return 400 for nonexistent JWKS file path")
        void jwksFileValidationWithNonexistentPath() {
            given().spec(authSpec)
                    .body("""
                            {"jwksFilePath": "/nonexistent/path/jwks.json"}
                            """)
                    .when()
                    .post("/nifi-api/processors/jwt/validate-jwks-file")
                    .then()
                    .statusCode(400)
                    .contentType(ContentType.JSON)
                    .body("valid", equalTo(false));
        }

        @Test
        @DisplayName("should return 405 for unknown endpoint (no servlet mapped)")
        void unknownEndpointReturns405() {
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
}
