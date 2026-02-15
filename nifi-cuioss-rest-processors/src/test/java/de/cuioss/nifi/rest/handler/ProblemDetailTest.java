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
package de.cuioss.nifi.rest.handler;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("ProblemDetail")
class ProblemDetailTest {

    @Nested
    @DisplayName("JSON Serialization")
    class JsonSerialization {

        @Test
        @DisplayName("Should serialize minimal problem detail")
        void shouldSerializeMinimalProblemDetail() {
            // Act
            var problem = ProblemDetail.builder()
                    .title("Not Found")
                    .status(404)
                    .build();
            String json = problem.toJson();

            // Assert
            assertTrue(json.contains("\"title\":\"Not Found\""));
            assertTrue(json.contains("\"status\":404"));
        }

        @Test
        @DisplayName("Should serialize with detail field")
        void shouldSerializeWithDetail() {
            // Act
            var problem = ProblemDetail.builder()
                    .type("about:blank")
                    .title("Unauthorized")
                    .status(401)
                    .detail("Token has expired")
                    .build();
            String json = problem.toJson();

            // Assert
            assertTrue(json.contains("\"type\":\"about:blank\""));
            assertTrue(json.contains("\"detail\":\"Token has expired\""));
        }

        @Test
        @DisplayName("Should serialize with extensions")
        void shouldSerializeWithExtensions() {
            // Act
            var problem = ProblemDetail.builder()
                    .title("Forbidden")
                    .status(403)
                    .extension("required_roles", "admin,user")
                    .build();
            String json = problem.toJson();

            // Assert
            assertTrue(json.contains("\"required_roles\":\"admin,user\""));
        }

        @Test
        @DisplayName("Should serialize numeric extension values without quotes")
        void shouldSerializeNumericExtensionValues() {
            // Act
            var problem = ProblemDetail.builder()
                    .title("Payload Too Large")
                    .status(413)
                    .extension("max_bytes", 1048576)
                    .build();
            String json = problem.toJson();

            // Assert
            assertTrue(json.contains("\"max_bytes\":1048576"));
            assertFalse(json.contains("\"max_bytes\":\"1048576\""));
        }

        @Test
        @DisplayName("Should escape special characters in JSON")
        void shouldEscapeSpecialCharactersInJson() {
            // Act
            var problem = ProblemDetail.builder()
                    .title("Error")
                    .status(400)
                    .detail("Invalid \"token\" with\\backslash")
                    .build();
            String json = problem.toJson();

            // Assert
            assertTrue(json.contains("\\\"token\\\""));
            assertTrue(json.contains("with\\\\backslash"));
        }

        @Test
        @DisplayName("Should escape all JSON control characters")
        void shouldEscapeAllJsonControlCharacters() {
            // Arrange — includes backspace, form feed, and other control chars
            String input = "a\bb\fc\u0001d";

            // Act
            String escaped = ProblemDetail.escapeJson(input);

            // Assert
            assertEquals("a\\bb\\fc\\u0001d", escaped);
        }

        @Test
        @DisplayName("Should produce valid RFC 9457 content type")
        void shouldProduceValidRfc9457ContentType() {
            assertEquals("application/problem+json", ProblemDetail.CONTENT_TYPE);
        }
    }

    @Nested
    @DisplayName("Factory Methods")
    class FactoryMethods {

        @Test
        @DisplayName("Should build 401 Unauthorized")
        void shouldBuild401Unauthorized() {
            var problem = ProblemDetail.unauthorized("Missing Bearer token");
            assertEquals(401, problem.status());
            assertEquals("Unauthorized", problem.title());
            assertEquals("Missing Bearer token", problem.detail());
        }

        @Test
        @DisplayName("Should build 403 Forbidden")
        void shouldBuild403Forbidden() {
            var problem = ProblemDetail.forbidden("Insufficient roles");
            assertEquals(403, problem.status());
            assertEquals("Forbidden", problem.title());
        }

        @Test
        @DisplayName("Should build 404 Not Found")
        void shouldBuild404NotFound() {
            var problem = ProblemDetail.notFound("Route not found: /unknown");
            assertEquals(404, problem.status());
            assertEquals("Not Found", problem.title());
        }

        @Test
        @DisplayName("Should build 405 Method Not Allowed")
        void shouldBuild405MethodNotAllowed() {
            var problem = ProblemDetail.methodNotAllowed("POST not allowed on /api/health");
            assertEquals(405, problem.status());
            assertEquals("Method Not Allowed", problem.title());
        }

        @Test
        @DisplayName("Should build 422 Validation Error")
        void shouldBuild422ValidationError() {
            var problem = ProblemDetail.validationError("Schema validation failed");
            assertEquals(422, problem.status());
            assertEquals("Unprocessable Content", problem.title());
        }

        @Test
        @DisplayName("Should build 413 Payload Too Large")
        void shouldBuild413PayloadTooLarge() {
            var problem = ProblemDetail.payloadTooLarge("Body exceeds 1MB limit");
            assertEquals(413, problem.status());
            assertEquals("Payload Too Large", problem.title());
        }

        @Test
        @DisplayName("Should build 503 Service Unavailable")
        void shouldBuild503ServiceUnavailable() {
            var problem = ProblemDetail.serviceUnavailable("Request queue full");
            assertEquals(503, problem.status());
            assertEquals("Service Unavailable", problem.title());
        }
    }
}
