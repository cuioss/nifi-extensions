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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintWriter;
import java.security.Principal;
import java.util.Collection;
import java.util.Enumeration;
import java.util.Locale;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class MetricsServletTest {

    private MetricsServlet servlet;
    private TestHttpServletRequest request;
    private TestHttpServletResponse response;

    @BeforeEach
    void setUp() {
        servlet = new MetricsServlet();
        request = new TestHttpServletRequest();
        response = new TestHttpServletResponse();

        // Reset metrics before each test
        MetricsServlet.resetMetrics();
    }

    @Test
    void testInitialMetricsAllZero() throws Exception {
        // Act
        servlet.doGet(request, response);

        // Assert
        assertEquals(200, response.getStatus());
        assertEquals("application/json", response.getContentType());

        String responseJson = response.getOutputAsString();
        assertTrue(responseJson.contains("\"totalTokensValidated\":0"));
        assertTrue(responseJson.contains("\"validTokens\":0"));
        assertTrue(responseJson.contains("\"invalidTokens\":0"));
        assertTrue(responseJson.contains("\"errorRate\":0.0"));
        assertTrue(responseJson.contains("\"lastValidation\":\"\""));
        assertTrue(responseJson.contains("\"topErrors\":[]"));
    }

    @Test
    void testMetricsAfterValidTokens() throws Exception {
        // Arrange - Record some valid tokens
        MetricsServlet.recordValidToken();
        MetricsServlet.recordValidToken();
        MetricsServlet.recordValidToken();

        // Act
        servlet.doGet(request, response);

        // Assert
        assertEquals(200, response.getStatus());

        String responseJson = response.getOutputAsString();
        assertTrue(responseJson.contains("\"totalTokensValidated\":3"));
        assertTrue(responseJson.contains("\"validTokens\":3"));
        assertTrue(responseJson.contains("\"invalidTokens\":0"));
        assertTrue(responseJson.contains("\"errorRate\":0.0"));
        assertFalse(responseJson.contains("\"lastValidation\":\"\""));
    }

    @Test
    void testMetricsAfterInvalidTokens() throws Exception {
        // Arrange - Record some invalid tokens
        MetricsServlet.recordInvalidToken("Token expired");
        MetricsServlet.recordInvalidToken("Invalid signature");
        MetricsServlet.recordInvalidToken("Token expired");

        // Act
        servlet.doGet(request, response);

        // Assert
        assertEquals(200, response.getStatus());

        String responseJson = response.getOutputAsString();
        assertTrue(responseJson.contains("\"totalTokensValidated\":3"));
        assertTrue(responseJson.contains("\"validTokens\":0"));
        assertTrue(responseJson.contains("\"invalidTokens\":3"));
        assertTrue(responseJson.contains("\"errorRate\":1.0"));

        // Check top errors are included
        assertTrue(responseJson.contains("\"Token expired\""));
        assertTrue(responseJson.contains("\"Invalid signature\""));
        assertTrue(responseJson.contains("\"count\":2")); // Token expired appears twice
        assertTrue(responseJson.contains("\"count\":1")); // Invalid signature appears once
    }

    @Test
    void testMetricsWithMixedTokens() throws Exception {
        // Arrange - Record mixed valid and invalid tokens
        MetricsServlet.recordValidToken();
        MetricsServlet.recordValidToken();
        MetricsServlet.recordInvalidToken("Token expired");
        MetricsServlet.recordValidToken();
        MetricsServlet.recordInvalidToken("Invalid audience");

        // Act
        servlet.doGet(request, response);

        // Assert
        assertEquals(200, response.getStatus());

        String responseJson = response.getOutputAsString();
        assertTrue(responseJson.contains("\"totalTokensValidated\":5"));
        assertTrue(responseJson.contains("\"validTokens\":3"));
        assertTrue(responseJson.contains("\"invalidTokens\":2"));
        assertTrue(responseJson.contains("\"errorRate\":0.4")); // 2/5 = 0.4
        
        // Check error types are recorded
        assertTrue(responseJson.contains("\"Token expired\""));
        assertTrue(responseJson.contains("\"Invalid audience\""));
    }

    @Test
    void testCurrentMetricsStaticMethod() {
        // Arrange - Record some metrics
        MetricsServlet.recordValidToken();
        MetricsServlet.recordInvalidToken("Test error");

        // Act
        MetricsServlet.SecurityMetrics metrics = MetricsServlet.getCurrentMetrics();

        // Assert
        assertEquals(2, metrics.totalTokensValidated);
        assertEquals(1, metrics.validTokens);
        assertEquals(1, metrics.invalidTokens);
        assertEquals(0.5, metrics.errorRate, 0.001);
        assertNotNull(metrics.lastValidation);
        assertEquals(1, metrics.topErrors.size());
        assertEquals("Test error", metrics.topErrors.getFirst().error);
        assertEquals(1, metrics.topErrors.getFirst().count);
    }

    @Test
    void testResetMetrics() {
        // Arrange - Record some metrics
        MetricsServlet.recordValidToken();
        MetricsServlet.recordInvalidToken("Test error");

        // Verify metrics are recorded
        MetricsServlet.SecurityMetrics beforeReset = MetricsServlet.getCurrentMetrics();
        assertEquals(2, beforeReset.totalTokensValidated);

        // Act - Reset metrics
        MetricsServlet.resetMetrics();

        // Assert - Metrics should be back to zero
        MetricsServlet.SecurityMetrics afterReset = MetricsServlet.getCurrentMetrics();
        assertEquals(0, afterReset.totalTokensValidated);
        assertEquals(0, afterReset.validTokens);
        assertEquals(0, afterReset.invalidTokens);
        assertEquals(0.0, afterReset.errorRate, 0.001);
        assertNull(afterReset.lastValidation);
        assertTrue(afterReset.topErrors.isEmpty());
    }

    @Test
    void testTopErrorsSorting() throws Exception {
        // Arrange - Record errors with different frequencies
        MetricsServlet.recordInvalidToken("Error A");
        MetricsServlet.recordInvalidToken("Error B");
        MetricsServlet.recordInvalidToken("Error A");
        MetricsServlet.recordInvalidToken("Error C");
        MetricsServlet.recordInvalidToken("Error A");
        MetricsServlet.recordInvalidToken("Error B");

        // Act
        servlet.doGet(request, response);

        // Assert
        String responseJson = response.getOutputAsString();

        // Error A should appear first (3 occurrences)
        int errorAIndex = responseJson.indexOf("\"Error A\"");
        int errorBIndex = responseJson.indexOf("\"Error B\"");
        int errorCIndex = responseJson.indexOf("\"Error C\"");

        assertTrue(errorAIndex > 0);
        assertTrue(errorBIndex > 0);
        assertTrue(errorCIndex > 0);

        // Error A should come before Error B and C in the response
        assertTrue(errorAIndex < errorBIndex);
        assertTrue(errorAIndex < errorCIndex);

        // Check counts
        assertTrue(responseJson.contains("\"count\":3")); // Error A
        assertTrue(responseJson.contains("\"count\":2")); // Error B
        assertTrue(responseJson.contains("\"count\":1")); // Error C
    }

    @Test
    void testErrorWithNullMessage() throws Exception {
        // Arrange - Record error with null message (should be ignored)
        MetricsServlet.recordInvalidToken(null);
        MetricsServlet.recordInvalidToken("");
        MetricsServlet.recordInvalidToken("   ");
        MetricsServlet.recordInvalidToken("Valid error");

        // Act
        servlet.doGet(request, response);

        // Assert
        String responseJson = response.getOutputAsString();
        assertTrue(responseJson.contains("\"totalTokensValidated\":4"));
        assertTrue(responseJson.contains("\"invalidTokens\":4"));

        // Only the "Valid error" should appear in top errors
        assertTrue(responseJson.contains("\"Valid error\""));
        assertTrue(responseJson.contains("\"count\":1"));

        // The topErrors array should only have one entry
        int topErrorsStart = responseJson.indexOf("\"topErrors\":[");
        int topErrorsEnd = responseJson.indexOf("]", topErrorsStart);
        String topErrorsSection = responseJson.substring(topErrorsStart, topErrorsEnd + 1);

        // Count the number of error objects (each has a "count" field)
        int errorObjectCount = topErrorsSection.split("\"count\":").length - 1;
        assertEquals(1, errorObjectCount);
    }

    // Test helper classes (reuse from JwtVerificationServletTest)
    private static class TestHttpServletRequest implements jakarta.servlet.http.HttpServletRequest {
        @Override
        public String getAuthType() {
            return null;
        }

        @Override
        public jakarta.servlet.http.Cookie[] getCookies() {
            return new jakarta.servlet.http.Cookie[0];
        }

        @Override
        public long getDateHeader(String name) {
            return 0;
        }

        @Override
        public String getHeader(String name) {
            return null;
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            return null;
        }

        @Override
        public Enumeration<String> getHeaderNames() {
            return null;
        }

        @Override
        public int getIntHeader(String name) {
            return 0;
        }

        @Override
        public String getMethod() {
            return "GET";
        }

        @Override
        public String getPathInfo() {
            return null;
        }

        @Override
        public String getPathTranslated() {
            return null;
        }

        @Override
        public String getContextPath() {
            return null;
        }

        @Override
        public String getQueryString() {
            return null;
        }

        @Override
        public String getRemoteUser() {
            return null;
        }

        @Override
        public boolean isUserInRole(String role) {
            return false;
        }

        @Override
        public Principal getUserPrincipal() {
            return null;
        }

        @Override
        public String getRequestedSessionId() {
            return null;
        }

        @Override
        public String getRequestURI() {
            return null;
        }

        @Override
        public StringBuffer getRequestURL() {
            return null;
        }

        @Override
        public String getServletPath() {
            return null;
        }

        @Override
        public jakarta.servlet.http.HttpSession getSession(boolean create) {
            return null;
        }

        @Override
        public jakarta.servlet.http.HttpSession getSession() {
            return null;
        }

        @Override
        public String changeSessionId() {
            return null;
        }

        @Override
        public boolean isRequestedSessionIdValid() {
            return false;
        }

        @Override
        public boolean isRequestedSessionIdFromCookie() {
            return false;
        }

        @Override
        public boolean isRequestedSessionIdFromURL() {
            return false;
        }

        @Override
        public boolean authenticate(jakarta.servlet.http.HttpServletResponse response) {
            return false;
        }

        @Override
        public void login(String username, String password) {
        }

        @Override
        public void logout() {
        }

        @Override
        public Collection<jakarta.servlet.http.Part> getParts() {
            return null;
        }

        @Override
        public jakarta.servlet.http.Part getPart(String name) {
            return null;
        }

        @Override
        public <T extends jakarta.servlet.http.HttpUpgradeHandler> T upgrade(Class<T> handlerClass) {
            return null;
        }

        @Override
        public Object getAttribute(String name) {
            return null;
        }

        @Override
        public Enumeration<String> getAttributeNames() {
            return null;
        }

        @Override
        public String getCharacterEncoding() {
            return null;
        }

        @Override
        public void setCharacterEncoding(String env) {
        }

        @Override
        public int getContentLength() {
            return 0;
        }

        @Override
        public long getContentLengthLong() {
            return 0;
        }

        @Override
        public String getContentType() {
            return null;
        }

        @Override
        public jakarta.servlet.ServletInputStream getInputStream() {
            return null;
        }

        @Override
        public String getParameter(String name) {
            return null;
        }

        @Override
        public Enumeration<String> getParameterNames() {
            return null;
        }

        @Override
        public String[] getParameterValues(String name) {
            return null;
        }

        @Override
        public Map<String, String[]> getParameterMap() {
            return null;
        }

        @Override
        public String getProtocol() {
            return null;
        }

        @Override
        public String getScheme() {
            return null;
        }

        @Override
        public String getServerName() {
            return null;
        }

        @Override
        public int getServerPort() {
            return 0;
        }

        @Override
        public BufferedReader getReader() {
            return null;
        }

        @Override
        public String getRemoteAddr() {
            return null;
        }

        @Override
        public String getRemoteHost() {
            return null;
        }

        @Override
        public void setAttribute(String name, Object o) {
        }

        @Override
        public void removeAttribute(String name) {
        }

        @Override
        public Locale getLocale() {
            return null;
        }

        @Override
        public Enumeration<Locale> getLocales() {
            return null;
        }

        @Override
        public boolean isSecure() {
            return false;
        }

        @Override
        public jakarta.servlet.RequestDispatcher getRequestDispatcher(String path) {
            return null;
        }

        @Override
        public int getRemotePort() {
            return 0;
        }

        @Override
        public String getLocalName() {
            return null;
        }

        @Override
        public String getLocalAddr() {
            return null;
        }

        @Override
        public int getLocalPort() {
            return 0;
        }

        @Override
        public jakarta.servlet.ServletContext getServletContext() {
            return null;
        }

        @Override
        public jakarta.servlet.AsyncContext startAsync() {
            return null;
        }

        @Override
        public jakarta.servlet.AsyncContext startAsync(jakarta.servlet.ServletRequest servletRequest, jakarta.servlet.ServletResponse servletResponse) {
            return null;
        }

        @Override
        public boolean isAsyncStarted() {
            return false;
        }

        @Override
        public boolean isAsyncSupported() {
            return false;
        }

        @Override
        public jakarta.servlet.AsyncContext getAsyncContext() {
            return null;
        }

        @Override
        public jakarta.servlet.DispatcherType getDispatcherType() {
            return null;
        }

        @Override
        public String getRequestId() {
            return null;
        }

        @Override
        public String getProtocolRequestId() {
            return null;
        }

        @Override
        public jakarta.servlet.ServletConnection getServletConnection() {
            return null;
        }

        @Override
        public jakarta.servlet.http.HttpServletMapping getHttpServletMapping() {
            return null;
        }
    }

    private static class TestHttpServletResponse implements jakarta.servlet.http.HttpServletResponse {
        private final ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        private final TestServletOutputStream servletOutputStream = new TestServletOutputStream(outputStream);
        private int status = 200;
        private String contentType;
        private String characterEncoding = "UTF-8";

        public String getOutputAsString() {
            return outputStream.toString();
        }

        @Override
        public int getStatus() {
            return status;
        }

        @Override
        public void setStatus(int sc) {
            this.status = sc;
        }

        @Override
        public String getContentType() {
            return contentType;
        }

        @Override
        public void setContentType(String type) {
            this.contentType = type;
        }

        @Override
        public void setCharacterEncoding(String charset) {
            this.characterEncoding = charset;
        }

        @Override
        public String getCharacterEncoding() {
            return characterEncoding;
        }

        @Override
        public jakarta.servlet.ServletOutputStream getOutputStream() throws IOException {
            return servletOutputStream;
        }

        // Minimal implementations for other methods
        @Override
        public void addCookie(jakarta.servlet.http.Cookie cookie) {
        }

        @Override
        public boolean containsHeader(String name) {
            return false;
        }

        @Override
        public String encodeURL(String url) {
            return url;
        }

        @Override
        public String encodeRedirectURL(String url) {
            return url;
        }

        @Override
        public void sendError(int sc, String msg) {
        }

        @Override
        public void sendError(int sc) {
        }

        @Override
        public void sendRedirect(String location) {
        }

        @Override
        public void setDateHeader(String name, long date) {
        }

        @Override
        public void addDateHeader(String name, long date) {
        }

        @Override
        public void setHeader(String name, String value) {
        }

        @Override
        public void addHeader(String name, String value) {
        }

        @Override
        public void setIntHeader(String name, int value) {
        }

        @Override
        public void addIntHeader(String name, int value) {
        }

        @Override
        public PrintWriter getWriter() {
            return null;
        }

        @Override
        public void setContentLength(int len) {
        }

        @Override
        public void setContentLengthLong(long len) {
        }

        @Override
        public void setBufferSize(int size) {
        }

        @Override
        public int getBufferSize() {
            return 0;
        }

        @Override
        public void flushBuffer() {
        }

        @Override
        public void resetBuffer() {
        }

        @Override
        public boolean isCommitted() {
            return false;
        }

        @Override
        public void reset() {
        }

        @Override
        public void setLocale(Locale loc) {
        }

        @Override
        public Locale getLocale() {
            return null;
        }

        @Override
        public Collection<String> getHeaders(String name) {
            return null;
        }

        @Override
        public Collection<String> getHeaderNames() {
            return null;
        }

        @Override
        public String getHeader(String name) {
            return null;
        }
    }

    private static class TestServletOutputStream extends jakarta.servlet.ServletOutputStream {
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
        public void setWriteListener(jakarta.servlet.WriteListener writeListener) {
            // Not implemented for testing
        }
    }
}