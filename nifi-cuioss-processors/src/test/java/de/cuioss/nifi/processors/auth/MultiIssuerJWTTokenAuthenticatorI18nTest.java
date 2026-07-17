/*
 * Copyright 2023 the original author or authors.
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * <p>
 * https://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package de.cuioss.nifi.processors.auth;

import de.cuioss.nifi.jwt.JwtAttributes;
import de.cuioss.sheriff.token.validation.exception.TokenValidationException;
import de.cuioss.sheriff.token.commons.events.SecurityEventCounter;
import org.apache.nifi.util.MockFlowFile;
import org.apache.nifi.util.TestRunner;
import org.apache.nifi.util.TestRunners;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static de.cuioss.nifi.processors.auth.JwtProcessorConstants.Properties;
import static de.cuioss.nifi.processors.auth.JwtProcessorConstants.Relationships;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Test class for internationalization aspects of {@link MultiIssuerJWTTokenAuthenticator}.
 */
@DisplayName("Tests for MultiIssuerJWTTokenAuthenticator Internationalization")
class MultiIssuerJWTTokenAuthenticatorI18nTest {

    private static final String CS_ID = "jwt-config";
    private static final String TOKEN_ATTR = "jwt.token";

    private TestRunner testRunner;
    private TestJwtIssuerConfigService mockConfigService;

    @BeforeEach
    void setUp() throws Exception {
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

    private MockFlowFile runAndGetFailedFlowFile() {
        testRunner.run();

        testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
        return testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).getFirst();
    }

    @Nested
    @DisplayName("Internationalized Error Messages")
    class InternationalizedErrorMessageTests {

        @Test
        @DisplayName("Should reference the token attribute when no token is present")
        void shouldReferenceTokenAttributeWhenMissingToken() {
            testRunner.enqueue("test data");

            MockFlowFile flowFile = runAndGetFailedFlowFile();

            String errorReason = flowFile.getAttribute(JwtAttributes.Error.REASON);
            assertNotNull(errorReason, "Error reason should be present");
            assertTrue(errorReason.contains("jwt.token") || errorReason.contains("Token")
                    || errorReason.contains("token") || errorReason.contains("Kein"),
                    "Error message should reference the token attribute or mention token");
        }

        @Test
        @DisplayName("Should report the size limit when token exceeds maximum size")
        void shouldReportSizeLimitWhenTokenTooLarge() {
            Map<String, String> attributes = new HashMap<>();
            attributes.put(TOKEN_ATTR, "X".repeat(20000));
            testRunner.enqueue("test data", attributes);

            MockFlowFile flowFile = runAndGetFailedFlowFile();

            String errorReason = flowFile.getAttribute(JwtAttributes.Error.REASON);
            String errorCode = flowFile.getAttribute(JwtAttributes.Error.CODE);
            assertEquals("AUTH-003", errorCode, "Error code should signal oversized token");
            assertNotNull(errorReason, "Error reason should be present");
            // The byte count is inserted verbatim (as a String), so it renders as "16384"
            // deterministically across locales — no locale-dependent number grouping.
            assertTrue(errorReason.contains("16384"),
                    "Error message should contain the size limit");
        }

        @Test
        @DisplayName("Should populate error reason and code for a malformed token")
        void shouldPopulateErrorForMalformedToken() {
            // BeforeEach already configures validation failure — "malformedtoken" passes
            // through to TokenValidator which throws TokenValidationException
            Map<String, String> attributes = new HashMap<>();
            attributes.put(TOKEN_ATTR, "malformedtoken");
            testRunner.enqueue("test data", attributes);

            MockFlowFile flowFile = runAndGetFailedFlowFile();

            String errorReason = flowFile.getAttribute(JwtAttributes.Error.REASON);
            String errorCode = flowFile.getAttribute(JwtAttributes.Error.CODE);
            assertNotNull(errorReason, "Error reason should be present");
            assertNotNull(errorCode, "Error code should be present");
        }
    }
}
