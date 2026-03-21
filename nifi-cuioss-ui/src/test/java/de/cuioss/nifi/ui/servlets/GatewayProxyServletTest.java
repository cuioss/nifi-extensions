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
import java.io.UncheckedIOException;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

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

    /** Configurable GET response status code — reset before each test. */
    private static final AtomicReference<Integer> gatewayGetStatusCode =
            new AtomicReference<>(200);

    /** When true, all gateway operations throw IOException. */
    private static final AtomicBoolean gatewayFailing = new AtomicBoolean(false);

    /** Configurable processor properties — reset before each test. */
    private static final AtomicReference<Map<String, String>> processorProperties =
            new AtomicReference<>(createDefaultProperties());

    /** Configurable IDP response body — reset before each test. */
    private static final AtomicReference<String> idpResponseBody =
            new AtomicReference<>("{\"access_token\":\"test-token\",\"expires_in\":300}");

    /** Configurable IDP response status code — reset before each test. */
    private static final AtomicReference<Integer> idpResponseStatus =
            new AtomicReference<>(200);

    /** Configurable controller service properties — reset before each test. */
    private static final AtomicReference<Map<String, String>> csProperties =
            new AtomicReference<>(createDefaultCsProperties());

    private static Map<String, String> createDefaultCsProperties() {
        Map<String, String> props = new HashMap<>();
        props.put("issuer.primary.issuer", "https://keycloak:8443/realms/master");
        props.put("issuer.primary.jwks-url", "https://keycloak:8443/realms/master/protocol/openid-connect/certs");
        return props;
    }

    private static Map<String, String> createDefaultProperties() {
        Map<String, String> props = new HashMap<>();
        props.put("rest.gateway.listening.port", "9443");
        props.put("rest.gateway.max.request.size", "1048576");
        props.put("rest.gateway.request.queue.size", "50");
        props.put("rest.gateway.listening.host", "0.0.0.0");
        props.put("rest.gateway.management.health.enabled", "true");
        props.put("rest.gateway.management.health.auth-mode", "local-only,bearer");
        props.put("rest.gateway.management.metrics.enabled", "true");
        props.put("rest.gateway.management.metrics.auth-mode", "local-only,bearer");
        props.put("rest.gateway.jwt.config.service", "cs-id-1234");
        props.put("restapi.users.path", "/api/users");
        props.put("restapi.users.methods", "GET,POST");
        props.put("restapi.users.required-roles", "ADMIN");
        return props;
    }

    private static EmbeddedServletTestSupport.ServerHandle handle;

    @BeforeAll
    static void startServer() throws Exception {
        handle = EmbeddedServletTestSupport.startServer(ctx ->
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
                    protected GatewayGetResponse executeGatewayGet(String url, String accept) throws IOException {
                        if (gatewayFailing.get()) throw new IOException("Connection refused");
                        return new GatewayGetResponse(gatewayGetStatusCode.get(), gatewayGetResponse.get());
                    }

                    @Override
                    protected GatewayResponse executeGatewayRequest(
                            String url, String method, Map<String, String> headers, String body)
                            throws IOException {
                        if (gatewayFailing.get()) throw new IOException("Connection refused");
                        return new GatewayResponse(200, "{\"result\":\"ok\"}",
                                Map.of("Content-Type", "application/json"));
                    }

                    @Override
                    protected IdpResponse executeIdpRequest(String url, String method,
                            String contentType, String body) throws IOException {
                        if (gatewayFailing.get()) throw new IOException("Connection refused");
                        return new IdpResponse(idpResponseStatus.get(), idpResponseBody.get());
                    }

                    @Override
                    protected Map<String, String> resolveControllerServiceProperties(
                            String csId, HttpServletRequest request) {
                        if (gatewayFailing.get()) throw new UncheckedIOException(new IOException("Connection refused"));
                        return csProperties.get();
                    }
                }), "/gateway/*"));
    }

    @AfterAll
    static void stopServer() throws Exception {
        handle.close();
    }

    @BeforeEach
    void resetBehavior() {
        gatewayGetResponse.set(SAMPLE_CONFIG_JSON);
        gatewayGetStatusCode.set(200);
        gatewayFailing.set(false);
        processorProperties.set(createDefaultProperties());
        idpResponseBody.set("{\"access_token\":\"test-token\",\"expires_in\":300}");
        idpResponseStatus.set(200);
        csProperties.set(createDefaultCsProperties());
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
            handle.spec()
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
            handle.spec()
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
            handle.spec()
                    .when()
                    .get("/gateway/metrics")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing processor ID"));
        }

        @Test
        @DisplayName("Should reject blank processor ID")
        void shouldRejectBlankProcessorId() {
            handle.spec()
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
            handle.spec()
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
                    .body("routes.size()", equalTo(1));
        }

        @Test
        @DisplayName("Should include route details in local config")
        void shouldIncludeRouteDetailsInLocalConfig() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(200)
                    .body("routes.find { it.name == 'users' }.path", equalTo("/api/users"))
                    .body("routes.find { it.name == 'users' }.requiredRoles", hasItem("ADMIN"));
        }

        @Test
        @DisplayName("Should include management endpoints in config")
        void shouldIncludeManagementEndpoints() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(200)
                    .body("managementEndpoints.size()", equalTo(4))
                    .body("managementEndpoints.find { it.name == 'health' }.path",
                            equalTo("/health"))
                    .body("managementEndpoints.find { it.name == 'health' }.enabled",
                            equalTo(true))
                    .body("managementEndpoints.find { it.name == 'health' }.authMode",
                            equalTo("local-only,bearer"))
                    .body("managementEndpoints.find { it.name == 'health' }.requiredRoles",
                            equalTo(""))
                    .body("managementEndpoints.find { it.name == 'health' }.requiredScopes",
                            equalTo(""))
                    .body("managementEndpoints.find { it.name == 'metrics' }.path",
                            equalTo("/metrics"))
                    .body("managementEndpoints.find { it.name == 'metrics' }.enabled",
                            equalTo(true))
                    .body("managementEndpoints.find { it.name == 'metrics' }.authMode",
                            equalTo("local-only,bearer"))
                    .body("managementEndpoints.find { it.name == 'metrics' }.requiredRoles",
                            equalTo(""))
                    .body("managementEndpoints.find { it.name == 'metrics' }.requiredScopes",
                            equalTo(""))
                    .body("managementEndpoints.find { it.name == 'status' }.path",
                            equalTo("/status/{traceId}"))
                    .body("managementEndpoints.find { it.name == 'status' }.enabled",
                            equalTo(true))
                    .body("managementEndpoints.find { it.name == 'attachments' }.path",
                            equalTo("/attachments/{parentTraceId}"))
                    .body("managementEndpoints.find { it.name == 'attachments' }.enabled",
                            equalTo(true));
        }

        @Test
        @DisplayName("Should proxy /metrics endpoint")
        void shouldProxyMetricsEndpoint() {
            gatewayGetResponse.set(SAMPLE_METRICS_JSON);

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/metrics")
                    .then()
                    .statusCode(200)
                    .body(containsString("nifi_jwt_validations_total"));
        }

        @Test
        @DisplayName("Should forward gateway error status code for metrics")
        void shouldForwardGatewayErrorStatusForMetrics() {
            gatewayGetStatusCode.set(401);
            gatewayGetResponse.set("""
                    {"type":"about:blank","title":"Unauthorized","status":401,"detail":"API key required"}""");

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/metrics")
                    .then()
                    .statusCode(401)
                    .body("title", equalTo("Unauthorized"));
        }

        @Test
        @DisplayName("Should return 503 when gateway is unavailable for metrics")
        void shouldReturn503WhenGatewayUnavailableForMetrics() {
            gatewayFailing.set(true);

            handle.spec()
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

            handle.spec()
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

            handle.spec()
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

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(200)
                    .body("port", equalTo(9443))
                    .body("ssl", equalTo(false))
                    .body("routes.size()", equalTo(0));
        }

        @Test
        @DisplayName("Should skip routes with blank path")
        void shouldSkipRoutesWithBlankPath() {
            Map<String, String> propsWithBlankRoute = new HashMap<>(createDefaultProperties());
            propsWithBlankRoute.put("restapi.broken.path", "  ");
            propsWithBlankRoute.put("restapi.broken.methods", "GET");
            processorProperties.set(propsWithBlankRoute);

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(200)
                    // Only the 1 original route (users) — broken is skipped
                    .body("routes.size()", equalTo(1));
        }

        @Test
        @DisplayName("Should include listening host in config response")
        void shouldIncludeListeningHost() {
            handle.spec()
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
            handle.spec()
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
            handle.spec()
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
            handle.spec()
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
            handle.spec()
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
            handle.spec()
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
            handle.spec()
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
            handle.spec()
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

            handle.spec()
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
            handle.spec()
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
            handle.spec()
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
            handle.spec()
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
        @DisplayName("Should contain metrics and health (config is served locally)")
        void shouldContainExpectedPaths() {
            assertTrue(GatewayProxyServlet.ALLOWED_MANAGEMENT_PATHS.contains("/metrics"));
            assertTrue(GatewayProxyServlet.ALLOWED_MANAGEMENT_PATHS.contains("/health"));
            assertFalse(GatewayProxyServlet.ALLOWED_MANAGEMENT_PATHS.contains("/config"));
            assertEquals(2, GatewayProxyServlet.ALLOWED_MANAGEMENT_PATHS.size());
        }
    }

    @Nested
    @DisplayName("GET /health proxy")
    class GetHealthProxy {

        @Test
        @DisplayName("Should proxy /health endpoint")
        void shouldProxyHealthEndpoint() {
            gatewayGetResponse.set("{\"status\":\"UP\",\"timestamp\":\"2026-02-27T12:00:00Z\"}");

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/health")
                    .then()
                    .statusCode(200)
                    .body(containsString("UP"));
        }
    }

    // -----------------------------------------------------------------------
    // POST — /token-fetch endpoint
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("POST /token-fetch endpoint")
    class TokenFetchEndpoint {

        @Test
        @DisplayName("Should fetch token with valid password grant")
        void shouldFetchTokenWithPasswordGrant() {
            // Default CS properties already include an issuer with host "keycloak"
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"tokenEndpointUrl":"https://keycloak:8443/realms/master/protocol/openid-connect/token",\
                            "grantType":"password","clientId":"test-client","clientSecret":"secret",\
                            "username":"admin","password":"admin","scope":"openid"}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(200)
                    .body("access_token", equalTo("test-token"))
                    .body("expires_in", equalTo(300))
                    .body("idpStatus", equalTo(200));
        }

        @Test
        @DisplayName("Should fetch token with client_credentials grant")
        void shouldFetchTokenWithClientCredentialsGrant() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"tokenEndpointUrl":"https://keycloak:8443/realms/master/protocol/openid-connect/token",\
                            "grantType":"client_credentials","clientId":"test-client","clientSecret":"secret",\
                            "scope":"openid"}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(200)
                    .body("access_token", equalTo("test-token"));
        }

        @Test
        @DisplayName("Should reject missing processor ID")
        void shouldRejectMissingProcessorId() {
            handle.spec()
                    .contentType("application/json")
                    .body("""
                            {"tokenEndpointUrl":"https://keycloak:8443/token",\
                            "grantType":"password","clientId":"c","clientSecret":"s"}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing processor ID"));
        }

        @Test
        @DisplayName("Should reject missing required fields")
        void shouldRejectMissingRequiredFields() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"grantType":"password"}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing required fields"));
        }

        @Test
        @DisplayName("Should reject invalid grant type")
        void shouldRejectInvalidGrantType() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"tokenEndpointUrl":"https://keycloak:8443/token",\
                            "grantType":"authorization_code","clientId":"c","clientSecret":"s"}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Invalid grant type"));
        }

        @Test
        @DisplayName("Should reject password grant with missing username")
        void shouldRejectPasswordGrantWithMissingUsername() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"tokenEndpointUrl":"https://keycloak:8443/token",\
                            "grantType":"password","clientId":"c","clientSecret":"s"}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing required field for password grant: username"));
        }

        @Test
        @DisplayName("Should block SSRF for disallowed host")
        void shouldBlockSsrfForDisallowedHost() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"tokenEndpointUrl":"http://evil.com/token",\
                            "grantType":"client_credentials","clientId":"c","clientSecret":"s"}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Token endpoint host not allowed"));
        }

        @Test
        @DisplayName("Should allow localhost for token endpoint")
        void shouldAllowLocalhostForTokenEndpoint() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"tokenEndpointUrl":"http://localhost:8080/token",\
                            "grantType":"password","clientId":"c","clientSecret":"s",\
                            "username":"u","password":"p","scope":"openid"}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(200)
                    .body("access_token", equalTo("test-token"));
        }

        @Test
        @DisplayName("Should forward IDP error response")
        void shouldForwardIdpErrorResponse() {
            idpResponseStatus.set(401);
            idpResponseBody.set("{\"error\":\"invalid_client\"}");

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"tokenEndpointUrl":"https://keycloak:8443/realms/master/protocol/openid-connect/token",\
                            "grantType":"password","clientId":"c","clientSecret":"s",\
                            "username":"u","password":"p","scope":"openid"}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(200)
                    .body("idpStatus", equalTo(401))
                    .body("error", containsString("Token request failed"));
        }

        @Test
        @DisplayName("Should handle blank scope by omitting it from request")
        void shouldHandleBlankScope() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"tokenEndpointUrl":"https://keycloak:8443/realms/master/protocol/openid-connect/token",\
                            "grantType":"client_credentials","clientId":"c","clientSecret":"s",\
                            "scope":""}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(200)
                    .body("access_token", equalTo("test-token"));
        }

        @Test
        @DisplayName("Should handle IDP 200 response without access_token")
        void shouldHandleIdpResponseWithoutAccessToken() {
            idpResponseBody.set("{\"token_type\":\"bearer\",\"expires_in\":300}");

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"tokenEndpointUrl":"https://keycloak:8443/realms/master/protocol/openid-connect/token",\
                            "grantType":"client_credentials","clientId":"c","clientSecret":"s"}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(200)
                    .body("idpStatus", equalTo(200))
                    .body("$", not(hasKey("access_token")));
        }

        @Test
        @DisplayName("Should handle IDP non-200 with null body")
        void shouldHandleIdpNon200WithNullBody() {
            idpResponseStatus.set(500);
            idpResponseBody.set(null);

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"tokenEndpointUrl":"https://keycloak:8443/realms/master/protocol/openid-connect/token",\
                            "grantType":"client_credentials","clientId":"c","clientSecret":"s"}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(200)
                    .body("idpStatus", equalTo(500))
                    .body("error", containsString("Token request failed"));
        }

        @Test
        @DisplayName("Should handle IDP 200 with malformed JSON body")
        void shouldHandleIdp200WithMalformedJson() {
            idpResponseBody.set("not-json-at-all");

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"tokenEndpointUrl":"https://keycloak:8443/realms/master/protocol/openid-connect/token",\
                            "grantType":"client_credentials","clientId":"c","clientSecret":"s"}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Invalid JSON"));
        }

        @Test
        @DisplayName("Should handle token fetch when gateway is unavailable (IOException)")
        void shouldHandleTokenFetchWhenGatewayUnavailable() {
            gatewayFailing.set(true);

            // Use localhost URL because when gateway is failing, resolveProcessorProperties
            // throws and SSRF check falls back to localhost-only allowed hosts
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"tokenEndpointUrl":"http://localhost:8080/token",\
                            "grantType":"client_credentials","clientId":"c","clientSecret":"s"}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(502)
                    .body("error", containsString("Token fetch failed"));
        }

        @Test
        @DisplayName("Should fetch token when no controller service is configured")
        void shouldFetchTokenWithNoControllerService() {
            // Remove controller service reference — SSRF check falls back to localhost-only
            Map<String, String> propsNoCs = new HashMap<>(createDefaultProperties());
            propsNoCs.remove("rest.gateway.jwt.config.service");
            processorProperties.set(propsNoCs);

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"tokenEndpointUrl":"http://localhost:8080/token",\
                            "grantType":"client_credentials","clientId":"c","clientSecret":"s"}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(200)
                    .body("access_token", equalTo("test-token"));
        }

        @Test
        @DisplayName("Should reject invalid JSON body")
        void shouldRejectInvalidJson() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("{ not valid }")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Invalid JSON"));
        }
    }

    // -----------------------------------------------------------------------
    // POST — /discover-token-endpoint
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("POST /discover-token-endpoint")
    class DiscoverTokenEndpoint {

        @Test
        @DisplayName("Should discover token endpoint from OIDC configuration")
        void shouldDiscoverTokenEndpoint() {
            idpResponseBody.set("""
                    {"issuer":"https://keycloak:8443/realms/master",\
                    "token_endpoint":"https://keycloak:8443/realms/master/protocol/openid-connect/token"}""");

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"issuerUrl":"https://keycloak:8443/realms/master"}""")
                    .when()
                    .post("/gateway/discover-token-endpoint")
                    .then()
                    .statusCode(200)
                    .body("tokenEndpoint", equalTo(
                            "https://keycloak:8443/realms/master/protocol/openid-connect/token"));
        }

        @Test
        @DisplayName("Should reject missing issuer URL")
        void shouldRejectMissingIssuerUrl() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"issuerUrl":""}""")
                    .when()
                    .post("/gateway/discover-token-endpoint")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing required field: issuerUrl"));
        }

        @Test
        @DisplayName("Should reject missing processor ID")
        void shouldRejectMissingProcessorId() {
            handle.spec()
                    .contentType("application/json")
                    .body("""
                            {"issuerUrl":"https://keycloak:8443/realms/master"}""")
                    .when()
                    .post("/gateway/discover-token-endpoint")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing processor ID"));
        }

        @Test
        @DisplayName("Should block SSRF for disallowed issuer host")
        void shouldBlockSsrfForDisallowedIssuerHost() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"issuerUrl":"http://evil.com/realms/master"}""")
                    .when()
                    .post("/gateway/discover-token-endpoint")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Issuer host not allowed"));
        }

        @Test
        @DisplayName("Should return error when discovery doc has no token_endpoint")
        void shouldReturnErrorWhenNoTokenEndpointInDiscovery() {
            idpResponseBody.set("""
                    {"issuer":"https://keycloak:8443/realms/master"}""");

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"issuerUrl":"https://keycloak:8443/realms/master"}""")
                    .when()
                    .post("/gateway/discover-token-endpoint")
                    .then()
                    .statusCode(502)
                    .body("error", containsString("No token_endpoint"));
        }

        @Test
        @DisplayName("Should reject invalid JSON body for discover")
        void shouldRejectInvalidJsonForDiscover() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("{ not valid }")
                    .when()
                    .post("/gateway/discover-token-endpoint")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Invalid JSON"));
        }

        @Test
        @DisplayName("Should handle IDP discovery failure")
        void shouldHandleIdpDiscoveryFailure() {
            idpResponseStatus.set(404);
            idpResponseBody.set("Not Found");

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"issuerUrl":"https://keycloak:8443/realms/master"}""")
                    .when()
                    .post("/gateway/discover-token-endpoint")
                    .then()
                    .statusCode(502)
                    .body("error", containsString("OIDC discovery failed"));
        }
    }

    // -----------------------------------------------------------------------
    // Token endpoint SSRF host allowlist (pure unit tests)
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("Token endpoint host allowlist")
    class AllowedIssuerHosts {

        @Test
        @DisplayName("Should always allow localhost variants")
        void shouldAlwaysAllowLocalhost() {
            Set<String> hosts = Set.of("localhost", "127.0.0.1", "::1");
            assertTrue(GatewayProxyServlet.isAllowedTokenEndpointHost(
                    "http://localhost:8080/token", hosts));
            assertTrue(GatewayProxyServlet.isAllowedTokenEndpointHost(
                    "http://127.0.0.1:8080/token", hosts));
        }

        @Test
        @DisplayName("Should allow configured issuer hosts")
        void shouldAllowConfiguredIssuerHosts() {
            Set<String> hosts = Set.of("localhost", "keycloak", "idp.example.com");
            assertTrue(GatewayProxyServlet.isAllowedTokenEndpointHost(
                    "https://keycloak:8443/realms/master/protocol/openid-connect/token", hosts));
            assertTrue(GatewayProxyServlet.isAllowedTokenEndpointHost(
                    "https://idp.example.com/token", hosts));
        }

        @Test
        @DisplayName("Should reject non-configured hosts")
        void shouldRejectNonConfiguredHosts() {
            Set<String> hosts = Set.of("localhost", "keycloak");
            assertFalse(GatewayProxyServlet.isAllowedTokenEndpointHost(
                    "http://evil.com/token", hosts));
        }

        @Test
        @DisplayName("Should handle malformed URLs")
        void shouldHandleMalformedUrls() {
            Set<String> hosts = Set.of("localhost");
            assertFalse(GatewayProxyServlet.isAllowedTokenEndpointHost(
                    "not-a-valid-url", hosts));
        }

        @Test
        @DisplayName("Should be case-insensitive for host matching")
        void shouldBeCaseInsensitiveForHostMatching() {
            Set<String> hosts = Set.of("keycloak");
            assertTrue(GatewayProxyServlet.isAllowedTokenEndpointHost(
                    "http://Keycloak:8080/token", hosts));
        }
    }

    // -----------------------------------------------------------------------
    // Merged routes array (pure unit tests)
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("buildMergedRoutesArray")
    class BuildMergedRoutesArray {

        @Test
        @DisplayName("Should mark external-only routes with source 'external'")
        void shouldMarkExternalOnlyRoutes() {
            Map<String, String> externalProps = Map.of(
                    "restapi.data.path", "/api/data",
                    "restapi.data.methods", "GET");
            Map<String, String> nifiProps = Map.of();

            var result = GatewayProxyServlet.buildMergedRoutesArray(externalProps, nifiProps).build();
            assertEquals(1, result.size());
            assertEquals("external", result.getJsonObject(0).getString("source"));
            assertEquals("data", result.getJsonObject(0).getString("name"));
        }

        @Test
        @DisplayName("Should mark NiFi-only routes with source 'nifi'")
        void shouldMarkNifiOnlyRoutes() {
            Map<String, String> externalProps = Map.of();
            Map<String, String> nifiProps = Map.of(
                    "restapi.users.path", "/api/users",
                    "restapi.users.methods", "GET,POST");

            var result = GatewayProxyServlet.buildMergedRoutesArray(externalProps, nifiProps).build();
            assertEquals(1, result.size());
            assertEquals("nifi", result.getJsonObject(0).getString("source"));
        }

        @Test
        @DisplayName("Should mark routes present in both sources with source 'both'")
        void shouldMarkBothSourceRoutes() {
            Map<String, String> externalProps = new HashMap<>();
            externalProps.put("restapi.data.path", "/api/data-ext");
            externalProps.put("restapi.data.methods", "GET");

            Map<String, String> nifiProps = new HashMap<>();
            nifiProps.put("restapi.data.path", "/api/data");
            nifiProps.put("restapi.data.methods", "GET,POST");

            var result = GatewayProxyServlet.buildMergedRoutesArray(externalProps, nifiProps).build();
            assertEquals(1, result.size());
            assertEquals("both", result.getJsonObject(0).getString("source"));
            // NiFi properties should override external
            assertEquals("/api/data", result.getJsonObject(0).getString("path"));
        }

        @Test
        @DisplayName("Should include routes from both sources in merged result")
        void shouldMergeRoutesFromBothSources() {
            Map<String, String> externalProps = Map.of(
                    "restapi.admin.path", "/api/admin",
                    "restapi.admin.methods", "GET");

            Map<String, String> nifiProps = Map.of(
                    "restapi.users.path", "/api/users",
                    "restapi.users.methods", "POST");

            var result = GatewayProxyServlet.buildMergedRoutesArray(externalProps, nifiProps).build();
            assertEquals(2, result.size());
        }

        @Test
        @DisplayName("Should skip routes without path")
        void shouldSkipRoutesWithoutPath() {
            Map<String, String> externalProps = Map.of(
                    "restapi.broken.methods", "GET");
            Map<String, String> nifiProps = Map.of();

            var result = GatewayProxyServlet.buildMergedRoutesArray(externalProps, nifiProps).build();
            assertEquals(0, result.size());
        }

        @Test
        @DisplayName("Should exclude disabled routes from external config")
        void shouldIncludeDisabledRoutesWithCorrectFlag() {
            Map<String, String> externalProps = Map.of(
                    "restapi.disabled.path", "/api/disabled",
                    "restapi.disabled.methods", "GET",
                    "restapi.disabled.enabled", "false");
            Map<String, String> nifiProps = Map.of();

            var result = GatewayProxyServlet.buildMergedRoutesArray(externalProps, nifiProps).build();
            assertEquals(1, result.size());
            assertFalse(result.getJsonObject(0).getBoolean("enabled"));
            assertEquals("external", result.getJsonObject(0).getString("source"));
        }
    }

    // -----------------------------------------------------------------------
    // External config in /config response (integration-level servlet test)
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("GET /config with external routes")
    class GetConfigWithExternalRoutes {

        @Test
        @DisplayName("Should include external routes in /config response")
        void shouldIncludeExternalRoutesInConfigResponse() {
            // The default test servlet overrides loadExternalRouteProperties
            // We need a separate test instance — use the static method directly
            Map<String, String> externalProps = Map.of(
                    "restapi.ext-data.path", "/api/ext-data",
                    "restapi.ext-data.methods", "GET");
            Map<String, String> nifiProps = Map.of(
                    "restapi.users.path", "/api/users",
                    "restapi.users.methods", "POST");

            var result = GatewayProxyServlet.buildMergedRoutesArray(externalProps, nifiProps).build();
            assertEquals(2, result.size());

            // Find external route
            var extRoute = result.stream()
                    .map(v -> v.asJsonObject())
                    .filter(o -> "ext-data".equals(o.getString("name")))
                    .findFirst()
                    .orElseThrow();
            assertEquals("external", extRoute.getString("source"));
            assertEquals("/api/ext-data", extRoute.getString("path"));
        }

        @Test
        @DisplayName("Should have NiFi properties override external config for same route")
        void shouldHaveNifiOverrideExternal() {
            Map<String, String> externalProps = new HashMap<>();
            externalProps.put("restapi.data.path", "/api/data-ext");
            externalProps.put("restapi.data.methods", "GET");
            externalProps.put("restapi.data.required-roles", "USER");

            Map<String, String> nifiProps = new HashMap<>();
            nifiProps.put("restapi.data.path", "/api/data");
            nifiProps.put("restapi.data.methods", "GET,POST");

            var result = GatewayProxyServlet.buildMergedRoutesArray(externalProps, nifiProps).build();
            var dataRoute = result.getJsonObject(0);
            assertEquals("both", dataRoute.getString("source"));
            assertEquals("/api/data", dataRoute.getString("path"));
            // NiFi methods override
            var methods = dataRoute.getJsonArray("methods");
            assertEquals(2, methods.size());
        }
    }
}
