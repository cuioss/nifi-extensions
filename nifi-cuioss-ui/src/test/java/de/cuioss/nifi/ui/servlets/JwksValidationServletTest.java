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
import org.eclipse.jetty.ee11.servlet.ServletHolder;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.net.InetAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link JwksValidationServlet} using embedded Jetty + REST Assured.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/security.adoc">Security Specification</a>
 */
@EnableTestLogger
@DisplayName("JWKS Validation Servlet Tests")
class JwksValidationServletTest {

    private static final String URL_ENDPOINT = "/nifi-api/processors/jwt/validate-jwks-url";
    private static final String FILE_ENDPOINT = "/nifi-api/processors/jwt/validate-jwks-file";
    private static final String CONTENT_ENDPOINT = "/nifi-api/processors/jwt/validate-jwks-content";

    private static EmbeddedServletTestSupport.ServerHandle handle;

    @BeforeAll
    static void startServer() throws Exception {
        handle = EmbeddedServletTestSupport.startServer(ctx -> {
            ServletHolder holder = new ServletHolder(new JwksValidationServlet());
            ctx.addServlet(holder, URL_ENDPOINT);
            ctx.addServlet(holder, FILE_ENDPOINT);
            ctx.addServlet(holder, CONTENT_ENDPOINT);
            // For unknown endpoint test
            ctx.addServlet(holder, "/unknown/endpoint");
        });
    }

    @AfterAll
    static void stopServer() throws Exception {
        handle.close();
    }

    @Test
    @DisplayName("Should validate valid JWKS content")
    void validJwksContentValidation() {
        String validJwksContent = """
                {"keys":[{"kty":"RSA","kid":"test-key-1","use":"sig","n":"0vx7agoebGcQ...","e":"AQAB"}]}""";

        String requestJson = """
                {"jwksContent":"%s","processorId":"test-processor-id"}"""
                .formatted(validJwksContent.replace("\"", "\\\""));

        handle.spec()
                .contentType("application/json")
                .body(requestJson)
                .when()
                .post(CONTENT_ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(true))
                .body("accessible", equalTo(true))
                .body("keyCount", equalTo(1));
    }

    @Test
    @DisplayName("Should reject JWKS content missing 'keys' field")
    void invalidJwksContentMissingKeys() {
        String requestJson = """
                {"jwksContent":"{\\"invalid\\":\\"structure\\"}","processorId":"test-processor-id"}""";

        handle.spec()
                .contentType("application/json")
                .body(requestJson)
                .when()
                .post(CONTENT_ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(false))
                .body("error", containsString("missing required 'keys' field"));
    }

    @Test
    @DisplayName("Should reject JWKS content with empty 'keys' array")
    void invalidJwksContentEmptyKeys() {
        String requestJson = """
                {"jwksContent":"{\\"keys\\":[]}","processorId":"test-processor-id"}""";

        handle.spec()
                .contentType("application/json")
                .body(requestJson)
                .when()
                .post(CONTENT_ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(false))
                .body("error", containsString("empty 'keys' array"));
    }

    @Test
    @DisplayName("Should return 404 for unknown endpoint")
    void unknownEndpoint() {
        handle.spec()
                .contentType("application/json")
                .body("{}")
                .when()
                .post("/unknown/endpoint")
                .then()
                .statusCode(404)
                .body("valid", equalTo(false))
                .body("error", containsString("Endpoint not found"));
    }

    @Test
    @DisplayName("Should reject invalid JSON request")
    void invalidJsonRequest() {
        handle.spec()
                .contentType("application/json")
                .body("{ invalid json }")
                .when()
                .post(CONTENT_ENDPOINT)
                .then()
                .statusCode(400)
                .body("valid", equalTo(false))
                .body("error", containsString("Invalid JSON format"));
    }

    @ParameterizedTest(name = "URL validation failure: {0}")
    @CsvSource({
            "'not a valid url with spaces', Invalid JWKS URL format",
            "'ftp://example.com/jwks.json', Invalid URL scheme"
    })
    @DisplayName("Should return validation failure for invalid URLs")
    void invalidUrlValidation(String jwksUrl, String expectedError) {
        String requestJson = """
                {"jwksUrl":"%s","processorId":"test-processor-id"}""".formatted(jwksUrl);

        handle.spec()
                .contentType("application/json")
                .body(requestJson)
                .when()
                .post(URL_ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(false))
                .body("error", containsString(expectedError));
    }

    static Stream<Arguments> missingOrEmptyFieldProvider() {
        return Stream.of(
                Arguments.of("{\"processorId\": \"test-processor-id\"}",
                        CONTENT_ENDPOINT, "Missing required field: jwksContent"),
                Arguments.of("{\"processorId\": \"test-processor-id\"}",
                        URL_ENDPOINT, "Missing required field: jwksUrl"),
                Arguments.of("{\"jwksUrl\": \"\", \"processorId\": \"test-processor-id\"}",
                        URL_ENDPOINT, "JWKS URL cannot be empty"),
                Arguments.of("{\"jwksContent\": \"\", \"processorId\": \"test-processor-id\"}",
                        CONTENT_ENDPOINT, "JWKS content cannot be empty"),
                Arguments.of("{\"jwksFilePath\": \"\", \"processorId\": \"test-processor-id\"}",
                        FILE_ENDPOINT, "JWKS file path cannot be empty"),
                Arguments.of("{\"processorId\": \"test-processor-id\"}",
                        FILE_ENDPOINT, "Missing required field: jwksFilePath")
        );
    }

    @ParameterizedTest(name = "Field validation: {2}")
    @MethodSource("missingOrEmptyFieldProvider")
    @DisplayName("Should reject missing or empty fields with 400")
    void shouldRejectMissingOrEmptyFields(String requestJson, String endpoint, String expectedError) {
        handle.spec()
                .contentType("application/json")
                .body(requestJson)
                .when()
                .post(endpoint)
                .then()
                .statusCode(400)
                .body("valid", equalTo(false))
                .body("error", containsString(expectedError));
    }

    @Test
    @DisplayName("Should return validation failure for file path outside allowed base")
    void filePathOutsideAllowedBase() {
        handle.spec()
                .contentType("application/json")
                .body("""
                        {"jwksFilePath":"/nonexistent/path/to/jwks.json","processorId":"test-processor-id"}""")
                .when()
                .post(FILE_ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(false))
                .body("error", containsString("File path must be within"));
    }

    @Nested
    @DisplayName("Path Traversal Protection Tests")
    class PathTraversalProtectionTests {

        @ParameterizedTest(name = "Should reject path: {0}")
        @ValueSource(strings = {
                "'../../etc/passwd'",
                "'/etc/shadow'",
                "'..%2F..%2Fetc%2Fpasswd'"
        })
        @DisplayName("Should reject malicious paths")
        void shouldRejectMaliciousPath(String maliciousPath) {
            String requestJson = """
                    {"jwksFilePath":"%s","processorId":"test-processor-id"}"""
                    .formatted(maliciousPath);

            handle.spec()
                    .contentType("application/json")
                    .body(requestJson)
                    .when()
                    .post(FILE_ENDPOINT)
                    .then()
                    .statusCode(200)
                    .body("valid", equalTo(false));
        }
    }

    @Test
    @DisplayName("Should block private address via SSRF protection")
    void ssrfProtectionBlocksPrivateAddress() {
        handle.spec()
                .contentType("application/json")
                .body("""
                        {"jwksUrl":"https://10.0.0.1/.well-known/jwks.json","processorId":"test-processor-id"}""")
                .when()
                .post(URL_ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(false));
    }

    @Test
    @DisplayName("Should block loopback address via SSRF protection")
    void ssrfProtectionBlocksLoopbackAddress() {
        handle.spec()
                .contentType("application/json")
                .body("""
                        {"jwksUrl":"https://127.0.0.1/.well-known/jwks.json","processorId":"test-processor-id"}""")
                .when()
                .post(URL_ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(false));
    }

    @Nested
    @DisplayName("Configurable SSRF Protection Tests")
    class ConfigurableSsrfProtectionTests {

        @Test
        @DisplayName("Should block private address by default (allowPrivateAddresses=false)")
        void defaultBlocksPrivateAddress() {
            // Arrange
            JwksValidationServlet servlet = new JwksValidationServlet();

            // Act — default is false, so private addresses should be blocked
            InetAddress result = servlet.resolveAndValidateAddress("127.0.0.1", false);

            // Assert
            assertNull(result, "Private address should be blocked when allowPrivateAddresses=false");
        }

        @Test
        @DisplayName("Should allow loopback address when allowPrivateAddresses=true")
        void allowsLoopbackWhenEnabled() {
            // Arrange
            JwksValidationServlet servlet = new JwksValidationServlet();

            // Act
            InetAddress result = servlet.resolveAndValidateAddress("127.0.0.1", true);

            // Assert
            assertNotNull(result, "Loopback address should be allowed when allowPrivateAddresses=true");
            assertTrue(result.isLoopbackAddress());
        }

        @Test
        @DisplayName("Should return null for empty host regardless of allowPrivateAddresses")
        void returnsNullForEmptyHost() {
            // Arrange
            JwksValidationServlet servlet = new JwksValidationServlet();

            // Act & Assert
            assertNull(servlet.resolveAndValidateAddress("", true));
            assertNull(servlet.resolveAndValidateAddress(null, true));
            assertNull(servlet.resolveAndValidateAddress("", false));
            assertNull(servlet.resolveAndValidateAddress(null, false));
        }

        @Test
        @DisplayName("Should return null for unresolvable host regardless of allowPrivateAddresses")
        void returnsNullForUnresolvableHost() {
            // Arrange
            JwksValidationServlet servlet = new JwksValidationServlet();

            // Act & Assert
            assertNull(servlet.resolveAndValidateAddress(
                    "this.host.definitely.does.not.exist.invalid", true));
            assertNull(servlet.resolveAndValidateAddress(
                    "this.host.definitely.does.not.exist.invalid", false));
        }
    }

    @Test
    @DisplayName("Should validate JWKS file in allowed path")
    void validJwksFileInAllowedPath(@TempDir Path tempDir) throws Exception {
        String jwksContent = """
                {"keys":[{"kty":"RSA","kid":"test","use":"sig","n":"0vx7","e":"AQAB"}]}""";
        Path jwksFile = tempDir.resolve("jwks.json");
        Files.writeString(jwksFile, jwksContent);

        try (var ignored = new SystemPropertyResource("nifi.jwks.allowed.base.path", tempDir.toString())) {
            handle.spec()
                    .contentType("application/json")
                    .body("""
                            {"jwksFilePath":"%s","processorId":"test-processor-id"}"""
                            .formatted(jwksFile.toString()))
                    .when()
                    .post(FILE_ENDPOINT)
                    .then()
                    .statusCode(200)
                    .body("valid", equalTo(true))
                    .body("keyCount", equalTo(1));
        }
    }

    @Test
    @DisplayName("Should reject non-existent JWKS file in allowed path")
    void nonExistentJwksFileInAllowedPath(@TempDir Path tempDir) {
        try (var ignored = new SystemPropertyResource("nifi.jwks.allowed.base.path", tempDir.toString())) {
            Path nonExistent = tempDir.resolve("nonexistent.json");

            handle.spec()
                    .contentType("application/json")
                    .body("""
                            {"jwksFilePath":"%s","processorId":"test-processor-id"}"""
                            .formatted(nonExistent.toString()))
                    .when()
                    .post(FILE_ENDPOINT)
                    .then()
                    .statusCode(200)
                    .body("valid", equalTo(false))
                    .body("error", containsString("does not exist"));
        }
    }

    @Test
    @DisplayName("Should reject malformed JSON in JWKS content")
    void invalidJsonInJwksContent() {
        handle.spec()
                .contentType("application/json")
                .body("""
                        {"jwksContent":"not valid json at all","processorId":"test-processor-id"}""")
                .when()
                .post(CONTENT_ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(false))
                .body("error", containsString("Invalid JWKS JSON format"));
    }

    @Test
    @DisplayName("Should reject JWKS file with invalid JSON content")
    void jwksFileWithInvalidJsonContent(@TempDir Path tempDir) throws Exception {
        Path invalidFile = tempDir.resolve("bad-jwks.json");
        Files.writeString(invalidFile, "this is not JSON at all");

        try (var ignored = new SystemPropertyResource("nifi.jwks.allowed.base.path", tempDir.toString())) {
            handle.spec()
                    .contentType("application/json")
                    .body("""
                            {"jwksFilePath":"%s","processorId":"test-processor-id"}"""
                            .formatted(invalidFile.toString()))
                    .when()
                    .post(FILE_ENDPOINT)
                    .then()
                    .statusCode(200)
                    .body("valid", equalTo(false))
                    .body("error", containsString("Invalid JWKS JSON format"));
        }
    }

    @Test
    @DisplayName("Should reject JWKS content that is a JSON array instead of object")
    void jwksContentIsJsonArray() {
        handle.spec()
                .contentType("application/json")
                .body("""
                        {"jwksContent":"[1,2,3]","processorId":"test-processor-id"}""")
                .when()
                .post(CONTENT_ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(false))
                .body("error", containsString("Invalid JWKS JSON format"));
    }

    @Test
    @DisplayName("Should use empty string for nifi properties path when only filename provided")
    void basePathNifiPropertiesFilenameOnly() {
        try {
            // A filename without a parent directory
            System.setProperty("nifi.properties.file.path", "nifi.properties");
            System.clearProperty("nifi.jwks.allowed.base.path");

            Path result = JwksValidationServlet.getJwksAllowedBasePath();
            // Parent of "nifi.properties" in current dir returns cwd
            assertNotNull(result, "Base path should not be null");
        } finally {
            System.clearProperty("nifi.properties.file.path");
            System.clearProperty("nifi.jwks.allowed.base.path");
        }
    }

    @Test
    @DisplayName("Should fallback to custom property when nifi.properties.file.path is blank")
    void basePathBlankNifiPropertiesProperty() {
        try {
            System.setProperty("nifi.properties.file.path", "   ");
            System.setProperty("nifi.jwks.allowed.base.path", "/custom/path");

            Path result = JwksValidationServlet.getJwksAllowedBasePath();
            assertEquals(Path.of("/custom/path").normalize().toAbsolutePath(), result);
        } finally {
            System.clearProperty("nifi.properties.file.path");
            System.clearProperty("nifi.jwks.allowed.base.path");
        }
    }

    @Test
    @DisplayName("Should fallback to default when custom property is blank")
    void basePathBlankCustomProperty() {
        try {
            System.clearProperty("nifi.properties.file.path");
            System.setProperty("nifi.jwks.allowed.base.path", "   ");

            Path result = JwksValidationServlet.getJwksAllowedBasePath();
            assertEquals(Path.of("/opt/nifi/nifi-current/conf").normalize().toAbsolutePath(), result);
        } finally {
            System.clearProperty("nifi.properties.file.path");
            System.clearProperty("nifi.jwks.allowed.base.path");
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

    /**
     * Auto-closeable helper for temporarily setting a system property.
     */
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
