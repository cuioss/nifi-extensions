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

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;

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
    @DisplayName("HTTPS Round-Trip")
    class HttpsRoundTrip {

        @Test
        @DisplayName("Should accept HTTPS request with SSL context")
        void shouldAcceptHttpsRequest() throws Exception {
            SSLContext serverSslContext = createSelfSignedSslContext();
            manager.start(0, echoHandler(), serverSslContext);

            assertTrue(manager.isRunning());
            assertTrue(manager.getPort() > 0);

            // Create client that trusts the self-signed cert
            HttpClient client = HttpClient.newBuilder()
                    .sslContext(createTrustAllSslContext())
                    .build();

            var response = client.send(
                    HttpRequest.newBuilder(URI.create("https://localhost:" + manager.getPort() + "/test"))
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode());
            assertEquals("OK", response.body());
        }

        @Test
        @DisplayName("Should reject plain HTTP on HTTPS port")
        void shouldRejectPlainHttpOnHttpsPort() throws Exception {
            SSLContext serverSslContext = createSelfSignedSslContext();
            manager.start(0, echoHandler(), serverSslContext);

            HttpClient client = HttpClient.newHttpClient();

            assertThrows(Exception.class, () -> client.send(
                    HttpRequest.newBuilder(URI.create("http://localhost:" + manager.getPort() + "/test"))
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString()));
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

    private static final String TEST_KEYSTORE = "test-keystore.p12";
    private static final char[] KEYSTORE_PASSWORD = "changeit".toCharArray();

    /**
     * Loads the test PKCS12 keystore from classpath and creates an SSLContext.
     */
    @SuppressWarnings("java:S6437") // Hardcoded password intentional in tests
    private static SSLContext createSelfSignedSslContext() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("PKCS12");
        try (var is = JettyServerManagerTest.class.getClassLoader().getResourceAsStream(TEST_KEYSTORE)) {
            keyStore.load(is, KEYSTORE_PASSWORD);
        }
        KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        kmf.init(keyStore, KEYSTORE_PASSWORD);

        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(kmf.getKeyManagers(), null, new SecureRandom());
        return sslContext;
    }

    /**
     * Creates a trust-all SSLContext for the test HTTP client.
     */
    @SuppressWarnings("java:S4830") // Trust-all is intentional for self-signed test certs
    private static SSLContext createTrustAllSslContext() throws Exception {
        TrustManager[] trustAll = {
                new X509TrustManager() {
                    @Override
                    public void checkClientTrusted(X509Certificate[] chain, String authType) {
                        // Trust all for test self-signed certs
                    }

                    @Override
                    public void checkServerTrusted(X509Certificate[] chain, String authType) {
                        // Trust all for test self-signed certs
                    }

                    @Override
                    public X509Certificate[] getAcceptedIssuers() {
                        return new X509Certificate[0];
                    }
                }
        };
        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(null, trustAll, new SecureRandom());
        return sslContext;
    }
}
