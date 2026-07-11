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

import de.cuioss.sheriff.token.validation.domain.token.AccessTokenContent;
import de.cuioss.sheriff.token.validation.test.generator.TestTokenGenerators;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
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
            var token = TestTokenGenerators.accessTokens().next().asAccessTokenContent();
            byte[] body = "request body".getBytes(StandardCharsets.UTF_8);

            var container = new HttpRequestContainer(
                    "users", "POST", "/api/users",
                    Map.of("page", "1"), Map.of("Authorization", "Bearer token"),
                    "127.0.0.1", body, "application/json", token, null, null, Map.of("id", "42"));

            assertEquals("users", container.routeName());
            assertEquals("POST", container.method());
            assertEquals("/api/users", container.requestUri());
            assertEquals("1", container.queryParameters().get("page"));
            assertEquals("Bearer token", container.headers().get("Authorization"));
            assertEquals("127.0.0.1", container.remoteHost());
            assertArrayEquals(body, container.body());
            assertEquals("application/json", container.contentType());
            assertNotNull(container.token());
            assertEquals("42", container.pathParameters().get("id"));
        }

        @Test
        @DisplayName("Should have empty body for GET requests")
        void shouldHaveEmptyBodyForGetRequests() {
            var token = TestTokenGenerators.accessTokens().next().asAccessTokenContent();

            var container = new HttpRequestContainer(
                    "health", "GET", "/api/health",
                    Map.of(), Map.of(), "127.0.0.1", new byte[0], null, token, null, null, Map.of());

            assertEquals(0, container.body().length);
        }

        @Test
        @DisplayName("Should have immutable maps")
        void shouldHaveImmutableMaps() {
            var token = TestTokenGenerators.accessTokens().next().asAccessTokenContent();
            var container = new HttpRequestContainer(
                    "health", "GET", "/api/health",
                    Map.of("key", "value"), Map.of("Header", "value"),
                    "127.0.0.1", null, null, token, null, null, Map.of("id", "1"));

            var queryParams = container.queryParameters();
            var headers = container.headers();
            var pathParams = container.pathParameters();
            assertThrows(UnsupportedOperationException.class,
                    () -> queryParams.put("new", "entry"));
            assertThrows(UnsupportedOperationException.class,
                    () -> headers.put("New-Header", "value"));
            assertThrows(UnsupportedOperationException.class,
                    () -> pathParams.put("new", "entry"));
        }

        @Test
        @DisplayName("Should store token reference")
        void shouldStoreTokenReference() {
            var token = TestTokenGenerators.accessTokens().next().asAccessTokenContent();

            var container = new HttpRequestContainer(
                    "health", "GET", "/api/health",
                    Map.of(), Map.of(), "127.0.0.1", null, null, token, null, null, Map.of());

            assertSame(token, container.token());
        }

        @Test
        @DisplayName("Should handle null body gracefully")
        void shouldHandleNullBody() {
            var token = TestTokenGenerators.accessTokens().next().asAccessTokenContent();

            var container = new HttpRequestContainer(
                    "health", "GET", "/api/health",
                    null, null, "127.0.0.1", null, null, token, null, null, null);

            assertEquals(0, container.body().length);
            assertTrue(container.queryParameters().isEmpty());
            assertTrue(container.headers().isEmpty());
        }
    }

    @Nested
    @DisplayName("Path Parameters")
    class PathParameters {

        @Test
        @DisplayName("Should default to empty map when null")
        void shouldDefaultToEmptyMapWhenNull() {
            var token = TestTokenGenerators.accessTokens().next().asAccessTokenContent();

            var container = new HttpRequestContainer(
                    "users", "GET", "/api/users/42",
                    Map.of(), Map.of(), "127.0.0.1", null, null, token, null, null, null);

            assertNotNull(container.pathParameters(), "Path parameters should never be null");
            assertTrue(container.pathParameters().isEmpty(), "Path parameters should default to empty");
        }

        @Test
        @DisplayName("Should carry path parameters from a pattern-matched route")
        void shouldCarryPathParameters() {
            var token = TestTokenGenerators.accessTokens().next().asAccessTokenContent();

            var container = new HttpRequestContainer(
                    "users", "GET", "/api/users/42/orders/7",
                    Map.of(), Map.of(), "127.0.0.1", null, null, token, null, null,
                    Map.of("userId", "42", "orderId", "7"));

            assertAll("Path parameters",
                    () -> assertEquals("42", container.pathParameters().get("userId"), "userId should match"),
                    () -> assertEquals("7", container.pathParameters().get("orderId"), "orderId should match"),
                    () -> assertEquals(2, container.pathParameters().size(), "Both parameters should be present"));
        }

        @Test
        @DisplayName("Should defensively copy the supplied path parameters")
        void shouldDefensivelyCopyPathParameters() {
            var token = TestTokenGenerators.accessTokens().next().asAccessTokenContent();
            var mutable = new HashMap<String, String>();
            mutable.put("id", "1");

            var container = new HttpRequestContainer(
                    "users", "GET", "/api/users/1",
                    Map.of(), Map.of(), "127.0.0.1", null, null, token, null, null, mutable);
            mutable.put("id", "mutated");

            assertEquals("1", container.pathParameters().get("id"), "Container should hold an independent copy");
        }
    }

    @Nested
    @DisplayName("Equality, hashCode and toString")
    class EqualityContract {

        // Mutable baseline fields; each inequality test flips exactly one before rebuilding,
        // so the corresponding short-circuit branch in the hand-written equals() is exercised.
        private String routeName = "users";
        private String method = "POST";
        private String requestUri = "/api/users";
        private String remoteHost = "127.0.0.1";
        private String contentType = "application/json";
        private String traceId = "trace-1";
        private String parentTraceId = "parent-1";
        private Map<String, String> queryParameters = Map.of("page", "1");
        private Map<String, String> headers = Map.of("H", "v");
        private Map<String, String> pathParameters = Map.of("id", "42");
        private byte[] body = "body".getBytes(StandardCharsets.UTF_8);
        private AccessTokenContent token =
                TestTokenGenerators.accessTokens().next().asAccessTokenContent();

        private HttpRequestContainer build() {
            return new HttpRequestContainer(routeName, method, requestUri, queryParameters, headers,
                    remoteHost, body, contentType, token, traceId, parentTraceId, pathParameters);
        }

        @Test
        @DisplayName("Equal containers are equal, share a hashCode, and equal themselves")
        void equalContainers() {
            var a = build();
            var b = build();
            assertEquals(a, b);
            assertEquals(a.hashCode(), b.hashCode());
            assertEquals(a, a);
        }

        @Test
        @DisplayName("Not equal to null or a foreign type")
        void notEqualToForeign() {
            var a = build();
            assertNotEquals(a, null);
            assertNotEquals("not a container", a);
        }

        @Test
        @DisplayName("toString exposes key identifying fields")
        void toStringExposesFields() {
            String s = build().toString();
            assertTrue(s.contains("users"), "route name");
            assertTrue(s.contains("POST"), "method");
            assertTrue(s.contains("/api/users"), "request URI");
        }

        @Test
        @DisplayName("Differs by each field independently")
        void differsByEachField() {
            var base = build();
            routeName = "other";
            assertNotEquals(base, build());
            routeName = "users";

            method = "GET";
            assertNotEquals(base, build());
            method = "POST";

            requestUri = "/other";
            assertNotEquals(base, build());
            requestUri = "/api/users";

            queryParameters = Map.of("page", "2");
            assertNotEquals(base, build());
            queryParameters = Map.of("page", "1");

            headers = Map.of("H", "w");
            assertNotEquals(base, build());
            headers = Map.of("H", "v");

            remoteHost = "10.0.0.1";
            assertNotEquals(base, build());
            remoteHost = "127.0.0.1";

            body = "different".getBytes(StandardCharsets.UTF_8);
            assertNotEquals(base, build());
            body = "body".getBytes(StandardCharsets.UTF_8);

            contentType = null;
            assertNotEquals(base, build());
            contentType = "application/json";

            token = null;
            assertNotEquals(base, build());
            token = base.token();

            traceId = null;
            assertNotEquals(base, build());
            traceId = "trace-1";

            parentTraceId = null;
            assertNotEquals(base, build());
            parentTraceId = "parent-1";

            pathParameters = Map.of("id", "99");
            assertNotEquals(base, build());
            pathParameters = Map.of("id", "42");
        }
    }
}
