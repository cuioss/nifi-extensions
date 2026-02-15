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
package de.cuioss.nifi.jwt.config;

import de.cuioss.nifi.jwt.JWTPropertyKeys;
import de.cuioss.nifi.jwt.i18n.I18nResolver;
import de.cuioss.nifi.jwt.i18n.NiFiI18nResolver;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.processor.util.StandardValidators;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Locale;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("IssuerPropertyDescriptorFactory")
class IssuerPropertyDescriptorFactoryTest {

    private IssuerPropertyDescriptorFactory factory;

    @BeforeEach
    void setUp() {
        I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);
        factory = new IssuerPropertyDescriptorFactory(resolver);
    }

    @Nested
    @DisplayName("Constructor")
    class ConstructorTests {

        @Test
        @DisplayName("Should throw NullPointerException for null i18nResolver")
        void shouldRejectNullResolver() {
            // Act & Assert
            assertThrows(NullPointerException.class,
                    () -> new IssuerPropertyDescriptorFactory(null),
                    "Constructor should reject null i18nResolver");
        }
    }

    @Nested
    @DisplayName("JWKS Type Descriptor")
    class JwksTypeDescriptorTests {

        @Test
        @DisplayName("Should create JWKS type descriptor with allowable values")
        void shouldCreateJwksTypeDescriptor() {
            // Arrange
            String name = "test.jwks.type";
            String displayName = "JWKS Type";
            String issuerName = "testIssuer";

            // Act
            PropertyDescriptor descriptor = factory.createDescriptor(
                    name, issuerName, JWTPropertyKeys.Issuer.JWKS_TYPE, displayName);

            // Assert
            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(name, descriptor.getName(), "Name should match");
            assertEquals(displayName, descriptor.getDisplayName(), "Display name should match");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
            assertEquals("url", descriptor.getDefaultValue(), "Default value should be 'url'");
            assertNotNull(descriptor.getAllowableValues(), "Should have allowable values");
            assertEquals(3, descriptor.getAllowableValues().size(), "Should have 3 allowable values");
        }

        @Test
        @DisplayName("Should have correct allowable values for JWKS type")
        void shouldHaveCorrectAllowableValues() {
            // Arrange
            String name = "test.jwks.type";

            // Act
            PropertyDescriptor descriptor = factory.createDescriptor(
                    name, "issuer", JWTPropertyKeys.Issuer.JWKS_TYPE, "Type");

            // Assert
            var allowableValues = descriptor.getAllowableValues();
            assertTrue(allowableValues.stream().anyMatch(v -> v.getValue().equals("url")),
                    "Should allow 'url'");
            assertTrue(allowableValues.stream().anyMatch(v -> v.getValue().equals("file")),
                    "Should allow 'file'");
            assertTrue(allowableValues.stream().anyMatch(v -> v.getValue().equals("memory")),
                    "Should allow 'memory'");
        }
    }

    @Nested
    @DisplayName("JWKS URL Descriptor")
    class JwksUrlDescriptorTests {

        @Test
        @DisplayName("Should create JWKS URL descriptor with URL validator")
        void shouldCreateJwksUrlDescriptor() {
            // Arrange
            String name = "test.jwks.url";
            String displayName = "JWKS URL";
            String issuerName = "testIssuer";

            // Act
            PropertyDescriptor descriptor = factory.createDescriptor(
                    name, issuerName, JWTPropertyKeys.Issuer.JWKS_URL, displayName);

            // Assert
            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(name, descriptor.getName(), "Name should match");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
            assertNotNull(descriptor.getValidators(), "Should have validators");
            assertTrue(descriptor.getValidators().contains(StandardValidators.URL_VALIDATOR),
                    "Should have URL validator");
        }
    }

    @Nested
    @DisplayName("JWKS File Descriptor")
    class JwksFileDescriptorTests {

        @Test
        @DisplayName("Should create JWKS file descriptor with FILE_EXISTS validator")
        void shouldCreateJwksFileDescriptor() {
            // Arrange
            String name = "test.jwks.file";
            String displayName = "JWKS File";
            String issuerName = "testIssuer";

            // Act
            PropertyDescriptor descriptor = factory.createDescriptor(
                    name, issuerName, JWTPropertyKeys.Issuer.JWKS_FILE, displayName);

            // Assert
            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(name, descriptor.getName(), "Name should match");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
            assertTrue(descriptor.getValidators().contains(StandardValidators.FILE_EXISTS_VALIDATOR),
                    "Should have FILE_EXISTS validator");
        }
    }

    @Nested
    @DisplayName("JWKS Content Descriptor")
    class JwksContentDescriptorTests {

        @Test
        @DisplayName("Should create JWKS content descriptor")
        void shouldCreateJwksContentDescriptor() {
            // Arrange
            String name = "test.jwks.content";
            String displayName = "JWKS Content";
            String issuerName = "testIssuer";

            // Act
            PropertyDescriptor descriptor = factory.createDescriptor(
                    name, issuerName, JWTPropertyKeys.Issuer.JWKS_CONTENT, displayName);

            // Assert
            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(name, descriptor.getName(), "Name should match");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
            assertTrue(descriptor.getValidators().contains(StandardValidators.NON_EMPTY_VALIDATOR),
                    "Should have NON_EMPTY validator");
        }
    }

    @Nested
    @DisplayName("Issuer Name Descriptor")
    class IssuerNameDescriptorTests {

        @Test
        @DisplayName("Should create issuer name descriptor with NON_EMPTY validator")
        void shouldCreateIssuerNameDescriptor() {
            // Arrange
            String name = "test.issuer";
            String displayName = "Issuer Name";
            String issuerName = "testIssuer";

            // Act
            PropertyDescriptor descriptor = factory.createDescriptor(
                    name, issuerName, JWTPropertyKeys.Issuer.ISSUER_NAME, displayName);

            // Assert
            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(name, descriptor.getName(), "Name should match");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
            assertTrue(descriptor.getValidators().contains(StandardValidators.NON_EMPTY_VALIDATOR),
                    "Should have NON_EMPTY validator");
        }
    }

    @Nested
    @DisplayName("Audience Descriptor")
    class AudienceDescriptorTests {

        @Test
        @DisplayName("Should create audience descriptor")
        void shouldCreateAudienceDescriptor() {
            // Arrange
            String name = "test.audience";
            String displayName = "Audience";
            String issuerName = "testIssuer";

            // Act
            PropertyDescriptor descriptor = factory.createDescriptor(
                    name, issuerName, JWTPropertyKeys.Issuer.AUDIENCE, displayName);

            // Assert
            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(name, descriptor.getName(), "Name should match");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
            assertTrue(descriptor.getValidators().contains(StandardValidators.NON_EMPTY_VALIDATOR),
                    "Should have NON_EMPTY validator");
        }
    }

    @Nested
    @DisplayName("Client ID Descriptor")
    class ClientIdDescriptorTests {

        @Test
        @DisplayName("Should create client ID descriptor")
        void shouldCreateClientIdDescriptor() {
            // Arrange
            String name = "test.client.id";
            String displayName = "Client ID";
            String issuerName = "testIssuer";

            // Act
            PropertyDescriptor descriptor = factory.createDescriptor(
                    name, issuerName, JWTPropertyKeys.Issuer.CLIENT_ID, displayName);

            // Assert
            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(name, descriptor.getName(), "Name should match");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
            assertTrue(descriptor.getValidators().contains(StandardValidators.NON_EMPTY_VALIDATOR),
                    "Should have NON_EMPTY validator");
        }
    }

    @Nested
    @DisplayName("Default Descriptor")
    class DefaultDescriptorTests {

        @Test
        @DisplayName("Should create default descriptor for unknown key")
        void shouldCreateDefaultDescriptor() {
            // Arrange
            String name = "test.unknown.property";
            String displayName = "Unknown Property";
            String issuerName = "testIssuer";
            String unknownKey = "unknown-property-key";

            // Act
            PropertyDescriptor descriptor = factory.createDescriptor(
                    name, issuerName, unknownKey, displayName);

            // Assert
            assertNotNull(descriptor, "Descriptor should not be null");
            assertEquals(name, descriptor.getName(), "Name should match");
            assertFalse(descriptor.isRequired(), "Should not be required");
            assertTrue(descriptor.isDynamic(), "Should be dynamic");
            assertTrue(descriptor.getValidators().contains(StandardValidators.NON_EMPTY_VALIDATOR),
                    "Should have NON_EMPTY validator");
        }
    }

    @Nested
    @DisplayName("Parameter Validation")
    class ParameterValidationTests {

        @Test
        @DisplayName("Should throw NullPointerException for null propertyDescriptorName")
        void shouldRejectNullPropertyDescriptorName() {
            // Act & Assert
            assertThrows(NullPointerException.class,
                    () -> factory.createDescriptor(null, "issuer", "key", "display"),
                    "Should reject null propertyDescriptorName");
        }

        @Test
        @DisplayName("Should throw NullPointerException for null issuerName")
        void shouldRejectNullIssuerName() {
            // Act & Assert
            assertThrows(NullPointerException.class,
                    () -> factory.createDescriptor("name", null, "key", "display"),
                    "Should reject null issuerName");
        }

        @Test
        @DisplayName("Should throw NullPointerException for null propertyKey")
        void shouldRejectNullPropertyKey() {
            // Act & Assert
            assertThrows(NullPointerException.class,
                    () -> factory.createDescriptor("name", "issuer", null, "display"),
                    "Should reject null propertyKey");
        }

        @Test
        @DisplayName("Should throw NullPointerException for null displayName")
        void shouldRejectNullDisplayName() {
            // Act & Assert
            assertThrows(NullPointerException.class,
                    () -> factory.createDescriptor("name", "issuer", "key", null),
                    "Should reject null displayName");
        }
    }

    @Nested
    @DisplayName("Common Descriptor Properties")
    class CommonDescriptorPropertiesTests {

        @Test
        @DisplayName("All descriptors should be dynamic")
        void allDescriptorsShouldBeDynamic() {
            // Arrange & Act
            var jwksType = factory.createDescriptor("n1", "i", JWTPropertyKeys.Issuer.JWKS_TYPE, "d");
            var jwksUrl = factory.createDescriptor("n2", "i", JWTPropertyKeys.Issuer.JWKS_URL, "d");
            var jwksFile = factory.createDescriptor("n3", "i", JWTPropertyKeys.Issuer.JWKS_FILE, "d");
            var jwksContent = factory.createDescriptor("n4", "i", JWTPropertyKeys.Issuer.JWKS_CONTENT, "d");
            var issuerName = factory.createDescriptor("n5", "i", JWTPropertyKeys.Issuer.ISSUER_NAME, "d");
            var audience = factory.createDescriptor("n6", "i", JWTPropertyKeys.Issuer.AUDIENCE, "d");
            var clientId = factory.createDescriptor("n7", "i", JWTPropertyKeys.Issuer.CLIENT_ID, "d");
            var defaultDesc = factory.createDescriptor("n8", "i", "unknown", "d");

            // Assert
            assertTrue(jwksType.isDynamic(), "JWKS_TYPE should be dynamic");
            assertTrue(jwksUrl.isDynamic(), "JWKS_URL should be dynamic");
            assertTrue(jwksFile.isDynamic(), "JWKS_FILE should be dynamic");
            assertTrue(jwksContent.isDynamic(), "JWKS_CONTENT should be dynamic");
            assertTrue(issuerName.isDynamic(), "ISSUER_NAME should be dynamic");
            assertTrue(audience.isDynamic(), "AUDIENCE should be dynamic");
            assertTrue(clientId.isDynamic(), "CLIENT_ID should be dynamic");
            assertTrue(defaultDesc.isDynamic(), "Default descriptor should be dynamic");
        }

        @Test
        @DisplayName("All descriptors should not be required")
        void allDescriptorsShouldNotBeRequired() {
            // Arrange & Act
            var jwksType = factory.createDescriptor("n1", "i", JWTPropertyKeys.Issuer.JWKS_TYPE, "d");
            var jwksUrl = factory.createDescriptor("n2", "i", JWTPropertyKeys.Issuer.JWKS_URL, "d");
            var jwksFile = factory.createDescriptor("n3", "i", JWTPropertyKeys.Issuer.JWKS_FILE, "d");
            var jwksContent = factory.createDescriptor("n4", "i", JWTPropertyKeys.Issuer.JWKS_CONTENT, "d");
            var issuerName = factory.createDescriptor("n5", "i", JWTPropertyKeys.Issuer.ISSUER_NAME, "d");
            var audience = factory.createDescriptor("n6", "i", JWTPropertyKeys.Issuer.AUDIENCE, "d");
            var clientId = factory.createDescriptor("n7", "i", JWTPropertyKeys.Issuer.CLIENT_ID, "d");

            // Assert
            assertFalse(jwksType.isRequired(), "JWKS_TYPE should not be required");
            assertFalse(jwksUrl.isRequired(), "JWKS_URL should not be required");
            assertFalse(jwksFile.isRequired(), "JWKS_FILE should not be required");
            assertFalse(jwksContent.isRequired(), "JWKS_CONTENT should not be required");
            assertFalse(issuerName.isRequired(), "ISSUER_NAME should not be required");
            assertFalse(audience.isRequired(), "AUDIENCE should not be required");
            assertFalse(clientId.isRequired(), "CLIENT_ID should not be required");
        }
    }
}
