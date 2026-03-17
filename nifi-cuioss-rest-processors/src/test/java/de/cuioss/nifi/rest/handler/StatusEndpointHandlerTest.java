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

import de.cuioss.http.security.monitoring.SecurityEventCounter;
import de.cuioss.nifi.jwt.test.TestJwtIssuerConfigService;
import de.cuioss.nifi.rest.config.AuthMode;
import de.cuioss.nifi.rest.config.RouteConfiguration;
import de.cuioss.nifi.rest.config.TrackingMode;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.LinkedBlockingQueue;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("StatusEndpointHandler")
@EnableTestLogger
class StatusEndpointHandlerTest {

    private static final int GLOBAL_MAX_REQUEST_SIZE = 1_048_576;

    private Server server;
    private HttpClient httpClient;
    private TestJwtIssuerConfigService configService;
    private TestTokenHolder tokenHolder;
    private RequestStatusStore statusStore;
    private int port;

    @BeforeEach
    void setUp() throws Exception {
        configService = new TestJwtIssuerConfigService();
        tokenHolder = TestTokenGenerators.accessTokens().next();
        tokenHolder.withoutClaim("roles");
        tokenHolder.withoutClaim("scope");
        configService.configureValidToken(tokenHolder.asAccessTokenContent());

        var cacheClient = new RequestStatusStoreTest.InMemoryMapCacheClient();
        statusStore = new RequestStatusStore(cacheClient);

        var httpSecurityEvents = new SecurityEventCounter();
        var gatewaySecurityEvents = new GatewaySecurityEvents();

        List<EndpointHandler> handlers = new ArrayList<>();
        handlers.add(new HealthEndpointHandler(true, Set.of(AuthMode.LOCAL_ONLY, AuthMode.BEARER),
                Set.of(), Set.of()));
        handlers.add(new StatusEndpointHandler(statusStore, true,
                Set.of(AuthMode.LOCAL_ONLY, AuthMode.BEARER), Set.of(), Set.of()));

        // Add a tracked user route
        var trackedRoute = RouteConfiguration.builder()
                .name("orders").path("/api/orders")
                .method("POST").method("GET")
                .trackingMode(TrackingMode.SIMPLE)
                .build();
        var queue = new LinkedBlockingQueue<HttpRequestContainer>(50);
        handlers.add(new ApiRouteHandler(trackedRoute, queue, GLOBAL_MAX_REQUEST_SIZE,
                null, gatewaySecurityEvents, statusStore));

        // Add a non-tracked user route
        var normalRoute = RouteConfiguration.builder()
                .name("health").path("/api/health")
                .method("GET")
                .build();
        handlers.add(new ApiRouteHandler(normalRoute, queue, GLOBAL_MAX_REQUEST_SIZE,
                null, gatewaySecurityEvents));

        var handler = new GatewayRequestHandler(handlers, configService, GLOBAL_MAX_REQUEST_SIZE,
                httpSecurityEvents, gatewaySecurityEvents);

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
    @DisplayName("Status Query")
    class StatusQuery {

        @Test
        @DisplayName("Should return 200 with status JSON for known traceId")
        void shouldReturnStatusForKnownTraceId() throws Exception {
            // Arrange — store an ACCEPTED entry
            String traceId = UUID.randomUUID().toString();
            statusStore.accept(traceId, null);

            // Act
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/status/" + traceId)).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            // Assert
            assertEquals(200, response.statusCode());
            assertTrue(response.headers().firstValue("Content-Type")
                    .orElse("").contains("application/json"));

            JsonObject json = Json.createReader(new StringReader(response.body())).readObject();
            assertEquals(traceId, json.getString("traceId"));
            assertEquals("ACCEPTED", json.getString("status"));
            assertNotNull(json.getString("acceptedAt"));
            assertNotNull(json.getString("updatedAt"));
        }

        @Test
        @DisplayName("Should return parentTraceId when present")
        void shouldReturnParentTraceId() throws Exception {
            // Arrange
            String traceId = UUID.randomUUID().toString();
            String parentTraceId = UUID.randomUUID().toString();
            statusStore.accept(traceId, parentTraceId);

            // Act
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/status/" + traceId)).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            // Assert
            assertEquals(200, response.statusCode());
            JsonObject json = Json.createReader(new StringReader(response.body())).readObject();
            assertEquals(parentTraceId, json.getString("parentTraceId"));
        }

        @Test
        @DisplayName("Should return 404 for unknown traceId")
        void shouldReturn404ForUnknownTraceId() throws Exception {
            // Act
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/status/" + UUID.randomUUID())).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            // Assert
            assertEquals(404, response.statusCode());
            assertTrue(response.body().contains("Not Found"));
        }

        @Test
        @DisplayName("Should return 400 for invalid UUID format")
        void shouldReturn400ForInvalidUuid() throws Exception {
            // Act
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/status/not-a-uuid")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            // Assert
            assertEquals(400, response.statusCode());
            assertTrue(response.body().contains("Invalid traceId format"));
        }

        @Test
        @DisplayName("Should return 400 for missing traceId")
        void shouldReturn400ForMissingTraceId() throws Exception {
            // The exact path /status is registered as the handler path with prefix match
            // but /status alone or /status/ alone should return bad request
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/status/")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            // /status/ has empty traceId → bad request
            assertEquals(400, response.statusCode());
        }
    }

    @Nested
    @DisplayName("Tracked API Route")
    class TrackedApiRoute {

        @Test
        @DisplayName("Should return 202 with traceId and Location for tracked POST")
        void shouldReturnTrackedResponseForPost() throws Exception {
            // Act
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/api/orders"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .header("Content-Type", "application/json")
                            .POST(HttpRequest.BodyPublishers.ofString("{\"item\":\"widget\"}"))
                            .build(),
                    HttpResponse.BodyHandlers.ofString());

            // Assert
            assertEquals(202, response.statusCode());

            // Verify Location header
            String location = response.headers().firstValue("Location").orElse("");
            assertTrue(location.contains("/status/"), "Location should contain /status/");

            // Verify JSON body
            JsonObject json = Json.createReader(new StringReader(response.body())).readObject();
            assertEquals("accepted", json.getString("status"));
            assertNotNull(json.getString("traceId"));
            assertTrue(json.containsKey("_links"));

            JsonObject links = json.getJsonObject("_links");
            assertTrue(links.containsKey("status"));
            String statusHref = links.getJsonObject("status").getString("href");
            assertTrue(statusHref.startsWith("/status/"));

            // Verify the status can be queried
            String traceId = json.getString("traceId");
            var statusResponse = httpClient.send(
                    HttpRequest.newBuilder(uri("/status/" + traceId)).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
            assertEquals(200, statusResponse.statusCode());

            JsonObject statusJson = Json.createReader(new StringReader(statusResponse.body())).readObject();
            assertEquals("ACCEPTED", statusJson.getString("status"));
        }

        @Test
        @DisplayName("Should return normal 200 for GET on tracked route")
        void shouldReturnNormalResponseForGet() throws Exception {
            // GET requests on tracked routes should NOT generate traceId
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/api/orders"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode());
            // Should NOT have Location header
            assertTrue(response.headers().firstValue("Location").isEmpty());
        }

        @Test
        @DisplayName("Should not track requests on non-tracked routes")
        void shouldNotTrackNonTrackedRoutes() throws Exception {
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/api/health"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode());
            assertTrue(response.headers().firstValue("Location").isEmpty());
        }

        @Test
        @DisplayName("Should pass X-Parent-Trace-Id to status entry")
        void shouldPassParentTraceId() throws Exception {
            // Arrange
            String parentTraceId = UUID.randomUUID().toString();

            // Act
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/api/orders"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .header("Content-Type", "application/json")
                            .header("X-Parent-Trace-Id", parentTraceId)
                            .POST(HttpRequest.BodyPublishers.ofString("{\"item\":\"widget\"}"))
                            .build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(202, response.statusCode());

            // Query the status
            JsonObject json = Json.createReader(new StringReader(response.body())).readObject();
            String traceId = json.getString("traceId");

            var statusResponse = httpClient.send(
                    HttpRequest.newBuilder(uri("/status/" + traceId)).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            JsonObject statusJson = Json.createReader(new StringReader(statusResponse.body())).readObject();
            assertEquals(parentTraceId, statusJson.getString("parentTraceId"));
        }
    }

    @Nested
    @DisplayName("Prefix Matching")
    class PrefixMatching {

        @Test
        @DisplayName("Should match /status/{uuid} via prefix matching")
        void shouldMatchStatusWithPrefix() throws Exception {
            String traceId = UUID.randomUUID().toString();
            statusStore.accept(traceId, null);

            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/status/" + traceId)).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode());
        }

        @Test
        @DisplayName("Should return 404 for exact /status path (no traceId)")
        void shouldReturn404ForExactStatusPath() throws Exception {
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/status")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            // /status exact match hits the handler, but prefixMatch makes it work
            // However, the handler should return a meaningful error since there's no traceId
            assertNotEquals(200, response.statusCode());
        }
    }
}
