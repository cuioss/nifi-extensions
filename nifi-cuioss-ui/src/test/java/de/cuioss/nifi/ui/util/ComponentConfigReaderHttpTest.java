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

import de.cuioss.test.mockwebserver.EnableMockWebServer;
import de.cuioss.test.mockwebserver.dispatcher.HttpMethodMapper;
import de.cuioss.test.mockwebserver.dispatcher.ModuleDispatcher;
import de.cuioss.test.mockwebserver.dispatcher.ModuleDispatcherElement;
import de.cuioss.test.mockwebserver.mockresponse.MockResponseConfig;
import mockwebserver3.MockWebServer;
import mockwebserver3.RecordedRequest;
import org.junit.jupiter.api.*;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * HTTP integration tests for {@link ComponentConfigReader} using MockWebServer.
 * These tests exercise the full HTTP communication path by pointing the reader's
 * System property-based URL building at a local MockWebServer instance.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/security.adoc">Security Specification</a>
 */
@EnableMockWebServer
@DisplayName("ComponentConfigReader HTTP Tests")
class ComponentConfigReaderHttpTest {

    private static final String PROCESSOR_ID = UUID.randomUUID().toString();

    private static final String VALID_NIFI_RESPONSE = """
            {
                "component": {
                    "config": {
                        "properties": {
                            "issuer.1.name": "test-issuer",
                            "issuer.1.jwks-url": "https://example.com/.well-known/jwks.json",
                            "issuer.1.audience": "my-api"
                        }
                    }
                }
            }
            """;

    private static final String VALID_NIFI_RESPONSE_WITH_NULLS = """
            {
                "component": {
                    "config": {
                        "properties": {
                            "issuer.1.name": "test-issuer",
                            "issuer.1.jwks-url": null,
                            "issuer.1.audience": "my-api"
                        }
                    }
                }
            }
            """;

    private static final String NIFI_API_PATH = "/nifi-api/processors/";

    private ComponentConfigReader reader;

    @BeforeEach
    void setUp(MockWebServer server) {
        reader = new ComponentConfigReader();
        // Clear HTTPS properties to force HTTP path
        System.clearProperty("nifi.web.https.host");
        System.clearProperty("nifi.web.https.port");
        // Point to MockWebServer
        System.setProperty("nifi.web.http.host", "localhost");
        System.setProperty("nifi.web.http.port", String.valueOf(server.getPort()));
    }

    @AfterEach
    void tearDown() {
        System.clearProperty("nifi.web.http.host");
        System.clearProperty("nifi.web.http.port");
        System.clearProperty("nifi.web.https.host");
        System.clearProperty("nifi.web.https.port");
    }

    @Nested
    @DisplayName("Successful responses")
    @ModuleDispatcher
    class SuccessfulResponses {

        public ModuleDispatcherElement getModuleDispatcher() {
            return new ModuleDispatcherElement() {
                @Override
                public String getBaseUrl() {
                    return NIFI_API_PATH;
                }

                @Override
                public Optional<mockwebserver3.MockResponse> handleGet(RecordedRequest request) {
                    String target = request.getTarget();
                    if (target != null && target.contains(PROCESSOR_ID)) {
                        return Optional.of(new mockwebserver3.MockResponse.Builder()
                                .code(200)
                                .addHeader("Content-Type", "application/json")
                                .body(VALID_NIFI_RESPONSE)
                                .build());
                    }
                    return Optional.of(new mockwebserver3.MockResponse.Builder()
                            .code(404)
                            .body("Not found")
                            .build());
                }

                @Override
                public Set<HttpMethodMapper> supportedMethods() {
                    return Set.of(HttpMethodMapper.GET);
                }
            };
        }

        @Test
        @DisplayName("Should return processor properties from valid NiFi response")
        void shouldReturnProcessorProperties() throws Exception {
            // Act
            Map<String, String> properties = reader.getProcessorProperties(PROCESSOR_ID);

            // Assert
            assertNotNull(properties, "Properties should not be null");
            assertEquals(3, properties.size(), "Should have 3 properties");
            assertEquals("test-issuer", properties.get("issuer.1.name"));
            assertEquals("https://example.com/.well-known/jwks.json", properties.get("issuer.1.jwks-url"));
            assertEquals("my-api", properties.get("issuer.1.audience"));
        }

        @Test
        @DisplayName("Should send correct request to NiFi API")
        void shouldSendCorrectRequest(MockWebServer server) throws Exception {
            // Act
            reader.getProcessorProperties(PROCESSOR_ID);

            // Assert
            RecordedRequest request = server.takeRequest();
            assertEquals("application/json", request.getHeaders().get("Accept"),
                    "Should send Accept: application/json header");
            assertEquals("GET", request.getMethod(), "Should use GET method");
            assertTrue(request.getTarget().contains(NIFI_API_PATH + PROCESSOR_ID),
                    "Request path should contain processor ID");
        }
    }

    @Nested
    @DisplayName("Null property values")
    @ModuleDispatcher
    class NullPropertyValues {

        public ModuleDispatcherElement getModuleDispatcher() {
            return new ModuleDispatcherElement() {
                @Override
                public String getBaseUrl() {
                    return NIFI_API_PATH;
                }

                @Override
                public Optional<mockwebserver3.MockResponse> handleGet(RecordedRequest request) {
                    return Optional.of(new mockwebserver3.MockResponse.Builder()
                            .code(200)
                            .addHeader("Content-Type", "application/json")
                            .body(VALID_NIFI_RESPONSE_WITH_NULLS)
                            .build());
                }

                @Override
                public Set<HttpMethodMapper> supportedMethods() {
                    return Set.of(HttpMethodMapper.GET);
                }
            };
        }

        @Test
        @DisplayName("Should skip null property values in response")
        void shouldSkipNullPropertyValues() throws Exception {
            // Act
            Map<String, String> properties = reader.getProcessorProperties(PROCESSOR_ID);

            // Assert
            assertEquals(2, properties.size(), "Should have 2 non-null properties");
            assertEquals("test-issuer", properties.get("issuer.1.name"));
            assertEquals("my-api", properties.get("issuer.1.audience"));
            assertNull(properties.get("issuer.1.jwks-url"),
                    "Null property should not be in the map");
        }
    }

    @Nested
    @DisplayName("HTTP error responses")
    class HttpErrorResponses {

        @Test
        @DisplayName("Should throw IllegalArgumentException for 404 response")
        @MockResponseConfig(
                path = "/nifi-api/processors/",
                method = HttpMethodMapper.GET,
                status = 404,
                textContent = "Processor not found"
        )
        void shouldThrowIllegalArgumentExceptionFor404() {
            // Act & Assert
            IllegalArgumentException exception = assertThrows(
                    IllegalArgumentException.class,
                    () -> reader.getProcessorProperties(PROCESSOR_ID),
                    "Should throw IllegalArgumentException for 404"
            );
            assertTrue(exception.getMessage().contains("Processor not found"),
                    "Exception message should mention processor not found");
        }

        @Test
        @DisplayName("Should throw IOException for 500 response")
        @MockResponseConfig(
                path = "/nifi-api/processors/",
                method = HttpMethodMapper.GET,
                status = 500,
                textContent = "Internal Server Error"
        )
        void shouldThrowIOExceptionFor500() {
            // Act & Assert
            IOException exception = assertThrows(
                    IOException.class,
                    () -> reader.getProcessorProperties(PROCESSOR_ID),
                    "Should throw IOException for 500"
            );
            assertTrue(exception.getMessage().contains("HTTP 500"),
                    "Exception message should contain HTTP status code");
        }

        @Test
        @DisplayName("Should throw IOException for 403 response")
        @MockResponseConfig(
                path = "/nifi-api/processors/",
                method = HttpMethodMapper.GET,
                status = 403,
                textContent = "Forbidden"
        )
        void shouldThrowIOExceptionFor403() {
            // Act & Assert
            IOException exception = assertThrows(
                    IOException.class,
                    () -> reader.getProcessorProperties(PROCESSOR_ID),
                    "Should throw IOException for 403"
            );
            assertTrue(exception.getMessage().contains("HTTP 403"),
                    "Exception message should contain HTTP status code");
        }
    }

    @Nested
    @DisplayName("Invalid JSON responses")
    class InvalidJsonResponses {

        @Test
        @DisplayName("Should throw IOException for malformed JSON response body")
        @MockResponseConfig(
                path = "/nifi-api/processors/",
                method = HttpMethodMapper.GET,
                status = 200,
                textContent = "{ not valid json"
        )
        void shouldThrowIOExceptionForMalformedJson() {
            // Act & Assert
            IOException exception = assertThrows(
                    IOException.class,
                    () -> reader.getProcessorProperties(PROCESSOR_ID),
                    "Should throw IOException for malformed JSON"
            );
            assertTrue(exception.getMessage().contains("Failed to parse processor response JSON"),
                    "Exception message should indicate JSON parsing failure");
        }

        @Test
        @DisplayName("Should throw IOException for JSON missing component field")
        @MockResponseConfig(
                path = "/nifi-api/processors/",
                method = HttpMethodMapper.GET,
                status = 200,
                jsonContentKeyValue = "id=some-id,status=RUNNING"
        )
        void shouldThrowIOExceptionForMissingComponentField() {
            // Act & Assert
            IOException exception = assertThrows(
                    IOException.class,
                    () -> reader.getProcessorProperties(PROCESSOR_ID),
                    "Should throw IOException for missing component"
            );
            assertTrue(exception.getMessage().contains("missing 'component' field"),
                    "Exception message should indicate missing component field");
        }

        @Test
        @DisplayName("Should throw IOException for JSON missing config field")
        @MockResponseConfig(
                path = "/nifi-api/processors/",
                method = HttpMethodMapper.GET,
                status = 200,
                stringContent = "{\"component\":{\"id\":\"some-id\"}}"
        )
        void shouldThrowIOExceptionForMissingConfigField() {
            // Act & Assert
            IOException exception = assertThrows(
                    IOException.class,
                    () -> reader.getProcessorProperties(PROCESSOR_ID),
                    "Should throw IOException for missing config"
            );
            assertTrue(exception.getMessage().contains("missing 'config' field"),
                    "Exception message should indicate missing config field");
        }

        @Test
        @DisplayName("Should throw IOException for JSON missing properties field")
        @MockResponseConfig(
                path = "/nifi-api/processors/",
                method = HttpMethodMapper.GET,
                status = 200,
                stringContent = "{\"component\":{\"config\":{\"schedulingStrategy\":\"TIMER_DRIVEN\"}}}"
        )
        void shouldThrowIOExceptionForMissingPropertiesField() {
            // Act & Assert
            IOException exception = assertThrows(
                    IOException.class,
                    () -> reader.getProcessorProperties(PROCESSOR_ID),
                    "Should throw IOException for missing properties"
            );
            assertTrue(exception.getMessage().contains("missing 'properties' field"),
                    "Exception message should indicate missing properties field");
        }

        @Test
        @DisplayName("Should throw IOException for JSON with wrong type structure")
        @MockResponseConfig(
                path = "/nifi-api/processors/",
                method = HttpMethodMapper.GET,
                status = 200,
                stringContent = "{\"component\":[\"not an object\"]}"
        )
        void shouldThrowIOExceptionForWrongTypeStructure() {
            // Act & Assert
            IOException exception = assertThrows(
                    IOException.class,
                    () -> reader.getProcessorProperties(PROCESSOR_ID),
                    "Should throw IOException for wrong type structure"
            );
            assertTrue(exception.getMessage().contains("Invalid JSON structure"),
                    "Exception message should indicate invalid JSON structure");
        }
    }

    @Nested
    @DisplayName("Empty property responses")
    class EmptyPropertyResponses {

        @Test
        @DisplayName("Should return empty map for empty properties object")
        @MockResponseConfig(
                path = "/nifi-api/processors/",
                method = HttpMethodMapper.GET,
                status = 200,
                stringContent = "{\"component\":{\"config\":{\"properties\":{}}}}"
        )
        void shouldReturnEmptyMapForEmptyProperties() throws Exception {
            // Act
            Map<String, String> properties = reader.getProcessorProperties(PROCESSOR_ID);

            // Assert
            assertNotNull(properties, "Properties should not be null");
            assertTrue(properties.isEmpty(), "Properties should be empty for empty object");
        }
    }
}
