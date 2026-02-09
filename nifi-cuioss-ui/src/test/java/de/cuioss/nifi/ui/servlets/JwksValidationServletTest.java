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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.easymock.EasyMock.*;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests for {@link JwksValidationServlet}.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/security.adoc">Security Specification</a>
 */
@DisplayName("JWKS Validation Servlet Tests")
class JwksValidationServletTest {

    private HttpServletRequest request;
    private HttpServletResponse response;
    private JwksValidationServlet servlet;
    private ByteArrayOutputStream responseOutput;

    @BeforeEach
    void setUp() throws IOException {
        request = createMock(HttpServletRequest.class);
        response = createMock(HttpServletResponse.class);
        servlet = new JwksValidationServlet();
        responseOutput = new ByteArrayOutputStream();

        expect(request.getContentLength()).andReturn(100).anyTimes();
        expect(response.getOutputStream()).andReturn(new TestServletOutputStream(responseOutput)).anyTimes();
        response.setContentType("application/json");
        expectLastCall().anyTimes();
        response.setCharacterEncoding("UTF-8");
        expectLastCall().anyTimes();
    }

    @Test
    void validJwksContentValidation() throws Exception {
        // Arrange
        String validJwksContent = """
            {
                "keys": [
                    {
                        "kty": "RSA",
                        "kid": "test-key-1",
                        "use": "sig",
                        "n": "0vx7agoebGcQ...",
                        "e": "AQAB"
                    }
                ]
            }
            """;

        String requestJson = """
            {
                "jwksContent": "%s",
                "processorId": "test-processor-id"
            }
            """.formatted(validJwksContent.replace("\"", "\\\"").replace("\n", "\\n"));

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/validate-jwks-content").anyTimes();

        response.setStatus(200);
        expectLastCall();

        replay(request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":true"));
        assertTrue(responseJson.contains("\"accessible\":true"));
        assertTrue(responseJson.contains("\"keyCount\":1"));
    }

    @Test
    void invalidJwksContentMissingKeys() throws Exception {
        // Arrange
        String invalidJwksContent = """
            {
                "invalid": "structure"
            }
            """;

        String requestJson = """
            {
                "jwksContent": "%s",
                "processorId": "test-processor-id"
            }
            """.formatted(invalidJwksContent.replace("\"", "\\\"").replace("\n", "\\n"));

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/validate-jwks-content").anyTimes();

        response.setStatus(400);
        expectLastCall();

        replay(request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("missing required 'keys' field"));
    }

    @Test
    void invalidJwksContentEmptyKeys() throws Exception {
        // Arrange
        String emptyKeysJwksContent = """
            {
                "keys": []
            }
            """;

        String requestJson = """
            {
                "jwksContent": "%s",
                "processorId": "test-processor-id"
            }
            """.formatted(emptyKeysJwksContent.replace("\"", "\\\"").replace("\n", "\\n"));

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/validate-jwks-content").anyTimes();

        response.setStatus(400);
        expectLastCall();

        replay(request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("empty 'keys' array"));
    }

    @Test
    void missingRequiredFields() throws Exception {
        // Test missing jwksContent
        String requestJson = """
            {
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/validate-jwks-content").anyTimes();

        response.setStatus(400);
        expectLastCall();

        replay(request, response);

        servlet.doPost(request, response);

        verify(request, response);
        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("Missing required field: jwksContent"));
    }

    @Test
    void unknownEndpoint() throws Exception {
        // Arrange
        expect(request.getServletPath()).andReturn("/unknown/endpoint").anyTimes();

        response.setStatus(404);
        expectLastCall();

        replay(request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("Endpoint not found"));
    }

    @Test
    void invalidJsonRequest() throws Exception {
        // Arrange
        String invalidJson = "{ invalid json }";
        expect(request.getInputStream()).andReturn(new TestServletInputStream(invalidJson));
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/validate-jwks-content").anyTimes();

        response.setStatus(400);
        expectLastCall();

        replay(request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("Invalid JSON format"));
    }

    @ParameterizedTest(name = "URL validation: {0}")
    @CsvSource({
            "'not a valid url with spaces', Invalid JWKS URL format",
            "'ftp://example.com/jwks.json', Invalid URL scheme",
            "'', JWKS URL cannot be empty"
    })
    void invalidUrlValidation(String jwksUrl, String expectedError) throws Exception {
        // Arrange
        String requestJson = """
            {
                "jwksUrl": "%s",
                "processorId": "test-processor-id"
            }
            """.formatted(jwksUrl);

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/validate-jwks-url").anyTimes();

        response.setStatus(400);
        expectLastCall();

        replay(request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains(expectedError));
    }

    @Test
    void missingJwksUrlField() throws Exception {
        // Arrange
        String requestJson = """
            {
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/validate-jwks-url").anyTimes();

        response.setStatus(400);
        expectLastCall();

        replay(request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("Missing required field: jwksUrl"));
    }

    @Test
    void emptyJwksContentValidation() throws Exception {
        // Arrange
        String requestJson = """
            {
                "jwksContent": "",
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/validate-jwks-content").anyTimes();

        response.setStatus(400);
        expectLastCall();

        replay(request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("JWKS content cannot be empty"));
    }

    @Test
    void emptyJwksFilePathValidation() throws Exception {
        // Arrange
        String requestJson = """
            {
                "jwksFilePath": "",
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/validate-jwks-file").anyTimes();

        response.setStatus(400);
        expectLastCall();

        replay(request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("JWKS file path cannot be empty"));
    }

    @Test
    void missingJwksFilePathField() throws Exception {
        // Arrange
        String requestJson = """
            {
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/validate-jwks-file").anyTimes();

        response.setStatus(400);
        expectLastCall();

        replay(request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("Missing required field: jwksFilePath"));
    }

    @Test
    @DisplayName("Should reject file path outside allowed base directory")
    void nonExistentJwksFileValidation() throws Exception {
        // Arrange — path outside allowed base directory is now rejected by base directory restriction
        String requestJson = """
            {
                "jwksFilePath": "/nonexistent/path/to/jwks.json",
                "processorId": "test-processor-id"
            }
            """;

        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/validate-jwks-file").anyTimes();

        response.setStatus(400);
        expectLastCall();

        replay(request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(request, response);

        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("File path must be within"));
    }

    @Nested
    @DisplayName("Path Traversal Protection Tests")
    class PathTraversalProtectionTests {

        @ParameterizedTest(name = "Should reject path: {0}")
        @CsvSource({
                "'../../etc/passwd'",
                "'/etc/shadow'",
                "'..%2F..%2Fetc%2Fpasswd'"
        })
        void shouldRejectMaliciousPath(String maliciousPath) throws Exception {
            String requestJson = """
                {
                    "jwksFilePath": "%s",
                    "processorId": "test-processor-id"
                }
                """.formatted(maliciousPath);

            expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
            expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/validate-jwks-file").anyTimes();

            response.setStatus(400);
            expectLastCall();

            replay(request, response);

            servlet.doPost(request, response);

            verify(request, response);

            String responseJson = responseOutput.toString();
            assertTrue(responseJson.contains("\"valid\":false"));
        }
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