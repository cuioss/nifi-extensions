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
import de.cuioss.test.juli.LogAsserts;
import de.cuioss.test.juli.TestLogLevel;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.util.Map;

import static org.easymock.EasyMock.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link GatewayProxyServlet}.
 * <p>
 * Uses test subclasses to stub the outgoing HTTP calls
 * ({@code resolveGatewayPort}, {@code executeGatewayGet},
 * {@code executeGatewayRequest}), allowing isolated testing
 * of path validation, SSRF protection, and response formatting.
 */
@EnableTestLogger
@DisplayName("GatewayProxyServlet tests")
class GatewayProxyServletTest {

    private static final String SAMPLE_CONFIG_JSON = """
            {"component":"RestApiGatewayProcessor","port":9443,"routes":[]}""";
    private static final String SAMPLE_METRICS_JSON = """
            {"nifi_jwt_validations_total":42}""";
    private static final String PROCESSOR_ID = "d290f1ee-6c54-4b01-90e6-d701748f0851";

    private HttpServletRequest request;
    private HttpServletResponse response;
    private ByteArrayOutputStream outputStream;
    private TestServletOutputStream servletOutputStream;

    @BeforeEach
    void setUp() throws IOException {
        request = createMock(HttpServletRequest.class);
        response = createMock(HttpServletResponse.class);
        outputStream = new ByteArrayOutputStream();
        servletOutputStream = new TestServletOutputStream(outputStream);

        // Common expectations for response writing
        expect(response.getOutputStream()).andReturn(servletOutputStream).anyTimes();
        response.setContentType("application/json");
        expectLastCall().anyTimes();
        response.setCharacterEncoding("UTF-8");
        expectLastCall().anyTimes();
    }

    private GatewayProxyServlet createServlet() {
        return createServlet(SAMPLE_CONFIG_JSON);
    }

    private GatewayProxyServlet createServlet(String getResponse) {
        return new GatewayProxyServlet() {
            @Override
            protected int resolveGatewayPort(String processorId) {
                return 9443;
            }

            @Override
            protected String executeGatewayGet(String url, String accept) {
                return getResponse;
            }

            @Override
            protected GatewayResponse executeGatewayRequest(
                    String url, String method, Map<String, String> headers, String body) {
                return new GatewayResponse(200, "{\"result\":\"ok\"}", Map.of("Content-Type", "application/json"));
            }
        };
    }

    private GatewayProxyServlet createFailingServlet() {
        return new GatewayProxyServlet() {
            @Override
            protected int resolveGatewayPort(String processorId) throws IOException {
                throw new IOException("Connection refused");
            }

            @Override
            protected String executeGatewayGet(String url, String accept) throws IOException {
                throw new IOException("Connection refused");
            }

            @Override
            protected GatewayResponse executeGatewayRequest(
                    String url, String method, Map<String, String> headers, String body)
                    throws IOException {
                throw new IOException("Connection refused");
            }
        };
    }

    // -----------------------------------------------------------------------
    // GET — path validation
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("GET path validation")
    class GetPathValidation {

        @Test
        @DisplayName("Should reject null pathInfo")
        void shouldRejectNullPathInfo() throws Exception {
            expect(request.getPathInfo()).andReturn(null);
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            expectLastCall();
            replay(request, response);

            createServlet().doGet(request, response);

            verify(request, response);
            assertTrue(outputStream.toString().contains("Invalid management path"));
        }

        @Test
        @DisplayName("Should reject non-whitelisted path")
        void shouldRejectNonWhitelistedPath() throws Exception {
            expect(request.getPathInfo()).andReturn("/evil");
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            expectLastCall();
            replay(request, response);

            createServlet().doGet(request, response);

            verify(request, response);
            assertTrue(outputStream.toString().contains("Invalid management path"));
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN,
                    UILogMessages.WARN.GATEWAY_PROXY_PATH_REJECTED.resolveIdentifierString());
        }

        @Test
        @DisplayName("Should reject path traversal attempt")
        void shouldRejectPathTraversal() throws Exception {
            expect(request.getPathInfo()).andReturn("/../etc/passwd");
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            expectLastCall();
            replay(request, response);

            createServlet().doGet(request, response);

            verify(request, response);
            assertTrue(outputStream.toString().contains("Invalid management path"));
        }

        @Test
        @DisplayName("Should reject missing processor ID")
        void shouldRejectMissingProcessorId() throws Exception {
            expect(request.getPathInfo()).andReturn("/config");
            expect(request.getHeader("X-Processor-Id")).andReturn(null);
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            expectLastCall();
            replay(request, response);

            createServlet().doGet(request, response);

            verify(request, response);
            assertTrue(outputStream.toString().contains("Missing processor ID"));
        }

        @Test
        @DisplayName("Should reject blank processor ID")
        void shouldRejectBlankProcessorId() throws Exception {
            expect(request.getPathInfo()).andReturn("/config");
            expect(request.getHeader("X-Processor-Id")).andReturn("  ");
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            expectLastCall();
            replay(request, response);

            createServlet().doGet(request, response);

            verify(request, response);
            assertTrue(outputStream.toString().contains("Missing processor ID"));
        }
    }

    // -----------------------------------------------------------------------
    // GET — proxy behavior
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("GET management proxy")
    class GetManagementProxy {

        @Test
        @DisplayName("Should proxy /config endpoint")
        void shouldProxyConfigEndpoint() throws Exception {
            expect(request.getPathInfo()).andReturn("/config");
            expect(request.getHeader("X-Processor-Id")).andReturn(PROCESSOR_ID);
            response.setStatus(HttpServletResponse.SC_OK);
            expectLastCall();
            replay(request, response);

            createServlet(SAMPLE_CONFIG_JSON).doGet(request, response);

            verify(request, response);
            assertEquals(SAMPLE_CONFIG_JSON, outputStream.toString());
        }

        @Test
        @DisplayName("Should proxy /metrics endpoint")
        void shouldProxyMetricsEndpoint() throws Exception {
            expect(request.getPathInfo()).andReturn("/metrics");
            expect(request.getHeader("X-Processor-Id")).andReturn(PROCESSOR_ID);
            response.setStatus(HttpServletResponse.SC_OK);
            expectLastCall();
            replay(request, response);

            createServlet(SAMPLE_METRICS_JSON).doGet(request, response);

            verify(request, response);
            assertEquals(SAMPLE_METRICS_JSON, outputStream.toString());
        }

        @Test
        @DisplayName("Should return 503 when gateway is unavailable")
        void shouldReturn503WhenGatewayUnavailable() throws Exception {
            expect(request.getPathInfo()).andReturn("/config");
            expect(request.getHeader("X-Processor-Id")).andReturn(PROCESSOR_ID);
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            expectLastCall();
            replay(request, response);

            createFailingServlet().doGet(request, response);

            verify(request, response);
            assertTrue(outputStream.toString().contains("Gateway unavailable"));
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.ERROR,
                    UILogMessages.ERROR.GATEWAY_PROXY_FAILED.resolveIdentifierString());
        }
    }

    // -----------------------------------------------------------------------
    // POST — /test endpoint
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("POST /test endpoint")
    class PostTestEndpoint {

        @Test
        @DisplayName("Should reject non-test POST path")
        void shouldRejectNonTestPostPath() throws Exception {
            expect(request.getPathInfo()).andReturn("/config");
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            expectLastCall();
            replay(request, response);

            createServlet().doPost(request, response);

            verify(request, response);
            assertTrue(outputStream.toString().contains("Invalid path for POST"));
        }

        @Test
        @DisplayName("Should reject missing processor ID on POST")
        void shouldRejectMissingProcessorIdOnPost() throws Exception {
            expect(request.getPathInfo()).andReturn("/test");
            expect(request.getHeader("X-Processor-Id")).andReturn(null);
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            expectLastCall();
            replay(request, response);

            createServlet().doPost(request, response);

            verify(request, response);
            assertTrue(outputStream.toString().contains("Missing processor ID"));
        }

        @Test
        @DisplayName("Should proxy valid test request")
        void shouldProxyValidTestRequest() throws Exception {
            String testBody = """
                    {"path":"/api/users","method":"GET","headers":{"Authorization":"Bearer token123"}}""";

            expect(request.getPathInfo()).andReturn("/test");
            expect(request.getHeader("X-Processor-Id")).andReturn(PROCESSOR_ID);
            expect(request.getInputStream()).andReturn(new TestServletInputStream(testBody));
            response.setStatus(HttpServletResponse.SC_OK);
            expectLastCall();
            replay(request, response);

            createServlet().doPost(request, response);

            verify(request, response);
            String result = outputStream.toString();
            assertTrue(result.contains("\"status\":200"), "Should contain status: " + result);
            assertTrue(result.contains("result"), "Should contain body content: " + result);
        }

        @Test
        @DisplayName("Should reject missing path in test request")
        void shouldRejectMissingPath() throws Exception {
            String testBody = """
                    {"method":"GET","headers":{}}""";

            expect(request.getPathInfo()).andReturn("/test");
            expect(request.getHeader("X-Processor-Id")).andReturn(PROCESSOR_ID);
            expect(request.getInputStream()).andReturn(new TestServletInputStream(testBody));
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            expectLastCall();
            replay(request, response);

            createServlet().doPost(request, response);

            verify(request, response);
            assertTrue(outputStream.toString().contains("Missing 'path'"));
        }

        @Test
        @DisplayName("Should reject invalid JSON body")
        void shouldRejectInvalidJson() throws Exception {
            expect(request.getPathInfo()).andReturn("/test");
            expect(request.getHeader("X-Processor-Id")).andReturn(PROCESSOR_ID);
            expect(request.getInputStream()).andReturn(new TestServletInputStream("{ invalid }"));
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            expectLastCall();
            replay(request, response);

            createServlet().doPost(request, response);

            verify(request, response);
            assertTrue(outputStream.toString().contains("Invalid JSON"));
        }

        @Test
        @DisplayName("Should return 503 when gateway is unavailable for test")
        void shouldReturn503WhenGatewayUnavailableForTest() throws Exception {
            String testBody = """
                    {"path":"/api/users","method":"GET","headers":{}}""";

            expect(request.getPathInfo()).andReturn("/test");
            expect(request.getHeader("X-Processor-Id")).andReturn(PROCESSOR_ID);
            expect(request.getInputStream()).andReturn(new TestServletInputStream(testBody));
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            expectLastCall();
            replay(request, response);

            createFailingServlet().doPost(request, response);

            verify(request, response);
            assertTrue(outputStream.toString().contains("Gateway unavailable"));
        }

        @Test
        @DisplayName("Should handle null body in test request")
        void shouldHandleNullBody() throws Exception {
            String testBody = """
                    {"path":"/api/health","method":"GET","headers":{},"body":null}""";

            expect(request.getPathInfo()).andReturn("/test");
            expect(request.getHeader("X-Processor-Id")).andReturn(PROCESSOR_ID);
            expect(request.getInputStream()).andReturn(new TestServletInputStream(testBody));
            response.setStatus(HttpServletResponse.SC_OK);
            expectLastCall();
            replay(request, response);

            createServlet().doPost(request, response);

            verify(request, response);
            assertTrue(outputStream.toString().contains("\"status\":200"));
        }
    }

    // -----------------------------------------------------------------------
    // SSRF protection
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("SSRF protection")
    class SsrfProtection {

        @Test
        @DisplayName("Should allow localhost")
        void shouldAllowLocalhost() {
            assertTrue(GatewayProxyServlet.isLocalhostTarget(
                    URI.create("http://localhost:9443/config")));
        }

        @Test
        @DisplayName("Should allow 127.0.0.1")
        void shouldAllow127001() {
            assertTrue(GatewayProxyServlet.isLocalhostTarget(
                    URI.create("http://127.0.0.1:9443/config")));
        }

        @Test
        @DisplayName("Should allow IPv6 loopback")
        void shouldAllowIpv6Loopback() {
            assertTrue(GatewayProxyServlet.isLocalhostTarget(
                    URI.create("http://[::1]:9443/config")));
        }

        @Test
        @DisplayName("Should reject external hosts")
        void shouldRejectExternalHosts() {
            assertFalse(GatewayProxyServlet.isLocalhostTarget(
                    URI.create("http://evil.com:9443/config")));
        }

        @Test
        @DisplayName("Should reject internal network IPs")
        void shouldRejectInternalNetworkIps() {
            assertFalse(GatewayProxyServlet.isLocalhostTarget(
                    URI.create("http://192.168.1.1:9443/config")));
        }
    }

    // -----------------------------------------------------------------------
    // Allowed paths set
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("Allowed paths")
    class AllowedPaths {

        @Test
        @DisplayName("Should contain metrics and config")
        void shouldContainExpectedPaths() {
            assertTrue(GatewayProxyServlet.ALLOWED_MANAGEMENT_PATHS.contains("/metrics"));
            assertTrue(GatewayProxyServlet.ALLOWED_MANAGEMENT_PATHS.contains("/config"));
            assertEquals(2, GatewayProxyServlet.ALLOWED_MANAGEMENT_PATHS.size());
        }
    }

    // -----------------------------------------------------------------------
    // Test helpers
    // -----------------------------------------------------------------------

    private static class TestServletInputStream extends ServletInputStream {
        private final ByteArrayInputStream inputStream;

        public TestServletInputStream(String content) {
            this.inputStream = new ByteArrayInputStream(content.getBytes());
        }

        @Override
        public int read() throws IOException {
            return inputStream.read();
        }

        @Override
        public boolean isFinished() {
            return inputStream.available() == 0;
        }

        @Override
        public boolean isReady() {
            return true;
        }

        @Override
        public void setReadListener(ReadListener readListener) {
            // Not implemented for testing
        }
    }

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
