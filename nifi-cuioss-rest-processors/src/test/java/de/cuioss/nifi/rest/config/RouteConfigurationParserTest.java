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
            assertEquals(Set.of("ADMIN", "USER"), route.requiredRoles());
            assertEquals(Set.of("READ", "WRITE"), route.requiredScopes());
        }

        @Test
        @DisplayName("Should handle schema property")
        void shouldHandleSchemaProperty() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.users.path", "/api/users");
            properties.put("restapi.users.schema", "user-schema");

            // Act
            List<RouteConfiguration> routes = RouteConfigurationParser.parse(properties);

            // Assert
            assertEquals("user-schema", routes.getFirst().schemaName());
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
                    () -> routes.add(new RouteConfiguration("x", "/x", null, null, null, null)));
        }
    }
}
