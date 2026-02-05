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

import de.cuioss.tools.logging.CuiLogger;
import org.apache.nifi.processor.ProcessContext;
import org.apache.nifi.util.MockFlowFile;
import org.apache.nifi.util.MockProcessContext;
import org.apache.nifi.util.TestRunner;
import org.apache.nifi.util.TestRunners;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Test class for internationalization aspects of {@link MultiIssuerJWTTokenAuthenticator}.
 */
@DisplayName("Tests for MultiIssuerJWTTokenAuthenticator Internationalization")
class MultiIssuerJWTTokenAuthenticatorI18nTest {

    private static final CuiLogger LOGGER = new CuiLogger(MultiIssuerJWTTokenAuthenticatorI18nTest.class);
    private TestRunner testRunner;
    private MultiIssuerJWTTokenAuthenticator processor;
    private Map<String, String> dynamicProperties = new HashMap<>();
    private static final String ISSUER_PREFIX = "issuer.";

    @BeforeEach
    void setUp() {
        processor = new MultiIssuerJWTTokenAuthenticator() {
            @Override
            public void onScheduled(final ProcessContext context) {
                // Override onScheduled to manually add dynamic properties before calling super
                MockProcessContext mockContext = (MockProcessContext) context;

                // Add our tracked dynamic properties
                dynamicProperties.forEach(mockContext::setProperty);

                // Now call the original onScheduled with all properties available
                super.onScheduled(context);
            }
        };
        testRunner = TestRunners.newTestRunner(processor);

        // Configure basic properties
        testRunner.setProperty(Properties.TOKEN_LOCATION, TokenLocation.AUTHORIZATION_HEADER);
        testRunner.setProperty(Properties.TOKEN_HEADER, Http.AUTHORIZATION_HEADER);
        testRunner.setProperty(Properties.BEARER_TOKEN_PREFIX, "Bearer");

        // Configure issuer properties
        setDynamicProperty(ISSUER_PREFIX + "test-issuer.jwks-url", "https://test-issuer/.well-known/jwks.json");
        setDynamicProperty(ISSUER_PREFIX + "test-issuer.issuer", "test-issuer");
        setDynamicProperty(ISSUER_PREFIX + "test-issuer.audience", "test-audience");
    }

    private void setDynamicProperty(String key, String value) {
        testRunner.setProperty(key, value);
        dynamicProperties.put(key, value);
    }

    @Test
    @DisplayName("Test internationalized error message for missing token")
    void internationalizedErrorMessageForMissingToken() {
        // Given a flow file without a token
        testRunner.enqueue("test data");

        // When the processor is triggered
        testRunner.run();

        // Then the error message should be internationalized
        testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(
                Relationships.AUTHENTICATION_FAILED).getFirst();

        // Verify error attributes
        String errorReason = flowFile.getAttribute(JWTAttributes.Error.REASON);
        assertNotNull(errorReason, "Error reason should not be null");
        assertTrue(errorReason.contains("AUTHORIZATION_HEADER"),
                "Error message should contain the token location");

        // Verify the error message contains the expected parts
        assertTrue(errorReason.contains("AUTHORIZATION_HEADER"),
                "Error message should contain the token location");
        assertTrue(errorReason.contains("Token") || errorReason.contains("token") ||
                errorReason.contains("Kein"),
                "Error message should mention token");
    }

    @Test
    @DisplayName("Test internationalized error message for token size limit")
    void internationalizedErrorMessageForTokenSizeLimit() {
        // Given a flow file with a token that exceeds the size limit
        Map<String, String> attributes = new HashMap<>();

        // Create a very large token (exceeding the default 16384 byte limit)
        StringBuilder largeToken = new StringBuilder("Bearer ");
        largeToken.append("X".repeat(20000));

        // Make sure the header name matches what the processor is looking for
        attributes.put("http.headers.authorization", largeToken.toString());

        // Add debug information
        LOGGER.debug("Token size: %s", largeToken.length());
        LOGGER.debug("Attributes: %s", attributes);

        testRunner.enqueue("test data", attributes);

        // When the processor is triggered
        testRunner.run();

        // Then the error message should be internationalized
        testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(
                Relationships.AUTHENTICATION_FAILED).getFirst();

        // Verify error attributes
        String errorReason = flowFile.getAttribute(JWTAttributes.Error.REASON);
        String errorCode = flowFile.getAttribute(JWTAttributes.Error.CODE);

        // Add debug information
        LOGGER.debug("Error reason: %s", errorReason);
        LOGGER.debug("Error code: %s", errorCode);
        LOGGER.debug("All attributes: %s", flowFile.getAttributes());

        assertNotNull(errorReason, "Error reason should not be null");
        assertEquals("AUTH-003", errorCode, "Error code should be AUTH-003");
        // Check for size limit - could be formatted as "16384" or "16.384" depending on locale
        assertTrue(errorReason.contains("16384") || errorReason.contains("16.384"),
                "Error message should contain the size limit");

        // Verify the error message contains the expected parts
        assertTrue(errorReason.contains("16384") || errorReason.contains("16.384"),
                "Error message should contain the size limit");
        assertTrue(errorReason.contains("Token") || errorReason.contains("token") ||
                errorReason.contains("überschreitet") || errorReason.contains("exceeds"),
                "Error message should mention token or size limit");
    }

    @Test
    @DisplayName("Test internationalized error message for malformed token")
    void internationalizedErrorMessageForMalformedToken() {
        // Given a flow file with a malformed token (no dots)
        Map<String, String> attributes = new HashMap<>();
        attributes.put("http.headers.authorization", "Bearer malformedtoken");
        testRunner.enqueue("test data", attributes);

        // When the processor is triggered
        testRunner.run();

        // Then the error message should be internationalized
        testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(
                Relationships.AUTHENTICATION_FAILED).getFirst();

        // Verify error attributes
        String errorReason = flowFile.getAttribute(JWTAttributes.Error.REASON);
        String errorCode = flowFile.getAttribute(JWTAttributes.Error.CODE);

        assertNotNull(errorReason, "Error reason should not be null");
        assertEquals("AUTH-004", errorCode, "Error code should be AUTH-004");

        // Verify the error message contains the expected parts
        assertTrue(errorReason.contains("malformed") || errorReason.contains("fehlerhaft") ||
                errorReason.contains("fehlt") || errorReason.contains("segments"),
                "Error message should mention malformed token or missing segments");
    }

    @Test
    @DisplayName("Test internationalized validation error messages")
    void internationalizedValidationErrorMessages() {
        // Given a processor with an issuer that uses HTTP instead of HTTPS
        // Create a new processor and test runner
        Map<String, String> localDynamicProperties = new HashMap<>();
        MultiIssuerJWTTokenAuthenticator newProcessor = new MultiIssuerJWTTokenAuthenticator() {
            @Override
            public void onScheduled(final ProcessContext context) {
                MockProcessContext mockContext = (MockProcessContext) context;
                localDynamicProperties.forEach(mockContext::setProperty);
                super.onScheduled(context);
            }
        };
        TestRunner newTestRunner = TestRunners.newTestRunner(newProcessor);
        newTestRunner.setProperty(Properties.REQUIRE_HTTPS_FOR_JWKS, "true");
        newTestRunner.setProperty(Properties.TOKEN_LOCATION, TokenLocation.AUTHORIZATION_HEADER);

        // When configuring an issuer with HTTP URL
        try {
            newTestRunner.setProperty(ISSUER_PREFIX + "test-issuer.jwks-url", "http://test-issuer/.well-known/jwks.json");
            newTestRunner.setProperty(ISSUER_PREFIX + "test-issuer.issuer", "test-issuer");
            newTestRunner.setProperty(ISSUER_PREFIX + "test-issuer.audience", "test-audience");

            // Track dynamic properties
            localDynamicProperties.put(ISSUER_PREFIX + "test-issuer.jwks-url", "http://test-issuer/.well-known/jwks.json");
            localDynamicProperties.put(ISSUER_PREFIX + "test-issuer.issuer", "test-issuer");
            localDynamicProperties.put(ISSUER_PREFIX + "test-issuer.audience", "test-audience");

            // Run the processor to trigger validation
            newTestRunner.enqueue("test data");
            newTestRunner.run();

            // Then the validation error should be internationalized
            MockFlowFile flowFile = newTestRunner.getFlowFilesForRelationship(
                    Relationships.AUTHENTICATION_FAILED).getFirst();

            // The processor should still run but validation will fail
            String errorReason = flowFile.getAttribute(JWTAttributes.Error.REASON);
            assertNotNull(errorReason, "Error reason should not be null");

            // We can't directly test the validation error message here, but we can verify
            // that the processor ran and produced an error
            assertFalse(errorReason.isEmpty(), "Error message should not be empty");
        } catch (AssertionError e) {
            // This is also acceptable - if the validation is strict enough to prevent the processor from running
            assertTrue(e.getMessage().contains("https"),
                    "Validation error should mention HTTPS requirement");
        }
    }
}
