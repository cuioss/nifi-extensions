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

import de.cuioss.test.juli.LogAsserts;
import de.cuioss.test.juli.TestLogLevel;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("RouteConfigurationParser")
@EnableTestLogger
class RouteConfigurationParserTest {

    @Nested
    @DisplayName("Parsing")
    class Parsing {

        @Test
        @DisplayName("Should parse single route")
        void shouldParseSingleRoute() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");

            // Act
            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            // Assert
            assertEquals(1, routes.size());
            RouteConfiguration route = routes.getFirst();
            assertEquals("health", route.name());
            assertEquals("/api/health", route.path());
        }

        @Test
        @DisplayName("Should parse multiple routes")
        void shouldParseMultipleRoutes() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");
            properties.put("restapi.health.methods", "GET");
            properties.put("restapi.users.path", "/api/users");
            properties.put("restapi.users.methods", "GET,POST,PUT,DELETE");
            properties.put("restapi.orders.path", "/api/orders");

            // Act
            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            // Assert
            assertEquals(3, routes.size());
        }

        @Test
        @DisplayName("Should apply default methods when not specified")
        void shouldApplyDefaultMethods() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");

            // Act
            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            // Assert
            assertEquals(RouteConfiguration.DEFAULT_METHODS, routes.getFirst().methods());
        }

        @Test
        @DisplayName("Should parse custom methods")
        void shouldParseCustomMethods() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");
            properties.put("restapi.health.methods", "GET");

            // Act
            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            // Assert
            assertEquals(Set.of("GET"), routes.getFirst().methods());
        }

        @Test
        @DisplayName("Should parse roles and scopes")
        void shouldParseRolesAndScopes() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.users.path", "/api/users");
            properties.put("restapi.users.required-roles", "admin,user");
            properties.put("restapi.users.required-scopes", "read,write");

            // Act
            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            // Assert
            RouteConfiguration route = routes.getFirst();
            assertEquals(Set.of("admin", "user"), route.requiredRoles());
            assertEquals(Set.of("read", "write"), route.requiredScopes());
        }

        @Test
        @DisplayName("Should default enabled to true when absent")
        void shouldDefaultEnabledToTrue() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");

            // Act
            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            // Assert
            assertTrue(routes.getFirst().enabled());
        }

        @Test
        @DisplayName("Should parse enabled=false")
        void shouldParseEnabledFalse() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");
            properties.put("restapi.health.enabled", "false");

            // Act
            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            // Assert
            assertFalse(routes.getFirst().enabled());
        }

        @Test
        @DisplayName("Should parse enabled=true explicitly")
        void shouldParseEnabledTrue() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");
            properties.put("restapi.health.enabled", "true");

            // Act
            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            // Assert
            assertTrue(routes.getFirst().enabled());
        }

        @Test
        @DisplayName("Should handle schema property as file path")
        void shouldHandleSchemaProperty() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.users.path", "/api/users");
            properties.put("restapi.users.schema", "./conf/schemas/user-schema.json");

            // Act
            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            // Assert
            assertEquals("./conf/schemas/user-schema.json", routes.getFirst().schemaPath());
        }
    }

    @Nested
    @DisplayName("SuccessOutcome and CreateFlowFile")
    class SuccessOutcomeAndCreateFlowFile {

        @Test
        @DisplayName("Should parse success-outcome property")
        void shouldParseSuccessOutcome() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health-get.path", "/api/health");
            properties.put("restapi.health-get.success-outcome", "health");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertEquals(1, routes.size());
            assertEquals("health", routes.getFirst().successOutcome());
        }

        @Test
        @DisplayName("Should default success-outcome to route name when absent")
        void shouldDefaultSuccessOutcomeToRouteName() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertEquals("health", routes.getFirst().successOutcome());
        }

        @Test
        @DisplayName("Should have null success-outcome when create-flowfile is false")
        void shouldHaveNullOutcomeWhenCreateFlowFileFalse() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");
            properties.put("restapi.health.create-flowfile", "false");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertNull(routes.getFirst().successOutcome());
        }

        @Test
        @DisplayName("Should parse create-flowfile=false")
        void shouldParseCreateFlowFileFalse() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");
            properties.put("restapi.health.create-flowfile", "false");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertFalse(routes.getFirst().createFlowFile());
        }

        @Test
        @DisplayName("Should default create-flowfile to true when absent")
        void shouldDefaultCreateFlowFileToTrue() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertTrue(routes.getFirst().createFlowFile());
        }

        @Test
        @DisplayName("Should parse create-flowfile=FALSE case-insensitive")
        void shouldParseCreateFlowFileCaseInsensitive() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");
            properties.put("restapi.health.create-flowfile", "FALSE");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertFalse(routes.getFirst().createFlowFile());
        }
    }

    @Nested
    @DisplayName("AuthMode and MaxRequestSize")
    class AuthModeAndMaxRequestSize {

        @Test
        @DisplayName("Should parse auth-mode property")
        void shouldParseAuthMode() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");
            properties.put("restapi.health.auth-mode", "none");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertEquals(1, routes.size());
            assertEquals(Set.of(AuthMode.NONE), routes.getFirst().authModes());
        }

        @Test
        @DisplayName("Should parse auth-mode=local-only")
        void shouldParseAuthModeLocalOnly() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");
            properties.put("restapi.health.auth-mode", "local-only");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertEquals(Set.of(AuthMode.LOCAL_ONLY), routes.getFirst().authModes());
        }

        @Test
        @DisplayName("Should default auth-mode to BEARER when absent")
        void shouldDefaultAuthModesToBEARER() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertEquals(Set.of(AuthMode.BEARER), routes.getFirst().authModes());
        }

        @Test
        @DisplayName("Should parse comma-separated auth-mode values")
        void shouldParseCommaSeparatedAuthModes() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");
            properties.put("restapi.health.auth-mode", "local-only,bearer");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertEquals(Set.of(AuthMode.LOCAL_ONLY, AuthMode.BEARER), routes.getFirst().authModes());
        }

        @Test
        @DisplayName("Should parse max-request-size property")
        void shouldParseMaxRequestSize() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.data.path", "/api/data");
            properties.put("restapi.data.max-request-size", "524288");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertEquals(1, routes.size());
            assertEquals(524288, routes.getFirst().maxRequestSize());
        }

        @Test
        @DisplayName("Should default max-request-size to 0 when absent")
        void shouldDefaultMaxRequestSizeToZero() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.data.path", "/api/data");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertEquals(0, routes.getFirst().maxRequestSize());
        }

        @Test
        @DisplayName("Should ignore non-numeric max-request-size")
        void shouldIgnoreNonNumericMaxRequestSize() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.data.path", "/api/data");
            properties.put("restapi.data.max-request-size", "invalid");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertEquals(0, routes.getFirst().maxRequestSize());
        }
    }

    @Nested
    @DisplayName("Validation")
    class Validation {

        @Test
        @DisplayName("Should reject route without path")
        void shouldRejectRouteWithoutPath() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.methods", "GET");

            // Act
            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            // Assert
            assertTrue(routes.isEmpty());
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "no path");
        }

        @Test
        @DisplayName("Should accept route with path only")
        void shouldAcceptRouteWithPathOnly() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");

            // Act
            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            // Assert
            assertEquals(1, routes.size());
        }

        @Test
        @DisplayName("Should log warning for invalid route")
        void shouldLogWarningForInvalidRoute() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.methods", "GET"); // no path

            // Act
            RouteConfigurationParser.parse(properties);

            // Assert
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "health");
        }
    }

    @Nested
    @DisplayName("Edge Cases")
    class EdgeCases {

        @Test
        @DisplayName("Should return empty list for no route properties")
        void shouldReturnEmptyListForNoRouteProperties() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("some.other.property", "value");

            // Act
            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            // Assert
            assertTrue(routes.isEmpty());
        }

        @Test
        @DisplayName("Should handle empty values")
        void shouldHandleEmptyValues() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "  ");

            // Act
            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            // Assert
            assertTrue(routes.isEmpty());
        }

        @Test
        @DisplayName("Should return unmodifiable list")
        void shouldReturnUnmodifiableList() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");

            // Act
            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            // Assert
            assertThrows(UnsupportedOperationException.class,
                    () -> routes.add(RouteConfiguration.builder().name("x").path("/x").build()));
        }
    }

    @Nested
    @DisplayName("TrackingMode and Attachments")
    class TrackingModeAndAttachments {

        @Test
        @DisplayName("Should parse tracking-mode=simple")
        void shouldParseTrackingModeSimple() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.data.path", "/api/data");
            properties.put("restapi.data.tracking-mode", "simple");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertEquals(TrackingMode.SIMPLE, routes.getFirst().trackingMode());
        }

        @Test
        @DisplayName("Should parse tracking-mode=attachments with bounds")
        void shouldParseTrackingModeAttachments() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.upload.path", "/api/upload");
            properties.put("restapi.upload.tracking-mode", "attachments");
            properties.put("restapi.upload.attachments-min-count", "1");
            properties.put("restapi.upload.attachments-max-count", "5");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertEquals(TrackingMode.ATTACHMENTS, routes.getFirst().trackingMode());
            assertEquals(1, routes.getFirst().attachmentsMinCount());
            assertEquals(5, routes.getFirst().attachmentsMaxCount());
        }

        @Test
        @DisplayName("Should default tracking-mode to NONE when absent")
        void shouldDefaultTrackingModeToNone() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.data.path", "/api/data");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertEquals(TrackingMode.NONE, routes.getFirst().trackingMode());
        }

        @Test
        @DisplayName("Should default tracking-mode to NONE for invalid value")
        void shouldDefaultForInvalidValue() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.data.path", "/api/data");
            properties.put("restapi.data.tracking-mode", "invalid");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertEquals(TrackingMode.NONE, routes.getFirst().trackingMode());
        }

        @Test
        @DisplayName("Should parse tracking-mode case-insensitively")
        void shouldParseCaseInsensitive() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.data.path", "/api/data");
            properties.put("restapi.data.tracking-mode", "Simple");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertEquals(TrackingMode.SIMPLE, routes.getFirst().trackingMode());
        }

        @Test
        @DisplayName("Should parse attachments-timeout")
        void shouldParseAttachmentsTimeout() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.upload.path", "/api/upload");
            properties.put("restapi.upload.tracking-mode", "attachments");
            properties.put("restapi.upload.attachments-timeout", "1 min");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertEquals("1 min", routes.getFirst().attachmentsTimeout());
        }

        @Test
        @DisplayName("Should default attachments-timeout to 30 sec")
        void shouldDefaultAttachmentsTimeout() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.upload.path", "/api/upload");
            properties.put("restapi.upload.tracking-mode", "attachments");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertEquals("30 sec", routes.getFirst().attachmentsTimeout());
        }

        @Test
        @DisplayName("Should not set attachments-timeout for non-ATTACHMENTS mode")
        void shouldNotSetTimeoutForNonAttachments() {
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.data.path", "/api/data");
            properties.put("restapi.data.tracking-mode", "simple");

            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            assertNull(routes.getFirst().attachmentsTimeout());
        }
    }
}
