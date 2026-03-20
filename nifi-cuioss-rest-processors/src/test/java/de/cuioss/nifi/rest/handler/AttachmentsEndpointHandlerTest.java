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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.*;
import java.util.concurrent.LinkedBlockingQueue;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("AttachmentsEndpointHandler")
@EnableTestLogger
class AttachmentsEndpointHandlerTest {

    private static final int GLOBAL_MAX_REQUEST_SIZE = 1_048_576;

    private Server server;
    private HttpClient httpClient;
    private TestJwtIssuerConfigService configService;
    private TestTokenHolder tokenHolder;
    private RequestStatusStore statusStore;
    private LinkedBlockingQueue<HttpRequestContainer> queue;
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

        queue = new LinkedBlockingQueue<>(50);
        List<EndpointHandler> handlers = new ArrayList<>();

        // Add an ATTACHMENTS-mode route for creating parent tracked entries
        var attachmentsRoute = RouteConfiguration.builder()
                .name("upload").path("/api/upload")
                .method("POST")
                .trackingMode(TrackingMode.ATTACHMENTS)
                .attachmentsMinCount(1).attachmentsMaxCount(3)
                .authModes(Set.of(AuthMode.LOCAL_ONLY, AuthMode.BEARER))
                .build();
        handlers.add(new ApiRouteHandler(attachmentsRoute, queue, GLOBAL_MAX_REQUEST_SIZE,
                null, gatewaySecurityEvents, statusStore));

        // Add a SIMPLE-mode route for testing 409
        var simpleRoute = RouteConfiguration.builder()
                .name("data").path("/api/data")
                .method("POST")
                .trackingMode(TrackingMode.SIMPLE)
                .authModes(Set.of(AuthMode.LOCAL_ONLY, AuthMode.BEARER))
                .build();
        handlers.add(new ApiRouteHandler(simpleRoute, queue, GLOBAL_MAX_REQUEST_SIZE,
                null, gatewaySecurityEvents, statusStore));

        // Attachments endpoint
        handlers.add(new AttachmentsEndpointHandler(statusStore, queue, 0,
                true, Set.of(AuthMode.LOCAL_ONLY, AuthMode.BEARER),
                Set.of(), Set.of(), gatewaySecurityEvents));

        // Status endpoint (for verifying parentTraceId)
        handlers.add(new StatusEndpointHandler(statusStore, true,
                Set.of(AuthMode.LOCAL_ONLY, AuthMode.BEARER), Set.of(), Set.of()));

        var handler = new GatewayRequestHandler(handlers, configService, GLOBAL_MAX_REQUEST_SIZE,
                httpSecurityEvents, gatewaySecurityEvents);

        server = new Server();
        var connector = new ServerConnector(server);
        connector.setPort(0);
        server.addConnector(connector);
        server.setHandler(handler);
        server.start();
        port = connector.getLocalPort();

        httpClient = HttpClient.newHttpClient();
    }

    @AfterEach
    void tearDown() throws Exception {
        if (server != null) {
            server.stop();
        }
    }

    private String createParentEntry(String routePath) throws Exception {
        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:%d%s".formatted(port, routePath)))
                        .POST(HttpRequest.BodyPublishers.ofString("{\"test\":true}"))
                        .header("Content-Type", "application/json")
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertEquals(202, response.statusCode());
        JsonObject json;
        try (var reader = Json.createReader(new StringReader(response.body()))) {
            json = reader.readObject();
        }
        return json.getString("traceId");
    }

    @Test
    @DisplayName("Should return 202 for valid attachment upload")
    void shouldReturn202ForValidAttachment() throws Exception {
        String parentTraceId = createParentEntry("/api/upload");

        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:%d/attachments/%s".formatted(port, parentTraceId)))
                        .POST(HttpRequest.BodyPublishers.ofString("attachment data"))
                        .header("Content-Type", "application/octet-stream")
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertEquals(202, response.statusCode());
        JsonObject json;
        try (var reader = Json.createReader(new StringReader(response.body()))) {
            json = reader.readObject();
        }
        assertEquals("accepted", json.getString("status"));
        assertNotNull(json.getString("traceId"));
        assertTrue(json.containsKey("_links"));
        assertNotNull(response.headers().firstValue("Location").orElse(null));
    }

    @Test
    @DisplayName("Should return 404 for unknown parent traceId")
    void shouldReturn404ForUnknownParent() throws Exception {
        String unknownTraceId = UUID.randomUUID().toString();

        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:%d/attachments/%s".formatted(port, unknownTraceId)))
                        .POST(HttpRequest.BodyPublishers.ofString("data"))
                        .header("Content-Type", "application/octet-stream")
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertEquals(404, response.statusCode());
    }

    @Test
    @DisplayName("Should return 400 for invalid UUID format")
    void shouldReturn400ForInvalidUuid() throws Exception {
        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:%d/attachments/not-a-uuid".formatted(port)))
                        .POST(HttpRequest.BodyPublishers.ofString("data"))
                        .header("Content-Type", "application/octet-stream")
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertEquals(400, response.statusCode());
    }

    @Test
    @DisplayName("Should return 400 for missing parentTraceId")
    void shouldReturn400ForMissingParentTraceId() throws Exception {
        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:%d/attachments/".formatted(port)))
                        .POST(HttpRequest.BodyPublishers.ofString("data"))
                        .header("Content-Type", "application/octet-stream")
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        // Either 400 (missing traceId) or 404 (no route matched)
        assertTrue(response.statusCode() == 400 || response.statusCode() == 404);
    }

    @Test
    @DisplayName("Should return 405 for GET request")
    void shouldReturn405ForGet() throws Exception {
        String parentTraceId = createParentEntry("/api/upload");

        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:%d/attachments/%s".formatted(port, parentTraceId)))
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertEquals(405, response.statusCode());
    }

    @Test
    @DisplayName("Should return 409 when parent does not accept attachments (SIMPLE mode)")
    void shouldReturn409ForSimpleParent() throws Exception {
        String parentTraceId = createParentEntry("/api/data");

        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:%d/attachments/%s".formatted(port, parentTraceId)))
                        .POST(HttpRequest.BodyPublishers.ofString("data"))
                        .header("Content-Type", "application/octet-stream")
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertEquals(409, response.statusCode());
    }

    @Test
    @DisplayName("Should return 409 when attachment limit is reached")
    void shouldReturn409WhenLimitReached() throws Exception {
        String parentTraceId = createParentEntry("/api/upload");
        // Route has max=3, so 3 should succeed and 4th should fail

        for (int i = 0; i < 3; i++) {
            var response = httpClient.send(
                    HttpRequest.newBuilder()
                            .uri(URI.create("http://localhost:%d/attachments/%s".formatted(port, parentTraceId)))
                            .POST(HttpRequest.BodyPublishers.ofString("attachment " + i))
                            .header("Content-Type", "application/octet-stream")
                            .build(),
                    HttpResponse.BodyHandlers.ofString());
            assertEquals(202, response.statusCode(), "Attachment %d should succeed".formatted(i + 1));
        }

        // 4th should fail
        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:%d/attachments/%s".formatted(port, parentTraceId)))
                        .POST(HttpRequest.BodyPublishers.ofString("attachment 4"))
                        .header("Content-Type", "application/octet-stream")
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertEquals(409, response.statusCode());
    }

    @Test
    @DisplayName("Should enqueue FlowFile with correct route name")
    void shouldEnqueueFlowFileWithCorrectRouteName() throws Exception {
        String parentTraceId = createParentEntry("/api/upload");
        // Drain the parent entry from the queue
        queue.poll();

        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:%d/attachments/%s".formatted(port, parentTraceId)))
                        .POST(HttpRequest.BodyPublishers.ofString("attachment data"))
                        .header("Content-Type", "application/octet-stream")
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertEquals(202, response.statusCode());

        // Check the enqueued container
        HttpRequestContainer container = queue.poll();
        assertNotNull(container);
        assertEquals(AttachmentsEndpointHandler.ATTACHMENTS_ROUTE_NAME, container.routeName());
        assertEquals(parentTraceId, container.parentTraceId());
        assertNotNull(container.traceId());
    }

    @Test
    @DisplayName("Should return 503 when queue is full")
    void shouldReturn503WhenQueueFull() throws Exception {
        String parentTraceId = createParentEntry("/api/upload");

        // Fill the queue
        while (queue.remainingCapacity() > 0) {
            queue.offer(new HttpRequestContainer("test", "POST", "/test",
                    Map.of(), Map.of(), "127.0.0.1",
                    new byte[0], null, null, null, null));
        }

        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:%d/attachments/%s".formatted(port, parentTraceId)))
                        .POST(HttpRequest.BodyPublishers.ofString("data"))
                        .header("Content-Type", "application/octet-stream")
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertEquals(503, response.statusCode());
    }

    @Test
    @DisplayName("Should return 409 when attachment window is closed (status != COLLECTING_ATTACHMENTS)")
    void shouldReturn409WhenAttachmentWindowClosed() throws Exception {
        String parentTraceId = createParentEntry("/api/upload");

        // Manually update the parent status to PROCESSING (simulating Wait processor releasing)
        statusStore.updateStatus(parentTraceId, RequestStatus.PROCESSING);

        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:%d/attachments/%s".formatted(port, parentTraceId)))
                        .POST(HttpRequest.BodyPublishers.ofString("attachment data"))
                        .header("Content-Type", "application/octet-stream")
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertEquals(409, response.statusCode());
        assertTrue(response.body().contains("Attachment window closed"));
    }

    @Test
    @DisplayName("Should transition parent to PROCESSED when min count is met")
    void shouldTransitionToProcessedWhenMinCountMet() throws Exception {
        // Route has attachmentsMinCount=1, so first attachment should trigger PROCESSED
        String parentTraceId = createParentEntry("/api/upload");

        // Verify initial status is COLLECTING_ATTACHMENTS
        var parentStatus = statusStore.getStatus(parentTraceId);
        assertTrue(parentStatus.isPresent());
        assertEquals(RequestStatus.COLLECTING_ATTACHMENTS, parentStatus.get().status());

        // Submit one attachment (meets min count of 1)
        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:%d/attachments/%s".formatted(port, parentTraceId)))
                        .POST(HttpRequest.BodyPublishers.ofString("attachment data"))
                        .header("Content-Type", "application/octet-stream")
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertEquals(202, response.statusCode());

        // Verify parent status transitioned to PROCESSED
        parentStatus = statusStore.getStatus(parentTraceId);
        assertTrue(parentStatus.isPresent());
        assertEquals(RequestStatus.PROCESSED, parentStatus.get().status());
    }

    @Test
    @DisplayName("Should set parentTraceId on attachment status entry")
    void shouldSetParentTraceIdOnAttachmentEntry() throws Exception {
        String parentTraceId = createParentEntry("/api/upload");

        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:%d/attachments/%s".formatted(port, parentTraceId)))
                        .POST(HttpRequest.BodyPublishers.ofString("attachment"))
                        .header("Content-Type", "application/octet-stream")
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertEquals(202, response.statusCode());

        JsonObject json;
        try (var reader = Json.createReader(new StringReader(response.body()))) {
            json = reader.readObject();
        }
        String attachmentTraceId = json.getString("traceId");

        // Query status of the attachment
        var statusResponse = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:%d/status/%s".formatted(port, attachmentTraceId)))
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertEquals(200, statusResponse.statusCode());

        JsonObject statusJson;
        try (var reader = Json.createReader(new StringReader(statusResponse.body()))) {
            statusJson = reader.readObject();
        }
        assertEquals(parentTraceId, statusJson.getString("parentTraceId"));
    }
}
