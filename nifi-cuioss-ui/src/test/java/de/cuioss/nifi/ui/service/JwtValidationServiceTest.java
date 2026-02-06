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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.*;

import static de.cuioss.test.generator.Generators.strings;
import static org.easymock.EasyMock.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link JwtValidationService} and {@link JwtValidationService.TokenValidationResult}.
 *
 * Note: Full testing of processor-based validation requires either:
 * 1. Integration tests with actual NiFi instance (*IT.java tests)
 * 2. Refactoring to use dependency injection (out of scope)
 *
 * These tests focus on:
 * - TokenValidationResult data class functionality
 * - Error handling and edge cases
 */
/**
 * Tests for {@link JwtValidationService}.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 */
@EnableGeneratorController
@DisplayName("JWT Validation Service Tests")
class JwtValidationServiceTest {

    private JwtValidationService service;

    @BeforeEach
    void setUp() {
        service = new JwtValidationService();
    }

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
    @DisplayName("Processor ID Validation Tests")
    class ProcessorIdValidationTests {

        @Test
        @DisplayName("Should reject null processor ID")
        void shouldRejectNullProcessorId() {
            // Arrange & Act & Assert
            assertThrows(NullPointerException.class,
                    () -> service.verifyToken("some-token", null),
                    "Should throw NullPointerException for null processorId");
        }
    }

    @Nested
    @DisplayName("Service Creation Tests")
    class ServiceCreationTests {

        @Test
        @DisplayName("Should create service instance successfully")
        void shouldCreateServiceInstanceSuccessfully() {
            // Arrange & Act
            JwtValidationService newService = new JwtValidationService();

            // Assert
            assertNotNull(newService, "Service instance should be created successfully");
        }
    }
}
