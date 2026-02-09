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
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.easymock.EasyMock.*;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests for {@link JwtVerificationServlet}.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 */
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

        expect(request.getContentLength()).andReturn(100).anyTimes();
        expect(response.getOutputStream()).andReturn(new TestServletOutputStream(responseOutput)).anyTimes();
        response.setContentType("application/json");
        expectLastCall().anyTimes();
        response.setCharacterEncoding("UTF-8");
        expectLastCall().anyTimes();
    }

    @Test
    void validTokenVerification() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));

        TokenValidationResult validResult = TokenValidationResult.success(null);
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
    void invalidTokenVerification() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "invalid-token",
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));

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
    void expiredTokenVerification() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "expired-token",
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));

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
    void missingTokenField() throws Exception {
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
    void missingProcessorId() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "test-token"
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
        assertTrue(responseJson.contains("Processor ID cannot be empty"));
    }

    @Test
    void invalidJsonRequest() throws Exception {
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
    void serviceException() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "test-token",
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));

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

    @Test
    void emptyTokenVerification() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "",
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
        assertTrue(responseJson.contains("Token cannot be empty"));
    }

    @Test
    void emptyProcessorIdVerification() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "test-token",
                "processorId": ""
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
        assertTrue(responseJson.contains("Processor ID cannot be empty"));
    }

    @Test
    void requestBodyTooLarge() throws Exception {
        // Arrange - reset mocks to change contentLength behavior
        reset(request, response, validationService);
        responseOutput = new ByteArrayOutputStream();

        expect(request.getContentLength()).andReturn(2 * 1024 * 1024).anyTimes();
        expect(response.getOutputStream()).andReturn(new TestServletOutputStream(responseOutput)).anyTimes();
        response.setContentType("application/json");
        expectLastCall().anyTimes();
        response.setCharacterEncoding("UTF-8");
        expectLastCall().anyTimes();
        response.setStatus(413);
        expectLastCall();

        replay(validationService, request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(validationService, request, response);
        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("Request body too large"));
    }

    @Test
    void ioExceptionReadingRequest() throws Exception {
        // Arrange
        expect(request.getInputStream()).andThrow(new IOException("Connection reset"));

        response.setStatus(500);
        expectLastCall();

        replay(validationService, request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(validationService, request, response);
        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("Error reading request"));
    }

    @Test
    void illegalArgumentFromService() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "test-token",
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(validationService.verifyToken("test-token", "test-processor-id"))
                .andThrow(new IllegalArgumentException("Invalid processor configuration"));

        response.setStatus(400);
        expectLastCall();

        replay(validationService, request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(validationService, request, response);
        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("Invalid request"));
    }

    @Test
    void ioExceptionFromService() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "test-token",
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(validationService.verifyToken("test-token", "test-processor-id"))
                .andThrow(new IOException("Connection refused"));

        response.setStatus(500);
        expectLastCall();

        replay(validationService, request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(validationService, request, response);
        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("Communication error"));
    }

    @Test
    void validTokenWithClaimsMap() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "eyJhbGciOiJSUzI1NiJ9.test.sig",
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));

        // Create mock token content with claims
        AccessTokenContent mockTokenContent = createMock(AccessTokenContent.class);
        expect(mockTokenContent.getSubject()).andReturn(Optional.of("test-subject")).anyTimes();
        expect(mockTokenContent.getIssuer()).andReturn("test-issuer").anyTimes();
        expect(mockTokenContent.getExpirationTime()).andReturn(OffsetDateTime.now().plusHours(1)).anyTimes();
        expect(mockTokenContent.getRoles()).andReturn(List.of("admin")).anyTimes();
        expect(mockTokenContent.getScopes()).andReturn(List.of("read")).anyTimes();
        replay(mockTokenContent);

        TokenValidationResult result = TokenValidationResult.success(mockTokenContent);
        result.setAuthorized(true);

        expect(validationService.verifyToken("eyJhbGciOiJSUzI1NiJ9.test.sig", "test-processor-id"))
                .andReturn(result);

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
        assertTrue(responseJson.contains("\"sub\":\"test-subject\""));
    }

    @Test
    void validTokenWithNullIssuerAndEmptyScopes() throws Exception {
        // Arrange
        String requestJson = """
            {
                "token": "test-token-minimal",
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));

        // Success with null tokenContent — issuer/scopes/roles will be null
        TokenValidationResult result = TokenValidationResult.success(null);

        expect(validationService.verifyToken("test-token-minimal", "test-processor-id"))
                .andReturn(result);

        response.setStatus(200);
        expectLastCall();

        replay(validationService, request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(validationService, request, response);
        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":true"));
        assertTrue(responseJson.contains("\"authorized\":false"));
        assertTrue(responseJson.contains("\"claims\":{}"));
    }

    @Test
    void validTokenWithNullIssuerInClaims() throws Exception {
        // Arrange — exercise the null case in addClaimValue switch
        String requestJson = """
            {
                "token": "test-token-null-issuer",
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));

        // Mock AccessTokenContent with null issuer to produce null in claims map
        AccessTokenContent mockTokenContent = createMock(AccessTokenContent.class);
        expect(mockTokenContent.getSubject()).andReturn(Optional.of("test-subject")).anyTimes();
        expect(mockTokenContent.getIssuer()).andReturn(null).anyTimes();
        expect(mockTokenContent.getExpirationTime()).andReturn(OffsetDateTime.now().plusHours(1)).anyTimes();
        expect(mockTokenContent.getRoles()).andReturn(List.of()).anyTimes();
        expect(mockTokenContent.getScopes()).andReturn(List.of()).anyTimes();
        replay(mockTokenContent);

        TokenValidationResult result = TokenValidationResult.success(mockTokenContent);
        result.setAuthorized(true);

        expect(validationService.verifyToken("test-token-null-issuer", "test-processor-id"))
                .andReturn(result);

        response.setStatus(200);
        expectLastCall();

        replay(validationService, request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(validationService, request, response);
        String responseBody = responseOutput.toString();
        assertTrue(responseBody.contains("\"valid\":true"));
        // null issuer should produce "iss":null in JSON claims
        assertTrue(responseBody.contains("\"iss\""),
                "Claims should contain iss key even when null");
    }

    @Test
    void ioExceptionWritingValidResponse() throws Exception {
        // Arrange — valid flow but getOutputStream throws when writing response
        reset(request, response, validationService);

        expect(request.getContentLength()).andReturn(100).anyTimes();
        // getOutputStream() will be called once for the response — throw IOException
        expect(response.getOutputStream()).andThrow(new IOException("Broken pipe"));
        response.setContentType("application/json");
        expectLastCall().anyTimes();
        response.setCharacterEncoding("UTF-8");
        expectLastCall().anyTimes();

        String requestJson = """
            {
                "token": "test-token",
                "processorId": "test-processor-id"
            }
            """;
        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));

        TokenValidationResult validResult = TokenValidationResult.success(null);
        validResult.setIssuer("test-issuer");
        validResult.setAuthorized(true);

        expect(validationService.verifyToken("test-token", "test-processor-id"))
                .andReturn(validResult);

        // IOException causes fallback to setStatus(500) in safelySendValidationResponse
        response.setStatus(200);
        expectLastCall();
        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        expectLastCall();

        replay(validationService, request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(validationService, request, response);
    }

    @Test
    void ioExceptionWritingErrorResponse() throws Exception {
        // Arrange — error flow but getOutputStream throws during error response writing
        reset(request, response, validationService);

        expect(request.getContentLength()).andReturn(100).anyTimes();
        // getOutputStream() throws during error response
        expect(response.getOutputStream()).andThrow(new IOException("Connection reset"));
        response.setContentType("application/json");
        expectLastCall().anyTimes();
        response.setCharacterEncoding("UTF-8");
        expectLastCall().anyTimes();

        String requestJson = """
            {
                "token": "test-token",
                "processorId": "test-processor-id"
            }
            """;
        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));

        expect(validationService.verifyToken("test-token", "test-processor-id"))
                .andThrow(new IllegalStateException("Service not available"));

        // safelySendErrorResponse catches IOException → sets status directly
        response.setStatus(500);
        expectLastCall();

        replay(validationService, request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(validationService, request, response);
    }

    // Helper classes for testing
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
