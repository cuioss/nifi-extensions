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
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

import static org.easymock.EasyMock.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests for {@link JwksValidationServlet}.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/security.adoc">Security Specification</a>
 */
@EnableTestLogger
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

    static Stream<Arguments> missingOrEmptyFieldProvider() {
        return Stream.of(
                Arguments.of("{\"processorId\": \"test-processor-id\"}",
                        "/nifi-api/processors/jwt/validate-jwks-content", "Missing required field: jwksContent"),
                Arguments.of("{\"processorId\": \"test-processor-id\"}",
                        "/nifi-api/processors/jwt/validate-jwks-url", "Missing required field: jwksUrl"),
                Arguments.of("{\"jwksContent\": \"\", \"processorId\": \"test-processor-id\"}",
                        "/nifi-api/processors/jwt/validate-jwks-content", "JWKS content cannot be empty"),
                Arguments.of("{\"jwksFilePath\": \"\", \"processorId\": \"test-processor-id\"}",
                        "/nifi-api/processors/jwt/validate-jwks-file", "JWKS file path cannot be empty"),
                Arguments.of("{\"processorId\": \"test-processor-id\"}",
                        "/nifi-api/processors/jwt/validate-jwks-file", "Missing required field: jwksFilePath"),
                Arguments.of("{\"jwksFilePath\": \"/nonexistent/path/to/jwks.json\", \"processorId\": \"test-processor-id\"}",
                        "/nifi-api/processors/jwt/validate-jwks-file", "File path must be within")
        );
    }

    @ParameterizedTest(name = "Field validation: {2}")
    @MethodSource("missingOrEmptyFieldProvider")
    void shouldRejectMissingOrEmptyFields(String requestJson, String servletPath, String expectedError)
            throws Exception {
        // Arrange
        expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
        expect(request.getServletPath()).andReturn(servletPath).anyTimes();

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

    @Test
    void requestBodyTooLargeOnContentValidation() throws Exception {
        // Arrange - reset mocks to change contentLength behavior
        reset(request, response);
        responseOutput = new ByteArrayOutputStream();

        expect(request.getContentLength()).andReturn(2 * 1024 * 1024).anyTimes();
        expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/validate-jwks-content").anyTimes();
        expect(response.getOutputStream()).andReturn(new TestServletOutputStream(responseOutput)).anyTimes();
        response.setContentType("application/json");
        expectLastCall().anyTimes();
        response.setCharacterEncoding("UTF-8");
        expectLastCall().anyTimes();
        response.setStatus(413);
        expectLastCall();

        replay(request, response);

        // Act
        servlet.doPost(request, response);

        // Assert
        verify(request, response);
        String responseJson = responseOutput.toString();
        assertTrue(responseJson.contains("\"valid\":false"));
        assertTrue(responseJson.contains("Request body too large"));
    }

    @Test
    void ssrfProtectionBlocksPrivateAddress() throws Exception {
        // Arrange - use a private network IP to trigger SSRF protection
        String requestJson = """
            {
                "jwksUrl": "https://10.0.0.1/.well-known/jwks.json",
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
    }

    @Test
    void ssrfProtectionBlocksLoopbackAddress() throws Exception {
        // Arrange - use loopback address
        String requestJson = """
            {
                "jwksUrl": "https://127.0.0.1/.well-known/jwks.json",
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
    }

    @Test
    void validJwksFileInAllowedPath(@TempDir Path tempDir) throws Exception {
        // Arrange - create temp file with valid JWKS content
        String jwksContent = """
            {"keys":[{"kty":"RSA","kid":"test","use":"sig","n":"0vx7","e":"AQAB"}]}
            """;
        Path jwksFile = tempDir.resolve("jwks.json");
        Files.writeString(jwksFile, jwksContent);

        try (var ignored = new SystemPropertyResource("nifi.jwks.allowed.base.path", tempDir.toString())) {
            String requestJson = """
                {
                    "jwksFilePath": "%s",
                    "processorId": "test-processor-id"
                }
                """.formatted(jwksFile.toString());

            expect(request.getInputStream()).andReturn(new TestServletInputStream(requestJson));
            expect(request.getServletPath()).andReturn("/nifi-api/processors/jwt/validate-jwks-file").anyTimes();

            response.setStatus(200);
            expectLastCall();

            replay(request, response);

            // Act
            servlet.doPost(request, response);

            // Assert
            verify(request, response);
            String responseJson = responseOutput.toString();
            assertTrue(responseJson.contains("\"valid\":true"));
            assertTrue(responseJson.contains("\"keyCount\":1"));
        }
    }

    @Test
    void nonExistentJwksFileInAllowedPath(@TempDir Path tempDir) throws Exception {
        // Arrange - file does not exist but path is within allowed base
        try (var ignored = new SystemPropertyResource("nifi.jwks.allowed.base.path", tempDir.toString())) {
            Path nonExistent = tempDir.resolve("nonexistent.json");
            String requestJson = """
                {
                    "jwksFilePath": "%s",
                    "processorId": "test-processor-id"
                }
                """.formatted(nonExistent.toString());

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
            assertTrue(responseJson.contains("does not exist"));
        }
    }

    @Nested
    @DisplayName("JWKS Base Path Resolution Tests")
    class JwksBasePathResolutionTests {

        @Test
        @DisplayName("Should return default NiFi conf path when no properties set")
        void defaultBasePath() {
            System.clearProperty("nifi.properties.file.path");
            System.clearProperty("nifi.jwks.allowed.base.path");

            try {
                Path result = JwksValidationServlet.getJwksAllowedBasePath();
                assertEquals(Path.of("/opt/nifi/nifi-current/conf").normalize().toAbsolutePath(), result);
            } finally {
                System.clearProperty("nifi.properties.file.path");
                System.clearProperty("nifi.jwks.allowed.base.path");
            }
        }

        @Test
        @DisplayName("Should use NiFi properties file parent directory")
        void basePathFromNifiProperties() {
            try {
                System.setProperty("nifi.properties.file.path", "/opt/nifi/conf/nifi.properties");

                Path result = JwksValidationServlet.getJwksAllowedBasePath();
                assertEquals(Path.of("/opt/nifi/conf").normalize().toAbsolutePath(), result);
            } finally {
                System.clearProperty("nifi.properties.file.path");
            }
        }

        @Test
        @DisplayName("Should use custom JWKS base path property")
        void basePathFromCustomProperty() {
            try {
                System.clearProperty("nifi.properties.file.path");
                System.setProperty("nifi.jwks.allowed.base.path", "/custom/jwks/path");

                Path result = JwksValidationServlet.getJwksAllowedBasePath();
                assertEquals(Path.of("/custom/jwks/path").normalize().toAbsolutePath(), result);
            } finally {
                System.clearProperty("nifi.jwks.allowed.base.path");
            }
        }

        @Test
        @DisplayName("NiFi properties should take precedence over custom property")
        void nifiPropertiesTakesPrecedence() {
            try {
                System.setProperty("nifi.properties.file.path", "/opt/nifi/conf/nifi.properties");
                System.setProperty("nifi.jwks.allowed.base.path", "/custom/path");

                Path result = JwksValidationServlet.getJwksAllowedBasePath();
                assertEquals(Path.of("/opt/nifi/conf").normalize().toAbsolutePath(), result);
            } finally {
                System.clearProperty("nifi.properties.file.path");
                System.clearProperty("nifi.jwks.allowed.base.path");
            }
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

    private static final class SystemPropertyResource implements AutoCloseable {
        private final String key;
        private final String originalValue;

        SystemPropertyResource(String key, String value) {
            this.key = key;
            this.originalValue = System.getProperty(key);
            System.setProperty(key, value);
        }

        @Override
        public void close() {
            if (originalValue == null) {
                System.clearProperty(key);
            } else {
                System.setProperty(key, originalValue);
            }
        }
    }
}