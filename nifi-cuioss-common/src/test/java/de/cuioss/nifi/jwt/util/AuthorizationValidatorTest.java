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
import de.cuioss.sheriff.token.validation.domain.claim.ClaimValue;
import de.cuioss.sheriff.token.validation.domain.token.AccessTokenContent;
import de.cuioss.sheriff.token.validation.test.TestTokenHolder;
import de.cuioss.sheriff.token.validation.test.generator.TestTokenGenerators;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
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
            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of(), Set.of());

            assertThrows(NullPointerException.class,
                    () -> AuthorizationValidator.validate(null, requirements));
        }

        @Test
        @DisplayName("Should throw NullPointerException when requirements is null")
        void shouldThrowWhenRequirementsIsNull() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

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
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            AccessTokenContent token = tokenHolder.asAccessTokenContent();
            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of(), Set.of());

            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            assertTrue(result.authorized());
            assertNull(result.reason());
            assertTrue(result.missingScopes().isEmpty());
            assertTrue(result.missingRoles().isEmpty());
        }

        @Test
        @DisplayName("Should authorize when requirements has no authorization checks")
        void shouldAuthorizeWhenNoAuthorizationChecks() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            AccessTokenContent token = tokenHolder.asAccessTokenContent();
            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    false, Set.of(), Set.of());

            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            assertTrue(result.authorized());
            assertNull(result.reason());
        }
    }

    @Nested
    @DisplayName("Role-Based Authorization")
    class RoleAuthorizationTests {

        @Test
        @DisplayName("Should authorize when token has all required roles")
        void shouldAuthorizeWhenTokenHasAllRoles() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("roles", ClaimValue.forList("admin,user",
                    List.of("admin", "user", "viewer")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of("admin", "user"), Set.of());

            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            assertTrue(result.authorized());
            assertNull(result.reason());
            assertTrue(result.missingRoles().isEmpty());
        }

        @Test
        @DisplayName("Should not authorize when token missing required roles")
        void shouldNotAuthorizeWhenMissingRoles() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("roles", ClaimValue.forList("user",
                    List.of("user", "viewer")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of("admin", "superuser"), Set.of());

            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            assertFalse(result.authorized());
            assertNotNull(result.reason());
            assertTrue(result.reason().contains("Missing roles"));
            assertFalse(result.missingRoles().isEmpty());
            assertTrue(result.missingRoles().contains("admin") ||
                    result.missingRoles().contains("superuser"));
        }

        @Test
        @DisplayName("Should not authorize when token has only non-matching roles")
        void shouldNotAuthorizeWhenTokenHasNonMatchingRoles() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("roles", ClaimValue.forList("viewer",
                    List.of("viewer")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of("admin"), Set.of());

            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            assertFalse(result.authorized());
            assertNotNull(result.reason());
            assertTrue(result.reason().contains("Missing roles"));
        }
    }

    @Nested
    @DisplayName("Scope-Based Authorization")
    class ScopeAuthorizationTests {

        @Test
        @DisplayName("Should authorize when token has all required scopes")
        void shouldAuthorizeWhenTokenHasAllScopes() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("scope", ClaimValue.forList("read write delete",
                    List.of("read", "write", "delete")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of(), Set.of("read", "write"));

            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            assertTrue(result.authorized());
            assertNull(result.reason());
            assertTrue(result.missingScopes().isEmpty());
        }

        @Test
        @DisplayName("Should not authorize when token missing required scopes")
        void shouldNotAuthorizeWhenMissingScopes() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("scope", ClaimValue.forList("read",
                    List.of("read")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of(), Set.of("read", "write", "delete"));

            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            assertFalse(result.authorized());
            assertNotNull(result.reason());
            assertTrue(result.reason().contains("Missing scopes"));
            assertFalse(result.missingScopes().isEmpty());
            assertTrue(result.missingScopes().contains("write") ||
                    result.missingScopes().contains("delete"));
        }

        @Test
        @DisplayName("Should not authorize when token has no scopes but scopes required")
        void shouldNotAuthorizeWhenTokenHasNoScopes() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of(), Set.of("read"));

            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            assertFalse(result.authorized());
            assertNotNull(result.reason());
            assertTrue(result.reason().contains("Missing scopes"));
        }
    }

    @Nested
    @DisplayName("Combined Role and Scope Authorization")
    class CombinedAuthorizationTests {

        @Test
        @DisplayName("Should authorize when token has both required roles and scopes")
        void shouldAuthorizeWhenBothRolesAndScopesSatisfied() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("roles", ClaimValue.forList("admin,user",
                    List.of("admin", "user")));
            tokenHolder.withClaim("scope", ClaimValue.forList("read write",
                    List.of("read", "write")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of("admin"), Set.of("read"));

            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            assertTrue(result.authorized());
            assertNull(result.reason());
            assertTrue(result.missingRoles().isEmpty());
            assertTrue(result.missingScopes().isEmpty());
        }

        @Test
        @DisplayName("Should not authorize when roles satisfied but scopes missing")
        void shouldNotAuthorizeWhenRolesOkButScopesMissing() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("roles", ClaimValue.forList("admin",
                    List.of("admin")));
            tokenHolder.withClaim("scope", ClaimValue.forList("read",
                    List.of("read")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of("admin"), Set.of("read", "write"));

            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            assertFalse(result.authorized());
            assertNotNull(result.reason());
            assertTrue(result.reason().contains("Missing scopes"));
            assertTrue(result.missingRoles().isEmpty());
            assertFalse(result.missingScopes().isEmpty());
        }

        @Test
        @DisplayName("Should not authorize when scopes satisfied but roles missing")
        void shouldNotAuthorizeWhenScopesOkButRolesMissing() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("roles", ClaimValue.forList("user",
                    List.of("user")));
            tokenHolder.withClaim("scope", ClaimValue.forList("read write",
                    List.of("read", "write")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of("admin"), Set.of("read"));

            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            assertFalse(result.authorized());
            assertNotNull(result.reason());
            assertTrue(result.reason().contains("Missing roles"));
            assertFalse(result.missingRoles().isEmpty());
            assertTrue(result.missingScopes().isEmpty());
        }

        @Test
        @DisplayName("Should not authorize when both roles and scopes missing")
        void shouldNotAuthorizeWhenBothRolesAndScopesMissing() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("roles", ClaimValue.forList("viewer",
                    List.of("viewer")));
            tokenHolder.withClaim("scope", ClaimValue.forList("read",
                    List.of("read")));
            AccessTokenContent token = tokenHolder.asAccessTokenContent();

            AuthorizationRequirements requirements = new AuthorizationRequirements(
                    true, Set.of("admin"), Set.of("write"));

            AuthorizationResult result = AuthorizationValidator.validate(token, requirements);

            assertFalse(result.authorized());
            assertNotNull(result.reason());
            assertTrue(result.reason().contains("Missing scopes"));
            assertTrue(result.reason().contains("Missing roles"));
            assertFalse(result.missingRoles().isEmpty());
            assertFalse(result.missingScopes().isEmpty());
        }
    }

    @Nested
    @DisplayName("AuthorizationResult")
    class AuthorizationResultTests {

        @Test
        @DisplayName("Should create result via builder with all fields")
        void shouldCreateResultViaBuilder() {
            AuthorizationResult result = AuthorizationResult.builder()
                    .authorized(false)
                    .reason("Test failure reason")
                    .missingScopes(Set.of("write", "delete"))
                    .missingRoles(Set.of("admin"))
                    .build();

            assertFalse(result.authorized());
            assertEquals("Test failure reason", result.reason());
            assertEquals(Set.of("write", "delete"), result.missingScopes());
            assertEquals(Set.of("admin"), result.missingRoles());
        }

        @Test
        @DisplayName("Should handle null reason in result")
        void shouldHandleNullReason() {
            AuthorizationResult result = AuthorizationResult.builder()
                    .authorized(true)
                    .reason(null)
                    .missingScopes(Set.of())
                    .missingRoles(Set.of())
                    .build();

            assertTrue(result.authorized());
            assertNull(result.reason());
        }

        @Test
        @DisplayName("Should support equals and hashCode")
        void shouldSupportEqualsAndHashCode() {
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

            assertEquals(result1, result2);
            assertEquals(result1.hashCode(), result2.hashCode());
        }

        @Test
        @DisplayName("Should null-coalesce missing scopes and roles to empty sets when omitted")
        void shouldNullCoalesceMissingSetsWhenOmitted() {
            AuthorizationResult result = AuthorizationResult.builder()
                    .authorized(true)
                    .build();

            assertNotNull(result.missingScopes(), "missingScopes must never be null");
            assertNotNull(result.missingRoles(), "missingRoles must never be null");
            assertTrue(result.missingScopes().isEmpty(), "Omitted missingScopes must be an empty set");
            assertTrue(result.missingRoles().isEmpty(), "Omitted missingRoles must be an empty set");
        }

        @Test
        @DisplayName("Should hold an unmodifiable defensive copy of the missing scopes")
        void shouldHoldDefensiveCopyOfMissingScopes() {
            Set<String> mutableInput = new HashSet<>(Set.of("write"));
            AuthorizationResult result = AuthorizationResult.builder()
                    .authorized(false)
                    .missingScopes(mutableInput)
                    .missingRoles(Set.of())
                    .build();

            mutableInput.add("delete");

            assertEquals(Set.of("write"), result.missingScopes(),
                    "Result must hold a defensive copy decoupled from the caller's mutable input");
            assertThrows(UnsupportedOperationException.class,
                    () -> result.missingScopes().add("x"),
                    "Exposed missingScopes must be unmodifiable");
        }
    }
}
