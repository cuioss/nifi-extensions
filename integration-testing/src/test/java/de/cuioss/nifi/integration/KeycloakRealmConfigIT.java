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
import jakarta.json.Json;
import jakarta.json.JsonObject;
import org.hamcrest.Matcher;
import org.hamcrest.MatcherAssert;
import org.jspecify.annotations.NullMarked;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.io.StringReader;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

import static de.cuioss.nifi.integration.IntegrationTestSupport.*;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * Verifies that the Keycloak realm configurations
 * ({@code oauth_integration_tests-realm.json} and {@code other_realm-realm.json})
 * are imported correctly and produce JWTs with the expected claims, roles,
 * and issuer values that downstream processors depend on.
 *
 * <p>This does NOT test generic Keycloak behavior (token format, standard claims).
 * Instead it validates our specific realm setup:
 * <ul>
 *   <li>The {@code roles} claim mapper emits realm roles into access tokens</li>
 *   <li>{@code testUser} has both {@code user} and {@code read} roles</li>
 *   <li>{@code limitedUser} has {@code user} but NOT {@code read}</li>
 *   <li>The two realms use distinct signing keys (cross-realm tokens are rejected)</li>
 *   <li>The issuer contains the correct realm name</li>
 * </ul>
 *
 * <p>Requires Docker containers running (Keycloak on port 9080).
 * Activated via the {@code integration-tests} Maven profile.
 */
@NullMarked
@DisplayName("Keycloak Realm Configuration Tests")
class KeycloakRealmConfigIT {

    private static RequestSpecification tokenSpec;
    private static RequestSpecification otherRealmTokenSpec;

    @BeforeAll
    static void setUp() throws Exception {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        waitForEndpoint(httpClient, KEYCLOAK_BASE, Duration.ofSeconds(120));

        tokenSpec = new RequestSpecBuilder()
                .setBaseUri(KEYCLOAK_TOKEN_ENDPOINT)
                .setContentType("application/x-www-form-urlencoded")
                .setAccept(ContentType.JSON)
                .addFormParam("grant_type", "password")
                .addFormParam("client_id", CLIENT_ID)
                .addFormParam("client_secret", CLIENT_SECRET)
                .addFormParam("scope", "openid")
                .build();

        otherRealmTokenSpec = new RequestSpecBuilder()
                .setBaseUri(OTHER_REALM_TOKEN_ENDPOINT)
                .setContentType("application/x-www-form-urlencoded")
                .setAccept(ContentType.JSON)
                .addFormParam("grant_type", "password")
                .addFormParam("client_id", OTHER_CLIENT_ID)
                .addFormParam("client_secret", OTHER_CLIENT_SECRET)
                .addFormParam("scope", "openid")
                .build();
    }

    // ── Roles Claim Mapper ─────────────────────────────────────────────

    @Nested
    @DisplayName("Roles Claim Mapper")
    class RolesClaimMapperTests {

        @Test
        @DisplayName("testUser token should contain 'roles' claim with 'user' and 'read'")
        void testUserShouldHaveUserAndReadRoles() {
            JsonObject payload = decodeJwtPayload(fetchToken(tokenSpec, TEST_USER));

            // The realm-roles-mapper maps realm roles into a top-level 'roles' claim
            assertThat(payload, hasKey("roles"));
            assertThat(payload.getJsonArray("roles").toString(), allOf(
                    containsString("user"),
                    containsString("read")));
        }

        @Test
        @DisplayName("limitedUser token should contain 'user' role but NOT 'read'")
        void limitedUserShouldHaveUserRoleOnly() {
            JsonObject payload = decodeJwtPayload(fetchToken(tokenSpec, LIMITED_USER));

            assertThat(payload, hasKey("roles"));
            String roles = payload.getJsonArray("roles").toString();
            assertThat(roles, containsString("user"));
            assertThat(roles, not(containsString("read")));
        }
    }

    // ── Issuer Configuration ───────────────────────────────────────────

    @Nested
    @DisplayName("Issuer Configuration")
    class IssuerConfigTests {

        @Test
        @DisplayName("oauth_integration_tests token issuer should contain correct realm name")
        void primaryRealmIssuerShouldContainRealmName() {
            JsonObject payload = decodeJwtPayload(fetchToken(tokenSpec, TEST_USER));

            assertThat(payload.getString("iss"),
                    containsString("/realms/oauth_integration_tests"));
        }

        @Test
        @DisplayName("other_realm issuer should differ from primary realm")
        void otherRealmIssuerShouldDiffer() {
            JsonObject primaryPayload = decodeJwtPayload(fetchToken(tokenSpec, TEST_USER));
            JsonObject otherPayload = decodeJwtPayload(fetchToken(otherRealmTokenSpec, OTHER_USER));

            assertThat(primaryPayload.getString("iss"),
                    containsString("oauth_integration_tests"));
            assertThat(otherPayload.getString("iss"),
                    containsString("other_realm"));
            assertThat(primaryPayload.getString("iss"),
                    not(equalTo(otherPayload.getString("iss"))));
        }
    }

    // ── Signing Key Isolation ──────────────────────────────────────────

    @Nested
    @DisplayName("Signing Key Isolation")
    class SigningKeyIsolationTests {

        @Test
        @DisplayName("tokens from different realms should have different signing key IDs")
        void realmsShouldUseDifferentSigningKeys() {
            String primaryToken = fetchToken(tokenSpec, TEST_USER);
            String otherToken = fetchToken(otherRealmTokenSpec, OTHER_USER);

            // JWT header contains 'kid' (Key ID) — must differ between realms
            JsonObject primaryHeader = decodeJwtHeader(primaryToken);
            JsonObject otherHeader = decodeJwtHeader(otherToken);

            assertThat(primaryHeader, hasKey("kid"));
            assertThat(otherHeader, hasKey("kid"));
            assertThat(primaryHeader.getString("kid"),
                    not(equalTo(otherHeader.getString("kid"))));
        }
    }

    // ── Client Configuration ───────────────────────────────────────────

    @Nested
    @DisplayName("Client Configuration")
    class ClientConfigTests {

        @Test
        @DisplayName("test_client should support password grant (direct access)")
        void testClientShouldSupportPasswordGrant() {
            given().spec(tokenSpec)
                    .formParam("username", TEST_USER)
                    .formParam("password", PASSWORD)
                    .when()
                    .post()
                    .then()
                    .statusCode(200)
                    .body("access_token", notNullValue())
                    .body("token_type", equalToIgnoringCase("Bearer"));
        }

        @Test
        @DisplayName("test_client should NOT support client_credentials grant")
        void testClientShouldRejectClientCredentialsGrant() {
            given().baseUri(KEYCLOAK_TOKEN_ENDPOINT)
                    .contentType("application/x-www-form-urlencoded")
                    .formParam("grant_type", "client_credentials")
                    .formParam("client_id", CLIENT_ID)
                    .formParam("client_secret", CLIENT_SECRET)
                    .when()
                    .post()
                    .then()
                    .statusCode(401);
        }
    }

    // ── Helper methods ─────────────────────────────────────────────────

    /**
     * Fetches an access token via REST Assured using the given spec and username.
     */
    private static String fetchToken(RequestSpecification spec, String username) {
        return given().spec(spec)
                .formParam("username", username)
                .formParam("password", PASSWORD)
                .when()
                .post()
                .then()
                .statusCode(200)
                .extract().path("access_token");
    }

    private static JsonObject decodeJwtPayload(String jwt) {
        String payloadJson = new String(
                Base64.getUrlDecoder().decode(jwt.split("\\.")[1]),
                StandardCharsets.UTF_8);
        return Json.createReader(new StringReader(payloadJson)).readObject();
    }

    private static JsonObject decodeJwtHeader(String jwt) {
        String headerJson = new String(
                Base64.getUrlDecoder().decode(jwt.split("\\.")[0]),
                StandardCharsets.UTF_8);
        return Json.createReader(new StringReader(headerJson)).readObject();
    }

    private static <T> void assertThat(T actual, Matcher<? super T> matcher) {
        MatcherAssert.assertThat(actual, matcher);
    }
}
