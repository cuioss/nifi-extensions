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
package de.cuioss.nifi.ui.servlets;

import de.cuioss.test.juli.junit5.EnableTestLogger;
import jakarta.servlet.http.HttpServletRequest;
import org.eclipse.jetty.ee11.servlet.ServletHolder;
import org.junit.jupiter.api.*;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link GatewayProxyServlet} using embedded Jetty + REST Assured.
 * <p>
 * Uses a test subclass to stub outgoing HTTP calls
 * ({@code resolveGatewayPort}, {@code executeGatewayGet},
 * {@code executeGatewayRequest}), allowing isolated testing
 * of path validation, SSRF protection, and response formatting.
 */
@EnableTestLogger
@DisplayName("GatewayProxyServlet tests")
class GatewayProxyServletTest {

    private static final String SAMPLE_CONFIG_JSON = """
            {"component":"RestApiGatewayProcessor","port":9443,"routes":[]}""";
    private static final String SAMPLE_METRICS_JSON = """
            {"nifi_jwt_validations_total":42}""";
    private static final String PROCESSOR_ID = "d290f1ee-6c54-4b01-90e6-d701748f0851";

    /** Configurable GET response — reset before each test. */
    private static final AtomicReference<String> gatewayGetResponse =
            new AtomicReference<>(SAMPLE_CONFIG_JSON);

    /** When true, all gateway operations throw IOException. */
    private static final AtomicBoolean gatewayFailing = new AtomicBoolean(false);

    @BeforeAll
    static void startServer() throws Exception {
        EmbeddedServletTestSupport.startServer(ctx ->
                ctx.addServlet(new ServletHolder(new GatewayProxyServlet() {
                    @Override
                    protected int resolveGatewayPort(String processorId, HttpServletRequest req) throws IOException {
                        if (gatewayFailing.get()) throw new IOException("Connection refused");
                        return 9443;
                    }

                    @Override
                    protected String executeGatewayGet(String url, String accept) throws IOException {
                        if (gatewayFailing.get()) throw new IOException("Connection refused");
                        return gatewayGetResponse.get();
                    }

                    @Override
                    protected GatewayResponse executeGatewayRequest(
                            String url, String method, Map<String, String> headers, String body)
                            throws IOException {
                        if (gatewayFailing.get()) throw new IOException("Connection refused");
                        return new GatewayResponse(200, "{\"result\":\"ok\"}",
                                Map.of("Content-Type", "application/json"));
                    }
                }), "/gateway/*"));
    }

    @AfterAll
    static void stopServer() throws Exception {
        EmbeddedServletTestSupport.stopServer();
    }

    @BeforeEach
    void resetBehavior() {
        gatewayGetResponse.set(SAMPLE_CONFIG_JSON);
        gatewayFailing.set(false);
    }

    // -----------------------------------------------------------------------
    // GET — path validation
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("GET path validation")
    class GetPathValidation {

        @Test
        @DisplayName("Should reject non-whitelisted path")
        void shouldRejectNonWhitelistedPath() {
            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/evil")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Invalid management path"));
        }

        @Test
        @DisplayName("Should reject missing processor ID")
        void shouldRejectMissingProcessorId() {
            given()
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing processor ID"));
        }

        @Test
        @DisplayName("Should reject blank processor ID")
        void shouldRejectBlankProcessorId() {
            given()
                    .header("X-Processor-Id", "  ")
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing processor ID"));
        }
    }

    // -----------------------------------------------------------------------
    // GET — proxy behavior
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("GET management proxy")
    class GetManagementProxy {

        @Test
        @DisplayName("Should proxy /config endpoint")
        void shouldProxyConfigEndpoint() {
            gatewayGetResponse.set(SAMPLE_CONFIG_JSON);

            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(200)
                    .contentType(containsString("application/json"))
                    .body(containsString("RestApiGatewayProcessor"));
        }

        @Test
        @DisplayName("Should proxy /metrics endpoint")
        void shouldProxyMetricsEndpoint() {
            gatewayGetResponse.set(SAMPLE_METRICS_JSON);

            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/metrics")
                    .then()
                    .statusCode(200)
                    .body(containsString("nifi_jwt_validations_total"));
        }

        @Test
        @DisplayName("Should return 503 when gateway is unavailable")
        void shouldReturn503WhenGatewayUnavailable() {
            gatewayFailing.set(true);

            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(503)
                    .body("error", containsString("Gateway unavailable"));
        }
    }

    // -----------------------------------------------------------------------
    // POST — /test endpoint
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("POST /test endpoint")
    class PostTestEndpoint {

        @Test
        @DisplayName("Should reject non-test POST path")
        void shouldRejectNonTestPostPath() {
            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("{}")
                    .when()
                    .post("/gateway/config")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Invalid path for POST"));
        }

        @Test
        @DisplayName("Should reject missing processor ID on POST")
        void shouldRejectMissingProcessorIdOnPost() {
            given()
                    .contentType("application/json")
                    .body("{}")
                    .when()
                    .post("/gateway/test")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing processor ID"));
        }

        @Test
        @DisplayName("Should proxy valid test request")
        void shouldProxyValidTestRequest() {
            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"path":"/api/users","method":"GET","headers":{"Authorization":"Bearer token123"}}""")
                    .when()
                    .post("/gateway/test")
                    .then()
                    .statusCode(200)
                    .body("status", equalTo(200))
                    .body("body", containsString("result"));
        }

        @Test
        @DisplayName("Should reject missing path in test request")
        void shouldRejectMissingPath() {
            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"method":"GET","headers":{}}""")
                    .when()
                    .post("/gateway/test")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing 'path'"));
        }

        @Test
        @DisplayName("Should reject invalid JSON body")
        void shouldRejectInvalidJson() {
            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("{ invalid }")
                    .when()
                    .post("/gateway/test")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Invalid JSON"));
        }

        @Test
        @DisplayName("Should return 503 when gateway is unavailable for test")
        void shouldReturn503WhenGatewayUnavailableForTest() {
            gatewayFailing.set(true);

            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"path":"/api/users","method":"GET","headers":{}}""")
                    .when()
                    .post("/gateway/test")
                    .then()
                    .statusCode(503)
                    .body("error", containsString("Gateway unavailable"));
        }

        @Test
        @DisplayName("Should handle null body in test request")
        void shouldHandleNullBody() {
            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"path":"/api/health","method":"GET","headers":{},"body":null}""")
                    .when()
                    .post("/gateway/test")
                    .then()
                    .statusCode(200)
                    .body("status", equalTo(200));
        }
    }

    // -----------------------------------------------------------------------
    // SSRF protection (static method — pure unit tests)
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("SSRF protection")
    class SsrfProtection {

        @Test
        @DisplayName("Should allow localhost")
        void shouldAllowLocalhost() {
            assertTrue(GatewayProxyServlet.isLocalhostTarget(
                    URI.create("http://localhost:9443/config")));
        }

        @Test
        @DisplayName("Should allow 127.0.0.1")
        void shouldAllow127001() {
            assertTrue(GatewayProxyServlet.isLocalhostTarget(
                    URI.create("http://127.0.0.1:9443/config")));
        }

        @Test
        @DisplayName("Should allow IPv6 loopback")
        void shouldAllowIpv6Loopback() {
            assertTrue(GatewayProxyServlet.isLocalhostTarget(
                    URI.create("http://[::1]:9443/config")));
        }

        @Test
        @DisplayName("Should reject external hosts")
        void shouldRejectExternalHosts() {
            assertFalse(GatewayProxyServlet.isLocalhostTarget(
                    URI.create("http://evil.com:9443/config")));
        }

        @Test
        @DisplayName("Should reject internal network IPs")
        void shouldRejectInternalNetworkIps() {
            assertFalse(GatewayProxyServlet.isLocalhostTarget(
                    URI.create("http://192.168.1.1:9443/config")));
        }
    }

    // -----------------------------------------------------------------------
    // Allowed paths set (pure unit test)
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("Allowed paths")
    class AllowedPaths {

        @Test
        @DisplayName("Should contain metrics and config")
        void shouldContainExpectedPaths() {
            assertTrue(GatewayProxyServlet.ALLOWED_MANAGEMENT_PATHS.contains("/metrics"));
            assertTrue(GatewayProxyServlet.ALLOWED_MANAGEMENT_PATHS.contains("/config"));
            assertEquals(2, GatewayProxyServlet.ALLOWED_MANAGEMENT_PATHS.size());
        }
    }
}
