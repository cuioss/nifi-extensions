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
import jakarta.json.JsonValue;
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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Integration tests that verify NiFi processor metrics via the NiFi REST API.
 *
 * <p>After the flow pipeline tests have sent HTTP requests through the NiFi flow,
 * this test class queries the NiFi REST API to verify that the processors actually
 * processed FlowFiles and routed them through the expected paths (success and failure).
 *
 * <p>Requires Docker containers to be running (NiFi on ports 7777 and 9095, Keycloak on 9080).
 * Activated via the {@code integration-tests} Maven profile.
 */
@NullMarked
@DisplayName("NiFi Processor Metrics Integration Tests")
class NiFiProcessorMetricsIT {

    private static final String NIFI_API_BASE = "https://localhost:9095/nifi-api";

    // Flow endpoint for triggering traffic before checking metrics
    private static final String FLOW_ENDPOINT = "http://localhost:7777";

    // Keycloak token endpoint for getting a valid JWT
    private static final String KEYCLOAK_TOKEN_ENDPOINT =
            "http://localhost:9080/realms/oauth_integration_tests/protocol/openid-connect/token";
    private static final String CLIENT_ID = "test_client";
    private static final String CLIENT_SECRET = "yTKslWLtf4giJcWCaoVJ20H8sy6STexM";

    private static HttpClient nifiClient;
    private static HttpClient plainClient;

    @BeforeAll
    static void setUp() throws Exception {
        nifiClient = HttpClient.newBuilder()
                .sslContext(IntegrationTestSupport.createTrustAllSslContext())
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        plainClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        // Send traffic through the flow to ensure metrics are populated
        ensureFlowHasTraffic();
    }

    @Test
    @DisplayName("should show JWT authenticator processor has processed FlowFiles")
    void shouldShowJwtAuthenticatorProcessedFlowFiles() throws Exception {
        String bearerToken = authenticateToNifi();
        JsonObject status = getProcessGroupStatus(bearerToken);

        JsonObject aggregateSnapshot = status
                .getJsonObject("processGroupStatus")
                .getJsonObject("aggregateSnapshot");

        // Find the JWT authenticator processor (may be in a child process group)
        Optional<JsonObject> jwtProcessor = findProcessorByNameRecursive(aggregateSnapshot,
                "MultiIssuerJWTTokenAuthenticator");

        assertTrue(jwtProcessor.isPresent(),
                "JWT authenticator processor should be found in process group status");

        JsonObject snapshot = jwtProcessor.get().getJsonObject("processorStatusSnapshot");
        int flowFilesIn = snapshot.getInt("flowFilesIn");
        int flowFilesOut = snapshot.getInt("flowFilesOut");

        assertTrue(flowFilesIn > 0,
                "JWT authenticator should have received FlowFiles. flowFilesIn=" + flowFilesIn);
        assertTrue(flowFilesOut > 0,
                "JWT authenticator should have output FlowFiles. flowFilesOut=" + flowFilesOut);
    }

    @Test
    @DisplayName("should show HandleHttpResponse processors have processed FlowFiles")
    void shouldShowResponseProcessorsProcessedFlowFiles() throws Exception {
        String bearerToken = authenticateToNifi();
        JsonObject status = getProcessGroupStatus(bearerToken);

        JsonObject aggregateSnapshot = status
                .getJsonObject("processGroupStatus")
                .getJsonObject("aggregateSnapshot");

        // Verify both response handlers received FlowFiles (may be in a child process group)
        Optional<JsonObject> successResponse = findProcessorByNameRecursive(aggregateSnapshot,
                "HandleHttpResponse (200)");
        Optional<JsonObject> failureResponse = findProcessorByNameRecursive(aggregateSnapshot,
                "HandleHttpResponse (401)");

        assertTrue(successResponse.isPresent(),
                "HandleHttpResponse (200) processor should be found");
        assertTrue(failureResponse.isPresent(),
                "HandleHttpResponse (401) processor should be found");

        int successIn = successResponse.get()
                .getJsonObject("processorStatusSnapshot").getInt("flowFilesIn");
        int failureIn = failureResponse.get()
                .getJsonObject("processorStatusSnapshot").getInt("flowFilesIn");

        assertTrue(successIn > 0,
                "Success response handler should have received FlowFiles. flowFilesIn=" + successIn);
        assertTrue(failureIn > 0,
                "Failure response handler should have received FlowFiles. flowFilesIn=" + failureIn);
    }

    // ── Helper methods ─────────────────────────────────────────────────

    private static void ensureFlowHasTraffic() throws Exception {
        // Wait for flow endpoint availability
        IntegrationTestSupport.waitForEndpoint(plainClient, FLOW_ENDPOINT, Duration.ofSeconds(120));

        // Send a request without a token (triggers failure path)
        HttpRequest noTokenRequest = HttpRequest.newBuilder()
                .uri(URI.create(FLOW_ENDPOINT))
                .GET()
                .timeout(Duration.ofSeconds(30))
                .build();
        plainClient.send(noTokenRequest, HttpResponse.BodyHandlers.ofString());

        // Send a request with a valid token (triggers success path)
        String token = IntegrationTestSupport.fetchKeycloakToken(plainClient,
                KEYCLOAK_TOKEN_ENDPOINT, CLIENT_ID, CLIENT_SECRET, "testUser", "drowssap");
        HttpRequest validTokenRequest = HttpRequest.newBuilder()
                .uri(URI.create(FLOW_ENDPOINT))
                .GET()
                .header("Authorization", "Bearer " + token)
                .timeout(Duration.ofSeconds(30))
                .build();
        plainClient.send(validTokenRequest, HttpResponse.BodyHandlers.ofString());

        // Poll NiFi metrics until the processor reflects the traffic we just sent,
        // rather than using a fixed Thread.sleep which is fragile on slow CI machines
        waitForProcessorActivity("MultiIssuerJWTTokenAuthenticator", Duration.ofSeconds(15));
    }

    /**
     * Polls the NiFi process group status API until the named processor shows
     * at least one FlowFile processed, or the timeout expires. This replaces
     * a fixed {@code Thread.sleep} with a condition-based wait.
     */
    @SuppressWarnings("java:S2925") // Thread.sleep is the standard retry-delay for NiFi status polling
    private static void waitForProcessorActivity(String processorName, Duration timeout)
            throws Exception {
        String bearerToken = IntegrationTestSupport.authenticateToNifi(nifiClient);
        long deadline = System.nanoTime() + timeout.toNanos();

        while (System.nanoTime() < deadline) {
            JsonObject status = getProcessGroupStatus(bearerToken);
            JsonObject aggregateSnapshot = status
                    .getJsonObject("processGroupStatus")
                    .getJsonObject("aggregateSnapshot");

            Optional<JsonObject> processor = findProcessorByNameRecursive(
                    aggregateSnapshot, processorName);
            if (processor.isPresent()) {
                int flowFilesIn = processor.get()
                        .getJsonObject("processorStatusSnapshot")
                        .getInt("flowFilesIn");
                if (flowFilesIn > 0) {
                    return;
                }
            }
            Thread.sleep(500);
        }
        // Don't fail here — let the actual test assertions report the problem
    }

    private static String authenticateToNifi() throws Exception {
        return IntegrationTestSupport.authenticateToNifi(nifiClient);
    }

    private static JsonObject getProcessGroupStatus(String bearerToken) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(NIFI_API_BASE + "/flow/process-groups/root/status?recursive=true"))
                .GET()
                .header("Authorization", "Bearer " + bearerToken)
                .timeout(Duration.ofSeconds(15))
                .build();

        HttpResponse<String> response = nifiClient.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode(),
                "Process group status request failed with status %d: %s"
                        .formatted(response.statusCode(), response.body()));

        return Json.createReader(new StringReader(response.body())).readObject();
    }

    /**
     * Recursively searches for a processor by exact name through the aggregate
     * snapshot, traversing child process groups.
     */
    private static Optional<JsonObject> findProcessorByNameRecursive(JsonObject snapshot, String name) {
        JsonArray processorStatuses = snapshot.getJsonArray("processorStatusSnapshots");
        if (processorStatuses != null) {
            for (JsonValue value : processorStatuses) {
                JsonObject processorStatus = value.asJsonObject();
                String processorName = processorStatus
                        .getJsonObject("processorStatusSnapshot")
                        .getString("name");
                if (processorName.equals(name)) {
                    return Optional.of(processorStatus);
                }
            }
        }

        // Recurse into child process groups
        JsonArray childGroups = snapshot.getJsonArray("processGroupStatusSnapshots");
        if (childGroups != null) {
            for (JsonValue groupValue : childGroups) {
                JsonObject childSnapshot = groupValue.asJsonObject()
                        .getJsonObject("processGroupStatusSnapshot");
                Optional<JsonObject> result = findProcessorByNameRecursive(childSnapshot, name);
                if (result.isPresent()) {
                    return result;
                }
            }
        }

        return Optional.empty();
    }

}
