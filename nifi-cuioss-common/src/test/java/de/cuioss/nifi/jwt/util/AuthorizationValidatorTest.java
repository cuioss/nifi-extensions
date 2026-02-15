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
package de.cuioss.nifi.jwt.util;

import de.cuioss.nifi.jwt.util.AuthorizationValidator.AuthorizationResult;
import de.cuioss.sheriff.oauth.core.domain.claim.ClaimValue;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.sheriff.oauth.core.test.TestTokenHolder;
import de.cuioss.sheriff.oauth.core.test.generator.TestTokenGenerators;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("AuthorizationValidator")
class AuthorizationValidatorTest {

    @Nested
    @DisplayName("Null Parameter Validation")
    class NullParameterTests {

        @Test
        @DisplayName("Should throw NullPointerException when token is null")
        void shouldThrowWhenTokenIsNull() {
            // Arrange
            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of(), Set.of());

            // Act & Assert
            assertThrows(NullPointerException.class,
                    () -> AuthorizationValidator.validate(null, requirements));
        }

        @Test
        @DisplayName("Should throw NullPointerException when requirements is null")
        void shouldThrowWhenRequirementsIsNull() {
            // Arrange
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            // Act & Assert
            assertThrows(NullPointerException.class,
                    () -> AuthorizationValidator.validate(token, null));
        }
    }

    @Nested
    @DisplayName("No Authorization Requirements")
    class NoRequirementsTests {

        @Test
        @DisplayName("Should authorize when no roles or scopes required")
        void shouldAuthorizeWhenNoRequirements() {
            // Arrange
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            AccessTokenContent token = tokenHolder.asAccessTokenContent();
            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of(), Set.of());

            // Act
            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            // Assert
            assertTrue(result.isAuthorized());
            assertNull(result.getReason());
            assertTrue(result.getMissingScopes().isEmpty());
            assertTrue(result.getMissingRoles().isEmpty());
        }

        @Test
        @DisplayName("Should authorize when requirements has no authorization checks")
        void shouldAuthorizeWhenNoAuthorizationChecks() {
            // Arrange
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            AccessTokenContent token = tokenHolder.asAccessTokenContent();
            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    false, Set.of(), Set.of());

            // Act
            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            // Assert
            assertTrue(result.isAuthorized());
            assertNull(result.getReason());
        }
    }

    @Nested
    @DisplayName("Role-Based Authorization")
    class RoleAuthorizationTests {

        @Test
        @DisplayName("Should authorize when token has all required roles")
        void shouldAuthorizeWhenTokenHasAllRoles() {
            // Arrange
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("roles", ClaimValue.forList("admin,user",
                    List.of("admin", "user", "viewer")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of("admin", "user"), Set.of());

            // Act
            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            // Assert
            assertTrue(result.isAuthorized());
            assertNull(result.getReason());
            assertTrue(result.getMissingRoles().isEmpty());
        }

        @Test
        @DisplayName("Should not authorize when token missing required roles")
        void shouldNotAuthorizeWhenMissingRoles() {
            // Arrange
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("roles", ClaimValue.forList("user",
                    List.of("user", "viewer")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of("admin", "superuser"), Set.of());

            // Act
            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            // Assert
            assertFalse(result.isAuthorized());
            assertNotNull(result.getReason());
            assertTrue(result.getReason().contains("Missing roles"));
            assertFalse(result.getMissingRoles().isEmpty());
            assertTrue(result.getMissingRoles().contains("admin") ||
                    result.getMissingRoles().contains("superuser"));
        }

        @Test
        @DisplayName("Should not authorize when token has only non-matching roles")
        void shouldNotAuthorizeWhenTokenHasNonMatchingRoles() {
            // Arrange
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("roles", ClaimValue.forList("viewer",
                    List.of("viewer")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of("admin"), Set.of());

            // Act
            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            // Assert
            assertFalse(result.isAuthorized());
            assertNotNull(result.getReason());
            assertTrue(result.getReason().contains("Missing roles"));
        }
    }

    @Nested
    @DisplayName("Scope-Based Authorization")
    class ScopeAuthorizationTests {

        @Test
        @DisplayName("Should authorize when token has all required scopes")
        void shouldAuthorizeWhenTokenHasAllScopes() {
            // Arrange
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("scope", ClaimValue.forList("read write delete",
                    List.of("read", "write", "delete")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of(), Set.of("read", "write"));

            // Act
            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            // Assert
            assertTrue(result.isAuthorized());
            assertNull(result.getReason());
            assertTrue(result.getMissingScopes().isEmpty());
        }

        @Test
        @DisplayName("Should not authorize when token missing required scopes")
        void shouldNotAuthorizeWhenMissingScopes() {
            // Arrange
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("scope", ClaimValue.forList("read",
                    List.of("read")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of(), Set.of("read", "write", "delete"));

            // Act
            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            // Assert
            assertFalse(result.isAuthorized());
            assertNotNull(result.getReason());
            assertTrue(result.getReason().contains("Missing scopes"));
            assertFalse(result.getMissingScopes().isEmpty());
            assertTrue(result.getMissingScopes().contains("write") ||
                    result.getMissingScopes().contains("delete"));
        }

        @Test
        @DisplayName("Should not authorize when token has no scopes but scopes required")
        void shouldNotAuthorizeWhenTokenHasNoScopes() {
            // Arrange
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of(), Set.of("read"));

            // Act
            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            // Assert
            assertFalse(result.isAuthorized());
            assertNotNull(result.getReason());
            assertTrue(result.getReason().contains("Missing scopes"));
        }
    }

    @Nested
    @DisplayName("Combined Role and Scope Authorization")
    class CombinedAuthorizationTests {

        @Test
        @DisplayName("Should authorize when token has both required roles and scopes")
        void shouldAuthorizeWhenBothRolesAndScopesSatisfied() {
            // Arrange
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("roles", ClaimValue.forList("admin,user",
                    List.of("admin", "user")));
            tokenHolder.withClaim("scope", ClaimValue.forList("read write",
                    List.of("read", "write")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of("admin"), Set.of("read"));

            // Act
            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            // Assert
            assertTrue(result.isAuthorized());
            assertNull(result.getReason());
            assertTrue(result.getMissingRoles().isEmpty());
            assertTrue(result.getMissingScopes().isEmpty());
        }

        @Test
        @DisplayName("Should not authorize when roles satisfied but scopes missing")
        void shouldNotAuthorizeWhenRolesOkButScopesMissing() {
            // Arrange
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("roles", ClaimValue.forList("admin",
                    List.of("admin")));
            tokenHolder.withClaim("scope", ClaimValue.forList("read",
                    List.of("read")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of("admin"), Set.of("read", "write"));

            // Act
            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            // Assert
            assertFalse(result.isAuthorized());
            assertNotNull(result.getReason());
            assertTrue(result.getReason().contains("Missing scopes"));
            assertTrue(result.getMissingRoles().isEmpty());
            assertFalse(result.getMissingScopes().isEmpty());
        }

        @Test
        @DisplayName("Should not authorize when scopes satisfied but roles missing")
        void shouldNotAuthorizeWhenScopesOkButRolesMissing() {
            // Arrange
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("roles", ClaimValue.forList("user",
                    List.of("user")));
            tokenHolder.withClaim("scope", ClaimValue.forList("read write",
                    List.of("read", "write")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of("admin"), Set.of("read"));

            // Act
            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            // Assert
            assertFalse(result.isAuthorized());
            assertNotNull(result.getReason());
            assertTrue(result.getReason().contains("Missing roles"));
            assertFalse(result.getMissingRoles().isEmpty());
            assertTrue(result.getMissingScopes().isEmpty());
        }

        @Test
        @DisplayName("Should not authorize when both roles and scopes missing")
        void shouldNotAuthorizeWhenBothRolesAndScopesMissing() {
            // Arrange
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("roles", ClaimValue.forList("viewer",
                    List.of("viewer")));
            tokenHolder.withClaim("scope", ClaimValue.forList("read",
                    List.of("read")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of("admin"), Set.of("write"));

            // Act
            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            // Assert
            assertFalse(result.isAuthorized());
            assertNotNull(result.getReason());
            assertTrue(result.getReason().contains("Missing scopes"));
            assertTrue(result.getReason().contains("Missing roles"));
            assertFalse(result.getMissingRoles().isEmpty());
            assertFalse(result.getMissingScopes().isEmpty());
        }
    }

    @Nested
    @DisplayName("AuthorizationResult")
    class AuthorizationResultTests {

        @Test
        @DisplayName("Should create result via builder with all fields")
        void shouldCreateResultViaBuilder() {
            // Arrange & Act
            AuthorizationResult result = AuthorizationResult.builder()
                    .authorized(false)
                    .reason("Test failure reason")
                    .missingScopes(Set.of("write", "delete"))
                    .missingRoles(Set.of("admin"))
                    .build();

            // Assert
            assertFalse(result.isAuthorized());
            assertEquals("Test failure reason", result.getReason());
            assertEquals(Set.of("write", "delete"), result.getMissingScopes());
            assertEquals(Set.of("admin"), result.getMissingRoles());
        }

        @Test
        @DisplayName("Should handle null reason in result")
        void shouldHandleNullReason() {
            // Arrange & Act
            AuthorizationResult result = AuthorizationResult.builder()
                    .authorized(true)
                    .reason(null)
                    .missingScopes(Set.of())
                    .missingRoles(Set.of())
                    .build();

            // Assert
            assertTrue(result.isAuthorized());
            assertNull(result.getReason());
        }

        @Test
        @DisplayName("Should support equals and hashCode")
        void shouldSupportEqualsAndHashCode() {
            // Arrange
            AuthorizationResult result1 = AuthorizationResult.builder()
                    .authorized(true)
                    .missingScopes(Set.of())
                    .missingRoles(Set.of())
                    .build();

            AuthorizationResult result2 = AuthorizationResult.builder()
                    .authorized(true)
                    .missingScopes(Set.of())
                    .missingRoles(Set.of())
                    .build();

            // Act & Assert
            assertEquals(result1, result2);
            assertEquals(result1.hashCode(), result2.hashCode());
        }
    }
}
