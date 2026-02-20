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

import de.cuioss.test.juli.junit5.EnableTestLogger;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import mockwebserver3.MockResponse;
import mockwebserver3.MockWebServer;
import mockwebserver3.RecordedRequest;
import org.apache.nifi.web.NiFiWebConfigurationContext;
import org.junit.jupiter.api.*;

import java.util.Map;
import java.util.UUID;

import static org.easymock.EasyMock.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link ComponentConfigReader}'s REST API fallback methods.
 * Uses OkHttp MockWebServer to simulate NiFi REST API responses.
 */
@EnableTestLogger
@DisplayName("ComponentConfigReader REST API Fallback Tests")
class ComponentConfigReaderRestTest {

    private NiFiWebConfigurationContext mockConfigContext;
    private ComponentConfigReader reader;
    private MockWebServer server;

    @BeforeEach
    void setUp() throws Exception {
        mockConfigContext = createNiceMock(NiFiWebConfigurationContext.class);
        replay(mockConfigContext);
        reader = new ComponentConfigReader(mockConfigContext);
        server = new MockWebServer();
        server.start();
    }

    @AfterEach
    void tearDown() throws Exception {
        server.close();
    }

    /**
     * Creates a mock HttpServletRequest pointing to the MockWebServer.
     */
    private HttpServletRequest mockRequest(String authHeader, Cookie[] cookies) {
        HttpServletRequest request = createNiceMock(HttpServletRequest.class);
        expect(request.getScheme()).andReturn("http").anyTimes();
        expect(request.getLocalPort()).andReturn(server.getPort()).anyTimes();
        if (authHeader != null) {
            expect(request.getHeader("Authorization")).andReturn(authHeader).anyTimes();
        }
        expect(request.getCookies()).andReturn(cookies).anyTimes();
        replay(request);
        return request;
    }

    // -----------------------------------------------------------------------
    // Processor properties via REST
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("getProcessorPropertiesViaRest")
    class ProcessorPropertiesViaRest {

        @Test
        @DisplayName("Should parse processor properties from REST API response")
        void shouldParseProcessorProperties() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .addHeader("Content-Type", "application/json")
                    .body("""
                            {
                              "component": {
                                "config": {
                                  "properties": {
                                    "rest.gateway.listening.port": "9443",
                                    "rest.gateway.ssl.enabled": "false"
                                  }
                                }
                              }
                            }""")
                    .build());

            HttpServletRequest request = mockRequest("Bearer test-token", null);
            Map<String, String> props = reader.getProcessorPropertiesViaRest(processorId, request);

            assertEquals(2, props.size());
            assertEquals("9443", props.get("rest.gateway.listening.port"));
            assertEquals("false", props.get("rest.gateway.ssl.enabled"));

            RecordedRequest recorded = server.takeRequest();
            assertEquals("/nifi-api/processors/" + processorId, recorded.getTarget());
            assertEquals("Bearer test-token", recorded.getHeaders().get("Authorization"));
        }

        @Test
        @DisplayName("Should return empty map for 404 response")
        void shouldReturnEmptyFor404() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder().code(404).build());

            Map<String, String> props = reader.getProcessorPropertiesViaRest(
                    processorId, mockRequest("Bearer token", null));

            assertTrue(props.isEmpty());
        }

        @Test
        @DisplayName("Should return empty map for 500 server error")
        void shouldReturnEmptyFor500() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder().code(500).build());

            Map<String, String> props = reader.getProcessorPropertiesViaRest(
                    processorId, mockRequest("Bearer token", null));

            assertTrue(props.isEmpty());
        }

        @Test
        @DisplayName("Should return empty map for invalid JSON response")
        void shouldReturnEmptyForInvalidJson() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .body("not json")
                    .build());

            Map<String, String> props = reader.getProcessorPropertiesViaRest(
                    processorId, mockRequest("Bearer token", null));

            assertTrue(props.isEmpty());
        }

        @Test
        @DisplayName("Should return empty map when component is missing from response")
        void shouldReturnEmptyForMissingComponent() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .addHeader("Content-Type", "application/json")
                    .body("{}")
                    .build());

            Map<String, String> props = reader.getProcessorPropertiesViaRest(
                    processorId, mockRequest("Bearer token", null));

            assertTrue(props.isEmpty());
        }
    }

    // -----------------------------------------------------------------------
    // Controller service properties via REST
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("getControllerServicePropertiesViaRest")
    class ControllerServicePropertiesViaRest {

        @Test
        @DisplayName("Should parse CS properties (flat component.properties structure)")
        void shouldParseCSProperties() throws Exception {
            String csId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .addHeader("Content-Type", "application/json")
                    .body("""
                            {
                              "component": {
                                "properties": {
                                  "issuer.1.name": "test-issuer",
                                  "issuer.1.jwks-url": "https://example.com/jwks"
                                }
                              }
                            }""")
                    .build());

            HttpServletRequest request = mockRequest("Bearer test-token", null);
            Map<String, String> props = reader.getControllerServicePropertiesViaRest(csId, request);

            assertEquals(2, props.size());
            assertEquals("test-issuer", props.get("issuer.1.name"));
            assertEquals("https://example.com/jwks", props.get("issuer.1.jwks-url"));

            RecordedRequest recorded = server.takeRequest();
            assertEquals("/nifi-api/controller-services/" + csId, recorded.getTarget());
        }
    }

    // -----------------------------------------------------------------------
    // Controller service reference resolution from descriptors
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("CS reference resolution from descriptors")
    class DescriptorResolution {

        @Test
        @DisplayName("Should resolve CS UUID from descriptors.allowableValues")
        void shouldResolveCSFromDescriptors() throws Exception {
            String processorId = UUID.randomUUID().toString();
            String csUuid = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .addHeader("Content-Type", "application/json")
                    .body("""
                            {
                              "component": {
                                "config": {
                                  "properties": {
                                    "rest.gateway.listening.port": "9443",
                                    "jwt.issuer.config.service": null
                                  },
                                  "descriptors": {
                                    "jwt.issuer.config.service": {
                                      "identifiesControllerService": "SomeInterface",
                                      "allowableValues": [
                                        {
                                          "allowableValue": {
                                            "value": "%s"
                                          }
                                        }
                                      ]
                                    }
                                  }
                                }
                              }
                            }""".formatted(csUuid))
                    .build());

            Map<String, String> props = reader.getProcessorPropertiesViaRest(
                    processorId, mockRequest("Bearer token", null));

            assertEquals("9443", props.get("rest.gateway.listening.port"));
            assertEquals(csUuid, props.get("jwt.issuer.config.service"));
        }

        @Test
        @DisplayName("Should skip null properties without identifiesControllerService descriptor")
        void shouldSkipNonCSNullProperties() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .addHeader("Content-Type", "application/json")
                    .body("""
                            {
                              "component": {
                                "config": {
                                  "properties": {
                                    "key": "value",
                                    "null-key": null
                                  },
                                  "descriptors": {
                                    "null-key": {
                                      "name": "some-prop"
                                    }
                                  }
                                }
                              }
                            }""")
                    .build());

            Map<String, String> props = reader.getProcessorPropertiesViaRest(
                    processorId, mockRequest("Bearer token", null));

            assertEquals(1, props.size());
            assertEquals("value", props.get("key"));
            assertFalse(props.containsKey("null-key"));
        }

        @Test
        @DisplayName("Should handle null descriptors for null property values")
        void shouldHandleNullDescriptors() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .addHeader("Content-Type", "application/json")
                    .body("""
                            {
                              "component": {
                                "config": {
                                  "properties": {
                                    "key": "value",
                                    "null-key": null
                                  }
                                }
                              }
                            }""")
                    .build());

            Map<String, String> props = reader.getProcessorPropertiesViaRest(
                    processorId, mockRequest("Bearer token", null));

            assertEquals(1, props.size());
            assertEquals("value", props.get("key"));
        }

        @Test
        @DisplayName("Should handle empty allowableValues array for CS reference")
        void shouldHandleEmptyAllowableValues() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .addHeader("Content-Type", "application/json")
                    .body("""
                            {
                              "component": {
                                "config": {
                                  "properties": {
                                    "jwt.issuer.config.service": null
                                  },
                                  "descriptors": {
                                    "jwt.issuer.config.service": {
                                      "identifiesControllerService": "SomeInterface",
                                      "allowableValues": []
                                    }
                                  }
                                }
                              }
                            }""")
                    .build());

            Map<String, String> props = reader.getProcessorPropertiesViaRest(
                    processorId, mockRequest("Bearer token", null));

            assertFalse(props.containsKey("jwt.issuer.config.service"));
        }
    }

    // -----------------------------------------------------------------------
    // Authentication header resolution
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("Auth header resolution")
    class AuthResolution {

        @Test
        @DisplayName("Should prefer Authorization header over cookie")
        void shouldPreferAuthHeader() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .addHeader("Content-Type", "application/json")
                    .body("""
                            {"component": {"config": {"properties": {"k": "v"}}}}""")
                    .build());

            Cookie authCookie = new Cookie("__Secure-Authorization-Bearer", "cookie-token");
            HttpServletRequest request = mockRequest("Bearer header-token",
                    new Cookie[]{authCookie});

            reader.getProcessorPropertiesViaRest(processorId, request);

            RecordedRequest recorded = server.takeRequest();
            assertEquals("Bearer header-token", recorded.getHeaders().get("Authorization"));
        }

        @Test
        @DisplayName("Should extract Bearer from NiFi auth cookie when header missing")
        void shouldExtractBearerFromCookie() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .addHeader("Content-Type", "application/json")
                    .body("""
                            {"component": {"config": {"properties": {"k": "v"}}}}""")
                    .build());

            Cookie authCookie = new Cookie("__Secure-Authorization-Bearer", "cookie-jwt");
            HttpServletRequest request = mockRequest(null, new Cookie[]{authCookie});

            Map<String, String> props = reader.getProcessorPropertiesViaRest(processorId, request);
            assertEquals(1, props.size());

            RecordedRequest recorded = server.takeRequest();
            assertEquals("Bearer cookie-jwt", recorded.getHeaders().get("Authorization"));
        }

        @Test
        @DisplayName("Should handle missing auth credentials gracefully")
        void shouldHandleMissingAuth() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .addHeader("Content-Type", "application/json")
                    .body("""
                            {"component": {"config": {"properties": {"k": "v"}}}}""")
                    .build());

            Map<String, String> props = reader.getProcessorPropertiesViaRest(
                    processorId, mockRequest(null, null));

            assertEquals(1, props.size());
            RecordedRequest recorded = server.takeRequest();
            assertNull(recorded.getHeaders().get("Authorization"));
        }

        @Test
        @DisplayName("Should skip blank auth cookie value")
        void shouldSkipBlankCookieValue() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .addHeader("Content-Type", "application/json")
                    .body("""
                            {"component": {"config": {"properties": {"k": "v"}}}}""")
                    .build());

            Cookie blankCookie = new Cookie("__Secure-Authorization-Bearer", "  ");
            HttpServletRequest request = mockRequest(null, new Cookie[]{blankCookie});

            reader.getProcessorPropertiesViaRest(processorId, request);

            RecordedRequest recorded = server.takeRequest();
            assertNull(recorded.getHeaders().get("Authorization"));
        }
    }

    // -----------------------------------------------------------------------
    // Cookie forwarding
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("Cookie forwarding")
    class CookieForwarding {

        @Test
        @DisplayName("Should forward all cookies in REST API request")
        void shouldForwardCookies() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .addHeader("Content-Type", "application/json")
                    .body("""
                            {"component": {"config": {"properties": {"k": "v"}}}}""")
                    .build());

            Cookie[] cookies = {
                    new Cookie("__Secure-Authorization-Bearer", "jwt-token"),
                    new Cookie("other-cookie", "other-value")
            };
            HttpServletRequest request = mockRequest(null, cookies);

            reader.getProcessorPropertiesViaRest(processorId, request);

            RecordedRequest recorded = server.takeRequest();
            String cookieHeader = recorded.getHeaders().get("Cookie");
            assertNotNull(cookieHeader);
            assertTrue(cookieHeader.contains("__Secure-Authorization-Bearer=jwt-token"));
            assertTrue(cookieHeader.contains("other-cookie=other-value"));
        }

        @Test
        @DisplayName("Should handle no cookies")
        void shouldHandleNoCookies() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .addHeader("Content-Type", "application/json")
                    .body("""
                            {"component": {"config": {"properties": {"k": "v"}}}}""")
                    .build());

            reader.getProcessorPropertiesViaRest(processorId,
                    mockRequest("Bearer token", null));

            RecordedRequest recorded = server.takeRequest();
            assertNull(recorded.getHeaders().get("Cookie"));
        }

        @Test
        @DisplayName("Should handle empty cookies array")
        void shouldHandleEmptyCookiesArray() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .addHeader("Content-Type", "application/json")
                    .body("""
                            {"component": {"config": {"properties": {"k": "v"}}}}""")
                    .build());

            reader.getProcessorPropertiesViaRest(processorId,
                    mockRequest("Bearer token", new Cookie[0]));

            RecordedRequest recorded = server.takeRequest();
            assertNull(recorded.getHeaders().get("Cookie"));
        }
    }

    // -----------------------------------------------------------------------
    // Response parsing edge cases
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("Response parsing edge cases")
    class ParsingEdgeCases {

        @Test
        @DisplayName("Should handle missing properties in component.config")
        void shouldHandleMissingProperties() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .addHeader("Content-Type", "application/json")
                    .body("""
                            {"component": {"config": {}}}""")
                    .build());

            Map<String, String> props = reader.getProcessorPropertiesViaRest(
                    processorId, mockRequest("Bearer token", null));

            assertTrue(props.isEmpty());
        }

        @Test
        @DisplayName("Should handle response with only non-null properties")
        void shouldHandleAllNonNullProperties() throws Exception {
            String processorId = UUID.randomUUID().toString();
            server.enqueue(new MockResponse.Builder()
                    .code(200)
                    .addHeader("Content-Type", "application/json")
                    .body("""
                            {
                              "component": {
                                "properties": {
                                  "a": "1",
                                  "b": "2",
                                  "c": "3"
                                }
                              }
                            }""")
                    .build());

            Map<String, String> props = reader.getControllerServicePropertiesViaRest(
                    processorId, mockRequest("Bearer token", null));

            assertEquals(3, props.size());
            assertEquals("1", props.get("a"));
            assertEquals("2", props.get("b"));
            assertEquals("3", props.get("c"));
        }
    }
}
