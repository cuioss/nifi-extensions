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

import org.apache.nifi.components.PropertyDescriptor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("AuthorizationRequirements")
class AuthorizationRequirementsTest {

    @Nested
    @DisplayName("Constructor and Defensive Copying")
    class ConstructorTests {

        @Test
        @DisplayName("Should create record with null roles as empty set")
        void shouldHandleNullRoles() {
            // Arrange & Act
            var requirements = new AuthorizationRequirements(true, null, Set.of("scope1"));

            // Assert
            assertNotNull(requirements.requiredRoles(), "Roles should not be null");
            assertTrue(requirements.requiredRoles().isEmpty(), "Roles should be empty set");
        }

        @Test
        @DisplayName("Should create record with null scopes as empty set")
        void shouldHandleNullScopes() {
            // Arrange & Act
            var requirements = new AuthorizationRequirements(true, Set.of("role1"), null);

            // Assert
            assertNotNull(requirements.requiredScopes(), "Scopes should not be null");
            assertTrue(requirements.requiredScopes().isEmpty(), "Scopes should be empty set");
        }

        @Test
        @DisplayName("Should create defensive copy of roles set")
        void shouldCreateDefensiveCopyOfRoles() {
            // Arrange
            Set<String> originalRoles = new HashSet<>();
            originalRoles.add("role1");
            originalRoles.add("role2");

            // Act
            var requirements = new AuthorizationRequirements(true, originalRoles, Set.of());
            originalRoles.add("role3");

            // Assert
            assertEquals(2, requirements.requiredRoles().size(),
                    "Original set modification should not affect record");
            assertFalse(requirements.requiredRoles().contains("role3"),
                    "Added role should not appear in record");
        }

        @Test
        @DisplayName("Should create defensive copy of scopes set")
        void shouldCreateDefensiveCopyOfScopes() {
            // Arrange
            Set<String> originalScopes = new HashSet<>();
            originalScopes.add("scope1");
            originalScopes.add("scope2");

            // Act
            var requirements = new AuthorizationRequirements(true, Set.of(), originalScopes);
            originalScopes.add("scope3");

            // Assert
            assertEquals(2, requirements.requiredScopes().size(),
                    "Original set modification should not affect record");
            assertFalse(requirements.requiredScopes().contains("scope3"),
                    "Added scope should not appear in record");
        }

        @Test
        @DisplayName("Should return immutable roles set")
        void shouldReturnImmutableRolesSet() {
            // Arrange
            var requirements = new AuthorizationRequirements(true, Set.of("role1"), Set.of());

            // Act & Assert
            assertThrows(UnsupportedOperationException.class,
                    () -> requirements.requiredRoles().add("newRole"),
                    "Returned roles set should be immutable");
        }

        @Test
        @DisplayName("Should return immutable scopes set")
        void shouldReturnImmutableScopesSet() {
            // Arrange
            var requirements = new AuthorizationRequirements(true, Set.of(), Set.of("scope1"));

            // Act & Assert
            assertThrows(UnsupportedOperationException.class,
                    () -> requirements.requiredScopes().add("newScope"),
                    "Returned scopes set should be immutable");
        }
    }

    @Nested
    @DisplayName("hasAuthorizationRequirements()")
    class HasAuthorizationRequirementsTests {

        @Test
        @DisplayName("Should return false when both roles and scopes are empty")
        void shouldReturnFalseWhenBothEmpty() {
            // Arrange
            var requirements = new AuthorizationRequirements(true, Set.of(), Set.of());

            // Act
            boolean hasRequirements = requirements.hasAuthorizationRequirements();

            // Assert
            assertFalse(hasRequirements, "Should return false when both sets are empty");
        }

        @Test
        @DisplayName("Should return true when roles are present")
        void shouldReturnTrueWhenRolesPresent() {
            // Arrange
            var requirements = new AuthorizationRequirements(true, Set.of("admin"), Set.of());

            // Act
            boolean hasRequirements = requirements.hasAuthorizationRequirements();

            // Assert
            assertTrue(hasRequirements, "Should return true when roles are present");
        }

        @Test
        @DisplayName("Should return true when scopes are present")
        void shouldReturnTrueWhenScopesPresent() {
            // Arrange
            var requirements = new AuthorizationRequirements(true, Set.of(), Set.of("read"));

            // Act
            boolean hasRequirements = requirements.hasAuthorizationRequirements();

            // Assert
            assertTrue(hasRequirements, "Should return true when scopes are present");
        }

        @Test
        @DisplayName("Should return true when both roles and scopes are present")
        void shouldReturnTrueWhenBothPresent() {
            // Arrange
            var requirements = new AuthorizationRequirements(
                    true, Set.of("admin", "user"), Set.of("read", "write"));

            // Act
            boolean hasRequirements = requirements.hasAuthorizationRequirements();

            // Assert
            assertTrue(hasRequirements, "Should return true when both roles and scopes are present");
        }

        @Test
        @DisplayName("Should not consider requireValidToken in authorization requirements check")
        void shouldNotConsiderRequireValidToken() {
            // Arrange
            var requirementsTrue = new AuthorizationRequirements(true, Set.of(), Set.of());
            var requirementsFalse = new AuthorizationRequirements(false, Set.of(), Set.of());

            // Act & Assert
            assertFalse(requirementsTrue.hasAuthorizationRequirements(),
                    "Should not consider requireValidToken flag");
            assertFalse(requirementsFalse.hasAuthorizationRequirements(),
                    "Should not consider requireValidToken flag");
        }
    }

    @Nested
    @DisplayName("Property Descriptors")
    class PropertyDescriptorsTests {

        @Test
        @DisplayName("getPropertyDescriptors should return 3 descriptors")
        void shouldReturn3Descriptors() {
            // Act
            List<PropertyDescriptor> descriptors = AuthorizationRequirements.getPropertyDescriptors();

            // Assert
            assertNotNull(descriptors, "Descriptors list should not be null");
            assertEquals(3, descriptors.size(), "Should return exactly 3 descriptors");
        }

        @Test
        @DisplayName("REQUIRE_VALID_TOKEN descriptor should have default value 'true'")
        void requireValidTokenShouldHaveDefaultTrue() {
            // Act
            PropertyDescriptor descriptor = AuthorizationRequirements.REQUIRE_VALID_TOKEN;

            // Assert
            assertNotNull(descriptor, "REQUIRE_VALID_TOKEN should not be null");
            assertEquals("true", descriptor.getDefaultValue(), "Default value should be 'true'");
            assertTrue(descriptor.isRequired(), "REQUIRE_VALID_TOKEN should be required");
        }

        @Test
        @DisplayName("REQUIRE_VALID_TOKEN should have correct name and display name")
        void requireValidTokenShouldHaveCorrectMetadata() {
            // Act
            PropertyDescriptor descriptor = AuthorizationRequirements.REQUIRE_VALID_TOKEN;

            // Assert
            assertEquals("jwt.validation.require.valid.token", descriptor.getName(),
                    "Name should match");
            assertEquals("Require Valid Token", descriptor.getDisplayName(),
                    "Display name should match");
        }

        @Test
        @DisplayName("REQUIRED_ROLES descriptor should be optional")
        void requiredRolesShouldBeOptional() {
            // Act
            PropertyDescriptor descriptor = AuthorizationRequirements.REQUIRED_ROLES;

            // Assert
            assertNotNull(descriptor, "REQUIRED_ROLES should not be null");
            assertFalse(descriptor.isRequired(), "REQUIRED_ROLES should be optional");
        }

        @Test
        @DisplayName("REQUIRED_SCOPES descriptor should be optional")
        void requiredScopesShouldBeOptional() {
            // Act
            PropertyDescriptor descriptor = AuthorizationRequirements.REQUIRED_SCOPES;

            // Assert
            assertNotNull(descriptor, "REQUIRED_SCOPES should not be null");
            assertFalse(descriptor.isRequired(), "REQUIRED_SCOPES should be optional");
        }

        @Test
        @DisplayName("getPropertyDescriptors should include all three descriptors")
        void getPropertyDescriptorsShouldIncludeAllThree() {
            // Act
            List<PropertyDescriptor> descriptors = AuthorizationRequirements.getPropertyDescriptors();

            // Assert
            assertTrue(descriptors.contains(AuthorizationRequirements.REQUIRE_VALID_TOKEN),
                    "Should include REQUIRE_VALID_TOKEN");
            assertTrue(descriptors.contains(AuthorizationRequirements.REQUIRED_ROLES),
                    "Should include REQUIRED_ROLES");
            assertTrue(descriptors.contains(AuthorizationRequirements.REQUIRED_SCOPES),
                    "Should include REQUIRED_SCOPES");
        }
    }

    @Nested
    @DisplayName("Comma-Separated Parsing (via constructor)")
    class CommaSeparatedParsingTests {

        @Test
        @DisplayName("Should parse single role value")
        void shouldParseSingleRole() {
            // Arrange - simulating what parseCommaSeparated would do
            var requirements = new AuthorizationRequirements(true, Set.of("admin"), Set.of());

            // Assert
            assertEquals(1, requirements.requiredRoles().size(), "Should have one role");
            assertTrue(requirements.requiredRoles().contains("admin"), "Should contain 'admin'");
        }

        @Test
        @DisplayName("Should parse multiple role values")
        void shouldParseMultipleRoles() {
            // Arrange
            var requirements = new AuthorizationRequirements(
                    true, Set.of("admin", "user", "moderator"), Set.of());

            // Assert
            assertEquals(3, requirements.requiredRoles().size(), "Should have three roles");
            assertTrue(requirements.requiredRoles().contains("admin"), "Should contain 'admin'");
            assertTrue(requirements.requiredRoles().contains("user"), "Should contain 'user'");
            assertTrue(requirements.requiredRoles().contains("moderator"), "Should contain 'moderator'");
        }

        @Test
        @DisplayName("Should handle empty set for empty input")
        void shouldHandleEmptyInput() {
            // Arrange
            var requirements = new AuthorizationRequirements(true, Set.of(), Set.of());

            // Assert
            assertTrue(requirements.requiredRoles().isEmpty(), "Roles should be empty");
            assertTrue(requirements.requiredScopes().isEmpty(), "Scopes should be empty");
        }

        @Test
        @DisplayName("Should parse scope values correctly")
        void shouldParseScopes() {
            // Arrange
            var requirements = new AuthorizationRequirements(
                    true, Set.of(), Set.of("read", "write", "delete"));

            // Assert
            assertEquals(3, requirements.requiredScopes().size(), "Should have three scopes");
            assertTrue(requirements.requiredScopes().contains("read"), "Should contain 'read'");
            assertTrue(requirements.requiredScopes().contains("write"), "Should contain 'write'");
            assertTrue(requirements.requiredScopes().contains("delete"), "Should contain 'delete'");
        }

        @Test
        @DisplayName("Should handle mixed roles and scopes")
        void shouldHandleMixedRolesAndScopes() {
            // Arrange
            var requirements = new AuthorizationRequirements(
                    true,
                    Set.of("admin", "user"),
                    Set.of("read", "write"));

            // Assert
            assertEquals(2, requirements.requiredRoles().size(), "Should have two roles");
            assertEquals(2, requirements.requiredScopes().size(), "Should have two scopes");
            assertTrue(requirements.hasAuthorizationRequirements(),
                    "Should have authorization requirements");
        }
    }

    @Nested
    @DisplayName("Record Equality and Behavior")
    class RecordBehaviorTests {

        @Test
        @DisplayName("Should be equal when all fields match")
        void shouldBeEqualWhenFieldsMatch() {
            // Arrange
            var req1 = new AuthorizationRequirements(true, Set.of("admin"), Set.of("read"));
            var req2 = new AuthorizationRequirements(true, Set.of("admin"), Set.of("read"));

            // Assert
            assertEquals(req1, req2, "Records with same values should be equal");
            assertEquals(req1.hashCode(), req2.hashCode(), "Hash codes should match");
        }

        @Test
        @DisplayName("Should not be equal when requireValidToken differs")
        void shouldNotBeEqualWhenRequireValidTokenDiffers() {
            // Arrange
            var req1 = new AuthorizationRequirements(true, Set.of("admin"), Set.of("read"));
            var req2 = new AuthorizationRequirements(false, Set.of("admin"), Set.of("read"));

            // Assert
            assertNotEquals(req1, req2, "Records should differ by requireValidToken");
        }

        @Test
        @DisplayName("Should have toString representation")
        void shouldHaveToStringRepresentation() {
            // Arrange
            var requirements = new AuthorizationRequirements(true, Set.of("admin"), Set.of("read"));

            // Act
            String toString = requirements.toString();

            // Assert
            assertNotNull(toString, "toString should not be null");
            assertFalse(toString.isEmpty(), "toString should not be empty");
        }
    }
}
