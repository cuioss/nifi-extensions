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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("AuthMode")
class AuthModeTest {

    @Nested
    @DisplayName("fromValue")
    class FromValue {

        @Test
        @DisplayName("Should parse 'bearer' to BEARER")
        void shouldParseBearer() {
            assertEquals(AuthMode.BEARER, AuthMode.fromValue("bearer"));
        }

        @Test
        @DisplayName("Should parse 'none' to NONE")
        void shouldParseNone() {
            assertEquals(AuthMode.NONE, AuthMode.fromValue("none"));
        }

        @Test
        @DisplayName("Should parse 'local-only' to LOCAL_ONLY")
        void shouldParseLocalOnly() {
            assertEquals(AuthMode.LOCAL_ONLY, AuthMode.fromValue("local-only"));
        }

        @Test
        @DisplayName("Should be case-insensitive")
        void shouldBeCaseInsensitive() {
            assertEquals(AuthMode.BEARER, AuthMode.fromValue("BEARER"));
            assertEquals(AuthMode.NONE, AuthMode.fromValue("NONE"));
            assertEquals(AuthMode.LOCAL_ONLY, AuthMode.fromValue("LOCAL-ONLY"));
            assertEquals(AuthMode.BEARER, AuthMode.fromValue("Bearer"));
            assertEquals(AuthMode.LOCAL_ONLY, AuthMode.fromValue("Local-Only"));
        }

        @ParameterizedTest
        @NullAndEmptySource
        @ValueSource(strings = {"  ", "unknown", "jwt", "token"})
        @DisplayName("Should default to BEARER for null, blank, or unknown values")
        void shouldDefaultToBearerForUnknown(String value) {
            assertEquals(AuthMode.BEARER, AuthMode.fromValue(value));
        }
    }

    @Nested
    @DisplayName("fromValues")
    class FromValues {

        @Test
        @DisplayName("Should parse single 'bearer' to Set of BEARER")
        void shouldParseSingleBearer() {
            assertEquals(Set.of(AuthMode.BEARER), AuthMode.fromValues("bearer"));
        }

        @Test
        @DisplayName("Should parse 'local-only,bearer' to combined set")
        void shouldParseLocalOnlyAndBearer() {
            Set<AuthMode> result = AuthMode.fromValues("local-only,bearer");
            assertEquals(Set.of(AuthMode.LOCAL_ONLY, AuthMode.BEARER), result);
        }

        @Test
        @DisplayName("Should parse single 'none' to Set of NONE")
        void shouldParseSingleNone() {
            assertEquals(Set.of(AuthMode.NONE), AuthMode.fromValues("none"));
        }

        @Test
        @DisplayName("Should parse single 'local-only' to Set of LOCAL_ONLY")
        void shouldParseSingleLocalOnly() {
            assertEquals(Set.of(AuthMode.LOCAL_ONLY), AuthMode.fromValues("local-only"));
        }

        @Test
        @DisplayName("Should handle whitespace around values")
        void shouldHandleWhitespace() {
            assertEquals(Set.of(AuthMode.LOCAL_ONLY, AuthMode.BEARER),
                    AuthMode.fromValues(" local-only , bearer "));
        }

        @ParameterizedTest
        @NullAndEmptySource
        @ValueSource(strings = {"  ", ",,,"})
        @DisplayName("Should throw for null, blank, or empty-after-split values")
        void shouldThrowForNullOrBlank(String value) {
            var ex = assertThrows(IllegalArgumentException.class, () -> AuthMode.fromValues(value));
            assertTrue(ex.getMessage().contains("Must provide at least one auth mode"));
        }
    }

    @Nested
    @DisplayName("toValue")
    class ToValue {

        @Test
        @DisplayName("Should serialize single mode")
        void shouldSerializeSingle() {
            assertEquals("bearer", AuthMode.toValue(Set.of(AuthMode.BEARER)));
        }

        @Test
        @DisplayName("Should serialize multiple modes sorted alphabetically")
        void shouldSerializeMultipleSorted() {
            assertEquals("bearer,local-only", AuthMode.toValue(Set.of(AuthMode.LOCAL_ONLY, AuthMode.BEARER)));
        }

        @Test
        @DisplayName("Should serialize NONE")
        void shouldSerializeNone() {
            assertEquals("none", AuthMode.toValue(Set.of(AuthMode.NONE)));
        }
    }

    @Nested
    @DisplayName("value")
    class Value {

        @Test
        @DisplayName("Should return lowercase value")
        void shouldReturnLowercaseValue() {
            assertEquals("bearer", AuthMode.BEARER.getValue());
            assertEquals("none", AuthMode.NONE.getValue());
            assertEquals("local-only", AuthMode.LOCAL_ONLY.getValue());
        }
    }
}
