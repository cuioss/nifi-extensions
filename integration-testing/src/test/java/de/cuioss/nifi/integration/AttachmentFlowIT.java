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

import de.cuioss.http.security.database.ApacheCVEAttackDatabase;
import de.cuioss.http.security.database.AttackTestCase;
import de.cuioss.http.security.database.ModSecurityCRSAttackDatabase;
import de.cuioss.http.security.database.OWASPTop10AttackDatabase;
import de.cuioss.test.generator.domain.UUIDStringGenerator;
import de.cuioss.test.generator.junit.EnableGeneratorController;
import de.cuioss.test.generator.junit.parameterized.TypeGeneratorSource;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.config.RestAssuredConfig;
import io.restassured.config.SSLConfig;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import org.jspecify.annotations.NullMarked;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ArgumentsSource;

import java.net.http.HttpClient;
import java.time.Duration;

import static de.cuioss.nifi.integration.IntegrationTestSupport.*;
import static io.restassured.RestAssured.given;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.*;

/**
 * Integration tests for the attachment flow: upload route with
 * {@code tracking-mode=attachments}, attachment submission, and
 * Wait/Notify synchronization.
 *
 * <p>Route configuration (cui-nifi-extensions.properties):
 * <ul>
 *   <li>{@code /api/upload} — POST, tracking-mode=attachments, min=1, max=5, timeout=60s</li>
 *   <li>{@code /attachments/{parentTraceId}} — built-in attachment endpoint</li>
 *   <li>{@code /status/{traceId}} — built-in status endpoint</li>
 * </ul>
 *
 * <p>Requires Docker containers to be running (NiFi on port 9443, Keycloak on 9085).
 * Activated via the {@code integration-tests} Maven profile.
 */
@NullMarked
@EnableGeneratorController
@DisplayName("Attachment Flow Integration Tests")
class AttachmentFlowIT {

    private static @Nullable RequestSpecification authSpec;
    private static @Nullable RequestSpecification noAuthSpec;

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

    // ── Upload Endpoint (tracking-mode=attachments) ─────────────────────

    @Nested
    @DisplayName("Upload Endpoint")
    class UploadEndpointTests {

        @Test
        @DisplayName("should return 202 with COLLECTING_ATTACHMENTS status for POST /api/upload")
        void shouldAcceptUploadAndStartCollecting() {
            String traceId = given().spec(authSpec)
                    .body("{\"document\": \"test-upload\"}")
                    .when()
                    .post("/api/upload")
                    .then()
                    .statusCode(202)
                    .header("Location", containsString("/status/"))
                    .body("status", equalTo("accepted"))
                    .body("traceId", notNullValue())
                    .body("_links.status.href", startsWith("/status/"))
                    .body("_links.attachments.href", startsWith("/attachments/"))
                    .extract()
                    .path("traceId");

            // Verify status is COLLECTING_ATTACHMENTS
            given().spec(authSpec)
                    .when()
                    .get("/status/" + traceId)
                    .then()
                    .statusCode(200)
                    .body("traceId", equalTo(traceId))
                    .body("status", equalTo("COLLECTING_ATTACHMENTS"))
                    .body("acceptedAt", notNullValue())
                    .body("updatedAt", notNullValue());
        }

        @Test
        @DisplayName("should return 401 for POST /api/upload without JWT")
        void shouldReturn401ForUploadWithoutAuth() {
            given().spec(noAuthSpec)
                    .contentType(ContentType.JSON)
                    .body("{\"document\": \"test\"}")
                    .when()
                    .post("/api/upload")
                    .then()
                    .statusCode(401);
        }

        @Test
        @DisplayName("should return 405 for GET on /api/upload")
        void shouldReturn405ForGetOnUpload() {
            given().spec(authSpec)
                    .when()
                    .get("/api/upload")
                    .then()
                    .statusCode(405);
        }
    }

    // ── Attachment Submission ────────────────────────────────────────────

    @Nested
    @DisplayName("Attachment Submission")
    class AttachmentSubmissionTests {

        @Test
        @DisplayName("should accept attachment for a tracked upload request")
        void shouldAcceptAttachmentForTrackedUpload() {
            String parentTraceId = given().spec(authSpec)
                    .body("{\"document\": \"parent-with-attachment\"}")
                    .when()
                    .post("/api/upload")
                    .then()
                    .statusCode(202)
                    .extract()
                    .path("traceId");

            given().spec(authSpec)
                    .body("{\"file\": \"attachment-content\"}")
                    .when()
                    .post("/attachments/" + parentTraceId)
                    .then()
                    .statusCode(202)
                    .body("status", equalTo("accepted"))
                    .body("traceId", notNullValue())
                    .body("_links.status.href", startsWith("/status/"));
        }

        @ParameterizedTest
        @TypeGeneratorSource(value = UUIDStringGenerator.class, count = 3)
        @DisplayName("should return 404 for attachment with a generated non-existent parentTraceId")
        void shouldReturn404ForUnknownParent(String unknownParentTraceId) {
            // A generated, well-formed but non-existent UUID — exercises the
            // not-tracked branch with a fresh value each run rather than a literal.
            given().spec(authSpec)
                    .body("{\"file\": \"orphan-attachment\"}")
                    .when()
                    .post("/attachments/" + unknownParentTraceId)
                    .then()
                    .statusCode(404)
                    .contentType(containsString("application/problem+json"));
        }

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(OWASPTop10AttackDatabase.ArgumentsProvider.class)
        @DisplayName("should reject OWASP attack as parentTraceId (non-2xx)")
        void shouldRejectOwaspAttackParentTraceId(AttackTestCase testCase) {
            assertAttackParentTraceIdRejected(testCase);
        }

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(ApacheCVEAttackDatabase.ArgumentsProvider.class)
        @DisplayName("should reject Apache CVE attack as parentTraceId (non-2xx)")
        void shouldRejectApacheCveAttackParentTraceId(AttackTestCase testCase) {
            assertAttackParentTraceIdRejected(testCase);
        }

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(ModSecurityCRSAttackDatabase.ArgumentsProvider.class)
        @DisplayName("should reject ModSecurity CRS attack as parentTraceId (non-2xx)")
        void shouldRejectModSecurityAttackParentTraceId(AttackTestCase testCase) {
            assertAttackParentTraceIdRejected(testCase);
        }

        /**
         * Feeds an adversarial / malformed string into the {@code {parentTraceId}}
         * path-parameter segment and asserts the gateway does not return 2xx — the
         * invalid-UUID / security validation rejects it (400) or the router declines
         * to match it (404). This replaces the former single {@code not-a-uuid}
         * literal with adversarial-database coverage.
         *
         * <p>No transport-level exception is caught here, deliberately. REST Assured
         * URL-encodes the path segment, so every attack string in the OWASP / Apache
         * CVE / ModSecurity CRS databases forms a valid HTTP request and yields a real
         * status code. Any exception that does escape this call therefore signals an
         * unreachable or crashed gateway (for example {@link java.net.ConnectException}),
         * which must fail the test rather than be swallowed into a vacuous pass.
         */
        private void assertAttackParentTraceIdRejected(AttackTestCase testCase) {
            int status = given().spec(authSpec)
                    .body("{\"file\": \"bad-uuid\"}")
                    .when()
                    .post("/attachments/{parentTraceId}", testCase.attackString())
                    .then()
                    .extract()
                    .statusCode();
            // A 401/403 means the class-level token was itself rejected (typically expired
            // mid-run against Keycloak's default access-token lifespan). Accepting that as
            // "non-2xx = safe" would make every remaining attack case pass vacuously, so
            // fail loudly instead of silently swallowing the auth failure.
            org.junit.jupiter.api.Assertions.assertNotEquals(401, status,
                    "Authentication failed (401) for adversarial parentTraceId — token likely "
                            + "expired mid-run; assertion would be vacuous: " + testCase.attackDescription());
            org.junit.jupiter.api.Assertions.assertNotEquals(403, status,
                    "Authorization failed (403) for adversarial parentTraceId — unexpected for an "
                            + "authenticated attack request: " + testCase.attackDescription());
            // The invalid-UUID / security validation rejects it (400) or the router declines
            // to match it (404); either way the gateway must not return a 2xx success.
            org.junit.jupiter.api.Assertions.assertTrue(status < 200 || status >= 300,
                    "Expected non-2xx for adversarial parentTraceId: " + testCase.attackDescription()
                            + " (got " + status + ")");
        }

        @Test
        @DisplayName("should return 409 for attachment on simple tracking-mode request")
        void shouldReturn409ForAttachmentOnSimpleRequest() {
            String simpleTraceId = given().spec(authSpec)
                    .body("{\"key\": \"simple-request\"}")
                    .when()
                    .post("/api/data")
                    .then()
                    .statusCode(202)
                    .extract()
                    .path("traceId");

            given().spec(authSpec)
                    .body("{\"file\": \"rejected-attachment\"}")
                    .when()
                    .post("/attachments/" + simpleTraceId)
                    .then()
                    .statusCode(409)
                    .contentType(containsString("application/problem+json"));
        }

        @Test
        @DisplayName("should return 405 for GET on /attachments/{id}")
        void shouldReturn405ForGetOnAttachments() {
            given().spec(authSpec)
                    .when()
                    .get("/attachments/00000000-0000-0000-0000-000000000000")
                    .then()
                    .statusCode(405);
        }

        @Test
        @DisplayName("should return 401 for attachment without auth")
        void shouldReturn401ForAttachmentWithoutAuth() {
            given().spec(noAuthSpec)
                    .contentType(ContentType.JSON)
                    .body("{\"file\": \"unauthorized\"}")
                    .when()
                    .post("/attachments/00000000-0000-0000-0000-000000000000")
                    .then()
                    .statusCode(401);
        }
    }

    // ── Attachment Count Enforcement ────────────────────────────────────

    @Nested
    @DisplayName("Attachment Count Enforcement")
    class AttachmentCountTests {

        @Test
        @DisplayName("should reject attachment when max count (5) is exceeded")
        void shouldRejectWhenMaxCountExceeded() {
            String parentTraceId = given().spec(authSpec)
                    .body("{\"document\": \"max-count-test\"}")
                    .when()
                    .post("/api/upload")
                    .then()
                    .statusCode(202)
                    .extract()
                    .path("traceId");

            for (int i = 1; i <= 5; i++) {
                given().spec(authSpec)
                        .body("{\"file\": \"attachment-" + i + "\"}")
                        .when()
                        .post("/attachments/" + parentTraceId)
                        .then()
                        .statusCode(202);
            }

            given().spec(authSpec)
                    .body("{\"file\": \"attachment-6-rejected\"}")
                    .when()
                    .post("/attachments/" + parentTraceId)
                    .then()
                    .statusCode(409)
                    .contentType(containsString("application/problem+json"));
        }
    }

    // ── End-to-End Attachment Flow ───────────────────────────────────────

    @Nested
    @DisplayName("End-to-End Attachment Flow")
    class EndToEndFlowTests {

        @Test
        @DisplayName("should track attachment with its own traceId and parentTraceId")
        void shouldTrackAttachmentWithParentReference() {
            String parentTraceId = given().spec(authSpec)
                    .body("{\"document\": \"e2e-parent\"}")
                    .when()
                    .post("/api/upload")
                    .then()
                    .statusCode(202)
                    .extract()
                    .path("traceId");

            String attachmentTraceId = given().spec(authSpec)
                    .body("{\"file\": \"e2e-attachment\"}")
                    .when()
                    .post("/attachments/" + parentTraceId)
                    .then()
                    .statusCode(202)
                    .extract()
                    .path("traceId");

            given().spec(authSpec)
                    .when()
                    .get("/status/" + attachmentTraceId)
                    .then()
                    .statusCode(200)
                    .body("traceId", equalTo(attachmentTraceId))
                    .body("parentTraceId", equalTo(parentTraceId))
                    .body("status", notNullValue());
        }

        @Test
        @DisplayName("should include attachments link in upload response")
        void shouldIncludeAttachmentsLinkInUploadResponse() {
            given().spec(authSpec)
                    .body("{\"document\": \"links-test\"}")
                    .when()
                    .post("/api/upload")
                    .then()
                    .statusCode(202)
                    .body("_links.attachments.href", startsWith("/attachments/"));
        }

        @Test
        @DisplayName("should transition through full lifecycle: COLLECTING_ATTACHMENTS → PROCESSING → PROCESSED")
        void shouldTransitionThroughFullLifecycle() {
            // Step 1: Create parent upload (status = COLLECTING_ATTACHMENTS)
            String parentTraceId = given().spec(authSpec)
                    .body("{\"document\": \"wait-notify-test\"}")
                    .when()
                    .post("/api/upload")
                    .then()
                    .statusCode(202)
                    .extract()
                    .path("traceId");

            given().spec(authSpec)
                    .when()
                    .get("/status/" + parentTraceId)
                    .then()
                    .statusCode(200)
                    .body("status", equalTo("COLLECTING_ATTACHMENTS"));

            // Step 2: Submit attachment (min count = 1, triggers Notify → Wait release)
            given().spec(authSpec)
                    .body("{\"file\": \"trigger-attachment\"}")
                    .when()
                    .post("/attachments/" + parentTraceId)
                    .then()
                    .statusCode(202);

            // Step 3: Status transitions to PROCESSED synchronously in AttachmentsEndpointHandler
            // when attachment count meets attachmentsMinCount (= 1 for this route).
            await().atMost(Duration.ofSeconds(30))
                    .pollInterval(Duration.ofSeconds(1))
                    .untilAsserted(() ->
                            given().spec(authSpec)
                                    .when()
                                    .get("/status/" + parentTraceId)
                                    .then()
                                    .statusCode(200)
                                    .body("status", equalTo("PROCESSED")));
        }
    }
}
