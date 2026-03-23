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

import de.cuioss.nifi.jwt.config.ConfigurationManager;
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
import java.io.StringReader;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Thin proxy servlet for gateway management API calls.
 * Proxies requests to the gateway's embedded Jetty server (which runs
 * on a different port than NiFi).
 *
 * <p>Supports five endpoints:
 * <ul>
 *     <li>{@code GET /gateway/metrics} — proxies to gateway's {@code /metrics}</li>
 *     <li>{@code GET /gateway/config} — served locally from processor properties</li>
 *     <li>{@code POST /gateway/test} — proxies an arbitrary test request to the gateway</li>
 *     <li>{@code POST /gateway/token-fetch} — proxies an OAuth token request to the IDP</li>
 *     <li>{@code POST /gateway/discover-token-endpoint} — fetches OIDC discovery for token endpoint</li>
 * </ul>
 *
 * <p><strong>Security:</strong> Whitelist-based path validation for GET requests.
 * SSRF protection for test requests (only localhost targets allowed).
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/reference/configuration.adoc">Configuration Reference</a>
 */
public class GatewayProxyServlet extends HttpServlet {

    private static final CuiLogger LOGGER = new CuiLogger(GatewayProxyServlet.class);
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());
    private static final JsonReaderFactory JSON_READER = Json.createReaderFactory(Map.of());

    private static final String CONTENT_TYPE_JSON = "application/json";
    static final Set<String> ALLOWED_MANAGEMENT_PATHS = Set.of("/metrics", "/health");
    private static final String CONFIG_PATH = "/config";
    private static final String PROCESSOR_ID_HEADER = "X-Processor-Id";
    static final String GATEWAY_PORT_PROPERTY = "rest.gateway.listening.port";
    private static final String MAX_REQUEST_SIZE_PROPERTY = "rest.gateway.max.request.size";
    private static final String QUEUE_SIZE_PROPERTY = "rest.gateway.request.queue.size";
    private static final String SSL_CONTEXT_SERVICE_PROPERTY = "rest.gateway.ssl.context.service";
    private static final String LISTENING_HOST_PROPERTY = "rest.gateway.listening.host";
    private static final String HEALTH_ENABLED_PROPERTY = "rest.gateway.management.health.enabled";
    private static final String HEALTH_AUTH_MODE_PROPERTY = "rest.gateway.management.health.auth-mode";
    private static final String HEALTH_REQUIRED_ROLES_PROPERTY = "rest.gateway.management.health.required-roles";
    private static final String HEALTH_REQUIRED_SCOPES_PROPERTY = "rest.gateway.management.health.required-scopes";
    private static final String METRICS_ENABLED_PROPERTY = "rest.gateway.management.metrics.enabled";
    private static final String METRICS_AUTH_MODE_PROPERTY = "rest.gateway.management.metrics.auth-mode";
    private static final String METRICS_REQUIRED_ROLES_PROPERTY = "rest.gateway.management.metrics.required-roles";
    private static final String METRICS_REQUIRED_SCOPES_PROPERTY = "rest.gateway.management.metrics.required-scopes";
    private static final String STATUS_ENABLED_PROPERTY = "rest.gateway.management.status.enabled";
    private static final String STATUS_AUTH_MODE_PROPERTY = "rest.gateway.management.status.auth-mode";
    private static final String STATUS_REQUIRED_ROLES_PROPERTY = "rest.gateway.management.status.required-roles";
    private static final String STATUS_REQUIRED_SCOPES_PROPERTY = "rest.gateway.management.status.required-scopes";
    private static final String ATTACHMENTS_ENABLED_PROPERTY = "rest.gateway.management.attachments.enabled";
    private static final String ATTACHMENTS_AUTH_MODE_PROPERTY = "rest.gateway.management.attachments.auth-mode";
    private static final String ATTACHMENTS_REQUIRED_ROLES_PROPERTY = "rest.gateway.management.attachments.required-roles";
    private static final String ATTACHMENTS_REQUIRED_SCOPES_PROPERTY = "rest.gateway.management.attachments.required-scopes";
    private static final String ATTACHMENTS_HARD_LIMIT_PROPERTY = "rest.gateway.management.attachments.hard-limit";
    private static final String ROUTE_PREFIX = "restapi.";
    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(10);
    private static final String TOKEN_FETCH_PATH = "/token-fetch";
    private static final String DISCOVER_TOKEN_ENDPOINT_PATH = "/discover-token-endpoint";
    private static final String KEY_USERNAME = "username";
    @SuppressWarnings("java:S2068") // "password" is the OAuth 2.0 grant type name, not a credential
    private static final String KEY_PASSWORD = "password";
    private static final String GRANT_TYPE_PASSWORD = "password";
    static final Set<String> ALLOWED_GRANT_TYPES = Set.of(GRANT_TYPE_PASSWORD, "client_credentials");
    private static final String ISSUER_PROPERTY_SUFFIX = ".issuer";
    private static final String MSG_MISSING_PROCESSOR_ID = "Missing processor ID";
    private static final String MSG_INVALID_JSON = "Invalid JSON request body";
    private static final String FALSE_STRING = "false";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_METHODS = "methods";
    private static final String KEY_REQUIRED_ROLES = "requiredRoles";
    private static final String KEY_REQUIRED_SCOPES = "requiredScopes";
    private static final String KEY_AUTH_MODE = "authMode";
    private static final String KEY_BUILT_IN = "builtIn";
    private static final String KEY_ACCESS_TOKEN = "access_token";
    private static final String KEY_EXPIRES_IN = "expires_in";
    private static final String KEY_HEADERS = "headers";
    private static final String CHARSET_UTF8 = "UTF-8";
    private static final String DEFAULT_AUTH_MODE = "local-only,bearer";

    /** Cached gateway ports by processor ID. */
    private final Map<String, Integer> portCache = new ConcurrentHashMap<>();
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
                        MSG_MISSING_PROCESSOR_ID);
                return;
            }

            // Serve /config directly from processor properties
            if (CONFIG_PATH.equals(pathInfo)) {
                // Invalidate cached port/protocol — properties may have changed
                portCache.remove(processorId);
                protocolCache.remove(processorId);
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
            GatewayGetResponse gwResp = executeGatewayGet(gatewayUrl, CONTENT_TYPE_JSON);

            resp.setContentType(CONTENT_TYPE_JSON);
            resp.setCharacterEncoding(CHARSET_UTF8);
            resp.setStatus(gwResp.statusCode());
            resp.getOutputStream().write(gwResp.body().getBytes(StandardCharsets.UTF_8));

        } catch (IllegalArgumentException e) {
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.GATEWAY_PROXY_FAILED, "unknown");
            sendErrorResponse(resp, HttpServletResponse.SC_SERVICE_UNAVAILABLE,
                    "Gateway unavailable");
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) {
        try {
            String pathInfo = req.getPathInfo();

            if (TOKEN_FETCH_PATH.equals(pathInfo)) {
                handleTokenFetch(req, resp);
                return;
            }
            if (DISCOVER_TOKEN_ENDPOINT_PATH.equals(pathInfo)) {
                handleDiscoverTokenEndpoint(req, resp);
                return;
            }
            if ("/test".equals(pathInfo)) {
                handleTestRequest(req, resp);
                return;
            }

            LOGGER.warn(UILogMessages.WARN.GATEWAY_PROXY_PATH_REJECTED,
                    pathInfo != null ? pathInfo : "null");
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Invalid path for POST");

        } catch (JsonException e) {
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                    MSG_INVALID_JSON);
        } catch (IllegalArgumentException e) {
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.GATEWAY_PROXY_FAILED, "unknown");
            sendErrorResponse(resp, HttpServletResponse.SC_SERVICE_UNAVAILABLE,
                    "Gateway unavailable");
        }
    }

    private void handleTestRequest(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String processorId = req.getHeader(PROCESSOR_ID_HEADER);
        if (processorId == null || processorId.isBlank()) {
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                    MSG_MISSING_PROCESSOR_ID);
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

        Map<String, String> headers = extractTestHeaders(testRequest);
        GatewayResponse gatewayResp = executeGatewayRequest(targetUrl, method, headers, body);
        writeTestResponse(resp, gatewayResp);
    }

    private static Map<String, String> extractTestHeaders(JsonObject testRequest) {
        Map<String, String> headers = new HashMap<>();
        if (testRequest.containsKey(KEY_HEADERS) && !testRequest.isNull(KEY_HEADERS)) {
            JsonObject hdrs = testRequest.getJsonObject(KEY_HEADERS);
            for (String key : hdrs.keySet()) {
                headers.put(key, hdrs.getString(key, ""));
            }
        }
        return headers;
    }

    private void writeTestResponse(HttpServletResponse resp, GatewayResponse gatewayResp) throws IOException {
        JsonObjectBuilder result = Json.createObjectBuilder()
                .add("status", gatewayResp.statusCode())
                .add("body", gatewayResp.body() != null ? gatewayResp.body() : "");

        JsonObjectBuilder respHeaders = Json.createObjectBuilder();
        if (gatewayResp.headers() != null) {
            gatewayResp.headers().forEach(respHeaders::add);
        }
        result.add(KEY_HEADERS, respHeaders);

        resp.setContentType(CONTENT_TYPE_JSON);
        resp.setCharacterEncoding(CHARSET_UTF8);
        resp.setStatus(HttpServletResponse.SC_OK);

        try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
            writer.writeObject(result.build());
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
     * Authentication is handled transparently via loopback bypass (requests
     * originate from localhost).
     *
     * @param url    full gateway URL
     * @param accept Accept header value
     * @return gateway response with status code and body
     * @throws IOException on communication error
     */
    protected GatewayGetResponse executeGatewayGet(String url, String accept)
            throws IOException {
        try {
            HttpClient client = ComponentConfigReader.buildHttpClient();

            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(HTTP_TIMEOUT)
                    .GET();
            if (accept != null && !accept.isBlank()) {
                builder.header("Accept", accept);
            }

            HttpResponse<String> response = client.send(builder.build(),
                    HttpResponse.BodyHandlers.ofString());
            return new GatewayGetResponse(response.statusCode(), response.body());

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
            HttpClient client = ComponentConfigReader.buildHttpClient();

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

    /**
     * Executes an HTTP request to an IDP endpoint (token fetch or OIDC discovery).
     * Overridable for testing.
     *
     * @param url         the IDP endpoint URL
     * @param method      HTTP method (GET or POST)
     * @param contentType Content-Type header (may be null for GET)
     * @param body        request body (may be null)
     * @return the IDP response
     * @throws IOException on communication error
     */
    protected IdpResponse executeIdpRequest(String url, String method,
            String contentType, String body) throws IOException {
        try {
            HttpClient client = ComponentConfigReader.buildHttpClient();

            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(HTTP_TIMEOUT);

            if ("POST".equals(method) && body != null) {
                builder.method("POST", HttpRequest.BodyPublishers.ofString(body));
            } else {
                builder.GET();
            }
            if (contentType != null) {
                builder.header("Content-Type", contentType);
            }
            builder.header("Accept", CONTENT_TYPE_JSON);

            HttpResponse<String> response = client.send(builder.build(),
                    HttpResponse.BodyHandlers.ofString());
            return new IdpResponse(response.statusCode(), response.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("IDP request interrupted", e);
        }
    }

    // -----------------------------------------------------------------------
    // Token fetch and OIDC discovery handlers
    // -----------------------------------------------------------------------

    private void handleTokenFetch(HttpServletRequest req, HttpServletResponse resp) {
        try {
            String processorId = req.getHeader(PROCESSOR_ID_HEADER);
            if (processorId == null || processorId.isBlank()) {
                sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                        MSG_MISSING_PROCESSOR_ID);
                return;
            }

            JsonObject requestBody;
            try (JsonReader reader = JSON_READER.createReader(req.getInputStream())) {
                requestBody = reader.readObject();
            }

            String tokenEndpointUrl = requestBody.getString("tokenEndpointUrl", "");
            String grantType = requestBody.getString("grantType", "");
            String clientId = requestBody.getString("clientId", "");
            String clientSecret = requestBody.getString("clientSecret", "");
            String scope = requestBody.getString("scope", "openid");

            if (tokenEndpointUrl.isBlank() || clientId.isBlank()) {
                sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Missing required fields: tokenEndpointUrl, clientId");
                return;
            }

            if (!ALLOWED_GRANT_TYPES.contains(grantType)) {
                LOGGER.warn(UILogMessages.WARN.GATEWAY_INVALID_GRANT_TYPE, grantType);
                sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Invalid grant type. Allowed: password, client_credentials");
                return;
            }

            if (GRANT_TYPE_PASSWORD.equals(grantType)
                    && requestBody.getString(KEY_USERNAME, "").isBlank()) {
                sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Missing required field for password grant: username");
                return;
            }

            // SSRF protection: check token endpoint host against allowed issuer hosts
            Set<String> allowedHosts = resolveAllowedIssuerHosts(processorId, req);
            if (!isAllowedTokenEndpointHost(tokenEndpointUrl, allowedHosts)) {
                LOGGER.warn(UILogMessages.WARN.GATEWAY_TOKEN_FETCH_SSRF_BLOCKED,
                        tokenEndpointUrl);
                sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Token endpoint host not allowed");
                return;
            }

            String formBody = buildTokenFormBody(requestBody, grantType,
                    clientId, clientSecret, scope);

            IdpResponse idpResp = executeIdpRequest(tokenEndpointUrl, "POST",
                    "application/x-www-form-urlencoded", formBody);

            JsonObjectBuilder result = Json.createObjectBuilder()
                    .add("idpStatus", idpResp.statusCode());
            parseTokenResponse(idpResp, result);

            writeJsonResponse(resp, HttpServletResponse.SC_OK, result.build());
        } catch (JsonException e) {
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                    MSG_INVALID_JSON);
        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.GATEWAY_TOKEN_FETCH_FAILED, e.getMessage());
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_GATEWAY,
                    "Token fetch failed");
        }
    }

    private void handleDiscoverTokenEndpoint(HttpServletRequest req,
            HttpServletResponse resp) {
        try {
            String processorId = req.getHeader(PROCESSOR_ID_HEADER);
            if (processorId == null || processorId.isBlank()) {
                sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                        MSG_MISSING_PROCESSOR_ID);
                return;
            }

            JsonObject requestBody;
            try (JsonReader reader = JSON_READER.createReader(req.getInputStream())) {
                requestBody = reader.readObject();
            }

            String issuerUrl = requestBody.getString("issuerUrl", "");
            if (issuerUrl.isBlank()) {
                sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Missing required field: issuerUrl");
                return;
            }

            // SSRF protection
            Set<String> allowedHosts = resolveAllowedIssuerHosts(processorId, req);
            if (!isAllowedTokenEndpointHost(issuerUrl, allowedHosts)) {
                LOGGER.warn(UILogMessages.WARN.GATEWAY_TOKEN_FETCH_SSRF_BLOCKED, issuerUrl);
                sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Issuer host not allowed");
                return;
            }

            // Normalize issuer URL and build well-known endpoint
            String normalizedIssuer = issuerUrl.endsWith("/")
                    ? issuerUrl.substring(0, issuerUrl.length() - 1) : issuerUrl;
            String discoveryUrl = normalizedIssuer
                    + "/.well-known/openid-configuration";

            IdpResponse idpResp = executeIdpRequest(discoveryUrl, "GET",
                    null, null);

            if (idpResp.statusCode() != 200 || idpResp.body() == null) {
                sendErrorResponse(resp, HttpServletResponse.SC_BAD_GATEWAY,
                        "OIDC discovery failed (HTTP " + idpResp.statusCode() + ")");
                return;
            }

            try (var jsonReader = JSON_READER.createReader(
                         new StringReader(idpResp.body()))) {
                JsonObject discoveryDoc = jsonReader.readObject();
                String tokenEndpoint = discoveryDoc.getString(
                        "token_endpoint", "");
                if (tokenEndpoint.isBlank()) {
                    sendErrorResponse(resp, HttpServletResponse.SC_BAD_GATEWAY,
                            "No token_endpoint in discovery document");
                    return;
                }

                JsonObject result = Json.createObjectBuilder()
                        .add("tokenEndpoint", tokenEndpoint)
                        .build();
                writeJsonResponse(resp, HttpServletResponse.SC_OK, result);
            }
        } catch (JsonException e) {
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                    MSG_INVALID_JSON);
        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.GATEWAY_OIDC_DISCOVERY_FAILED,
                    e.getMessage());
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_GATEWAY,
                    "OIDC discovery failed");
        }
    }

    /**
     * Builds the URL-encoded form body for the token request.
     */
    private static String buildTokenFormBody(JsonObject requestBody, String grantType,
            String clientId, String clientSecret, String scope) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("grant_type", grantType);
        params.put("client_id", clientId);
        if (!clientSecret.isBlank()) {
            params.put("client_secret", clientSecret);
        }
        if (GRANT_TYPE_PASSWORD.equals(grantType)) {
            params.put(KEY_USERNAME, requestBody.getString(KEY_USERNAME, ""));
            params.put(KEY_PASSWORD, requestBody.getString(KEY_PASSWORD, ""));
        }
        if (!scope.isBlank()) {
            params.put("scope", scope);
        }
        return params.entrySet().stream()
                .map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8)
                        + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
    }

    /**
     * Parses the IDP token response and adds fields to the result builder.
     */
    private static void parseTokenResponse(IdpResponse idpResp, JsonObjectBuilder result) {
        if (idpResp.statusCode() == 200 && idpResp.body() != null) {
            try (var jsonReader = JSON_READER.createReader(
                         new StringReader(idpResp.body()))) {
                JsonObject tokenResponse = jsonReader.readObject();
                if (tokenResponse.containsKey(KEY_ACCESS_TOKEN)) {
                    result.add(KEY_ACCESS_TOKEN,
                            tokenResponse.getString(KEY_ACCESS_TOKEN));
                }
                if (tokenResponse.containsKey(KEY_EXPIRES_IN)) {
                    result.add(KEY_EXPIRES_IN,
                            tokenResponse.getInt(KEY_EXPIRES_IN));
                }
            }
        } else {
            result.add("error",
                    "Token request failed (HTTP " + idpResp.statusCode() + ")");
        }
    }

    /**
     * Resolves the set of allowed hosts for token endpoint SSRF protection.
     * Extracts hosts from configured issuer URLs in the linked controller service,
     * plus localhost variants.
     */
    Set<String> resolveAllowedIssuerHosts(String processorId,
            HttpServletRequest request) throws IOException {
        Set<String> hosts = new HashSet<>();
        // Always allow localhost
        hosts.add("localhost");
        hosts.add("127.0.0.1");
        hosts.add("::1");

        try {
            Map<String, String> processorProps = resolveProcessorProperties(
                    processorId, request);

            // Find CS reference property
            String csId = null;
            for (String key : ComponentConfigReader.CONTROLLER_SERVICE_PROPERTY_KEYS) {
                String value = processorProps.get(key);
                if (value != null && !value.isBlank()) {
                    csId = value;
                    break;
                }
            }

            if (csId != null) {
                Map<String, String> csProps =
                        resolveControllerServiceProperties(csId, request);
                // Extract hosts from issuer.*.issuer properties
                for (Map.Entry<String, String> entry : csProps.entrySet()) {
                    if (entry.getKey().endsWith(ISSUER_PROPERTY_SUFFIX)
                            && entry.getValue() != null
                            && !entry.getValue().isBlank()) {
                        extractHost(entry.getValue(), hosts);
                    }
                }
            }
        } catch (IOException e) {
            LOGGER.warn(e, "Failed to resolve issuer hosts for SSRF check: %s",
                    e.getMessage());
        }

        return hosts;
    }

    /**
     * Resolves controller service properties for the given CS ID.
     * Overridable for testing.
     */
    protected Map<String, String> resolveControllerServiceProperties(
            String csId, HttpServletRequest request) {
        var reader = new ComponentConfigReader(configContext);
        return reader.getControllerServicePropertiesViaRest(csId, request);
    }

    private static void extractHost(String urlString, Set<String> hosts) {
        try {
            URI uri = URI.create(urlString);
            String host = uri.getHost();
            if (host != null && !host.isBlank()) {
                hosts.add(host.toLowerCase(Locale.ROOT));
            }
        } catch (IllegalArgumentException e) {
            LOGGER.warn("Malformed issuer URL, skipping for host extraction: %s",
                    urlString);
        }
    }

    static boolean isAllowedTokenEndpointHost(String url, Set<String> allowedHosts) {
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            if (host == null) return false;
            return allowedHosts.contains(host.toLowerCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    /** IDP response wrapper (token endpoint or OIDC discovery). */
    record IdpResponse(int statusCode, String body) {
    }

    /** Gateway GET response wrapper (status code + body). */
    record GatewayGetResponse(int statusCode, String body) {
    }

    /** Gateway response wrapper for the /test endpoint. */
    record GatewayResponse(int statusCode, String body, Map<String, String> headers) {
    }

    /**
     * Safely parses a property value as an integer, falling back to a default
     * when the value is null, blank, or not a valid number.
     */
    private static int safeParseInt(Map<String, String> props, String key, int defaultValue) {
        String value = props.get(key);
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(value.strip());
        } catch (NumberFormatException e) {
            LOGGER.warn("Invalid non-numeric value for '%s': '%s', using default %s", key, value, defaultValue);
            return defaultValue;
        }
    }

    /**
     * Builds and writes the /config JSON response from processor properties,
     * merging in any routes from the external configuration file.
     */
    private void writeConfigResponse(HttpServletResponse resp, Map<String, String> props,
            String componentClass) throws IOException {
        JsonObjectBuilder root = Json.createObjectBuilder();
        root.add("component", componentClass);
        root.add("port", safeParseInt(props, GATEWAY_PORT_PROPERTY, 9443));
        root.add("maxRequestBodySize", safeParseInt(props, MAX_REQUEST_SIZE_PROPERTY, 1048576));
        root.add("queueSize", safeParseInt(props, QUEUE_SIZE_PROPERTY, 50));
        root.add("ssl", props.get(SSL_CONTEXT_SERVICE_PROPERTY) != null
                && !props.get(SSL_CONTEXT_SERVICE_PROPERTY).isBlank());

        // Listening host
        String host = props.get(LISTENING_HOST_PROPERTY);
        if (host != null && !host.isBlank()) {
            root.add("listeningHost", host);
        }

        root.add("attachmentsHardLimit", safeParseInt(props, ATTACHMENTS_HARD_LIMIT_PROPERTY, 20));
        root.add("managementEndpoints", buildManagementEndpointsArray(props));

        // Merge external config routes with NiFi processor routes
        Map<String, String> externalRouteProps = loadExternalRouteProperties();
        root.add("externalConfigLoaded", !externalRouteProps.isEmpty());
        root.add("routes", buildMergedRoutesArray(externalRouteProps, props));

        resp.setContentType(CONTENT_TYPE_JSON);
        resp.setCharacterEncoding(CHARSET_UTF8);
        resp.setStatus(HttpServletResponse.SC_OK);
        try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
            writer.writeObject(root.build());
        }
    }

    /**
     * Loads route properties ({@code restapi.*}) from the external configuration file.
     */
    protected Map<String, String> loadExternalRouteProperties() {
        var configManager = createConfigurationManager();
        if (!configManager.isConfigurationLoaded()) {
            return Map.of();
        }
        Map<String, String> routeProps = new HashMap<>();
        for (Map.Entry<String, String> entry : configManager.getStaticProperties().entrySet()) {
            if (entry.getKey().startsWith(ROUTE_PREFIX)) {
                routeProps.put(entry.getKey(), entry.getValue());
            }
        }
        return routeProps;
    }

    /**
     * Creates a ConfigurationManager instance. Overridable for testing.
     */
    protected ConfigurationManager createConfigurationManager() {
        return new ConfigurationManager();
    }

    /**
     * Builds a merged routes array from external config and NiFi processor properties.
     * Routes present in both sources get source "both"; NiFi properties override external values.
     */
    static JsonArrayBuilder buildMergedRoutesArray(Map<String, String> externalProps,
            Map<String, String> nifiProps) {
        Set<String> externalRouteNames = extractRouteNames(externalProps);
        Set<String> nifiRouteNames = extractRouteNames(nifiProps);

        // Merge: NiFi props override external props for the same key
        Map<String, String> mergedProps = new HashMap<>(externalProps);
        mergedProps.putAll(nifiProps);

        JsonArrayBuilder routesArray = Json.createArrayBuilder();
        Map<String, Map<String, String>> routeGroups = groupRouteProperties(mergedProps);

        for (Map.Entry<String, Map<String, String>> routeEntry : routeGroups.entrySet()) {
            String routeName = routeEntry.getKey();
            Map<String, String> routeProps = routeEntry.getValue();
            String path = routeProps.get("path");
            if (path == null || path.isBlank()) {
                continue;
            }

            // Determine source
            boolean inExternal = externalRouteNames.contains(routeName);
            boolean inNifi = nifiRouteNames.contains(routeName);
            String source;
            if (inExternal && inNifi) {
                source = "both";
            } else if (inExternal) {
                source = "external";
            } else {
                source = "nifi";
            }

            JsonObjectBuilder routeObj = buildRouteObject(routeName, routeProps);
            routeObj.add("source", source);
            routesArray.add(routeObj);
        }
        return routesArray;
    }

    private static Set<String> extractRouteNames(Map<String, String> props) {
        Set<String> names = new HashSet<>();
        for (String key : props.keySet()) {
            if (key.startsWith(ROUTE_PREFIX)) {
                String remainder = key.substring(ROUTE_PREFIX.length());
                int dot = remainder.indexOf('.');
                if (dot > 0) {
                    names.add(remainder.substring(0, dot));
                }
            }
        }
        return names;
    }

    private static Map<String, Map<String, String>> groupRouteProperties(Map<String, String> props) {
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
        return routeGroups;
    }

    private static JsonObjectBuilder buildRouteObject(String routeName, Map<String, String> routeProps) {
        JsonObjectBuilder routeObj = Json.createObjectBuilder();
        routeObj.add("name", routeName);
        routeObj.add("path", routeProps.get("path"));
        routeObj.add(KEY_ENABLED, !FALSE_STRING.equalsIgnoreCase(
                routeProps.getOrDefault(KEY_ENABLED, "true")));
        routeObj.add(KEY_METHODS, buildStringArray(routeProps.get(KEY_METHODS)));
        routeObj.add(KEY_REQUIRED_ROLES, buildStringArray(routeProps.get("required-roles")));
        routeObj.add(KEY_REQUIRED_SCOPES, buildStringArray(routeProps.get("required-scopes")));
        addNonBlankString(routeObj, "schema", routeProps.get("schema"));
        addSuccessOutcome(routeObj, routeName, routeProps);
        routeObj.add("createFlowFile", !FALSE_STRING.equalsIgnoreCase(
                routeProps.getOrDefault("create-flowfile", "true")));
        routeObj.add(KEY_AUTH_MODE, routeProps.getOrDefault("auth-mode", "bearer"));
        addOptionalInt(routeObj, "maxRequestSize", routeProps.get("max-request-size"));
        routeObj.add("trackingMode", routeProps.getOrDefault("tracking-mode", "none"));
        addOptionalInt(routeObj, "attachmentsMinCount", routeProps.get("attachments-min-count"));
        addOptionalInt(routeObj, "attachmentsMaxCount", routeProps.get("attachments-max-count"));
        return routeObj;
    }

    private static void addSuccessOutcome(JsonObjectBuilder routeObj, String routeName,
            Map<String, String> routeProps) {
        String successOutcome = routeProps.get("success-outcome");
        if (successOutcome != null && !successOutcome.isBlank()) {
            routeObj.add("successOutcome", successOutcome);
        } else if (!FALSE_STRING.equalsIgnoreCase(routeProps.getOrDefault("create-flowfile", "true"))) {
            routeObj.add("successOutcome", routeName);
        }
    }

    private static void addNonBlankString(JsonObjectBuilder obj, String key, String value) {
        if (value != null && !value.isBlank()) {
            obj.add(key, value);
        }
    }

    private static void addOptionalInt(JsonObjectBuilder obj, String key, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        try {
            obj.add(key, Integer.parseInt(value.strip()));
        } catch (NumberFormatException e) {
            LOGGER.warn("Ignoring invalid non-numeric %s value: '%s'", key, value);
        }
    }

    /**
     * Null-safe property lookup. Returns the default when the value is null or absent.
     * {@code Map.getOrDefault} returns null when the key exists with a null value;
     * Jakarta JSON's {@code JsonObjectBuilder.add(String, null)} throws NPE.
     */
    private static String prop(Map<String, String> props, String key, String defaultValue) {
        String value = props.get(key);
        return value != null ? value : defaultValue;
    }

    private static JsonArrayBuilder buildManagementEndpointsArray(Map<String, String> props) {
        JsonArrayBuilder mgmtArray = Json.createArrayBuilder();
        mgmtArray.add(buildManagementEndpoint("health", "/health", "GET", props,
                HEALTH_ENABLED_PROPERTY, HEALTH_AUTH_MODE_PROPERTY,
                HEALTH_REQUIRED_ROLES_PROPERTY, HEALTH_REQUIRED_SCOPES_PROPERTY));
        mgmtArray.add(buildManagementEndpoint("metrics", "/metrics", "GET", props,
                METRICS_ENABLED_PROPERTY, METRICS_AUTH_MODE_PROPERTY,
                METRICS_REQUIRED_ROLES_PROPERTY, METRICS_REQUIRED_SCOPES_PROPERTY));
        mgmtArray.add(buildManagementEndpoint("status", "/status/{traceId}", "GET", props,
                STATUS_ENABLED_PROPERTY, STATUS_AUTH_MODE_PROPERTY,
                STATUS_REQUIRED_ROLES_PROPERTY, STATUS_REQUIRED_SCOPES_PROPERTY));
        mgmtArray.add(buildManagementEndpoint("attachments", "/attachments/{parentTraceId}", "POST", props,
                ATTACHMENTS_ENABLED_PROPERTY, ATTACHMENTS_AUTH_MODE_PROPERTY,
                ATTACHMENTS_REQUIRED_ROLES_PROPERTY, ATTACHMENTS_REQUIRED_SCOPES_PROPERTY));
        return mgmtArray;
    }

    private static JsonObjectBuilder buildManagementEndpoint(String name, String path, String method,
            Map<String, String> props, String enabledKey, String authModeKey,
            String rolesKey, String scopesKey) {
        JsonObjectBuilder endpoint = Json.createObjectBuilder();
        endpoint.add("name", name);
        endpoint.add("path", path);
        endpoint.add(KEY_METHODS, Json.createArrayBuilder().add(method));
        endpoint.add(KEY_ENABLED, !FALSE_STRING.equalsIgnoreCase(prop(props, enabledKey, "true")));
        endpoint.add(KEY_AUTH_MODE, prop(props, authModeKey, DEFAULT_AUTH_MODE));
        endpoint.add(KEY_REQUIRED_ROLES, prop(props, rolesKey, ""));
        endpoint.add(KEY_REQUIRED_SCOPES, prop(props, scopesKey, ""));
        endpoint.add(KEY_BUILT_IN, true);
        return endpoint;
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

    private void writeJsonResponse(HttpServletResponse resp, int status, JsonObject json) {
        try {
            resp.setStatus(status);
            resp.setContentType(CONTENT_TYPE_JSON);
            resp.setCharacterEncoding(CHARSET_UTF8);
            try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
                writer.writeObject(json);
            }
        } catch (IOException e) {
            LOGGER.warn("Failed to write JSON response (status %s): %s",
                    status, e.getMessage());
        }
    }

    private void sendErrorResponse(HttpServletResponse resp, int status, String message) {
        try {
            resp.setStatus(status);
            resp.setContentType(CONTENT_TYPE_JSON);
            resp.setCharacterEncoding(CHARSET_UTF8);

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
