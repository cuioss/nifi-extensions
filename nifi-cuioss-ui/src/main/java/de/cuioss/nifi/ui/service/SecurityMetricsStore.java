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
package de.cuioss.nifi.ui.service;

import de.cuioss.sheriff.oauth.core.metrics.MeasurementType;
import de.cuioss.sheriff.oauth.core.metrics.TokenValidatorMonitor;
import de.cuioss.sheriff.oauth.core.metrics.TokenValidatorMonitorConfig;
import de.cuioss.sheriff.oauth.core.security.SecurityEventCounter;
import de.cuioss.sheriff.oauth.core.security.SecurityEventCounter.EventType;
import de.cuioss.tools.concurrent.StripedRingBufferStatistics;
import de.cuioss.tools.logging.CuiLogger;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Thread-safe centralized store for security metrics, replacing MetricsServlet's
 * static counters with real SecurityEventCounter and TokenValidatorMonitor integration.
 *
 * <p>Aggregates per-request SecurityEventCounter data into a global counter and
 * records validation durations for percentile statistics (p50/p95/p99).</p>
 */
public final class SecurityMetricsStore {

    private static final CuiLogger LOGGER = new CuiLogger(SecurityMetricsStore.class);

    private static final int MAX_TOP_ERRORS = 10;
    private static final int MAX_TRACKED_ISSUERS = 100;

    private static final Set<EventType> SUCCESS_TYPES = Set.of(
            EventType.ACCESS_TOKEN_CREATED,
            EventType.ID_TOKEN_CREATED,
            EventType.REFRESH_TOKEN_CREATED,
            EventType.ACCESS_TOKEN_CACHE_HIT
    );

    private static final String UNKNOWN_ISSUER = "Unknown";

    private static final SecurityEventCounter globalCounter = new SecurityEventCounter();
    private static TokenValidatorMonitor monitor = TokenValidatorMonitorConfig.defaultEnabled().createMonitor();
    private static final AtomicLong totalValidations = new AtomicLong(0);
    private static volatile Instant lastValidation = null;
    private static final ConcurrentHashMap<String, IssuerMetrics> issuerMetricsMap = new ConcurrentHashMap<>();

    private SecurityMetricsStore() {
        // utility class
    }

    /**
     * Records a validation attempt by merging per-request events into global counters
     * and recording the validation duration for performance statistics.
     *
     * @param perRequestCounter the SecurityEventCounter from the TokenValidator for this request
     * @param durationNanos     the validation duration in nanoseconds
     */
    public static void recordValidation(SecurityEventCounter perRequestCounter, long durationNanos) {
        recordValidation(perRequestCounter, durationNanos, null);
    }

    /**
     * Records a validation attempt with issuer information for per-issuer tracking.
     *
     * @param perRequestCounter the SecurityEventCounter from the TokenValidator for this request
     * @param durationNanos     the validation duration in nanoseconds
     * @param issuer            the issuer identifier, or null if unknown
     */
    public static void recordValidation(SecurityEventCounter perRequestCounter, long durationNanos,
            String issuer) {
        Objects.requireNonNull(perRequestCounter, "perRequestCounter must not be null");
        // Merge per-request counter into global counter
        for (Map.Entry<EventType, Long> entry : perRequestCounter.getCounters().entrySet()) {
            for (long i = 0; i < entry.getValue(); i++) {
                globalCounter.increment(entry.getKey());
            }
        }

        // Record timing
        monitor.recordMeasurement(MeasurementType.COMPLETE_VALIDATION, durationNanos);
        totalValidations.incrementAndGet();
        lastValidation = Instant.now();

        // Per-issuer tracking
        boolean isSuccess = perRequestCounter.getCounters()
                .entrySet().stream()
                .anyMatch(entry -> SUCCESS_TYPES.contains(entry.getKey()) && entry.getValue() > 0);

        if (issuer != null) {
            // Known issuer — track regardless of success/failure
            trackIssuer(issuer, isSuccess, durationNanos);
        } else if (!isSuccess) {
            // Null issuer + failure → attribute to "Unknown"
            trackIssuer(UNKNOWN_ISSUER, false, durationNanos);
        }
        // Null issuer + success → skip issuer tracking (shouldn't happen in practice)

        LOGGER.debug("Recorded validation metrics: duration=%dns, issuer=%s, events=%s",
                durationNanos, issuer, perRequestCounter.getCounters());
    }

    /**
     * Tracks per-issuer metrics, guarding against unbounded map growth from
     * attacker-crafted issuer values. Existing issuers are always updated;
     * new issuers are only added if the map has not reached the size limit.
     */
    private static void trackIssuer(String issuerKey, boolean isSuccess, long durationNanos) {
        IssuerMetrics existing = issuerMetricsMap.get(issuerKey);
        if (existing != null) {
            existing.record(isSuccess, durationNanos);
            return;
        }
        if (issuerMetricsMap.size() >= MAX_TRACKED_ISSUERS) {
            LOGGER.debug("Issuer metrics map full (%d entries), skipping new issuer: %s",
                    MAX_TRACKED_ISSUERS, issuerKey);
            return;
        }
        issuerMetricsMap.computeIfAbsent(issuerKey, k ->
                new IssuerMetrics(TokenValidatorMonitorConfig.defaultEnabled().createMonitor()))
                .record(isSuccess, durationNanos);
    }

    /**
     * Returns a snapshot of the current metrics state.
     */
    public static MetricsSnapshot getSnapshot() {
        long total = totalValidations.get();
        long valid = globalCounter.getCount(EventType.ACCESS_TOKEN_CREATED);
        long invalid = total - valid;
        double errorRate = total > 0 ? (double) invalid / total : 0.0;

        List<ErrorCount> topErrors = globalCounter.getCounters().entrySet().stream()
                .filter(entry -> !SUCCESS_TYPES.contains(entry.getKey()))
                .filter(entry -> entry.getValue() > 0)
                .map(entry -> new ErrorCount(entry.getKey().getDescription(), entry.getValue()))
                .sorted((a, b) -> Long.compare(b.count(), a.count()))
                .limit(MAX_TOP_ERRORS)
                .toList();

        StripedRingBufferStatistics stats = monitor
                .getValidationMetrics(MeasurementType.COMPLETE_VALIDATION)
                .orElse(null);

        List<IssuerMetricsEntry> issuerEntries = issuerMetricsMap.entrySet().stream()
                .map(entry -> {
                    IssuerMetrics m = entry.getValue();
                    long issuerTotal = m.total.get();
                    long issuerSuccess = m.success.get();
                    long issuerFailure = m.failure.get();
                    double rate = issuerTotal > 0 ? (double) issuerSuccess / issuerTotal * 100.0 : 0.0;
                    long avgMs = m.monitor.getValidationMetrics(MeasurementType.COMPLETE_VALIDATION)
                            .map(s -> s.sampleCount() > 0 ? s.p50().toMillis() : 0L)
                            .orElse(0L);
                    return new IssuerMetricsEntry(entry.getKey(), issuerTotal, issuerSuccess, issuerFailure, rate, avgMs);
                })
                .sorted((a, b) -> Long.compare(b.totalRequests(), a.totalRequests()))
                .toList();

        int activeIssuers = issuerMetricsMap.size();

        return new MetricsSnapshot(total, valid, invalid, errorRate, lastValidation, topErrors, stats,
                activeIssuers, issuerEntries);
    }

    /**
     * Resets all metrics to initial state. Intended for testing.
     */
    public static void reset() {
        globalCounter.reset();
        monitor = TokenValidatorMonitorConfig.defaultEnabled().createMonitor();
        totalValidations.set(0);
        lastValidation = null;
        issuerMetricsMap.clear();
        LOGGER.debug("Reset all security metrics");
    }

    /**
     * Immutable snapshot of the current metrics state.
     */
    public record MetricsSnapshot(
            long totalValidations,
            long validTokens,
            long invalidTokens,
            double errorRate,
            Instant lastValidation,
            List<ErrorCount> topErrors,
            StripedRingBufferStatistics validationStatistics,
            int activeIssuers,
            List<IssuerMetricsEntry> issuerMetrics
    ) {
    }

    /**
     * Error type with its occurrence count.
     */
    public record ErrorCount(
            String error,
            long count
    ) {
    }

    /**
     * Per-issuer metrics summary for snapshot reporting.
     */
    public record IssuerMetricsEntry(
            String name,
            long totalRequests,
            long successCount,
            long failureCount,
            double successRate,
            long avgResponseTime
    ) {
    }

    /**
     * Mutable per-issuer metrics accumulator (thread-safe).
     */
    private static final class IssuerMetrics {
        private final AtomicLong total = new AtomicLong(0);
        private final AtomicLong success = new AtomicLong(0);
        private final AtomicLong failure = new AtomicLong(0);
        private final TokenValidatorMonitor monitor;

        IssuerMetrics(TokenValidatorMonitor monitor) {
            this.monitor = monitor;
        }

        void record(boolean isSuccess, long durationNanos) {
            total.incrementAndGet();
            if (isSuccess) {
                success.incrementAndGet();
            } else {
                failure.incrementAndGet();
            }
            monitor.recordMeasurement(MeasurementType.COMPLETE_VALIDATION, durationNanos);
        }
    }
}
