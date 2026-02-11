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
import jakarta.json.JsonObject;
import lombok.experimental.UtilityClass;

import java.io.StringReader;
import java.net.ConnectException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Shared utilities for integration tests. Centralizes common patterns like
 * endpoint polling, token fetching, and URL form encoding to avoid duplication
 * across IT classes.
 */
@UtilityClass
class IntegrationTestSupport {

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
        long deadline = System.currentTimeMillis() + timeout.toMillis();
        boolean ready = false;

        while (System.currentTimeMillis() < deadline) {
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
                Thread.sleep(3000);
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
}
