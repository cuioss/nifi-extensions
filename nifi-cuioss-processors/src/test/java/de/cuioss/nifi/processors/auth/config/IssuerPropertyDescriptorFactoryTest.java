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
package de.cuioss.nifi.processors.auth.config;

import de.cuioss.nifi.processors.auth.i18n.I18nResolver;
import org.apache.nifi.components.PropertyDescriptor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static de.cuioss.nifi.processors.auth.JWTPropertyKeys.Issuer;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link IssuerPropertyDescriptorFactory}.
 * Uses a simple I18nResolver stub instead of Mockito.
 */
@DisplayName("IssuerPropertyDescriptorFactory Tests")
class IssuerPropertyDescriptorFactoryTest {

    private IssuerPropertyDescriptorFactory factory;

    /**
     * Simple I18nResolver stub that returns "Translated: " + key for testing.
     */
    private static final I18nResolver STUB_RESOLVER = new I18nResolver() {
        @Override
        public String getTranslatedString(String key) {
            return "Translated: " + key;
        }

        @Override
        public String getTranslatedString(String key, Object... args) {
            return "Translated: " + key;
        }
    };

    @BeforeEach
    void setUp() {
        factory = new IssuerPropertyDescriptorFactory(STUB_RESOLVER);
    }

    @Nested
    @DisplayName("JWKS Type Descriptor Tests")
    class JwksTypeDescriptorTests {

        @Test
        @DisplayName("Should create JWKS type descriptor with correct properties")
        void shouldCreateJwksTypeDescriptor() {
            // Arrange
            String propertyName = "issuer.test.jwks-type";
            String displayName = "Test Issuer JWKS Type";

            // Act
            PropertyDescriptor descriptor = factory.createDescriptor(
                    propertyName, "test", Issuer.JWKS_TYPE, displayName);

            // Assert
            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(propertyName, descriptor.getName(), "Property name should match");
            assertEquals(displayName, descriptor.getDisplayName(), "Display name should match");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
            assertEquals("url", descriptor.getDefaultValue(), "Default value should be 'url'");

            // Verify allowable values
            assertNotNull(descriptor.getAllowableValues(), "Should have allowable values");
            assertEquals(3, descriptor.getAllowableValues().size(), "Should have 3 allowable values");
            assertTrue(descriptor.getAllowableValues().stream()
                    .anyMatch(av -> "url".equals(av.getValue())), "Should allow 'url'");
            assertTrue(descriptor.getAllowableValues().stream()
                    .anyMatch(av -> "file".equals(av.getValue())), "Should allow 'file'");
            assertTrue(descriptor.getAllowableValues().stream()
                    .anyMatch(av -> "memory".equals(av.getValue())), "Should allow 'memory'");
        }

        @Test
        @DisplayName("Should include description for JWKS type")
        void shouldIncludeDescriptionForJwksType() {
            PropertyDescriptor descriptor = factory.createDescriptor(
                    "issuer.test.jwks-type", "test", Issuer.JWKS_TYPE, "Display Name");

            assertNotNull(descriptor.getDescription(), "Description should not be null");
            assertTrue(descriptor.getDescription().contains("JWKS source type"),
                    "Description should mention JWKS source type");
        }
    }

    @Nested
    @DisplayName("JWKS File Descriptor Tests")
    class JwksFileDescriptorTests {

        @Test
        @DisplayName("Should create JWKS file descriptor with correct properties")
        void shouldCreateJwksFileDescriptor() {
            String propertyName = "issuer.test.jwks-file";
            String displayName = "Test Issuer JWKS File";

            PropertyDescriptor descriptor = factory.createDescriptor(
                    propertyName, "test", Issuer.JWKS_FILE, displayName);

            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(propertyName, descriptor.getName(), "Property name should match");
            assertEquals(displayName, descriptor.getDisplayName(), "Display name should match");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
            assertNotNull(descriptor.getValidators(), "Should have validators");
            assertFalse(descriptor.getValidators().isEmpty(), "Should have at least one validator");
        }

        @Test
        @DisplayName("Should include description for JWKS file")
        void shouldIncludeDescriptionForJwksFile() {
            PropertyDescriptor descriptor = factory.createDescriptor(
                    "issuer.test.jwks-file", "test", Issuer.JWKS_FILE, "Display Name");

            assertNotNull(descriptor.getDescription(), "Description should not be null");
            assertTrue(descriptor.getDescription().contains("File path"),
                    "Description should mention file path");
            assertTrue(descriptor.getDescription().contains("JWKS"),
                    "Description should mention JWKS");
        }
    }

    @Nested
    @DisplayName("JWKS Content Descriptor Tests")
    class JwksContentDescriptorTests {

        @Test
        @DisplayName("Should create JWKS content descriptor with correct properties")
        void shouldCreateJwksContentDescriptor() {
            String propertyName = "issuer.test.jwks-content";
            String displayName = "Test Issuer JWKS Content";

            PropertyDescriptor descriptor = factory.createDescriptor(
                    propertyName, "test", Issuer.JWKS_CONTENT, displayName);

            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(propertyName, descriptor.getName(), "Property name should match");
            assertEquals(displayName, descriptor.getDisplayName(), "Display name should match");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
            assertNotNull(descriptor.getValidators(), "Should have validators");
            assertFalse(descriptor.getValidators().isEmpty(), "Should have at least one validator");
        }

        @Test
        @DisplayName("Should include description for JWKS content")
        void shouldIncludeDescriptionForJwksContent() {
            PropertyDescriptor descriptor = factory.createDescriptor(
                    "issuer.test.jwks-content", "test", Issuer.JWKS_CONTENT, "Display Name");

            assertNotNull(descriptor.getDescription(), "Description should not be null");
            assertTrue(descriptor.getDescription().contains("JWKS JSON content"),
                    "Description should mention JWKS JSON content");
            assertTrue(descriptor.getDescription().contains("in-memory"),
                    "Description should mention in-memory");
        }
    }

    @Nested
    @DisplayName("Default Descriptor Tests")
    class DefaultDescriptorTests {

        @Test
        @DisplayName("Should create default descriptor for unknown property key")
        void shouldCreateDefaultDescriptor() {
            String propertyName = "issuer.test.unknown-property";
            String displayName = "Unknown Property";

            PropertyDescriptor descriptor = factory.createDescriptor(
                    propertyName, "test", "unknown-key", displayName);

            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(propertyName, descriptor.getName(), "Property name should match");
            assertEquals(propertyName, descriptor.getDisplayName(),
                    "Display name should default to property name");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
            assertNotNull(descriptor.getValidators(), "Should have validators");
            assertFalse(descriptor.getValidators().isEmpty(), "Should have at least one validator");
        }

        @Test
        @DisplayName("Should include generic description for default descriptor")
        void shouldIncludeGenericDescriptionForDefault() {
            PropertyDescriptor descriptor = factory.createDescriptor(
                    "issuer.test.custom", "test", "custom-key", "Custom Property");

            assertNotNull(descriptor.getDescription(), "Description should not be null");
            assertTrue(descriptor.getDescription().contains("Dynamic property"),
                    "Description should mention dynamic property");
            assertTrue(descriptor.getDescription().contains("issuer configuration"),
                    "Description should mention issuer configuration");
        }
    }

    @Nested
    @DisplayName("JWKS URL Descriptor Tests")
    class JwksUrlDescriptorTests {

        @Test
        @DisplayName("Should create JWKS URL descriptor with URL validator")
        void shouldCreateJwksUrlDescriptor() {
            String propertyName = "issuer.test.jwks-url";
            String displayName = "Test Issuer JWKS URL";

            PropertyDescriptor descriptor = factory.createDescriptor(
                    propertyName, "test", Issuer.JWKS_URL, displayName);

            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(propertyName, descriptor.getName(), "Property name should match");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
            assertNotNull(descriptor.getValidators(), "Should have validators");
        }
    }

    @Nested
    @DisplayName("Issuer Name Descriptor Tests")
    class IssuerNameDescriptorTests {

        @Test
        @DisplayName("Should create issuer name descriptor")
        void shouldCreateIssuerNameDescriptor() {
            String propertyName = "issuer.test.issuer";
            String displayName = "Test Issuer Name";

            PropertyDescriptor descriptor = factory.createDescriptor(
                    propertyName, "test", Issuer.ISSUER_NAME, displayName);

            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(propertyName, descriptor.getName(), "Property name should match");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
        }
    }

    @Nested
    @DisplayName("Audience and Client ID Descriptor Tests")
    class AudienceClientIdDescriptorTests {

        @Test
        @DisplayName("Should create audience descriptor")
        void shouldCreateAudienceDescriptor() {
            String propertyName = "issuer.test.audience";
            String displayName = "Test Audience";

            PropertyDescriptor descriptor = factory.createDescriptor(
                    propertyName, "test", Issuer.AUDIENCE, displayName);

            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(propertyName, descriptor.getName(), "Property name should match");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
        }

        @Test
        @DisplayName("Should create client ID descriptor")
        void shouldCreateClientIdDescriptor() {
            String propertyName = "issuer.test.client-id";
            String displayName = "Test Client ID";

            PropertyDescriptor descriptor = factory.createDescriptor(
                    propertyName, "test", Issuer.CLIENT_ID, displayName);

            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(propertyName, descriptor.getName(), "Property name should match");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
        }
    }

    @Nested
    @DisplayName("Boolean Descriptor Tests")
    class BooleanDescriptorTests {

        @Test
        @DisplayName("Should create bypass authorization descriptor with boolean validator")
        void shouldCreateBypassAuthorizationDescriptor() {
            String propertyName = "issuer.test.bypass-authorization";
            String displayName = "Bypass Authorization";

            PropertyDescriptor descriptor = factory.createDescriptor(
                    propertyName, "test", Issuer.BYPASS_AUTHORIZATION, displayName);

            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(propertyName, descriptor.getName(), "Property name should match");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
            assertEquals("false", descriptor.getDefaultValue(), "Default should be false");

            assertNotNull(descriptor.getAllowableValues(), "Should have allowable values");
            assertEquals(2, descriptor.getAllowableValues().size(), "Should have 2 allowable values");
        }

        @Test
        @DisplayName("Should create case sensitive matching descriptor")
        void shouldCreateCaseSensitiveMatchingDescriptor() {
            PropertyDescriptor descriptor = factory.createDescriptor(
                    "issuer.test.case-sensitive", "test",
                    Issuer.CASE_SENSITIVE_MATCHING, "Case Sensitive");

            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals("false", descriptor.getDefaultValue(), "Default should be false");
            assertNotNull(descriptor.getAllowableValues(), "Should have allowable values");
        }
    }

    @Nested
    @DisplayName("Integration Tests")
    class IntegrationTests {

        @Test
        @DisplayName("Should handle all known issuer property keys")
        void shouldHandleAllKnownPropertyKeys() {
            String[] knownKeys = {
                    Issuer.JWKS_TYPE,
                    Issuer.JWKS_URL,
                    Issuer.JWKS_FILE,
                    Issuer.JWKS_CONTENT,
                    Issuer.ISSUER_NAME,
                    Issuer.AUDIENCE,
                    Issuer.CLIENT_ID,
                    Issuer.REQUIRED_SCOPES,
                    Issuer.REQUIRED_ROLES,
                    Issuer.REQUIRE_ALL_SCOPES,
                    Issuer.REQUIRE_ALL_ROLES,
                    Issuer.CASE_SENSITIVE_MATCHING,
                    Issuer.BYPASS_AUTHORIZATION
            };

            for (String key : knownKeys) {
                PropertyDescriptor descriptor = factory.createDescriptor(
                        "issuer.test." + key, "test", key, "Display Name");

                assertNotNull(descriptor, "Descriptor should be created for key: " + key);
                assertTrue(descriptor.isDynamic(), "Descriptor should be dynamic for key: " + key);
            }
        }
    }
}
