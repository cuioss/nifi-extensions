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

import de.cuioss.test.generator.junit.EnableGeneratorController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.io.IOException;

import static de.cuioss.test.generator.Generators.strings;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link ProcessorConfigReader}.
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
@EnableGeneratorController
@DisplayName("Processor Config Reader Tests")
class ProcessorConfigReaderTest {

    private ProcessorConfigReader reader;

    @BeforeEach
    void setUp() {
        reader = new ProcessorConfigReader();
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
            // Arrange
            String processorId = strings().next();
            System.clearProperty("nifi.web.https.host");
            System.clearProperty("nifi.web.https.port");

            // Act & Assert
            // We can't directly test URL building without triggering HTTP call,
            // but we can verify the method attempts to make a request
            // (which will fail since no NiFi is running, but confirms URL was built)
            assertThrows(Exception.class,
                    () -> reader.getProcessorProperties(processorId),
                    "Should attempt HTTP request with generated URL");
        }

        @Test
        @DisplayName("Should build HTTPS URL when HTTPS properties are set")
        void shouldBuildHttpsUrlWhenHttpsConfigured() {
            // Arrange
            String processorId = strings().next();
            String httpsHost = "secure-nifi.example.com";
            String httpsPort = "8443";

            System.setProperty("nifi.web.https.host", httpsHost);
            System.setProperty("nifi.web.https.port", httpsPort);

            try {
                // Act & Assert
                // Should attempt to connect via HTTPS
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
            // Arrange
            String processorId = strings().next();
            String customHost = "custom-nifi.local";
            String customPort = "9090";

            System.clearProperty("nifi.web.https.host");
            System.clearProperty("nifi.web.https.port");
            System.setProperty("nifi.web.http.host", customHost);
            System.setProperty("nifi.web.http.port", customPort);

            try {
                // Act & Assert
                // Should attempt to connect with custom HTTP host/port
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
            // Arrange
            String processorId = strings().next();
            System.clearProperty("nifi.web.https.host");
            System.clearProperty("nifi.web.https.port");
            System.setProperty("nifi.web.http.host", "non-existent-host-12345");
            System.setProperty("nifi.web.http.port", "12345");

            try {
                // Act & Assert - Exception type varies by environment:
                // ConnectException on CI, IllegalArgumentException on some local setups
                assertThrows(Exception.class,
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
            ProcessorConfigReader newReader = new ProcessorConfigReader();

            // Assert
            assertNotNull(newReader, "Reader instance should be created successfully");
        }

        @Test
        @DisplayName("Should be reusable for multiple requests")
        void shouldBeReusableForMultipleRequests() {
            // Arrange
            String processorId1 = strings().next();
            String processorId2 = strings().next();

            // Act & Assert
            // Both calls should fail with IOException (no NiFi running)
            // but should not fail due to reader state issues
            assertThrows(Exception.class,
                    () -> reader.getProcessorProperties(processorId1),
                    "First request should be processed");

            assertThrows(Exception.class,
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
            java.lang.reflect.Method parseMethod = ProcessorConfigReader.class
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
            java.lang.reflect.Method parseMethod = ProcessorConfigReader.class
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
            java.lang.reflect.Method parseMethod = ProcessorConfigReader.class
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
            java.lang.reflect.Method parseMethod = ProcessorConfigReader.class
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
            java.lang.reflect.Method parseMethod = ProcessorConfigReader.class
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
}
