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
import de.cuioss.nifi.jwt.util.AuthorizationValidator;
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
import java.util.Set;

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

    private TestRunner testRunner;
    private TestJwtIssuerConfigService mockConfigService;

    @BeforeEach
    void setup() throws Exception {
        testRunner = TestRunners.newTestRunner(MultiIssuerJWTTokenAuthenticator.class);

        mockConfigService = new TestJwtIssuerConfigService();
        testRunner.addControllerService(CS_ID, mockConfigService);
        testRunner.enableControllerService(mockConfigService);
        testRunner.setProperty(Properties.JWT_ISSUER_CONFIG_SERVICE, CS_ID);

        testRunner.setProperty(Properties.TOKEN_LOCATION, "AUTHORIZATION_HEADER");
        testRunner.setProperty(Properties.TOKEN_HEADER, "Authorization");
        testRunner.setProperty(Properties.BEARER_TOKEN_PREFIX, "Bearer");

        // Default: configure CS to reject tokens
        mockConfigService.configureValidationFailure(
                new TokenValidationException(SecurityEventCounter.EventType.FAILED_TO_DECODE_JWT,
                        "Token validation failed"));
    }

    private void enqueueWithToken(String token) {
        Map<String, String> attributes = new HashMap<>();
        attributes.put("http.headers.authorization", "Bearer " + token);
        testRunner.enqueue("test data", attributes);
    }

    @Nested
    @DisplayName("Token Extraction Tests")
    class TokenExtractionTests {

        @Test
        @DisplayName("Test extracting token from Authorization header")
        void extractTokenFromAuthorizationHeader() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            enqueueWithToken(tokenHolder.getRawToken());

            testRunner.run();

            // Token extracted, but CS rejects it → routes to AUTHENTICATION_FAILED
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).getFirst();
            flowFile.assertAttributeExists(JWTAttributes.Error.REASON);
            flowFile.assertAttributeExists(JWTAttributes.Error.CODE);

            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.INFO,
                    AuthLogMessages.INFO.PROCESSOR_INITIALIZED.resolveIdentifierString());
        }

        @Test
        @DisplayName("Should use configured bearer prefix for token extraction")
        void shouldUseConfiguredBearerPrefix() {
            testRunner.setProperty(Properties.BEARER_TOKEN_PREFIX, "Token");

            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Token " + tokenHolder.getRawToken());
            testRunner.enqueue("test data", attributes);

            testRunner.run();

            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).getFirst();
            String errorCode = flowFile.getAttribute(JWTAttributes.Error.CODE);
            assertNotNull(errorCode);
            assertNotEquals("AUTH-001", errorCode,
                    "Token should have been extracted with custom prefix; AUTH-001 means extraction failed");
        }

        @Test
        @DisplayName("Test extracting token from custom header")
        void extractTokenFromCustomHeader() {
            testRunner.setProperty(Properties.TOKEN_LOCATION, "CUSTOM_HEADER");
            testRunner.setProperty(Properties.CUSTOM_HEADER_NAME, "X-JWT-Token");

            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.x-jwt-token", tokenHolder.getRawToken());
            testRunner.enqueue("test data", attributes);

            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
        }

        @Test
        @DisplayName("Test extracting token from flow file content")
        void extractTokenFromFlowFileContent() {
            testRunner.setProperty(Properties.TOKEN_LOCATION, "FLOW_FILE_CONTENT");

            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            testRunner.enqueue(tokenHolder.getRawToken());

            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
        }
    }

    @Nested
    @DisplayName("Token Validation Tests")
    class TokenValidationTests {

        @Test
        @DisplayName("Test successful token validation")
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
        @DisplayName("Test validation failure with invalid token format")
        void validationFailureWithInvalidTokenFormat() {
            enqueueWithToken("invalid.token.format");
            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).getFirst();
            flowFile.assertAttributeExists(JWTAttributes.Error.REASON);
            flowFile.assertAttributeExists(JWTAttributes.Error.CODE);

            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN,
                    AuthLogMessages.WARN.TOKEN_VALIDATION_FAILED_MSG.resolveIdentifierString());
        }

        @Test
        @DisplayName("Test failure when no token is found with require-valid-token=true (default)")
        void failureWhenNoTokenFoundWithRequireValidTokenTrue() {
            testRunner.enqueue("test data");
            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN,
                    AuthLogMessages.WARN.NO_TOKEN_FOUND.resolveIdentifierString());
        }

        @Test
        @DisplayName("Test success when no token is found with require-valid-token=false")
        void successWhenNoTokenFoundWithRequireValidTokenFalse() {
            testRunner.setProperty(Properties.REQUIRE_VALID_TOKEN, "false");
            testRunner.enqueue("test data");
            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();
            flowFile.assertAttributeEquals(JWTAttributes.Token.PRESENT, "false");
            flowFile.assertAttributeEquals(JWTAttributes.Authorization.AUTHORIZED, "false");

            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.INFO,
                    AuthLogMessages.INFO.NO_TOKEN_NOT_REQUIRED.resolveIdentifierString());
        }

        @Test
        @DisplayName("Test failure when invalid token is found even with require-valid-token=false")
        void failureWhenInvalidTokenFoundWithRequireValidTokenFalse() {
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
        @DisplayName("Test authorization with required scopes - token has them")
        void authorizationWithRequiredScopesPresent() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("scope", ClaimValue.forList("read write", List.of("read", "write")));
            AccessTokenContent tokenContent = tokenHolder.asAccessTokenContent();
            mockConfigService.configureValidToken(tokenContent);
            mockConfigService.addIssuer(TestTokenHolder.TEST_ISSUER);
            mockConfigService.addAuthorizationConfig(TestTokenHolder.TEST_ISSUER,
                    AuthorizationValidator.AuthorizationConfig.builder()
                            .requiredScopes(Set.of("read"))
                            .build());

            enqueueWithToken(tokenHolder.getRawToken());
            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();
            flowFile.assertAttributeExists(JWTAttributes.Authorization.AUTHORIZED);
        }

        @Test
        @DisplayName("Test authorization bypassed when no auth config")
        void authorizationBypassedWhenNoAuthConfig() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            mockConfigService.configureValidToken(tokenHolder.asAccessTokenContent());

            enqueueWithToken(tokenHolder.getRawToken());
            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();
            flowFile.assertAttributeEquals(JWTAttributes.Authorization.AUTHORIZED, "true");
            flowFile.assertAttributeEquals(JWTAttributes.Authorization.BYPASSED, "true");
        }

        @Test
        @DisplayName("Test authorization failure when required roles missing")
        void authorizationFailureWhenRequiredRolesMissing() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            mockConfigService.configureValidToken(tokenHolder.asAccessTokenContent());
            mockConfigService.addIssuer(TestTokenHolder.TEST_ISSUER);
            mockConfigService.addAuthorizationConfig(TestTokenHolder.TEST_ISSUER,
                    AuthorizationValidator.AuthorizationConfig.builder()
                            .requiredRoles(Set.of("admin"))
                            .build());

            enqueueWithToken(tokenHolder.getRawToken());
            testRunner.run();

            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
        }
    }

    @Nested
    @DisplayName("Content Size Bounding Tests")
    class ContentSizeBoundingTests {

        @Test
        @DisplayName("Should bound content reading by max token size")
        void shouldBoundContentReadingByMaxTokenSize() {
            testRunner.setProperty(Properties.TOKEN_LOCATION, "FLOW_FILE_CONTENT");
            testRunner.setProperty(Properties.MAXIMUM_TOKEN_SIZE, "1024");
            testRunner.enqueue("x".repeat(50_000));

            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
        }

        @Test
        @DisplayName("Should accept content within max token size")
        void shouldAcceptContentWithinMaxTokenSize() {
            testRunner.setProperty(Properties.TOKEN_LOCATION, "FLOW_FILE_CONTENT");

            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            testRunner.enqueue(tokenHolder.getRawToken());
            testRunner.run();

            // Token will be extracted but fail validation (not size-related)
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).getFirst();
            assertNotEquals("AUTH-003", flowFile.getAttribute(JWTAttributes.Error.CODE),
                    "Normal-sized content should not trigger size violation");
        }
    }

    @Nested
    @DisplayName("Token Algorithm Validation Tests")
    class TokenAlgorithmValidationTests {

        @Test
        @DisplayName("Test token with malformed Base64 header")
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
        @DisplayName("Test token with invalid Base64 characters")
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
