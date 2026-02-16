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

import de.cuioss.nifi.ui.UILogMessages;
import de.cuioss.nifi.ui.util.ComponentConfigReader;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.*;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Thin CORS proxy servlet for gateway management API calls.
 * Proxies requests to the gateway's embedded Jetty server, avoiding
 * cross-origin issues (gateway runs on a different port than NiFi).
 *
 * <p>Supports three endpoints:
 * <ul>
 *     <li>{@code GET /gateway/metrics} — proxies to gateway's {@code /metrics}</li>
 *     <li>{@code GET /gateway/config} — proxies to gateway's {@code /config}</li>
 *     <li>{@code POST /gateway/test} — proxies an arbitrary test request to the gateway</li>
 * </ul>
 *
 * <p><strong>Security:</strong> Whitelist-based path validation for GET requests.
 * SSRF protection for test requests (only localhost targets allowed).
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 */
public class GatewayProxyServlet extends HttpServlet {

    private static final CuiLogger LOGGER = new CuiLogger(GatewayProxyServlet.class);
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());
    private static final JsonReaderFactory JSON_READER = Json.createReaderFactory(Map.of());

    static final Set<String> ALLOWED_MANAGEMENT_PATHS = Set.of("/metrics", "/config");
    private static final String PROCESSOR_ID_HEADER = "X-Processor-Id";
    static final String GATEWAY_PORT_PROPERTY = "rest.gateway.listening.port";
    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(10);

    /** Cached gateway ports by processor ID. */
    private final Map<String, Integer> portCache = new ConcurrentHashMap<>();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String pathInfo = req.getPathInfo();

        if (pathInfo == null || !ALLOWED_MANAGEMENT_PATHS.contains(pathInfo)) {
            LOGGER.warn(UILogMessages.WARN.GATEWAY_PROXY_PATH_REJECTED,
                    pathInfo != null ? pathInfo : "null");
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Invalid management path");
            return;
        }

        String processorId = req.getHeader(PROCESSOR_ID_HEADER);
        if (processorId == null || processorId.isBlank()) {
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Missing processor ID");
            return;
        }

        try {
            int port = resolveGatewayPort(processorId);
            String gatewayUrl = "http://localhost:" + port + pathInfo;
            String gatewayResponse = executeGatewayGet(gatewayUrl, "application/json");

            resp.setContentType("application/json");
            resp.setCharacterEncoding("UTF-8");
            resp.setStatus(HttpServletResponse.SC_OK);
            resp.getOutputStream().write(gatewayResponse.getBytes(StandardCharsets.UTF_8));

        } catch (IllegalArgumentException e) {
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            LOGGER.error(e, UILogMessages.ERROR.GATEWAY_PROXY_FAILED, processorId);
            sendErrorResponse(resp, HttpServletResponse.SC_SERVICE_UNAVAILABLE,
                    "Gateway unavailable");
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String pathInfo = req.getPathInfo();

        if (!"/test".equals(pathInfo)) {
            LOGGER.warn(UILogMessages.WARN.GATEWAY_PROXY_PATH_REJECTED,
                    pathInfo != null ? pathInfo : "null");
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Invalid path for POST");
            return;
        }

        String processorId = req.getHeader(PROCESSOR_ID_HEADER);
        if (processorId == null || processorId.isBlank()) {
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Missing processor ID");
            return;
        }

        try {
            JsonObject testRequest;
            try (JsonReader reader = JSON_READER.createReader(req.getInputStream())) {
                testRequest = reader.readObject();
            }

            String path = testRequest.getString("path", "");
            String method = testRequest.getString("method", "GET");
            String body = testRequest.containsKey("body") && !testRequest.isNull("body")
                    ? testRequest.getString("body") : null;

            if (path.isEmpty()) {
                sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Missing 'path' in test request");
                return;
            }

            int port = resolveGatewayPort(processorId);
            String targetUrl = "http://localhost:" + port + path;

            // SSRF protection
            if (!isLocalhostTarget(URI.create(targetUrl))) {
                LOGGER.warn(UILogMessages.WARN.SSRF_BLOCKED, targetUrl);
                sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Only localhost targets allowed");
                return;
            }

            // Extract headers from test request
            Map<String, String> headers = new HashMap<>();
            if (testRequest.containsKey("headers") && !testRequest.isNull("headers")) {
                JsonObject hdrs = testRequest.getJsonObject("headers");
                for (String key : hdrs.keySet()) {
                    headers.put(key, hdrs.getString(key, ""));
                }
            }

            GatewayResponse gatewayResp = executeGatewayRequest(
                    targetUrl, method, headers, body);

            // Wrap gateway response for frontend
            JsonObjectBuilder result = Json.createObjectBuilder()
                    .add("status", gatewayResp.statusCode())
                    .add("body", gatewayResp.body() != null ? gatewayResp.body() : "");

            JsonObjectBuilder respHeaders = Json.createObjectBuilder();
            if (gatewayResp.headers() != null) {
                gatewayResp.headers().forEach(respHeaders::add);
            }
            result.add("headers", respHeaders);

            resp.setContentType("application/json");
            resp.setCharacterEncoding("UTF-8");
            resp.setStatus(HttpServletResponse.SC_OK);

            try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
                writer.writeObject(result.build());
            }

        } catch (JsonException e) {
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Invalid JSON request body");
        } catch (IllegalArgumentException e) {
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            LOGGER.error(e, UILogMessages.ERROR.GATEWAY_PROXY_FAILED, processorId);
            sendErrorResponse(resp, HttpServletResponse.SC_SERVICE_UNAVAILABLE,
                    "Gateway unavailable");
        }
    }

    // -----------------------------------------------------------------------
    // Protected methods — overridable for testing
    // -----------------------------------------------------------------------

    /**
     * Resolves the gateway listening port for the given processor ID.
     *
     * @param processorId the NiFi processor UUID
     * @return the gateway port
     * @throws IOException if unable to fetch component config
     */
    protected int resolveGatewayPort(String processorId) throws IOException {
        Integer cached = portCache.get(processorId);
        if (cached != null) return cached;

        var reader = new ComponentConfigReader();
        var config = reader.getComponentConfig(processorId);
        String portStr = config.properties().get(GATEWAY_PORT_PROPERTY);
        if (portStr == null) {
            throw new IllegalArgumentException(
                    "Gateway port not configured for " + processorId);
        }
        int port = Integer.parseInt(portStr);
        portCache.put(processorId, port);
        return port;
    }

    /**
     * Executes a GET request to the gateway management API.
     *
     * @param url    full gateway URL
     * @param accept Accept header value
     * @return gateway response body
     * @throws IOException on communication error
     */
    protected String executeGatewayGet(String url, String accept)
            throws IOException {
        try (HttpClient client = HttpClient.newBuilder()
                .connectTimeout(HTTP_TIMEOUT).build()) {

            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(HTTP_TIMEOUT)
                    .GET();
            if (accept != null && !accept.isBlank()) {
                builder.header("Accept", accept);
            }

            HttpResponse<String> response = client.send(builder.build(),
                    HttpResponse.BodyHandlers.ofString());
            return response.body();

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Gateway request interrupted", e);
        }
    }

    /**
     * Executes an arbitrary request to the gateway (used for /test endpoint).
     *
     * @param url     full gateway URL
     * @param method  HTTP method
     * @param headers request headers
     * @param body    request body (may be null)
     * @return wrapped gateway response
     * @throws IOException on communication error
     */
    protected GatewayResponse executeGatewayRequest(String url, String method,
                                                    Map<String, String> headers, String body) throws IOException {
        try (HttpClient client = HttpClient.newBuilder()
                .connectTimeout(HTTP_TIMEOUT).build()) {

            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(HTTP_TIMEOUT);

            HttpRequest.BodyPublisher bodyPublisher = body != null
                    ? HttpRequest.BodyPublishers.ofString(body)
                    : HttpRequest.BodyPublishers.noBody();
            builder.method(method, bodyPublisher);

            headers.forEach(builder::header);

            HttpResponse<String> response = client.send(builder.build(),
                    HttpResponse.BodyHandlers.ofString());

            Map<String, String> responseHeaders = new HashMap<>();
            response.headers().map().forEach((key, values) -> {
                if (!values.isEmpty()) {
                    responseHeaders.put(key, values.getFirst());
                }
            });

            return new GatewayResponse(response.statusCode(),
                    response.body(), responseHeaders);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Gateway request interrupted", e);
        }
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    /** Gateway response wrapper for the /test endpoint. */
    record GatewayResponse(int statusCode, String body, Map<String, String> headers) {
    }

    static boolean isLocalhostTarget(URI uri) {
        String host = uri.getHost();
        if (host == null) return false;
        // URI.getHost() returns brackets for IPv6, e.g. "[::1]"
        String normalizedHost = host.startsWith("[") && host.endsWith("]")
                ? host.substring(1, host.length() - 1) : host;
        return "localhost".equals(normalizedHost)
                || "127.0.0.1".equals(normalizedHost)
                || "::1".equals(normalizedHost);
    }

    private void sendErrorResponse(HttpServletResponse resp, int status, String message)
            throws IOException {
        resp.setStatus(status);
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");

        JsonObject errorJson = Json.createObjectBuilder()
                .add("error", message)
                .build();

        try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
            writer.writeObject(errorJson);
        }
    }
}
