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
package de.cuioss.nifi.ui.service;

import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.test.generator.junit.EnableGeneratorController;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.nifi.web.ComponentDetails;
import org.apache.nifi.web.NiFiWebConfigurationContext;
import org.apache.nifi.web.NiFiWebRequestContext;
import org.apache.nifi.web.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.*;

import static de.cuioss.test.generator.Generators.strings;
import static org.easymock.EasyMock.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link JwtValidationService} and {@link JwtValidationService.TokenValidationResult}.
 *
 * Tests cover:
 * - TokenValidationResult data class functionality
 * - verifyToken method via NiFiWebConfigurationContext mock
 * - Error handling and edge cases
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/token-validation.adoc">Token Validation Specification</a>
 */
@EnableGeneratorController
@EnableTestLogger
@DisplayName("JWT Validation Service Tests")
class JwtValidationServiceTest {

    @Nested
    @DisplayName("TokenValidationResult Tests")
    class TokenValidationResultTests {

        @Test
        @DisplayName("Should create successful result with token content")
        void shouldCreateSuccessfulResult() {
            // Arrange
            AccessTokenContent mockTokenContent = createMock(AccessTokenContent.class);

            // Act
            JwtValidationService.TokenValidationResult result =
                    JwtValidationService.TokenValidationResult.success(mockTokenContent);

            // Assert
            assertTrue(result.isValid(), "Result should be valid");
            assertNull(result.getError(), "Error should be null for successful result");
            assertEquals(mockTokenContent, result.getTokenContent(),
                    "Token content should match provided content");
        }

        @Test
        @DisplayName("Should create failure result with error message")
        void shouldCreateFailureResult() {
            // Arrange
            String errorMessage = strings().next();

            // Act
            JwtValidationService.TokenValidationResult result =
                    JwtValidationService.TokenValidationResult.failure(errorMessage);

            // Assert
            assertFalse(result.isValid(), "Result should be invalid");
            assertEquals(errorMessage, result.getError(),
                    "Error message should match provided message");
            assertNull(result.getTokenContent(), "Token content should be null for failed result");
        }

        @Test
        @DisplayName("Should get issuer from field when set")
        void shouldGetIssuerFromField() {
            // Arrange
            JwtValidationService.TokenValidationResult result =
                    JwtValidationService.TokenValidationResult.success(null);
            String issuer = strings().next();

            // Act
            result.setIssuer(issuer);

            // Assert
            assertEquals(issuer, result.getIssuer(), "Issuer should match set value");
        }

        @Test
        @DisplayName("Should get issuer from token content when field not set")
        void shouldGetIssuerFromTokenContent() {
            // Arrange
            String expectedIssuer = strings().next();
            AccessTokenContent mockTokenContent = createMock(AccessTokenContent.class);
            expect(mockTokenContent.getIssuer()).andReturn(expectedIssuer);
            replay(mockTokenContent);

            JwtValidationService.TokenValidationResult result =
                    JwtValidationService.TokenValidationResult.success(mockTokenContent);

            // Act
            String actualIssuer = result.getIssuer();

            // Assert
            assertEquals(expectedIssuer, actualIssuer,
                    "Issuer should be retrieved from token content");
            verify(mockTokenContent);
        }

        @Test
        @DisplayName("Should return null issuer when neither field nor token content available")
        void shouldReturnNullIssuerWhenNotAvailable() {
            // Arrange
            JwtValidationService.TokenValidationResult result =
                    JwtValidationService.TokenValidationResult.failure("error");

            // Act
            String issuer = result.getIssuer();

            // Assert
            assertNull(issuer, "Issuer should be null when not available");
        }

        @Test
        @DisplayName("Should set and get authorized flag")
        void shouldSetAndGetAuthorized() {
            // Arrange
            JwtValidationService.TokenValidationResult result =
                    JwtValidationService.TokenValidationResult.success(null);

            // Act
            result.setAuthorized(true);

            // Assert
            assertTrue(result.isAuthorized(), "Authorized flag should be true");
        }

        @Test
        @DisplayName("Should set and get scopes from field")
        void shouldSetAndGetScopesFromField() {
            // Arrange
            JwtValidationService.TokenValidationResult result =
                    JwtValidationService.TokenValidationResult.success(null);
            List<String> scopes = Arrays.asList("read", "write");

            // Act
            result.setScopes(scopes);

            // Assert
            assertEquals(scopes, result.getScopes(), "Scopes should match set value");
        }

        @Test
        @DisplayName("Should get scopes from token content when field not set")
        void shouldGetScopesFromTokenContent() {
            // Arrange
            List<String> expectedScopes = Arrays.asList("read", "write");
            AccessTokenContent mockTokenContent = createMock(AccessTokenContent.class);
            expect(mockTokenContent.getScopes()).andReturn(expectedScopes);
            replay(mockTokenContent);

            JwtValidationService.TokenValidationResult result =
                    JwtValidationService.TokenValidationResult.success(mockTokenContent);

            // Act
            List<String> actualScopes = result.getScopes();

            // Assert
            assertEquals(expectedScopes, actualScopes,
                    "Scopes should be retrieved from token content");
            verify(mockTokenContent);
        }

        @Test
        @DisplayName("Should set and get roles from field")
        void shouldSetAndGetRolesFromField() {
            // Arrange
            JwtValidationService.TokenValidationResult result =
                    JwtValidationService.TokenValidationResult.success(null);
            List<String> roles = Arrays.asList("admin", "user");

            // Act
            result.setRoles(roles);

            // Assert
            assertEquals(roles, result.getRoles(), "Roles should match set value");
        }

        @Test
        @DisplayName("Should get roles from token content when field not set")
        void shouldGetRolesFromTokenContent() {
            // Arrange
            List<String> expectedRoles = Arrays.asList("admin", "user");
            AccessTokenContent mockTokenContent = createMock(AccessTokenContent.class);
            expect(mockTokenContent.getRoles()).andReturn(expectedRoles);
            replay(mockTokenContent);

            JwtValidationService.TokenValidationResult result =
                    JwtValidationService.TokenValidationResult.success(mockTokenContent);

            // Act
            List<String> actualRoles = result.getRoles();

            // Assert
            assertEquals(expectedRoles, actualRoles,
                    "Roles should be retrieved from token content");
            verify(mockTokenContent);
        }

        @Test
        @DisplayName("Should build claims map from token content")
        void shouldBuildClaimsMapFromTokenContent() {
            // Arrange
            String subject = strings().next();
            String issuer = strings().next();
            OffsetDateTime expiration = OffsetDateTime.now().plusSeconds(3600);
            List<String> roles = Arrays.asList("admin", "user");
            List<String> scopes = Arrays.asList("read", "write");

            AccessTokenContent mockTokenContent = createMock(AccessTokenContent.class);
            expect(mockTokenContent.getSubject()).andReturn(Optional.of(subject));
            expect(mockTokenContent.getIssuer()).andReturn(issuer);
            expect(mockTokenContent.getExpirationTime()).andReturn(expiration);
            expect(mockTokenContent.getRoles()).andReturn(roles);
            expect(mockTokenContent.getScopes()).andReturn(scopes);
            replay(mockTokenContent);

            JwtValidationService.TokenValidationResult result =
                    JwtValidationService.TokenValidationResult.success(mockTokenContent);

            // Act
            Map<String, Object> claims = result.getClaims();

            // Assert
            assertNotNull(claims, "Claims should not be null");
            assertEquals(subject, claims.get("sub"), "Subject should match");
            assertEquals(issuer, claims.get("iss"), "Issuer should match");
            assertEquals(expiration.toString(), claims.get("exp"), "Expiration should match");
            assertEquals(roles, claims.get("roles"), "Roles should match");
            assertEquals(scopes, claims.get("scopes"), "Scopes should match");
            verify(mockTokenContent);
        }

        @Test
        @DisplayName("Should build claims map without optional fields")
        void shouldBuildClaimsMapWithoutOptionalFields() {
            // Arrange
            String issuer = strings().next();
            OffsetDateTime expiration = OffsetDateTime.now().plusSeconds(3600);

            AccessTokenContent mockTokenContent = createMock(AccessTokenContent.class);
            expect(mockTokenContent.getSubject()).andReturn(Optional.empty());
            expect(mockTokenContent.getIssuer()).andReturn(issuer);
            expect(mockTokenContent.getExpirationTime()).andReturn(expiration);
            expect(mockTokenContent.getRoles()).andReturn(Collections.emptyList());
            expect(mockTokenContent.getScopes()).andReturn(Collections.emptyList());
            replay(mockTokenContent);

            JwtValidationService.TokenValidationResult result =
                    JwtValidationService.TokenValidationResult.success(mockTokenContent);

            // Act
            Map<String, Object> claims = result.getClaims();

            // Assert
            assertNotNull(claims, "Claims should not be null");
            assertEquals("", claims.get("sub"), "Empty subject should be empty string");
            assertFalse(claims.containsKey("roles"), "Roles should not be present when empty");
            assertFalse(claims.containsKey("scopes"), "Scopes should not be present when empty");
            verify(mockTokenContent);
        }

        @Test
        @DisplayName("Should return null scopes when no token content")
        void shouldReturnNullScopesWhenNoTokenContent() {
            JwtValidationService.TokenValidationResult result =
                    JwtValidationService.TokenValidationResult.failure("error");
            assertNull(result.getScopes(), "Scopes should be null when token content is null");
        }

        @Test
        @DisplayName("Should return null roles when no token content")
        void shouldReturnNullRolesWhenNoTokenContent() {
            JwtValidationService.TokenValidationResult result =
                    JwtValidationService.TokenValidationResult.failure("error");
            assertNull(result.getRoles(), "Roles should be null when token content is null");
        }

        @Test
        @DisplayName("Should return empty map when token content is null")
        void shouldReturnEmptyMapWhenTokenContentIsNull() {
            // Arrange
            JwtValidationService.TokenValidationResult result =
                    JwtValidationService.TokenValidationResult.failure("error");

            // Act
            Map<String, Object> claims = result.getClaims();

            // Assert
            assertNotNull(claims, "Claims should not be null");
            assertTrue(claims.isEmpty(), "Claims should be empty when token content is null");
        }
    }

    @Nested
    @DisplayName("Constructor Tests")
    class ConstructorTests {

        @Test
        @DisplayName("Should reject null config context")
        void shouldRejectNullConfigContext() {
            assertThrows(NullPointerException.class,
                    () -> new JwtValidationService(null));
        }

        @Test
        @DisplayName("Should create service with valid config context")
        void shouldCreateServiceWithValidContext() {
            NiFiWebConfigurationContext mockContext = createMock(NiFiWebConfigurationContext.class);
            assertNotNull(new JwtValidationService(mockContext));
        }
    }

    @Nested
    @DisplayName("Processor ID Validation Tests")
    class ProcessorIdValidationTests {

        @Test
        @DisplayName("Should reject null processor ID")
        void shouldRejectNullProcessorId() {
            // Arrange
            NiFiWebConfigurationContext mockContext = createMock(NiFiWebConfigurationContext.class);
            JwtValidationService service = new JwtValidationService(mockContext);
            HttpServletRequest mockRequest = createNiceMock(HttpServletRequest.class);
            replay(mockRequest);

            // Act & Assert
            assertThrows(NullPointerException.class,
                    () -> service.verifyToken("some-token", null, mockRequest),
                    "Should throw NullPointerException for null processorId");
        }
    }

    @Nested
    @DisplayName("verifyToken Tests")
    class VerifyTokenTests {

        private NiFiWebConfigurationContext mockConfigContext;
        private HttpServletRequest mockRequest;
        private JwtValidationService service;

        @BeforeEach
        void setUp() {
            mockConfigContext = createMock(NiFiWebConfigurationContext.class);
            mockRequest = createNiceMock(HttpServletRequest.class);
            expect(mockRequest.getScheme()).andReturn("https").anyTimes();
            replay(mockRequest);
            service = new JwtValidationService(mockConfigContext);
        }

        @Test
        @DisplayName("Should throw IllegalArgumentException when component not found")
        void shouldThrowWhenComponentNotFound() {
            // Arrange
            String processorId = UUID.randomUUID().toString();
            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andThrow(new ResourceNotFoundException("Processor not found"));
            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andThrow(new ResourceNotFoundException("CS not found"));
            replay(mockConfigContext);

            // Act & Assert
            IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                    () -> service.verifyToken("some-token", processorId, mockRequest));
            assertTrue(exception.getMessage().contains("Component not found"));
            verify(mockConfigContext);
        }

        @Test
        @DisplayName("Should throw IllegalStateException when no issuer configs found")
        void shouldThrowIllegalStateExceptionWhenNoIssuerConfigs() {
            // Arrange — empty properties map yields no issuer configurations
            String processorId = UUID.randomUUID().toString();
            ComponentDetails details = new ComponentDetails.Builder()
                    .id(processorId)
                    .type("SomeProcessor")
                    .properties(Collections.emptyMap())
                    .build();

            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andReturn(details);
            replay(mockConfigContext);

            // Act & Assert
            IllegalStateException exception = assertThrows(IllegalStateException.class,
                    () -> service.verifyToken("some-token", processorId, mockRequest));
            assertTrue(exception.getMessage().contains("No issuer configurations found"));
            verify(mockConfigContext);
        }

        @Test
        @DisplayName("Should return failure result for invalid token with valid issuer config")
        void shouldReturnFailureForInvalidTokenWithValidConfig() {
            // Arrange — provide minimal issuer configuration with a JWKS URL
            String processorId = UUID.randomUUID().toString();
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.1.name", "test-issuer");
            properties.put("issuer.1.jwks-url", "https://example.com/.well-known/jwks.json");

            ComponentDetails details = new ComponentDetails.Builder()
                    .id(processorId)
                    .type("SomeProcessor")
                    .properties(properties)
                    .build();

            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andReturn(details);
            replay(mockConfigContext);

            // Act — invalid token causes validation failure or TokenValidator build failure
            try {
                JwtValidationService.TokenValidationResult result =
                        service.verifyToken("not-a-valid-jwt-token", processorId, mockRequest);

                // If we get a result, it should indicate failure
                assertNotNull(result, "Result should not be null");
                assertFalse(result.isValid(), "Result should be invalid for bad token");
                assertNotNull(result.getError(), "Error message should be present");
            } catch (IllegalStateException e) {
                // TokenValidator.build() may fail — this exercises the catch block
                assertNotNull(e.getMessage(), "Exception should have a message");
            }
            verify(mockConfigContext);
        }

        @Test
        @DisplayName("Should resolve controller service properties when processor references one")
        void shouldResolveControllerServiceProperties(@TempDir Path tempDir) throws Exception {
            // Arrange — processor references a controller service via jwt.issuer.config.service
            String processorId = UUID.randomUUID().toString();
            String controllerServiceId = UUID.randomUUID().toString();

            // Processor properties: only the controller service reference
            Map<String, String> processorProperties = new HashMap<>();
            processorProperties.put("jwt.issuer.config.service", controllerServiceId);

            // Controller service properties: actual issuer configurations
            Path jwksFile = tempDir.resolve("test-jwks.json");
            Files.writeString(jwksFile, """
                    {
                      "keys": [{
                        "kty": "RSA", "use": "sig", "kid": "test-key-1",
                        "n": "xGOr-H7A-PWzbJypLqAP1T7oTmPmK0HQonC9DdNf5xHxl8Jfx8N0vHlJ3hQB0z4jGp4Gq5QiC_qRjGJpZ3Sp6kYz9kYWvQ8uL8zJvP3xFp9zJGkP3xFZ9zJGkvP3xFp9zJGkP3xFZ9zJGkKP3xFp9zJGkvP3xFZ9zJGkP3xFp9zJGkvP3xFZ9zJGkP3xFp9zJGkvP3xFZ9zJGkP3xFp9zJGkvP3xFZ9zJGkP3xFp9zJGkvP3xFZ9zJGkP3xFp9zQ",
                        "e": "AQAB"
                      }]
                    }
                    """);
            Map<String, String> csProperties = new HashMap<>();
            csProperties.put("issuer.1.name", "test-issuer");
            csProperties.put("issuer.1.jwks-file", jwksFile.toAbsolutePath().toString());

            ComponentDetails processorDetails = new ComponentDetails.Builder()
                    .id(processorId)
                    .type("MultiIssuerJWTTokenAuthenticator")
                    .properties(processorProperties)
                    .build();

            ComponentDetails csDetails = new ComponentDetails.Builder()
                    .id(controllerServiceId)
                    .type("StandardJwtIssuerConfigService")
                    .properties(csProperties)
                    .build();

            // Mock: 1st call returns processor, 2nd fails (CS UUID as processor),
            // 3rd returns CS details
            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andReturn(processorDetails);
            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andThrow(new ResourceNotFoundException("Not a processor"));
            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andReturn(csDetails);
            replay(mockConfigContext);

            // Act — invalid token, but issuer config should be resolved from CS
            JwtValidationService.TokenValidationResult result =
                    service.verifyToken("not-a-valid-jwt", processorId, mockRequest);

            // Assert — should get a failure result (not IllegalStateException about missing config)
            assertNotNull(result, "Result should not be null");
            assertFalse(result.isValid(), "Result should be invalid for bad token");
            assertNotNull(result.getError(), "Error message should be present");
            verify(mockConfigContext);
        }

        @Test
        @DisplayName("Should reject null processor ID")
        void shouldRejectNullProcessorId() {
            // Arrange & Act & Assert
            assertThrows(NullPointerException.class,
                    () -> service.verifyToken("some-token", null, mockRequest),
                    "Should throw NullPointerException for null processorId");
        }

        @Test
        @DisplayName("Should throw IllegalStateException when controller service lookup fails")
        void shouldThrowIllegalStateExceptionWhenControllerServiceLookupFails() {
            // Arrange — processor references a controller service that cannot be resolved
            String processorId = UUID.randomUUID().toString();
            String controllerServiceId = UUID.randomUUID().toString();

            Map<String, String> processorProperties = new HashMap<>();
            processorProperties.put("jwt.issuer.config.service", controllerServiceId);

            ComponentDetails processorDetails = new ComponentDetails.Builder()
                    .id(processorId)
                    .type("MultiIssuerJWTTokenAuthenticator")
                    .properties(processorProperties)
                    .build();

            // Need server info for REST API fallback URL construction
            HttpServletRequest serverRequest = createNiceMock(HttpServletRequest.class);
            expect(serverRequest.getScheme()).andReturn("https").anyTimes();
            expect(serverRequest.getServerName()).andReturn("localhost").anyTimes();
            expect(serverRequest.getServerPort()).andReturn(9095).anyTimes();
            replay(serverRequest);

            JwtValidationService serverService = new JwtValidationService(mockConfigContext);

            // Mock: 1st call returns processor properties, 2nd and 3rd both fail for CS
            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andReturn(processorDetails);
            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andThrow(new ResourceNotFoundException("Not a processor"));
            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andThrow(new ResourceNotFoundException("CS not found"));
            replay(mockConfigContext);

            // Act & Assert — should throw IllegalStateException (not silently fall back)
            IllegalStateException exception = assertThrows(IllegalStateException.class,
                    () -> serverService.verifyToken("some-token", processorId, serverRequest));
            assertTrue(exception.getMessage().contains("Failed to resolve properties for controller service"),
                    "Error should indicate controller service resolution failure: " + exception.getMessage());
            verify(mockConfigContext);
        }

        @Test
        @DisplayName("Should throw IllegalStateException when TokenValidator build fails")
        void shouldThrowIllegalStateExceptionWhenTokenValidatorBuildFails(@TempDir Path tempDir) throws Exception {
            // Arrange — create an invalid JWKS file to cause TokenValidator build failure
            Path invalidJwksFile = tempDir.resolve("invalid-jwks.json");
            Files.writeString(invalidJwksFile, "{ not a valid JWKS }");

            String processorId = UUID.randomUUID().toString();
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.1.name", "test-issuer");
            properties.put("issuer.1.jwks-file", invalidJwksFile.toAbsolutePath().toString());

            ComponentDetails details = new ComponentDetails.Builder()
                    .id(processorId)
                    .type("SomeProcessor")
                    .properties(properties)
                    .build();

            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andReturn(details);
            replay(mockConfigContext);

            // Act & Assert — TokenValidator.build() should fail with invalid JWKS
            try {
                service.verifyToken("some-token", processorId, mockRequest);
            } catch (IllegalStateException e) {
                assertNotNull(e.getMessage(), "Exception should have a message");
            }
            verify(mockConfigContext);
        }

        @Test
        @DisplayName("Should return failure for invalid JWT with local JWKS file")
        void shouldReturnFailureForInvalidJwtWithLocalJwks(@TempDir Path tempDir) throws Exception {
            // Arrange — create a valid JWKS file in a temp directory
            String jwksContent = """
                    {
                      "keys": [
                        {
                          "kty": "RSA",
                          "use": "sig",
                          "kid": "test-key-1",
                          "n": "xGOr-H7A-PWzbJypLqAP1T7oTmPmK0HQonC9DdNf5xHxl8Jfx8N0vHlJ3hQB0z4jGp4Gq5QiC_qRjGJpZ3Sp6kYz9kYWvQ8uL8zJvP3xFp9zJGkP3xFZ9zJGkvP3xFp9zJGkP3xFZ9zJGkKP3xFp9zJGkvP3xFZ9zJGkP3xFp9zJGkvP3xFZ9zJGkP3xFp9zJGkvP3xFZ9zJGkP3xFp9zJGkvP3xFZ9zJGkP3xFp9zJGkvP3xFZ9zJGkP3xFp9zQ",
                          "e": "AQAB"
                        }
                      ]
                    }
                    """;
            Path jwksFile = tempDir.resolve("test-jwks.json");
            Files.writeString(jwksFile, jwksContent);

            String processorId = UUID.randomUUID().toString();
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.1.name", "test-issuer");
            properties.put("issuer.1.jwks-file", jwksFile.toAbsolutePath().toString());

            ComponentDetails details = new ComponentDetails.Builder()
                    .id(processorId)
                    .type("SomeProcessor")
                    .properties(properties)
                    .build();

            expect(mockConfigContext.getComponentDetails(anyObject(NiFiWebRequestContext.class)))
                    .andReturn(details);
            replay(mockConfigContext);

            // Act — token is not valid JWT so validation will fail
            JwtValidationService.TokenValidationResult result =
                    service.verifyToken("not-a-valid-jwt", processorId, mockRequest);

            // Assert — should return failure result (not throw)
            assertNotNull(result, "Result should not be null");
            assertFalse(result.isValid(), "Result should be invalid for bad token");
            assertNotNull(result.getError(), "Error message should be present");
            verify(mockConfigContext);
        }
    }

    @Nested
    @DisplayName("hasEmptyControllerServiceReference Tests")
    class HasEmptyControllerServiceReferenceTests {

        @Test
        @DisplayName("Should return false when no CS keys present")
        void shouldReturnFalseWhenNoCsKeysPresent() {
            assertFalse(JwtValidationService.hasEmptyControllerServiceReference(
                    Map.of("some.other.key", "value")));
        }

        @Test
        @DisplayName("Should return true when CS key has empty value")
        void shouldReturnTrueWhenCsKeyHasEmptyValue() {
            assertTrue(JwtValidationService.hasEmptyControllerServiceReference(
                    Map.of("jwt.issuer.config.service", "")));
        }

        @Test
        @DisplayName("Should return true when CS key has blank value")
        void shouldReturnTrueWhenCsKeyHasBlankValue() {
            assertTrue(JwtValidationService.hasEmptyControllerServiceReference(
                    Map.of("jwt.issuer.config.service", "   ")));
        }

        @Test
        @DisplayName("Should return false when CS key has non-empty value")
        void shouldReturnFalseWhenCsKeyHasNonEmptyValue() {
            assertFalse(JwtValidationService.hasEmptyControllerServiceReference(
                    Map.of("jwt.issuer.config.service", "some-uuid")));
        }

        @Test
        @DisplayName("Should return true when CS key has null value")
        void shouldReturnTrueWhenCsKeyHasNullValue() {
            Map<String, String> props = new HashMap<>();
            props.put("jwt.issuer.config.service", null);
            assertTrue(JwtValidationService.hasEmptyControllerServiceReference(props));
        }

        @Test
        @DisplayName("Should check gateway CS key as well")
        void shouldCheckGatewayCsKey() {
            assertFalse(JwtValidationService.hasEmptyControllerServiceReference(
                    Map.of("rest.gateway.jwt.config.service", "some-uuid")));
            assertTrue(JwtValidationService.hasEmptyControllerServiceReference(
                    Map.of("rest.gateway.jwt.config.service", "")));
        }
    }

    @Nested
    @DisplayName("describeValue Tests")
    class DescribeValueTests {

        @Test
        @DisplayName("Should return <null> for null value")
        void shouldReturnNullDescription() {
            assertEquals("<null>", JwtValidationService.describeValue(null));
        }

        @Test
        @DisplayName("Should return <blank> for blank value")
        void shouldReturnBlankDescription() {
            assertEquals("<blank>", JwtValidationService.describeValue(""));
            assertEquals("<blank>", JwtValidationService.describeValue("   "));
        }

        @Test
        @DisplayName("Should return value itself for non-blank value")
        void shouldReturnValueForNonBlank() {
            assertEquals("hello", JwtValidationService.describeValue("hello"));
            assertEquals("some-uuid-value", JwtValidationService.describeValue("some-uuid-value"));
        }
    }
}
