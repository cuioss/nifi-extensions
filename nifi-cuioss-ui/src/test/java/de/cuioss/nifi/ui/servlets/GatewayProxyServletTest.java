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

import de.cuioss.nifi.ui.util.ComponentConfigReader;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import jakarta.servlet.http.HttpServletRequest;
import org.eclipse.jetty.ee11.servlet.ServletHolder;
import org.junit.jupiter.api.*;

import java.io.IOException;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
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

    /** Configurable processor properties — reset before each test. */
    private static final AtomicReference<Map<String, String>> processorProperties =
            new AtomicReference<>(createDefaultProperties());

    private static Map<String, String> createDefaultProperties() {
        Map<String, String> props = new HashMap<>();
        props.put("rest.gateway.listening.port", "9443");
        props.put("rest.gateway.max.request.size", "1048576");
        props.put("rest.gateway.request.queue.size", "50");
        props.put("rest.gateway.cors.allowed.origins", "http://localhost:8443");
        props.put("rest.gateway.listening.host", "0.0.0.0");
        props.put("restapi.health.path", "/api/health");
        props.put("restapi.health.methods", "GET");
        props.put("restapi.users.path", "/api/users");
        props.put("restapi.users.methods", "GET,POST");
        props.put("restapi.users.required-roles", "ADMIN");
        return props;
    }

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
                    protected Map<String, String> resolveProcessorProperties(
                            String processorId, HttpServletRequest req) throws IOException {
                        if (gatewayFailing.get()) throw new IOException("Connection refused");
                        return processorProperties.get();
                    }

                    @Override
                    protected ComponentConfigReader.ComponentConfig resolveComponentConfig(
                            String processorId, HttpServletRequest req) throws IOException {
                        if (gatewayFailing.get()) throw new IOException("Connection refused");
                        return new ComponentConfigReader.ComponentConfig(
                                ComponentConfigReader.ComponentType.PROCESSOR,
                                "de.cuioss.nifi.processors.gateway.RestApiGatewayProcessor",
                                processorProperties.get());
                    }

                    @Override
                    protected String executeGatewayGet(String url, String accept, String apiKey) throws IOException {
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
        processorProperties.set(createDefaultProperties());
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
        @DisplayName("Should reject GET with null pathInfo")
        void shouldRejectGetWithNullPathInfo() {
            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Invalid management path"));
        }

        @Test
        @DisplayName("Should reject missing processor ID")
        void shouldRejectMissingProcessorId() {
            given()
                    .when()
                    .get("/gateway/metrics")
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
                    .get("/gateway/metrics")
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
        @DisplayName("Should serve /config locally from processor properties")
        void shouldServeConfigLocally() {
            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(200)
                    .contentType(containsString("application/json"))
                    .body("component", equalTo("de.cuioss.nifi.processors.gateway.RestApiGatewayProcessor"))
                    .body("port", equalTo(9443))
                    .body("maxRequestBodySize", equalTo(1048576))
                    .body("queueSize", equalTo(50))
                    .body("ssl", equalTo(false))
                    .body("routes.size()", equalTo(2));
        }

        @Test
        @DisplayName("Should include route details in local config")
        void shouldIncludeRouteDetailsInLocalConfig() {
            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(200)
                    .body("routes.find { it.name == 'health' }.path", equalTo("/api/health"))
                    .body("routes.find { it.name == 'users' }.path", equalTo("/api/users"))
                    .body("routes.find { it.name == 'users' }.requiredRoles", hasItem("ADMIN"));
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
        @DisplayName("Should return 503 when gateway is unavailable for metrics")
        void shouldReturn503WhenGatewayUnavailableForMetrics() {
            gatewayFailing.set(true);

            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/metrics")
                    .then()
                    .statusCode(503)
                    .body("error", containsString("Gateway unavailable"));
        }

        @Test
        @DisplayName("Should return 503 when config properties unavailable")
        void shouldReturn503WhenConfigPropertiesUnavailable() {
            gatewayFailing.set(true);

            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(503)
                    .body("error", containsString("Gateway unavailable"));
        }

        @Test
        @DisplayName("Should report ssl=true when SSL context service is configured")
        void shouldReportSslEnabled() {
            Map<String, String> propsWithSsl = new HashMap<>(createDefaultProperties());
            propsWithSsl.put("rest.gateway.ssl.context.service", "ssl-service-id");
            processorProperties.set(propsWithSsl);

            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(200)
                    .body("ssl", equalTo(true));
        }

        @Test
        @DisplayName("Should handle minimal config with no optional properties")
        void shouldHandleMinimalConfig() {
            Map<String, String> minimalProps = new HashMap<>();
            minimalProps.put("rest.gateway.listening.port", "9443");
            processorProperties.set(minimalProps);

            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(200)
                    .body("port", equalTo(9443))
                    .body("ssl", equalTo(false))
                    .body("corsAllowedOrigins.size()", equalTo(0))
                    .body("routes.size()", equalTo(0));
        }

        @Test
        @DisplayName("Should skip routes with blank path")
        void shouldSkipRoutesWithBlankPath() {
            Map<String, String> propsWithBlankRoute = new HashMap<>(createDefaultProperties());
            propsWithBlankRoute.put("restapi.broken.path", "  ");
            propsWithBlankRoute.put("restapi.broken.methods", "GET");
            processorProperties.set(propsWithBlankRoute);

            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(200)
                    // Only the 2 original routes (health, users) — broken is skipped
                    .body("routes.size()", equalTo(2));
        }

        @Test
        @DisplayName("Should include CORS origins in config response")
        void shouldIncludeCorsOrigins() {
            Map<String, String> propsWithCors = new HashMap<>(createDefaultProperties());
            propsWithCors.put("rest.gateway.cors.allowed.origins",
                    "http://localhost:8443, https://nifi.example.com");
            processorProperties.set(propsWithCors);

            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(200)
                    .body("corsAllowedOrigins.size()", equalTo(2))
                    .body("corsAllowedOrigins[0]", equalTo("http://localhost:8443"))
                    .body("corsAllowedOrigins[1]", equalTo("https://nifi.example.com"));
        }

        @Test
        @DisplayName("Should include listening host in config response")
        void shouldIncludeListeningHost() {
            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(200)
                    .body("listeningHost", equalTo("0.0.0.0"));
        }
    }

    // -----------------------------------------------------------------------
    // POST — /test endpoint
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("POST /test endpoint")
    class PostTestEndpoint {

        @Test
        @DisplayName("Should reject POST with null pathInfo")
        void shouldRejectPostWithNullPathInfo() {
            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("{}")
                    .when()
                    .post("/gateway")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Invalid path for POST"));
        }

        @Test
        @DisplayName("Should reject blank processor ID on POST")
        void shouldRejectBlankProcessorIdOnPost() {
            given()
                    .header("X-Processor-Id", "  ")
                    .contentType("application/json")
                    .body("""
                            {"path":"/api/users","method":"GET","headers":{}}""")
                    .when()
                    .post("/gateway/test")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing processor ID"));
        }

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
        @DisplayName("Should proxy test request with request body")
        void shouldProxyTestRequestWithBody() {
            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"path":"/api/users","method":"POST","headers":{},"body":"{\\"name\\":\\"test\\"}"}""")
                    .when()
                    .post("/gateway/test")
                    .then()
                    .statusCode(200)
                    .body("status", equalTo(200));
        }

        @Test
        @DisplayName("Should handle test request without headers key")
        void shouldHandleTestRequestWithoutHeaders() {
            given()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"path":"/api/health","method":"GET"}""")
                    .when()
                    .post("/gateway/test")
                    .then()
                    .statusCode(200)
                    .body("status", equalTo(200));
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
        @DisplayName("Should contain only metrics (config is served locally)")
        void shouldContainExpectedPaths() {
            assertTrue(GatewayProxyServlet.ALLOWED_MANAGEMENT_PATHS.contains("/metrics"));
            assertFalse(GatewayProxyServlet.ALLOWED_MANAGEMENT_PATHS.contains("/config"));
            assertEquals(1, GatewayProxyServlet.ALLOWED_MANAGEMENT_PATHS.size());
        }
    }
}
