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
package de.cuioss.nifi.rest.server;

import de.cuioss.test.juli.LogAsserts;
import de.cuioss.test.juli.TestLogLevel;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import org.junit.jupiter.api.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("JettyServerManager")
@EnableTestLogger
class JettyServerManagerTest {

    private JettyServerManager manager;

    @BeforeEach
    void setUp() {
        manager = new JettyServerManager();
    }

    @AfterEach
    void tearDown() {
        manager.stop();
    }

    private static Handler echoHandler() {
        return new Handler.Abstract() {
            @Override
            public boolean handle(Request request, Response response, Callback callback) {
                response.setStatus(200);
                byte[] body = "OK".getBytes(StandardCharsets.UTF_8);
                response.getHeaders().put("Content-Length", body.length);
                response.write(true, ByteBuffer.wrap(body), callback);
                return true;
            }
        };
    }

    @Nested
    @DisplayName("Lifecycle")
    class Lifecycle {

        @Test
        @DisplayName("Should start on specified port")
        void shouldStartOnSpecifiedPort() {
            manager.start(0, echoHandler());

            assertTrue(manager.isRunning());
            assertTrue(manager.getPort() > 0);
        }

        @Test
        @DisplayName("Should stop gracefully")
        void shouldStopGracefully() {
            manager.start(0, echoHandler());
            assertTrue(manager.isRunning());

            manager.stop();

            assertFalse(manager.isRunning());
        }

        @Test
        @DisplayName("Should reject double start")
        void shouldRejectDoubleStart() {
            manager.start(0, echoHandler());

            assertThrows(IllegalStateException.class,
                    () -> manager.start(0, echoHandler()));
        }

        @Test
        @DisplayName("Should allow restart after stop")
        void shouldAllowRestartAfterStop() {
            manager.start(0, echoHandler());
            manager.stop();

            manager.start(0, echoHandler());

            assertTrue(manager.isRunning());
        }

        @Test
        @DisplayName("Should handle stop when never started")
        void shouldHandleStopWhenNeverStarted() {
            assertDoesNotThrow(() -> manager.stop());
        }

        @Test
        @DisplayName("Should return -1 port when not running")
        void shouldReturnNegativePortWhenNotRunning() {
            assertEquals(-1, manager.getPort());
        }
    }

    @Nested
    @DisplayName("HTTP Round-Trip")
    class HttpRoundTrip {

        @Test
        @DisplayName("Should accept HTTP request")
        void shouldAcceptHttpRequest() throws Exception {
            manager.start(0, echoHandler());

            HttpClient client = HttpClient.newHttpClient();
            var response = client.send(
                    HttpRequest.newBuilder(URI.create("http://localhost:" + manager.getPort() + "/test"))
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode());
            assertEquals("OK", response.body());
        }
    }

    @Nested
    @DisplayName("Logging")
    class Logging {

        @Test
        @DisplayName("Should log server started")
        void shouldLogServerStarted() {
            manager.start(0, echoHandler());

            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.INFO, "REST-1:");
        }

        @Test
        @DisplayName("Should log server stopped")
        void shouldLogServerStopped() {
            manager.start(0, echoHandler());
            manager.stop();

            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.INFO, "REST-2:");
        }
    }
}
