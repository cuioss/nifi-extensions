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
import de.cuioss.nifi.rest.config.AuthMode;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import jakarta.json.Json;
import jakarta.json.JsonObjectBuilder;
import org.eclipse.jetty.http.HttpHeader;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import org.jspecify.annotations.Nullable;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Built-in handler for the {@code /metrics} management endpoint.
 * <p>
 * Aggregates metrics from three sources:
 * <ol>
 *   <li>Token validation events (oauth-sheriff)</li>
 *   <li>HTTP security events (cui-http)</li>
 *   <li>Application-level gateway events ({@link GatewaySecurityEvents})</li>
 * </ol>
 * <p>
 * Supports Prometheus (default) and JSON ({@code Accept: application/json}) output formats.
 */
public class MetricsEndpointHandler extends AbstractManagementHandler {

    static final String METRICS_PATH = "/metrics";
    private static final String PROMETHEUS_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";
    private static final String JSON_CONTENT_TYPE = "application/json";

    private final JwtIssuerConfigService configService;
    private final SecurityEventCounter httpSecurityEvents;
    private final GatewaySecurityEvents gatewaySecurityEvents;

    public MetricsEndpointHandler(JwtIssuerConfigService configService,
            SecurityEventCounter httpSecurityEvents,
            GatewaySecurityEvents gatewaySecurityEvents,
            boolean enabled,
            Set<AuthMode> authModes,
            Set<String> requiredRoles, Set<String> requiredScopes) {
        super(enabled, authModes, requiredRoles, requiredScopes);
        this.configService = configService;
        this.httpSecurityEvents = httpSecurityEvents;
        this.gatewaySecurityEvents = gatewaySecurityEvents;
    }

    @Override
    public String name() {
        return "metrics";
    }

    @Override
    public String path() {
        return METRICS_PATH;
    }

    @Override
    public void process(SanitizedRequest sanitized,
            @Nullable AccessTokenContent token,
            byte[] body,
            Request request, Response response, Callback callback) {
        String accept = request.getHeaders().get("Accept");
        if (accept != null && accept.contains(JSON_CONTENT_TYPE)) {
            writeJsonMetrics(response, callback);
        } else {
            writePrometheusMetrics(response, callback);
        }
    }

    // -----------------------------------------------------------------------
    // Prometheus format
    // -----------------------------------------------------------------------

    private void writePrometheusMetrics(Response response, Callback callback) {
        StringBuilder sb = new StringBuilder();
        appendTokenValidationMetrics(sb);
        appendHttpSecurityMetrics(sb);
        appendGatewayEventMetrics(sb);
        sendResponse(response, callback, PROMETHEUS_CONTENT_TYPE, sb.toString());
    }

    @SuppressWarnings("java:S3457") // Prometheus text format requires literal \n, not platform-dependent %n
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

    // -----------------------------------------------------------------------
    // JSON format
    // -----------------------------------------------------------------------

    private void writeJsonMetrics(Response response, Callback callback) {
        JsonObjectBuilder root = Json.createObjectBuilder();

        JsonObjectBuilder tokenMetrics = Json.createObjectBuilder();
        configService.getSecurityEventCounter().ifPresent(counter -> {
            for (var entry : counter.getCounters().entrySet()) {
                tokenMetrics.add(entry.getKey().name().toLowerCase(), entry.getValue());
            }
        });
        root.add("tokenValidation", tokenMetrics);

        JsonObjectBuilder httpMetrics = Json.createObjectBuilder();
        for (var entry : httpSecurityEvents.getAllCounts().entrySet()) {
            httpMetrics.add(entry.getKey().name().toLowerCase(), entry.getValue());
        }
        root.add("httpSecurity", httpMetrics);

        JsonObjectBuilder gwMetrics = Json.createObjectBuilder();
        for (var entry : gatewaySecurityEvents.getAllCounts().entrySet()) {
            gwMetrics.add(entry.getKey().name(), entry.getValue());
        }
        root.add("gatewayEvents", gwMetrics);

        sendResponse(response, callback, JSON_CONTENT_TYPE, root.build().toString());
    }

    // -----------------------------------------------------------------------
    // Response helper
    // -----------------------------------------------------------------------

    private static void sendResponse(Response response, Callback callback,
            String contentType, String body) {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        response.setStatus(200);
        response.getHeaders().put(HttpHeader.CONTENT_TYPE, contentType);
        response.getHeaders().put(HttpHeader.CONTENT_LENGTH, bytes.length);
        response.write(true, ByteBuffer.wrap(bytes), callback);
    }
}
