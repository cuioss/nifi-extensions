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
package de.cuioss.nifi.integration;

import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import org.jspecify.annotations.NullMarked;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

import static de.cuioss.nifi.integration.IntegrationTestSupport.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Integration tests verifying that the gateway's application metrics are bridged
 * to NiFi-native counters (Tier A) and surface at NiFi's own monitoring endpoints.
 *
 * <p>The {@code RestApiGatewayProcessor} publishes the cumulative counts of its
 * three internal event sources as NiFi processor counters via
 * {@code session.adjustCounter} on each {@code onTrigger}. Those counters are
 * exported by NiFi itself at:
 * <ul>
 *   <li>{@code /nifi-api/counters} — JSON list of all processor counters</li>
 *   <li>{@code /nifi-api/flow/metrics/prometheus} — Prometheus exposition where the
 *       gateway counters appear in the {@code nifi_processor_counters} family with a
 *       {@code counter_name="gateway...."} label</li>
 * </ul>
 *
 * <p>The counter names carry the stable {@code gateway.} prefix defined in
 * {@code RestApiGatewayConstants.Counters} (e.g. {@code gateway.events.missing_bearer_token},
 * {@code gateway.token.access_token_created}). This test generates gateway traffic that
 * produces such events, then asserts the counters appear at BOTH NiFi-native endpoints.
 *
 * <p>Requires Docker containers to be running (NiFi HTTPS on ports 9443 and 9095,
 * Keycloak on 9085). Activated via the {@code integration-tests} Maven profile.
 */
@NullMarked
@DisplayName("Gateway Metrics at NiFi-Native Endpoints Integration Tests")
class GatewayMetricsPrometheusIT {

    /** Stable prefix every bridged gateway counter name shares (see RestApiGatewayConstants.Counters). */
    private static final String GATEWAY_COUNTER_PREFIX = "gateway.";

    private static HttpClient nifiClient;
    private static HttpClient gatewayClient;

    @BeforeAll
    static void setUp() throws Exception {
        nifiClient = HttpClient.newBuilder()
                .sslContext(createSslContext())
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        gatewayClient = HttpClient.newBuilder()
                .sslContext(createSslContext())
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        generateGatewayTraffic();
        waitForGatewayCounters(Duration.ofSeconds(60));
    }

    @Test
    @DisplayName("should expose gateway counters at /nifi-api/counters")
    void shouldExposeGatewayCountersAtCountersEndpoint() throws Exception {
        String bearerToken = authenticateToNifi(nifiClient);

        List<JsonObject> gatewayCounters = fetchGatewayCounters(bearerToken);

        assertTrue(!gatewayCounters.isEmpty(),
                "At least one gateway.* counter must surface at /nifi-api/counters; found none");
        long positive = gatewayCounters.stream()
                .filter(c -> counterValue(c) > 0)
                .count();
        assertTrue(positive > 0,
                "At least one gateway.* counter must have a positive value at /nifi-api/counters");
    }

    @Test
    @DisplayName("should expose gateway counters in the nifi_processor_counters Prometheus family")
    void shouldExposeGatewayCountersInPrometheus() throws Exception {
        String bearerToken = authenticateToNifi(nifiClient);

        String prometheus = fetchPrometheusMetrics(bearerToken);

        List<String> gatewayCounterLines = prometheus.lines()
                .filter(line -> line.startsWith("nifi_processor_counters"))
                .filter(line -> line.contains("counter_name=\"" + GATEWAY_COUNTER_PREFIX))
                .toList();

        assertTrue(!gatewayCounterLines.isEmpty(),
                "The nifi_processor_counters family must contain at least one gateway.* counter_name; "
                        + "none found in the Prometheus exposition");
    }

    // ── Traffic generation ──────────────────────────────────────────────

    private static void generateGatewayTraffic() throws Exception {
        waitForEndpoint(gatewayClient, GATEWAY_BASE + "/api/data", Duration.ofSeconds(120));

        // Unauthenticated request → seeds a MISSING_BEARER_TOKEN gateway event (no FlowFile).
        sendGateway(gatewayClient, "GET", "/api/data", null, null);

        // Authenticated requests → validate a token and enqueue FlowFiles so onTrigger fires,
        // flushing both the token-validation deltas and the pending gateway-event delta.
        String token = fetchKeycloakToken(gatewayClient,
                KEYCLOAK_TOKEN_ENDPOINT, CLIENT_ID, null, TEST_USER, PASSWORD);
        sendGateway(gatewayClient, "GET", "/api/data", token, null);
        sendGateway(gatewayClient, "POST", "/api/data", token, "{\"key\":\"value\"}");
    }

    @SuppressWarnings("java:S2925") // Thread.sleep is the standard retry-delay for NiFi metrics polling
    private static void waitForGatewayCounters(Duration timeout) throws Exception {
        long deadline = System.nanoTime() + timeout.toNanos();

        while (System.nanoTime() < deadline) {
            // Re-authenticate to NiFi each iteration so a short-lived access token
            // cannot expire mid-loop on a slow fresh-container start.
            String bearerToken = authenticateToNifi(nifiClient);
            if (!fetchGatewayCounters(bearerToken).isEmpty()) {
                return;
            }
            // Re-drive both an unauthenticated request (seeds a gateway event) and a
            // FlowFile-producing authenticated POST so onTrigger fires and flushes the
            // accumulated deltas — covers the fresh-container case where the gateway's
            // embedded server or the processor schedule was not ready for the first burst.
            sendGateway(gatewayClient, "GET", "/api/data", null, null);
            String token = fetchKeycloakToken(gatewayClient,
                    KEYCLOAK_TOKEN_ENDPOINT, CLIENT_ID, null, TEST_USER, PASSWORD);
            sendGateway(gatewayClient, "POST", "/api/data", token, "{\"key\":\"poll\"}");
            Thread.sleep(2000);
        }
        // A polling helper that waits for a state change must throw on timeout so the test fails
        // loudly with context, rather than returning silently and letting later assertions run
        // against an unmet precondition.
        fail("Timed out after %s waiting for the gateway NiFi counters to appear on /nifi-api/counters"
                .formatted(timeout));
    }

    private static void sendGateway(HttpClient client, String method, String path,
            String token, String body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(GATEWAY_BASE + path))
                .timeout(Duration.ofSeconds(30));
        if (body != null) {
            builder.method(method, HttpRequest.BodyPublishers.ofString(body))
                    .header("Content-Type", "application/json");
        } else {
            builder.method(method, HttpRequest.BodyPublishers.noBody());
        }
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }
        client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    // ── NiFi-native endpoint readers ────────────────────────────────────

    private static List<JsonObject> fetchGatewayCounters(String bearerToken) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(NIFI_API_BASE + "/counters"))
                .GET()
                .header("Authorization", "Bearer " + bearerToken)
                .timeout(Duration.ofSeconds(15))
                .build();

        HttpResponse<String> response = nifiClient.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode(),
                "Counters request failed with status %d: %s"
                        .formatted(response.statusCode(), response.body()));

        JsonObject root = Json.createReader(new StringReader(response.body())).readObject();
        JsonObject countersWrapper = root.getJsonObject("counters");
        if (countersWrapper == null) {
            return List.of();
        }
        JsonObject aggregateSnapshot = countersWrapper.getJsonObject("aggregateSnapshot");
        if (aggregateSnapshot == null || !aggregateSnapshot.containsKey("counters")) {
            return List.of();
        }
        JsonArray counters = aggregateSnapshot.getJsonArray("counters");

        return counters.stream()
                .map(JsonObject.class::cast)
                .filter(c -> c.getString("name", "").startsWith(GATEWAY_COUNTER_PREFIX))
                .toList();
    }

    /**
     * Resolves a counter's numeric value, preferring the {@code valueCount} Long field
     * and falling back to parsing the formatted {@code value} string when absent.
     *
     * @param counter a single counter JSON object from the counters endpoint
     * @return the counter value, or 0 when neither field is parseable
     */
    private static long counterValue(JsonObject counter) {
        if (counter.containsKey("valueCount") && !counter.isNull("valueCount")) {
            return counter.getJsonNumber("valueCount").longValue();
        }
        String formatted = counter.getString("value", "0").replace(",", "").trim();
        try {
            return Long.parseLong(formatted);
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private static String fetchPrometheusMetrics(String bearerToken) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(NIFI_API_BASE + "/flow/metrics/prometheus"))
                .GET()
                .header("Authorization", "Bearer " + bearerToken)
                .timeout(Duration.ofSeconds(15))
                .build();

        HttpResponse<String> response = nifiClient.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode(),
                "Prometheus metrics request failed with status %d: %s"
                        .formatted(response.statusCode(), response.body()));
        return response.body();
    }
}
