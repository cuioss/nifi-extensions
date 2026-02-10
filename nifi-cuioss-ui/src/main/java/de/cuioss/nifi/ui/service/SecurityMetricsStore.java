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

    private static final Set<EventType> SUCCESS_TYPES = Set.of(
            EventType.ACCESS_TOKEN_CREATED,
            EventType.ID_TOKEN_CREATED,
            EventType.REFRESH_TOKEN_CREATED,
            EventType.ACCESS_TOKEN_CACHE_HIT
    );

    private static final SecurityEventCounter globalCounter = new SecurityEventCounter();
    private static TokenValidatorMonitor monitor = TokenValidatorMonitorConfig.defaultEnabled().createMonitor();
    private static final AtomicLong totalValidations = new AtomicLong(0);
    private static volatile Instant lastValidation = null;

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

        LOGGER.debug("Recorded validation metrics: duration=%dns, events=%s",
                durationNanos, perRequestCounter.getCounters());
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

        return new MetricsSnapshot(total, valid, invalid, errorRate, lastValidation, topErrors, stats);
    }

    /**
     * Resets all metrics to initial state. Intended for testing.
     */
    public static void reset() {
        globalCounter.reset();
        monitor = TokenValidatorMonitorConfig.defaultEnabled().createMonitor();
        totalValidations.set(0);
        lastValidation = null;
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
            StripedRingBufferStatistics validationStatistics
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
}
