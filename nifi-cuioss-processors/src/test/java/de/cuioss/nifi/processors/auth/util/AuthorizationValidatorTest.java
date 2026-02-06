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
package de.cuioss.nifi.processors.auth.util;

import de.cuioss.nifi.processors.auth.test.SimpleAccessTokenContent;
import de.cuioss.nifi.processors.auth.util.AuthorizationValidator.AuthorizationConfig;
import de.cuioss.nifi.processors.auth.util.AuthorizationValidator.AuthorizationResult;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link AuthorizationValidator}.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/technical-components.adoc">Technical Components Specification</a>
 */
class AuthorizationValidatorTest {

    @BeforeEach
    void setUp() {
        // No setup needed - using AccessTokenContent.builder() directly in each test
    }

    @Test
    void validateWithNoRequiredScopesOrRoles() {
        // Given
        AccessTokenContent testToken = new SimpleAccessTokenContent.Builder()
                .subject("test-user")
                .scopes(Arrays.asList("read", "write"))
                .roles(Arrays.asList("user", "admin"))
                .build();

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredScopes(null)
                .requiredRoles(null)
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(testToken, config);

        // Then
        assertTrue(result.isAuthorized(), "Authorization should succeed when no scopes or roles are required");
        assertNull(result.getReason(), "No reason should be provided for successful authorization");
        assertTrue(result.getMatchedScopes().isEmpty(), "No scopes should be matched when none are required");
        assertTrue(result.getMatchedRoles().isEmpty(), "No roles should be matched when none are required");
        assertTrue(result.getMissingScopes().isEmpty(), "No scopes should be missing when none are required");
        assertTrue(result.getMissingRoles().isEmpty(), "No roles should be missing when none are required");
    }

    @Test
    void validateWithMatchingScopes() {
        // Given
        AccessTokenContent testToken = new SimpleAccessTokenContent.Builder()
                .subject("test-user")
                .scopes(Arrays.asList("read", "write"))
                .roles(Collections.emptyList())
                .build();

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredScopes(Set.of("read"))
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(testToken, config);

        // Then
        assertTrue(result.isAuthorized(), "Authorization should succeed when required scopes are present");
        assertNull(result.getReason(), "No reason should be provided for successful authorization");
        assertEquals(Set.of("read"), result.getMatchedScopes(), "Should match the required 'read' scope");
        assertTrue(result.getMissingScopes().isEmpty(), "No scopes should be missing when all required scopes are present");
    }

    @Test
    void validateWithMissingScopes() {
        // Given
        AccessTokenContent testToken = new SimpleAccessTokenContent.Builder()
                .subject("test-user")
                .scopes(Arrays.asList("read"))
                .roles(Collections.emptyList())
                .build();

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredScopes(Set.of("admin"))
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(testToken, config);

        // Then
        assertFalse(result.isAuthorized(), "Authorization should fail when required scopes are missing");
        assertNotNull(result.getReason(), "A reason should be provided for failed authorization");
        assertTrue(result.getReason().contains("required scopes"), "Reason should mention missing required scopes");
        assertTrue(result.getMatchedScopes().isEmpty(), "No scopes should be matched when required scope is not present");
        assertEquals(Set.of("admin"), result.getMissingScopes(), "Should identify 'admin' as the missing scope");
    }

    @Test
    void validateWithMatchingRoles() {
        // Given
        AccessTokenContent testToken = new SimpleAccessTokenContent.Builder()
                .subject("test-user")
                .scopes(Collections.emptyList())
                .roles(Arrays.asList("user", "admin"))
                .build();

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredRoles(Set.of("user"))
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(testToken, config);

        // Then
        assertTrue(result.isAuthorized(), "Authorization should succeed when required roles are present");
        assertNull(result.getReason(), "No reason should be provided for successful authorization");
        assertEquals(Set.of("user"), result.getMatchedRoles(), "Should match the required 'user' role");
        assertTrue(result.getMissingRoles().isEmpty(), "No roles should be missing when all required roles are present");
    }

    @Test
    void validateWithMissingRoles() {
        // Given
        AccessTokenContent testToken = new SimpleAccessTokenContent.Builder()
                .subject("test-user")
                .scopes(Collections.emptyList())
                .roles(Arrays.asList("user"))
                .build();

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredRoles(Set.of("admin"))
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(testToken, config);

        // Then
        assertFalse(result.isAuthorized(), "Authorization should fail when required roles are missing");
        assertNotNull(result.getReason(), "A reason should be provided for failed authorization");
        assertTrue(result.getReason().contains("required roles"), "Reason should mention missing required roles");
        assertTrue(result.getMatchedRoles().isEmpty(), "No roles should be matched when required role is not present");
        assertEquals(Set.of("admin"), result.getMissingRoles(), "Should identify 'admin' as the missing role");
    }

    @Test
    void validateWithRequireAllScopes() {
        // Given
        AccessTokenContent testToken = new SimpleAccessTokenContent.Builder()
                .subject("test-user")
                .scopes(Arrays.asList("read", "write"))
                .roles(Collections.emptyList())
                .build();

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredScopes(Set.of("read", "write", "admin"))
                .requireAllScopes(true)
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(testToken, config);

        // Then
        assertFalse(result.isAuthorized(), "Authorization should fail when not all required scopes are present");
        assertNotNull(result.getReason(), "A reason should be provided for failed authorization");
        assertTrue(result.getReason().contains("Missing required scopes"), "Reason should mention missing required scopes");
        assertEquals(Set.of("read", "write"), result.getMatchedScopes(), "Should match 'read' and 'write' scopes");
        assertEquals(Set.of("admin"), result.getMissingScopes(), "Should identify 'admin' as the missing scope");
    }

    @Test
    void validateWithRequireAllRoles() {
        // Given
        AccessTokenContent testToken = new SimpleAccessTokenContent.Builder()
                .subject("test-user")
                .scopes(Collections.emptyList())
                .roles(Arrays.asList("user", "moderator"))
                .build();

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredRoles(Set.of("user", "moderator", "admin"))
                .requireAllRoles(true)
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(testToken, config);

        // Then
        assertFalse(result.isAuthorized(), "Authorization should fail when not all required roles are present");
        assertNotNull(result.getReason(), "A reason should be provided for failed authorization");
        assertTrue(result.getReason().contains("Missing required roles"), "Reason should mention missing required roles");
        assertEquals(Set.of("user", "moderator"), result.getMatchedRoles(), "Should match 'user' and 'moderator' roles");
        assertEquals(Set.of("admin"), result.getMissingRoles(), "Should identify 'admin' as the missing role");
    }

    @Test
    void validateWithCaseInsensitiveScopes() {
        // Given
        AccessTokenContent testToken = new SimpleAccessTokenContent.Builder()
                .subject("test-user")
                .scopes(Arrays.asList("READ", "Write"))
                .roles(Collections.emptyList())
                .build();

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredScopes(Set.of("read", "write"))
                .caseSensitive(false)
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(testToken, config);

        // Then
        assertTrue(result.isAuthorized(), "Authorization should succeed with case-insensitive scope matching");
        assertNull(result.getReason(), "No reason should be provided for successful authorization");
        assertEquals(Set.of("read", "write"), result.getMatchedScopes(), "Should match scopes case-insensitively");
        assertTrue(result.getMissingScopes().isEmpty(), "No scopes should be missing with case-insensitive matching");
    }

    @Test
    void validateWithCaseInsensitiveRoles() {
        // Given
        AccessTokenContent testToken = new SimpleAccessTokenContent.Builder()
                .subject("test-user")
                .scopes(Collections.emptyList())
                .roles(Arrays.asList("USER", "Admin"))
                .build();

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredRoles(Set.of("user", "admin"))
                .caseSensitive(false)
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(testToken, config);

        // Then
        assertTrue(result.isAuthorized(), "Authorization should succeed with case-insensitive role matching");
        assertNull(result.getReason(), "No reason should be provided for successful authorization");
        assertEquals(Set.of("user", "admin"), result.getMatchedRoles(), "Should match roles case-insensitively");
        assertTrue(result.getMissingRoles().isEmpty(), "No roles should be missing with case-insensitive matching");
    }

    @Test
    void validateWithBothScopesAndRoles() {
        // Given
        AccessTokenContent testToken = new SimpleAccessTokenContent.Builder()
                .subject("test-user")
                .scopes(Arrays.asList("read", "write"))
                .roles(Arrays.asList("user"))
                .build();

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredScopes(Set.of("read"))
                .requiredRoles(Set.of("user"))
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(testToken, config);

        // Then
        assertTrue(result.isAuthorized(), "Authorization should succeed when both required scopes and roles are present");
        assertNull(result.getReason(), "No reason should be provided for successful authorization");
        assertEquals(Set.of("read"), result.getMatchedScopes(), "Should match the required 'read' scope");
        assertEquals(Set.of("user"), result.getMatchedRoles(), "Should match the required 'user' role");
    }

    @Test
    void validateWithFailingBothScopesAndRoles() {
        // Given
        AccessTokenContent testToken = new SimpleAccessTokenContent.Builder()
                .subject("test-user")
                .scopes(Arrays.asList("write"))
                .roles(Arrays.asList("guest"))
                .build();

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredScopes(Set.of("admin"))
                .requiredRoles(Set.of("moderator"))
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(testToken, config);

        // Then
        assertFalse(result.isAuthorized(), "Authorization should fail when both required scopes and roles are missing");
        assertNotNull(result.getReason(), "A reason should be provided for failed authorization");
        assertTrue(result.getReason().contains("required scopes"), "Reason should mention missing required scopes");
        assertTrue(result.getReason().contains("required roles"), "Reason should mention missing required roles");
        assertTrue(result.getMatchedScopes().isEmpty(), "No scopes should be matched when required scope is not present");
        assertTrue(result.getMatchedRoles().isEmpty(), "No roles should be matched when required role is not present");
        assertEquals(Set.of("admin"), result.getMissingScopes(), "Should identify 'admin' as the missing scope");
        assertEquals(Set.of("moderator"), result.getMissingRoles(), "Should identify 'moderator' as the missing role");
    }

    @Test
    void validateWithBypassAuthorization() {
        // Given
        AccessTokenContent testToken = new SimpleAccessTokenContent.Builder()
                .subject("test-user")
                .scopes(Collections.emptyList())
                .roles(Collections.emptyList())
                .build();

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredScopes(Set.of("admin"))
                .requiredRoles(Set.of("moderator"))
                .bypassAuthorization(true)
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(testToken, config);

        // Then
        assertTrue(result.isAuthorized(), "Authorization should succeed when bypass is enabled");
        assertEquals("Authorization bypassed", result.getReason(), "Reason should indicate authorization was bypassed");
        assertTrue(result.getMatchedScopes().isEmpty(), "No scopes should be matched when authorization is bypassed");
        assertTrue(result.getMatchedRoles().isEmpty(), "No roles should be matched when authorization is bypassed");
        assertTrue(result.getMissingScopes().isEmpty(), "No missing scopes should be reported when authorization is bypassed");
        assertTrue(result.getMissingRoles().isEmpty(), "No missing roles should be reported when authorization is bypassed");
    }
}