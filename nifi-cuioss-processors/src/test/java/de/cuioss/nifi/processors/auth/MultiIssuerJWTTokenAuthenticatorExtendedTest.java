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

import de.cuioss.jwt.validation.domain.claim.ClaimValue;
import de.cuioss.jwt.validation.domain.token.AccessTokenContent;
import de.cuioss.jwt.validation.exception.TokenValidationException;
import de.cuioss.jwt.validation.security.SecurityEventCounter;
import de.cuioss.nifi.processors.auth.config.ConfigurationManager;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.components.PropertyValue;
import org.apache.nifi.processor.ProcessContext;
import org.apache.nifi.processor.ProcessorInitializationContext;
import org.apache.nifi.util.MockFlowFile;
import org.apache.nifi.util.MockProcessContext;
import org.apache.nifi.util.TestRunner;
import org.apache.nifi.util.TestRunners;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Properties;
import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Relationships;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Extended test class for {@link MultiIssuerJWTTokenAuthenticator} to improve code coverage.
 * This class focuses on testing the uncovered methods identified by JaCoCo coverage report.
 */
class MultiIssuerJWTTokenAuthenticatorExtendedTest {

    private TestRunner testRunner;
    private MultiIssuerJWTTokenAuthenticator processor;
    private Map<String, String> dynamicProperties = new HashMap<>();

    // Sample JWT tokens for testing
    private static final String VALID_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJpc3MiOiJ0ZXN0LWlzc3VlciJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    private static final String ISSUER_PREFIX = "issuer.";

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

        // Configure a default test issuer
        setDynamicProperty(ISSUER_PREFIX + "test-issuer.jwks-url", "https://test-issuer/.well-known/jwks.json");
        setDynamicProperty(ISSUER_PREFIX + "test-issuer.issuer", "test-issuer");
        setDynamicProperty(ISSUER_PREFIX + "test-issuer.audience", "test-audience");
    }

    private void setDynamicProperty(String key, String value) {
        testRunner.setProperty(key, value);
        dynamicProperties.put(key, value);
    }

    @Nested
    @DisplayName("Extract Claims Tests")
    class ExtractClaimsTests {

        @Test
        @DisplayName("Test extractClaims method with full token content")
        void extractClaimsFullContent() throws Exception {
            // Use reflection to test private method
            Method extractClaimsMethod = MultiIssuerJWTTokenAuthenticator.class
                    .getDeclaredMethod("extractClaims", AccessTokenContent.class);
            extractClaimsMethod.setAccessible(true);

            // Create a mock AccessTokenContent
            var mockToken = mock(AccessTokenContent.class);
            when(mockToken.getSubject()).thenReturn(Optional.of("test-subject"));
            when(mockToken.getIssuer()).thenReturn("test-issuer");
            when(mockToken.getExpirationTime()).thenReturn(OffsetDateTime.now().plusSeconds(3600));
            when(mockToken.getRoles()).thenReturn(Arrays.asList("role1", "role2"));
            when(mockToken.getGroups()).thenReturn(Arrays.asList("group1", "group2"));
            when(mockToken.getScopes()).thenReturn(Arrays.asList("scope1", "scope2"));

            // Mock claims
            Map<String, ClaimValue> claims = new HashMap<>();
            var claimValue = mock(ClaimValue.class);
            when(claimValue.getOriginalString()).thenReturn("claim-value");
            claims.put("custom-claim", claimValue);
            when(mockToken.getClaims()).thenReturn(claims);

            // Execute the method
            @SuppressWarnings("unchecked")
            Map<String, String> result = (Map<String, String>) extractClaimsMethod.invoke(processor, mockToken);

            // Verify results
            assertNotNull(result);
            // The AUTHORIZATION_PASSED attribute is not set in extractClaims, it's set elsewhere
            assertEquals("test-subject", result.get(JWTAttributes.Token.SUBJECT));
            assertEquals("test-issuer", result.get(JWTAttributes.Token.ISSUER));
            assertEquals("role1,role2", result.get(JWTAttributes.Authorization.ROLES));
            assertEquals("group1,group2", result.get(JWTAttributes.Authorization.GROUPS));
            assertEquals("scope1,scope2", result.get(JWTAttributes.Authorization.SCOPES));
            assertEquals("claim-value", result.get(JWTAttributes.Content.PREFIX + "custom-claim"));
            assertNotNull(result.get(JWTAttributes.Token.VALIDATED_AT));
            assertNotNull(result.get(JWTAttributes.Token.EXPIRATION));
        }

        @Test
        @DisplayName("Test extractClaims method with minimal token content")
        void extractClaimsMinimalContent() throws Exception {
            // Use reflection to test private method
            Method extractClaimsMethod = MultiIssuerJWTTokenAuthenticator.class
                    .getDeclaredMethod("extractClaims", AccessTokenContent.class);
            extractClaimsMethod.setAccessible(true);

            // Create a mock AccessTokenContent with minimal data
            var mockToken = mock(AccessTokenContent.class);
            when(mockToken.getSubject()).thenReturn(Optional.empty());
            when(mockToken.getIssuer()).thenReturn("test-issuer");
            when(mockToken.getExpirationTime()).thenReturn(OffsetDateTime.now().plusSeconds(3600));
            when(mockToken.getRoles()).thenReturn(Collections.emptyList());
            when(mockToken.getGroups()).thenReturn(Collections.emptyList());
            when(mockToken.getScopes()).thenReturn(Collections.emptyList());
            when(mockToken.getClaims()).thenReturn(Collections.emptyMap());

            // Execute the method
            @SuppressWarnings("unchecked")
            Map<String, String> result = (Map<String, String>) extractClaimsMethod.invoke(processor, mockToken);

            // Verify results
            assertNotNull(result);
            // The AUTHORIZATION_PASSED attribute is not set in extractClaims, it's set elsewhere
            assertEquals("", result.get(JWTAttributes.Token.SUBJECT));
            assertEquals("test-issuer", result.get(JWTAttributes.Token.ISSUER));
            assertFalse(result.containsKey(JWTAttributes.Authorization.ROLES));
            assertFalse(result.containsKey(JWTAttributes.Authorization.GROUPS));
            assertFalse(result.containsKey(JWTAttributes.Authorization.SCOPES));
        }
    }

    @Nested
    @DisplayName("Cleanup Resources Tests")
    class CleanupResourcesTests {

        @Test
        @DisplayName("Test cleanupResources method")
        void cleanupResources() throws Exception {
            // Initialize the processor first
            ProcessorInitializationContext initContext = mock(ProcessorInitializationContext.class);
            when(initContext.getIdentifier()).thenReturn("test-processor-id");
            processor.initialize(initContext);

            // Schedule the processor to set up resources using testRunner
            // Don't call onScheduled directly with a mock context as it expects MockProcessContext
            testRunner.run(0); // This will call onScheduled with proper context

            // Use reflection to access private fields and method
            Field tokenValidatorField = MultiIssuerJWTTokenAuthenticator.class.getDeclaredField("tokenValidator");
            tokenValidatorField.setAccessible(true);
            AtomicReference<Object> tokenValidator = (AtomicReference<Object>) tokenValidatorField.get(processor);

            // Set a mock token validator
            tokenValidator.set(new Object());
            assertNotNull(tokenValidator.get());

            // Call cleanupResources using reflection
            Method cleanupMethod = MultiIssuerJWTTokenAuthenticator.class.getDeclaredMethod("cleanupResources");
            cleanupMethod.setAccessible(true);
            cleanupMethod.invoke(processor);

            // Verify tokenValidator was nulled out
            assertNull(tokenValidator.get());
        }

        @Test
        @DisplayName("Test cleanupResources handles exceptions gracefully")
        void cleanupResourcesWithException() throws Exception {
            // This test verifies that cleanup doesn't throw exceptions
            Method cleanupMethod = MultiIssuerJWTTokenAuthenticator.class.getDeclaredMethod("cleanupResources");
            cleanupMethod.setAccessible(true);

            // Should not throw even when tokenValidator is null
            assertDoesNotThrow(() -> cleanupMethod.invoke(processor));
        }
    }

    @Nested
    @DisplayName("Log Security Metrics Tests")
    class LogSecurityMetricsTests {

        @Test
        @DisplayName("Test logSecurityMetrics method")
        void logSecurityMetrics() throws Exception {
            // Use reflection to test private method
            Method logMetricsMethod = MultiIssuerJWTTokenAuthenticator.class.getDeclaredMethod("logSecurityMetrics");
            logMetricsMethod.setAccessible(true);

            // Set the processedFlowFilesCount using reflection
            Field countField = MultiIssuerJWTTokenAuthenticator.class.getDeclaredField("processedFlowFilesCount");
            countField.setAccessible(true);
            AtomicLong count = (AtomicLong) countField.get(processor);
            count.set(42);

            // Execute the method - should not throw
            assertDoesNotThrow(() -> logMetricsMethod.invoke(processor));
        }

        @Test
        @DisplayName("Test logSecurityMetrics with security event counter")
        void logSecurityMetricsWithCounter() throws Exception {
            // Set up a mock security event counter
            Field counterField = MultiIssuerJWTTokenAuthenticator.class.getDeclaredField("securityEventCounter");
            counterField.setAccessible(true);
            var mockCounter = mock(SecurityEventCounter.class);
            counterField.set(processor, mockCounter);

            // Use reflection to test private method
            Method logMetricsMethod = MultiIssuerJWTTokenAuthenticator.class.getDeclaredMethod("logSecurityMetrics");
            logMetricsMethod.setAccessible(true);

            // Execute the method - should not throw
            assertDoesNotThrow(() -> logMetricsMethod.invoke(processor));
        }
    }

    @Nested
    @DisplayName("Configuration Hash Tests")
    class ConfigurationHashTests {

        @Test
        @DisplayName("Test generateConfigurationHash method")
        void generateConfigurationHash() throws Exception {
            // Set up issuer configurations - these are already set in @BeforeEach
            // but we'll re-set them to be explicit
            setDynamicProperty(ISSUER_PREFIX + "test-issuer.jwks-url", "https://test-issuer/.well-known/jwks.json");
            setDynamicProperty(ISSUER_PREFIX + "test-issuer.issuer", "test-issuer");
            setDynamicProperty(ISSUER_PREFIX + "test-issuer.audience", "test-audience");

            // Use reflection to test private method
            Method hashMethod = MultiIssuerJWTTokenAuthenticator.class
                    .getDeclaredMethod("generateConfigurationHash", ProcessContext.class);
            hashMethod.setAccessible(true);

            ProcessContext context = testRunner.getProcessContext();

            // Generate hash
            String hash1 = (String) hashMethod.invoke(processor, context);
            assertNotNull(hash1);
            assertFalse(hash1.isEmpty());

            // Generate hash again - should be the same
            String hash2 = (String) hashMethod.invoke(processor, context);
            assertEquals(hash1, hash2);

            // Change configuration
            setDynamicProperty(ISSUER_PREFIX + "test-issuer.audience", "new-audience");

            // Generate hash again - should be different
            String hash3 = (String) hashMethod.invoke(processor, context);
            assertNotNull(hash3);
            assertNotEquals(hash1, hash3);
        }
    }

    @Nested
    @DisplayName("External Configuration Loading Tests")
    class ExternalConfigurationTests {

        @Test
        @DisplayName("Test loadExternalConfigurations method")
        void loadExternalConfigurations() throws Exception {
            // Mock ConfigurationManager
            ConfigurationManager mockConfigManager = mock(ConfigurationManager.class);
            when(mockConfigManager.isConfigurationLoaded()).thenReturn(true);
            when(mockConfigManager.getIssuerIds()).thenReturn(List.of("external-issuer"));
            Map<String, String> issuerConfig = new HashMap<>();
            issuerConfig.put("jwks-url", "https://external-issuer/.well-known/jwks.json");
            issuerConfig.put("issuer", "external-issuer");
            when(mockConfigManager.getIssuerProperties("external-issuer")).thenReturn(issuerConfig);

            // Set the mock ConfigurationManager using reflection
            Field configManagerField = MultiIssuerJWTTokenAuthenticator.class.getDeclaredField("configurationManager");
            configManagerField.setAccessible(true);
            configManagerField.set(processor, mockConfigManager);

            // Use reflection to test private method
            Method loadExternalMethod = MultiIssuerJWTTokenAuthenticator.class
                    .getDeclaredMethod("loadExternalConfigurations", Map.class, Set.class);
            loadExternalMethod.setAccessible(true);

            Map<String, Map<String, String>> configurations = new HashMap<>();
            Set<String> trackedKeys = new HashSet<>();

            // Execute the method
            loadExternalMethod.invoke(processor, configurations, trackedKeys);

            // Verify external configuration was loaded
            assertTrue(configurations.containsKey("external-issuer"));
            assertEquals("https://external-issuer/.well-known/jwks.json",
                    configurations.get("external-issuer").get("jwks-url"));
            assertTrue(trackedKeys.contains("external-issuer"));
        }
    }

    @Nested
    @DisplayName("Cleanup Removed Issuers Tests")
    class CleanupRemovedIssuersTests {

        @Test
        @DisplayName("Test cleanupRemovedIssuers method")
        void cleanupRemovedIssuers() throws Exception {
            // Use reflection to access private fields and method
            Field configField = MultiIssuerJWTTokenAuthenticator.class.getDeclaredField("issuerConfigCache");
            configField.setAccessible(true);
            Map<String, Object> issuerConfigs = (Map<String, Object>) configField.get(processor);

            // Add some mock issuer configurations
            issuerConfigs.put("issuer1", new Object());
            issuerConfigs.put("issuer2", new Object());
            issuerConfigs.put("issuer3", new Object());

            Method cleanupMethod = MultiIssuerJWTTokenAuthenticator.class
                    .getDeclaredMethod("cleanupRemovedIssuers", Set.class);
            cleanupMethod.setAccessible(true);

            // Create a set with only issuer1 and issuer2
            Set<String> currentKeys = new HashSet<>(Arrays.asList("issuer1", "issuer2"));

            // Execute cleanup
            cleanupMethod.invoke(processor, currentKeys);

            // Verify issuer3 was removed
            assertEquals(2, issuerConfigs.size());
            assertTrue(issuerConfigs.containsKey("issuer1"));
            assertTrue(issuerConfigs.containsKey("issuer2"));
            assertFalse(issuerConfigs.containsKey("issuer3"));
        }
    }

    @Nested
    @DisplayName("Validate Token Tests")
    class ValidateTokenTests {

        @Test
        @DisplayName("Test validateToken method")
        void validateToken() throws Exception {
            // Initialize the processor
            ProcessorInitializationContext initContext = mock(ProcessorInitializationContext.class);
            when(initContext.getIdentifier()).thenReturn("test-processor-id");
            processor.initialize(initContext);

            // Use reflection to test private method
            Method validateMethod = MultiIssuerJWTTokenAuthenticator.class
                    .getDeclaredMethod("validateToken", String.class, ProcessContext.class);
            validateMethod.setAccessible(true);

            ProcessContext context = mock(ProcessContext.class);
            when(context.getProperty(any(PropertyDescriptor.class))).thenAnswer(invocation -> {
                PropertyValue mockValue = mock(PropertyValue.class);
                when(mockValue.getValue()).thenReturn("test-value");
                return mockValue;
            });

            // Initialize issuer configuration to avoid TokenValidationException
            setDynamicProperty(ISSUER_PREFIX + "test-issuer.jwks-url", "https://test-issuer/.well-known/jwks.json");
            setDynamicProperty(ISSUER_PREFIX + "test-issuer.issuer", "test-issuer");
            setDynamicProperty(ISSUER_PREFIX + "test-issuer.audience", "test-audience");

            // Schedule the processor to load configurations using testRunner
            // Don't call onScheduled directly with a mock context as it expects MockProcessContext
            testRunner.run(0); // This will call onScheduled with proper context

            // Test with HS256 token - expect TokenValidationException for algorithm rejection wrapped in InvocationTargetException
            InvocationTargetException ex = assertThrows(InvocationTargetException.class,
                    () -> validateMethod.invoke(processor, VALID_TOKEN, context));

            // Verify the cause is TokenValidationException since HS256 algorithm is rejected for security reasons
            assertInstanceOf(TokenValidationException.class, ex.getCause());
            String actualMessage = ex.getCause().getMessage();
            // HS256 is rejected by SignatureAlgorithmPreferences, causing algorithm validation to fail
            assertTrue(actualMessage.contains("Failed to validate JWT algorithm"),
                    "Expected algorithm validation failure message, but got: " + actualMessage);
        }
    }

    @Nested
    @DisplayName("Lifecycle Method Tests")
    class LifecycleMethodTests {

        @Test
        @DisplayName("Test onStopped lifecycle method")
        void onStoppedWithMultipleExecutions() throws Exception {
            // Create and enqueue some flow files to process
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + VALID_TOKEN);
            testRunner.enqueue("test data 1", attributes);
            testRunner.enqueue("test data 2", attributes);
            testRunner.enqueue("test data 3", attributes);

            // Run multiple times to increment counter
            testRunner.run(3);

            // Call onStopped
            processor.onStopped();

            // Use reflection to verify processedFlowFilesCount was NOT reset (it's not reset in onStopped)
            Field countField = MultiIssuerJWTTokenAuthenticator.class.getDeclaredField("processedFlowFilesCount");
            countField.setAccessible(true);
            AtomicLong count = (AtomicLong) countField.get(processor);
            // The count should still be 3 since onStopped doesn't reset it
            assertEquals(3, count.get());
        }
    }

    @Nested
    @DisplayName("Edge Case Tests")
    class EdgeCaseTests {

        @Test
        @DisplayName("Test extractTokenFromContent with large content")
        void extractTokenFromLargeContent() {
            // Configure for content extraction
            testRunner.setProperty(Properties.TOKEN_LOCATION, "FLOW_FILE_CONTENT");
            // Also need to set issuer config for content extraction - these are already set in @BeforeEach
            // but we need to ensure they're tracked
            setDynamicProperty(ISSUER_PREFIX + "test-issuer.jwks-url", "https://test-issuer/.well-known/jwks.json");
            setDynamicProperty(ISSUER_PREFIX + "test-issuer.issuer", "test-issuer");
            setDynamicProperty(ISSUER_PREFIX + "test-issuer.audience", "test-audience");

            // Create large content with token embedded
            String largeContent = "padding-data-".repeat(1000) +
                    VALID_TOKEN +
                    "-more-padding".repeat(1000);

            // Enqueue and run
            testRunner.enqueue(largeContent);
            testRunner.run();

            // Verify processing
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).getFirst();
            flowFile.assertAttributeExists("jwt.error.reason");
        }

        @Test
        @DisplayName("Test getSupportedDynamicPropertyDescriptor with various inputs")
        void getSupportedDynamicPropertyDescriptorEdgeCases() {
            // Test with valid issuer property
            PropertyDescriptor descriptor = processor.getSupportedDynamicPropertyDescriptor(ISSUER_PREFIX + "test.jwks-url");
            assertNotNull(descriptor);
            assertFalse(descriptor.isRequired());

            // Test with non-issuer property
            PropertyDescriptor customDescriptor = processor.getSupportedDynamicPropertyDescriptor("custom.property");
            assertNotNull(customDescriptor);
            assertFalse(customDescriptor.isRequired());

            // Test with empty property name
            PropertyDescriptor emptyDescriptor = processor.getSupportedDynamicPropertyDescriptor("");
            assertNotNull(emptyDescriptor);
            assertFalse(emptyDescriptor.isRequired());

            // Test with null - should handle gracefully
            assertThrows(NullPointerException.class, () -> processor.getSupportedDynamicPropertyDescriptor(null));
        }
    }
}