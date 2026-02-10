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
import de.cuioss.nifi.ui.service.SecurityMetricsStore;
import de.cuioss.nifi.ui.service.SecurityMetricsStore.ErrorCount;
import de.cuioss.nifi.ui.service.SecurityMetricsStore.IssuerMetricsEntry;
import de.cuioss.nifi.ui.service.SecurityMetricsStore.MetricsSnapshot;
import de.cuioss.tools.concurrent.StripedRingBufferStatistics;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.Json;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonObject;
import jakarta.json.JsonWriterFactory;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

/**
 * Servlet for retrieving JWT authentication security metrics.
 * This servlet provides a REST endpoint for accessing security metrics
 * related to JWT token validation.
 *
 * Endpoint: /nifi-api/processors/jwt/metrics
 * Method: GET
 *
 * Response format:
 * {
 *   "totalTokensValidated": 1250,
 *   "validTokens": 1180,
 *   "invalidTokens": 70,
 *   "errorRate": 0.056,
 *   "lastValidation": "2025-01-27T10:30:00Z",
 *   "topErrors": [
 *     {"error": "Token expired", "count": 45},
 *     {"error": "Invalid signature", "count": 25}
 *   ]
 * }
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/observability.adoc">Observability Specification</a>
 */
public class MetricsServlet extends HttpServlet {

    private static final CuiLogger LOGGER = new CuiLogger(MetricsServlet.class);
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException {

        LOGGER.debug("Received metrics request");

        try {
            // Collect current metrics from the centralized store
            MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();

            // Build JSON response
            JsonObject responseJson = buildMetricsResponse(snapshot);

            // Send response
            resp.setContentType("application/json");
            resp.setCharacterEncoding("UTF-8");
            resp.setStatus(200);

            try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
                writer.writeObject(responseJson);
                LOGGER.debug("Sent metrics response");
            }

        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.ERROR_WRITING_METRICS);
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        } catch (IllegalStateException e) {
            LOGGER.error(e, UILogMessages.ERROR.ERROR_COLLECTING_METRICS);
            try {
                sendErrorResponse(resp, 500, "Error collecting metrics");
            } catch (IOException ioException) {
                LOGGER.error(ioException, UILogMessages.ERROR.FAILED_SEND_METRICS_ERROR);
                resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            }
        }
    }

    /**
     * Builds the JSON response for metrics.
     */
    private JsonObject buildMetricsResponse(MetricsSnapshot snapshot) {
        JsonArrayBuilder topErrorsBuilder = Json.createArrayBuilder();

        for (ErrorCount errorCount : snapshot.topErrors()) {
            JsonObject errorObj = Json.createObjectBuilder()
                    .add("error", errorCount.error())
                    .add("count", errorCount.count())
                    .build();
            topErrorsBuilder.add(errorObj);
        }

        // Performance metrics from real TokenValidatorMonitor statistics
        long avgResponseTime = 0;
        long minResponseTime = 0;
        long maxResponseTime = 0;
        long p95ResponseTime = 0;

        StripedRingBufferStatistics stats = snapshot.validationStatistics();
        if (stats != null && stats.sampleCount() > 0) {
            avgResponseTime = stats.p50().toMillis();
            minResponseTime = stats.p50().toMillis();
            maxResponseTime = stats.p99().toMillis();
            p95ResponseTime = stats.p95().toMillis();
        }

        JsonArrayBuilder issuerMetricsBuilder = Json.createArrayBuilder();
        for (IssuerMetricsEntry entry : snapshot.issuerMetrics()) {
            issuerMetricsBuilder.add(Json.createObjectBuilder()
                    .add("name", entry.name())
                    .add("totalRequests", entry.totalRequests())
                    .add("successCount", entry.successCount())
                    .add("failureCount", entry.failureCount())
                    .add("successRate", entry.successRate())
                    .add("avgResponseTime", entry.avgResponseTime()));
        }

        return Json.createObjectBuilder()
                .add("totalTokensValidated", snapshot.totalValidations())
                .add("validTokens", snapshot.validTokens())
                .add("invalidTokens", snapshot.invalidTokens())
                .add("errorRate", snapshot.errorRate())
                .add("lastValidation", snapshot.lastValidation() != null ?
                        snapshot.lastValidation().toString() : "")
                .add("topErrors", topErrorsBuilder)
                .add("averageResponseTime", avgResponseTime)
                .add("minResponseTime", minResponseTime)
                .add("maxResponseTime", maxResponseTime)
                .add("p95ResponseTime", p95ResponseTime)
                .add("activeIssuers", snapshot.activeIssuers())
                .add("issuerMetrics", issuerMetricsBuilder)
                .build();
    }

    /**
     * Sends an error response.
     */
    private void sendErrorResponse(HttpServletResponse resp, int statusCode, String errorMessage)
            throws IOException {

        JsonObject errorResponse = Json.createObjectBuilder()
                .add("error", errorMessage)
                .add("totalTokensValidated", 0)
                .add("validTokens", 0)
                .add("invalidTokens", 0)
                .add("errorRate", 0.0)
                .add("lastValidation", "")
                .add("topErrors", Json.createArrayBuilder())
                .build();

        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        resp.setStatus(statusCode);

        try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
            writer.writeObject(errorResponse);
        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.FAILED_WRITE_ERROR_RESPONSE);
            // Don't throw here to avoid masking the original error
        }
    }
}
