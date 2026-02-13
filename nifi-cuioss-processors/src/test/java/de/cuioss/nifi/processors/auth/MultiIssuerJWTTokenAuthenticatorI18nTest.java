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

import de.cuioss.nifi.jwt.JWTAttributes;
import de.cuioss.sheriff.oauth.core.exception.TokenValidationException;
import de.cuioss.sheriff.oauth.core.security.SecurityEventCounter;
import org.apache.nifi.util.MockFlowFile;
import org.apache.nifi.util.TestRunner;
import org.apache.nifi.util.TestRunners;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Properties;
import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Relationships;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Test class for internationalization aspects of {@link MultiIssuerJWTTokenAuthenticator}.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/internationalization.adoc">Internationalization Specification</a>
 */
@DisplayName("Tests for MultiIssuerJWTTokenAuthenticator Internationalization")
class MultiIssuerJWTTokenAuthenticatorI18nTest {

    private static final String CS_ID = "jwt-config";

    private TestRunner testRunner;
    private TestJwtIssuerConfigService mockConfigService;

    @BeforeEach
    void setUp() throws Exception {
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

    @Test
    @DisplayName("Test internationalized error message for missing token")
    void internationalizedErrorMessageForMissingToken() {
        testRunner.enqueue("test data");

        testRunner.run();

        testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(
                Relationships.AUTHENTICATION_FAILED).getFirst();

        String errorReason = flowFile.getAttribute(JWTAttributes.Error.REASON);
        assertNotNull(errorReason, "Error reason should not be null");
        assertTrue(errorReason.contains("AUTHORIZATION_HEADER"),
                "Error message should contain the token location");
        assertTrue(errorReason.contains("Token") || errorReason.contains("token") ||
                errorReason.contains("Kein"),
                "Error message should mention token");
    }

    @Test
    @DisplayName("Test internationalized error message for token size limit")
    void internationalizedErrorMessageForTokenSizeLimit() {
        // Create a very large token (exceeding the default 16384 byte limit)
        StringBuilder largeToken = new StringBuilder("Bearer ");
        largeToken.append("X".repeat(20000));

        Map<String, String> attributes = new HashMap<>();
        attributes.put("http.headers.authorization", largeToken.toString());
        testRunner.enqueue("test data", attributes);

        testRunner.run();

        testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(
                Relationships.AUTHENTICATION_FAILED).getFirst();

        String errorReason = flowFile.getAttribute(JWTAttributes.Error.REASON);
        String errorCode = flowFile.getAttribute(JWTAttributes.Error.CODE);

        assertNotNull(errorReason, "Error reason should not be null");
        assertEquals("AUTH-003", errorCode, "Error code should be AUTH-003");
        // Check for size limit - could be formatted as "16384" or "16.384" depending on locale
        assertTrue(errorReason.contains("16384") || errorReason.contains("16.384"),
                "Error message should contain the size limit");
    }

    @Test
    @DisplayName("Test internationalized error message for malformed token")
    void internationalizedErrorMessageForMalformedToken() {
        Map<String, String> attributes = new HashMap<>();
        attributes.put("http.headers.authorization", "Bearer malformedtoken");
        testRunner.enqueue("test data", attributes);

        testRunner.run();

        testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(
                Relationships.AUTHENTICATION_FAILED).getFirst();

        String errorReason = flowFile.getAttribute(JWTAttributes.Error.REASON);
        String errorCode = flowFile.getAttribute(JWTAttributes.Error.CODE);

        assertNotNull(errorReason, "Error reason should not be null");
        assertEquals("AUTH-004", errorCode, "Error code should be AUTH-004");

        assertTrue(errorReason.contains("malformed") || errorReason.contains("fehlerhaft") ||
                errorReason.contains("fehlt") || errorReason.contains("segments"),
                "Error message should mention malformed token or missing segments");
    }
}
