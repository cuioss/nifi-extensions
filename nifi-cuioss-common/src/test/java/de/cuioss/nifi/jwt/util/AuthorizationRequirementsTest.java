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

import de.cuioss.nifi.jwt.JwtAttributes;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.processor.AbstractProcessor;
import org.apache.nifi.processor.ProcessContext;
import org.apache.nifi.processor.ProcessSession;
import org.apache.nifi.processor.Relationship;
import org.apache.nifi.processor.exception.ProcessException;
import org.apache.nifi.util.TestRunner;
import org.apache.nifi.util.TestRunners;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("AuthorizationRequirements")
class AuthorizationRequirementsTest {

    /**
     * Minimal test processor that includes the authorization property descriptors.
     */
    public static class TestProcessor extends AbstractProcessor {
        @Override
        protected List<PropertyDescriptor> getSupportedPropertyDescriptors() {
            return AuthorizationRequirements.getPropertyDescriptors();
        }

        @Override
        public void onTrigger(ProcessContext context, ProcessSession session) throws ProcessException {
            // No-op for testing
        }

        @Override
        public Set<Relationship> getRelationships() {
            return Set.of();
        }
    }

    @Nested
    @DisplayName("Property Descriptor Constants")
    class PropertyDescriptorConstantsTest {

        @Test
        @DisplayName("Should wire descriptor names to the shared JwtAttributes constants")
        void shouldWireDescriptorNamesToConstants() {
            assertEquals(JwtAttributes.Properties.Validation.REQUIRE_VALID_TOKEN,
                    AuthorizationRequirements.REQUIRE_VALID_TOKEN.getName(),
                    "Require-valid-token descriptor must use the shared validation constant");
            assertEquals(JwtAttributes.Properties.Authorization.REQUIRED_ROLES,
                    AuthorizationRequirements.REQUIRED_ROLES.getName(),
                    "Required-roles descriptor must use the shared authorization constant");
            assertEquals(JwtAttributes.Properties.Authorization.REQUIRED_SCOPES,
                    AuthorizationRequirements.REQUIRED_SCOPES.getName(),
                    "Required-scopes descriptor must use the shared authorization constant");
        }
    }

    @Nested
    @DisplayName("Constructor and Defensive Copying")
    class ConstructorTests {

        @Test
        @DisplayName("Should create record with null roles as empty set")
        void shouldHandleNullRoles() {
            var requirements = new AuthorizationRequirements(true, null, Set.of("scope1"));

            assertNotNull(requirements.requiredRoles(), "Roles should not be null");
            assertTrue(requirements.requiredRoles().isEmpty(), "Roles should be empty set");
        }

        @Test
        @DisplayName("Should create record with null scopes as empty set")
        void shouldHandleNullScopes() {
            var requirements = new AuthorizationRequirements(true, Set.of("role1"), null);

            assertNotNull(requirements.requiredScopes(), "Scopes should not be null");
            assertTrue(requirements.requiredScopes().isEmpty(), "Scopes should be empty set");
        }

        @Test
        @DisplayName("Should create defensive copy of roles set")
        void shouldCreateDefensiveCopyOfRoles() {
            Set<String> originalRoles = new HashSet<>();
            originalRoles.add("role1");
            originalRoles.add("role2");

            var requirements = new AuthorizationRequirements(true, originalRoles, Set.of());
            originalRoles.add("role3");

            assertEquals(2, requirements.requiredRoles().size(),
                    "Original set modification should not affect record");
            assertFalse(requirements.requiredRoles().contains("role3"),
                    "Added role should not appear in record");
        }

        @Test
        @DisplayName("Should create defensive copy of scopes set")
        void shouldCreateDefensiveCopyOfScopes() {
            Set<String> originalScopes = new HashSet<>();
            originalScopes.add("scope1");
            originalScopes.add("scope2");

            var requirements = new AuthorizationRequirements(true, Set.of(), originalScopes);
            originalScopes.add("scope3");

            assertEquals(2, requirements.requiredScopes().size(),
                    "Original set modification should not affect record");
            assertFalse(requirements.requiredScopes().contains("scope3"),
                    "Added scope should not appear in record");
        }

        @Test
        @DisplayName("Should return immutable roles set")
        void shouldReturnImmutableRolesSet() {
            var requirements = new AuthorizationRequirements(true, Set.of("role1"), Set.of());
            var roles = requirements.requiredRoles();

            assertThrows(UnsupportedOperationException.class,
                    () -> roles.add("newRole"),
                    "Returned roles set should be immutable");
        }

        @Test
        @DisplayName("Should return immutable scopes set")
        void shouldReturnImmutableScopesSet() {
            var requirements = new AuthorizationRequirements(true, Set.of(), Set.of("scope1"));
            var scopes = requirements.requiredScopes();

            assertThrows(UnsupportedOperationException.class,
                    () -> scopes.add("newScope"),
                    "Returned scopes set should be immutable");
        }
    }

    @Nested
    @DisplayName("hasAuthorizationRequirements()")
    class HasAuthorizationRequirementsTests {

        @Test
        @DisplayName("Should return false when both roles and scopes are empty")
        void shouldReturnFalseWhenBothEmpty() {
            var requirements = new AuthorizationRequirements(true, Set.of(), Set.of());

            boolean hasRequirements = requirements.hasAuthorizationRequirements();

            assertFalse(hasRequirements, "Should return false when both sets are empty");
        }

        @Test
        @DisplayName("Should return true when roles are present")
        void shouldReturnTrueWhenRolesPresent() {
            var requirements = new AuthorizationRequirements(true, Set.of("admin"), Set.of());

            boolean hasRequirements = requirements.hasAuthorizationRequirements();

            assertTrue(hasRequirements, "Should return true when roles are present");
        }

        @Test
        @DisplayName("Should return true when scopes are present")
        void shouldReturnTrueWhenScopesPresent() {
            var requirements = new AuthorizationRequirements(true, Set.of(), Set.of("read"));

            boolean hasRequirements = requirements.hasAuthorizationRequirements();

            assertTrue(hasRequirements, "Should return true when scopes are present");
        }

        @Test
        @DisplayName("Should return true when both roles and scopes are present")
        void shouldReturnTrueWhenBothPresent() {
            var requirements = new AuthorizationRequirements(
                    true, Set.of("admin", "user"), Set.of("read", "write"));

            boolean hasRequirements = requirements.hasAuthorizationRequirements();

            assertTrue(hasRequirements, "Should return true when both roles and scopes are present");
        }

        @Test
        @DisplayName("Should not consider requireValidToken in authorization requirements check")
        void shouldNotConsiderRequireValidToken() {
            var requirementsTrue = new AuthorizationRequirements(true, Set.of(), Set.of());
            var requirementsFalse = new AuthorizationRequirements(false, Set.of(), Set.of());

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
            List<PropertyDescriptor> descriptors = AuthorizationRequirements.getPropertyDescriptors();

            assertNotNull(descriptors, "Descriptors list should not be null");
            assertEquals(3, descriptors.size(), "Should return exactly 3 descriptors");
        }

        @Test
        @DisplayName("REQUIRE_VALID_TOKEN descriptor should have default value 'true'")
        void requireValidTokenShouldHaveDefaultTrue() {
            PropertyDescriptor descriptor = AuthorizationRequirements.REQUIRE_VALID_TOKEN;

            assertNotNull(descriptor, "REQUIRE_VALID_TOKEN should not be null");
            assertEquals("true", descriptor.getDefaultValue(), "Default value should be 'true'");
            assertTrue(descriptor.isRequired(), "REQUIRE_VALID_TOKEN should be required");
        }

        @Test
        @DisplayName("REQUIRE_VALID_TOKEN should have correct name and display name")
        void requireValidTokenShouldHaveCorrectMetadata() {
            PropertyDescriptor descriptor = AuthorizationRequirements.REQUIRE_VALID_TOKEN;

            assertEquals("jwt.validation.require.valid.token", descriptor.getName(),
                    "Name should match");
            assertEquals("Require Valid Token", descriptor.getDisplayName(),
                    "Display name should match");
        }

        @Test
        @DisplayName("REQUIRED_ROLES descriptor should be optional")
        void requiredRolesShouldBeOptional() {
            PropertyDescriptor descriptor = AuthorizationRequirements.REQUIRED_ROLES;

            assertNotNull(descriptor, "REQUIRED_ROLES should not be null");
            assertFalse(descriptor.isRequired(), "REQUIRED_ROLES should be optional");
        }

        @Test
        @DisplayName("REQUIRED_SCOPES descriptor should be optional")
        void requiredScopesShouldBeOptional() {
            PropertyDescriptor descriptor = AuthorizationRequirements.REQUIRED_SCOPES;

            assertNotNull(descriptor, "REQUIRED_SCOPES should not be null");
            assertFalse(descriptor.isRequired(), "REQUIRED_SCOPES should be optional");
        }

        @Test
        @DisplayName("getPropertyDescriptors should include all three descriptors")
        void getPropertyDescriptorsShouldIncludeAllThree() {
            List<PropertyDescriptor> descriptors = AuthorizationRequirements.getPropertyDescriptors();

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

            assertEquals(1, requirements.requiredRoles().size(), "Should have one role");
            assertTrue(requirements.requiredRoles().contains("admin"), "Should contain 'admin'");
        }

        @Test
        @DisplayName("Should parse multiple role values")
        void shouldParseMultipleRoles() {
            var requirements = new AuthorizationRequirements(
                    true, Set.of("admin", "user", "moderator"), Set.of());

            assertEquals(3, requirements.requiredRoles().size(), "Should have three roles");
            assertTrue(requirements.requiredRoles().contains("admin"), "Should contain 'admin'");
            assertTrue(requirements.requiredRoles().contains("user"), "Should contain 'user'");
            assertTrue(requirements.requiredRoles().contains("moderator"), "Should contain 'moderator'");
        }

        @Test
        @DisplayName("Should handle empty set for empty input")
        void shouldHandleEmptyInput() {
            var requirements = new AuthorizationRequirements(true, Set.of(), Set.of());

            assertTrue(requirements.requiredRoles().isEmpty(), "Roles should be empty");
            assertTrue(requirements.requiredScopes().isEmpty(), "Scopes should be empty");
        }

        @Test
        @DisplayName("Should parse scope values correctly")
        void shouldParseScopes() {
            var requirements = new AuthorizationRequirements(
                    true, Set.of(), Set.of("read", "write", "delete"));

            assertEquals(3, requirements.requiredScopes().size(), "Should have three scopes");
            assertTrue(requirements.requiredScopes().contains("read"), "Should contain 'read'");
            assertTrue(requirements.requiredScopes().contains("write"), "Should contain 'write'");
            assertTrue(requirements.requiredScopes().contains("delete"), "Should contain 'delete'");
        }

        @Test
        @DisplayName("Should handle mixed roles and scopes")
        void shouldHandleMixedRolesAndScopes() {
            var requirements = new AuthorizationRequirements(
                    true,
                    Set.of("admin", "user"),
                    Set.of("read", "write"));

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
            var req1 = new AuthorizationRequirements(true, Set.of("admin"), Set.of("read"));
            var req2 = new AuthorizationRequirements(true, Set.of("admin"), Set.of("read"));

            assertEquals(req1, req2, "Records with same values should be equal");
            assertEquals(req1.hashCode(), req2.hashCode(), "Hash codes should match");
        }

        @Test
        @DisplayName("Should not be equal when requireValidToken differs")
        void shouldNotBeEqualWhenRequireValidTokenDiffers() {
            var req1 = new AuthorizationRequirements(true, Set.of("admin"), Set.of("read"));
            var req2 = new AuthorizationRequirements(false, Set.of("admin"), Set.of("read"));

            assertNotEquals(req1, req2, "Records should differ by requireValidToken");
        }

        @Test
        @DisplayName("Should have toString representation")
        void shouldHaveToStringRepresentation() {
            var requirements = new AuthorizationRequirements(true, Set.of("admin"), Set.of("read"));

            String toString = requirements.toString();

            assertNotNull(toString, "toString should not be null");
            assertFalse(toString.isEmpty(), "toString should not be empty");
        }
    }

    @Nested
    @DisplayName("from(ProcessContext) and parseCommaSeparated()")
    class FromProcessContextTests {

        @Test
        @DisplayName("Should parse roles and scopes correctly from ProcessContext")
        void shouldParseRolesAndScopes() {
            TestRunner runner = TestRunners.newTestRunner(new TestProcessor());
            runner.setProperty(AuthorizationRequirements.REQUIRE_VALID_TOKEN, "true");
            runner.setProperty(AuthorizationRequirements.REQUIRED_ROLES, "admin, user");
            runner.setProperty(AuthorizationRequirements.REQUIRED_SCOPES, "read,write");

            AuthorizationRequirements requirements =
                    AuthorizationRequirements.from(runner.getProcessContext());

            assertTrue(requirements.requireValidToken(), "Should require valid token");
            assertEquals(2, requirements.requiredRoles().size(), "Should have 2 roles");
            assertTrue(requirements.requiredRoles().contains("admin"), "Should contain 'admin' role");
            assertTrue(requirements.requiredRoles().contains("user"), "Should contain 'user' role");
            assertEquals(2, requirements.requiredScopes().size(), "Should have 2 scopes");
            assertTrue(requirements.requiredScopes().contains("read"), "Should contain 'read' scope");
            assertTrue(requirements.requiredScopes().contains("write"), "Should contain 'write' scope");
        }

        @Test
        @DisplayName("Should return empty sets when properties are not set")
        void shouldReturnEmptySetsWhenPropertiesNotSet() {
            TestRunner runner = TestRunners.newTestRunner(new TestProcessor());
            runner.setProperty(AuthorizationRequirements.REQUIRE_VALID_TOKEN, "true");
            // Don't set REQUIRED_ROLES or REQUIRED_SCOPES

            AuthorizationRequirements requirements =
                    AuthorizationRequirements.from(runner.getProcessContext());

            assertTrue(requirements.requireValidToken(), "Should require valid token");
            assertTrue(requirements.requiredRoles().isEmpty(), "Roles should be empty");
            assertTrue(requirements.requiredScopes().isEmpty(), "Scopes should be empty");
            assertFalse(requirements.hasAuthorizationRequirements(),
                    "Should not have authorization requirements");
        }

        @Test
        @DisplayName("Should respect requireValidToken=false")
        void shouldRespectRequireValidTokenFalse() {
            TestRunner runner = TestRunners.newTestRunner(new TestProcessor());
            runner.setProperty(AuthorizationRequirements.REQUIRE_VALID_TOKEN, "false");
            runner.setProperty(AuthorizationRequirements.REQUIRED_ROLES, "admin");

            AuthorizationRequirements requirements =
                    AuthorizationRequirements.from(runner.getProcessContext());

            assertFalse(requirements.requireValidToken(), "Should not require valid token");
            assertEquals(1, requirements.requiredRoles().size(), "Should still have roles");
            assertTrue(requirements.requiredRoles().contains("admin"), "Should contain 'admin' role");
        }

        @Test
        @DisplayName("Should trim whitespace and filter empty strings")
        void shouldTrimWhitespaceAndFilterEmpty() {
            TestRunner runner = TestRunners.newTestRunner(new TestProcessor());
            runner.setProperty(AuthorizationRequirements.REQUIRE_VALID_TOKEN, "true");
            runner.setProperty(AuthorizationRequirements.REQUIRED_ROLES, " admin , user , ");
            runner.setProperty(AuthorizationRequirements.REQUIRED_SCOPES, "  read  ,  write  ,  ,  ");

            AuthorizationRequirements requirements =
                    AuthorizationRequirements.from(runner.getProcessContext());

            assertEquals(2, requirements.requiredRoles().size(),
                    "Should have 2 roles (whitespace trimmed, empty filtered)");
            assertTrue(requirements.requiredRoles().contains("admin"), "Should contain trimmed 'admin'");
            assertTrue(requirements.requiredRoles().contains("user"), "Should contain trimmed 'user'");
            assertEquals(2, requirements.requiredScopes().size(),
                    "Should have 2 scopes (whitespace trimmed, empty filtered)");
            assertTrue(requirements.requiredScopes().contains("read"), "Should contain trimmed 'read'");
            assertTrue(requirements.requiredScopes().contains("write"), "Should contain trimmed 'write'");
        }

        @Test
        @DisplayName("Should handle single value without commas")
        void shouldHandleSingleValue() {
            TestRunner runner = TestRunners.newTestRunner(new TestProcessor());
            runner.setProperty(AuthorizationRequirements.REQUIRE_VALID_TOKEN, "true");
            runner.setProperty(AuthorizationRequirements.REQUIRED_ROLES, "admin");

            AuthorizationRequirements requirements =
                    AuthorizationRequirements.from(runner.getProcessContext());

            assertEquals(1, requirements.requiredRoles().size(), "Should have 1 role");
            assertTrue(requirements.requiredRoles().contains("admin"), "Should contain 'admin'");
        }

        @Test
        @DisplayName("Should handle empty string as empty set")
        void shouldHandleEmptyStringAsEmptySet() {
            TestRunner runner = TestRunners.newTestRunner(new TestProcessor());
            runner.setProperty(AuthorizationRequirements.REQUIRE_VALID_TOKEN, "true");
            runner.setProperty(AuthorizationRequirements.REQUIRED_ROLES, "");

            AuthorizationRequirements requirements =
                    AuthorizationRequirements.from(runner.getProcessContext());

            assertTrue(requirements.requiredRoles().isEmpty(), "Empty string should result in empty set");
        }

        @Test
        @DisplayName("Should handle whitespace-only string as empty set")
        void shouldHandleWhitespaceOnlyStringAsEmptySet() {
            TestRunner runner = TestRunners.newTestRunner(new TestProcessor());
            runner.setProperty(AuthorizationRequirements.REQUIRE_VALID_TOKEN, "true");
            runner.setProperty(AuthorizationRequirements.REQUIRED_ROLES, "   ");

            AuthorizationRequirements requirements =
                    AuthorizationRequirements.from(runner.getProcessContext());

            assertTrue(requirements.requiredRoles().isEmpty(),
                    "Whitespace-only string should result in empty set");
        }
    }
}
