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

import de.cuioss.sheriff.oauth.core.test.generator.TestTokenGenerators;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("HttpRequestContainer")
class HttpRequestContainerTest {

    @Nested
    @DisplayName("Record Contract")
    class RecordContract {

        @Test
        @DisplayName("Should create with all fields")
        void shouldCreateWithAllFields() {
            // Arrange
            var token = TestTokenGenerators.accessTokens().next().asAccessTokenContent();
            byte[] body = "request body".getBytes(StandardCharsets.UTF_8);

            // Act
            var container = new HttpRequestContainer(
                    "users", "POST", "/api/users",
                    Map.of("page", "1"), Map.of("Authorization", "Bearer token"),
                    "127.0.0.1", body, "application/json", token);

            // Assert
            assertEquals("users", container.routeName());
            assertEquals("POST", container.method());
            assertEquals("/api/users", container.requestUri());
            assertEquals("1", container.queryParameters().get("page"));
            assertEquals("Bearer token", container.headers().get("Authorization"));
            assertEquals("127.0.0.1", container.remoteHost());
            assertArrayEquals(body, container.body());
            assertEquals("application/json", container.contentType());
            assertNotNull(container.token());
        }

        @Test
        @DisplayName("Should have empty body for GET requests")
        void shouldHaveEmptyBodyForGetRequests() {
            // Arrange
            var token = TestTokenGenerators.accessTokens().next().asAccessTokenContent();

            // Act
            var container = new HttpRequestContainer(
                    "health", "GET", "/api/health",
                    Map.of(), Map.of(), "127.0.0.1", new byte[0], null, token);

            // Assert
            assertEquals(0, container.body().length);
        }

        @Test
        @DisplayName("Should have immutable maps")
        void shouldHaveImmutableMaps() {
            // Arrange
            var token = TestTokenGenerators.accessTokens().next().asAccessTokenContent();
            var container = new HttpRequestContainer(
                    "health", "GET", "/api/health",
                    Map.of("key", "value"), Map.of("Header", "value"),
                    "127.0.0.1", null, null, token);

            // Assert
            assertThrows(UnsupportedOperationException.class,
                    () -> container.queryParameters().put("new", "entry"));
            assertThrows(UnsupportedOperationException.class,
                    () -> container.headers().put("New-Header", "value"));
        }

        @Test
        @DisplayName("Should store token reference")
        void shouldStoreTokenReference() {
            // Arrange
            var token = TestTokenGenerators.accessTokens().next().asAccessTokenContent();

            // Act
            var container = new HttpRequestContainer(
                    "health", "GET", "/api/health",
                    Map.of(), Map.of(), "127.0.0.1", null, null, token);

            // Assert
            assertSame(token, container.token());
        }

        @Test
        @DisplayName("Should handle null body gracefully")
        void shouldHandleNullBody() {
            // Arrange
            var token = TestTokenGenerators.accessTokens().next().asAccessTokenContent();

            // Act
            var container = new HttpRequestContainer(
                    "health", "GET", "/api/health",
                    null, null, "127.0.0.1", null, null, token);

            // Assert
            assertEquals(0, container.body().length);
            assertTrue(container.queryParameters().isEmpty());
            assertTrue(container.headers().isEmpty());
        }
    }
}
