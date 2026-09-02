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
import de.cuioss.nifi.jwt.util.ForwardedRequestResolver;
import de.cuioss.nifi.rest.config.AuthMode;
import de.cuioss.nifi.rest.config.RouteConfiguration;
import de.cuioss.nifi.rest.config.TrackingMode;
import de.cuioss.sheriff.token.validation.test.TestTokenHolder;
import de.cuioss.sheriff.token.validation.test.generator.TestTokenGenerators;
import de.cuioss.test.juli.LogAsserts;
import de.cuioss.test.juli.TestLogLevel;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import jakarta.json.JsonValue;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

        List<EndpointHandler> handlers = new ArrayList<>(List.of(
                new HealthEndpointHandler(true, Set.of(AuthMode.LOCAL_ONLY, AuthMode.BEARER),
                        Set.of(), Set.of()),
                new StatusEndpointHandler(statusStore, true,
                        Set.of(AuthMode.LOCAL_ONLY, AuthMode.BEARER), Set.of(), Set.of(), 20)));

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
                httpSecurityEvents, gatewaySecurityEvents,
                ForwardedRequestResolver.secureDefault(), false);

        server = new Server();
        ServerConnector connector = new ServerConnector(server);
        connector.setPort(0);
        server.addConnector(connector);
        server.setHandler(handler);
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

    private URI uri(String path) {
        return URI.create("http://127.0.0.1:" + port + path);
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

            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/status/" + traceId)).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

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
            String traceId = UUID.randomUUID().toString();
            String parentTraceId = UUID.randomUUID().toString();
            statusStore.accept(traceId, parentTraceId);

            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/status/" + traceId)).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode());
            JsonObject json = Json.createReader(new StringReader(response.body())).readObject();
            assertEquals(parentTraceId, json.getString("parentTraceId"));
        }

        @Test
        @DisplayName("Should return 404 for unknown traceId")
        void shouldReturn404ForUnknownTraceId() throws Exception {
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/status/" + UUID.randomUUID())).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(404, response.statusCode());
            assertTrue(response.body().contains("Not Found"));
        }

        @Test
        @DisplayName("Should return 400 for invalid UUID format")
        void shouldReturn400ForInvalidUuid() throws Exception {
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/status/not-a-uuid")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());

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
            var response = httpClient.send(
                    HttpRequest.newBuilder(uri("/api/orders"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .header("Content-Type", "application/json")
                            .POST(HttpRequest.BodyPublishers.ofString("{\"item\":\"widget\"}"))
                            .build(),
                    HttpResponse.BodyHandlers.ofString());

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
            String parentTraceId = UUID.randomUUID().toString();

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

    @Nested
    @DisplayName("Additional Fields")
    class AdditionalFields {

        /**
         * Starts a dedicated single-handler server exposing {@code /status} over a store seeded with
         * the given entry, using the supplied additional-fields bound. Returns the started server; the
         * caller is responsible for stopping it.
         */
        private Server startStatusServer(RequestStatusStore store, int maxAdditionalFields) throws Exception {
            var httpSecurityEvents = new SecurityEventCounter();
            var gatewaySecurityEvents = new GatewaySecurityEvents();
            List<EndpointHandler> handlers = new ArrayList<>(List.of(
                    new StatusEndpointHandler(store, true,
                            Set.of(AuthMode.LOCAL_ONLY, AuthMode.BEARER), Set.of(), Set.of(), maxAdditionalFields)));
            var handler = new GatewayRequestHandler(handlers, configService, GLOBAL_MAX_REQUEST_SIZE,
                    httpSecurityEvents, gatewaySecurityEvents,
                    ForwardedRequestResolver.secureDefault(), false);
            var srv = new Server();
            ServerConnector connector = new ServerConnector(srv);
            connector.setPort(0);
            srv.addConnector(connector);
            srv.setHandler(handler);
            srv.start();
            return srv;
        }

        private RequestStatusStore storeWith(String traceId, Map<String, String> additionalFields) throws Exception {
            var cache = new RequestStatusStoreTest.InMemoryMapCacheClient();
            var entry = new RequestStatusEntry(traceId, RequestStatus.ACCEPTED,
                    Instant.now(), Instant.now(), null, null,
                    null, null, null, null, null, 0, 0, null, additionalFields);
            cache.put(traceId, entry,
                    RequestStatusStore.STRING_SERIALIZER, RequestStatusStore.ENTRY_SERIALIZER);
            return new RequestStatusStore(cache);
        }

        private JsonObject query(Server srv, String traceId) throws Exception {
            int localPort = ((ServerConnector) srv.getConnectors()[0]).getLocalPort();
            var response = httpClient.send(
                    HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + localPort + "/status/" + traceId))
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());
            assertEquals(200, response.statusCode());
            return Json.createReader(new StringReader(response.body())).readObject();
        }

        @Test
        @DisplayName("Should surface additional fields in the response in encounter order")
        void shouldSurfaceAdditionalFieldsInEncounterOrder() throws Exception {
            String traceId = UUID.randomUUID().toString();
            Map<String, String> extras = new LinkedHashMap<>();
            extras.put("tenant", "acme");
            extras.put("channel", "web");
            extras.put("priority", "5");
            var store = storeWith(traceId, extras);
            Server srv = startStatusServer(store, 20);
            try {
                JsonObject json = query(srv, traceId);

                assertEquals("acme", json.getString("tenant"));
                assertEquals("web", json.getString("channel"));
                assertEquals("5", json.getString("priority"));
                List<String> additionalOrder = json.keySet().stream()
                        .filter(extras::containsKey).toList();
                assertEquals(List.of("tenant", "channel", "priority"), additionalOrder);
            } finally {
                srv.stop();
            }
        }

        @Test
        @DisplayName("Should truncate to the first N additional fields when over the configured max")
        void shouldTruncateToFirstN() throws Exception {
            String traceId = UUID.randomUUID().toString();
            Map<String, String> extras = new LinkedHashMap<>();
            extras.put("a", "1");
            extras.put("b", "2");
            extras.put("c", "3");
            var store = storeWith(traceId, extras);
            Server srv = startStatusServer(store, 2);
            try {
                JsonObject json = query(srv, traceId);

                assertEquals("1", json.getString("a"));
                assertEquals("2", json.getString("b"));
                assertFalse(json.containsKey("c"), "third field must be truncated when max is 2");
            } finally {
                srv.stop();
            }
        }

        @Test
        @DisplayName("Should surface all fields under the default max of 20")
        void shouldSurfaceUnderDefaultMax() throws Exception {
            String traceId = UUID.randomUUID().toString();
            Map<String, String> extras = new LinkedHashMap<>();
            for (int i = 0; i < 20; i++) {
                extras.put("f" + i, String.valueOf(i));
            }
            var store = storeWith(traceId, extras);
            Server srv = startStatusServer(store, 20);
            try {
                JsonObject json = query(srv, traceId);

                for (int i = 0; i < 20; i++) {
                    assertEquals(String.valueOf(i), json.getString("f" + i));
                }
            } finally {
                srv.stop();
            }
        }

        @Test
        @DisplayName("Should not double-emit a reserved response key present in additional fields")
        void shouldNotDoubleEmitReservedKey() throws Exception {
            String traceId = UUID.randomUUID().toString();
            Map<String, String> extras = new LinkedHashMap<>();
            extras.put("status", "SPOOFED");
            extras.put("ok", "yes");
            var store = storeWith(traceId, extras);
            Server srv = startStatusServer(store, 20);
            try {
                JsonObject json = query(srv, traceId);

                // The reserved typed status wins; the shadow additional-field value is never emitted.
                assertEquals("ACCEPTED", json.getString("status"));
                assertEquals("yes", json.getString("ok"));
            } finally {
                srv.stop();
            }
        }
    }

    @Nested
    @DisplayName("RFC 9457 Error Object")
    class Rfc9457ErrorObject {

        private static final String VIOLATIONS_JSON =
                "[{\"pointer\":\"/items/0/id\",\"detail\":\"must not be blank\"},"
                        + "{\"pointer\":\"/customer/email\",\"detail\":\"must be a well-formed address\"}]";

        /**
         * Seeds a dedicated cache + server with the given entry, queries {@code /status/{traceId}} and
         * returns the parsed response body. The per-test server is stopped before returning.
         */
        @SuppressWarnings("java:S2093") // Server is not AutoCloseable, so try-with-resources does not compile
        private JsonObject responseFor(RequestStatusEntry entry) throws Exception {
            var cache = new RequestStatusStoreTest.InMemoryMapCacheClient();
            cache.put(entry.traceId(), entry,
                    RequestStatusStore.STRING_SERIALIZER, RequestStatusStore.ENTRY_SERIALIZER);
            var store = new RequestStatusStore(cache);

            var httpSecurityEvents = new SecurityEventCounter();
            var gatewaySecurityEvents = new GatewaySecurityEvents();
            List<EndpointHandler> handlers = new ArrayList<>(List.of(
                    new StatusEndpointHandler(store, true,
                            Set.of(AuthMode.LOCAL_ONLY, AuthMode.BEARER), Set.of(), Set.of(), 20)));
            var handler = new GatewayRequestHandler(handlers, configService, GLOBAL_MAX_REQUEST_SIZE,
                    httpSecurityEvents, gatewaySecurityEvents,
                    ForwardedRequestResolver.secureDefault(), false);
            var srv = new Server();
            ServerConnector connector = new ServerConnector(srv);
            connector.setPort(0);
            srv.addConnector(connector);
            srv.setHandler(handler);
            srv.start();
            try {
                int localPort = connector.getLocalPort();
                var response = httpClient.send(
                        HttpRequest.newBuilder(
                                URI.create("http://127.0.0.1:" + localPort + "/status/" + entry.traceId()))
                                .GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                assertEquals(200, response.statusCode());
                return Json.createReader(new StringReader(response.body())).readObject();
            } finally {
                srv.stop();
            }
        }

        private RequestStatusEntry entry(RequestStatus status, String errorDetail, String errorType,
                String errorStatus, String errorTitle, String errorInstance, String errorViolations) {
            return new RequestStatusEntry(UUID.randomUUID().toString(), status,
                    Instant.now(), Instant.now(), null, errorDetail,
                    errorType, errorStatus, errorTitle, errorInstance, errorViolations,
                    0, 0, null, Map.of());
        }

        @Test
        @DisplayName("Should emit the full six-member error object with a typed violations array")
        void shouldEmitFullErrorObject() throws Exception {
            var seeded = entry(RequestStatus.REJECTED, "One or more fields are invalid",
                    "https://example.com/problems/validation", "422", "Validation Failed",
                    "/status/abc", VIOLATIONS_JSON);

            JsonObject json = responseFor(seeded);

            JsonObject error = json.getJsonObject("error");
            assertNotNull(error);
            assertEquals("https://example.com/problems/validation", error.getString("type"));
            assertEquals("Validation Failed", error.getString("title"));
            assertEquals("One or more fields are invalid", error.getString("detail"));
            assertEquals("/status/abc", error.getString("instance"));
            assertEquals(JsonValue.ValueType.NUMBER, error.get("status").getValueType(),
                    "error.status must be a JSON number, not a string scalar");
            assertEquals(422, error.getJsonNumber("status").intValue());
            assertEquals(JsonValue.ValueType.ARRAY, error.get("violations").getValueType(),
                    "error.violations must be a JSON array, not a string scalar");
            JsonArray violations = error.getJsonArray("violations");
            assertEquals(2, violations.size());
            assertEquals("/items/0/id", violations.getJsonObject(0).getString("pointer"));
            assertEquals("must not be blank", violations.getJsonObject(0).getString("detail"));
            assertEquals("/customer/email", violations.getJsonObject(1).getString("pointer"));
        }

        @Test
        @DisplayName("Should still yield error.detail alone for an errorDetail-only entry")
        void shouldYieldDetailOnlyForDetailOnlyEntry() throws Exception {
            var seeded = entry(RequestStatus.REJECTED, "Validation failed",
                    null, null, null, null, null);

            JsonObject json = responseFor(seeded);

            JsonObject error = json.getJsonObject("error");
            assertEquals(Set.of("detail"), error.keySet());
            assertEquals("Validation failed", error.getString("detail"));
        }

        @ParameterizedTest
        @EnumSource(RequestStatus.class)
        @DisplayName("Should emit the error object independent of the entry status")
        void shouldEmitErrorObjectIndependentOfStatus(RequestStatus status) throws Exception {
            var seeded = entry(status, "One attachment exceeded the inline size budget",
                    null, null, "Attachment Merge Warning", null, null);

            JsonObject json = responseFor(seeded);

            JsonObject error = json.getJsonObject("error");
            assertNotNull(error, "error must be emitted for status " + status);
            assertEquals("Attachment Merge Warning", error.getString("title"));
            assertEquals("One attachment exceeded the inline size budget", error.getString("detail"));
        }

        @Test
        @DisplayName("Should omit the error key entirely when no error component is populated")
        void shouldOmitErrorKeyWhenNoComponentPopulated() throws Exception {
            var seeded = entry(RequestStatus.ERROR, null, null, null, null, null, null);

            JsonObject json = responseFor(seeded);

            assertFalse(json.containsKey("error"));
        }

        @Test
        @DisplayName("Should treat blank error components as absent")
        void shouldTreatBlankComponentsAsAbsent() throws Exception {
            var seeded = entry(RequestStatus.ERROR, "  ", "", "   ", "", " ", "");

            JsonObject json = responseFor(seeded);

            assertFalse(json.containsKey("error"));
        }

        @Test
        @DisplayName("Should omit error.status and warn REST-125 for a malformed errorStatus")
        void shouldOmitStatusAndWarnForMalformedErrorStatus() throws Exception {
            var seeded = entry(RequestStatus.ERROR, "Boom",
                    null, "not-a-number", null, null, null);

            JsonObject json = responseFor(seeded);

            JsonObject error = json.getJsonObject("error");
            assertNotNull(error);
            assertFalse(error.containsKey("status"), "a malformed errorStatus must omit error.status");
            assertEquals("Boom", error.getString("detail"));
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "REST-125");
        }

        @ParameterizedTest
        @ValueSource(strings = {"0", "99", "600", "-1", "1000"})
        @DisplayName("Should omit error.status and warn REST-125 for an out-of-range errorStatus")
        void shouldOmitStatusAndWarnForOutOfRangeErrorStatus(String rawStatus) throws Exception {
            var seeded = entry(RequestStatus.ERROR, "Boom",
                    null, rawStatus, null, null, null);

            JsonObject json = responseFor(seeded);

            JsonObject error = json.getJsonObject("error");
            assertNotNull(error);
            assertFalse(error.containsKey("status"),
                    "an errorStatus outside the RFC 9457 100-599 range must omit error.status");
            assertEquals("Boom", error.getString("detail"));
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "REST-125");
        }

        @ParameterizedTest
        @ValueSource(strings = {"100", "422", "599"})
        @DisplayName("Should emit error.status for an in-range errorStatus")
        void shouldEmitStatusForInRangeErrorStatus(String rawStatus) throws Exception {
            var seeded = entry(RequestStatus.ERROR, "Boom",
                    null, rawStatus, null, null, null);

            JsonObject json = responseFor(seeded);

            JsonObject error = json.getJsonObject("error");
            assertNotNull(error);
            assertEquals(Integer.parseInt(rawStatus), error.getInt("status"),
                    "an errorStatus inside the RFC 9457 100-599 range must be emitted as a JSON integer");
        }

        @ParameterizedTest
        @ValueSource(strings = {"{not json", "{\"pointer\":\"/id\"}", "[unclosed"})
        @DisplayName("Should omit error.violations and warn REST-126 for a malformed errorViolations")
        void shouldOmitViolationsAndWarnForMalformedErrorViolations(String rawViolations) throws Exception {
            var seeded = entry(RequestStatus.ERROR, "Boom",
                    null, null, null, null, rawViolations);

            JsonObject json = responseFor(seeded);

            JsonObject error = json.getJsonObject("error");
            assertNotNull(error);
            assertFalse(error.containsKey("violations"),
                    "a malformed errorViolations must omit error.violations");
            assertEquals("Boom", error.getString("detail"));
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "REST-126");
        }
    }
}
