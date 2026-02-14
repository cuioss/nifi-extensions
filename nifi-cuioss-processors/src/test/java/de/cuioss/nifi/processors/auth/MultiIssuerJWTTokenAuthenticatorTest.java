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
package de.cuioss.nifi.processors.auth;

import de.cuioss.nifi.jwt.JWTAttributes;
import de.cuioss.sheriff.oauth.core.domain.claim.ClaimValue;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.sheriff.oauth.core.exception.TokenValidationException;
import de.cuioss.sheriff.oauth.core.security.SecurityEventCounter;
import de.cuioss.sheriff.oauth.core.test.TestTokenHolder;
import de.cuioss.sheriff.oauth.core.test.generator.TestTokenGenerators;
import de.cuioss.test.juli.LogAsserts;
import de.cuioss.test.juli.TestLogLevel;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import org.apache.nifi.util.MockFlowFile;
import org.apache.nifi.util.TestRunner;
import org.apache.nifi.util.TestRunners;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Properties;
import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Relationships;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Test class for {@link MultiIssuerJWTTokenAuthenticator}.
 * Tests processor behavior with a mock {@link de.cuioss.nifi.jwt.config.JwtIssuerConfigService}.
 */
@EnableTestLogger
class MultiIssuerJWTTokenAuthenticatorTest {

    private static final String CS_ID = "jwt-config";
    private static final String TOKEN_ATTR = "jwt.token";

    private TestRunner testRunner;
    private TestJwtIssuerConfigService mockConfigService;

    @BeforeEach
    void setup() throws Exception {
        testRunner = TestRunners.newTestRunner(MultiIssuerJWTTokenAuthenticator.class);

        mockConfigService = new TestJwtIssuerConfigService();
        testRunner.addControllerService(CS_ID, mockConfigService);
        testRunner.enableControllerService(mockConfigService);
        testRunner.setProperty(Properties.JWT_ISSUER_CONFIG_SERVICE, CS_ID);

        // Default: configure CS to reject tokens
        mockConfigService.configureValidationFailure(
                new TokenValidationException(SecurityEventCounter.EventType.FAILED_TO_DECODE_JWT,
                        "Token validation failed"));
    }

    private void enqueueWithToken(String token) {
        Map<String, String> attributes = new HashMap<>();
        attributes.put(TOKEN_ATTR, token);
        testRunner.enqueue("test data", attributes);
    }

    @Nested
    @DisplayName("Token Reading Tests")
    class TokenReadingTests {

        @Test
        @DisplayName("Should read token from default attribute")
        void shouldReadTokenFromDefaultAttribute() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            enqueueWithToken(tokenHolder.getRawToken());

            testRunner.run();

            // Token read, but CS rejects it → routes to AUTHENTICATION_FAILED
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).getFirst();
            flowFile.assertAttributeExists(JWTAttributes.Error.REASON);
            flowFile.assertAttributeExists(JWTAttributes.Error.CODE);

            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.INFO,
                    AuthLogMessages.INFO.PROCESSOR_INITIALIZED.resolveIdentifierString());
        }

        @Test
        @DisplayName("Should read token from custom attribute name")
        void shouldReadTokenFromCustomAttribute() {
            testRunner.setProperty(Properties.TOKEN_ATTRIBUTE, "my.custom.token");

            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            Map<String, String> attributes = new HashMap<>();
            attributes.put("my.custom.token", tokenHolder.getRawToken());
            testRunner.enqueue("test data", attributes);

            testRunner.run();

            // Token extracted from custom attribute, CS rejects → AUTHENTICATION_FAILED
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).getFirst();
            String errorCode = flowFile.getAttribute(JWTAttributes.Error.CODE);
            assertNotNull(errorCode);
            assertNotEquals("AUTH-001", errorCode,
                    "Token should have been read from custom attribute; AUTH-001 means no token found");
        }
    }

    @Nested
    @DisplayName("Token Validation Tests")
    class TokenValidationTests {

        @Test
        @DisplayName("Should route valid token to SUCCESS")
        void successfulTokenValidation() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            AccessTokenContent tokenContent = tokenHolder.asAccessTokenContent();
            mockConfigService.configureValidToken(tokenContent);

            enqueueWithToken(tokenHolder.getRawToken());
            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 0);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();
            flowFile.assertAttributeEquals(JWTAttributes.Token.PRESENT, "true");
            flowFile.assertAttributeExists(JWTAttributes.Token.VALIDATED_AT);
            flowFile.assertAttributeEquals(JWTAttributes.Token.ISSUER, TestTokenHolder.TEST_ISSUER);
            flowFile.assertAttributeExists(JWTAttributes.Token.SUBJECT);
        }

        @Test
        @DisplayName("Should reject malformed token (no dots)")
        void validationFailureWithMalformedToken() {
            enqueueWithToken("malformedtoken");
            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).getFirst();
            assertEquals("AUTH-004", flowFile.getAttribute(JWTAttributes.Error.CODE));

            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN,
                    AuthLogMessages.WARN.TOKEN_MALFORMED.resolveIdentifierString());
        }

        @Test
        @DisplayName("Should reject token exceeding max size")
        void validationFailureWithOversizedToken() {
            enqueueWithToken("a.b." + "X".repeat(20000));
            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).getFirst();
            assertEquals("AUTH-003", flowFile.getAttribute(JWTAttributes.Error.CODE));
        }

        @Test
        @DisplayName("Should fail when no token attribute present with require-valid-token=true")
        void failureWhenNoTokenWithRequireValidTokenTrue() {
            testRunner.enqueue("test data");
            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN,
                    AuthLogMessages.WARN.NO_TOKEN_FOUND.resolveIdentifierString());
        }

        @Test
        @DisplayName("Should succeed when no token with require-valid-token=false")
        void successWhenNoTokenWithRequireValidTokenFalse() {
            testRunner.setProperty(Properties.REQUIRE_VALID_TOKEN, "false");
            testRunner.enqueue("test data");
            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();
            flowFile.assertAttributeEquals(JWTAttributes.Token.PRESENT, "false");

            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.INFO,
                    AuthLogMessages.INFO.NO_TOKEN_NOT_REQUIRED.resolveIdentifierString());
        }

        @Test
        @DisplayName("Should fail when invalid token present even with require-valid-token=false")
        void failureWhenInvalidTokenWithRequireValidTokenFalse() {
            testRunner.setProperty(Properties.REQUIRE_VALID_TOKEN, "false");
            enqueueWithToken("invalid.token.format");
            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
        }
    }

    @Nested
    @DisplayName("Authorization Tests")
    class AuthorizationTests {

        @Test
        @DisplayName("Should authorize token with required scopes present")
        void authorizationWithRequiredScopesPresent() {
            testRunner.setProperty(Properties.REQUIRED_SCOPES, "read");

            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("scope", ClaimValue.forList("read write", List.of("read", "write")));
            mockConfigService.configureValidToken(tokenHolder.asAccessTokenContent());

            enqueueWithToken(tokenHolder.getRawToken());
            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();
            flowFile.assertAttributeEquals(JWTAttributes.Authorization.AUTHORIZED, "true");
        }

        @Test
        @DisplayName("Should skip authorization when no roles/scopes configured")
        void noAuthorizationCheckWhenNotConfigured() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            mockConfigService.configureValidToken(tokenHolder.asAccessTokenContent());

            enqueueWithToken(tokenHolder.getRawToken());
            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();
            flowFile.assertAttributeNotExists(JWTAttributes.Authorization.AUTHORIZED);
        }

        @Test
        @DisplayName("Should reject token when required roles are missing")
        void authorizationFailureWhenRequiredRolesMissing() {
            testRunner.setProperty(Properties.REQUIRED_ROLES, "admin");

            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            mockConfigService.configureValidToken(tokenHolder.asAccessTokenContent());

            enqueueWithToken(tokenHolder.getRawToken());
            testRunner.run();

            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
        }
    }

    @Nested
    @DisplayName("Token Size Bounding Tests")
    class TokenSizeBoundingTests {

        @Test
        @DisplayName("Should reject token exceeding custom max size")
        void shouldRejectTokenExceedingCustomMaxSize() {
            mockConfigService.configureMaxTokenSize(1024);
            enqueueWithToken("a." + "X".repeat(2000) + ".sig");

            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
        }

        @Test
        @DisplayName("Should accept token within max size")
        void shouldAcceptTokenWithinMaxSize() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            enqueueWithToken(tokenHolder.getRawToken());
            testRunner.run();

            // Token will be extracted but fail validation (not size-related)
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).getFirst();
            assertNotEquals("AUTH-003", flowFile.getAttribute(JWTAttributes.Error.CODE),
                    "Normal-sized token should not trigger size violation");
        }
    }

    @Nested
    @DisplayName("Token Algorithm Validation Tests")
    class TokenAlgorithmValidationTests {

        @Test
        @DisplayName("Should reject token with malformed Base64 header")
        void malformedBase64Header() {
            enqueueWithToken("not-valid-base64!!!.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature");
            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).getFirst();
            flowFile.assertAttributeExists(JWTAttributes.Error.REASON);
            flowFile.assertAttributeExists(JWTAttributes.Error.CODE);
            flowFile.assertAttributeExists(JWTAttributes.Error.CATEGORY);
        }

        @Test
        @DisplayName("Should reject token with invalid Base64 characters")
        void base64WithInvalidCharacters() {
            enqueueWithToken("eyJ@#$%^&*()!.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature");
            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).getFirst();
            flowFile.assertAttributeExists(JWTAttributes.Error.REASON);
            flowFile.assertAttributeExists(JWTAttributes.Error.CODE);
        }
    }
}
