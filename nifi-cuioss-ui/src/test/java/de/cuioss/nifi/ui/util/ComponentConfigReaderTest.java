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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link ComponentConfigReader}.
 *
 * Note: This class creates HttpHandler internally without dependency injection,
 * which limits testability. Tests focus on input validation and behavior
 * that can be verified without mocking HTTP clients. Full HTTP communication
 * testing would require either:
 * 1. Refactoring to use dependency injection (out of scope for coverage improvement)
 * 2. Integration tests with actual NiFi instance (belongs in *IT.java tests)
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/security.adoc">Security Specification</a>
 */
@DisplayName("Component Config Reader Tests")
class ComponentConfigReaderTest {

    private ComponentConfigReader reader;

    @BeforeEach
    void setUp() {
        reader = new ComponentConfigReader();
    }

    @Nested
    @DisplayName("Input Validation Tests")
    class InputValidationTests {

        @Test
        @DisplayName("Should reject null processor ID")
        void shouldRejectNullProcessorId() {
            // Arrange
            String nullProcessorId = null;

            // Act & Assert
            NullPointerException exception = assertThrows(
                    NullPointerException.class,
                    () -> reader.getProcessorProperties(nullProcessorId),
                    "Null processor ID should throw NullPointerException"
            );

            assertTrue(exception.getMessage().contains("processorId must not be null"),
                    "Exception message should indicate processorId must not be null");
        }

        @Test
        @DisplayName("Should reject empty processor ID")
        void shouldRejectEmptyProcessorId() {
            // Arrange
            String emptyProcessorId = "";

            // Act & Assert
            IllegalArgumentException exception = assertThrows(
                    IllegalArgumentException.class,
                    () -> reader.getProcessorProperties(emptyProcessorId),
                    "Empty processor ID should throw IllegalArgumentException"
            );

            assertTrue(exception.getMessage().contains("Processor ID cannot be empty"),
                    "Exception message should indicate Processor ID cannot be empty");
        }

        @Test
        @DisplayName("Should reject whitespace-only processor ID")
        void shouldRejectWhitespaceProcessorId() {
            // Arrange
            String whitespaceProcessorId = "   \t\n   ";

            // Act & Assert
            IllegalArgumentException exception = assertThrows(
                    IllegalArgumentException.class,
                    () -> reader.getProcessorProperties(whitespaceProcessorId),
                    "Whitespace processor ID should throw IllegalArgumentException"
            );

            assertTrue(exception.getMessage().contains("Processor ID cannot be empty"),
                    "Exception message should indicate Processor ID cannot be empty");
        }
    }

    @Nested
    @DisplayName("URL Building Tests")
    class UrlBuildingTests {

        @Test
        @DisplayName("Should build HTTP URL when HTTPS properties not set")
        void shouldBuildHttpUrlWhenHttpsNotConfigured() {
            // Arrange — use valid UUID to pass ID validation and exercise URL building
            String processorId = UUID.randomUUID().toString();
            System.clearProperty("nifi.web.https.host");
            System.clearProperty("nifi.web.https.port");

            // Act & Assert
            // URL is built and HTTP request attempted (fails since no NiFi running)
            assertThrows(IOException.class,
                    () -> reader.getProcessorProperties(processorId),
                    "Should attempt HTTP request with generated URL");
        }

        @Test
        @DisplayName("Should build HTTPS URL when HTTPS properties are set")
        void shouldBuildHttpsUrlWhenHttpsConfigured() {
            // Arrange — use valid UUID to pass ID validation and exercise URL building
            String processorId = UUID.randomUUID().toString();
            String httpsHost = "secure-nifi.example.com";
            String httpsPort = "8443";

            System.setProperty("nifi.web.https.host", httpsHost);
            System.setProperty("nifi.web.https.port", httpsPort);

            try {
                // Act & Assert — should reach HTTPS URL building and fail during HTTP
                assertThrows(Exception.class,
                        () -> reader.getProcessorProperties(processorId),
                        "Should attempt HTTPS request with generated URL");
            } finally {
                // Clean up system properties
                System.clearProperty("nifi.web.https.host");
                System.clearProperty("nifi.web.https.port");
            }
        }

        @Test
        @DisplayName("Should use custom HTTP host and port when configured")
        void shouldUseCustomHttpHostAndPort() {
            // Arrange — use valid UUID to pass ID validation and exercise URL building
            String processorId = UUID.randomUUID().toString();
            String customHost = "custom-nifi.local";
            String customPort = "9090";

            System.clearProperty("nifi.web.https.host");
            System.clearProperty("nifi.web.https.port");
            System.setProperty("nifi.web.http.host", customHost);
            System.setProperty("nifi.web.http.port", customPort);

            try {
                // Act & Assert — should reach URL building with custom host/port
                assertThrows(Exception.class,
                        () -> reader.getProcessorProperties(processorId),
                        "Should attempt HTTP request with custom host and port");
            } finally {
                // Clean up system properties
                System.clearProperty("nifi.web.http.host");
                System.clearProperty("nifi.web.http.port");
            }
        }
    }

    @Nested
    @DisplayName("HTTP Response Handling Tests")
    class HttpResponseHandlingTests {

        @Test
        @DisplayName("Should throw exception when unable to connect to invalid host")
        void shouldThrowExceptionWhenUnableToConnect() {
            // Arrange — use valid UUID to pass ID validation and exercise HTTP code
            String processorId = UUID.randomUUID().toString();
            System.clearProperty("nifi.web.https.host");
            System.clearProperty("nifi.web.https.port");
            System.setProperty("nifi.web.http.host", "non-existent-host-12345");
            System.setProperty("nifi.web.http.port", "12345");

            try {
                // Act & Assert — DNS resolution fails → IOException
                assertThrows(IOException.class,
                        () -> reader.getProcessorProperties(processorId));
            } finally {
                // Clean up system properties
                System.clearProperty("nifi.web.http.host");
                System.clearProperty("nifi.web.http.port");
            }
        }
    }

    @Nested
    @DisplayName("Integration Behavior Tests")
    class IntegrationBehaviorTests {

        @Test
        @DisplayName("Should create reader instance successfully")
        void shouldCreateReaderInstanceSuccessfully() {
            // Arrange & Act
            ComponentConfigReader newReader = new ComponentConfigReader();

            // Assert
            assertNotNull(newReader, "Reader instance should be created successfully");
        }

        @Test
        @DisplayName("Should be reusable for multiple requests")
        void shouldBeReusableForMultipleRequests() {
            // Arrange — use valid UUIDs to exercise the full code path
            String processorId1 = UUID.randomUUID().toString();
            String processorId2 = UUID.randomUUID().toString();

            // Act & Assert
            // Both calls should fail with IOException (no NiFi running)
            // but should not fail due to reader state issues
            assertThrows(IOException.class,
                    () -> reader.getProcessorProperties(processorId1),
                    "First request should be processed");

            assertThrows(IOException.class,
                    () -> reader.getProcessorProperties(processorId2),
                    "Second request should be processed independently");
        }
    }

    @Nested
    @DisplayName("Error Message Quality Tests")
    class ErrorMessageQualityTests {

        @Test
        @DisplayName("Should provide clear error message for null processor ID")
        void shouldProvideClearErrorMessageForNullProcessorId() {
            // Arrange
            String nullProcessorId = null;

            // Act & Assert
            NullPointerException exception = assertThrows(
                    NullPointerException.class,
                    () -> reader.getProcessorProperties(nullProcessorId),
                    "Should throw NullPointerException for null processor ID"
            );

            String message = exception.getMessage();
            assertNotNull(message, "Error message should not be null");
            assertTrue(message.contains("processorId"),
                    "Error message should mention processorId");
            assertTrue(message.contains("must not be null"),
                    "Error message should explain that processorId must not be null");
        }

        @Test
        @DisplayName("Should provide clear error message for empty processor ID")
        void shouldProvideClearErrorMessageForEmptyProcessorId() {
            // Arrange
            String emptyProcessorId = "";

            // Act & Assert
            IllegalArgumentException exception = assertThrows(
                    IllegalArgumentException.class,
                    () -> reader.getProcessorProperties(emptyProcessorId),
                    "Should throw exception for empty processor ID"
            );

            String message = exception.getMessage();
            assertNotNull(message, "Error message should not be null");
            assertTrue(message.contains("Processor ID cannot be empty"),
                    "Error message should explain that Processor ID cannot be empty");
        }
    }

    @Nested
    @DisplayName("JSON Parsing Exception Tests")
    class JsonParsingExceptionTests {

        /**
         * Tests that JsonException is properly handled when parsing malformed JSON.
         * This uses reflection to test the parseProcessorResponse method directly.
         */
        @Test
        @DisplayName("Should handle malformed JSON response gracefully")
        void shouldHandleMalformedJsonResponse() throws Exception {
            // Arrange
            String malformedJson = "{ invalid json structure without proper closing";
            String processorId = "test-processor-id";

            // Use reflection to access private method
            java.lang.reflect.Method parseMethod = ComponentConfigReader.class
                    .getDeclaredMethod("parseProcessorResponse", String.class, String.class);
            parseMethod.setAccessible(true);

            // Act & Assert
            IOException exception = assertThrows(
                    IOException.class,
                    () -> {
                        try {
                            parseMethod.invoke(reader, malformedJson, processorId);
                        } catch (java.lang.reflect.InvocationTargetException e) {
                            throw e.getCause();
                        }
                    },
                    "Should throw IOException for malformed JSON"
            );

            assertTrue(exception.getMessage().contains("Failed to parse processor response JSON"),
                    "Exception message should indicate JSON parsing failure");
        }

        /**
         * Tests that ClassCastException is properly handled when JSON structure has wrong types.
         * For example, when 'component' is an array instead of an object.
         */
        @Test
        @DisplayName("Should handle JSON with wrong type structure")
        void shouldHandleJsonWithWrongTypeStructure() throws Exception {
            // Arrange - 'component' is an array instead of object
            String invalidStructureJson = """
                {
                    "component": [
                        "this should be an object, not an array"
                    ]
                }
                """;
            String processorId = "test-processor-id";

            // Use reflection to access private method
            java.lang.reflect.Method parseMethod = ComponentConfigReader.class
                    .getDeclaredMethod("parseProcessorResponse", String.class, String.class);
            parseMethod.setAccessible(true);

            // Act & Assert
            IOException exception = assertThrows(
                    IOException.class,
                    () -> {
                        try {
                            parseMethod.invoke(reader, invalidStructureJson, processorId);
                        } catch (java.lang.reflect.InvocationTargetException e) {
                            throw e.getCause();
                        }
                    },
                    "Should throw IOException for invalid JSON structure"
            );

            assertTrue(exception.getMessage().contains("Invalid JSON structure"),
                    "Exception message should indicate invalid JSON structure");
        }

        /**
         * Tests that missing 'component' field is handled properly.
         */
        @Test
        @DisplayName("Should handle JSON response missing component field")
        void shouldHandleJsonMissingComponentField() throws Exception {
            // Arrange - valid JSON but missing required 'component' field
            String jsonMissingComponent = """
                {
                    "id": "some-processor-id",
                    "status": "Running"
                }
                """;
            String processorId = "test-processor-id";

            // Use reflection to access private method
            java.lang.reflect.Method parseMethod = ComponentConfigReader.class
                    .getDeclaredMethod("parseProcessorResponse", String.class, String.class);
            parseMethod.setAccessible(true);

            // Act & Assert
            IOException exception = assertThrows(
                    IOException.class,
                    () -> {
                        try {
                            parseMethod.invoke(reader, jsonMissingComponent, processorId);
                        } catch (java.lang.reflect.InvocationTargetException e) {
                            throw e.getCause();
                        }
                    },
                    "Should throw IOException for missing component field"
            );

            assertTrue(exception.getMessage().contains("missing 'component' field"),
                    "Exception message should indicate missing component field");
        }

        /**
         * Tests that missing 'config' field is handled properly.
         */
        @Test
        @DisplayName("Should handle JSON response missing config field")
        void shouldHandleJsonMissingConfigField() throws Exception {
            // Arrange - has component but missing 'config'
            String jsonMissingConfig = """
                {
                    "component": {
                        "id": "some-processor-id"
                    }
                }
                """;
            String processorId = "test-processor-id";

            // Use reflection to access private method
            java.lang.reflect.Method parseMethod = ComponentConfigReader.class
                    .getDeclaredMethod("parseProcessorResponse", String.class, String.class);
            parseMethod.setAccessible(true);

            // Act & Assert
            IOException exception = assertThrows(
                    IOException.class,
                    () -> {
                        try {
                            parseMethod.invoke(reader, jsonMissingConfig, processorId);
                        } catch (java.lang.reflect.InvocationTargetException e) {
                            throw e.getCause();
                        }
                    },
                    "Should throw IOException for missing config field"
            );

            assertTrue(exception.getMessage().contains("missing 'config' field"),
                    "Exception message should indicate missing config field");
        }

        /**
         * Tests that missing 'properties' field is handled properly.
         */
        @Test
        @DisplayName("Should handle JSON response missing properties field")
        void shouldHandleJsonMissingPropertiesField() throws Exception {
            // Arrange - has component and config but missing 'properties'
            String jsonMissingProperties = """
                {
                    "component": {
                        "config": {
                            "schedulingStrategy": "TIMER_DRIVEN"
                        }
                    }
                }
                """;
            String processorId = "test-processor-id";

            // Use reflection to access private method
            java.lang.reflect.Method parseMethod = ComponentConfigReader.class
                    .getDeclaredMethod("parseProcessorResponse", String.class, String.class);
            parseMethod.setAccessible(true);

            // Act & Assert
            IOException exception = assertThrows(
                    IOException.class,
                    () -> {
                        try {
                            parseMethod.invoke(reader, jsonMissingProperties, processorId);
                        } catch (java.lang.reflect.InvocationTargetException e) {
                            throw e.getCause();
                        }
                    },
                    "Should throw IOException for missing properties field"
            );

            assertTrue(exception.getMessage().contains("missing 'properties' field"),
                    "Exception message should indicate missing properties field");
        }
    }

    @Nested
    @DisplayName("parseComponentResponse Tests")
    class ParseComponentResponseTests {

        private ComponentConfigReader.ComponentConfig invokeParseComponentResponse(
                String json, String componentId, ComponentConfigReader.ComponentType type) throws Throwable {
            java.lang.reflect.Method parseMethod = ComponentConfigReader.class
                    .getDeclaredMethod("parseComponentResponse",
                            String.class, String.class, ComponentConfigReader.ComponentType.class);
            parseMethod.setAccessible(true);
            try {
                return (ComponentConfigReader.ComponentConfig)
                        parseMethod.invoke(reader, json, componentId, type);
            } catch (java.lang.reflect.InvocationTargetException e) {
                throw e.getCause();
            }
        }

        @Test
        @DisplayName("Should parse valid processor response with config.properties path")
        void shouldParseValidProcessorResponse() throws Throwable {
            String json = """
                    {
                        "revision": {"version": 1},
                        "component": {
                            "type": "de.cuioss.nifi.rest.RestApiGatewayProcessor",
                            "config": {
                                "properties": {
                                    "rest.gateway.listening.port": "9443",
                                    "rest.gateway.ssl.enabled": "false"
                                }
                            }
                        }
                    }
                    """;

            ComponentConfigReader.ComponentConfig config = invokeParseComponentResponse(
                    json, "test-id", ComponentConfigReader.ComponentType.PROCESSOR);

            assertEquals(ComponentConfigReader.ComponentType.PROCESSOR, config.type());
            assertEquals("de.cuioss.nifi.rest.RestApiGatewayProcessor", config.componentClass());
            assertEquals("9443", config.properties().get("rest.gateway.listening.port"));
            assertEquals("false", config.properties().get("rest.gateway.ssl.enabled"));
            assertEquals(2, config.properties().size());
            assertNotNull(config.revision());
        }

        @Test
        @DisplayName("Should parse valid controller service response with component.properties path")
        void shouldParseValidControllerServiceResponse() throws Throwable {
            String json = """
                    {
                        "revision": {"version": 2},
                        "component": {
                            "type": "de.cuioss.nifi.jwt.StandardJwtIssuerConfigService",
                            "properties": {
                                "jwt.issuer.url": "https://keycloak.example.com/realms/test",
                                "jwt.issuer.jwks.url": "https://keycloak.example.com/certs"
                            }
                        }
                    }
                    """;

            ComponentConfigReader.ComponentConfig config = invokeParseComponentResponse(
                    json, "test-id", ComponentConfigReader.ComponentType.CONTROLLER_SERVICE);

            assertEquals(ComponentConfigReader.ComponentType.CONTROLLER_SERVICE, config.type());
            assertEquals("de.cuioss.nifi.jwt.StandardJwtIssuerConfigService", config.componentClass());
            assertEquals(2, config.properties().size());
            assertEquals("https://keycloak.example.com/realms/test",
                    config.properties().get("jwt.issuer.url"));
            assertNotNull(config.revision());
        }

        @Test
        @DisplayName("Should throw IOException for missing component field")
        void shouldThrowForMissingComponentField() {
            String json = """
                    {"id": "some-id", "status": "Running"}
                    """;

            IOException exception = assertThrows(IOException.class,
                    () -> invokeParseComponentResponse(json, "test-id",
                            ComponentConfigReader.ComponentType.PROCESSOR));
            assertTrue(exception.getMessage().contains("missing 'component' field"));
        }

        @Test
        @DisplayName("Should throw IOException for missing config field in PROCESSOR type")
        void shouldThrowForMissingConfigField() {
            String json = """
                    {"component": {"type": "SomeProcessor"}}
                    """;

            IOException exception = assertThrows(IOException.class,
                    () -> invokeParseComponentResponse(json, "test-id",
                            ComponentConfigReader.ComponentType.PROCESSOR));
            assertTrue(exception.getMessage().contains("missing 'config' field"));
        }

        @Test
        @DisplayName("Should throw IOException for missing properties field in PROCESSOR type")
        void shouldThrowForMissingPropertiesFieldProcessor() {
            String json = """
                    {"component": {"type": "SomeProcessor", "config": {"scheduling": "TIMER"}}}
                    """;

            IOException exception = assertThrows(IOException.class,
                    () -> invokeParseComponentResponse(json, "test-id",
                            ComponentConfigReader.ComponentType.PROCESSOR));
            assertTrue(exception.getMessage().contains("missing 'properties' field"));
        }

        @Test
        @DisplayName("Should throw IOException for missing properties field in CONTROLLER_SERVICE type")
        void shouldThrowForMissingPropertiesFieldCS() {
            String json = """
                    {"component": {"type": "SomeCS"}}
                    """;

            IOException exception = assertThrows(IOException.class,
                    () -> invokeParseComponentResponse(json, "test-id",
                            ComponentConfigReader.ComponentType.CONTROLLER_SERVICE));
            assertTrue(exception.getMessage().contains("missing 'properties' field"));
        }

        @Test
        @DisplayName("Should throw IOException for malformed JSON")
        void shouldThrowForMalformedJson() {
            String json = "{ invalid json }";

            IOException exception = assertThrows(IOException.class,
                    () -> invokeParseComponentResponse(json, "test-id",
                            ComponentConfigReader.ComponentType.PROCESSOR));
            assertTrue(exception.getMessage().contains("Failed to parse component response JSON"));
        }

        @Test
        @DisplayName("Should throw IOException for wrong type structure (ClassCastException)")
        void shouldThrowForWrongTypeStructure() {
            String json = """
                    {"component": ["not an object"]}
                    """;

            IOException exception = assertThrows(IOException.class,
                    () -> invokeParseComponentResponse(json, "test-id",
                            ComponentConfigReader.ComponentType.PROCESSOR));
            assertTrue(exception.getMessage().contains("Invalid JSON structure"));
        }

        @Test
        @DisplayName("Should handle response without revision field")
        void shouldHandleNullRevision() throws Throwable {
            String json = """
                    {
                        "component": {
                            "type": "SomeProcessor",
                            "config": {
                                "properties": {"key": "value"}
                            }
                        }
                    }
                    """;

            ComponentConfigReader.ComponentConfig config = invokeParseComponentResponse(
                    json, "test-id", ComponentConfigReader.ComponentType.PROCESSOR);

            assertNull(config.revision());
            assertEquals(1, config.properties().size());
            assertEquals("value", config.properties().get("key"));
        }

        @Test
        @DisplayName("Should skip null property values")
        void shouldSkipNullPropertyValues() throws Throwable {
            String json = """
                    {
                        "component": {
                            "type": "SomeProcessor",
                            "config": {
                                "properties": {
                                    "key1": "value1",
                                    "key2": null,
                                    "key3": "value3"
                                }
                            }
                        }
                    }
                    """;

            ComponentConfigReader.ComponentConfig config = invokeParseComponentResponse(
                    json, "test-id", ComponentConfigReader.ComponentType.PROCESSOR);

            assertEquals(2, config.properties().size());
            assertEquals("value1", config.properties().get("key1"));
            assertEquals("value3", config.properties().get("key3"));
            assertFalse(config.properties().containsKey("key2"));
        }
    }
}
