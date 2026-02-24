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
package de.cuioss.nifi.rest.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("RouteConfiguration")
class RouteConfigurationTest {

    @Nested
    @DisplayName("Record Contract")
    class RecordContract {

        @Test
        @DisplayName("Should create with all fields")
        void shouldCreateWithAllFields() {
            // Arrange & Act
            var route = new RouteConfiguration(
                    "users", "/api/users", true,
                    Set.of("GET", "POST"),
                    Set.of("admin"),
                    Set.of("read", "write"),
                    "./conf/schemas/user-schema.json");

            // Assert
            assertEquals("users", route.name());
            assertEquals("/api/users", route.path());
            assertTrue(route.enabled());
            assertEquals(Set.of("GET", "POST"), route.methods());
            assertEquals(Set.of("admin"), route.requiredRoles());
            assertEquals(Set.of("read", "write"), route.requiredScopes());
            assertEquals("./conf/schemas/user-schema.json", route.schemaPath());
        }

        @Test
        @DisplayName("Should create with defaults when methods/roles/scopes are null")
        void shouldCreateWithDefaults() {
            // Act
            var route = new RouteConfiguration("health", "/api/health", true, null, null, null, null);

            // Assert
            assertEquals(RouteConfiguration.DEFAULT_METHODS, route.methods());
            assertTrue(route.requiredRoles().isEmpty());
            assertTrue(route.requiredScopes().isEmpty());
            assertNull(route.schemaPath());
        }

        @Test
        @DisplayName("Should have immutable sets")
        void shouldHaveImmutableSets() {
            // Arrange
            var route = new RouteConfiguration("health", "/api/health", true,
                    Set.of("GET"), Set.of("admin"), Set.of("read"), null);

            // Assert
            assertThrows(UnsupportedOperationException.class,
                    () -> route.methods().add("POST"));
            assertThrows(UnsupportedOperationException.class,
                    () -> route.requiredRoles().add("user"));
            assertThrows(UnsupportedOperationException.class,
                    () -> route.requiredScopes().add("write"));
        }

        @Test
        @DisplayName("Should reject null name")
        void shouldRejectNullName() {
            assertThrows(NullPointerException.class,
                    () -> new RouteConfiguration(null, "/api/health", true, null, null, null, null));
        }

        @Test
        @DisplayName("Should reject null path")
        void shouldRejectNullPath() {
            assertThrows(NullPointerException.class,
                    () -> new RouteConfiguration("health", null, true, null, null, null, null));
        }

        @Test
        @DisplayName("Should reject blank path")
        void shouldRejectBlankPath() {
            assertThrows(IllegalArgumentException.class,
                    () -> new RouteConfiguration("health", "  ", true, null, null, null, null));
        }
    }

    @Nested
    @DisplayName("Enabled Flag")
    class EnabledFlag {

        @Test
        @DisplayName("Should be enabled when true")
        void shouldBeEnabledWhenTrue() {
            var route = new RouteConfiguration("health", "/api/health", true, null, null, null, null);
            assertTrue(route.enabled());
        }

        @Test
        @DisplayName("Should be disabled when false")
        void shouldBeDisabledWhenFalse() {
            var route = new RouteConfiguration("health", "/api/health", false, null, null, null, null);
            assertFalse(route.enabled());
        }
    }

    @Nested
    @DisplayName("Schema Validation")
    class SchemaValidation {

        @Test
        @DisplayName("Should report has schema validation when schema path is set")
        void shouldReportHasSchemaValidation() {
            var route = new RouteConfiguration("users", "/api/users",
                    true, null, Set.of(), Set.of(), "./conf/schemas/user-schema.json");
            assertTrue(route.hasSchemaValidation());
        }

        @Test
        @DisplayName("Should report no schema validation when null")
        void shouldReportNoSchemaValidationWhenNull() {
            var route = new RouteConfiguration("health", "/api/health",
                    true, null, Set.of(), Set.of(), null);
            assertFalse(route.hasSchemaValidation());
        }

        @Test
        @DisplayName("Should report no schema validation when blank")
        void shouldReportNoSchemaValidationWhenBlank() {
            var route = new RouteConfiguration("health", "/api/health",
                    true, null, Set.of(), Set.of(), "  ");
            assertFalse(route.hasSchemaValidation());
        }
    }

    @Nested
    @DisplayName("Authorization")
    class Authorization {

        @Test
        @DisplayName("Should report has roles")
        void shouldReportHasRoles() {
            var route = new RouteConfiguration("users", "/api/users",
                    true, null, Set.of("admin"), Set.of(), null);
            assertTrue(route.hasAuthorizationRequirements());
        }

        @Test
        @DisplayName("Should report has scopes")
        void shouldReportHasScopes() {
            var route = new RouteConfiguration("users", "/api/users",
                    true, null, Set.of(), Set.of("read"), null);
            assertTrue(route.hasAuthorizationRequirements());
        }

        @Test
        @DisplayName("Should report no auth requirements")
        void shouldReportNoAuthRequirements() {
            var route = new RouteConfiguration("health", "/api/health",
                    true, null, Set.of(), Set.of(), null);
            assertFalse(route.hasAuthorizationRequirements());
        }

        @Test
        @DisplayName("Should convert to AuthorizationRequirements")
        void shouldConvertToAuthorizationRequirements() {
            // Arrange
            var route = new RouteConfiguration("users", "/api/users",
                    true, null, Set.of("admin", "user"), Set.of("read"), null);

            // Act
            var authReqs = route.toAuthorizationRequirements();

            // Assert
            assertTrue(authReqs.requireValidToken());
            assertEquals(Set.of("admin", "user"), authReqs.requiredRoles());
            assertEquals(Set.of("read"), authReqs.requiredScopes());
            assertTrue(authReqs.hasAuthorizationRequirements());
        }
    }
}
