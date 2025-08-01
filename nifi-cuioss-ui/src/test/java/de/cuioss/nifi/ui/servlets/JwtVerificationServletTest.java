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

import de.cuioss.nifi.ui.service.JwtValidationService;
import de.cuioss.nifi.ui.service.JwtValidationService.TokenValidationResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.easymock.EasyMock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Map;

import static org.easymock.EasyMock.*;
import static org.junit.jupiter.api.Assertions.*;

class JwtVerificationServletTest {

    private JwtValidationService validationService;
    private HttpServletRequest request;
    private HttpServletResponse response;
    private JwtVerificationServlet servlet;
    private ByteArrayOutputStream responseOutput;

    @BeforeEach
    void setUp() throws IOException {
        validationService = createMock(JwtValidationService.class);
        request = createMock(HttpServletRequest.class);
        response = createMock(HttpServletResponse.class);
        servlet = new JwtVerificationServlet(validationService);
        responseOutput = new ByteArrayOutputStream();

        expect(response.getOutputStream()).andReturn(new TestServletOutputStream(responseOutput)).anyTimes();
        response.setContentType("application/json");
        expectLastCall().anyTimes();
        response.setCharacterEncoding("UTF-8");
        expectLastCall().anyTimes();
    }

    @Test
    void testValidTokenVerification() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/verify-token").anyTimes();
        expect(request.getRequestURI()).andReturn("/nifi-api/processors/jwt/verify-token").anyTimes();

        TokenValidationResult validResult = TokenValidationResult.success(null);
        validResult.setTestClaims(Map.of("sub", "user123", "iss", "test-issuer"));
        validResult.setIssuer("test-issuer");
        validResult.setScopes(List.of("read", "write"));
        validResult.setRoles(List.of("admin"));
        validResult.setAuthorized(true);

        expect(validationService.verifyToken("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...", "test-processor-id"))
                .andReturn(validResult);

        response.setStatus(200);
        expectLastCall();

        replay(validationService, request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(validationService, request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":true"));
        assertTrue(responseJson.contains("\"authorized\":true"));
        assertTrue(responseJson.contains("\"issuer\":\"test-issuer\""));
    }

    @Test
    void testInvalidTokenVerification() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "invalid-token",
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/verify-token").anyTimes();
        expect(request.getRequestURI()).andReturn("/nifi-api/processors/jwt/verify-token").anyTimes();

        TokenValidationResult invalidResult = TokenValidationResult.failure("Invalid token signature");
        expect(validationService.verifyToken("invalid-token", "test-processor-id"))
                .andReturn(invalidResult);

        response.setStatus(400);
        expectLastCall();

        replay(validationService, request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(validationService, request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("\"error\":\"Invalid token signature\""));
    }

    @Test
    void testExpiredTokenVerification() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "expired-token",
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/verify-token").anyTimes();
        expect(request.getRequestURI()).andReturn("/nifi-api/processors/jwt/verify-token").anyTimes();

        TokenValidationResult expiredResult = TokenValidationResult.failure("Token expired at 2025-01-01T00:00:00Z");
        expect(validationService.verifyToken("expired-token", "test-processor-id"))
                .andReturn(expiredResult);

        response.setStatus(401);
        expectLastCall();

        replay(validationService, request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(validationService, request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("expired"));
    }

    @Test
    void testMissingTokenField() throws Exception {
        // Arrange
        String requestJson = """
            {
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));

        response.setStatus(400);
        expectLastCall();

        replay(validationService, request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(validationService, request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("Missing required field: token"));
    }

    @Test
    void testMissingProcessorIdForNonE2ETest() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "test-token"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/verify-token").anyTimes();
        expect(request.getRequestURI()).andReturn("/nifi-api/processors/jwt/verify-token").anyTimes();

        response.setStatus(400);
        expectLastCall();

        replay(validationService, request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(validationService, request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("Processor ID cannot be empty"));
    }

    @Test
    void testE2ETestCompatibility() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "test-token",
                "issuer": "expected-issuer",
                "requiredScopes": ["read"],
                "requiredRoles": ["user"]
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn("/api/token/verify").anyTimes();
        expect(request.getRequestURI()).andReturn("/api/token/verify").anyTimes();

        TokenValidationResult validResult = TokenValidationResult.success(null);
        validResult.setTestClaims(Map.of("sub", "user123", "iss", "expected-issuer"));
        validResult.setIssuer("expected-issuer");
        validResult.setScopes(List.of("read", "write"));
        validResult.setRoles(List.of("user", "admin"));
        validResult.setAuthorized(true);

        expect(validationService.verifyToken("test-token", null))
                .andReturn(validResult);

        response.setStatus(200);
        expectLastCall();

        replay(validationService, request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(validationService, request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":true"));
        assertTrue(responseJson.contains("\"authorized\":true"));
    }

    @Test
    void testInvalidJsonRequest() throws Exception {
        // Arrange
        String invalidJson = "{ invalid json }";
        expect(request.getInputStream()).andReturn(new TestServletInputStream(invalidJson));

        response.setStatus(400);
        expectLastCall();

        replay(validationService, request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(validationService, request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("Invalid JSON format"));
    }

    @Test
    void testServiceException() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "test-token",
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/verify-token").anyTimes();
        expect(request.getRequestURI()).andReturn("/nifi-api/processors/jwt/verify-token").anyTimes();

        expect(validationService.verifyToken("test-token", "test-processor-id"))
                .andThrow(new IllegalStateException("Service not available"));

        response.setStatus(500);
        expectLastCall();

        replay(validationService, request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(validationService, request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("Service not available"));
    }

    // Helper classes for testing
    private static class TestServletInputStream extends jakarta.servlet.ServletInputStream {
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
        public void setReadListener(jakarta.servlet.ReadListener readListener) {
            // Not implemented for testing
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