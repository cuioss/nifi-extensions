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
    }

    @Nested
    @DisplayName("Metrics response")
    class MetricsResponse {

        @Test
        @DisplayName("Should return empty metrics response")
        void shouldReturnEmptyMetricsResponse() throws Exception {
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
                    "Total tokens validated should be 0");
            assertTrue(responseJson.contains("\"validTokens\":0"),
                    "Valid tokens count should be 0");
            assertTrue(responseJson.contains("\"invalidTokens\":0"),
                    "Invalid tokens count should be 0");
            assertTrue(responseJson.contains("\"errorRate\":0.0"),
                    "Error rate should be 0.0");
            assertTrue(responseJson.contains("\"lastValidation\":\"\""),
                    "Last validation should be empty");
            assertTrue(responseJson.contains("\"topErrors\":[]"),
                    "Top errors list should be empty");
            assertTrue(responseJson.contains("\"activeIssuers\":0"),
                    "Active issuers should be 0");
            assertTrue(responseJson.contains("\"issuerMetrics\":[]"),
                    "Issuer metrics should be empty");
        }
    }

    @Nested
    @DisplayName("Error handling")
    class ErrorHandling {

        @Test
        @DisplayName("Should handle IOException from response output stream")
        void shouldHandleIOExceptionFromOutputStream() throws Exception {
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

            servlet.doGet(request, response);

            verify(request, response);
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
