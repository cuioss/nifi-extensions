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

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("TokenMasking")
class TokenMaskingTest {

    @Nested
    @DisplayName("Null and Empty Input")
    class NullAndEmptyTests {

        @Test
        @DisplayName("Should return *** for null token")
        void shouldMaskNullToken() {
            // Arrange
            String token = null;

            // Act
            String result = TokenMasking.maskToken(token);

            // Assert
            assertEquals("***", result);
        }

        @Test
        @DisplayName("Should return *** for empty string")
        void shouldMaskEmptyToken() {
            // Arrange
            String token = "";

            // Act
            String result = TokenMasking.maskToken(token);

            // Assert
            assertEquals("***", result);
        }
    }

    @Nested
    @DisplayName("Short Tokens (<=12 characters)")
    class ShortTokenTests {

        @Test
        @DisplayName("Should return *** for single character token")
        void shouldMaskSingleCharToken() {
            // Arrange
            String token = "a";

            // Act
            String result = TokenMasking.maskToken(token);

            // Assert
            assertEquals("***", result);
        }

        @Test
        @DisplayName("Should return *** for 8 character token")
        void shouldMaskEightCharToken() {
            // Arrange
            String token = "12345678";

            // Act
            String result = TokenMasking.maskToken(token);

            // Assert
            assertEquals("***", result);
        }

        @Test
        @DisplayName("Should return *** for exactly 12 character token")
        void shouldMaskTwelveCharToken() {
            // Arrange
            String token = "123456789012";

            // Act
            String result = TokenMasking.maskToken(token);

            // Assert
            assertEquals("***", result);
        }
    }

    @Nested
    @DisplayName("Long Tokens (>12 characters)")
    class LongTokenTests {

        @Test
        @DisplayName("Should mask 13 character token showing first 8 chars")
        void shouldMaskThirteenCharToken() {
            // Arrange
            String token = "1234567890123";

            // Act
            String result = TokenMasking.maskToken(token);

            // Assert
            assertEquals("12345678...[13 chars]", result);
        }

        @Test
        @DisplayName("Should mask 20 character token showing first 8 chars")
        void shouldMaskTwentyCharToken() {
            // Arrange
            String token = "12345678901234567890";

            // Act
            String result = TokenMasking.maskToken(token);

            // Assert
            assertEquals("12345678...[20 chars]", result);
        }

        @Test
        @DisplayName("Should mask realistic JWT token")
        void shouldMaskRealisticJwt() {
            // Arrange
            String token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

            // Act
            String result = TokenMasking.maskToken(token);

            // Assert
            assertTrue(result.startsWith("eyJhbGci..."),
                    "Should start with first 8 chars of JWT");
            assertTrue(result.contains("chars]"),
                    "Should contain char count");
        }

        @Test
        @DisplayName("Should mask very long token (1000+ chars)")
        void shouldMaskVeryLongToken() {
            // Arrange
            String token = "A".repeat(1000);

            // Act
            String result = TokenMasking.maskToken(token);

            // Assert
            assertEquals("AAAAAAAA...[1000 chars]", result);
        }
    }
}
