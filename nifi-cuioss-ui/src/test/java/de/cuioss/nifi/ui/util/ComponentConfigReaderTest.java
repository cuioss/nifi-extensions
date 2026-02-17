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
package de.cuioss.nifi.ui.util;

import jakarta.servlet.http.HttpServletRequest;
import org.apache.nifi.web.ComponentDetails;
import org.apache.nifi.web.NiFiWebConfigurationContext;
import org.apache.nifi.web.NiFiWebRequestContext;
import org.apache.nifi.web.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.easymock.EasyMock.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link ComponentConfigReader}.
 * Tests the NiFiWebConfigurationContext-based implementation using EasyMock.
 */
@DisplayName("Component Config Reader Tests")
class ComponentConfigReaderTest {

    private NiFiWebConfigurationContext mockConfigContext;
    private HttpServletRequest mockRequest;
    private ComponentConfigReader reader;

    @BeforeEach
    void setUp() {
        mockConfigContext = createMock(NiFiWebConfigurationContext.class);
        mockRequest = createNiceMock(HttpServletRequest.class);
        expect(mockRequest.getScheme()).andReturn("https").anyTimes();
        replay(mockRequest);
        reader = new ComponentConfigReader(mockConfigContext);
    }

    @Nested
    @DisplayName("Constructor Tests")
    class ConstructorTests {

        @Test
        @DisplayName("Should reject null config context")
        void shouldRejectNullConfigContext() {
            NullPointerException exception = assertThrows(NullPointerException.class,
                    () -> new ComponentConfigReader(null));
            assertTrue(exception.getMessage().contains("configContext must not be null"));
        }

        @Test
        @DisplayName("Should create reader with valid config context")
        void shouldCreateReaderWithValidContext() {
            assertNotNull(new ComponentConfigReader(mockConfigContext));
        }
    }

    @Nested
    @DisplayName("Input Validation Tests")
    class InputValidationTests {

        @Test
        @DisplayName("Should reject null processor ID")
        void shouldRejectNullProcessorId() {
            NullPointerException exception = assertThrows(
                    NullPointerException.class,
                    () -> reader.getProcessorProperties(null, mockRequest));
            assertTrue(exception.getMessage().contains("processorId must not be null"));
        }

        @Test
        @DisplayName("Should reject empty processor ID")
        void shouldRejectEmptyProcessorId() {
            IllegalArgumentException exception = assertThrows(
                    IllegalArgumentException.class,
                    () -> reader.getProcessorProperties("", mockRequest));
            assertTrue(exception.getMessage().contains("Processor ID cannot be empty"));
        }

        @Test
        @DisplayName("Should reject whitespace-only processor ID")
        void shouldRejectWhitespaceProcessorId() {
            IllegalArgumentException exception = assertThrows(
                    IllegalArgumentException.class,
                    () -> reader.getProcessorProperties("   \t\n   ", mockRequest));
            assertTrue(exception.getMessage().contains("Processor ID cannot be empty"));
        }

        @Test
        @DisplayName("Should reject non-UUID processor ID")
        void shouldRejectNonUuidProcessorId() {
            IllegalArgumentException exception = assertThrows(
                    IllegalArgumentException.class,
                    () -> reader.getProcessorProperties("not-a-uuid", mockRequest));
            assertTrue(exception.getMessage().contains("Processor ID must be a valid UUID"));
        }
    }

    @Nested
    @DisplayName("getComponentConfig Tests")
    class GetComponentConfigTests {

        @Test
        @DisplayName("Should return processor config when processor found on first try")
        void shouldReturnProcessorConfig() {
            // Arrange
            String processorId = UUID.randomUUID().toString();
            Map<String, String> properties = Map.of(
                    "rest.gateway.listening.port", "9443",
                    "rest.gateway.ssl.enabled", "false");

            ComponentDetails details = new ComponentDetails.Builder()
                    .id(processorId)
                    .type("de.cuioss.nifi.rest.RestApiGatewayProcessor")
                    .properties(properties)
                    .build();

            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andReturn(details);
            replay(mockConfigContext);

            // Act
            ComponentConfigReader.ComponentConfig config =
                    reader.getComponentConfig(processorId, mockRequest);

            // Assert
            assertEquals(ComponentConfigReader.ComponentType.PROCESSOR, config.type());
            assertEquals("de.cuioss.nifi.rest.RestApiGatewayProcessor", config.componentClass());
            assertEquals("9443", config.properties().get("rest.gateway.listening.port"));
            assertEquals("false", config.properties().get("rest.gateway.ssl.enabled"));
            assertEquals(2, config.properties().size());
            verify(mockConfigContext);
        }

        @Test
        @DisplayName("Should fall back to controller service when processor not found")
        void shouldFallbackToControllerService() {
            // Arrange
            String componentId = UUID.randomUUID().toString();
            Map<String, String> properties = Map.of(
                    "jwt.issuer.url", "https://keycloak.example.com/realms/test");

            ComponentDetails csDetails = new ComponentDetails.Builder()
                    .id(componentId)
                    .type("de.cuioss.nifi.jwt.StandardJwtIssuerConfigService")
                    .properties(properties)
                    .build();

            // First call (processor) throws ResourceNotFoundException
            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andThrow(new ResourceNotFoundException("Processor not found"));
            // Second call (controller service) returns details
            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andReturn(csDetails);
            replay(mockConfigContext);

            // Act
            ComponentConfigReader.ComponentConfig config =
                    reader.getComponentConfig(componentId, mockRequest);

            // Assert
            assertEquals(ComponentConfigReader.ComponentType.CONTROLLER_SERVICE, config.type());
            assertEquals("de.cuioss.nifi.jwt.StandardJwtIssuerConfigService", config.componentClass());
            assertEquals("https://keycloak.example.com/realms/test",
                    config.properties().get("jwt.issuer.url"));
            verify(mockConfigContext);
        }

        @Test
        @DisplayName("Should throw IllegalArgumentException when both APIs fail")
        void shouldThrowWhenBothNotFound() {
            // Arrange
            String componentId = UUID.randomUUID().toString();
            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andThrow(new ResourceNotFoundException("Processor not found"));
            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andThrow(new ResourceNotFoundException("CS not found"));
            replay(mockConfigContext);

            // Act & Assert
            IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                    () -> reader.getComponentConfig(componentId, mockRequest));
            assertTrue(exception.getMessage().contains("Component not found"));
            assertTrue(exception.getMessage().contains("tried both"));
            verify(mockConfigContext);
        }

        @Test
        @DisplayName("Should handle null properties from ComponentDetails")
        void shouldHandleNullProperties() {
            // Arrange
            String processorId = UUID.randomUUID().toString();
            ComponentDetails details = new ComponentDetails.Builder()
                    .id(processorId)
                    .type("SomeProcessor")
                    .build();

            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andReturn(details);
            replay(mockConfigContext);

            // Act
            ComponentConfigReader.ComponentConfig config =
                    reader.getComponentConfig(processorId, mockRequest);

            // Assert
            assertNotNull(config.properties());
            assertTrue(config.properties().isEmpty());
            verify(mockConfigContext);
        }

        @Test
        @DisplayName("Should handle empty properties from ComponentDetails")
        void shouldHandleEmptyProperties() {
            // Arrange
            String processorId = UUID.randomUUID().toString();
            ComponentDetails details = new ComponentDetails.Builder()
                    .id(processorId)
                    .type("SomeProcessor")
                    .properties(Map.of())
                    .build();

            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andReturn(details);
            replay(mockConfigContext);

            // Act
            ComponentConfigReader.ComponentConfig config =
                    reader.getComponentConfig(processorId, mockRequest);

            // Assert
            assertNotNull(config.properties());
            assertTrue(config.properties().isEmpty());
            verify(mockConfigContext);
        }
    }

    @Nested
    @DisplayName("getProcessorProperties Tests")
    class GetProcessorPropertiesTests {

        @Test
        @DisplayName("Should return properties map from component config")
        void shouldReturnPropertiesMap() {
            // Arrange
            String processorId = UUID.randomUUID().toString();
            Map<String, String> expectedProperties = Map.of(
                    "issuer.1.name", "test-issuer",
                    "issuer.1.jwks-url", "https://example.com/jwks");

            ComponentDetails details = new ComponentDetails.Builder()
                    .id(processorId)
                    .type("SomeProcessor")
                    .properties(expectedProperties)
                    .build();

            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andReturn(details);
            replay(mockConfigContext);

            // Act
            Map<String, String> properties = reader.getProcessorProperties(processorId, mockRequest);

            // Assert
            assertEquals(2, properties.size());
            assertEquals("test-issuer", properties.get("issuer.1.name"));
            assertEquals("https://example.com/jwks", properties.get("issuer.1.jwks-url"));
            verify(mockConfigContext);
        }
    }

    @Nested
    @DisplayName("Error Message Quality Tests")
    class ErrorMessageQualityTests {

        @Test
        @DisplayName("Should provide clear error message for null processor ID")
        void shouldProvideClearErrorMessageForNullProcessorId() {
            NullPointerException exception = assertThrows(
                    NullPointerException.class,
                    () -> reader.getProcessorProperties(null, mockRequest));
            assertNotNull(exception.getMessage());
            assertTrue(exception.getMessage().contains("processorId"));
            assertTrue(exception.getMessage().contains("must not be null"));
        }

        @Test
        @DisplayName("Should provide clear error message for empty processor ID")
        void shouldProvideClearErrorMessageForEmptyProcessorId() {
            IllegalArgumentException exception = assertThrows(
                    IllegalArgumentException.class,
                    () -> reader.getProcessorProperties("", mockRequest));
            assertNotNull(exception.getMessage());
            assertTrue(exception.getMessage().contains("Processor ID cannot be empty"));
        }
    }
}
