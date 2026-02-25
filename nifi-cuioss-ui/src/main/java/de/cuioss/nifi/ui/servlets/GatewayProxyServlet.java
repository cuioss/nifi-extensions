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
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.nifi.web.NiFiWebConfigurationContext;

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
 *     <li>{@code GET /gateway/config} — served locally from processor properties</li>
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

    private static final String CONTENT_TYPE_JSON = "application/json";
    static final Set<String> ALLOWED_MANAGEMENT_PATHS = Set.of("/metrics");
    private static final String CONFIG_PATH = "/config";
    private static final String PROCESSOR_ID_HEADER = "X-Processor-Id";
    static final String GATEWAY_PORT_PROPERTY = "rest.gateway.listening.port";
    static final String MANAGEMENT_API_KEY_PROPERTY = "rest.gateway.management.api-key";
    private static final String MAX_REQUEST_SIZE_PROPERTY = "rest.gateway.max.request.size";
    private static final String QUEUE_SIZE_PROPERTY = "rest.gateway.request.queue.size";
    private static final String SSL_CONTEXT_SERVICE_PROPERTY = "rest.gateway.ssl.context.service";
    private static final String CORS_ALLOWED_ORIGINS_PROPERTY = "rest.gateway.cors.allowed.origins";
    private static final String LISTENING_HOST_PROPERTY = "rest.gateway.listening.host";
    private static final String ROUTE_PREFIX = "restapi.";
    private static final String API_KEY_HEADER = "X-Api-Key";
    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(10);

    /** Cached gateway ports by processor ID. */
    private final Map<String, Integer> portCache = new ConcurrentHashMap<>();
    /** Cached management API keys by processor ID. */
    private final Map<String, String> apiKeyCache = new ConcurrentHashMap<>();
    /** Cached gateway protocol (http or https) by processor ID. */
    private final Map<String, String> protocolCache = new ConcurrentHashMap<>();

    private transient NiFiWebConfigurationContext configContext;

    @Override
    public void init() throws ServletException {
        super.init();
        configContext = (NiFiWebConfigurationContext) getServletContext()
                .getAttribute("nifi-web-configuration-context");
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
        try {
            String pathInfo = req.getPathInfo();

            String processorId = req.getHeader(PROCESSOR_ID_HEADER);
            if (processorId == null || processorId.isBlank()) {
                sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Missing processor ID");
                return;
            }

            // Serve /config directly from processor properties
            if (CONFIG_PATH.equals(pathInfo)) {
                var componentConfig = resolveComponentConfig(processorId, req);
                writeConfigResponse(resp, componentConfig.properties(),
                        componentConfig.componentClass());
                return;
            }

            if (pathInfo == null || !ALLOWED_MANAGEMENT_PATHS.contains(pathInfo)) {
                LOGGER.warn(UILogMessages.WARN.GATEWAY_PROXY_PATH_REJECTED,
                        pathInfo != null ? pathInfo : "null");
                sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Invalid management path");
                return;
            }

            int port = resolveGatewayPort(processorId, req);
            String protocol = protocolCache.getOrDefault(processorId, "http");
            String gatewayUrl = protocol + "://localhost:" + port + pathInfo;
            String apiKey = apiKeyCache.get(processorId);
            String gatewayResponse = executeGatewayGet(gatewayUrl, CONTENT_TYPE_JSON, apiKey);

            resp.setContentType(CONTENT_TYPE_JSON);
            resp.setCharacterEncoding("UTF-8");
            resp.setStatus(HttpServletResponse.SC_OK);
            resp.getOutputStream().write(gatewayResponse.getBytes(StandardCharsets.UTF_8));

        } catch (IllegalArgumentException e) {
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            LOGGER.error(e, UILogMessages.ERROR.GATEWAY_PROXY_FAILED, "unknown");
            sendErrorResponse(resp, HttpServletResponse.SC_SERVICE_UNAVAILABLE,
                    "Gateway unavailable");
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) {
        try {
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

            int port = resolveGatewayPort(processorId, req);
            String protocol = protocolCache.getOrDefault(processorId, "http");
            String targetUrl = protocol + "://localhost:" + port + path;

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

            resp.setContentType(CONTENT_TYPE_JSON);
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
            LOGGER.error(e, UILogMessages.ERROR.GATEWAY_PROXY_FAILED, "unknown");
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
     * @param request     the current HTTP servlet request (for authentication context)
     * @return the gateway port
     * @throws IOException if unable to fetch component config
     */
    protected int resolveGatewayPort(String processorId, HttpServletRequest request) throws IOException {
        Integer cached = portCache.get(processorId);
        if (cached != null) return cached;

        var reader = new ComponentConfigReader(configContext);
        var config = reader.getComponentConfig(processorId, request);
        Map<String, String> properties = config.properties();

        String portStr = properties.get(GATEWAY_PORT_PROPERTY);
        if (portStr == null) {
            throw new IllegalArgumentException(
                    "Gateway port not configured for " + processorId);
        }
        int port = Integer.parseInt(portStr);
        portCache.put(processorId, port);

        // Cache protocol — HTTPS when SSL Context Service is configured
        String sslCs = properties.get(SSL_CONTEXT_SERVICE_PROPERTY);
        protocolCache.put(processorId,
                (sslCs != null && !sslCs.isBlank()) ? "https" : "http");

        // The management API key is marked as sensitive in the processor descriptor,
        // so NiFi's internal API redacts its value. Fall back to the REST API to
        // retrieve the actual value when the internal API returns null/blank.
        String apiKey = properties.get(MANAGEMENT_API_KEY_PROPERTY);
        if (apiKey == null || apiKey.isBlank()) {
            Map<String, String> restProps =
                    reader.getProcessorPropertiesViaRest(processorId, request);
            apiKey = restProps.get(MANAGEMENT_API_KEY_PROPERTY);
        }
        if (apiKey != null && !apiKey.isBlank()) {
            apiKeyCache.put(processorId, apiKey);
        }

        return port;
    }

    /**
     * Resolves all processor properties for the given processor ID.
     *
     * @param processorId the NiFi processor UUID
     * @param request     the current HTTP servlet request (for authentication context)
     * @return the processor properties map
     * @throws IOException if unable to fetch component config
     */
    protected Map<String, String> resolveProcessorProperties(String processorId,
                                                             HttpServletRequest request) throws IOException {
        var reader = new ComponentConfigReader(configContext);
        return reader.getProcessorProperties(processorId, request);
    }

    /**
     * Resolves full component configuration (type, class, properties) for the given processor ID.
     *
     * @param processorId the NiFi processor UUID
     * @param request     the current HTTP servlet request (for authentication context)
     * @return the component configuration
     * @throws IOException if unable to fetch component config
     */
    protected ComponentConfigReader.ComponentConfig resolveComponentConfig(String processorId,
                                                                           HttpServletRequest request) throws IOException {
        var reader = new ComponentConfigReader(configContext);
        return reader.getComponentConfig(processorId, request);
    }

    /**
     * Executes a GET request to the gateway management API.
     *
     * @param url    full gateway URL
     * @param accept Accept header value
     * @param apiKey management API key, or {@code null} if not configured
     * @return gateway response body
     * @throws IOException on communication error
     */
    protected String executeGatewayGet(String url, String accept, String apiKey)
            throws IOException {
        try {
            HttpClient client = ComponentConfigReader.buildTrustAllHttpClient();

            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(HTTP_TIMEOUT)
                    .GET();
            if (accept != null && !accept.isBlank()) {
                builder.header("Accept", accept);
            }
            if (apiKey != null && !apiKey.isBlank()) {
                builder.header(API_KEY_HEADER, apiKey);
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
        try {
            HttpClient client = ComponentConfigReader.buildTrustAllHttpClient();

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

    /**
     * Builds and writes the /config JSON response from processor properties.
     */
    private void writeConfigResponse(HttpServletResponse resp, Map<String, String> props,
                                     String componentClass) throws IOException {
        JsonObjectBuilder root = Json.createObjectBuilder();
        root.add("component", componentClass);
        root.add("port", Integer.parseInt(props.getOrDefault(GATEWAY_PORT_PROPERTY, "9443")));
        root.add("maxRequestBodySize",
                Integer.parseInt(props.getOrDefault(MAX_REQUEST_SIZE_PROPERTY, "1048576")));
        root.add("queueSize",
                Integer.parseInt(props.getOrDefault(QUEUE_SIZE_PROPERTY, "50")));
        root.add("ssl", props.get(SSL_CONTEXT_SERVICE_PROPERTY) != null
                && !props.get(SSL_CONTEXT_SERVICE_PROPERTY).isBlank());

        // CORS origins
        JsonArrayBuilder originsArray = Json.createArrayBuilder();
        String corsValue = props.get(CORS_ALLOWED_ORIGINS_PROPERTY);
        if (corsValue != null && !corsValue.isBlank()) {
            for (String origin : corsValue.split(",")) {
                String trimmed = origin.trim();
                if (!trimmed.isEmpty()) {
                    originsArray.add(trimmed);
                }
            }
        }
        root.add("corsAllowedOrigins", originsArray);

        // Listening host
        String host = props.get(LISTENING_HOST_PROPERTY);
        if (host != null && !host.isBlank()) {
            root.add("listeningHost", host);
        }

        root.add("routes", buildRoutesArray(props));

        resp.setContentType(CONTENT_TYPE_JSON);
        resp.setCharacterEncoding("UTF-8");
        resp.setStatus(HttpServletResponse.SC_OK);
        try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
            writer.writeObject(root.build());
        }
    }

    private static JsonArrayBuilder buildRoutesArray(Map<String, String> props) {
        JsonArrayBuilder routesArray = Json.createArrayBuilder();
        Map<String, Map<String, String>> routeGroups = new HashMap<>();
        for (Map.Entry<String, String> entry : props.entrySet()) {
            if (entry.getKey().startsWith(ROUTE_PREFIX)) {
                String remainder = entry.getKey().substring(ROUTE_PREFIX.length());
                int dot = remainder.indexOf('.');
                if (dot > 0) {
                    String routeName = remainder.substring(0, dot);
                    String subKey = remainder.substring(dot + 1);
                    routeGroups.computeIfAbsent(routeName, k -> new HashMap<>())
                            .put(subKey, entry.getValue());
                }
            }
        }
        for (Map.Entry<String, Map<String, String>> routeEntry : routeGroups.entrySet()) {
            Map<String, String> routeProps = routeEntry.getValue();
            String path = routeProps.get("path");
            if (path == null || path.isBlank()) {
                continue;
            }
            JsonObjectBuilder routeObj = Json.createObjectBuilder();
            routeObj.add("name", routeEntry.getKey());
            routeObj.add("path", path);
            routeObj.add("enabled", !"false".equalsIgnoreCase(
                    routeProps.getOrDefault("enabled", "true")));
            routeObj.add("methods", buildStringArray(routeProps.get("methods")));
            routeObj.add("requiredRoles", buildStringArray(routeProps.get("required-roles")));
            routeObj.add("requiredScopes", buildStringArray(routeProps.get("required-scopes")));
            String schema = routeProps.get("schema");
            if (schema != null && !schema.isBlank()) {
                routeObj.add("schema", schema);
            }
            String successOutcome = routeProps.get("success-outcome");
            if (successOutcome != null && !successOutcome.isBlank()) {
                routeObj.add("successOutcome", successOutcome);
            }
            routeObj.add("createFlowFile", !"false".equalsIgnoreCase(
                    routeProps.getOrDefault("create-flowfile", "true")));
            routesArray.add(routeObj);
        }
        return routesArray;
    }

    private static JsonArrayBuilder buildStringArray(String commaSeparated) {
        JsonArrayBuilder array = Json.createArrayBuilder();
        if (commaSeparated != null && !commaSeparated.isBlank()) {
            for (String item : commaSeparated.split(",")) {
                String trimmed = item.trim();
                if (!trimmed.isEmpty()) {
                    array.add(trimmed);
                }
            }
        }
        return array;
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

    private void sendErrorResponse(HttpServletResponse resp, int status, String message) {
        try {
            resp.setStatus(status);
            resp.setContentType(CONTENT_TYPE_JSON);
            resp.setCharacterEncoding("UTF-8");

            JsonObject errorJson = Json.createObjectBuilder()
                    .add("error", message)
                    .build();

            try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
                writer.writeObject(errorJson);
            }
        } catch (IOException e) {
            LOGGER.warn("Failed to send error response (status %s): %s", status, e.getMessage());
        }
    }
}
