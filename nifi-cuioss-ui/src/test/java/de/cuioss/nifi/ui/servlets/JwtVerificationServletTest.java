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
package de.cuioss.nifi.ui.servlets;

import de.cuioss.http.security.database.ApacheCVEAttackDatabase;
import de.cuioss.http.security.database.AttackTestCase;
import de.cuioss.http.security.database.ModSecurityCRSAttackDatabase;
import de.cuioss.http.security.database.OWASPTop10AttackDatabase;
import de.cuioss.nifi.ui.service.JwtValidationService;
import de.cuioss.nifi.ui.service.JwtValidationService.TokenValidationResult;
import de.cuioss.sheriff.token.validation.TokenType;
import de.cuioss.sheriff.token.validation.domain.claim.ClaimValue;
import de.cuioss.sheriff.token.validation.domain.token.AccessTokenContent;
import de.cuioss.sheriff.token.validation.test.TestTokenHolder;
import de.cuioss.sheriff.token.validation.test.generator.ClaimControlParameter;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.nifi.web.NiFiWebConfigurationContext;
import org.eclipse.jetty.ee11.servlet.ServletHolder;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.ArgumentsSource;
import org.junit.jupiter.params.provider.MethodSource;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.stream.Stream;

import static org.easymock.EasyMock.createNiceMock;
import static org.easymock.EasyMock.replay;
import static org.hamcrest.Matchers.*;

/**
 * Tests for {@link JwtVerificationServlet} using embedded Jetty + REST Assured.
 * <p>
 * Uses a configurable {@link JwtValidationService} test double injected via
 * constructor. Each test sets the desired behavior before making HTTP requests.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/reference/configuration.adoc">Configuration Reference</a>
 */
@EnableTestLogger
@DisplayName("JwtVerificationServlet tests")
class JwtVerificationServletTest {

    private static final String ENDPOINT = "/nifi-api/processors/jwt/verify-token";

    /**
     * Configurable token verification behavior — each test sets this before
     * making HTTP requests.
     */
    @FunctionalInterface
    interface TokenVerifier {
        TokenValidationResult verify(String token, String processorId) throws Exception;
    }

    private static volatile TokenVerifier currentVerifier;
    private static EmbeddedServletTestSupport.ServerHandle handle;

    @BeforeAll
    static void startServer() throws Exception {
        NiFiWebConfigurationContext dummyContext = createNiceMock(NiFiWebConfigurationContext.class);
        replay(dummyContext);

        handle = EmbeddedServletTestSupport.startServer(ctx -> {
            JwtVerificationServlet servlet = new JwtVerificationServlet(
                    new JwtValidationService(dummyContext) {
                        @Override
                        public TokenValidationResult verifyToken(String token, String processorId,
                                HttpServletRequest request)
                                throws IllegalArgumentException, IllegalStateException {
                            try {
                                return currentVerifier.verify(token, processorId);
                            } catch (IllegalArgumentException | IllegalStateException e) {
                                throw e;
                            } catch (Exception e) {
                                throw new IllegalStateException(e);
                            }
                        }
                    });
            ctx.addServlet(new ServletHolder(servlet), ENDPOINT);
        });
    }

    @AfterAll
    static void stopServer() throws Exception {
        handle.close();
    }

    @Test
    @DisplayName("Should return valid response for valid token")
    void validTokenVerification() {
        currentVerifier = (token, processorId) -> {
            var tokenHolder = new TestTokenHolder(TokenType.ACCESS_TOKEN,
                    ClaimControlParameter.defaultForTokenType(TokenType.ACCESS_TOKEN));
            return TokenValidationResult.success(tokenHolder.asAccessTokenContent());
        };

        handle.spec()
                .contentType("application/json")
                .body("""
                        {"token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(true))
                .body("authorized", equalTo(true))
                .body("issuer", equalTo(TestTokenHolder.TEST_ISSUER));
    }

    @Test
    @DisplayName("Should return invalid response for invalid token")
    void invalidTokenVerification() {
        currentVerifier = (token, processorId) ->
                TokenValidationResult.failure("Invalid token signature");

        handle.spec()
                .contentType("application/json")
                .body("""
                        {"token":"invalid-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(false))
                .body("error", containsString("Invalid token signature"));
    }

    @Test
    @DisplayName("Should reject request body larger than 1 MB with 413")
    void oversizedBodyReturns413() {
        // 1 MB of padding pushes the total body over MAX_REQUEST_BODY_SIZE; the
        // limit must hold even without a trustworthy Content-Length header
        String requestJson = """
                {"token":"%s","processorId":"test-processor-id"}"""
                .formatted("a".repeat(1024 * 1024));

        handle.spec()
                .contentType("application/json")
                .body(requestJson)
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(413)
                .body("error", containsString("too large"));
    }

    @Test
    @DisplayName("Should return validation failure for expired token")
    void expiredTokenVerification() {
        currentVerifier = (token, processorId) ->
                TokenValidationResult.failure("Token expired at 2025-01-01T00:00:00Z");

        handle.spec()
                .contentType("application/json")
                .body("""
                        {"token":"expired-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(false))
                .body("error", containsString("expired"));
    }

    static Stream<Arguments> badRequestProvider() {
        return Stream.of(
                Arguments.of("{\"processorId\": \"test-processor-id\"}", "Missing required field: token"),
                Arguments.of("{\"token\": \"test-token\"}", "Processor ID cannot be empty"),
                Arguments.of("{ invalid json }", "Invalid JSON format"),
                Arguments.of("{\"token\": \"\", \"processorId\": \"test-processor-id\"}", "Token cannot be empty"),
                Arguments.of("{\"token\": \"test-token\", \"processorId\": \"\"}", "Processor ID cannot be empty")
        );
    }

    @ParameterizedTest(name = "Bad request: {1}")
    @MethodSource("badRequestProvider")
    @DisplayName("Should reject bad requests")
    void shouldRejectBadRequest(String requestJson, String expectedError) {
        // Service should not be called for bad requests
        currentVerifier = (token, processorId) -> {
            throw new AssertionError("Service should not have been called");
        };

        handle.spec()
                .contentType("application/json")
                .body(requestJson)
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(400)
                .body("valid", equalTo(false))
                .body("error", containsString(expectedError));
    }

    @Test
    @DisplayName("Should return 503 for service IllegalStateException")
    void serviceException() {
        currentVerifier = (token, processorId) -> {
            throw new IllegalStateException("Service not available");
        };

        handle.spec()
                .contentType("application/json")
                .body("""
                        {"token":"test-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(503)
                .body("valid", equalTo(false))
                .body("error", containsString("Service not available"));
    }

    @Test
    @DisplayName("Should return 400 for service IllegalArgumentException")
    void illegalArgumentFromService() {
        currentVerifier = (token, processorId) -> {
            throw new IllegalArgumentException("Invalid processor configuration");
        };

        handle.spec()
                .contentType("application/json")
                .body("""
                        {"token":"test-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(400)
                .body("valid", equalTo(false))
                .body("error", containsString("Invalid request"));
    }

    @Test
    @DisplayName("Should return 503 for service communication error (wrapped as IllegalStateException)")
    void communicationErrorFromService() {
        currentVerifier = (token, processorId) -> {
            throw new IllegalStateException("Connection refused");
        };

        handle.spec()
                .contentType("application/json")
                .body("""
                        {"token":"test-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(503)
                .body("valid", equalTo(false))
                .body("error", containsString("Service not available"));
    }

    @Test
    @DisplayName("Should return claims from valid token with AccessTokenContent")
    void validTokenWithClaimsMap() {
        currentVerifier = (token, processorId) -> {
            var tokenHolder = new TestTokenHolder(TokenType.ACCESS_TOKEN,
                    ClaimControlParameter.defaultForTokenType(TokenType.ACCESS_TOKEN));
            AccessTokenContent tokenContent = tokenHolder.asAccessTokenContent();

            return TokenValidationResult.success(tokenContent);
        };

        handle.spec()
                .contentType("application/json")
                .body("""
                        {"token":"eyJhbGciOiJSUzI1NiJ9.test.sig","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(true))
                .body("authorized", equalTo(true))
                .body("issuer", equalTo(TestTokenHolder.TEST_ISSUER))
                .body("claims.sub", equalTo("test-subject"));
    }

    @Test
    @DisplayName("Should return empty claims when tokenContent is null")
    void validTokenWithNullIssuerAndEmptyScopes() {
        currentVerifier = (token, processorId) -> TokenValidationResult.success(null);

        handle.spec()
                .contentType("application/json")
                .body("""
                        {"token":"test-token-minimal","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(true))
                .body("authorized", equalTo(true))
                .body("claims.size()", equalTo(0));
    }

    @Test
    @DisplayName("Should read processorId from X-Processor-Id header when missing in body")
    void processorIdFromHeader() {
        currentVerifier = (token, processorId) -> {
            return TokenValidationResult.success(null);
        };

        handle.spec()
                .contentType("application/json")
                .header("X-Processor-Id", "header-processor-id")
                .body("""
                        {"token":"test-token"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(true));
    }

    @Test
    @DisplayName("Should include issuer in claims from token content")
    void validTokenWithIssuerInClaims() {
        currentVerifier = (token, processorId) -> {
            var tokenHolder = new TestTokenHolder(TokenType.ACCESS_TOKEN,
                    ClaimControlParameter.defaultForTokenType(TokenType.ACCESS_TOKEN));
            AccessTokenContent tokenContent = tokenHolder.asAccessTokenContent();

            return TokenValidationResult.success(tokenContent);
        };

        handle.spec()
                .contentType("application/json")
                .body("""
                        {"token":"test-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(true))
                .body("claims", hasKey("iss"))
                .body("claims.iss", equalTo(TestTokenHolder.TEST_ISSUER));
    }

    @Test
    @DisplayName("Should include scopes and roles in valid response")
    void validTokenWithScopesAndRoles() {
        currentVerifier = (token, processorId) -> {
            var tokenHolder = new TestTokenHolder(TokenType.ACCESS_TOKEN,
                    ClaimControlParameter.defaultForTokenType(TokenType.ACCESS_TOKEN));
            tokenHolder.withClaim("scope",
                    ClaimValue.forList("openid profile email", List.of("openid", "profile", "email")));
            tokenHolder.withClaim("roles",
                    ClaimValue.forList("admin user", List.of("admin", "user")));
            return TokenValidationResult.success(tokenHolder.asAccessTokenContent());
        };

        handle.spec()
                .contentType("application/json")
                .body("""
                        {"token":"test-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(true))
                .body("scopes", hasItems("openid", "profile", "email"))
                .body("roles", hasItems("admin", "user"));
    }

    @Test
    @DisplayName("Should omit scopes and roles when empty")
    void validTokenWithEmptyScopesAndRoles() {
        currentVerifier = (token, processorId) -> TokenValidationResult.success(null);

        handle.spec()
                .contentType("application/json")
                .body("""
                        {"token":"test-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(true))
                .body("$", not(hasKey("scopes")))
                .body("$", not(hasKey("roles")));
    }

    @Test
    @DisplayName("Should handle invalid token without claims")
    void invalidTokenWithNoClaims() {
        currentVerifier = (token, processorId) ->
                TokenValidationResult.failure("Signature verification failed");

        handle.spec()
                .contentType("application/json")
                .body("""
                        {"token":"bad-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(false))
                .body("error", containsString("Signature verification"))
                .body("claims.size()", equalTo(0));
    }

    @Test
    @DisplayName("Should include decoded JWT header and payload for valid token")
    void validTokenWithDecodedParts() {
        currentVerifier = (token, processorId) -> {
            var tokenHolder = new TestTokenHolder(TokenType.ACCESS_TOKEN,
                    ClaimControlParameter.defaultForTokenType(TokenType.ACCESS_TOKEN));
            tokenHolder.withClaim("custom", ClaimValue.forPlainString("value"));
            AccessTokenContent tokenContent = tokenHolder.asAccessTokenContent();

            return TokenValidationResult.success(tokenContent);
        };

        handle.spec()
                .contentType("application/json")
                .body("""
                        {"token":"test-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(true))
                .body("decoded.header.alg", equalTo("RS256"))
                .body("decoded.payload.sub", equalTo("test-subject"))
                .body("decoded.payload.iss", equalTo(TestTokenHolder.TEST_ISSUER));
    }

    @Test
    @DisplayName("Should handle null values and mixed array types in decoded JWT payload")
    void validTokenWithNullAndMixedArrayClaims() {
        // Build JWT with null claim and array containing mixed types (String, Integer, Boolean, null)
        String header = Base64.getUrlEncoder().withoutPadding().encodeToString(
                """
                        {"alg":"RS256","typ":"JWT"}"""
                        .getBytes(StandardCharsets.UTF_8));
        String payload = Base64.getUrlEncoder().withoutPadding().encodeToString(
                """
                        {"sub":"null-test","nothing":null,"items":["text",42,true,null],"big":9999999999}"""
                        .getBytes(StandardCharsets.UTF_8));
        String rawToken = header + "." + payload + ".fake-signature";

        currentVerifier = (token, processorId) -> {
            var tokenHolder = new TestTokenHolder(TokenType.ACCESS_TOKEN,
                    ClaimControlParameter.defaultForTokenType(TokenType.ACCESS_TOKEN));
            // Construct AccessTokenContent with the crafted raw token for decoded JWT testing
            AccessTokenContent tokenContent = new AccessTokenContent(
                    tokenHolder.getClaims(), rawToken);

            return TokenValidationResult.success(tokenContent);
        };

        handle.spec()
                .contentType("application/json")
                .body("""
                        {"token":"test-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(true))
                .body("decoded.payload.sub", equalTo("null-test"))
                .body("decoded.payload.items", hasItems("text"));
    }

    @Test
    @DisplayName("Should handle diverse claim value types in decoded JWT payload")
    void validTokenWithDiverseClaimTypes() {
        // Build JWT with boolean, number, array, nested object claims
        String header = Base64.getUrlEncoder().withoutPadding().encodeToString(
                """
                        {"alg":"RS256","typ":"JWT"}"""
                        .getBytes(StandardCharsets.UTF_8));
        String payload = Base64.getUrlEncoder().withoutPadding().encodeToString(
                """
                        {"sub":"diverse-user","active":true,"score":3.14,"count":42,"tags":["tag1","tag2"],"meta":{"key":"val"},"big":9999999999}"""
                        .getBytes(StandardCharsets.UTF_8));
        String rawToken = header + "." + payload + ".fake-signature";

        currentVerifier = (token, processorId) -> {
            var tokenHolder = new TestTokenHolder(TokenType.ACCESS_TOKEN,
                    ClaimControlParameter.defaultForTokenType(TokenType.ACCESS_TOKEN));
            AccessTokenContent tokenContent = new AccessTokenContent(
                    tokenHolder.getClaims(), rawToken);

            return TokenValidationResult.success(tokenContent);
        };

        handle.spec()
                .contentType("application/json")
                .body("""
                        {"token":"test-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(true))
                .body("decoded.payload.sub", equalTo("diverse-user"))
                .body("decoded.payload.active", equalTo(true))
                .body("decoded.payload.tags", hasItems("tag1", "tag2"))
                .body("decoded.payload.meta.key", equalTo("val"));
    }

    @Test
    @DisplayName("Should handle malformed JWT in decoded token gracefully")
    void malformedJwtInDecodedToken() {
        currentVerifier = (token, processorId) -> {
            var tokenHolder = new TestTokenHolder(TokenType.ACCESS_TOKEN,
                    ClaimControlParameter.defaultForTokenType(TokenType.ACCESS_TOKEN));
            // Construct AccessTokenContent with a malformed raw token
            AccessTokenContent tokenContent = new AccessTokenContent(
                    tokenHolder.getClaims(), "not-a-valid-jwt");

            return TokenValidationResult.success(tokenContent);
        };

        handle.spec()
                .contentType("application/json")
                .body("""
                        {"token":"test-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(true))
                // decoded field should be absent when JWT parsing fails
                .body("$", not(hasKey("decoded")));
    }

    // -----------------------------------------------------------------------
    // cui-http X-Processor-Id header security validation
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("cui-http X-Processor-Id security validation")
    class SecurityValidation {

        private static final String TRAVERSAL_PROCESSOR_ID = "../../../etc/passwd";
        private static final String LEGITIMATE_PROCESSOR_ID = "d290f1ee-6c54-4b01-90e6-d701748f0851";

        @Test
        @DisplayName("Should reject malicious body processorId with 400")
        void shouldRejectMaliciousBodyProcessorId() {
            currentVerifier = (token, processorId) -> {
                throw new AssertionError("Service should not be called for a rejected processor ID");
            };

            handle.spec()
                    .contentType("application/json")
                    .body("""
                            {"token":"test-token","processorId":"../../../etc/passwd"}""")
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(400)
                    .body("valid", equalTo(false))
                    .body("error", containsString("Invalid processor ID"));
        }

        @Test
        @DisplayName("Should reject malicious X-Processor-Id header with 400")
        void shouldRejectMaliciousProcessorIdHeader() {
            currentVerifier = (token, processorId) -> {
                throw new AssertionError("Service should not be called for a rejected processor ID");
            };

            handle.spec()
                    .contentType("application/json")
                    .header("X-Processor-Id", TRAVERSAL_PROCESSOR_ID)
                    .body("""
                            {"token":"test-token"}""")
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(400)
                    .body("valid", equalTo(false))
                    .body("error", containsString("Invalid processor ID"));
        }

        @Test
        @DisplayName("Should let a legitimate UUID processor ID pass header validation")
        void shouldAllowLegitimateProcessorId() {
            currentVerifier = (token, processorId) -> {
                return TokenValidationResult.success(null);
            };

            handle.spec()
                    .contentType("application/json")
                    .body("""
                            {"token":"test-token","processorId":"d290f1ee-6c54-4b01-90e6-d701748f0851"}""")
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(200)
                    .body("valid", equalTo(true));
        }

        @Test
        @DisplayName("Should let a legitimate UUID X-Processor-Id header pass validation")
        void shouldAllowLegitimateProcessorIdHeader() {
            currentVerifier = (token, processorId) -> {
                return TokenValidationResult.success(null);
            };

            handle.spec()
                    .contentType("application/json")
                    .header("X-Processor-Id", LEGITIMATE_PROCESSOR_ID)
                    .body("""
                            {"token":"test-token"}""")
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(200)
                    .body("valid", equalTo(true));
        }
    }

    // -----------------------------------------------------------------------
    // Adversarial attack-database coverage (OWASP / Apache CVE / ModSecurity CRS)
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("Adversarial attack-database coverage")
    class AdversarialSecurityValidation {

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(OWASPTop10AttackDatabase.ArgumentsProvider.class)
        @DisplayName("Should reject OWASP Top 10 attack on X-Processor-Id header")
        void shouldRejectOwaspAttackOnHeader(AttackTestCase testCase) {
            assertAttackHeaderRejected(testCase);
        }

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(ApacheCVEAttackDatabase.ArgumentsProvider.class)
        @DisplayName("Should reject Apache CVE attack on X-Processor-Id header")
        void shouldRejectApacheCveAttackOnHeader(AttackTestCase testCase) {
            assertAttackHeaderRejected(testCase);
        }

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(ModSecurityCRSAttackDatabase.ArgumentsProvider.class)
        @DisplayName("Should reject ModSecurity CRS attack on X-Processor-Id header")
        void shouldRejectModSecurityAttackOnHeader(AttackTestCase testCase) {
            assertAttackHeaderRejected(testCase);
        }

        /**
         * Feeds an attack string as the {@code X-Processor-Id} header and asserts the
         * servlet does not return a valid (200/valid) verification. An attack string
         * containing characters illegal for an HTTP header line is rejected at the
         * transport level, which also counts as a successful rejection.
         */
        private void assertAttackHeaderRejected(AttackTestCase testCase) {
            currentVerifier = (token, processorId) -> {
                throw new AssertionError("Service should not be called for a rejected processor ID");
            };
            try {
                handle.spec()
                        .contentType("application/json")
                        .header("X-Processor-Id", testCase.attackString())
                        .body("""
                                {"token":"test-token"}""")
                        .when()
                        .post(ENDPOINT)
                        .then()
                        .statusCode(not(equalTo(200)));
            } catch (RuntimeException e) {
                // Attack string contains characters illegal for an HTTP header —
                // rejected at the transport level before reaching the servlet.
            }
        }
    }
}
