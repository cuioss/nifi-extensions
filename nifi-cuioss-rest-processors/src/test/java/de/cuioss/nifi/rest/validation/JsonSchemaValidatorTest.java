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
package de.cuioss.nifi.rest.validation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("JsonSchemaValidator")
class JsonSchemaValidatorTest {

    private static final String USER_SCHEMA = """
            {
              "$schema": "https://json-schema.org/draft/2020-12/schema",
              "type": "object",
              "required": ["name"],
              "properties": {
                "name": { "type": "string", "minLength": 1 },
                "age": { "type": "integer", "minimum": 0 }
              },
              "additionalProperties": false
            }
            """;

    @TempDir
    Path tempDir;

    private Path writeSchema(String content) throws IOException {
        Path schemaFile = tempDir.resolve("schema.json");
        Files.writeString(schemaFile, content, StandardCharsets.UTF_8);
        return schemaFile;
    }

    @Nested
    @DisplayName("Valid Body")
    class ValidBody {

        @Test
        @DisplayName("Should return empty list for valid object with all fields")
        void shouldReturnEmptyForValidObject() throws IOException {
            // Arrange
            Path schemaFile = writeSchema(USER_SCHEMA);
            var validator = new JsonSchemaValidator(Map.of("users", schemaFile.toString()));

            // Act
            List<SchemaViolation> violations = validator.validate("users",
                    """
                            {"name": "Alice", "age": 30}
                            """.getBytes(StandardCharsets.UTF_8));

            // Assert
            assertTrue(violations.isEmpty());
        }

        @Test
        @DisplayName("Should return empty list for valid object with required field only")
        void shouldReturnEmptyForRequiredFieldOnly() throws IOException {
            // Arrange
            Path schemaFile = writeSchema(USER_SCHEMA);
            var validator = new JsonSchemaValidator(Map.of("users", schemaFile.toString()));

            // Act
            List<SchemaViolation> violations = validator.validate("users",
                    """
                            {"name": "Bob"}
                            """.getBytes(StandardCharsets.UTF_8));

            // Assert
            assertTrue(violations.isEmpty());
        }

        @Test
        @DisplayName("Should return empty list for route without schema")
        void shouldReturnEmptyForRouteWithoutSchema() throws IOException {
            // Arrange
            Path schemaFile = writeSchema(USER_SCHEMA);
            var validator = new JsonSchemaValidator(Map.of("users", schemaFile.toString()));

            // Act — validate against a route that has no schema
            List<SchemaViolation> violations = validator.validate("health",
                    "anything".getBytes(StandardCharsets.UTF_8));

            // Assert
            assertTrue(violations.isEmpty());
        }
    }

    @Nested
    @DisplayName("Invalid Body")
    class InvalidBody {

        @Test
        @DisplayName("Should return violations for missing required field")
        void shouldReturnViolationsForMissingRequiredField() throws IOException {
            // Arrange
            Path schemaFile = writeSchema(USER_SCHEMA);
            var validator = new JsonSchemaValidator(Map.of("users", schemaFile.toString()));

            // Act
            List<SchemaViolation> violations = validator.validate("users",
                    """
                            {"age": 25}
                            """.getBytes(StandardCharsets.UTF_8));

            // Assert
            assertFalse(violations.isEmpty());
            assertTrue(violations.stream().anyMatch(v -> v.message().contains("name")),
                    "Expected violation mentioning 'name', got: " + violations);
        }

        @Test
        @DisplayName("Should return violations for wrong type")
        void shouldReturnViolationsForWrongType() throws IOException {
            // Arrange
            Path schemaFile = writeSchema(USER_SCHEMA);
            var validator = new JsonSchemaValidator(Map.of("users", schemaFile.toString()));

            // Act
            List<SchemaViolation> violations = validator.validate("users",
                    """
                            {"name": "Alice", "age": "not-a-number"}
                            """.getBytes(StandardCharsets.UTF_8));

            // Assert
            assertFalse(violations.isEmpty());
            assertTrue(violations.stream().anyMatch(v ->
                            v.message().toLowerCase().contains("integer")
                                    || v.message().toLowerCase().contains("type")),
                    "Expected type violation, got: " + violations);
        }

        @Test
        @DisplayName("Should return violations for additional properties")
        void shouldReturnViolationsForAdditionalProperties() throws IOException {
            // Arrange
            Path schemaFile = writeSchema(USER_SCHEMA);
            var validator = new JsonSchemaValidator(Map.of("users", schemaFile.toString()));

            // Act
            List<SchemaViolation> violations = validator.validate("users",
                    """
                            {"name": "Alice", "extra": true}
                            """.getBytes(StandardCharsets.UTF_8));

            // Assert
            assertFalse(violations.isEmpty());
        }

        @Test
        @DisplayName("Should return multiple violations")
        void shouldReturnMultipleViolations() throws IOException {
            // Arrange
            Path schemaFile = writeSchema(USER_SCHEMA);
            var validator = new JsonSchemaValidator(Map.of("users", schemaFile.toString()));

            // Act — missing required field + wrong type + additional property
            List<SchemaViolation> violations = validator.validate("users",
                    """
                            {"age": "not-a-number", "extra": true}
                            """.getBytes(StandardCharsets.UTF_8));

            // Assert
            assertTrue(violations.size() >= 2,
                    "Expected at least 2 violations, got: " + violations.size());
        }
    }

    @Nested
    @DisplayName("Malformed Input")
    class MalformedInput {

        @Test
        @DisplayName("Should return violation for unparseable JSON")
        void shouldReturnViolationForUnparseableJson() throws IOException {
            // Arrange
            Path schemaFile = writeSchema(USER_SCHEMA);
            var validator = new JsonSchemaValidator(Map.of("users", schemaFile.toString()));

            // Act
            List<SchemaViolation> violations = validator.validate("users",
                    "not-json{{{".getBytes(StandardCharsets.UTF_8));

            // Assert
            assertFalse(violations.isEmpty());
            assertTrue(violations.getFirst().message().startsWith("Invalid JSON"),
                    "Expected 'Invalid JSON' message, got: " + violations.getFirst().message());
        }
    }

    @Nested
    @DisplayName("Schema Loading")
    class SchemaLoading {

        @Test
        @DisplayName("Should throw for missing schema file")
        void shouldThrowForMissingSchemaFile() {
            Path nonExistent = tempDir.resolve("non-existent.json");

            assertThrows(IllegalStateException.class,
                    () -> new JsonSchemaValidator(Map.of("users", nonExistent.toString())));
        }

        @Test
        @DisplayName("Should handle empty route schemas map")
        void shouldHandleEmptyRouteSchemas() {
            var validator = new JsonSchemaValidator(Map.of());

            List<SchemaViolation> violations = validator.validate("users",
                    "{}".getBytes(StandardCharsets.UTF_8));

            assertTrue(violations.isEmpty());
        }

        @Test
        @DisplayName("Should support multiple route schemas")
        void shouldSupportMultipleRouteSchemas() throws IOException {
            // Arrange
            Path userSchema = writeSchema(USER_SCHEMA);
            Path orderSchema = tempDir.resolve("order-schema.json");
            Files.writeString(orderSchema, """
                    {
                      "$schema": "https://json-schema.org/draft/2020-12/schema",
                      "type": "object",
                      "required": ["item"],
                      "properties": {
                        "item": { "type": "string" }
                      }
                    }
                    """, StandardCharsets.UTF_8);

            var validator = new JsonSchemaValidator(Map.of(
                    "users", userSchema.toString(),
                    "orders", orderSchema.toString()));

            // Act & Assert — valid user, invalid order
            assertTrue(validator.validate("users",
                    """
                            {"name": "Alice"}
                            """.getBytes(StandardCharsets.UTF_8)).isEmpty());

            assertFalse(validator.validate("orders",
                    """
                            {"quantity": 5}
                            """.getBytes(StandardCharsets.UTF_8)).isEmpty());
        }

        @Test
        @DisplayName("Should report hasSchema correctly")
        void shouldReportHasSchemaCorrectly() throws IOException {
            // Arrange
            Path schemaFile = writeSchema(USER_SCHEMA);
            var validator = new JsonSchemaValidator(Map.of("users", schemaFile.toString()));

            // Assert
            assertTrue(validator.hasSchema("users"));
            assertFalse(validator.hasSchema("health"));
        }
    }

    @Nested
    @DisplayName("Inline Schema")
    class InlineSchema {

        @Test
        @DisplayName("Should validate successfully with inline JSON schema")
        void shouldValidateWithInlineSchema() {
            // Arrange
            var validator = new JsonSchemaValidator(Map.of("users", USER_SCHEMA));

            // Act
            List<SchemaViolation> violations = validator.validate("users",
                    """
                            {"name": "Alice", "age": 30}
                            """.getBytes(StandardCharsets.UTF_8));

            // Assert
            assertTrue(violations.isEmpty());
        }

        @Test
        @DisplayName("Should return violations for invalid body with inline schema")
        void shouldReturnViolationsForInvalidBodyWithInlineSchema() {
            // Arrange
            var validator = new JsonSchemaValidator(Map.of("users", USER_SCHEMA));

            // Act
            List<SchemaViolation> violations = validator.validate("users",
                    """
                            {"age": 25}
                            """.getBytes(StandardCharsets.UTF_8));

            // Assert
            assertFalse(violations.isEmpty());
            assertTrue(violations.stream().anyMatch(v -> v.message().contains("name")),
                    "Expected violation mentioning 'name', got: " + violations);
        }

        @Test
        @DisplayName("Should detect inline JSON with leading whitespace")
        void shouldDetectInlineJsonWithLeadingWhitespace() {
            // Arrange — leading spaces and newline before the JSON object
            var validator = new JsonSchemaValidator(Map.of("users", "  \n" + USER_SCHEMA));

            // Act
            List<SchemaViolation> violations = validator.validate("users",
                    """
                            {"name": "Bob"}
                            """.getBytes(StandardCharsets.UTF_8));

            // Assert
            assertTrue(violations.isEmpty());
        }
    }
}
