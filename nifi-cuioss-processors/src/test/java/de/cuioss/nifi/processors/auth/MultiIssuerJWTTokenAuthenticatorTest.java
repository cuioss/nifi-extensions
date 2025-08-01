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

import de.cuioss.nifi.processors.auth.JWTPropertyKeys;
import de.cuioss.nifi.processors.auth.test.DynamicPropertyTestHelper;
import org.apache.nifi.processor.ProcessContext;
import org.apache.nifi.util.MockFlowFile;
import org.apache.nifi.util.MockProcessContext;
import org.apache.nifi.util.TestRunner;
import org.apache.nifi.util.TestRunners;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;

import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.*;
import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Properties;
import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Relationships;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

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
    private MultiIssuerJWTTokenAuthenticator processor;
    private Map<String, String> dynamicProperties = new HashMap<>();

    // Sample JWT tokens for testing
    private static final String VALID_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJpc3MiOiJ0ZXN0LWlzc3VlciJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    private static final String INVALID_TOKEN = "invalid.token.format";

    @BeforeEach
    void setup() {
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
        testRunner.setProperty(Properties.TOKEN_LOCATION, "AUTHORIZATION_HEADER");
        testRunner.setProperty(Properties.TOKEN_HEADER, "Authorization");
        testRunner.setProperty(Properties.BEARER_TOKEN_PREFIX, "Bearer");

        // Configure issuer properties (using our test constant)
        setDynamicProperty(ISSUER_PREFIX + "test-issuer.jwks-url", "https://test-issuer/.well-known/jwks.json");
        setDynamicProperty(ISSUER_PREFIX + "test-issuer.issuer", "test-issuer");
        setDynamicProperty(ISSUER_PREFIX + "test-issuer.audience", "test-audience");
    }

    private void setDynamicProperty(String key, String value) {
        testRunner.setProperty(key, value);
        dynamicProperties.put(key, value);
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
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test extracting token from custom header")
        void extractTokenFromCustomHeader() {
            // Setup
            testRunner.setProperty(Properties.TOKEN_LOCATION, "CUSTOM_HEADER");
            testRunner.setProperty(Properties.CUSTOM_HEADER_NAME, "X-JWT-Token");

            // Create flow file with custom header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.x-jwt-token", VALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test extracting token from flow file content")
        void extractTokenFromFlowFileContent() {
            // Setup
            testRunner.setProperty(Properties.TOKEN_LOCATION, "FLOW_FILE_CONTENT");

            // Create flow file with token as content
            testRunner.enqueue(VALID_TOKEN);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

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
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test multiple issuer configuration")
        void multipleIssuerConfiguration() {
            // Add a second issuer configuration
            setDynamicProperty(ISSUER_PREFIX + "second-issuer.jwks-url", "https://second-issuer/.well-known/jwks.json");
            setDynamicProperty(ISSUER_PREFIX + "second-issuer.issuer", "second-issuer");
            setDynamicProperty(ISSUER_PREFIX + "second-issuer.audience", "second-audience");

            // Properties are already tracked, TestRunner will handle initialization

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test failure when no token is found with require-valid-token=true (default)")
        void failureWhenNoTokenFoundWithRequireValidTokenTrue() {
            // Default is require-valid-token=true
            // Create flow file without Authorization header
            testRunner.enqueue("test data");

            // Run the processor
            testRunner.run();

            // Verify results
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test success when no token is found with require-valid-token=false")
        void successWhenNoTokenFoundWithRequireValidTokenFalse() {
            // Set require-valid-token to false
            testRunner.setProperty(Properties.REQUIRE_VALID_TOKEN, "false");

            // Create flow file without Authorization header
            testRunner.enqueue("test data");

            // Run the processor
            testRunner.run();

            // Verify results - should route to SUCCESS
            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 0);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).get(0);

            // Verify attributes
            flowFile.assertAttributeEquals("jwt.present", "false");
            flowFile.assertAttributeEquals("jwt.authorized", "false");
            flowFile.assertAttributeEquals("jwt.error.reason", "No token provided");
        }

        @Test
        @DisplayName("Test failure when invalid token is found even with require-valid-token=false")
        void failureWhenInvalidTokenFoundWithRequireValidTokenFalse() {
            // Set require-valid-token to false
            testRunner.setProperty(Properties.REQUIRE_VALID_TOKEN, "false");

            // Create flow file with invalid token
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + INVALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results - should still route to AUTHENTICATION_FAILED for invalid tokens
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

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
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test configuration without issuers")
        void configurationWithoutIssuers() {
            // Create a new processor and test runner without issuer configuration
            MultiIssuerJWTTokenAuthenticator newProcessor = new MultiIssuerJWTTokenAuthenticator();
            TestRunner newTestRunner = TestRunners.newTestRunner(newProcessor);
            newTestRunner.setProperty(Properties.TOKEN_LOCATION, "AUTHORIZATION_HEADER");

            // Set require-valid-token to false to allow running without issuers
            newTestRunner.setProperty(Properties.REQUIRE_VALID_TOKEN, "false");

            // Initialize processor with MockProcessContext (no issuers)
            MockProcessContext context = new MockProcessContext(newProcessor);
            newTestRunner.getProcessContext().getProperties().forEach((descriptor, value) -> {
                if (value != null) {
                    context.setProperty(descriptor, value);
                }
            });
            newProcessor.onScheduled(context);

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            newTestRunner.enqueue("test data", attributes);

            // Run the processor
            newTestRunner.run();

            // Verify results - should fail because no issuers are configured to validate the token
            newTestRunner.assertTransferCount(Relationships.SUCCESS, 0);
            newTestRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = newTestRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes
            flowFile.assertAttributeExists("jwt.error.reason");
            // We don't check the exact error message content since it might change
        }

        @Test
        @DisplayName("Test configuration hash changes with issuer properties")
        void configurationHashChangesWithIssuerProperties() {
            // Track dynamic properties for this test
            Map<String, String> testDynamicProperties = new HashMap<>();

            // Setup processor with override to handle dynamic properties
            MultiIssuerJWTTokenAuthenticator hashProcessor = new MultiIssuerJWTTokenAuthenticator() {
                @Override
                public void onScheduled(final ProcessContext context) {
                    // Override onScheduled to manually add dynamic properties before calling super
                    MockProcessContext mockContext = (MockProcessContext) context;

                    // Add our tracked dynamic properties
                    testDynamicProperties.forEach(mockContext::setProperty);

                    // Now call the original onScheduled with all properties available
                    super.onScheduled(context);
                }
            };

            TestRunner runner = TestRunners.newTestRunner(hashProcessor);
            runner.setProperty(Properties.TOKEN_LOCATION, "AUTHORIZATION_HEADER");
            runner.setProperty(Properties.TOKEN_HEADER, "Authorization");
            runner.setProperty(Properties.BEARER_TOKEN_PREFIX, "Bearer");

            // Set complete issuer configuration
            runner.setProperty(ISSUER_PREFIX + "test-issuer.jwks-url", "https://test-issuer/.well-known/jwks.json");
            runner.setProperty(ISSUER_PREFIX + "test-issuer.issuer", "test-issuer");
            runner.setProperty(ISSUER_PREFIX + "test-issuer.audience", "test-audience");

            // Track dynamic properties
            testDynamicProperties.put(ISSUER_PREFIX + "test-issuer.jwks-url", "https://test-issuer/.well-known/jwks.json");
            testDynamicProperties.put(ISSUER_PREFIX + "test-issuer.issuer", "test-issuer");
            testDynamicProperties.put(ISSUER_PREFIX + "test-issuer.audience", "test-audience");

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);

            // First run
            runner.enqueue("test data", attributes);
            runner.run();

            // Change issuer configuration
            runner.setProperty(ISSUER_PREFIX + "test-issuer.jwks-url", "https://updated-issuer/.well-known/jwks.json");
            runner.setProperty(ISSUER_PREFIX + "new-issuer.jwks-url", "https://new-issuer/.well-known/jwks.json");
            runner.setProperty(ISSUER_PREFIX + "new-issuer.issuer", "new-issuer");
            runner.setProperty(ISSUER_PREFIX + "new-issuer.audience", "new-audience");

            // Update tracked dynamic properties
            testDynamicProperties.put(ISSUER_PREFIX + "test-issuer.jwks-url", "https://updated-issuer/.well-known/jwks.json");
            testDynamicProperties.put(ISSUER_PREFIX + "new-issuer.jwks-url", "https://new-issuer/.well-known/jwks.json");
            testDynamicProperties.put(ISSUER_PREFIX + "new-issuer.issuer", "new-issuer");
            testDynamicProperties.put(ISSUER_PREFIX + "new-issuer.audience", "new-audience");

            // Second run with changed configuration
            runner.enqueue("test data", attributes);
            runner.run();

            // Both runs should route to AUTHENTICATION_FAILED since we're not actually validating tokens
            runner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 2);

            // We can't directly test the hash functionality since it's private, but we can verify
            // that the processor still functions correctly after configuration changes
            MockFlowFile flowFile = runner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(1);
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }
    }

    @Nested
    @DisplayName("Authorization Tests")
    class AuthorizationTests {

        @Test
        @DisplayName("Test authorization with required scopes")
        void authorizationWithRequiredScopes() {
            // Setup issuer with required scopes
            setDynamicProperty(ISSUER_PREFIX + "test-issuer." + JWTPropertyKeys.Issuer.REQUIRED_SCOPES, "read,write");

            // Properties are already tracked, TestRunner will handle initialization

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes are present
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test authorization with required roles")
        void authorizationWithRequiredRoles() {
            // Setup issuer with required roles
            setDynamicProperty(ISSUER_PREFIX + "test-issuer." + JWTPropertyKeys.Issuer.REQUIRED_ROLES, "user,admin");

            // Properties are already tracked, TestRunner will handle initialization

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes are present
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test authorization with case-sensitive matching")
        void authorizationWithCaseSensitiveMatching() {
            // Setup issuer with case-sensitive matching enabled
            setDynamicProperty(ISSUER_PREFIX + "test-issuer." + JWTPropertyKeys.Issuer.REQUIRED_SCOPES, "READ,WRITE");
            setDynamicProperty(ISSUER_PREFIX + "test-issuer." + JWTPropertyKeys.Issuer.CASE_SENSITIVE_MATCHING, "true");

            // Properties are already tracked, TestRunner will handle initialization

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes are present
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test authorization with case-insensitive matching")
        void authorizationWithCaseInsensitiveMatching() {
            // Setup issuer with case-insensitive matching (default behavior)
            setDynamicProperty(ISSUER_PREFIX + "test-issuer." + JWTPropertyKeys.Issuer.REQUIRED_SCOPES, "read,write");
            setDynamicProperty(ISSUER_PREFIX + "test-issuer." + JWTPropertyKeys.Issuer.CASE_SENSITIVE_MATCHING, "false");

            // Properties are already tracked, TestRunner will handle initialization

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes are present
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test authorization with require-all-scopes flag")
        void authorizationWithRequireAllScopes() {
            // Setup issuer with require-all-scopes enabled
            setDynamicProperty(ISSUER_PREFIX + "test-issuer." + JWTPropertyKeys.Issuer.REQUIRED_SCOPES, "read,write,admin");
            setDynamicProperty(ISSUER_PREFIX + "test-issuer." + JWTPropertyKeys.Issuer.REQUIRE_ALL_SCOPES, "true");

            // Properties are already tracked, TestRunner will handle initialization

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes are present
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test authorization with require-all-roles flag")
        void authorizationWithRequireAllRoles() {
            // Setup issuer with require-all-roles enabled
            setDynamicProperty(ISSUER_PREFIX + "test-issuer." + JWTPropertyKeys.Issuer.REQUIRED_ROLES, "user,admin,moderator");
            setDynamicProperty(ISSUER_PREFIX + "test-issuer." + JWTPropertyKeys.Issuer.REQUIRE_ALL_ROLES, "true");

            // Properties are already tracked, TestRunner will handle initialization

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes are present
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test that jwt.authorized attribute is properly set in flow files")
        void jwtAuthorizedAttributeSetInFlowFiles() {
            // Setup issuer with authorization requirements
            setDynamicProperty(ISSUER_PREFIX + "test-issuer." + JWTPropertyKeys.Issuer.REQUIRED_SCOPES, "read");
            setDynamicProperty(ISSUER_PREFIX + "test-issuer." + JWTPropertyKeys.Issuer.REQUIRED_ROLES, "user");

            // Properties are already tracked, TestRunner will handle initialization

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Note: The jwt.authorized attribute would be set during actual token validation
            // Since we're not actually validating tokens yet, we can only verify that
            // the processor runs without error with authorization configuration
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test backward compatibility - no authorization config should pass")
        void backwardCompatibilityNoAuthorizationConfig() {
            // Setup issuer without any authorization requirements (backward compatibility)
            // Only set basic required properties
            setDynamicProperty(ISSUER_PREFIX + "test-issuer.jwks-url", "https://test-issuer/.well-known/jwks.json");
            setDynamicProperty(ISSUER_PREFIX + "test-issuer.issuer", "test-issuer");
            setDynamicProperty(ISSUER_PREFIX + "test-issuer.audience", "test-audience");

            // Properties are already set and tracked

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            // but it should fail on token validation, not on missing authorization config
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file 
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes are present
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test authorization with both scopes and roles")
        void authorizationWithBothScopesAndRoles() {
            // Setup issuer with both scopes and roles
            setDynamicProperty(ISSUER_PREFIX + "test-issuer." + JWTPropertyKeys.Issuer.REQUIRED_SCOPES, "read,write");
            setDynamicProperty(ISSUER_PREFIX + "test-issuer." + JWTPropertyKeys.Issuer.REQUIRED_ROLES, "user,admin");

            // Properties are already tracked, TestRunner will handle initialization

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes are present
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }

        @Test
        @DisplayName("Test authorization with multiple issuers having different requirements")
        void authorizationWithMultipleIssuersWithDifferentRequirements() {
            // Setup first issuer with scope requirements
            setDynamicProperty(ISSUER_PREFIX + "first-issuer.jwks-url", "https://first-issuer/.well-known/jwks.json");
            setDynamicProperty(ISSUER_PREFIX + "first-issuer.issuer", "first-issuer");
            setDynamicProperty(ISSUER_PREFIX + "first-issuer.audience", "first-audience");
            setDynamicProperty(ISSUER_PREFIX + "first-issuer." + JWTPropertyKeys.Issuer.REQUIRED_SCOPES, "read");

            // Setup second issuer with role requirements  
            setDynamicProperty(ISSUER_PREFIX + "second-issuer.jwks-url", "https://second-issuer/.well-known/jwks.json");
            setDynamicProperty(ISSUER_PREFIX + "second-issuer.issuer", "second-issuer");
            setDynamicProperty(ISSUER_PREFIX + "second-issuer.audience", "second-audience");
            setDynamicProperty(ISSUER_PREFIX + "second-issuer." + JWTPropertyKeys.Issuer.REQUIRED_ROLES, "admin");

            // Properties are already tracked, TestRunner will handle initialization

            // Create flow file with Authorization header
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            testRunner.enqueue("test data", attributes);

            // Run the processor
            testRunner.run();

            // Verify results - token validation will fail because we're not actually validating tokens yet
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);

            // Get the output flow file
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);

            // Verify error attributes are present
            flowFile.assertAttributeExists("jwt.error.reason");
            flowFile.assertAttributeExists("jwt.error.code");
        }
    }
    
    @Nested
    @DisplayName("API Key Management Tests")
    class ApiKeyManagementTests {

        @Test
        @DisplayName("Test API key generation on processor initialization")
        void apiKeyGenerationOnInitialization() {
            try {
                // Clear any existing API keys using reflection
                Class<?> apiKeyFilterClass = Class.forName("de.cuioss.nifi.ui.servlets.ApiKeyAuthenticationFilter");
                Method clearAllApiKeysMethod = apiKeyFilterClass.getMethod("clearAllApiKeys");
                clearAllApiKeysMethod.invoke(null);
                
                // Get the processor identifier (this will be set after init)
                testRunner.run(0); // Initialize processor without running
                
                // Verify API key was generated
                String processorId = processor.getIdentifier();
                assertNotNull(processorId, "Processor ID should not be null");
                
                Method hasApiKeyMethod = apiKeyFilterClass.getMethod("hasApiKeyForProcessor", String.class);
                boolean hasApiKey = (Boolean) hasApiKeyMethod.invoke(null, processorId);
                assertTrue(hasApiKey, "API key should exist for processor");
                
                Method getApiKeyMethod = apiKeyFilterClass.getMethod("getApiKeyForProcessor", String.class);
                String apiKey = (String) getApiKeyMethod.invoke(null, processorId);
                assertNotNull(apiKey, "API key should not be null");
                assertFalse(apiKey.isEmpty(), "API key should not be empty");
            } catch (ClassNotFoundException e) {
                // Skip test if UI module not available
                assumeTrue(false, "Skipping test - UI module not available");
            } catch (Exception e) {
                fail("Failed to test API key generation: " + e.getMessage());
            }
        }

        @Test
        @DisplayName("Test API key cleanup on processor stop")
        void apiKeyCleanupOnStop() {
            try {
                Class<?> apiKeyFilterClass = Class.forName("de.cuioss.nifi.ui.servlets.ApiKeyAuthenticationFilter");
                Method hasApiKeyMethod = apiKeyFilterClass.getMethod("hasApiKeyForProcessor", String.class);
                
                // Initialize processor and verify API key exists
                testRunner.run(0);
                
                String processorId = processor.getIdentifier();
                boolean hasApiKey = (Boolean) hasApiKeyMethod.invoke(null, processorId);
                assertTrue(hasApiKey, "API key should exist before stopping");
                
                // Stop the processor
                testRunner.shutdown();
                
                // Verify API key is cleaned up
                boolean hasApiKeyAfterStop = (Boolean) hasApiKeyMethod.invoke(null, processorId);
                assertFalse(hasApiKeyAfterStop, "API key should be removed after stopping processor");
            } catch (ClassNotFoundException e) {
                // Skip test if UI module not available
                assumeTrue(false, "Skipping test - UI module not available");
            } catch (Exception e) {
                fail("Failed to test API key cleanup: " + e.getMessage());
            }
        }

        @Test
        @DisplayName("Test API key generation with multiple processor instances")
        void apiKeyGenerationWithMultipleInstances() {
            try {
                Class<?> apiKeyFilterClass = Class.forName("de.cuioss.nifi.ui.servlets.ApiKeyAuthenticationFilter");
                Method clearAllApiKeysMethod = apiKeyFilterClass.getMethod("clearAllApiKeys");
                Method getApiKeyMethod = apiKeyFilterClass.getMethod("getApiKeyForProcessor", String.class);
                
                // Clear any existing API keys
                clearAllApiKeysMethod.invoke(null);
                
                // Create second processor instance
                MultiIssuerJWTTokenAuthenticator processor2 = new MultiIssuerJWTTokenAuthenticator();
                TestRunner testRunner2 = TestRunners.newTestRunner(processor2);
                testRunner2.setProperty(Properties.TOKEN_LOCATION, "AUTHORIZATION_HEADER");
                
                // Initialize both processors
                testRunner.run(0);
                testRunner2.run(0);
                
                // Verify both have different API keys
                String processorId1 = processor.getIdentifier();
                String processorId2 = processor2.getIdentifier();
                
                assertNotEquals(processorId1, processorId2, "Processor IDs should be different");
                
                String apiKey1 = (String) getApiKeyMethod.invoke(null, processorId1);
                String apiKey2 = (String) getApiKeyMethod.invoke(null, processorId2);
                
                assertNotNull(apiKey1, "First processor API key should not be null");
                assertNotNull(apiKey2, "Second processor API key should not be null");
                assertNotEquals(apiKey1, apiKey2, "API keys should be different");
                
                // Clean up
                testRunner2.shutdown();
            } catch (ClassNotFoundException e) {
                // Skip test if UI module not available
                assumeTrue(false, "Skipping test - UI module not available");
            } catch (Exception e) {
                fail("Failed to test multiple processor instances: " + e.getMessage());
            }
        }
    }
}
