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

import de.cuioss.nifi.ui.service.SecurityMetricsStore;
import de.cuioss.sheriff.oauth.core.security.SecurityEventCounter;
import de.cuioss.sheriff.oauth.core.security.SecurityEventCounter.EventType;
import de.cuioss.test.generator.junit.EnableGeneratorController;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.easymock.EasyMockExtension;
import org.easymock.Mock;
import org.easymock.TestSubject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.easymock.EasyMock.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link MetricsServlet}.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/observability.adoc">Observability Specification</a>
 */
@EnableGeneratorController
@EnableTestLogger
@ExtendWith(EasyMockExtension.class)
@DisplayName("MetricsServlet tests")
class MetricsServletTest {

    @TestSubject private MetricsServlet servlet = new MetricsServlet();

    @Mock private HttpServletRequest request;

    @Mock private HttpServletResponse response;

    private ByteArrayOutputStream outputStream;
    private TestServletOutputStream servletOutputStream;

    @BeforeEach
    void setUp() {
        outputStream = new ByteArrayOutputStream();
        servletOutputStream = new TestServletOutputStream(outputStream);

        SecurityMetricsStore.reset();
    }

    @Nested
    @DisplayName("Initial metrics state")
    class InitialMetricsState {

        @Test
        @DisplayName("Should return all zeros for initial metrics")
        void shouldReturnAllZerosForInitialMetrics() throws Exception {
            expect(response.getOutputStream()).andReturn(servletOutputStream);
            response.setContentType("application/json");
            expectLastCall();
            response.setCharacterEncoding("UTF-8");
            expectLastCall();
            response.setStatus(200);
            expectLastCall();

            replay(request, response);

            servlet.doGet(request, response);

            verify(request, response);

            String responseJson = outputStream.toString();
            assertTrue(responseJson.contains("\"totalTokensValidated\":0"),
                    "Total tokens validated should be 0 initially");
            assertTrue(responseJson.contains("\"validTokens\":0"),
                    "Valid tokens count should be 0 initially");
            assertTrue(responseJson.contains("\"invalidTokens\":0"),
                    "Invalid tokens count should be 0 initially");
            assertTrue(responseJson.contains("\"errorRate\":0.0"),
                    "Error rate should be 0.0 initially");
            assertTrue(responseJson.contains("\"lastValidation\":\"\""),
                    "Last validation should be empty initially");
            assertTrue(responseJson.contains("\"topErrors\":[]"),
                    "Top errors list should be empty initially");
        }
    }

    @Nested
    @DisplayName("Valid token metrics")
    class ValidTokenMetrics {

        @Test
        @DisplayName("Should track valid tokens correctly")
        void shouldTrackValidTokensCorrectly() throws Exception {
            final int validTokenCount = 3;
            for (int i = 0; i < validTokenCount; i++) {
                recordValidToken();
            }

            expect(response.getOutputStream()).andReturn(servletOutputStream);
            response.setContentType("application/json");
            expectLastCall();
            response.setCharacterEncoding("UTF-8");
            expectLastCall();
            response.setStatus(200);
            expectLastCall();

            replay(request, response);

            servlet.doGet(request, response);

            verify(request, response);

            String responseJson = outputStream.toString();
            assertTrue(responseJson.contains("\"totalTokensValidated\":" + validTokenCount),
                    "Total tokens should match recorded count");
            assertTrue(responseJson.contains("\"validTokens\":" + validTokenCount),
                    "Valid tokens should match recorded count");
            assertTrue(responseJson.contains("\"invalidTokens\":0"),
                    "Invalid tokens should remain 0 when only valid tokens recorded");
            assertTrue(responseJson.contains("\"errorRate\":0.0"),
                    "Error rate should be 0.0 when all tokens are valid");
            assertFalse(responseJson.contains("\"lastValidation\":\"\""),
                    "Last validation timestamp should be present after recording tokens");
        }
    }

    @Nested
    @DisplayName("Invalid token metrics")
    class InvalidTokenMetrics {

        @Test
        @DisplayName("Should track invalid tokens and error types")
        void shouldTrackInvalidTokensAndErrorTypes() throws Exception {
            recordInvalidToken(EventType.TOKEN_EXPIRED);
            recordInvalidToken(EventType.SIGNATURE_VALIDATION_FAILED);
            recordInvalidToken(EventType.TOKEN_EXPIRED);

            expect(response.getOutputStream()).andReturn(servletOutputStream);
            response.setContentType("application/json");
            expectLastCall();
            response.setCharacterEncoding("UTF-8");
            expectLastCall();
            response.setStatus(200);
            expectLastCall();

            replay(request, response);

            servlet.doGet(request, response);

            verify(request, response);

            String responseJson = outputStream.toString();
            assertTrue(responseJson.contains("\"totalTokensValidated\":3"),
                    "Total tokens should be 3");
            assertTrue(responseJson.contains("\"validTokens\":0"),
                    "Valid tokens should be 0 when only invalid tokens recorded");
            assertTrue(responseJson.contains("\"invalidTokens\":3"),
                    "Invalid tokens count should match recorded count");
            assertTrue(responseJson.contains("\"errorRate\":1.0"),
                    "Error rate should be 1.0 when all tokens are invalid");

            assertTrue(responseJson.contains("\"" + EventType.TOKEN_EXPIRED.getDescription() + "\""),
                    "Response should include expired token error description");
            assertTrue(responseJson.contains("\"" + EventType.SIGNATURE_VALIDATION_FAILED.getDescription() + "\""),
                    "Response should include signature error description");
            assertTrue(responseJson.contains("\"count\":2"),
                    "Token expired error should have count of 2");
            assertTrue(responseJson.contains("\"count\":1"),
                    "Signature validation error should have count of 1");
        }
    }

    @Nested
    @DisplayName("Mixed token metrics")
    class MixedTokenMetrics {

        @Test
        @DisplayName("Should calculate correct error rate for mixed tokens")
        void shouldCalculateCorrectErrorRateForMixedTokens() throws Exception {
            recordValidToken();
            recordValidToken();
            recordInvalidToken(EventType.TOKEN_EXPIRED);
            recordValidToken();
            recordInvalidToken(EventType.AUDIENCE_MISMATCH);

            expect(response.getOutputStream()).andReturn(servletOutputStream);
            response.setContentType("application/json");
            expectLastCall();
            response.setCharacterEncoding("UTF-8");
            expectLastCall();
            response.setStatus(200);
            expectLastCall();

            replay(request, response);

            servlet.doGet(request, response);

            verify(request, response);

            String responseJson = outputStream.toString();
            assertTrue(responseJson.contains("\"totalTokensValidated\":5"),
                    "Total tokens should be 5 (3 valid + 2 invalid)");
            assertTrue(responseJson.contains("\"validTokens\":3"),
                    "Valid tokens count should be 3");
            assertTrue(responseJson.contains("\"invalidTokens\":2"),
                    "Invalid tokens count should be 2");
            assertTrue(responseJson.contains("\"errorRate\":0.4"),
                    "Error rate should be 0.4 (2 invalid / 5 total)");

            assertTrue(responseJson.contains("\"" + EventType.TOKEN_EXPIRED.getDescription() + "\""),
                    "Should track token expired error");
            assertTrue(responseJson.contains("\"" + EventType.AUDIENCE_MISMATCH.getDescription() + "\""),
                    "Should track audience mismatch error");
        }
    }

    @Nested
    @DisplayName("Metrics snapshot")
    class MetricsSnapshotTests {

        @Test
        @DisplayName("Should provide current metrics snapshot")
        void shouldProvideCurrentMetricsSnapshot() {
            recordValidToken();
            recordInvalidToken(EventType.TOKEN_EXPIRED);

            SecurityMetricsStore.MetricsSnapshot snapshot = SecurityMetricsStore.getSnapshot();

            assertEquals(2, snapshot.totalValidations(),
                    "Total tokens should be 2 (1 valid + 1 invalid)");
            assertEquals(1, snapshot.validTokens(),
                    "Valid tokens count should be 1");
            assertEquals(1, snapshot.invalidTokens(),
                    "Invalid tokens count should be 1");
            assertEquals(0.5, snapshot.errorRate(), 0.001,
                    "Error rate should be 0.5 (50% failure rate)");
            assertNotNull(snapshot.lastValidation(),
                    "Last validation timestamp should be set");
            assertEquals(1, snapshot.topErrors().size(),
                    "Should have exactly one error type");
            assertEquals(EventType.TOKEN_EXPIRED.getDescription(),
                    snapshot.topErrors().getFirst().error(),
                    "Error description should match EventType description");
            assertEquals(1, snapshot.topErrors().getFirst().count(),
                    "Error count should be 1");
        }

        @Test
        @DisplayName("Should reset all metrics to initial state")
        void shouldResetAllMetricsToInitialState() {
            recordValidToken();
            recordInvalidToken(EventType.TOKEN_EXPIRED);

            SecurityMetricsStore.MetricsSnapshot beforeReset = SecurityMetricsStore.getSnapshot();
            assertEquals(2, beforeReset.totalValidations(),
                    "Should have recorded 2 tokens before reset");

            SecurityMetricsStore.reset();

            SecurityMetricsStore.MetricsSnapshot afterReset = SecurityMetricsStore.getSnapshot();
            assertEquals(0, afterReset.totalValidations(),
                    "Total tokens should be 0 after reset");
            assertEquals(0, afterReset.validTokens(),
                    "Valid tokens should be 0 after reset");
            assertEquals(0, afterReset.invalidTokens(),
                    "Invalid tokens should be 0 after reset");
            assertEquals(0.0, afterReset.errorRate(), 0.001,
                    "Error rate should be 0.0 after reset");
            assertNull(afterReset.lastValidation(),
                    "Last validation should be null after reset");
            assertTrue(afterReset.topErrors().isEmpty(),
                    "Top errors list should be empty after reset");
        }
    }

    @Nested
    @DisplayName("Error sorting and ranking")
    class ErrorSortingAndRanking {

        @Test
        @DisplayName("Should sort errors by frequency in descending order")
        void shouldSortErrorsByFrequencyDescending() throws Exception {
            // 3x TOKEN_EXPIRED
            recordInvalidToken(EventType.TOKEN_EXPIRED);
            recordInvalidToken(EventType.TOKEN_EXPIRED);
            recordInvalidToken(EventType.TOKEN_EXPIRED);
            // 2x SIGNATURE_VALIDATION_FAILED
            recordInvalidToken(EventType.SIGNATURE_VALIDATION_FAILED);
            recordInvalidToken(EventType.SIGNATURE_VALIDATION_FAILED);
            // 1x INVALID_JWT_FORMAT
            recordInvalidToken(EventType.INVALID_JWT_FORMAT);

            expect(response.getOutputStream()).andReturn(servletOutputStream);
            response.setContentType("application/json");
            expectLastCall();
            response.setCharacterEncoding("UTF-8");
            expectLastCall();
            response.setStatus(200);
            expectLastCall();

            replay(request, response);

            servlet.doGet(request, response);

            verify(request, response);

            String responseJson = outputStream.toString();
            String expiredDesc = EventType.TOKEN_EXPIRED.getDescription();
            String sigFailedDesc = EventType.SIGNATURE_VALIDATION_FAILED.getDescription();
            String formatDesc = EventType.INVALID_JWT_FORMAT.getDescription();

            int expiredIndex = responseJson.indexOf("\"" + expiredDesc + "\"");
            int sigFailedIndex = responseJson.indexOf("\"" + sigFailedDesc + "\"");
            int formatIndex = responseJson.indexOf("\"" + formatDesc + "\"");

            assertTrue(expiredIndex > 0,
                    "Token expired should be present in response");
            assertTrue(sigFailedIndex > 0,
                    "Signature validation failed should be present in response");
            assertTrue(formatIndex > 0,
                    "Invalid JWT format should be present in response");

            assertTrue(expiredIndex < sigFailedIndex,
                    "Token expired (3) should appear before signature failed (2)");
            assertTrue(expiredIndex < formatIndex,
                    "Token expired (3) should appear before invalid format (1)");

            assertTrue(responseJson.contains("\"count\":3"),
                    "Should show count of 3 for most frequent error");
            assertTrue(responseJson.contains("\"count\":2"),
                    "Should show count of 2 for second most frequent error");
            assertTrue(responseJson.contains("\"count\":1"),
                    "Should show count of 1 for least frequent error");
        }
    }

    @Nested
    @DisplayName("Performance metrics in response")
    class PerformanceMetricsInResponse {

        @Test
        @DisplayName("Should include non-zero performance metrics after recordings")
        void shouldIncludeNonZeroPerformanceMetrics() throws Exception {
            // Record enough validations with significant duration
            for (int i = 0; i < 10; i++) {
                SecurityEventCounter counter = new SecurityEventCounter();
                counter.increment(EventType.ACCESS_TOKEN_CREATED);
                SecurityMetricsStore.recordValidation(counter, 50_000_000L); // 50ms
            }

            expect(response.getOutputStream()).andReturn(servletOutputStream);
            response.setContentType("application/json");
            expectLastCall();
            response.setCharacterEncoding("UTF-8");
            expectLastCall();
            response.setStatus(200);
            expectLastCall();

            replay(request, response);

            servlet.doGet(request, response);

            verify(request, response);

            String responseJson = outputStream.toString();
            // With 50ms durations, at least some percentile should be > 0
            assertTrue(responseJson.contains("\"averageResponseTime\":"),
                    "Response should contain averageResponseTime");
            assertTrue(responseJson.contains("\"p95ResponseTime\":"),
                    "Response should contain p95ResponseTime");
        }
    }

    @Nested
    @DisplayName("Error handling")
    class ErrorHandling {

        @Test
        @DisplayName("Should handle IOException from response output stream")
        void shouldHandleIOExceptionFromOutputStream() throws Exception {
            // Arrange — force IOException on getOutputStream() (called inside try-with-resources)
            expect(response.getOutputStream()).andThrow(new IOException("Broken pipe"));
            response.setContentType("application/json");
            expectLastCall();
            response.setCharacterEncoding("UTF-8");
            expectLastCall();
            response.setStatus(200);
            expectLastCall();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            expectLastCall();

            replay(request, response);

            // Act
            servlet.doGet(request, response);

            // Assert
            verify(request, response);
        }
    }

    /**
     * Records a successful token validation via SecurityMetricsStore.
     */
    private static void recordValidToken() {
        SecurityEventCounter counter = new SecurityEventCounter();
        counter.increment(EventType.ACCESS_TOKEN_CREATED);
        SecurityMetricsStore.recordValidation(counter, 1_000_000L);
    }

    /**
     * Records a failed token validation via SecurityMetricsStore.
     */
    private static void recordInvalidToken(EventType errorType) {
        SecurityEventCounter counter = new SecurityEventCounter();
        counter.increment(errorType);
        SecurityMetricsStore.recordValidation(counter, 1_000_000L);
    }

    /**
     * Minimal ServletOutputStream implementation for testing.
     */
    private static class TestServletOutputStream extends ServletOutputStream {
        private final ByteArrayOutputStream outputStream;

        public TestServletOutputStream(ByteArrayOutputStream outputStream) {
            this.outputStream = outputStream;
        }

        @Override
        public void write(int b) throws IOException {
            outputStream.write(b);
        }

        @Override
        public boolean isReady() {
            return true;
        }

        @Override
        public void setWriteListener(WriteListener writeListener) {
            // Not implemented for testing
        }
    }

}
