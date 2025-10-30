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
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.easymock.EasyMock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;

import static de.cuioss.test.generator.Generators.strings;
import static org.easymock.EasyMock.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Comprehensive unit tests for {@link ApiKeyAuthenticationFilter}.
 * Tests all authentication scenarios including E2E test endpoints,
 * test mode detection, processor ID validation, and error handling.
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
        void shouldInitializeFilterSuccessfully() throws ServletException {
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
    @DisplayName("E2E Test Endpoint Bypass Tests")
    class E2ETestEndpointTests {

        @Test
        @DisplayName("Should bypass authentication for E2E test endpoints")
        void shouldBypassAuthenticationForE2ETestEndpoints() throws IOException, ServletException {
            // Arrange
            String testEndpoint = "/api/token/" + strings().next();
            String httpMethod = "POST";

            expect(mockRequest.getServletPath()).andReturn(testEndpoint);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            mockChain.doFilter(mockRequest, mockResponse);
            expectLastCall().once();

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
        }

        @Test
        @DisplayName("Should bypass authentication when path starts with /api/token/")
        void shouldBypassAuthenticationForTokenPath() throws IOException, ServletException {
            // Arrange
            String testEndpoint = "/api/token/test-endpoint";
            String httpMethod = "GET";

            expect(mockRequest.getServletPath()).andReturn(testEndpoint);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
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
    @DisplayName("Processor ID Validation Tests")
    class ProcessorIdValidationTests {

        @Test
        @DisplayName("Should allow request with valid processor ID header")
        void shouldAllowRequestWithValidProcessorId() throws IOException, ServletException {
            // Arrange
            String processorId = strings().next();
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(processorId);
            expect(mockRequest.getRequestURI()).andReturn("/nifi-api/processors/jwt/validate");
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
        void shouldRejectRequestWhenProcessorIdIsNull() throws IOException, ServletException {
            // Arrange
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";
            StringWriter stringWriter = new StringWriter();
            PrintWriter writer = new PrintWriter(stringWriter);

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(null);
            expect(mockRequest.getRequestURI()).andReturn("/nifi-api/processors/jwt/validate");

            mockResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            expectLastCall().once();
            mockResponse.setContentType("application/json");
            expectLastCall().once();
            mockResponse.setCharacterEncoding("UTF-8");
            expectLastCall().once();
            expect(mockResponse.getWriter()).andReturn(writer);

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
            String response = stringWriter.toString();
            assertTrue(response.contains("\"error\""), "Response should contain error field");
            assertTrue(response.contains("\"valid\":false"), "Response should indicate invalid");
            assertTrue(response.contains("\"accessible\":false"), "Response should indicate not accessible");
        }

        @Test
        @DisplayName("Should reject request when processor ID is empty string")
        void shouldRejectRequestWhenProcessorIdIsEmpty() throws IOException, ServletException {
            // Arrange
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";
            StringWriter stringWriter = new StringWriter();
            PrintWriter writer = new PrintWriter(stringWriter);

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn("");
            expect(mockRequest.getRequestURI()).andReturn("/nifi-api/processors/jwt/validate");

            mockResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            expectLastCall().once();
            mockResponse.setContentType("application/json");
            expectLastCall().once();
            mockResponse.setCharacterEncoding("UTF-8");
            expectLastCall().once();
            expect(mockResponse.getWriter()).andReturn(writer);

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
            String response = stringWriter.toString();
            assertTrue(response.contains("Missing or empty processor ID header"), "Response should contain expected error message");
        }

        @Test
        @DisplayName("Should reject request when processor ID is whitespace")
        void shouldRejectRequestWhenProcessorIdIsWhitespace() throws IOException, ServletException {
            // Arrange
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";
            StringWriter stringWriter = new StringWriter();
            PrintWriter writer = new PrintWriter(stringWriter);

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn("   ");
            expect(mockRequest.getRequestURI()).andReturn("/nifi-api/processors/jwt/validate");

            mockResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            expectLastCall().once();
            mockResponse.setContentType("application/json");
            expectLastCall().once();
            mockResponse.setCharacterEncoding("UTF-8");
            expectLastCall().once();
            expect(mockResponse.getWriter()).andReturn(writer);

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
            String response = stringWriter.toString();
            assertTrue(response.contains("Missing or empty processor ID header"), "Response should contain expected error message");
        }
    }

    @Nested
    @DisplayName("Test Mode Detection Tests")
    class TestModeTests {

        @Test
        @DisplayName("Should allow empty processor ID in test mode for verify-token endpoint")
        void shouldAllowEmptyProcessorIdInTestMode() throws IOException, ServletException {
            // Arrange
            String servletPath = "/nifi-api/processors/jwt/verify-token";
            String requestURI = "/nifi-api/processors/jwt/verify-token";
            String httpMethod = "POST";

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(null);
            expect(mockRequest.getRequestURI()).andReturn(requestURI);
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
        @DisplayName("Should allow empty processor ID when URI contains verify-token")
        void shouldAllowEmptyProcessorIdForVerifyTokenURI() throws IOException, ServletException {
            // Arrange
            String servletPath = "/nifi-api/processors/jwt/verify-token";
            String requestURI = "/context/nifi-api/processors/jwt/verify-token?param=value";
            String httpMethod = "POST";

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn("");
            expect(mockRequest.getRequestURI()).andReturn(requestURI);
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
        @DisplayName("Should reject empty processor ID for non-verify-token endpoints")
        void shouldRejectEmptyProcessorIdForNonVerifyTokenEndpoints() throws IOException, ServletException {
            // Arrange
            String servletPath = "/nifi-api/processors/jwt/validate-jwks";
            String requestURI = "/nifi-api/processors/jwt/validate-jwks";
            String httpMethod = "POST";
            StringWriter stringWriter = new StringWriter();
            PrintWriter writer = new PrintWriter(stringWriter);

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(null);
            expect(mockRequest.getRequestURI()).andReturn(requestURI);

            mockResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            expectLastCall().once();
            mockResponse.setContentType("application/json");
            expectLastCall().once();
            mockResponse.setCharacterEncoding("UTF-8");
            expectLastCall().once();
            expect(mockResponse.getWriter()).andReturn(writer);

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
            String response = stringWriter.toString();
            assertTrue(response.contains("Missing or empty processor ID header"), "Response should contain expected error message");
        }
    }

    @Nested
    @DisplayName("Remote User Authentication Tests")
    class RemoteUserTests {

        @Test
        @DisplayName("Should log remote user when authenticated")
        void shouldLogRemoteUserWhenAuthenticated() throws IOException, ServletException {
            // Arrange
            String processorId = strings().next();
            String remoteUser = strings().next();
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(processorId);
            expect(mockRequest.getRequestURI()).andReturn("/nifi-api/processors/jwt/validate");
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
        void shouldHandleNullRemoteUserGracefully() throws IOException, ServletException {
            // Arrange
            String processorId = strings().next();
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(processorId);
            expect(mockRequest.getRequestURI()).andReturn("/nifi-api/processors/jwt/validate");
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
        @DisplayName("Should escape double quotes in error message")
        void shouldEscapeDoubleQuotesInErrorMessage() throws IOException, ServletException {
            // Arrange
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";
            StringWriter stringWriter = new StringWriter();
            PrintWriter writer = new PrintWriter(stringWriter);

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(null);
            expect(mockRequest.getRequestURI()).andReturn(servletPath);

            mockResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            expectLastCall().once();
            mockResponse.setContentType("application/json");
            expectLastCall().once();
            mockResponse.setCharacterEncoding("UTF-8");
            expectLastCall().once();
            expect(mockResponse.getWriter()).andReturn(writer);

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
            String response = stringWriter.toString();
            assertFalse(response.contains("\"\""), "Response should not contain unescaped double quotes");
            assertTrue(response.matches(".*\\{\"error\":\"[^\"]+\".*"), "Error message should be properly quoted");
        }

        @Test
        @DisplayName("Should return valid JSON structure in error response")
        void shouldReturnValidJsonStructureInErrorResponse() throws IOException, ServletException {
            // Arrange
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";
            StringWriter stringWriter = new StringWriter();
            PrintWriter writer = new PrintWriter(stringWriter);

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn("");
            expect(mockRequest.getRequestURI()).andReturn(servletPath);

            mockResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            expectLastCall().once();
            mockResponse.setContentType("application/json");
            expectLastCall().once();
            mockResponse.setCharacterEncoding("UTF-8");
            expectLastCall().once();
            expect(mockResponse.getWriter()).andReturn(writer);

            replay(mockRequest, mockResponse, mockChain);

            // Act
            filter.doFilter(mockRequest, mockResponse, mockChain);

            // Assert
            verify(mockRequest, mockResponse, mockChain);
            String response = stringWriter.toString();
            assertTrue(response.startsWith("{"), "JSON response should start with opening brace");
            assertTrue(response.endsWith("}"), "JSON response should end with closing brace");
            assertTrue(response.contains("\"error\":"), "JSON response should contain error field");
            assertTrue(response.contains("\"valid\":false"), "JSON response should contain valid field");
            assertTrue(response.contains("\"accessible\":false"), "JSON response should contain accessible field");
        }

        @Test
        @DisplayName("Should set correct HTTP headers for unauthorized response")
        void shouldSetCorrectHttpHeadersForUnauthorizedResponse() throws IOException, ServletException {
            // Arrange
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";
            StringWriter stringWriter = new StringWriter();
            PrintWriter writer = new PrintWriter(stringWriter);

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(null);
            expect(mockRequest.getRequestURI()).andReturn(servletPath);

            mockResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            expectLastCall().once();
            mockResponse.setContentType("application/json");
            expectLastCall().once();
            mockResponse.setCharacterEncoding("UTF-8");
            expectLastCall().once();
            expect(mockResponse.getWriter()).andReturn(writer);

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
        void shouldHandleNullServletPathGracefully() throws IOException, ServletException {
            // Arrange
            String processorId = strings().next();
            String httpMethod = "POST";

            expect(mockRequest.getServletPath()).andReturn(null);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(processorId);
            expect(mockRequest.getRequestURI()).andReturn("/some-uri");
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
        @DisplayName("Should handle null request URI gracefully")
        void shouldHandleNullRequestURIGracefully() throws IOException, ServletException {
            // Arrange
            String processorId = strings().next();
            String servletPath = "/nifi-api/processors/jwt/validate";
            String httpMethod = "POST";

            expect(mockRequest.getServletPath()).andReturn(servletPath);
            expect(mockRequest.getMethod()).andReturn(httpMethod);
            expect(mockRequest.getHeader(PROCESSOR_ID_HEADER)).andReturn(processorId);
            expect(mockRequest.getRequestURI()).andReturn(null);
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
}
