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

import de.cuioss.sheriff.oauth.core.security.SecurityEventCounter;
import de.cuioss.sheriff.oauth.core.security.SecurityEventCounter.EventType;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@EnableTestLogger
@DisplayName("SecurityMetricsStore tests")
class SecurityMetricsStoreTest {

    @BeforeEach
    void setUp() {
        SecurityMetricsStore.reset();
    }

    @Nested
    @DisplayName("Initial state")
    class InitialState {

        @Test
        @DisplayName("Should return all zeros and empty collections initially")
        void shouldReturnAllZerosInitially() {
            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();

            assertEquals(0, snapshot.totalValidations());
            assertEquals(0, snapshot.validTokens());
            assertEquals(0, snapshot.invalidTokens());
            assertEquals(0.0, snapshot.errorRate(), 0.001);
            assertNull(snapshot.lastValidation());
            assertTrue(snapshot.topErrors().isEmpty());
            // Monitor may return statistics with zero samples
            if (snapshot.validationStatistics() != null) {
                assertEquals(0, snapshot.validationStatistics().sampleCount());
            }
        }
    }

    @Nested
    @DisplayName("Valid token recording")
    class ValidTokenRecording {

        @Test
        @DisplayName("Should count valid tokens via ACCESS_TOKEN_CREATED event")
        void shouldCountValidTokens() {
            SecurityEventCounter perRequest = new SecurityEventCounter();
            perRequest.increment(EventType.ACCESS_TOKEN_CREATED);

            SecurityMetricsStore.recordValidation(perRequest, 1_000_000L);

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertEquals(1, snapshot.totalValidations());
            assertEquals(1, snapshot.validTokens());
            assertEquals(0, snapshot.invalidTokens());
            assertEquals(0.0, snapshot.errorRate(), 0.001);
            assertNotNull(snapshot.lastValidation());
        }

        @Test
        @DisplayName("Should count multiple valid tokens")
        void shouldCountMultipleValidTokens() {
            for (int i = 0; i < 5; i++) {
                SecurityEventCounter perRequest = new SecurityEventCounter();
                perRequest.increment(EventType.ACCESS_TOKEN_CREATED);
                SecurityMetricsStore.recordValidation(perRequest, 500_000L);
            }

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertEquals(5, snapshot.totalValidations());
            assertEquals(5, snapshot.validTokens());
            assertEquals(0, snapshot.invalidTokens());
            assertEquals(0.0, snapshot.errorRate(), 0.001);
        }
    }

    @Nested
    @DisplayName("Invalid token recording")
    class InvalidTokenRecording {

        @Test
        @DisplayName("Should count invalid tokens and track error types")
        void shouldCountInvalidTokensWithErrorTypes() {
            SecurityEventCounter perRequest = new SecurityEventCounter();
            perRequest.increment(EventType.TOKEN_EXPIRED);

            SecurityMetricsStore.recordValidation(perRequest, 200_000L);

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertEquals(1, snapshot.totalValidations());
            assertEquals(0, snapshot.validTokens());
            assertEquals(1, snapshot.invalidTokens());
            assertEquals(1.0, snapshot.errorRate(), 0.001);
            assertFalse(snapshot.topErrors().isEmpty());
            assertEquals(EventType.TOKEN_EXPIRED.getDescription(),
                    snapshot.topErrors().getFirst().error());
        }

        @Test
        @DisplayName("Should track different error types separately")
        void shouldTrackDifferentErrorTypes() {
            SecurityEventCounter request1 = new SecurityEventCounter();
            request1.increment(EventType.TOKEN_EXPIRED);
            SecurityMetricsStore.recordValidation(request1, 100_000L);

            SecurityEventCounter request2 = new SecurityEventCounter();
            request2.increment(EventType.SIGNATURE_VALIDATION_FAILED);
            SecurityMetricsStore.recordValidation(request2, 100_000L);

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertEquals(2, snapshot.totalValidations());
            assertEquals(0, snapshot.validTokens());
            assertEquals(2, snapshot.invalidTokens());
            assertEquals(2, snapshot.topErrors().size());
        }
    }

    @Nested
    @DisplayName("Mixed recording")
    class MixedRecording {

        @Test
        @DisplayName("Should calculate correct error rate for mixed valid/invalid")
        void shouldCalculateCorrectErrorRate() {
            // 3 valid
            for (int i = 0; i < 3; i++) {
                SecurityEventCounter perRequest = new SecurityEventCounter();
                perRequest.increment(EventType.ACCESS_TOKEN_CREATED);
                SecurityMetricsStore.recordValidation(perRequest, 500_000L);
            }
            // 2 invalid
            SecurityEventCounter expired = new SecurityEventCounter();
            expired.increment(EventType.TOKEN_EXPIRED);
            SecurityMetricsStore.recordValidation(expired, 200_000L);

            SecurityEventCounter sigFailed = new SecurityEventCounter();
            sigFailed.increment(EventType.SIGNATURE_VALIDATION_FAILED);
            SecurityMetricsStore.recordValidation(sigFailed, 200_000L);

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertEquals(5, snapshot.totalValidations());
            assertEquals(3, snapshot.validTokens());
            assertEquals(2, snapshot.invalidTokens());
            assertEquals(0.4, snapshot.errorRate(), 0.001);
        }
    }

    @Nested
    @DisplayName("Error ranking")
    class ErrorRanking {

        @Test
        @DisplayName("Should sort errors by count descending")
        void shouldSortErrorsByCountDescending() {
            // 3x TOKEN_EXPIRED
            for (int i = 0; i < 3; i++) {
                SecurityEventCounter perRequest = new SecurityEventCounter();
                perRequest.increment(EventType.TOKEN_EXPIRED);
                SecurityMetricsStore.recordValidation(perRequest, 100_000L);
            }
            // 1x SIGNATURE_VALIDATION_FAILED
            SecurityEventCounter sigFailed = new SecurityEventCounter();
            sigFailed.increment(EventType.SIGNATURE_VALIDATION_FAILED);
            SecurityMetricsStore.recordValidation(sigFailed, 100_000L);
            // 2x INVALID_JWT_FORMAT
            for (int i = 0; i < 2; i++) {
                SecurityEventCounter perRequest = new SecurityEventCounter();
                perRequest.increment(EventType.INVALID_JWT_FORMAT);
                SecurityMetricsStore.recordValidation(perRequest, 100_000L);
            }

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertEquals(3, snapshot.topErrors().size());

            assertEquals(EventType.TOKEN_EXPIRED.getDescription(),
                    snapshot.topErrors().getFirst().error());
            assertEquals(3, snapshot.topErrors().getFirst().count());

            assertEquals(EventType.INVALID_JWT_FORMAT.getDescription(),
                    snapshot.topErrors().get(1).error());
            assertEquals(2, snapshot.topErrors().get(1).count());

            assertEquals(EventType.SIGNATURE_VALIDATION_FAILED.getDescription(),
                    snapshot.topErrors().get(2).error());
            assertEquals(1, snapshot.topErrors().get(2).count());
        }

        @Test
        @DisplayName("Should limit top errors to 10")
        void shouldLimitTopErrorsToTen() {
            // Record 12 distinct error types
            EventType[] errorTypes = {
                    EventType.TOKEN_EXPIRED,
                    EventType.SIGNATURE_VALIDATION_FAILED,
                    EventType.INVALID_JWT_FORMAT,
                    EventType.TOKEN_EMPTY,
                    EventType.TOKEN_SIZE_EXCEEDED,
                    EventType.FAILED_TO_DECODE_JWT,
                    EventType.DECODED_PART_SIZE_EXCEEDED,
                    EventType.MISSING_CLAIM,
                    EventType.TOKEN_NBF_FUTURE,
                    EventType.AUDIENCE_MISMATCH,
                    EventType.AZP_MISMATCH,
                    EventType.NO_ISSUER_CONFIG
            };
            for (EventType errorType : errorTypes) {
                SecurityEventCounter perRequest = new SecurityEventCounter();
                perRequest.increment(errorType);
                SecurityMetricsStore.recordValidation(perRequest, 100_000L);
            }

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertEquals(10, snapshot.topErrors().size());
        }
    }

    @Nested
    @DisplayName("Performance metrics")
    class PerformanceMetrics {

        @Test
        @DisplayName("Should populate validation statistics after recordings")
        void shouldPopulateValidationStatistics() {
            for (int i = 0; i < 10; i++) {
                SecurityEventCounter perRequest = new SecurityEventCounter();
                perRequest.increment(EventType.ACCESS_TOKEN_CREATED);
                SecurityMetricsStore.recordValidation(perRequest, 5_000_000L); // 5ms
            }

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertNotNull(snapshot.validationStatistics());
            assertTrue(snapshot.validationStatistics().sampleCount() > 0);
            assertNotNull(snapshot.validationStatistics().p50());
            assertNotNull(snapshot.validationStatistics().p95());
            assertNotNull(snapshot.validationStatistics().p99());
        }

        @Test
        @DisplayName("Should reflect varying durations in percentiles")
        void shouldReflectVaryingDurations() {
            // Record a mix of fast and slow validations
            for (int i = 0; i < 50; i++) {
                SecurityEventCounter perRequest = new SecurityEventCounter();
                perRequest.increment(EventType.ACCESS_TOKEN_CREATED);
                SecurityMetricsStore.recordValidation(perRequest, 1_000_000L); // 1ms
            }
            for (int i = 0; i < 5; i++) {
                SecurityEventCounter perRequest = new SecurityEventCounter();
                perRequest.increment(EventType.ACCESS_TOKEN_CREATED);
                SecurityMetricsStore.recordValidation(perRequest, 100_000_000L); // 100ms
            }

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertNotNull(snapshot.validationStatistics());
            // p50 should be faster than p99 with this distribution
            assertTrue(snapshot.validationStatistics().p50().compareTo(
                    snapshot.validationStatistics().p99()) <= 0);
        }
    }

    @Nested
    @DisplayName("Issuer tracking")
    class IssuerTracking {

        @Test
        @DisplayName("Should track issuer for successful validation")
        void shouldTrackIssuerForSuccessfulValidation() {
            SecurityEventCounter perRequest = new SecurityEventCounter();
            perRequest.increment(EventType.ACCESS_TOKEN_CREATED);
            SecurityMetricsStore.recordValidation(perRequest, 1_000_000L, "https://auth.example.com");

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertEquals(1, snapshot.issuerMetrics().size());
            SecurityMetricsStore.IssuerMetricsEntry entry = snapshot.issuerMetrics().getFirst();
            assertEquals("https://auth.example.com", entry.name());
            assertEquals(1, entry.totalRequests());
            assertEquals(1, entry.successCount());
            assertEquals(0, entry.failureCount());
            assertEquals(100.0, entry.successRate(), 0.001);
        }

        @Test
        @DisplayName("Should attribute failures to Unknown when issuer is null")
        void shouldAttributeFailuresToUnknown() {
            SecurityEventCounter perRequest = new SecurityEventCounter();
            perRequest.increment(EventType.TOKEN_EXPIRED);
            SecurityMetricsStore.recordValidation(perRequest, 1_000_000L, null);

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertEquals(1, snapshot.issuerMetrics().size());
            SecurityMetricsStore.IssuerMetricsEntry entry = snapshot.issuerMetrics().getFirst();
            assertEquals("Unknown", entry.name());
            assertEquals(1, entry.totalRequests());
            assertEquals(0, entry.successCount());
            assertEquals(1, entry.failureCount());
        }

        @Test
        @DisplayName("Should track multiple issuers independently")
        void shouldTrackMultipleIssuersIndependently() {
            SecurityEventCounter req1 = new SecurityEventCounter();
            req1.increment(EventType.ACCESS_TOKEN_CREATED);
            SecurityMetricsStore.recordValidation(req1, 1_000_000L, "https://issuer-a.example.com");

            SecurityEventCounter req2 = new SecurityEventCounter();
            req2.increment(EventType.ACCESS_TOKEN_CREATED);
            SecurityMetricsStore.recordValidation(req2, 1_000_000L, "https://issuer-b.example.com");

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertEquals(2, snapshot.issuerMetrics().size());
        }

        @Test
        @DisplayName("Should calculate per-issuer success rate")
        void shouldCalculatePerIssuerSuccessRate() {
            String issuer = "https://auth.example.com";

            // 3 successes
            for (int i = 0; i < 3; i++) {
                SecurityEventCounter perRequest = new SecurityEventCounter();
                perRequest.increment(EventType.ACCESS_TOKEN_CREATED);
                SecurityMetricsStore.recordValidation(perRequest, 1_000_000L, issuer);
            }
            // 1 failure attributed to same issuer (simulating known issuer failure)
            SecurityEventCounter failure = new SecurityEventCounter();
            failure.increment(EventType.TOKEN_EXPIRED);
            SecurityMetricsStore.recordValidation(failure, 1_000_000L, issuer);

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            SecurityMetricsStore.IssuerMetricsEntry entry = snapshot.issuerMetrics().stream()
                    .filter(e -> issuer.equals(e.name()))
                    .findFirst().orElseThrow();
            assertEquals(4, entry.totalRequests());
            assertEquals(3, entry.successCount());
            assertEquals(1, entry.failureCount());
            assertEquals(75.0, entry.successRate(), 0.001);
        }

        @Test
        @DisplayName("Should include per-issuer average response time")
        void shouldIncludePerIssuerAvgResponseTime() {
            String issuer = "https://auth.example.com";
            for (int i = 0; i < 10; i++) {
                SecurityEventCounter perRequest = new SecurityEventCounter();
                perRequest.increment(EventType.ACCESS_TOKEN_CREATED);
                SecurityMetricsStore.recordValidation(perRequest, 50_000_000L, issuer); // 50ms
            }

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            SecurityMetricsStore.IssuerMetricsEntry entry = snapshot.issuerMetrics().getFirst();
            assertTrue(entry.avgResponseTime() > 0,
                    "Average response time should be > 0 after recordings");
        }

        @Test
        @DisplayName("Should not track issuer for null-issuer successes")
        void shouldNotTrackIssuerForNullIssuerSuccesses() {
            SecurityEventCounter perRequest = new SecurityEventCounter();
            perRequest.increment(EventType.ACCESS_TOKEN_CREATED);
            // null issuer + success → skip issuer tracking
            SecurityMetricsStore.recordValidation(perRequest, 1_000_000L, null);

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertTrue(snapshot.issuerMetrics().isEmpty(),
                    "Should not create issuer entry for null-issuer success");
        }

        @Test
        @DisplayName("Should cap issuer map at max size to prevent unbounded growth")
        void shouldCapIssuerMapAtMaxSize() {
            // Fill up to the limit (100 distinct issuers)
            for (int i = 0; i < 100; i++) {
                SecurityEventCounter perRequest = new SecurityEventCounter();
                perRequest.increment(EventType.ACCESS_TOKEN_CREATED);
                SecurityMetricsStore.recordValidation(perRequest, 1_000_000L,
                        "https://issuer-" + i + ".example.com");
            }

            assertEquals(100, SecurityMetricsStore.getSnapshot().activeIssuers());

            // Attempt to add one more — should be silently dropped
            SecurityEventCounter overflow = new SecurityEventCounter();
            overflow.increment(EventType.ACCESS_TOKEN_CREATED);
            SecurityMetricsStore.recordValidation(overflow, 1_000_000L,
                    "https://issuer-overflow.example.com");

            assertEquals(100, SecurityMetricsStore.getSnapshot().activeIssuers(),
                    "Should not exceed max tracked issuers limit");

            // Existing issuers should still be updated
            SecurityEventCounter existing = new SecurityEventCounter();
            existing.increment(EventType.ACCESS_TOKEN_CREATED);
            SecurityMetricsStore.recordValidation(existing, 1_000_000L,
                    "https://issuer-0.example.com");

            SecurityMetricsStore.IssuerMetricsEntry entry = SecurityMetricsStore.getSnapshot()
                    .issuerMetrics().stream()
                    .filter(e -> "https://issuer-0.example.com".equals(e.name()))
                    .findFirst().orElseThrow();
            assertEquals(2, entry.totalRequests(),
                    "Existing issuers should still be updated when map is full");
        }
    }

    @Nested
    @DisplayName("Active issuers")
    class ActiveIssuers {

        @Test
        @DisplayName("Should return zero active issuers initially")
        void shouldReturnZeroActiveIssuersInitially() {
            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertEquals(0, snapshot.activeIssuers());
        }

        @Test
        @DisplayName("Should count distinct issuers")
        void shouldCountDistinctIssuers() {
            SecurityEventCounter req1 = new SecurityEventCounter();
            req1.increment(EventType.ACCESS_TOKEN_CREATED);
            SecurityMetricsStore.recordValidation(req1, 1_000_000L, "https://issuer-a.example.com");

            SecurityEventCounter req2 = new SecurityEventCounter();
            req2.increment(EventType.ACCESS_TOKEN_CREATED);
            SecurityMetricsStore.recordValidation(req2, 1_000_000L, "https://issuer-b.example.com");

            SecurityEventCounter req3 = new SecurityEventCounter();
            req3.increment(EventType.ACCESS_TOKEN_CREATED);
            SecurityMetricsStore.recordValidation(req3, 1_000_000L, "https://issuer-a.example.com");

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertEquals(2, snapshot.activeIssuers());
        }

        @Test
        @DisplayName("Should include Unknown in active issuers count when failures exist")
        void shouldIncludeUnknownInActiveIssuersCount() {
            SecurityEventCounter failure = new SecurityEventCounter();
            failure.increment(EventType.TOKEN_EXPIRED);
            SecurityMetricsStore.recordValidation(failure, 1_000_000L, null);

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertEquals(1, snapshot.activeIssuers(),
                    "Unknown issuer should count as an active issuer");
        }
    }

    @Nested
    @DisplayName("Reset behavior")
    class ResetBehavior {

        @Test
        @DisplayName("Should reset all counters and statistics")
        void shouldResetEverything() {
            SecurityEventCounter perRequest = new SecurityEventCounter();
            perRequest.increment(EventType.ACCESS_TOKEN_CREATED);
            SecurityMetricsStore.recordValidation(perRequest, 5_000_000L, "https://auth.example.com");

            SecurityEventCounter invalid = new SecurityEventCounter();
            invalid.increment(EventType.TOKEN_EXPIRED);
            SecurityMetricsStore.recordValidation(invalid, 2_000_000L, null);

            // Verify non-zero before reset
            SecurityMetricsStore.MetricsSnapshot beforeReset = SecurityMetricsStore.getSnapshot();
            assertEquals(2, beforeReset.totalValidations());
            assertFalse(beforeReset.issuerMetrics().isEmpty());
            assertTrue(beforeReset.activeIssuers() > 0);

            SecurityMetricsStore.reset();

            SecurityMetricsStore.MetricsSnapshot afterReset = SecurityMetricsStore.getSnapshot();
            assertEquals(0, afterReset.totalValidations());
            assertEquals(0, afterReset.validTokens());
            assertEquals(0, afterReset.invalidTokens());
            assertEquals(0.0, afterReset.errorRate(), 0.001);
            assertNull(afterReset.lastValidation());
            assertTrue(afterReset.topErrors().isEmpty());
            assertTrue(afterReset.issuerMetrics().isEmpty());
            assertEquals(0, afterReset.activeIssuers());
        }
    }

    @Nested
    @DisplayName("Edge cases")
    class EdgeCases {

        @Test
        @DisplayName("Should handle empty counter (no events)")
        void shouldHandleEmptyCounter() {
            SecurityEventCounter perRequest = new SecurityEventCounter();
            // No events incremented

            SecurityMetricsStore.recordValidation(perRequest, 1_000_000L);

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertEquals(1, snapshot.totalValidations());
            assertEquals(0, snapshot.validTokens());
            assertEquals(1, snapshot.invalidTokens());
            assertTrue(snapshot.topErrors().isEmpty());
        }

        @Test
        @DisplayName("Should handle concurrent access safely")
        void shouldHandleConcurrentAccess() throws InterruptedException {
            int threadCount = 10;
            int iterationsPerThread = 100;
            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch latch = new CountDownLatch(threadCount);

            for (int t = 0; t < threadCount; t++) {
                executor.submit(() -> {
                    try {
                        for (int i = 0; i < iterationsPerThread; i++) {
                            SecurityEventCounter perRequest = new SecurityEventCounter();
                            perRequest.increment(EventType.ACCESS_TOKEN_CREATED);
                            SecurityMetricsStore.recordValidation(perRequest, 1_000_000L);
                        }
                    } finally {
                        latch.countDown();
                    }
                });
            }

            assertTrue(latch.await(10, TimeUnit.SECONDS));
            executor.shutdown();

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();
            assertEquals(threadCount * iterationsPerThread, snapshot.totalValidations());
            assertEquals(threadCount * iterationsPerThread, snapshot.validTokens());
        }
    }
}
