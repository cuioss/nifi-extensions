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
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

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
 */
public class MetricsServlet extends HttpServlet {

    private static final CuiLogger LOGGER = new CuiLogger(MetricsServlet.class);
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());

    /** Maximum number of distinct error types tracked to prevent unbounded memory growth. */
    private static final int MAX_ERROR_TYPES = 100;

    // Static metrics storage (in a real implementation, this might be injected or shared)
    private static final AtomicLong totalTokensValidated = new AtomicLong(0);
    private static final AtomicLong validTokens = new AtomicLong(0);
    private static final AtomicLong invalidTokens = new AtomicLong(0);
    private static volatile Instant lastValidation = null;
    private static final Map<String, AtomicLong> errorCounts = new ConcurrentHashMap<>();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException {

        LOGGER.debug("Received metrics request");

        try {
            // Collect current metrics
            SecurityMetrics metrics = collectMetrics();

            // Build JSON response
            JsonObject responseJson = buildMetricsResponse(metrics);

            // Send response
            resp.setContentType("application/json");
            resp.setCharacterEncoding("UTF-8");
            resp.setStatus(200);

            try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
                writer.writeObject(responseJson);
                LOGGER.debug("Sent metrics response");
            }

        } catch (IOException e) {
            LOGGER.error(e, "Error writing metrics response");
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        } catch (IllegalStateException e) {
            LOGGER.error(e, "Error collecting metrics");
            try {
                sendErrorResponse(resp, 500, "Error collecting metrics");
            } catch (IOException ioException) {
                LOGGER.error(ioException, "Failed to send error response");
                resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            }
        }
    }

    /**
     * Collects current security metrics.
     */
    private SecurityMetrics collectMetrics() {
        return getCurrentMetrics();
    }

    /**
     * Builds the JSON response for metrics.
     */
    private JsonObject buildMetricsResponse(SecurityMetrics metrics) {
        JsonArrayBuilder topErrorsBuilder = Json.createArrayBuilder();

        for (ErrorCount errorCount : metrics.topErrors) {
            JsonObject errorObj = Json.createObjectBuilder()
                    .add("error", errorCount.error)
                    .add("count", errorCount.count)
                    .build();
            topErrorsBuilder.add(errorObj);
        }

        // Performance metrics and issuer-level metrics require proper instrumentation.
        // These fields are included with zero values so the frontend receives a valid structure.
        JsonArrayBuilder issuerMetricsBuilder = Json.createArrayBuilder();

        return Json.createObjectBuilder()
                .add("totalTokensValidated", metrics.totalTokensValidated)
                .add("validTokens", metrics.validTokens)
                .add("invalidTokens", metrics.invalidTokens)
                .add("errorRate", metrics.errorRate)
                .add("lastValidation", metrics.lastValidation != null ?
                        metrics.lastValidation.toString() : "")
                .add("topErrors", topErrorsBuilder)
                // Additional fields expected by frontend (zeroed until proper instrumentation is added)
                .add("averageResponseTime", 0)
                .add("minResponseTime", 0)
                .add("maxResponseTime", 0)
                .add("p95ResponseTime", 0)
                .add("activeIssuers", 0)
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
            LOGGER.error(e, "Failed to write error response");
            // Don't throw here to avoid masking the original error
        }
    }

    // Static methods for updating metrics (would be called from validation service)
    
    /**
     * Records a successful token validation.
     */
    public static void recordValidToken() {
        totalTokensValidated.incrementAndGet();
        validTokens.incrementAndGet();
        lastValidation = Instant.now();
        LOGGER.debug("Recorded valid token, total: %d, valid: %d",
                totalTokensValidated.get(), validTokens.get());
    }

    /**
     * Records a failed token validation.
     */
    public static void recordInvalidToken(String errorMessage) {
        totalTokensValidated.incrementAndGet();
        invalidTokens.incrementAndGet();
        lastValidation = Instant.now();

        if (errorMessage != null && !errorMessage.trim().isEmpty()) {
            String key = errorMessage.trim();
            // Only track new error types if under the cap, but always update existing ones
            if (errorCounts.containsKey(key) || errorCounts.size() < MAX_ERROR_TYPES) {
                errorCounts.computeIfAbsent(key, k -> new AtomicLong(0)).incrementAndGet();
            }
        }

        LOGGER.debug("Recorded invalid token, total: %d, invalid: %d, error: %s",
                totalTokensValidated.get(), invalidTokens.get(), errorMessage);
    }

    /**
     * Resets all metrics (for testing purposes).
     */
    public static void resetMetrics() {
        totalTokensValidated.set(0);
        validTokens.set(0);
        invalidTokens.set(0);
        lastValidation = null;
        errorCounts.clear();
        LOGGER.debug("Reset all metrics");
    }

    /**
     * Gets current metrics as a snapshot (for testing purposes).
     */
    public static SecurityMetrics getCurrentMetrics() {
        long total = totalTokensValidated.get();
        long valid = validTokens.get();
        long invalid = invalidTokens.get();
        double errorRate = total > 0 ? (double) invalid / total : 0.0;

        List<ErrorCount> topErrors = errorCounts.entrySet().stream()
                .map(entry -> new ErrorCount(entry.getKey(), entry.getValue().get()))
                .sorted((a, b) -> Long.compare(b.count, a.count))
                .limit(10)
                .toList();

        return new SecurityMetrics(total, valid, invalid, errorRate, lastValidation, topErrors);
    }

    /**
     * Data class for security metrics.
     */
    public static class SecurityMetrics {
        public final long totalTokensValidated;
        public final long validTokens;
        public final long invalidTokens;
        public final double errorRate;
        public final Instant lastValidation;
        public final List<ErrorCount> topErrors;

        public SecurityMetrics(long totalTokensValidated, long validTokens, long invalidTokens,
                double errorRate, Instant lastValidation, List<ErrorCount> topErrors) {
            this.totalTokensValidated = totalTokensValidated;
            this.validTokens = validTokens;
            this.invalidTokens = invalidTokens;
            this.errorRate = errorRate;
            this.lastValidation = lastValidation;
            this.topErrors = topErrors != null ? topErrors : new ArrayList<>();
        }
    }

    /**
     * Data class for error counts.
     */
    public static class ErrorCount {
        public final String error;
        public final long count;

        public ErrorCount(String error, long count) {
            this.error = error;
            this.count = count;
        }
    }
}