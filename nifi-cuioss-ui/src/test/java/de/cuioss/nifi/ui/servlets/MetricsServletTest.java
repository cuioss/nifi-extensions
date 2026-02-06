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

import de.cuioss.test.generator.Generators;
import de.cuioss.test.generator.junit.EnableGeneratorController;
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
 */
@EnableGeneratorController
@ExtendWith(EasyMockExtension.class)
@DisplayName("MetricsServlet tests")
class MetricsServletTest {

    @TestSubject
    private MetricsServlet servlet = new MetricsServlet();

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    private ByteArrayOutputStream outputStream;
    private TestServletOutputStream servletOutputStream;

    @BeforeEach
    void setUp() {
        outputStream = new ByteArrayOutputStream();
        servletOutputStream = new TestServletOutputStream(outputStream);

        MetricsServlet.resetMetrics();
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
                MetricsServlet.recordValidToken();
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
            final String expiredError = "Token expired";
            final String signatureError = "Invalid signature";

            MetricsServlet.recordInvalidToken(expiredError);
            MetricsServlet.recordInvalidToken(signatureError);
            MetricsServlet.recordInvalidToken(expiredError);

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

            assertTrue(responseJson.contains("\"" + expiredError + "\""),
                    "Response should include expired token error message");
            assertTrue(responseJson.contains("\"" + signatureError + "\""),
                    "Response should include signature error message");
            assertTrue(responseJson.contains("\"count\":2"),
                    "Token expired error should have count of 2");
            assertTrue(responseJson.contains("\"count\":1"),
                    "Invalid signature error should have count of 1");
        }
    }

    @Nested
    @DisplayName("Mixed token metrics")
    class MixedTokenMetrics {

        @Test
        @DisplayName("Should calculate correct error rate for mixed tokens")
        void shouldCalculateCorrectErrorRateForMixedTokens() throws Exception {
            MetricsServlet.recordValidToken();
            MetricsServlet.recordValidToken();
            MetricsServlet.recordInvalidToken("Token expired");
            MetricsServlet.recordValidToken();
            MetricsServlet.recordInvalidToken("Invalid audience");

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

            assertTrue(responseJson.contains("\"Token expired\""),
                    "Should track 'Token expired' error");
            assertTrue(responseJson.contains("\"Invalid audience\""),
                    "Should track 'Invalid audience' error");
        }
    }

    @Nested
    @DisplayName("Static metrics methods")
    class StaticMetricsMethods {

        @Test
        @DisplayName("Should provide current metrics snapshot")
        void shouldProvideCurrentMetricsSnapshot() {
            final String testError = Generators.letterStrings(10, 20).next();

            MetricsServlet.recordValidToken();
            MetricsServlet.recordInvalidToken(testError);

            MetricsServlet.SecurityMetrics metrics = MetricsServlet.getCurrentMetrics();

            assertEquals(2, metrics.totalTokensValidated,
                    "Total tokens should be 2 (1 valid + 1 invalid)");
            assertEquals(1, metrics.validTokens,
                    "Valid tokens count should be 1");
            assertEquals(1, metrics.invalidTokens,
                    "Invalid tokens count should be 1");
            assertEquals(0.5, metrics.errorRate, 0.001,
                    "Error rate should be 0.5 (50% failure rate)");
            assertNotNull(metrics.lastValidation,
                    "Last validation timestamp should be set");
            assertEquals(1, metrics.topErrors.size(),
                    "Should have exactly one error type");
            assertEquals(testError, metrics.topErrors.getFirst().error,
                    "Error message should match recorded error");
            assertEquals(1, metrics.topErrors.getFirst().count,
                    "Error count should be 1");
        }

        @Test
        @DisplayName("Should reset all metrics to initial state")
        void shouldResetAllMetricsToInitialState() {
            MetricsServlet.recordValidToken();
            MetricsServlet.recordInvalidToken("Test error");

            MetricsServlet.SecurityMetrics beforeReset = MetricsServlet.getCurrentMetrics();
            assertEquals(2, beforeReset.totalTokensValidated,
                    "Should have recorded 2 tokens before reset");

            MetricsServlet.resetMetrics();

            MetricsServlet.SecurityMetrics afterReset = MetricsServlet.getCurrentMetrics();
            assertEquals(0, afterReset.totalTokensValidated,
                    "Total tokens should be 0 after reset");
            assertEquals(0, afterReset.validTokens,
                    "Valid tokens should be 0 after reset");
            assertEquals(0, afterReset.invalidTokens,
                    "Invalid tokens should be 0 after reset");
            assertEquals(0.0, afterReset.errorRate, 0.001,
                    "Error rate should be 0.0 after reset");
            assertNull(afterReset.lastValidation,
                    "Last validation should be null after reset");
            assertTrue(afterReset.topErrors.isEmpty(),
                    "Top errors list should be empty after reset");
        }
    }

    @Nested
    @DisplayName("Error sorting and ranking")
    class ErrorSortingAndRanking {

        @Test
        @DisplayName("Should sort errors by frequency in descending order")
        void shouldSortErrorsByFrequencyDescending() throws Exception {
            MetricsServlet.recordInvalidToken("Error A");
            MetricsServlet.recordInvalidToken("Error B");
            MetricsServlet.recordInvalidToken("Error A");
            MetricsServlet.recordInvalidToken("Error C");
            MetricsServlet.recordInvalidToken("Error A");
            MetricsServlet.recordInvalidToken("Error B");

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

            int errorAIndex = responseJson.indexOf("\"Error A\"");
            int errorBIndex = responseJson.indexOf("\"Error B\"");
            int errorCIndex = responseJson.indexOf("\"Error C\"");

            assertTrue(errorAIndex > 0,
                    "Error A should be present in response");
            assertTrue(errorBIndex > 0,
                    "Error B should be present in response");
            assertTrue(errorCIndex > 0,
                    "Error C should be present in response");

            assertTrue(errorAIndex < errorBIndex,
                    "Error A (3 occurrences) should appear before Error B (2 occurrences)");
            assertTrue(errorAIndex < errorCIndex,
                    "Error A (3 occurrences) should appear before Error C (1 occurrence)");

            assertTrue(responseJson.contains("\"count\":3"),
                    "Should show count of 3 for most frequent error");
            assertTrue(responseJson.contains("\"count\":2"),
                    "Should show count of 2 for second most frequent error");
            assertTrue(responseJson.contains("\"count\":1"),
                    "Should show count of 1 for least frequent error");
        }
    }

    @Nested
    @DisplayName("Edge cases")
    class EdgeCases {

        @Test
        @DisplayName("Should handle null and empty error messages gracefully")
        void shouldHandleNullAndEmptyErrorMessages() throws Exception {
            MetricsServlet.recordInvalidToken(null);
            MetricsServlet.recordInvalidToken("");
            MetricsServlet.recordInvalidToken("   ");
            MetricsServlet.recordInvalidToken("Valid error");

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
            assertTrue(responseJson.contains("\"totalTokensValidated\":4"),
                    "Should count all tokens including those with null/empty errors");
            assertTrue(responseJson.contains("\"invalidTokens\":4"),
                    "Should count all invalid tokens");

            assertTrue(responseJson.contains("\"Valid error\""),
                    "Should include non-empty error message");
            assertTrue(responseJson.contains("\"count\":1"),
                    "Valid error should have count of 1");

            int topErrorsStart = responseJson.indexOf("\"topErrors\":[");
            int topErrorsEnd = responseJson.indexOf("]", topErrorsStart);
            String topErrorsSection = responseJson.substring(topErrorsStart, topErrorsEnd + 1);

            int errorObjectCount = topErrorsSection.split("\"count\":").length - 1;
            assertEquals(1, errorObjectCount,
                    "Should only include valid error messages in top errors list");
        }
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