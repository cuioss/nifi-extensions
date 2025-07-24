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

import de.cuioss.nifi.processors.auth.config.ConfigurationManager;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.components.PropertyValue;
import org.apache.nifi.processor.ProcessContext;
import org.apache.nifi.processor.ProcessorInitializationContext;
import org.apache.nifi.util.MockFlowFile;
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

    // Sample JWT tokens for testing
    private static final String VALID_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJpc3MiOiJ0ZXN0LWlzc3VlciJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    private static final String ISSUER_PREFIX = "issuer.";

    @BeforeEach
    void setup() {
        processor = new MultiIssuerJWTTokenAuthenticator();
        testRunner = TestRunners.newTestRunner(processor);

        // Configure basic properties
        testRunner.setProperty(Properties.TOKEN_LOCATION, "AUTHORIZATION_HEADER");
        testRunner.setProperty(Properties.TOKEN_HEADER, "Authorization");
        testRunner.setProperty(Properties.BEARER_TOKEN_PREFIX, "Bearer");
    }

    @Nested
    @DisplayName("Extract Claims Tests")
    class ExtractClaimsTests {

        @Test
        @DisplayName("Test extractClaims method with full token content")
        void testExtractClaimsFullContent() throws Exception {
            // Use reflection to test private method
            Method extractClaimsMethod = MultiIssuerJWTTokenAuthenticator.class
                    .getDeclaredMethod("extractClaims", de.cuioss.jwt.validation.domain.token.AccessTokenContent.class);
            extractClaimsMethod.setAccessible(true);

            // Create a mock AccessTokenContent
            var mockToken = mock(de.cuioss.jwt.validation.domain.token.AccessTokenContent.class);
            when(mockToken.getSubject()).thenReturn(Optional.of("test-subject"));
            when(mockToken.getIssuer()).thenReturn("test-issuer");
            when(mockToken.getExpirationTime()).thenReturn(OffsetDateTime.now().plusSeconds(3600));
            when(mockToken.getRoles()).thenReturn(Arrays.asList("role1", "role2"));
            when(mockToken.getGroups()).thenReturn(Arrays.asList("group1", "group2"));
            when(mockToken.getScopes()).thenReturn(Arrays.asList("scope1", "scope2"));

            // Mock claims
            Map<String, de.cuioss.jwt.validation.domain.claim.ClaimValue> claims = new HashMap<>();
            var claimValue = mock(de.cuioss.jwt.validation.domain.claim.ClaimValue.class);
            when(claimValue.getOriginalString()).thenReturn("claim-value");
            claims.put("custom-claim", claimValue);
            when(mockToken.getClaims()).thenReturn(claims);

            // Execute the method
            @SuppressWarnings("unchecked")
            Map<String, String> result = (Map<String, String>) extractClaimsMethod.invoke(processor, mockToken);

            // Verify results
            assertNotNull(result);
            assertEquals("true", result.get(JWTAttributes.Token.AUTHORIZATION_PASSED));
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
        void testExtractClaimsMinimalContent() throws Exception {
            // Use reflection to test private method
            Method extractClaimsMethod = MultiIssuerJWTTokenAuthenticator.class
                    .getDeclaredMethod("extractClaims", de.cuioss.jwt.validation.domain.token.AccessTokenContent.class);
            extractClaimsMethod.setAccessible(true);

            // Create a mock AccessTokenContent with minimal data
            var mockToken = mock(de.cuioss.jwt.validation.domain.token.AccessTokenContent.class);
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
            assertEquals("true", result.get(JWTAttributes.Token.AUTHORIZATION_PASSED));
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
        void testCleanupResources() throws Exception {
            // Initialize the processor first
            ProcessorInitializationContext initContext = mock(ProcessorInitializationContext.class);
            when(initContext.getIdentifier()).thenReturn("test-processor-id");
            processor.initialize(initContext);

            // Schedule the processor to set up resources
            ProcessContext context = mock(ProcessContext.class);
            when(context.getProperty(any(PropertyDescriptor.class))).thenReturn(mock(PropertyValue.class));
            processor.onScheduled(context);

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
        void testCleanupResourcesWithException() throws Exception {
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
        void testLogSecurityMetrics() throws Exception {
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
        void testLogSecurityMetricsWithCounter() throws Exception {
            // Set up a mock security event counter
            Field counterField = MultiIssuerJWTTokenAuthenticator.class.getDeclaredField("securityEventCounter");
            counterField.setAccessible(true);
            var mockCounter = mock(de.cuioss.jwt.validation.security.SecurityEventCounter.class);
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
        void testGenerateConfigurationHash() throws Exception {
            // Set up issuer configurations
            testRunner.setProperty(ISSUER_PREFIX + "test-issuer.jwks-url", "https://test-issuer/.well-known/jwks.json");
            testRunner.setProperty(ISSUER_PREFIX + "test-issuer.issuer", "test-issuer");
            testRunner.setProperty(ISSUER_PREFIX + "test-issuer.audience", "test-audience");

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
            testRunner.setProperty(ISSUER_PREFIX + "test-issuer.audience", "new-audience");

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
        void testLoadExternalConfigurations() throws Exception {
            // Mock ConfigurationManager
            ConfigurationManager mockConfigManager = mock(ConfigurationManager.class);
            when(mockConfigManager.isConfigurationLoaded()).thenReturn(true);
            when(mockConfigManager.getIssuerIds()).thenReturn(Arrays.asList("external-issuer"));
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
        void testCleanupRemovedIssuers() throws Exception {
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
        void testValidateToken() throws Exception {
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
            testRunner.setProperty(ISSUER_PREFIX + "test-issuer.jwks-url", "https://test-issuer/.well-known/jwks.json");
            testRunner.setProperty(ISSUER_PREFIX + "test-issuer.issuer", "test-issuer");

            // Schedule the processor to load configurations
            processor.onScheduled(context);

            // Test with valid token format - expect TokenValidationException wrapped in InvocationTargetException
            InvocationTargetException ex = assertThrows(InvocationTargetException.class,
                    () -> validateMethod.invoke(processor, VALID_TOKEN, context));

            // Verify the cause is TokenValidationException
            assertInstanceOf(de.cuioss.jwt.validation.exception.TokenValidationException.class, ex.getCause());
            assertTrue(ex.getCause().getMessage().contains("No healthy issuer configuration found"));
        }
    }

    @Nested
    @DisplayName("Lifecycle Method Tests")
    class LifecycleMethodTests {

        @Test
        @DisplayName("Test onStopped lifecycle method")
        void testOnStoppedWithMultipleExecutions() throws Exception {
            // Initialize and start the processor
            ProcessorInitializationContext initContext = mock(ProcessorInitializationContext.class);
            when(initContext.getIdentifier()).thenReturn("test-processor-id");
            processor.initialize(initContext);

            ProcessContext context = mock(ProcessContext.class);
            when(context.getProperty(any(PropertyDescriptor.class))).thenReturn(mock(PropertyValue.class));
            processor.onScheduled(context);

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
        void testExtractTokenFromLargeContent() throws Exception {
            // Configure for content extraction
            testRunner.setProperty(Properties.TOKEN_LOCATION, "FLOW_FILE_CONTENT");

            // Create large content with token embedded
            StringBuilder largeContent = new StringBuilder();
            for (int i = 0; i < 1000; i++) {
                largeContent.append("padding-data-");
            }
            largeContent.append(VALID_TOKEN);
            for (int i = 0; i < 1000; i++) {
                largeContent.append("-more-padding");
            }

            // Enqueue and run
            testRunner.enqueue(largeContent.toString());
            testRunner.run();

            // Verify processing
            testRunner.assertTransferCount(Relationships.AUTHENTICATION_FAILED, 1);
            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.AUTHENTICATION_FAILED).get(0);
            flowFile.assertAttributeExists("jwt.error.reason");
        }

        @Test
        @DisplayName("Test getSupportedDynamicPropertyDescriptor with various inputs")
        void testGetSupportedDynamicPropertyDescriptorEdgeCases() {
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