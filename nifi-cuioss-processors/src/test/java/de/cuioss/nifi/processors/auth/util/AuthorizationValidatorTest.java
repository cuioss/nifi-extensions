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

import de.cuioss.jwt.validation.domain.token.AccessTokenContent;
import de.cuioss.nifi.processors.auth.util.AuthorizationValidator.AuthorizationConfig;
import de.cuioss.nifi.processors.auth.util.AuthorizationValidator.AuthorizationResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Arrays;
import java.util.Collections;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

class AuthorizationValidatorTest {

    @Mock
    private AccessTokenContent mockToken;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        when(mockToken.getSubject()).thenReturn(Optional.of("test-user"));
    }

    @Test
    void validateWithNoRequiredScopesOrRoles() {
        // Given
        when(mockToken.getScopes()).thenReturn(Arrays.asList("read", "write"));
        when(mockToken.getRoles()).thenReturn(Arrays.asList("user", "admin"));

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredScopes(null)
                .requiredRoles(null)
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(mockToken, config);

        // Then
        assertTrue(result.isAuthorized());
        assertNull(result.getReason());
        assertTrue(result.getMatchedScopes().isEmpty());
        assertTrue(result.getMatchedRoles().isEmpty());
        assertTrue(result.getMissingScopes().isEmpty());
        assertTrue(result.getMissingRoles().isEmpty());
    }

    @Test
    void validateWithMatchingScopes() {
        // Given
        when(mockToken.getScopes()).thenReturn(Arrays.asList("read", "write"));
        when(mockToken.getRoles()).thenReturn(Collections.emptyList());

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredScopes(Set.of("read"))
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(mockToken, config);

        // Then
        assertTrue(result.isAuthorized());
        assertNull(result.getReason());
        assertEquals(Set.of("read"), result.getMatchedScopes());
        assertTrue(result.getMissingScopes().isEmpty());
    }

    @Test
    void validateWithMissingScopes() {
        // Given
        when(mockToken.getScopes()).thenReturn(Arrays.asList("read"));
        when(mockToken.getRoles()).thenReturn(Collections.emptyList());

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredScopes(Set.of("admin"))
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(mockToken, config);

        // Then
        assertFalse(result.isAuthorized());
        assertNotNull(result.getReason());
        assertTrue(result.getReason().contains("required scopes"));
        assertTrue(result.getMatchedScopes().isEmpty());
        assertEquals(Set.of("admin"), result.getMissingScopes());
    }

    @Test
    void validateWithMatchingRoles() {
        // Given
        when(mockToken.getScopes()).thenReturn(Collections.emptyList());
        when(mockToken.getRoles()).thenReturn(Arrays.asList("user", "admin"));

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredRoles(Set.of("user"))
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(mockToken, config);

        // Then
        assertTrue(result.isAuthorized());
        assertNull(result.getReason());
        assertEquals(Set.of("user"), result.getMatchedRoles());
        assertTrue(result.getMissingRoles().isEmpty());
    }

    @Test
    void validateWithMissingRoles() {
        // Given
        when(mockToken.getScopes()).thenReturn(Collections.emptyList());
        when(mockToken.getRoles()).thenReturn(Arrays.asList("user"));

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredRoles(Set.of("admin"))
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(mockToken, config);

        // Then
        assertFalse(result.isAuthorized());
        assertNotNull(result.getReason());
        assertTrue(result.getReason().contains("required roles"));
        assertTrue(result.getMatchedRoles().isEmpty());
        assertEquals(Set.of("admin"), result.getMissingRoles());
    }

    @Test
    void validateWithRequireAllScopes() {
        // Given
        when(mockToken.getScopes()).thenReturn(Arrays.asList("read", "write"));
        when(mockToken.getRoles()).thenReturn(Collections.emptyList());

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredScopes(Set.of("read", "write", "admin"))
                .requireAllScopes(true)
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(mockToken, config);

        // Then
        assertFalse(result.isAuthorized());
        assertNotNull(result.getReason());
        assertTrue(result.getReason().contains("Missing required scopes"));
        assertEquals(Set.of("read", "write"), result.getMatchedScopes());
        assertEquals(Set.of("admin"), result.getMissingScopes());
    }

    @Test
    void validateWithRequireAllRoles() {
        // Given
        when(mockToken.getScopes()).thenReturn(Collections.emptyList());
        when(mockToken.getRoles()).thenReturn(Arrays.asList("user", "moderator"));

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredRoles(Set.of("user", "moderator", "admin"))
                .requireAllRoles(true)
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(mockToken, config);

        // Then
        assertFalse(result.isAuthorized());
        assertNotNull(result.getReason());
        assertTrue(result.getReason().contains("Missing required roles"));
        assertEquals(Set.of("user", "moderator"), result.getMatchedRoles());
        assertEquals(Set.of("admin"), result.getMissingRoles());
    }

    @Test
    void validateWithCaseInsensitiveScopes() {
        // Given
        when(mockToken.getScopes()).thenReturn(Arrays.asList("READ", "Write"));
        when(mockToken.getRoles()).thenReturn(Collections.emptyList());

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredScopes(Set.of("read", "write"))
                .caseSensitive(false)
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(mockToken, config);

        // Then
        assertTrue(result.isAuthorized());
        assertNull(result.getReason());
        assertEquals(Set.of("read", "write"), result.getMatchedScopes());
        assertTrue(result.getMissingScopes().isEmpty());
    }

    @Test
    void validateWithCaseInsensitiveRoles() {
        // Given
        when(mockToken.getScopes()).thenReturn(Collections.emptyList());
        when(mockToken.getRoles()).thenReturn(Arrays.asList("USER", "Admin"));

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredRoles(Set.of("user", "admin"))
                .caseSensitive(false)
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(mockToken, config);

        // Then
        assertTrue(result.isAuthorized());
        assertNull(result.getReason());
        assertEquals(Set.of("user", "admin"), result.getMatchedRoles());
        assertTrue(result.getMissingRoles().isEmpty());
    }

    @Test
    void validateWithBothScopesAndRoles() {
        // Given
        when(mockToken.getScopes()).thenReturn(Arrays.asList("read", "write"));
        when(mockToken.getRoles()).thenReturn(Arrays.asList("user"));

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredScopes(Set.of("read"))
                .requiredRoles(Set.of("user"))
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(mockToken, config);

        // Then
        assertTrue(result.isAuthorized());
        assertNull(result.getReason());
        assertEquals(Set.of("read"), result.getMatchedScopes());
        assertEquals(Set.of("user"), result.getMatchedRoles());
    }

    @Test
    void validateWithFailingBothScopesAndRoles() {
        // Given
        when(mockToken.getScopes()).thenReturn(Arrays.asList("write"));
        when(mockToken.getRoles()).thenReturn(Arrays.asList("guest"));

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredScopes(Set.of("admin"))
                .requiredRoles(Set.of("moderator"))
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(mockToken, config);

        // Then
        assertFalse(result.isAuthorized());
        assertNotNull(result.getReason());
        assertTrue(result.getReason().contains("required scopes"));
        assertTrue(result.getReason().contains("required roles"));
        assertTrue(result.getMatchedScopes().isEmpty());
        assertTrue(result.getMatchedRoles().isEmpty());
        assertEquals(Set.of("admin"), result.getMissingScopes());
        assertEquals(Set.of("moderator"), result.getMissingRoles());
    }

    @Test
    void validateWithBypassAuthorization() {
        // Given
        when(mockToken.getScopes()).thenReturn(Collections.emptyList());
        when(mockToken.getRoles()).thenReturn(Collections.emptyList());

        AuthorizationConfig config = AuthorizationConfig.builder()
                .requiredScopes(Set.of("admin"))
                .requiredRoles(Set.of("moderator"))
                .bypassAuthorization(true)
                .build();

        // When
        AuthorizationResult result = AuthorizationValidator.validate(mockToken, config);

        // Then - bypass should allow access regardless of missing scopes/roles
        assertTrue(result.isAuthorized());
        assertEquals("Authorization bypassed", result.getReason());
        assertTrue(result.getMatchedScopes().isEmpty());
        assertTrue(result.getMatchedRoles().isEmpty());
        assertTrue(result.getMissingScopes().isEmpty());
        assertTrue(result.getMissingRoles().isEmpty());
    }
}