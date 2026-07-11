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
package de.cuioss.nifi.rest.handler;

import de.cuioss.test.juli.junit5.EnableTestLogger;
import org.eclipse.jetty.server.*;
import org.eclipse.jetty.util.Callback;
import org.junit.jupiter.api.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link RequestUtils#buildStatusLocationUri} and
 * {@link RequestUtils#sendAcceptedResponse}, driving the methods through a real
 * embedded Jetty request so the {@code Location} header and body are produced by the
 * same request accessors used in production.
 *
 * <p>The honored reverse-proxy prefix is now resolved (and allowlist-gated) upstream
 * in {@code GatewayRequestHandler} and passed to these methods as an explicit
 * argument. The test carries the intended prefix in a test-only {@code X-Test-Prefix}
 * header that the embedded handler forwards verbatim as the {@code proxyContextPath}
 * argument, so a single round-trip asserts both methods prepend a supplied prefix to
 * the {@code Location} header and the HATEOAS {@code _links} hrefs, and leave the
 * output unchanged when the supplied prefix is empty.
 */
@EnableTestLogger
@DisplayName("RequestUtils")
class RequestUtilsTest {

    private static final String TRACE_ID = "d1e2f3a4-b5c6-4788-9a0b-1c2d3e4f5a6b";
    private static final String ATTACHMENTS_PATH = "/with-attachments";
    private static final String TEST_PREFIX_HEADER = "X-Test-Prefix";

    private Server server;
    private HttpClient httpClient;
    private int port;

    @BeforeEach
    void setUp() throws Exception {
        server = new Server();
        ServerConnector connector = new ServerConnector(server);
        connector.setPort(0);
        server.addConnector(connector);
        server.setHandler(new Handler.Abstract() {
            @Override
            public boolean handle(Request request, Response response, Callback callback) {
                boolean includeAttachments = ATTACHMENTS_PATH.equals(request.getHttpURI().getPath());
                // Emulate the upstream resolution: whatever prefix the caller decided to
                // honor is passed explicitly. An absent header means an empty prefix.
                String prefix = request.getHeaders().get(TEST_PREFIX_HEADER);
                RequestUtils.sendAcceptedResponse(request, prefix == null ? "" : prefix,
                        response, callback, TRACE_ID, includeAttachments);
                return true;
            }
        });
        server.start();
        port = connector.getLocalPort();
        httpClient = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
    }

    @AfterEach
    void tearDown() throws Exception {
        if (server != null && server.isRunning()) {
            server.stop();
        }
    }

    private HttpResponse<String> send(String path, String prefixValue) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path));
        if (prefixValue != null) {
            builder.header(TEST_PREFIX_HEADER, prefixValue);
        }
        return httpClient.send(builder.GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    @Nested
    @DisplayName("With honored proxy prefix")
    class WithProxyPrefix {

        @Test
        @DisplayName("Prepends the supplied prefix to Location and status link")
        void prependsProxyContextPathPrefix() throws Exception {
            var response = send("/plain", "/nifi-proxy");

            assertEquals(202, response.statusCode());
            assertTrue(response.headers().firstValue("Location").orElse("")
                            .endsWith("/nifi-proxy/status/" + TRACE_ID),
                    "Location must carry the proxy prefix");
            assertTrue(response.body().contains("\"href\":\"/nifi-proxy/status/" + TRACE_ID + "\""),
                    "status link href must carry the proxy prefix");
        }

        @Test
        @DisplayName("Prepends a different supplied prefix to Location and links")
        void prependsForwardedPrefix() throws Exception {
            var response = send("/plain", "/gw");

            assertEquals(202, response.statusCode());
            assertTrue(response.headers().firstValue("Location").orElse("")
                            .endsWith("/gw/status/" + TRACE_ID),
                    "Location must carry the supplied prefix");
            assertTrue(response.body().contains("\"href\":\"/gw/status/" + TRACE_ID + "\""),
                    "status link href must carry the supplied prefix");
        }

        @Test
        @DisplayName("Prepends the prefix to the attachments link when included")
        void prependsPrefixToAttachmentsLink() throws Exception {
            var response = send(ATTACHMENTS_PATH, "/nifi-proxy");

            assertEquals(202, response.statusCode());
            assertTrue(response.body().contains("\"href\":\"/nifi-proxy/status/" + TRACE_ID + "\""),
                    "status link href must carry the proxy prefix");
            assertTrue(response.body().contains("\"href\":\"/nifi-proxy/attachments/" + TRACE_ID + "\""),
                    "attachments link href must carry the proxy prefix");
        }
    }

    @Nested
    @DisplayName("Without honored proxy prefix")
    class WithoutProxyPrefix {

        @Test
        @DisplayName("Leaves Location and status link unprefixed when the supplied prefix is empty")
        void leavesOutputUnchanged() throws Exception {
            var response = send("/plain", null);

            assertEquals(202, response.statusCode());
            assertTrue(response.headers().firstValue("Location").orElse("")
                            .endsWith("/status/" + TRACE_ID),
                    "Location must point at the unprefixed status path");
            assertTrue(response.body().contains("\"href\":\"/status/" + TRACE_ID + "\""),
                    "status link href must be unprefixed");
        }

        @Test
        @DisplayName("Leaves the attachments link unprefixed when the supplied prefix is empty")
        void leavesAttachmentsLinkUnchanged() throws Exception {
            var response = send(ATTACHMENTS_PATH, null);

            assertEquals(202, response.statusCode());
            assertTrue(response.body().contains("\"href\":\"/attachments/" + TRACE_ID + "\""),
                    "attachments link href must be unprefixed");
            assertFalse(response.body().contains("/nifi-proxy"),
                    "no proxy prefix must appear when the supplied prefix is empty");
        }
    }
}
