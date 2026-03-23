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
            var route = RouteConfiguration.builder()
                    .name("users").path("/api/users")
                    .method("GET").method("POST")
                    .requiredRole("admin")
                    .requiredScope("read").requiredScope("write")
                    .schemaPath("./conf/schemas/user-schema.json")
                    .build();

            // Assert
            assertEquals("users", route.name());
            assertEquals("/api/users", route.path());
            assertTrue(route.enabled());
            assertEquals(Set.of("GET", "POST"), route.methods());
            assertEquals(Set.of("admin"), route.requiredRoles());
            assertEquals(Set.of("read", "write"), route.requiredScopes());
            assertEquals("./conf/schemas/user-schema.json", route.schemaPath());
            assertNull(route.successOutcome());
            assertTrue(route.createFlowFile());
        }

        @Test
        @DisplayName("Should create with defaults when methods/roles/scopes are null")
        void shouldCreateWithDefaults() {
            var route = RouteConfiguration.builder()
                    .name("health").path("/api/health").build();

            assertEquals(RouteConfiguration.DEFAULT_METHODS, route.methods());
            assertTrue(route.requiredRoles().isEmpty());
            assertTrue(route.requiredScopes().isEmpty());
            assertNull(route.schemaPath());
            assertTrue(route.enabled());
            assertTrue(route.createFlowFile());
        }

        @Test
        @DisplayName("Should have immutable sets")
        void shouldHaveImmutableSets() {
            var route = RouteConfiguration.builder()
                    .name("health").path("/api/health")
                    .method("GET").requiredRole("admin").requiredScope("read")
                    .build();

            var methods = route.methods();
            var roles = route.requiredRoles();
            var scopes = route.requiredScopes();
            assertThrows(UnsupportedOperationException.class, () -> methods.add("POST"));
            assertThrows(UnsupportedOperationException.class, () -> roles.add("user"));
            assertThrows(UnsupportedOperationException.class, () -> scopes.add("write"));
        }

        @Test
        @DisplayName("Should reject null name")
        void shouldRejectNullName() {
            var builder = RouteConfiguration.builder();
            assertThrows(NullPointerException.class, () -> builder.name(null));
        }

        @Test
        @DisplayName("Should reject null path")
        void shouldRejectNullPath() {
            var builder = RouteConfiguration.builder().name("health");
            assertThrows(NullPointerException.class, () -> builder.path(null));
        }

        @Test
        @DisplayName("Should reject blank path")
        void shouldRejectBlankPath() {
            var builder = RouteConfiguration.builder().name("health").path("  ");
            assertThrows(IllegalArgumentException.class, builder::build);
        }

        @Test
        @DisplayName("Should default authModes to BEARER")
        void shouldDefaultAuthModesToBEARER() {
            var route = RouteConfiguration.builder().name("health").path("/api/health").build();
            assertEquals(Set.of(AuthMode.BEARER), route.authModes());
        }

        @Test
        @DisplayName("Should set authModes explicitly")
        void shouldSetAuthModesExplicitly() {
            var route = RouteConfiguration.builder()
                    .name("health").path("/api/health")
                    .authModes(Set.of(AuthMode.LOCAL_ONLY, AuthMode.BEARER)).build();
            assertEquals(Set.of(AuthMode.LOCAL_ONLY, AuthMode.BEARER), route.authModes());
        }

        @Test
        @DisplayName("Should default maxRequestSize to 0")
        void shouldDefaultMaxRequestSizeToZero() {
            var route = RouteConfiguration.builder().name("health").path("/api/health").build();
            assertEquals(0, route.maxRequestSize());
        }

        @Test
        @DisplayName("Should set maxRequestSize explicitly")
        void shouldSetMaxRequestSizeExplicitly() {
            var route = RouteConfiguration.builder()
                    .name("data").path("/api/data")
                    .maxRequestSize(524288).build();
            assertEquals(524288, route.maxRequestSize());
        }
    }

    @Nested
    @DisplayName("Enabled Flag")
    class EnabledFlag {

        @Test
        @DisplayName("Should be enabled by default")
        void shouldBeEnabledByDefault() {
            var route = RouteConfiguration.builder().name("health").path("/api/health").build();
            assertTrue(route.enabled());
        }

        @Test
        @DisplayName("Should be disabled when set to false")
        void shouldBeDisabledWhenFalse() {
            var route = RouteConfiguration.builder()
                    .name("health").path("/api/health").enabled(false).build();
            assertFalse(route.enabled());
        }
    }

    @Nested
    @DisplayName("Schema Validation")
    class SchemaValidation {

        @Test
        @DisplayName("Should report has schema validation when schema path is set")
        void shouldReportHasSchemaValidation() {
            var route = RouteConfiguration.builder()
                    .name("users").path("/api/users")
                    .schemaPath("./conf/schemas/user-schema.json").build();
            assertTrue(route.hasSchemaValidation());
        }

        @Test
        @DisplayName("Should report no schema validation when null")
        void shouldReportNoSchemaValidationWhenNull() {
            var route = RouteConfiguration.builder()
                    .name("health").path("/api/health").build();
            assertFalse(route.hasSchemaValidation());
        }

        @Test
        @DisplayName("Should report no schema validation when blank")
        void shouldReportNoSchemaValidationWhenBlank() {
            var route = RouteConfiguration.builder()
                    .name("health").path("/api/health").schemaPath("  ").build();
            assertFalse(route.hasSchemaValidation());
        }
    }

    @Nested
    @DisplayName("SuccessOutcome")
    class SuccessOutcome {

        @Test
        @DisplayName("Should return successOutcome directly when set")
        void shouldReturnSuccessOutcomeDirectly() {
            var route = RouteConfiguration.builder()
                    .name("health-get").path("/api/health").successOutcome("health").build();
            assertEquals("health", route.successOutcome());
        }

        @Test
        @DisplayName("Should have null successOutcome when createFlowFile is false")
        void shouldHaveNullOutcomeWhenNoFlowFile() {
            var route = RouteConfiguration.builder()
                    .name("health").path("/api/health").createFlowFile(false).build();
            assertNull(route.successOutcome());
        }
    }

    @Nested
    @DisplayName("CreateFlowFile")
    class CreateFlowFile {

        @Test
        @DisplayName("Should be true by default")
        void shouldBeTrueByDefault() {
            var route = RouteConfiguration.builder()
                    .name("health").path("/api/health").build();
            assertTrue(route.createFlowFile());
        }

        @Test
        @DisplayName("Should be false when set to false")
        void shouldBeFalseWhenSetToFalse() {
            var route = RouteConfiguration.builder()
                    .name("health").path("/api/health").createFlowFile(false).build();
            assertFalse(route.createFlowFile());
        }
    }

    @Nested
    @DisplayName("Authorization")
    class Authorization {

        @Test
        @DisplayName("Should report has roles")
        void shouldReportHasRoles() {
            var route = RouteConfiguration.builder()
                    .name("users").path("/api/users").requiredRole("admin").build();
            assertTrue(route.hasAuthorizationRequirements());
        }

        @Test
        @DisplayName("Should report has scopes")
        void shouldReportHasScopes() {
            var route = RouteConfiguration.builder()
                    .name("users").path("/api/users").requiredScope("read").build();
            assertTrue(route.hasAuthorizationRequirements());
        }

        @Test
        @DisplayName("Should report no auth requirements")
        void shouldReportNoAuthRequirements() {
            var route = RouteConfiguration.builder()
                    .name("health").path("/api/health").build();
            assertFalse(route.hasAuthorizationRequirements());
        }

        @Test
        @DisplayName("Should convert to AuthorizationRequirements")
        void shouldConvertToAuthorizationRequirements() {
            var route = RouteConfiguration.builder()
                    .name("users").path("/api/users")
                    .requiredRole("admin").requiredRole("user").requiredScope("read")
                    .build();

            var authReqs = route.toAuthorizationRequirements();

            assertTrue(authReqs.requireValidToken());
            assertEquals(Set.of("admin", "user"), authReqs.requiredRoles());
            assertEquals(Set.of("read"), authReqs.requiredScopes());
            assertTrue(authReqs.hasAuthorizationRequirements());
        }
    }

    @Nested
    @DisplayName("TrackingMode")
    class TrackingModeTests {

        @Test
        @DisplayName("Should default trackingMode to NONE")
        void shouldDefaultTrackingModeToNone() {
            var route = RouteConfiguration.builder().name("health").path("/api/health").build();
            assertEquals(TrackingMode.NONE, route.trackingMode());
            assertFalse(route.isTracked());
        }

        @Test
        @DisplayName("Should report isTracked for SIMPLE")
        void shouldReportIsTrackedForSimple() {
            var route = RouteConfiguration.builder()
                    .name("data").path("/api/data")
                    .trackingMode(TrackingMode.SIMPLE).build();
            assertTrue(route.isTracked());
        }

        @Test
        @DisplayName("Should report isTracked for ATTACHMENTS")
        void shouldReportIsTrackedForAttachments() {
            var route = RouteConfiguration.builder()
                    .name("data").path("/api/data")
                    .trackingMode(TrackingMode.ATTACHMENTS)
                    .attachmentsMinCount(1).attachmentsMaxCount(5).build();
            assertTrue(route.isTracked());
        }

        @Test
        @DisplayName("Should reject bounds when mode is not ATTACHMENTS")
        void shouldRejectBoundsWhenNotAttachments() {
            var builder = RouteConfiguration.builder()
                    .name("data").path("/api/data")
                    .trackingMode(TrackingMode.SIMPLE)
                    .attachmentsMinCount(1);
            assertThrows(IllegalArgumentException.class, builder::build);
        }

        @Test
        @DisplayName("Should reject negative min count")
        void shouldRejectNegativeMinCount() {
            var builder = RouteConfiguration.builder()
                    .name("data").path("/api/data")
                    .trackingMode(TrackingMode.ATTACHMENTS)
                    .attachmentsMinCount(-1);
            assertThrows(IllegalArgumentException.class, builder::build);
        }

        @Test
        @DisplayName("Should reject min > max when both set")
        void shouldRejectMinExceedingMax() {
            var builder = RouteConfiguration.builder()
                    .name("data").path("/api/data")
                    .trackingMode(TrackingMode.ATTACHMENTS)
                    .attachmentsMinCount(5).attachmentsMaxCount(3);
            assertThrows(IllegalArgumentException.class, builder::build);
        }

        @Test
        @DisplayName("Should accept valid attachment bounds")
        void shouldAcceptValidBounds() {
            var route = RouteConfiguration.builder()
                    .name("data").path("/api/data")
                    .trackingMode(TrackingMode.ATTACHMENTS)
                    .attachmentsMinCount(1).attachmentsMaxCount(10).build();
            assertEquals(1, route.attachmentsMinCount());
            assertEquals(10, route.attachmentsMaxCount());
        }

        @Test
        @DisplayName("Should accept zero bounds for ATTACHMENTS mode")
        void shouldAcceptZeroBounds() {
            var route = RouteConfiguration.builder()
                    .name("data").path("/api/data")
                    .trackingMode(TrackingMode.ATTACHMENTS).build();
            assertEquals(0, route.attachmentsMinCount());
            assertEquals(0, route.attachmentsMaxCount());
        }

        @Test
        @DisplayName("Should accept attachments timeout with ATTACHMENTS mode")
        void shouldAcceptAttachmentsTimeout() {
            var route = RouteConfiguration.builder()
                    .name("data").path("/api/data")
                    .trackingMode(TrackingMode.ATTACHMENTS)
                    .attachmentsTimeout("30 sec").build();
            assertEquals("30 sec", route.attachmentsTimeout());
        }

        @Test
        @DisplayName("Should reject attachments timeout when mode is not ATTACHMENTS")
        void shouldRejectTimeoutWhenNotAttachments() {
            var builder = RouteConfiguration.builder()
                    .name("data").path("/api/data")
                    .trackingMode(TrackingMode.SIMPLE)
                    .attachmentsTimeout("30 sec");
            assertThrows(IllegalArgumentException.class, builder::build);
        }
    }
}
