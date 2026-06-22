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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("TokenMasking")
class TokenMaskingTest {

    @Nested
    @DisplayName("Null and Empty Input")
    class NullAndEmptyTests {

        @Test
        @DisplayName("Should return *** for null token")
        void shouldMaskNullToken() {
            String token = null;

            String result = TokenMasking.maskToken(token);

            assertEquals("***", result);
        }

        @Test
        @DisplayName("Should return *** for empty string")
        void shouldMaskEmptyToken() {
            String token = "";

            String result = TokenMasking.maskToken(token);

            assertEquals("***", result);
        }
    }

    @Nested
    @DisplayName("Short Tokens (<=12 characters)")
    class ShortTokenTests {

        @ParameterizedTest(name = "Should return *** for short token: \"{0}\"")
        @ValueSource(strings = {"a", "12345678", "123456789012"})
        void shouldMaskShortToken(String token) {
            assertEquals("***", TokenMasking.maskToken(token));
        }
    }

    @Nested
    @DisplayName("Long Tokens (>12 characters)")
    class LongTokenTests {

        @Test
        @DisplayName("Should mask 13 character token showing first 8 chars")
        void shouldMaskThirteenCharToken() {
            String token = "1234567890123";

            String result = TokenMasking.maskToken(token);

            assertEquals("12345678...[13 chars]", result);
        }

        @Test
        @DisplayName("Should mask 20 character token showing first 8 chars")
        void shouldMaskTwentyCharToken() {
            String token = "12345678901234567890";

            String result = TokenMasking.maskToken(token);

            assertEquals("12345678...[20 chars]", result);
        }

        @Test
        @DisplayName("Should mask realistic JWT token")
        void shouldMaskRealisticJwt() {
            String token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

            String result = TokenMasking.maskToken(token);

            assertTrue(result.startsWith("eyJhbGci..."),
                    "Should start with first 8 chars of JWT");
            assertTrue(result.contains("chars]"),
                    "Should contain char count");
        }

        @Test
        @DisplayName("Should mask very long token (1000+ chars)")
        void shouldMaskVeryLongToken() {
            String token = "A".repeat(1000);

            String result = TokenMasking.maskToken(token);

            assertEquals("AAAAAAAA...[1000 chars]", result);
        }
    }
}
