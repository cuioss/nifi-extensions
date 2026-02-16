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

import de.cuioss.nifi.jwt.test.TestJwtIssuerConfigService;
import de.cuioss.nifi.rest.config.RouteConfiguration;
import de.cuioss.sheriff.oauth.core.test.TestTokenHolder;
import de.cuioss.sheriff.oauth.core.test.generator.TestTokenGenerators;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;
import org.junit.jupiter.api.*;

import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Set;
import java.util.concurrent.LinkedBlockingQueue;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for the management endpoints ({@code /metrics} and {@code /config})
 * served by {@link ManagementEndpointHandler} via {@link GatewayRequestHandler}.
 */
@DisplayName("ManagementEndpointHandler")
@EnableTestLogger
class ManagementEndpointHandlerTest {

    private Server server;
    private HttpClient httpClient;
    private GatewayRequestHandler handler;
    private int port;

    @BeforeEach
    void setUp() throws Exception {
        LinkedBlockingQueue<HttpRequestContainer> queue = new LinkedBlockingQueue<>(50);
        TestJwtIssuerConfigService mockConfigService = new TestJwtIssuerConfigService();
        TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
        tokenHolder.withoutClaim("roles");
        tokenHolder.withoutClaim("scope");
        mockConfigService.configureValidToken(tokenHolder.asAccessTokenContent());

        List<RouteConfiguration> routes = List.of(
                new RouteConfiguration("health", "/api/health", Set.of("GET"), Set.of(), Set.of(), null),
                new RouteConfiguration("users", "/api/users", Set.of("GET", "POST"), Set.of("ADMIN"), Set.of(), null));

        handler = new GatewayRequestHandler(routes, mockConfigService, queue, 1_048_576);
        handler.configureManagementEndpoints(9443, 50, false);

        server = new Server();
        ServerConnector connector = new ServerConnector(server);
        connector.setPort(0);
        server.addConnector(connector);
        server.setHandler(handler);
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

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }

    @Nested
    @DisplayName("/metrics endpoint")
    class MetricsEndpoint {

        @Test
        @DisplayName("Should return Prometheus metrics at /metrics")
        void shouldReturnPrometheusMetrics() throws Exception {
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/metrics")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode());
            assertTrue(response.headers().firstValue("Content-Type")
                    .orElse("").contains("text/plain"));
            String body = response.body();
            assertTrue(body.contains("# HELP nifi_jwt_validations_total"));
            assertTrue(body.contains("# TYPE nifi_jwt_validations_total counter"));
            assertTrue(body.contains("# HELP nifi_gateway_http_security_events_total"));
            assertTrue(body.contains("# HELP nifi_gateway_events_total"));
        }

        @Test
        @DisplayName("Should return JSON metrics when Accept: application/json")
        void shouldReturnJsonMetricsWhenAcceptJson() throws Exception {
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/metrics"))
                            .header("Accept", "application/json")
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode());
            assertTrue(response.headers().firstValue("Content-Type")
                    .orElse("").contains("application/json"));

            JsonObject json = Json.createReader(new StringReader(response.body())).readObject();
            assertTrue(json.containsKey("tokenValidation"));
            assertTrue(json.containsKey("httpSecurity"));
            assertTrue(json.containsKey("gatewayEvents"));
        }

        @Test
        @DisplayName("Should bypass auth for /metrics — no Bearer token required")
        void shouldBypassAuthForMetrics() throws Exception {
            // No Authorization header
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/metrics")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode());
        }

        @Test
        @DisplayName("Should include all three counter sources")
        void shouldIncludeAllThreeCounterSources() throws Exception {
            // Increment some gateway events to ensure they appear
            handler.getGatewaySecurityEvents().increment(GatewaySecurityEvents.EventType.ROUTE_NOT_FOUND);
            handler.getGatewaySecurityEvents().increment(GatewaySecurityEvents.EventType.AUTH_FAILED);

            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/metrics")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode());
            String body = response.body();
            assertTrue(body.contains("nifi_jwt_validations_total"));
            assertTrue(body.contains("nifi_gateway_http_security_events_total"));
            assertTrue(body.contains("nifi_gateway_events_total"));
            assertTrue(body.contains("ROUTE_NOT_FOUND"));
            assertTrue(body.contains("AUTH_FAILED"));
        }

        @Test
        @DisplayName("Should return 405 for POST /metrics")
        void shouldReturn405ForPost() throws Exception {
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/metrics"))
                            .POST(HttpRequest.BodyPublishers.noBody())
                            .build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(405, response.statusCode());
            assertTrue(response.headers().firstValue("Allow").orElse("").contains("GET"));
        }
    }

    @Nested
    @DisplayName("/config endpoint")
    class ConfigEndpoint {

        @Test
        @DisplayName("Should return gateway config as JSON")
        void shouldReturnConfigAsJson() throws Exception {
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/config")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode());
            assertTrue(response.headers().firstValue("Content-Type")
                    .orElse("").contains("application/json"));

            JsonObject json = Json.createReader(new StringReader(response.body())).readObject();
            assertEquals("RestApiGatewayProcessor", json.getString("component"));
            assertEquals(9443, json.getInt("port"));
            assertEquals(1048576, json.getInt("maxRequestBodySize"));
            assertEquals(50, json.getInt("queueSize"));
            assertFalse(json.getBoolean("ssl"));
            assertFalse(json.getJsonArray("routes").isEmpty());
        }

        @Test
        @DisplayName("Should include route details in config")
        void shouldIncludeRouteDetails() throws Exception {
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/config")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            JsonObject json = Json.createReader(new StringReader(response.body())).readObject();
            var routes = json.getJsonArray("routes");
            assertEquals(2, routes.size());

            JsonObject healthRoute = routes.getJsonObject(0);
            assertEquals("health", healthRoute.getString("name"));
            assertEquals("/api/health", healthRoute.getString("path"));

            JsonObject usersRoute = routes.getJsonObject(1);
            assertEquals("users", usersRoute.getString("name"));
            assertEquals("/api/users", usersRoute.getString("path"));
            assertFalse(usersRoute.getJsonArray("requiredRoles").isEmpty());
        }

        @Test
        @DisplayName("Should bypass auth for /config — no Bearer token required")
        void shouldBypassAuthForConfig() throws Exception {
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/config")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode());
        }
    }

    @Nested
    @DisplayName("Path isolation")
    class PathIsolation {

        @Test
        @DisplayName("Should not match /metrics as a route")
        void shouldNotMatchMetricsAsRoute() throws Exception {
            // /metrics is a management endpoint, not a route — should return 200 from management
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/metrics")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            // Should get management response, not a 404 route-not-found
            assertEquals(200, response.statusCode());
            assertTrue(response.body().contains("nifi_"));
        }

        @Test
        @DisplayName("Should not match /config as a route")
        void shouldNotMatchConfigAsRoute() throws Exception {
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/config")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode());
            assertTrue(response.body().contains("RestApiGatewayProcessor"));
        }

        @Test
        @DisplayName("Regular routes still work alongside management endpoints")
        void regularRoutesStillWork() throws Exception {
            TestJwtIssuerConfigService configService = new TestJwtIssuerConfigService();
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withoutClaim("roles");
            tokenHolder.withoutClaim("scope");
            configService.configureValidToken(tokenHolder.asAccessTokenContent());

            // Verify that /api/health still works with auth
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/api/health"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode());
        }
    }
}
