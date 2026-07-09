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
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;
import org.eclipse.jetty.util.Callback;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests for {@link RequestUtils#buildStatusLocationUri} and
 * {@link RequestUtils#sendAcceptedResponse}, driving the methods through a real
 * embedded Jetty request so the reverse-proxy context path is read from the same
 * {@code request.getHeaders()} accessor used in production.
 *
 * <p>The test handler invokes {@code sendAcceptedResponse}; its 202 {@code Location}
 * header is produced by {@code buildStatusLocationUri}, so a single round-trip
 * asserts both methods prepend the proxy prefix to the {@code Location} header and
 * to the HATEOAS {@code _links} hrefs when a proxy header is present, and leave the
 * output unchanged when it is not.
 */
@EnableTestLogger
@DisplayName("RequestUtils")
class RequestUtilsTest {

    private static final String TRACE_ID = "d1e2f3a4-b5c6-4788-9a0b-1c2d3e4f5a6b";
    private static final String ATTACHMENTS_PATH = "/with-attachments";

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
                RequestUtils.sendAcceptedResponse(request, response, callback, TRACE_ID, includeAttachments);
                return true;
            }
        });
        server.start();
        port = connector.getLocalPort();
        httpClient = HttpClient.newHttpClient();
    }

    @AfterEach
    void tearDown() throws Exception {
        if (server != null && server.isRunning()) {
            server.stop();
        }
    }

    private HttpResponse<String> send(String path, String prefixHeaderName, String prefixHeaderValue)
            throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path));
        if (prefixHeaderName != null) {
            builder.header(prefixHeaderName, prefixHeaderValue);
        }
        return httpClient.send(builder.GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    @Nested
    @DisplayName("With proxy prefix")
    class WithProxyPrefix {

        @Test
        @DisplayName("Prepends the X-ProxyContextPath prefix to Location and status link")
        void prependsProxyContextPathPrefix() throws Exception {
            var response = send("/plain", "X-ProxyContextPath", "/nifi-proxy");

            assertEquals(202, response.statusCode());
            assertTrue(response.headers().firstValue("Location").orElse("")
                            .endsWith("/nifi-proxy/status/" + TRACE_ID),
                    "Location must carry the proxy prefix");
            assertTrue(response.body().contains("\"href\":\"/nifi-proxy/status/" + TRACE_ID + "\""),
                    "status link href must carry the proxy prefix");
        }

        @Test
        @DisplayName("Prepends the X-Forwarded-Prefix fallback prefix to Location and links")
        void prependsForwardedPrefix() throws Exception {
            var response = send("/plain", "X-Forwarded-Prefix", "/gw");

            assertEquals(202, response.statusCode());
            assertTrue(response.headers().firstValue("Location").orElse("")
                            .endsWith("/gw/status/" + TRACE_ID),
                    "Location must carry the fallback prefix");
            assertTrue(response.body().contains("\"href\":\"/gw/status/" + TRACE_ID + "\""),
                    "status link href must carry the fallback prefix");
        }

        @Test
        @DisplayName("Prepends the prefix to the attachments link when included")
        void prependsPrefixToAttachmentsLink() throws Exception {
            var response = send(ATTACHMENTS_PATH, "X-ProxyContextPath", "/nifi-proxy");

            assertEquals(202, response.statusCode());
            assertTrue(response.body().contains("\"href\":\"/nifi-proxy/status/" + TRACE_ID + "\""),
                    "status link href must carry the proxy prefix");
            assertTrue(response.body().contains("\"href\":\"/nifi-proxy/attachments/" + TRACE_ID + "\""),
                    "attachments link href must carry the proxy prefix");
        }
    }

    @Nested
    @DisplayName("Without proxy prefix")
    class WithoutProxyPrefix {

        @Test
        @DisplayName("Leaves Location and status link unprefixed when no proxy header present")
        void leavesOutputUnchanged() throws Exception {
            var response = send("/plain", null, null);

            assertEquals(202, response.statusCode());
            assertTrue(response.headers().firstValue("Location").orElse("")
                            .endsWith("/status/" + TRACE_ID),
                    "Location must point at the unprefixed status path");
            assertTrue(response.body().contains("\"href\":\"/status/" + TRACE_ID + "\""),
                    "status link href must be unprefixed");
        }

        @Test
        @DisplayName("Leaves the attachments link unprefixed when no proxy header present")
        void leavesAttachmentsLinkUnchanged() throws Exception {
            var response = send(ATTACHMENTS_PATH, null, null);

            assertEquals(202, response.statusCode());
            assertTrue(response.body().contains("\"href\":\"/attachments/" + TRACE_ID + "\""),
                    "attachments link href must be unprefixed");
            assertFalse(response.body().contains("/nifi-proxy"),
                    "no proxy prefix must appear when the header is absent");
        }
    }
}
