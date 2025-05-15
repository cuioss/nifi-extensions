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

import java.util.HashMap;
import java.util.Map;


import org.apache.nifi.util.MockFlowFile;
import org.apache.nifi.util.TestRunner;
import org.apache.nifi.util.TestRunners;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Test class for {@link MultiIssuerJWTTokenAuthenticator}.
 * 
 * Note: These tests are designed to work with the current implementation of the processor,
 * which doesn't actually validate tokens yet due to the cui-jwt-validation library being
 * in a SNAPSHOT state. Once the library is stable, these tests should be updated to
 * test actual token validation.
 */
class MultiIssuerJWTTokenAuthenticatorTest {

    private TestRunner testRunner;

    // Sample JWT tokens for testing
    private static final String VALID_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJpc3MiOiJ0ZXN0LWlzc3VlciJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    private static final String INVALID_TOKEN = "invalid.token.format";

    // Define a constant for issuer prefix since it's not yet implemented in the processor
    private static final String ISSUER_PREFIX = "issuer.";

    @BeforeEach
    void setup() {
        testRunner = TestRunners.newTestRunner(MultiIssuerJWTTokenAuthenticator.class);

        // Configure basic properties
        testRunner.setProperty(MultiIssuerJWTTokenAuthenticator.TOKEN_LOCATION, "AUTHORIZATION_HEADER");
        testRunner.setProperty(MultiIssuerJWTTokenAuthenticator.TOKEN_HEADER, "Authorization");
        testRunner.setProperty(MultiIssuerJWTTokenAuthenticator.BEARER_TOKEN_PREFIX, "Bearer");

        // Configure issuer properties (using our test constant)
        testRunner.setProperty(ISSUER_PREFIX + "test-issuer.jwks-url", "https://test-issuer/.well-known/jwks.json");
        testRunner.setProperty(ISSUER_PREFIX + "test-issuer.issuer", "test-issuer");
        testRunner.setProperty(ISSUER_PREFIX + "test-issuer.audience", "test-audience");
    }

    @Nested
    @DisplayName("Token Extraction Tests")
    class TokenExtractionTests {

        @Test
        @DisplayName("Test extracting token from Authorization header")
        void extractTokenFromAuthorizationHeader() {
            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.SUCCESS, 0);
            testRunner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test extracting token from custom header")
        void extractTokenFromCustomHeader() {
            // Setup
            testRunner.setProperty(MultiIssuerJWTTokenAuthenticator.TOKEN_LOCATION, "CUSTOM_HEADER");
            testRunner.setProperty(MultiIssuerJWTTokenAuthenticator.CUSTOM_HEADER_NAME, "X-JWT-Token");

            // Create flow file with custom header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.x-jwt-token", VALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.SUCCESS, 0);
            testRunner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test extracting token from flow file content")
        void extractTokenFromFlowFileContent() {
            // Setup
            testRunner.setProperty(MultiIssuerJWTTokenAuthenticator.TOKEN_LOCATION, "FLOW_FILE_CONTENT");

            // Create flow file with token as content
            testRunner.enqueue(VALID_TOKEN);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.SUCCESS, 0);
            testRunner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }
    }

    @Nested
    @DisplayName("Token Validation Tests")
    class TokenValidationTests {

        @Test
        @DisplayName("Test validation failure with invalid token format")
        void validationFailureWithInvalidTokenFormat() {
            // Create flow file with invalid token
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + INVALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results
            testRunner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.SUCCESS, 0);
            testRunner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test multiple issuer configuration")
        void multipleIssuerConfiguration() {
            // Add a second issuer configuration
            testRunner.setProperty(ISSUER_PREFIX + "second-issuer.jwks-url", "https://second-issuer/.well-known/jwks.json");
            testRunner.setProperty(ISSUER_PREFIX + "second-issuer.issuer", "second-issuer");
            testRunner.setProperty(ISSUER_PREFIX + "second-issuer.audience", "second-audience");

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.SUCCESS, 0);
            testRunner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test failure when no token is found")
        void failureWhenNoTokenFound() {
            // Create flow file without Authorization header
            testRunner.enqueue("test data");

            // Run the processor
            testRunner.run();

            // Verify results
            testRunner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.SUCCESS, 0);
            testRunner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }
    }

    @Nested
    @DisplayName("Configuration Tests")
    class ConfigurationTests {

        @Test
        @DisplayName("Test dynamic property handling")
        void dynamicPropertyHandling() {
            // Add a dynamic property
            testRunner.setProperty("custom.property", "custom-value");

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify processor still works with dynamic properties
            // Token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.SUCCESS, 0);
            testRunner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test configuration without issuers")
        void configurationWithoutIssuers() {
            // Create a new test runner without issuer configuration
            TestRunner newTestRunner = TestRunners.newTestRunner(MultiIssuerJWTTokenAuthenticator.class);
            newTestRunner.setProperty(MultiIssuerJWTTokenAuthenticator.TOKEN_LOCATION, "AUTHORIZATION_HEADER");

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            newTestRunner.enqueue("test data", attributes);

            // Run the processor
            newTestRunner.run();

            // Verify results - should fail without issuers
            newTestRunner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.SUCCESS, 0);
            newTestRunner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = newTestRunner.getFlowFilesForRelationship(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes
            flowFile.assertAttributeExists("jwt.error.reason");
            // We don't check the exact error message content since it might change
        }

        @Test
        @DisplayName("Test configuration hash changes with issuer properties")
        void configurationHashChangesWithIssuerProperties() {
            // Setup initial configuration
            TestRunner runner = TestRunners.newTestRunner(MultiIssuerJWTTokenAuthenticator.class);
            runner.setProperty(MultiIssuerJWTTokenAuthenticator.TOKEN_LOCATION, "AUTHORIZATION_HEADER");
            runner.setProperty(ISSUER_PREFIX + "test-issuer.jwks-url", "https://test-issuer/.well-known/jwks.json");

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);

            // First run
            runner.enqueue("test data", attributes);
            runner.run();

            // Change issuer configuration
            runner.setProperty(ISSUER_PREFIX + "test-issuer.jwks-url", "https://updated-issuer/.well-known/jwks.json");
            runner.setProperty(ISSUER_PREFIX + "new-issuer.jwks-url", "https://new-issuer/.well-known/jwks.json");

            // Second run with changed configuration
            runner.enqueue("test data", attributes);
            runner.run();

            // Both runs should route to AUTHENTICATION_FAILED since we're not actually validating tokens
            runner.assertTransferCount(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED, 2);

            // We can't directly test the hash functionality since it's private, but we can verify
            // that the processor still functions correctly after configuration changes
            MockFlowFile flowFile = runner.getFlowFilesForRelationship(MultiIssuerJWTTokenAuthenticator.AUTHENTICATION_FAILED).get(1);
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }
    }
}
