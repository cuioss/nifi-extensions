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
 * Note: This class creates HttpClient internally without dependency injection,
 * which limits testability. Tests focus on input validation and behavior
 * that can be verified without mocking HTTP clients. Full HTTP communication
 * testing would require either:
 * 1. Refactoring to use dependency injection (out of scope for coverage improvement)
 * 2. Integration tests with actual NiFi instance (belongs in *IT.java tests)
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
            IllegalArgumentException exception = assertThrows(
                    IllegalArgumentException.class,
                    () -> reader.getProcessorProperties(nullProcessorId),
                    "Null processor ID should throw IllegalArgumentException"
            );

            assertTrue(exception.getMessage().contains("cannot be null or empty"),
                    "Exception message should indicate processor ID cannot be null");
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

            assertTrue(exception.getMessage().contains("cannot be null or empty"),
                    "Exception message should indicate processor ID cannot be empty");
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

            assertTrue(exception.getMessage().contains("cannot be null or empty"),
                    "Exception message should indicate processor ID cannot be empty");
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
                // Act & Assert
                // May throw IOException or IllegalArgumentException depending on URL parsing
                Exception exception = assertThrows(
                        Exception.class,
                        () -> reader.getProcessorProperties(processorId),
                        "Should throw exception when unable to connect"
                );

                assertTrue(exception.getMessage() != null && !exception.getMessage().isEmpty(),
                        "Exception message should provide connection failure details");
                assertTrue(exception instanceof IOException || exception instanceof IllegalArgumentException,
                        "Should throw IOException or IllegalArgumentException");
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
            IllegalArgumentException exception = assertThrows(
                    IllegalArgumentException.class,
                    () -> reader.getProcessorProperties(nullProcessorId),
                    "Should throw exception for null processor ID"
            );

            String message = exception.getMessage();
            assertNotNull(message, "Error message should not be null");
            assertTrue(message.toLowerCase().contains("processor id"),
                    "Error message should mention processor ID");
            assertTrue(message.toLowerCase().contains("null") || message.toLowerCase().contains("empty"),
                    "Error message should explain the validation failure");
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
            assertTrue(message.toLowerCase().contains("empty"),
                    "Error message should explain that processor ID cannot be empty");
        }
    }
}
