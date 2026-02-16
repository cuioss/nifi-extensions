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
import de.cuioss.nifi.jwt.config.JwtIssuerConfigService;
import de.cuioss.nifi.rest.config.RouteConfiguration;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.Json;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonObjectBuilder;
import org.eclipse.jetty.http.HttpHeader;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Handles reserved management endpoints ({@code /metrics}, {@code /config})
 * on the gateway's embedded Jetty server.
 * <p>
 * These endpoints bypass the authentication and authorization pipeline —
 * they are intended for internal consumption by the NiFi UI WAR's
 * {@code GatewayProxyServlet} and external monitoring tools (Prometheus).
 * <p>
 * Metrics are aggregated from three sources:
 * <ol>
 *   <li>{@code de.cuioss.sheriff.oauth.core.security.SecurityEventCounter} — token validation events</li>
 *   <li>{@code de.cuioss.http.security.monitoring.SecurityEventCounter} — transport security events</li>
 *   <li>{@link GatewaySecurityEvents} — application-level gateway events</li>
 * </ol>
 */
public class ManagementEndpointHandler {

    private static final CuiLogger LOGGER = new CuiLogger(ManagementEndpointHandler.class);

    static final String METRICS_PATH = "/metrics";
    static final String CONFIG_PATH = "/config";

    private static final String PROMETHEUS_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";
    private static final String JSON_CONTENT_TYPE = "application/json";
    private static final String ACCEPT_HEADER = "Accept";

    private final List<RouteConfiguration> routes;
    private final JwtIssuerConfigService configService;
    private final SecurityEventCounter httpSecurityEvents;
    private final GatewaySecurityEvents gatewaySecurityEvents;
    private final int port;
    private final int maxRequestSize;
    private final int queueSize;
    private final boolean sslEnabled;
    private final Set<String> corsAllowedOrigins;

    /**
     * Creates a new management endpoint handler.
     *
     * @param routes              configured routes
     * @param configService       JWT issuer config service (for token validation metrics)
     * @param httpSecurityEvents  cui-http transport security event counter
     * @param gatewaySecurityEvents application-level gateway security events
     * @param port                listening port
     * @param maxRequestSize      max request body size
     * @param queueSize           request queue size
     * @param sslEnabled          whether SSL is enabled
     * @param corsAllowedOrigins  configured CORS origins
     */
    public ManagementEndpointHandler(
            List<RouteConfiguration> routes,
            JwtIssuerConfigService configService,
            SecurityEventCounter httpSecurityEvents,
            GatewaySecurityEvents gatewaySecurityEvents,
            int port,
            int maxRequestSize,
            int queueSize,
            boolean sslEnabled,
            Set<String> corsAllowedOrigins) {
        this.routes = List.copyOf(routes);
        this.configService = configService;
        this.httpSecurityEvents = httpSecurityEvents;
        this.gatewaySecurityEvents = gatewaySecurityEvents;
        this.port = port;
        this.maxRequestSize = maxRequestSize;
        this.queueSize = queueSize;
        this.sslEnabled = sslEnabled;
        this.corsAllowedOrigins = Set.copyOf(corsAllowedOrigins);
    }

    /**
     * Checks if the given path is a reserved management endpoint and handles it.
     *
     * @param path     the request path
     * @param method   the HTTP method
     * @param accept   the Accept header value (may be null)
     * @param response the Jetty response
     * @param callback the Jetty callback
     * @return {@code true} if the path was a management endpoint (response was sent),
     *         {@code false} if the path should be processed by the normal pipeline
     */
    public boolean handleIfManagement(String path, String method, String accept,
                                      Response response, Callback callback) {
        if (!isManagementPath(path)) {
            return false;
        }
        if (!"GET".equalsIgnoreCase(method)) {
            sendMethodNotAllowed(response, callback);
            return true;
        }
        if (METRICS_PATH.equals(path)) {
            LOGGER.debug("Serving management endpoint: /metrics");
            writeMetricsResponse(response, callback, accept);
        } else {
            LOGGER.debug("Serving management endpoint: /config");
            writeConfigResponse(response, callback);
        }
        return true;
    }

    /**
     * Returns whether the given path is a reserved management path.
     */
    public static boolean isManagementPath(String path) {
        return METRICS_PATH.equals(path) || CONFIG_PATH.equals(path);
    }

    // -----------------------------------------------------------------------
    // /metrics endpoint
    // -----------------------------------------------------------------------

    private void writeMetricsResponse(Response response, Callback callback, String accept) {
        if (accept != null && accept.contains(JSON_CONTENT_TYPE)) {
            writeJsonMetrics(response, callback);
        } else {
            writePrometheusMetrics(response, callback);
        }
    }

    private void writePrometheusMetrics(Response response, Callback callback) {
        StringBuilder sb = new StringBuilder();

        // 1. Token validation events (oauth-sheriff)
        appendTokenValidationMetrics(sb);

        // 2. HTTP security events (cui-http)
        appendHttpSecurityMetrics(sb);

        // 3. Gateway application events
        appendGatewayEventMetrics(sb);

        sendResponse(response, callback, PROMETHEUS_CONTENT_TYPE, sb.toString());
    }

    private void appendTokenValidationMetrics(StringBuilder sb) {
        var counter = configService.getSecurityEventCounter();
        if (counter.isEmpty()) {
            sb.append("# HELP nifi_jwt_validations_total Token validation events (oauth-sheriff)\n");
            sb.append("# TYPE nifi_jwt_validations_total counter\n\n");
            return;
        }
        var counts = counter.get().getCounters();
        sb.append("# HELP nifi_jwt_validations_total Token validation events (oauth-sheriff)\n");
        sb.append("# TYPE nifi_jwt_validations_total counter\n");
        for (var entry : counts.entrySet()) {
            sb.append("nifi_jwt_validations_total{result=\"%s\"} %d\n"
                    .formatted(entry.getKey().name().toLowerCase(), entry.getValue()));
        }
        sb.append('\n');
    }

    private void appendHttpSecurityMetrics(StringBuilder sb) {
        var counts = httpSecurityEvents.getAllCounts();
        sb.append("# HELP nifi_gateway_http_security_events_total Transport-level security events (cui-http)\n");
        sb.append("# TYPE nifi_gateway_http_security_events_total counter\n");
        if (counts.isEmpty()) {
            sb.append("nifi_gateway_http_security_events_total 0\n");
        } else {
            for (var entry : counts.entrySet()) {
                sb.append("nifi_gateway_http_security_events_total{type=\"%s\"} %d\n"
                        .formatted(entry.getKey().name().toLowerCase(), entry.getValue()));
            }
        }
        sb.append('\n');
    }

    private void appendGatewayEventMetrics(StringBuilder sb) {
        var counts = gatewaySecurityEvents.getAllCounts();
        sb.append("# HELP nifi_gateway_events_total Application-level gateway events\n");
        sb.append("# TYPE nifi_gateway_events_total counter\n");
        if (counts.isEmpty()) {
            sb.append("nifi_gateway_events_total 0\n");
        } else {
            for (var entry : counts.entrySet()) {
                sb.append("nifi_gateway_events_total{type=\"")
                        .append(entry.getKey().name().toLowerCase())
                        .append("\"} ").append(entry.getValue()).append('\n');
            }
        }
        sb.append('\n');
    }

    private void writeJsonMetrics(Response response, Callback callback) {
        JsonObjectBuilder root = Json.createObjectBuilder();

        // Token validation
        JsonObjectBuilder tokenMetrics = Json.createObjectBuilder();
        configService.getSecurityEventCounter().ifPresent(counter -> {
            for (var entry : counter.getCounters().entrySet()) {
                tokenMetrics.add(entry.getKey().name().toLowerCase(), entry.getValue());
            }
        });
        root.add("tokenValidation", tokenMetrics);

        // HTTP security
        JsonObjectBuilder httpMetrics = Json.createObjectBuilder();
        for (var entry : httpSecurityEvents.getAllCounts().entrySet()) {
            httpMetrics.add(entry.getKey().name().toLowerCase(), entry.getValue());
        }
        root.add("httpSecurity", httpMetrics);

        // Gateway events
        JsonObjectBuilder gwMetrics = Json.createObjectBuilder();
        for (var entry : gatewaySecurityEvents.getAllCounts().entrySet()) {
            gwMetrics.add(entry.getKey().name(), entry.getValue());
        }
        root.add("gatewayEvents", gwMetrics);

        sendResponse(response, callback, JSON_CONTENT_TYPE, root.build().toString());
    }

    // -----------------------------------------------------------------------
    // /config endpoint
    // -----------------------------------------------------------------------

    private void writeConfigResponse(Response response, Callback callback) {
        JsonObjectBuilder root = Json.createObjectBuilder();
        root.add("component", "RestApiGatewayProcessor");
        root.add("port", port);
        root.add("maxRequestBodySize", maxRequestSize);
        root.add("queueSize", queueSize);
        root.add("ssl", sslEnabled);

        // CORS origins
        JsonArrayBuilder originsArray = Json.createArrayBuilder();
        for (String origin : corsAllowedOrigins) {
            originsArray.add(origin);
        }
        root.add("corsAllowedOrigins", originsArray);

        // Routes
        JsonArrayBuilder routesArray = Json.createArrayBuilder();
        for (RouteConfiguration route : routes) {
            JsonObjectBuilder routeObj = Json.createObjectBuilder();
            routeObj.add("name", route.name());
            routeObj.add("path", route.path());

            JsonArrayBuilder methods = Json.createArrayBuilder();
            for (String m : route.methods()) {
                methods.add(m);
            }
            routeObj.add("methods", methods);

            JsonArrayBuilder roles = Json.createArrayBuilder();
            for (String r : route.requiredRoles()) {
                roles.add(r);
            }
            routeObj.add("requiredRoles", roles);

            JsonArrayBuilder scopes = Json.createArrayBuilder();
            for (String s : route.requiredScopes()) {
                scopes.add(s);
            }
            routeObj.add("requiredScopes", scopes);

            routesArray.add(routeObj);
        }
        root.add("routes", routesArray);

        sendResponse(response, callback, JSON_CONTENT_TYPE, root.build().toString());
    }

    // -----------------------------------------------------------------------
    // Response helpers
    // -----------------------------------------------------------------------

    private static void sendResponse(Response response, Callback callback,
                                     String contentType, String body) {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        response.setStatus(200);
        response.getHeaders().put(HttpHeader.CONTENT_TYPE, contentType);
        response.getHeaders().put(HttpHeader.CONTENT_LENGTH, bytes.length);
        response.write(true, ByteBuffer.wrap(bytes), callback);
    }

    private static void sendMethodNotAllowed(Response response, Callback callback) {
        ProblemDetail problem = ProblemDetail.methodNotAllowed(
                "Management endpoints only support GET");
        byte[] body = problem.toJson().getBytes(StandardCharsets.UTF_8);
        response.setStatus(405);
        response.getHeaders().put("Allow", "GET");
        response.getHeaders().put(HttpHeader.CONTENT_TYPE, ProblemDetail.CONTENT_TYPE);
        response.getHeaders().put(HttpHeader.CONTENT_LENGTH, body.length);
        response.write(true, ByteBuffer.wrap(body), callback);
    }
}
