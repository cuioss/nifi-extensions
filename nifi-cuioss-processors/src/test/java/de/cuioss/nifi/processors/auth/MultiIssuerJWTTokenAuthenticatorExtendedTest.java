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
import de.cuioss.sheriff.oauth.core.test.JwtTokenTamperingUtil;
import de.cuioss.sheriff.oauth.core.test.JwtTokenTamperingUtil.TamperingStrategy;
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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Properties;
import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Relationships;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

/**
 * Extended tests for {@link MultiIssuerJWTTokenAuthenticator} using realistic token content
 * from the oauth-sheriff test generators.
 * <p>
 * Token validation is delegated to the {@link de.cuioss.nifi.jwt.config.JwtIssuerConfigService}
 * Controller Service. These tests use a mock CS to verify processor routing, attribute population,
 * and authorization logic with representative token content.
 */
@EnableTestLogger
class MultiIssuerJWTTokenAuthenticatorExtendedTest {

    private static final String CS_ID = "jwt-config";
    private static final String TOKEN_ATTR = "jwt.token";

    private TestRunner testRunner;
    private MultiIssuerJWTTokenAuthenticator processor;
    private TestJwtIssuerConfigService mockConfigService;

    @BeforeEach
    void setup() throws Exception {
        processor = new MultiIssuerJWTTokenAuthenticator();
        testRunner = TestRunners.newTestRunner(processor);

        mockConfigService = new TestJwtIssuerConfigService();
        testRunner.addControllerService(CS_ID, mockConfigService);
        testRunner.enableControllerService(mockConfigService);
        testRunner.setProperty(Properties.JWT_ISSUER_CONFIG_SERVICE, CS_ID);
    }

    private MockFlowFile enqueueWithToken(String token) {
        Map<String, String> attributes = new HashMap<>();
        attributes.put(TOKEN_ATTR, token);
        testRunner.enqueue("test data", attributes);
        testRunner.run();
        return null; // Caller retrieves from relationship
    }

    @Nested
    @DisplayName("Successful Token Validation")
    class SuccessfulValidationTests {

        @Test
        @DisplayName("Should route valid token to SUCCESS with correct attributes")
        void shouldRouteValidTokenToSuccess() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            AccessTokenContent tokenContent = tokenHolder.asAccessTokenContent();
            mockConfigService.configureValidToken(tokenContent);

            enqueueWithToken(tokenHolder.getRawToken());

            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 0);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();
            flowFile.assertAttributeEquals(JWTAttributes.Token.PRESENT, "true");
            flowFile.assertAttributeExists(JWTAttributes.Token.VALIDATED_AT);
        }

        @Test
        @DisplayName("Should extract subject and issuer from validated token")
        void shouldExtractSubjectAndIssuer() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            AccessTokenContent tokenContent = tokenHolder.asAccessTokenContent();
            mockConfigService.configureValidToken(tokenContent);

            enqueueWithToken(tokenHolder.getRawToken());

            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();

            flowFile.assertAttributeExists(JWTAttributes.Token.SUBJECT);
            flowFile.assertAttributeEquals(JWTAttributes.Token.ISSUER, TestTokenHolder.TEST_ISSUER);
            flowFile.assertAttributeExists(JWTAttributes.Token.EXPIRATION);
        }

        @Test
        @DisplayName("Should extract custom claims as flow file attributes")
        void shouldExtractCustomClaims() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("tenant-id", ClaimValue.forPlainString("acme-corp"));
            AccessTokenContent tokenContent = tokenHolder.asAccessTokenContent();
            mockConfigService.configureValidToken(tokenContent);

            enqueueWithToken(tokenHolder.getRawToken());

            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();
            flowFile.assertAttributeEquals(JWTAttributes.Content.PREFIX + "tenant-id", "acme-corp");
        }
    }

    @Nested
    @DisplayName("Authorization Tests with Token Content")
    class AuthorizationWithTokenContentTests {

        @Test
        @DisplayName("Should route valid token to SUCCESS without authorization attribute when none configured")
        void shouldRouteToSuccessWithoutAuthorizationAttribute() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            mockConfigService.configureValidToken(tokenHolder.asAccessTokenContent());

            enqueueWithToken(tokenHolder.getRawToken());

            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();
            flowFile.assertAttributeNotExists(JWTAttributes.Authorization.AUTHORIZED);
        }

        @Test
        @DisplayName("Should route token to SUCCESS with scope authorization")
        void shouldRouteToSuccessWithScopeAuthorization() {
            testRunner.setProperty(Properties.REQUIRED_SCOPES, "read");

            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("scope", ClaimValue.forList("read write", List.of("read", "write")));
            mockConfigService.configureValidToken(tokenHolder.asAccessTokenContent());

            enqueueWithToken(tokenHolder.getRawToken());

            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();
            flowFile.assertAttributeEquals(JWTAttributes.Authorization.AUTHORIZED, "true");
        }
    }

    @Nested
    @DisplayName("Lifecycle Tests")
    class LifecycleTests {

        @Test
        @DisplayName("Should handle onStopped after processing")
        void shouldHandleOnStoppedAfterProcessing() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            AccessTokenContent tokenContent = tokenHolder.asAccessTokenContent();
            mockConfigService.configureValidToken(tokenContent);

            enqueueWithToken(tokenHolder.getRawToken());

            testRunner.assertTransferCount(Relationships.SUCCESS, 1);

            assertDoesNotThrow(() -> processor.onStopped());

            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.INFO,
                    AuthLogMessages.INFO.PROCESSOR_STOPPED.resolveIdentifierString());
        }

        @Test
        @DisplayName("Should reinitialize after stop and reschedule")
        void shouldReinitializeAfterStopAndReschedule() {
            TestTokenHolder tokenHolder1 = TestTokenGenerators.accessTokens().next();
            AccessTokenContent tokenContent1 = tokenHolder1.asAccessTokenContent();
            mockConfigService.configureValidToken(tokenContent1);

            enqueueWithToken(tokenHolder1.getRawToken());
            testRunner.assertTransferCount(Relationships.SUCCESS, 1);

            // Stop
            processor.onStopped();

            // Second run — processor reinitializes on next trigger
            testRunner.clearTransferState();
            TestTokenHolder tokenHolder2 = TestTokenGenerators.accessTokens().next();
            AccessTokenContent tokenContent2 = tokenHolder2.asAccessTokenContent();
            mockConfigService.configureValidToken(tokenContent2);

            enqueueWithToken(tokenHolder2.getRawToken());
            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
        }
    }

    @Nested
    @DisplayName("Tampered Token Tests")
    class TamperedTokenTests {

        @ParameterizedTest
        @EnumSource(TamperingStrategy.class)
        @DisplayName("Should reject tampered token")
        void shouldRejectTamperedToken(TamperingStrategy strategy) {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            String validToken = tokenHolder.getRawToken();
            String tamperedToken = JwtTokenTamperingUtil.applyTamperingStrategy(validToken, strategy);

            mockConfigService.configureValidationFailure(
                    new TokenValidationException(SecurityEventCounter.EventType.SIGNATURE_VALIDATION_FAILED,
                            "Token signature verification failed"));

            enqueueWithToken(tamperedToken);

            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
        }

        @Test
        @DisplayName("Should reject token with corrupted signature")
        void shouldRejectCorruptedSignature() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            String tamperedToken = JwtTokenTamperingUtil.applyTamperingStrategy(
                    tokenHolder.getRawToken(), TamperingStrategy.MODIFY_SIGNATURE_LAST_CHAR);

            mockConfigService.configureValidationFailure(
                    new TokenValidationException(SecurityEventCounter.EventType.SIGNATURE_VALIDATION_FAILED,
                            "Token signature verification failed"));

            enqueueWithToken(tamperedToken);

            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN,
                    AuthLogMessages.WARN.TOKEN_VALIDATION_FAILED_MSG.resolveIdentifierString());
        }

        @Test
        @DisplayName("Should reject token with algorithm 'none' attack")
        void shouldRejectAlgorithmNoneAttack() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            String tamperedToken = JwtTokenTamperingUtil.applyTamperingStrategy(
                    tokenHolder.getRawToken(), TamperingStrategy.ALGORITHM_NONE);

            mockConfigService.configureValidationFailure(
                    new TokenValidationException(SecurityEventCounter.EventType.UNSUPPORTED_ALGORITHM,
                            "Unsupported algorithm: none"));

            enqueueWithToken(tamperedToken);

            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
        }

        @Test
        @DisplayName("Should reject unsigned token")
        void shouldRejectUnsignedToken() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            String tamperedToken = JwtTokenTamperingUtil.applyTamperingStrategy(
                    tokenHolder.getRawToken(), TamperingStrategy.REMOVE_SIGNATURE);

            mockConfigService.configureValidationFailure(
                    new TokenValidationException(SecurityEventCounter.EventType.SIGNATURE_VALIDATION_FAILED,
                            "Token is unsigned"));

            enqueueWithToken(tamperedToken);

            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
        }

        @Test
        @DisplayName("Should reject token with invalid key ID")
        void shouldRejectInvalidKeyId() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            String tamperedToken = JwtTokenTamperingUtil.applyTamperingStrategy(
                    tokenHolder.getRawToken(), TamperingStrategy.INVALID_KID);

            mockConfigService.configureValidationFailure(
                    new TokenValidationException(SecurityEventCounter.EventType.KEY_NOT_FOUND,
                            "Key not found for kid"));

            enqueueWithToken(tamperedToken);

            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
        }

        @Test
        @DisplayName("Should reject token with different signature")
        void shouldRejectDifferentSignature() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            String tamperedToken = JwtTokenTamperingUtil.applyTamperingStrategy(
                    tokenHolder.getRawToken(), TamperingStrategy.DIFFERENT_SIGNATURE);

            mockConfigService.configureValidationFailure(
                    new TokenValidationException(SecurityEventCounter.EventType.SIGNATURE_VALIDATION_FAILED,
                            "Token signature does not match"));

            enqueueWithToken(tamperedToken);

            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
        }
    }
}
