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
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.Json;
import jakarta.json.JsonObjectBuilder;
import org.eclipse.jetty.http.HttpHeader;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import org.jspecify.annotations.Nullable;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

/**
 * Handles the reserved {@code /metrics} management endpoint on the gateway's
 * embedded Jetty server.
 * <p>
 * This endpoint bypasses the authentication and authorization pipeline —
 * it is intended for external monitoring tools (Prometheus) and the NiFi UI WAR's
 * {@code GatewayProxyServlet}.
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

    private static final String PROMETHEUS_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";
    private static final String JSON_CONTENT_TYPE = "application/json";
    private static final String API_KEY_HEADER = "X-Api-Key";

    private final JwtIssuerConfigService configService;
    private final SecurityEventCounter httpSecurityEvents;
    private final GatewaySecurityEvents gatewaySecurityEvents;
    @Nullable private final String managementApiKey;

    /**
     * Creates a new management endpoint handler.
     *
     * @param configService         JWT issuer config service (for token validation metrics)
     * @param httpSecurityEvents    cui-http transport security event counter
     * @param gatewaySecurityEvents application-level gateway security events
     * @param managementApiKey      API key for management endpoint auth, or {@code null} to allow unauthenticated access
     */
    public ManagementEndpointHandler(
            JwtIssuerConfigService configService,
            SecurityEventCounter httpSecurityEvents,
            GatewaySecurityEvents gatewaySecurityEvents,
            @Nullable String managementApiKey) {
        this.configService = configService;
        this.httpSecurityEvents = httpSecurityEvents;
        this.gatewaySecurityEvents = gatewaySecurityEvents;
        this.managementApiKey = managementApiKey;
    }

    /**
     * Checks if the given path is a reserved management endpoint and handles it.
     *
     * @param path     the request path
     * @param method   the HTTP method
     * @param accept   the Accept header value (may be null)
     * @param request  the Jetty request (used to read API key header)
     * @param response the Jetty response
     * @param callback the Jetty callback
     * @return {@code true} if the path was a management endpoint (response was sent),
     *         {@code false} if the path should be processed by the normal pipeline
     */
    public boolean handleIfManagement(String path, String method, String accept,
                                      Request request, Response response, Callback callback) {
        if (!METRICS_PATH.equals(path)) {
            return false;
        }
        if (managementApiKey != null && !managementApiKey.isEmpty()) {
            String providedKey = request.getHeaders().get(API_KEY_HEADER);
            if (!managementApiKey.equals(providedKey)) {
                LOGGER.debug("Management endpoint access denied — invalid or missing API key");
                sendUnauthorized(response, callback);
                return true;
            }
        }
        if (!"GET".equalsIgnoreCase(method)) {
            sendMethodNotAllowed(response, callback);
            return true;
        }
        LOGGER.debug("Serving management endpoint: /metrics");
        writeMetricsResponse(response, callback, accept);
        return true;
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

    private static void sendUnauthorized(Response response, Callback callback) {
        ProblemDetail problem = ProblemDetail.unauthorized(
                "Valid API key required in X-Api-Key header");
        byte[] body = problem.toJson().getBytes(StandardCharsets.UTF_8);
        response.setStatus(401);
        response.getHeaders().put(HttpHeader.CONTENT_TYPE, ProblemDetail.CONTENT_TYPE);
        response.getHeaders().put(HttpHeader.CONTENT_LENGTH, body.length);
        response.write(true, ByteBuffer.wrap(body), callback);
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
