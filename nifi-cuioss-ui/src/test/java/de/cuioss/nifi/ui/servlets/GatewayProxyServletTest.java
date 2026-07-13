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

import de.cuioss.http.security.database.ApacheCVEAttackDatabase;
import de.cuioss.http.security.database.AttackTestCase;
import de.cuioss.http.security.database.ModSecurityCRSAttackDatabase;
import de.cuioss.http.security.database.OWASPTop10AttackDatabase;
import de.cuioss.nifi.ui.util.ComponentConfigReader;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import jakarta.json.JsonValue;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.nifi.web.ClusterRequestException;
import org.apache.nifi.web.NiFiWebConfigurationContext;
import org.eclipse.jetty.ee11.servlet.ServletHolder;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ArgumentsSource;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.easymock.EasyMock.createNiceMock;
import static org.easymock.EasyMock.replay;
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
    // B3 rationale: a fixed, well-formed UUID is used as the routing stub because the
    // test subclass overrides every resolve* hook and never dereferences the ID — the
    // value only needs to (a) satisfy the servlet's X-Processor-Id header validation as a
    // legitimate UUID so requests reach the stubbed gateway logic and (b) stay constant so
    // each request routes through the same stub. A literal UUID (vs a generated one) keeps
    // the routing deterministic and the assertions readable; the specific digits carry no
    // behavioral meaning.
    private static final String PROCESSOR_ID = "d290f1ee-6c54-4b01-90e6-d701748f0851";

    /** Configurable GET response — reset before each test. */
    private static final AtomicReference<String> gatewayGetResponse =
            new AtomicReference<>(SAMPLE_CONFIG_JSON);

    /** Configurable GET response status code — reset before each test. */
    private static final AtomicReference<Integer> gatewayGetStatusCode =
            new AtomicReference<>(200);

    /** When true, all gateway operations throw IOException. */
    private static final AtomicBoolean gatewayFailing = new AtomicBoolean(false);

    /**
     * When true, only the outgoing gateway HTTP calls (executeGatewayGet /
     * executeGatewayRequest) throw IOException while port/property resolution
     * succeeds — exercises the stale-cache invalidation on fetch failure.
     */
    private static final AtomicBoolean gatewayExecuteFailing = new AtomicBoolean(false);

    /**
     * When set, config resolution (port/property/component lookup) throws this
     * unchecked exception — exercises the fail-secure {@code ClusterRequestException |
     * IllegalStateException} → 503 branch. Reset before each test.
     */
    private static final AtomicReference<RuntimeException> configResolveException =
            new AtomicReference<>(null);

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
        Map<String, String> props = new HashMap<>(Map.of(
                "issuer.primary.issuer", "https://keycloak:8443/realms/master",
                "issuer.primary.jwks-url", "https://keycloak:8443/realms/master/protocol/openid-connect/certs"));
        return props;
    }

    private static Map<String, String> createDefaultProperties() {
        Map<String, String> props = new HashMap<>(Map.ofEntries(
                Map.entry("rest.gateway.listening.port", "9443"),
                Map.entry("rest.gateway.max.request.size", "1048576"),
                Map.entry("rest.gateway.request.queue.size", "50"),
                Map.entry("rest.gateway.listening.host", "0.0.0.0"),
                Map.entry("rest.gateway.management.health.enabled", "true"),
                Map.entry("rest.gateway.management.health.auth-mode", "local-only,bearer"),
                Map.entry("rest.gateway.management.metrics.enabled", "true"),
                Map.entry("rest.gateway.management.metrics.auth-mode", "local-only,bearer"),
                Map.entry("rest.gateway.jwt.config.service", "cs-id-1234"),
                Map.entry("restapi.users.path", "/api/users"),
                Map.entry("restapi.users.methods", "GET,POST"),
                Map.entry("restapi.users.required-roles", "ADMIN")));
        return props;
    }

    private static EmbeddedServletTestSupport.ServerHandle handle;

    @BeforeAll
    static void startServer() throws Exception {
        // A non-null nifi-web-configuration-context attribute makes the servlet's init()
        // populate configContext, so the null-context 503 guard (requireConfigContext) stays
        // quiet and the overridden resolve* hooks drive the stubbed responses. The mock is
        // never dereferenced because every resolve* hook is overridden.
        NiFiWebConfigurationContext dummyContext = createNiceMock(NiFiWebConfigurationContext.class);
        replay(dummyContext);

        handle = EmbeddedServletTestSupport.startServer(ctx -> {
            ctx.setAttribute("nifi-web-configuration-context", dummyContext);
            ctx.addServlet(new ServletHolder(new GatewayProxyServlet() {
                    @Override
                    protected int resolveGatewayPort(String processorId, HttpServletRequest req) throws IOException {
                        throwConfiguredResolveException();
                        if (gatewayFailing.get()) throw new IOException("Connection refused");
                        return 9443;
                    }

                    @Override
                    protected Map<String, String> resolveProcessorProperties(
                            String processorId, HttpServletRequest req) throws IOException {
                        throwConfiguredResolveException();
                        if (gatewayFailing.get()) throw new IOException("Connection refused");
                        return processorProperties.get();
                    }

                    @Override
                    protected ComponentConfigReader.ComponentConfig resolveComponentConfig(
                            String processorId, HttpServletRequest req) throws IOException {
                        throwConfiguredResolveException();
                        if (gatewayFailing.get()) throw new IOException("Connection refused");
                        return new ComponentConfigReader.ComponentConfig(
                                ComponentConfigReader.ComponentType.PROCESSOR,
                                "de.cuioss.nifi.processors.gateway.RestApiGatewayProcessor",
                                processorProperties.get());
                    }

                    @Override
                    protected GatewayGetResponse executeGatewayGet(String url, String accept) throws IOException {
                        if (gatewayFailing.get() || gatewayExecuteFailing.get()) {
                            throw new IOException("Connection refused");
                        }
                        return new GatewayGetResponse(gatewayGetStatusCode.get(), gatewayGetResponse.get());
                    }

                    @Override
                    protected GatewayResponse executeGatewayRequest(
                            String url, String method, Map<String, String> headers, String body)
                            throws IOException {
                        if (gatewayFailing.get() || gatewayExecuteFailing.get()) {
                            throw new IOException("Connection refused");
                        }
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
            }), "/gateway/*");
        });
    }

    /**
     * Throws the configured config-resolution exception, if any, to exercise the
     * servlet's fail-secure config-resolution error branches.
     */
    private static void throwConfiguredResolveException() {
        RuntimeException ex = configResolveException.get();
        if (ex != null) {
            throw ex;
        }
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
        gatewayExecuteFailing.set(false);
        configResolveException.set(null);
        processorProperties.set(createDefaultProperties());
        idpResponseBody.set("{\"access_token\":\"test-token\",\"expires_in\":300}");
        idpResponseStatus.set(200);
        csProperties.set(createDefaultCsProperties());
    }

    // -----------------------------------------------------------------------
    // JSON error contract & robustness
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("JSON error contract & robustness")
    class JsonErrorContractAndRobustness {

        @Test
        @DisplayName("Should return 503 JSON when NiFi configuration context is unavailable")
        void shouldReturn503WhenConfigContextUnavailable() throws Exception {
            // A servlet started without the nifi-web-configuration-context attribute has a
            // null configContext. Every gateway request must yield a uniform JSON 503 instead
            // of NPEing into a container 500 page on the first config lookup.
            try (var noContextHandle = EmbeddedServletTestSupport.startServer(ctx ->
                    ctx.addServlet(new ServletHolder(new GatewayProxyServlet()), "/gateway/*"))) {
                noContextHandle.spec()
                        .header("X-Processor-Id", PROCESSOR_ID)
                        .when()
                        .get("/gateway/config")
                        .then()
                        .statusCode(503)
                        .contentType(containsString("application/json"))
                        .body("error", containsString("NiFi configuration context unavailable"));
            }
        }

        @Test
        @DisplayName("Should return 503 JSON for a ClusterRequestException while resolving config")
        void shouldReturn503ForClusterRequestException() {
            configResolveException.set(new ClusterRequestException(
                    new RuntimeException("Cluster node unreachable")));

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(503)
                    .contentType(containsString("application/json"))
                    .body("error", containsString("Gateway configuration unavailable"));
        }

        @Test
        @DisplayName("Should return 503 JSON for an IllegalStateException while resolving config")
        void shouldReturn503ForIllegalStateException() {
            configResolveException.set(new IllegalStateException("Component state inconsistent"));

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/config")
                    .then()
                    .statusCode(503)
                    .contentType(containsString("application/json"))
                    .body("error", containsString("Gateway configuration unavailable"));
        }

        @Test
        @DisplayName("Should reject request body larger than 1 MB with 413 JSON")
        void oversizedBodyReturns413() {
            // 1 MB of padding pushes the total body over MAX_REQUEST_BODY_SIZE; the cap must
            // hold even without a trustworthy Content-Length header, and produce a JSON 413.
            String requestJson = """
                    {"path":"%s"}""".formatted("a".repeat(1024 * 1024));

            handle.spec()
                    .contentType("application/json")
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .body(requestJson)
                    .when()
                    .post("/gateway/test")
                    .then()
                    .statusCode(413)
                    .body("error", containsString("too large"));
        }
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
        @DisplayName("Should return 503 and drop stale cache when gateway fetch fails after port resolution")
        void shouldInvalidateCachesWhenMetricsFetchFails() {
            // Prime the port/protocol cache with a successful request
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/metrics")
                    .then()
                    .statusCode(200);

            // Port resolution succeeds but the gateway fetch itself fails —
            // exercises the invalidate-on-IOException path in doGet
            gatewayExecuteFailing.set(true);
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/metrics")
                    .then()
                    .statusCode(503)
                    .body("error", containsString("Gateway unavailable"));

            // Cache was invalidated — the next request re-resolves and succeeds
            gatewayExecuteFailing.set(false);
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/metrics")
                    .then()
                    .statusCode(200);
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
        @DisplayName("Should return 503 and drop stale cache when test call fails after port resolution")
        void shouldInvalidateCachesWhenTestCallFails() {
            // Port resolution succeeds but the proxied call itself fails —
            // exercises the invalidate-on-IOException path in handleTestRequest
            gatewayExecuteFailing.set(true);
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

            // Cache was invalidated — the next request re-resolves and succeeds
            gatewayExecuteFailing.set(false);
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"path":"/api/users","method":"GET","headers":{}}""")
                    .when()
                    .post("/gateway/test")
                    .then()
                    .statusCode(200);
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

        @Test
        @DisplayName("Should reject URI with null host")
        void shouldRejectNullHost() {
            assertFalse(GatewayProxyServlet.isLocalhostTarget(URI.create("/config")));
        }

        @Test
        @DisplayName("Should reject bracketed non-loopback IPv6")
        void shouldRejectBracketedNonLoopbackIpv6() {
            // startsWith('[') && endsWith(']') is true, but the normalized host is not a loopback.
            assertFalse(GatewayProxyServlet.isLocalhostTarget(URI.create("http://[fe80::1]:9443/x")));
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
            Map<String, String> externalProps = new HashMap<>(Map.of(
                    "restapi.data.path", "/api/data-ext",
                    "restapi.data.methods", "GET"));

            Map<String, String> nifiProps = new HashMap<>(Map.of(
                    "restapi.data.path", "/api/data",
                    "restapi.data.methods", "GET,POST"));

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
            Map<String, String> externalProps = new HashMap<>(Map.of(
                    "restapi.data.path", "/api/data-ext",
                    "restapi.data.methods", "GET",
                    "restapi.data.required-roles", "USER"));

            Map<String, String> nifiProps = new HashMap<>(Map.of(
                    "restapi.data.path", "/api/data",
                    "restapi.data.methods", "GET,POST"));

            var result = GatewayProxyServlet.buildMergedRoutesArray(externalProps, nifiProps).build();
            var dataRoute = result.getJsonObject(0);
            assertEquals("both", dataRoute.getString("source"));
            assertEquals("/api/data", dataRoute.getString("path"));
            // NiFi methods override
            var methods = dataRoute.getJsonArray("methods");
            assertEquals(2, methods.size());
        }
    }

    // -----------------------------------------------------------------------
    // cui-http security validation (URL / path / header)
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("cui-http security validation")
    class SecurityValidation {

        private static final String TRAVERSAL_PROCESSOR_ID = "../../../etc/passwd";

        @Test
        @DisplayName("Should reject malicious X-Processor-Id header on GET with 400")
        void shouldRejectMaliciousProcessorIdOnGet() {
            handle.spec()
                    .header("X-Processor-Id", TRAVERSAL_PROCESSOR_ID)
                    .when()
                    .get("/gateway/metrics")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Invalid header value"));
        }

        @Test
        @DisplayName("Should reject malicious X-Processor-Id header on /test with 400")
        void shouldRejectMaliciousProcessorIdOnTest() {
            handle.spec()
                    .header("X-Processor-Id", TRAVERSAL_PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"path":"/api/users","method":"GET","headers":{}}""")
                    .when()
                    .post("/gateway/test")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Invalid header value"));
        }

        @Test
        @DisplayName("Should reject malicious path in /test request with 400")
        void shouldRejectMaliciousPathInTestRequest() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"path":"/api/../../../etc/passwd","method":"GET","headers":{}}""")
                    .when()
                    .post("/gateway/test")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Invalid URL"));
        }

        @Test
        @DisplayName("Should reject malicious tokenEndpointUrl with 400")
        void shouldRejectMaliciousTokenEndpointUrl() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"tokenEndpointUrl":"https://keycloak:8443/realms/%2e%2e%2f%2e%2e/token",\
                            "grantType":"client_credentials","clientId":"c","clientSecret":"s"}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Invalid URL"));
        }

        @Test
        @DisplayName("Should reject malicious issuerUrl on discover with 400")
        void shouldRejectMaliciousIssuerUrl() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"issuerUrl":"https://keycloak:8443/realms/%2e%2e%2f%2e%2e/master"}""")
                    .when()
                    .post("/gateway/discover-token-endpoint")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Invalid URL"));
        }

        @Test
        @DisplayName("Should let a legitimate UUID processor ID pass header validation")
        void shouldAllowLegitimateProcessorId() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/gateway/metrics")
                    .then()
                    .statusCode(200);
        }

        @Test
        @DisplayName("Should let a legitimate path pass URL validation in /test")
        void shouldAllowLegitimatePathInTest() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"path":"/api/users","method":"GET","headers":{}}""")
                    .when()
                    .post("/gateway/test")
                    .then()
                    .statusCode(200)
                    .body("status", equalTo(200));
        }

        @Test
        @DisplayName("Should let a legitimate tokenEndpointUrl pass URL validation")
        void shouldAllowLegitimateTokenEndpointUrl() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body("""
                            {"tokenEndpointUrl":"https://keycloak:8443/realms/master/protocol/openid-connect/token",\
                            "grantType":"client_credentials","clientId":"c","clientSecret":"s","scope":"openid"}""")
                    .when()
                    .post("/gateway/token-fetch")
                    .then()
                    .statusCode(200)
                    .body("access_token", equalTo("test-token"));
        }
    }

    // -----------------------------------------------------------------------
    // Adversarial attack-database coverage (OWASP / Apache CVE / ModSecurity CRS)
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("Adversarial attack-database coverage")
    class AdversarialSecurityValidation {

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(OWASPTop10AttackDatabase.ArgumentsProvider.class)
        @DisplayName("Should reject OWASP Top 10 attack in /test path")
        void shouldRejectOwaspAttackInPath(AttackTestCase testCase) {
            assertAttackPathRejected(testCase);
        }

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(ApacheCVEAttackDatabase.ArgumentsProvider.class)
        @DisplayName("Should reject Apache CVE attack in /test path")
        void shouldRejectApacheCveAttackInPath(AttackTestCase testCase) {
            assertAttackPathRejected(testCase);
        }

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(ModSecurityCRSAttackDatabase.ArgumentsProvider.class)
        @DisplayName("Should reject ModSecurity CRS attack in /test path")
        void shouldRejectModSecurityAttackInPath(AttackTestCase testCase) {
            assertAttackPathRejected(testCase);
        }

        /**
         * Feeds an attack string as the {@code path} of a {@code /test} request (the
         * URL-path validated input) and asserts the servlet does not succeed (non-200).
         * The cui-http URL-path pipeline rejects the attack with HTTP 400; an attack
         * string that cannot be embedded in a JSON body / parsed as JSON is rejected at
         * the request-parse boundary (400), which also counts as a successful rejection.
         */
        private void assertAttackPathRejected(AttackTestCase testCase) {
            String body = Json.createObjectBuilder()
                    .add("path", testCase.attackString())
                    .add("method", "GET")
                    .add("headers", Json.createObjectBuilder())
                    .build()
                    .toString();

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .contentType("application/json")
                    .body(body)
                    .when()
                    .post("/gateway/test")
                    .then()
                    .statusCode(not(equalTo(200)));
        }
    }

    // -----------------------------------------------------------------------
    // Route array building (pure static helpers) — exercises buildMergedRoutesArray
    // and its private helpers (buildRouteObject, addSuccessOutcome, addNonBlankString,
    // addOptionalInt, buildStringArray, extractRouteNames, groupRouteProperties).
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("Merged routes array building")
    class MergedRoutesArray {

        private Map<String, JsonObject> routesByName(Map<String, String> external, Map<String, String> nifi) {
            JsonArray array = GatewayProxyServlet.buildMergedRoutesArray(external, nifi).build();
            Map<String, JsonObject> byName = new HashMap<>();
            for (JsonValue value : array) {
                JsonObject route = value.asJsonObject();
                byName.put(route.getString("name"), route);
            }
            return byName;
        }

        @Test
        @DisplayName("Should mark external-only route with source 'external' and honor all optional fields")
        void shouldBuildExternalOnlyRoute() {
            Map<String, String> external = new HashMap<>(Map.of(
                    "restapi.alpha.path", "/alpha",
                    // Empty items around commas must be dropped by buildStringArray.
                    "restapi.alpha.methods", "GET, ,POST,",
                    "restapi.alpha.required-roles", "admin",
                    "restapi.alpha.required-scopes", "read",
                    "restapi.alpha.schema", "mySchema",
                    "restapi.alpha.success-outcome", "done",
                    "restapi.alpha.max-request-size", "1024",
                    // Non-numeric optional int must be ignored (NumberFormatException path).
                    "restapi.alpha.attachments-min-count", "not-a-number",
                    // A key without a '.' after the prefix must be ignored by name extraction/grouping.
                    "restapi.nodotkey", "ignored"));

            JsonObject alpha = routesByName(external, Map.of()).get("alpha");

            assertNotNull(alpha);
            assertEquals("external", alpha.getString("source"));
            assertEquals("/alpha", alpha.getString("path"));
            assertEquals("mySchema", alpha.getString("schema"));
            assertEquals("done", alpha.getString("successOutcome"));
            assertEquals(1024, alpha.getInt("maxRequestSize"));
            assertFalse(alpha.containsKey("attachmentsMinCount"), "invalid int must not be added");
            assertEquals(2, alpha.getJsonArray("methods").size(), "blank method items dropped");
            assertTrue(alpha.getBoolean("enabled"));
        }

        @Test
        @DisplayName("Should mark nifi-only route 'nifi', drop blank fields, and skip success outcome when create-flowfile=false")
        void shouldBuildNifiOnlyRoute() {
            Map<String, String> nifi = new HashMap<>(Map.of(
                    "restapi.beta.path", "/beta",
                    "restapi.beta.enabled", "false",
                    "restapi.beta.schema", "   ",
                    "restapi.beta.success-outcome", "  ",
                    "restapi.beta.create-flowfile", "false",
                    // Blank (non-null) methods must produce an empty array (buildStringArray blank branch).
                    "restapi.beta.methods", "",
                    // Blank (non-null) optional int must be skipped (addOptionalInt blank branch).
                    "restapi.beta.attachments-max-count", "  "));

            JsonObject beta = routesByName(Map.of(), nifi).get("beta");

            assertNotNull(beta);
            assertEquals("nifi", beta.getString("source"));
            assertFalse(beta.getBoolean("enabled"));
            assertFalse(beta.getBoolean("createFlowFile"));
            assertFalse(beta.containsKey("schema"), "blank schema must not be added");
            assertFalse(beta.containsKey("successOutcome"),
                    "blank success-outcome with create-flowfile=false must not derive an outcome");
            assertFalse(beta.containsKey("attachmentsMaxCount"), "blank optional int must not be added");
            assertEquals(0, beta.getJsonArray("methods").size());
        }

        @Test
        @DisplayName("Should mark route in both sources 'both', let nifi override, and derive success outcome from route name")
        void shouldBuildBothSourceRoute() {
            Map<String, String> external = new HashMap<>();
            external.put("restapi.gamma.path", "/gamma-external");
            Map<String, String> nifi = new HashMap<>();
            nifi.put("restapi.gamma.path", "/gamma");

            JsonObject gamma = routesByName(external, nifi).get("gamma");

            assertNotNull(gamma);
            assertEquals("both", gamma.getString("source"));
            assertEquals("/gamma", gamma.getString("path"), "nifi props override external");
            // No explicit success-outcome + create-flowfile defaults to true => outcome is the route name.
            assertEquals("gamma", gamma.getString("successOutcome"));
        }

        @Test
        @DisplayName("Should skip routes with a blank path")
        void shouldSkipBlankPathRoute() {
            Map<String, String> external = new HashMap<>(Map.of(
                    "restapi.delta.path", "  ",
                    "restapi.delta.methods", "GET"));

            assertFalse(routesByName(external, Map.of()).containsKey("delta"));
        }
    }
}
