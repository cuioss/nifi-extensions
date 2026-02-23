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
import lombok.experimental.UtilityClass;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.StringReader;
import java.net.ConnectException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Shared utilities and constants for integration tests. Centralizes common
 * patterns like endpoint polling, token fetching, URL form encoding, and
 * processor discovery to avoid duplication across IT classes.
 */
@UtilityClass
class IntegrationTestSupport {

    // ── Keycloak: oauth_integration_tests realm ────────────────────────
    static final String KEYCLOAK_BASE = "http://localhost:9080";
    static final String KEYCLOAK_TOKEN_ENDPOINT = KEYCLOAK_BASE
            + "/realms/oauth_integration_tests/protocol/openid-connect/token";
    static final String KEYCLOAK_JWKS_ENDPOINT = KEYCLOAK_BASE
            + "/realms/oauth_integration_tests/protocol/openid-connect/certs";
    static final String CLIENT_ID = "test_client";
    static final String CLIENT_SECRET = "yTKslWLtf4giJcWCaoVJ20H8sy6STexM";
    static final String TEST_USER = "testUser";
    static final String LIMITED_USER = "limitedUser";
    static final String PASSWORD = "drowssap";

    // ── Keycloak: other_realm (different RSA key pair for signature tests) ──
    static final String OTHER_REALM_TOKEN_ENDPOINT = KEYCLOAK_BASE
            + "/realms/other_realm/protocol/openid-connect/token";
    static final String OTHER_CLIENT_ID = "other_client";
    static final String OTHER_CLIENT_SECRET = "otherClientSecretValue123456789";
    static final String OTHER_USER = "otherUser";

    // ── NiFi ───────────────────────────────────────────────────────────
    static final String NIFI_API_BASE = "https://localhost:9095/nifi-api";
    static final String NIFI_BASE = "https://localhost:9095";
    static final String FLOW_ENDPOINT = "http://localhost:7777";
    static final String GATEWAY_BASE = "http://localhost:9443";

    // Expected issuer value (as seen by NiFi inside Docker network)
    static final String EXPECTED_ISSUER = "http://keycloak:8080/realms/oauth_integration_tests";

    // Gateway management
    static final String MANAGEMENT_API_KEY = "integration-test-api-key";

    private static final String NIFI_USERNAME = "testUser";
    private static final String NIFI_PASSWORD = "drowssap";

    /**
     * Polls the given endpoint until it accepts connections or the timeout expires.
     * Any HTTP response (even 401) counts as "available".
     *
     * @param client   the HTTP client to use
     * @param endpoint the URL to poll
     * @param timeout  maximum wait duration
     */
    @SuppressWarnings("java:S2925") // Thread.sleep is the standard retry-delay pattern for Docker polling loops
    static void waitForEndpoint(HttpClient client, String endpoint, Duration timeout) throws Exception {
        long startNanos = System.nanoTime();
        long timeoutNanos = timeout.toNanos();
        boolean ready = false;

        while (System.nanoTime() - startNanos < timeoutNanos) {
            try {
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(endpoint))
                        .GET()
                        .timeout(Duration.ofSeconds(10))
                        .build();
                client.send(request, HttpResponse.BodyHandlers.ofString());
                ready = true;
                break;
            } catch (ConnectException e) {
                // Not ready yet, retry
                Thread.sleep(1000);
            }
        }

        assertTrue(ready,
                "Endpoint at %s did not become available within %d seconds. "
                        .formatted(endpoint, timeout.toSeconds())
                        + "Run ./integration-testing/src/main/docker/run-and-deploy.sh to start containers.");
    }

    /**
     * Fetches an OAuth2 access token from a Keycloak token endpoint using the
     * Resource Owner Password Credentials grant.
     *
     * @param client       the HTTP client to use
     * @param endpoint     the token endpoint URL
     * @param clientId     the OAuth2 client ID
     * @param clientSecret the OAuth2 client secret
     * @param username     the resource owner username
     * @param password     the resource owner password
     * @return the access token string
     */
    static String fetchKeycloakToken(HttpClient client, String endpoint,
                                     String clientId, String clientSecret,
                                     String username, String password) throws Exception {
        String body = formEncode(Map.of(
                "grant_type", "password",
                "client_id", clientId,
                "client_secret", clientSecret,
                "username", username,
                "password", password,
                "scope", "openid"));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .timeout(Duration.ofSeconds(10))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode(),
                "Token request to %s failed with status %d: %s"
                        .formatted(endpoint, response.statusCode(), response.body()));

        JsonObject json = Json.createReader(new StringReader(response.body())).readObject();
        String accessToken = json.getString("access_token");
        assertNotNull(accessToken, "Response must contain 'access_token'");
        return accessToken;
    }

    /**
     * URL-encodes a map of parameters for use in form-urlencoded HTTP bodies.
     *
     * @param params the parameter map
     * @return the URL-encoded string
     */
    static String formEncode(Map<String, String> params) {
        return params.entrySet().stream()
                .map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8)
                        + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
    }

    /**
     * Creates an SSLContext that trusts all certificates, suitable for
     * Docker-based integration tests with self-signed certificates.
     *
     * @return an SSLContext configured to trust all certificates
     */
    @SuppressWarnings("java:S4830") // Trust-all SSL is intentional for self-signed Docker certs
    static SSLContext createTrustAllSslContext() throws Exception {
        TrustManager[] trustAllManagers = {
                new X509TrustManager() {
                    @Override
                    public void checkClientTrusted(X509Certificate[] chain, String authType) {
                        // Trust all for Docker self-signed certs
                    }

                    @Override
                    public void checkServerTrusted(X509Certificate[] chain, String authType) {
                        // Trust all for Docker self-signed certs
                    }

                    @Override
                    public X509Certificate[] getAcceptedIssuers() {
                        return new X509Certificate[0];
                    }
                }
        };

        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(null, trustAllManagers, new SecureRandom());
        return sslContext;
    }

    /**
     * Authenticates to NiFi using the built-in single-user credentials and returns
     * a bearer token string. Posts form-encoded username/password to the NiFi
     * access token endpoint.
     *
     * @param client the HTTPS-capable HTTP client to use
     * @return the bearer token string
     */
    static String authenticateToNifi(HttpClient client) throws Exception {
        String body = formEncode(Map.of(
                "username", NIFI_USERNAME,
                "password", NIFI_PASSWORD));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(NIFI_API_BASE + "/access/token"))
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .timeout(Duration.ofSeconds(10))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(201, response.statusCode(),
                "NiFi authentication failed with status %d: %s"
                        .formatted(response.statusCode(), response.body()));

        return response.body().trim();
    }

    /**
     * Recursively searches for a processor by name in a process group aggregate
     * snapshot, traversing child process groups. Returns the full processor status
     * object (containing {@code processorStatusSnapshot}).
     *
     * @param snapshot              the aggregate snapshot to search
     * @param processorNameSubstring substring to match in processor names
     * @return the processor status object, or empty if not found
     */
    static Optional<JsonObject> findProcessorInSnapshot(JsonObject snapshot,
                                                        String processorNameSubstring) {
        JsonArray processorStatuses = snapshot.getJsonArray("processorStatusSnapshots");
        if (processorStatuses != null) {
            for (JsonValue value : processorStatuses) {
                JsonObject processorStatus = value.asJsonObject();
                String name = processorStatus
                        .getJsonObject("processorStatusSnapshot")
                        .getString("name");
                if (name.contains(processorNameSubstring)) {
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
                Optional<JsonObject> result = findProcessorInSnapshot(childSnapshot,
                        processorNameSubstring);
                if (result.isPresent()) {
                    return result;
                }
            }
        }

        return Optional.empty();
    }
}
