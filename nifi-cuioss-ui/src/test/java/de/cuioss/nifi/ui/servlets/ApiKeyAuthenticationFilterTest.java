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
import jakarta.servlet.FilterChain;
import jakarta.servlet.FilterConfig;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.UUID;

import static org.easymock.EasyMock.*;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Comprehensive unit tests for {@link ApiKeyAuthenticationFilter}.
 * Tests authentication scenarios including processor ID validation and error handling.
 */
/**
 * Tests for {@link ApiKeyAuthenticationFilter}.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/security.adoc">Security Specification</a>
 */
@EnableGeneratorController
@DisplayName("API Key Authentication Filter Tests")
class ApiKeyAuthenticationFilterTest {

    private static final String PROCESSOR_ID_HEADER = "X-Processor-Id";

    private ApiKeyAuthenticationFilter filter;
    private HttpServletRequest mockRequest;
    private HttpServletResponse mockResponse;
    private FilterChain mockChain;

    @BeforeEach
    void setUp() {
        filter = new ApiKeyAuthenticationFilter();
        mockRequest = createMock(HttpServletRequest.class);
        mockResponse = createMock(HttpServletResponse.class);
        mockChain = createMock(FilterChain.class);
    }

    @Nested
    @DisplayName("Filter Lifecycle Tests")
    class FilterLifecycleTests {

        @Test
        @DisplayName("Should initialize filter without errors")
        void shouldInitializeFilterSuccessfully() throws Exception {
            // Arrange
            FilterConfig mockConfig = createMock(FilterConfig.class);

            // Act
            filter.init(mockConfig);

            // Assert
            // No exception thrown - filter initialized successfully
            assertNotNull(filter, "Filter should be initialized");
        }

        @Test
        @DisplayName("Should destroy filter without errors")
        void shouldDestroyFilterSuccessfully() {
            // Arrange
            // Filter is already initialized in setUp

            // Act
            filter.destroy();

            // Assert
            // No exception thrown - filter destroyed successfully
            assertNotNull(filter, "Filter should exist after destroy");
        }
    }

    @Nested
    @DisplayName("Processor ID Validation Tests")
    class ProcessorIdValidationTests {

        @Test
        @DisplayName("Should allow request with valid processor ID header")
        void shouldAllowRequestWithValidProcessorId() throws Exception {
            // Arrange
            String processorId = UUID.randomUUID().toString();
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(processorId);
            expect(mockRequest.getRemoteUser()).andReturn(null);
            mockChain.doFilter(mockRequest, mockResponse);
            expectLastCall().once();

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
        }

        @Test
        @DisplayName("Should reject request when processor ID is null")
        void shouldRejectRequestWhenProcessorIdIsNull() throws Exception {
            // Arrange
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(null);

            mockResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            expectLastCall().once();
            mockResponse.setContentType("application/json");
            expectLastCall().once();
            mockResponse.setCharacterEncoding("UTF-8");
            expectLastCall().once();
            expect(mockResponse.getOutputStream()).andReturn(new TestServletOutputStream(outputStream));

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
            String response = outputStream.toString();
            assertTrue(response.contains("\"error\""), "Response should contain error field");
            assertTrue(response.contains("\"valid\":false"), "Response should indicate invalid");
            assertTrue(response.contains("\"accessible\":false"), "Response should indicate not accessible");
        }

        @Test
        @DisplayName("Should reject request when processor ID is empty string")
        void shouldRejectRequestWhenProcessorIdIsEmpty() throws Exception {
            // Arrange
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn("");

            mockResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            expectLastCall().once();
            mockResponse.setContentType("application/json");
            expectLastCall().once();
            mockResponse.setCharacterEncoding("UTF-8");
            expectLastCall().once();
            expect(mockResponse.getOutputStream()).andReturn(new TestServletOutputStream(outputStream));

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
            String response = outputStream.toString();
            assertTrue(response.contains("Missing or empty processor ID header"), "Response should contain expected error message");
        }

        @Test
        @DisplayName("Should reject request when processor ID is whitespace")
        void shouldRejectRequestWhenProcessorIdIsWhitespace() throws Exception {
            // Arrange
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn("   ");

            mockResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            expectLastCall().once();
            mockResponse.setContentType("application/json");
            expectLastCall().once();
            mockResponse.setCharacterEncoding("UTF-8");
            expectLastCall().once();
            expect(mockResponse.getOutputStream()).andReturn(new TestServletOutputStream(outputStream));

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
            String response = outputStream.toString();
            assertTrue(response.contains("Missing or empty processor ID header"), "Response should contain expected error message");
        }

        @Test
        @DisplayName("Should reject request when processor ID is not a valid UUID")
        void shouldRejectRequestWhenProcessorIdIsNotUuid() throws Exception {
            // Arrange
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn("not-a-valid-uuid");

            mockResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            expectLastCall().once();
            mockResponse.setContentType("application/json");
            expectLastCall().once();
            mockResponse.setCharacterEncoding("UTF-8");
            expectLastCall().once();
            expect(mockResponse.getOutputStream()).andReturn(new TestServletOutputStream(outputStream));

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
            String response = outputStream.toString();
            assertTrue(response.contains("Invalid processor ID format"), "Response should contain format error message");
        }

        @Test
        @DisplayName("Should reject empty processor ID on verify-token endpoint")
        void shouldRejectEmptyProcessorIdOnVerifyToken() throws Exception {
            // Arrange
            String servletPath = "/nifi-api/processors/jwt/verify-token";
            String httpMethod = "POST";
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(null);

            mockResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            expectLastCall().once();
            mockResponse.setContentType("application/json");
            expectLastCall().once();
            mockResponse.setCharacterEncoding("UTF-8");
            expectLastCall().once();
            expect(mockResponse.getOutputStream()).andReturn(new TestServletOutputStream(outputStream));

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
            String response = outputStream.toString();
            assertTrue(response.contains("Missing or empty processor ID header"), "Response should contain expected error message");
        }
    }

    @Nested
    @DisplayName("Remote User Authentication Tests")
    class RemoteUserTests {

        @Test
        @DisplayName("Should log remote user when authenticated")
        void shouldLogRemoteUserWhenAuthenticated() throws Exception {
            // Arrange
            String processorId = UUID.randomUUID().toString();
            String remoteUser = "test-user-" + System.nanoTime();
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(processorId);
            expect(mockRequest.getRemoteUser()).andReturn(remoteUser);
            mockChain.doFilter(mockRequest, mockResponse);
            expectLastCall().once();

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
        }

        @Test
        @DisplayName("Should handle null remote user gracefully")
        void shouldHandleNullRemoteUserGracefully() throws Exception {
            // Arrange
            String processorId = UUID.randomUUID().toString();
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(processorId);
            expect(mockRequest.getRemoteUser()).andReturn(null);
            mockChain.doFilter(mockRequest, mockResponse);
            expectLastCall().once();

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
        }
    }

    @Nested
    @DisplayName("JSON Error Response Tests")
    class JsonErrorResponseTests {

        @Test
        @DisplayName("Should return valid JSON structure in error response")
        void shouldReturnValidJsonStructureInErrorResponse() throws Exception {
            // Arrange
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn("");

            mockResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            expectLastCall().once();
            mockResponse.setContentType("application/json");
            expectLastCall().once();
            mockResponse.setCharacterEncoding("UTF-8");
            expectLastCall().once();
            expect(mockResponse.getOutputStream()).andReturn(new TestServletOutputStream(outputStream));

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
            String response = outputStream.toString();
            assertTrue(response.startsWith("{"), "JSON response should start with opening brace");
            assertTrue(response.endsWith("}"), "JSON response should end with closing brace");
            assertTrue(response.contains("\"error\":"), "JSON response should contain error field");
            assertTrue(response.contains("\"valid\":false"), "JSON response should contain valid field");
            assertTrue(response.contains("\"accessible\":false"), "JSON response should contain accessible field");
        }

        @Test
        @DisplayName("Should set correct HTTP headers for unauthorized response")
        void shouldSetCorrectHttpHeadersForUnauthorizedResponse() throws Exception {
            // Arrange
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(null);

            mockResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            expectLastCall().once();
            mockResponse.setContentType("application/json");
            expectLastCall().once();
            mockResponse.setCharacterEncoding("UTF-8");
            expectLastCall().once();
            expect(mockResponse.getOutputStream()).andReturn(new TestServletOutputStream(outputStream));

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
        }
    }

    @Nested
    @DisplayName("Edge Case Tests")
    class EdgeCaseTests {

        @Test
        @DisplayName("Should handle null servlet path gracefully")
        void shouldHandleNullServletPathGracefully() throws Exception {
            // Arrange
            String processorId = UUID.randomUUID().toString();
            String httpMethod = "POST";

            expect(mockRequest.getServletPath()).andReturn(null);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(processorId);
            expect(mockRequest.getRemoteUser()).andReturn(null);
            mockChain.doFilter(mockRequest, mockResponse);
            expectLastCall().once();

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
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
