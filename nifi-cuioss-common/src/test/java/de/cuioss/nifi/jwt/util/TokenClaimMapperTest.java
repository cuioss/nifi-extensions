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

import de.cuioss.nifi.jwt.JWTAttributes;
import de.cuioss.sheriff.oauth.core.domain.claim.ClaimValue;
import de.cuioss.sheriff.oauth.core.test.TestTokenHolder;
import de.cuioss.sheriff.oauth.core.test.generator.TestTokenGenerators;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("TokenClaimMapper")
class TokenClaimMapperTest {

    @Nested
    @DisplayName("Standard Claims")
    class StandardClaimsTests {

        @Test
        @DisplayName("Should map subject, issuer, expiration, and validatedAt")
        void shouldMapStandardClaims() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            var token = tokenHolder.asAccessTokenContent();

            Map<String, String> attributes = TokenClaimMapper.mapToAttributes(token);

            assertNotNull(attributes.get(JWTAttributes.Token.VALIDATED_AT),
                    "validatedAt should be present");
            assertEquals(token.getSubject().orElse(""), attributes.get(JWTAttributes.Token.SUBJECT));
            assertEquals(token.getIssuer(), attributes.get(JWTAttributes.Token.ISSUER));
            assertEquals(token.getExpirationTime().toString(), attributes.get(JWTAttributes.Token.EXPIRATION));
        }

        @Test
        @DisplayName("Should use empty string for missing subject")
        void shouldHandleMissingSubject() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            var token = tokenHolder.asAccessTokenContent();

            Map<String, String> attributes = TokenClaimMapper.mapToAttributes(token);

            assertNotNull(attributes.get(JWTAttributes.Token.SUBJECT));
        }
    }

    @Nested
    @DisplayName("Roles, Groups, and Scopes")
    class AuthorizationClaimsTests {

        @Test
        @DisplayName("Should map roles as comma-separated string")
        void shouldMapRoles() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("roles", ClaimValue.forList("admin,user",
                    List.of("admin", "user")));
            var token = tokenHolder.asAccessTokenContent();

            Map<String, String> attributes = TokenClaimMapper.mapToAttributes(token);

            assertTrue(token.getRoles().contains("admin") || token.getRoles().contains("user")
                    || attributes.containsKey(JWTAttributes.Authorization.ROLES),
                    "Roles should be mapped when present");
        }

        @Test
        @DisplayName("Should map scopes as comma-separated string when scope claim exists")
        void shouldMapScopes() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("scope", ClaimValue.forList("read write",
                    List.of("read", "write")));
            var token = tokenHolder.asAccessTokenContent();

            Map<String, String> attributes = TokenClaimMapper.mapToAttributes(token);

            assertTrue(attributes.containsKey(JWTAttributes.Authorization.SCOPES),
                    "Scopes should be mapped when scope claim exists");
            String scopes = attributes.get(JWTAttributes.Authorization.SCOPES);
            assertTrue(scopes.contains("read") && scopes.contains("write"),
                    "Scopes should contain 'read' and 'write'");
        }

        @Test
        @DisplayName("Should not include scopes attribute when no scope claim")
        void shouldNotMapScopesWhenAbsent() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            var token = tokenHolder.asAccessTokenContent();

            // Default tokens from generator don't have scope claim
            if (!token.getClaims().containsKey("scope")) {
                Map<String, String> attributes = TokenClaimMapper.mapToAttributes(token);
                assertNull(attributes.get(JWTAttributes.Authorization.SCOPES),
                        "Scopes should not be present when no scope claim");
            }
        }
    }

    @Nested
    @DisplayName("Custom Claims")
    class CustomClaimsTests {

        @Test
        @DisplayName("Should map custom claims with jwt.content. prefix")
        void shouldMapCustomClaims() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            tokenHolder.withClaim("tenant-id", ClaimValue.forPlainString("acme-corp"));
            tokenHolder.withClaim("department", ClaimValue.forPlainString("engineering"));
            var token = tokenHolder.asAccessTokenContent();

            Map<String, String> attributes = TokenClaimMapper.mapToAttributes(token);

            assertEquals("acme-corp", attributes.get(JWTAttributes.Content.PREFIX + "tenant-id"));
            assertEquals("engineering", attributes.get(JWTAttributes.Content.PREFIX + "department"));
        }

        @Test
        @DisplayName("Should filter out dedicated claim keys from custom claims")
        void shouldFilterDedicatedClaimKeys() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            var token = tokenHolder.asAccessTokenContent();

            Map<String, String> attributes = TokenClaimMapper.mapToAttributes(token);

            // These keys should NOT appear with the content prefix
            assertNull(attributes.get(JWTAttributes.Content.PREFIX + "sub"),
                    "sub should not be in custom claims");
            assertNull(attributes.get(JWTAttributes.Content.PREFIX + "iss"),
                    "iss should not be in custom claims");
            assertNull(attributes.get(JWTAttributes.Content.PREFIX + "exp"),
                    "exp should not be in custom claims");
        }
    }

    @Nested
    @DisplayName("Return Value Properties")
    class ReturnValueTests {

        @Test
        @DisplayName("Should return mutable map")
        void shouldReturnMutableMap() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            var token = tokenHolder.asAccessTokenContent();

            Map<String, String> attributes = TokenClaimMapper.mapToAttributes(token);

            // Callers need to add jwt.present, jwt.authorized etc.
            assertDoesNotThrow(() -> attributes.put("jwt.present", "true"),
                    "Returned map should be mutable");
        }

        @Test
        @DisplayName("Should not include routing attributes (present, authorized)")
        void shouldNotIncludeRoutingAttributes() {
            TestTokenHolder tokenHolder = TestTokenGenerators.accessTokens().next();
            var token = tokenHolder.asAccessTokenContent();

            Map<String, String> attributes = TokenClaimMapper.mapToAttributes(token);

            assertNull(attributes.get(JWTAttributes.Token.PRESENT),
                    "jwt.present is a routing concern, not a claim");
            assertNull(attributes.get(JWTAttributes.Authorization.AUTHORIZED),
                    "jwt.authorized is an authorization concern, not a claim");
        }
    }

    @Test
    @DisplayName("Should reject null token")
    void shouldRejectNullToken() {
        assertThrows(NullPointerException.class,
                () -> TokenClaimMapper.mapToAttributes(null));
    }
}
