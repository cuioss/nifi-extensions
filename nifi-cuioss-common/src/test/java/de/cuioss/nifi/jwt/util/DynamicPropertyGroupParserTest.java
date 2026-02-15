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

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("DynamicPropertyGroupParser")
class DynamicPropertyGroupParserTest {

    @Nested
    @DisplayName("Parsing")
    class Parsing {

        @Test
        @DisplayName("Should parse properties with a single group")
        void shouldParsePropertiesWithSingleGroup() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");
            properties.put("restapi.health.methods", "GET");
            properties.put("restapi.health.schema", "health-schema");

            // Act
            Map<String, Map<String, String>> result = DynamicPropertyGroupParser.parse("restapi.", properties);

            // Assert
            assertEquals(1, result.size());
            assertTrue(result.containsKey("health"));
            assertEquals("/api/health", result.get("health").get("path"));
            assertEquals("GET", result.get("health").get("methods"));
            assertEquals("health-schema", result.get("health").get("schema"));
        }

        @Test
        @DisplayName("Should parse properties with multiple groups")
        void shouldParsePropertiesWithMultipleGroups() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");
            properties.put("restapi.health.methods", "GET");
            properties.put("restapi.users.path", "/api/users");
            properties.put("restapi.users.methods", "GET,POST");

            // Act
            Map<String, Map<String, String>> result = DynamicPropertyGroupParser.parse("restapi.", properties);

            // Assert
            assertEquals(2, result.size());
            assertEquals("/api/health", result.get("health").get("path"));
            assertEquals("GET", result.get("health").get("methods"));
            assertEquals("/api/users", result.get("users").get("path"));
            assertEquals("GET,POST", result.get("users").get("methods"));
        }

        @Test
        @DisplayName("Should ignore properties without matching prefix")
        void shouldIgnorePropertiesWithoutPrefix() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health.path", "/api/health");
            properties.put("other.setting", "value");
            properties.put("unrelated", "data");

            // Act
            Map<String, Map<String, String>> result = DynamicPropertyGroupParser.parse("restapi.", properties);

            // Assert
            assertEquals(1, result.size());
            assertTrue(result.containsKey("health"));
        }

        @Test
        @DisplayName("Should ignore properties without dot after group name")
        void shouldIgnorePropertiesWithoutDotAfterGroupName() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.health", "value-without-property");
            properties.put("restapi.health.path", "/api/health");

            // Act
            Map<String, Map<String, String>> result = DynamicPropertyGroupParser.parse("restapi.", properties);

            // Assert
            assertEquals(1, result.size());
            assertEquals(1, result.get("health").size());
            assertEquals("/api/health", result.get("health").get("path"));
        }

        @Test
        @DisplayName("Should return empty map for empty input")
        void shouldReturnEmptyMapForEmptyInput() {
            // Act
            Map<String, Map<String, String>> result = DynamicPropertyGroupParser.parse("restapi.", Map.of());

            // Assert
            assertTrue(result.isEmpty());
        }

        @Test
        @DisplayName("Should throw NullPointerException for null properties")
        void shouldThrowNpeForNullProperties() {
            assertThrows(NullPointerException.class,
                    () -> DynamicPropertyGroupParser.parse("restapi.", null));
        }

        @Test
        @DisplayName("Should throw NullPointerException for null prefix")
        void shouldThrowNpeForNullPrefix() {
            assertThrows(NullPointerException.class,
                    () -> DynamicPropertyGroupParser.parse(null, Map.of()));
        }

        @Test
        @DisplayName("Should handle dot in property name after group")
        void shouldHandleDotInPropertyName() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("restapi.users.some.nested.key", "nested-value");

            // Act
            Map<String, Map<String, String>> result = DynamicPropertyGroupParser.parse("restapi.", properties);

            // Assert
            assertEquals(1, result.size());
            assertEquals("nested-value", result.get("users").get("some.nested.key"));
        }
    }

    @Nested
    @DisplayName("Prefix Handling")
    class PrefixHandling {

        @Test
        @DisplayName("Should strip prefix correctly")
        void shouldStripPrefixCorrectly() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.myIssuer.name", "TestIssuer");
            properties.put("issuer.myIssuer.jwks-url", "https://example.com/jwks");

            // Act
            Map<String, Map<String, String>> result = DynamicPropertyGroupParser.parse("issuer.", properties);

            // Assert
            assertEquals(1, result.size());
            assertTrue(result.containsKey("myIssuer"));
            assertEquals("TestIssuer", result.get("myIssuer").get("name"));
            assertEquals("https://example.com/jwks", result.get("myIssuer").get("jwks-url"));
        }

        @Test
        @DisplayName("Should work with different prefixes")
        void shouldWorkWithDifferentPrefixes() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("custom.prefix.group1.key", "value1");
            properties.put("custom.prefix.group2.key", "value2");

            // Act
            Map<String, Map<String, String>> result = DynamicPropertyGroupParser.parse("custom.prefix.", properties);

            // Assert
            assertEquals(2, result.size());
            assertEquals("value1", result.get("group1").get("key"));
            assertEquals("value2", result.get("group2").get("key"));
        }
    }
}
