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

@DisplayName("ProcessingError")
class ProcessingErrorTest {

    @Nested
    @DisplayName("Builder Creation")
    class BuilderTests {

        @Test
        @DisplayName("Should create instance with all fields via builder")
        void shouldCreateWithAllFields() {
            ProcessingError error = ProcessingError.builder()
                    .errorCode("AUTH_001")
                    .errorReason("Invalid token signature")
                    .errorCategory("AUTHENTICATION")
                    .build();

            assertEquals("AUTH_001", error.errorCode());
            assertEquals("Invalid token signature", error.errorReason());
            assertEquals("AUTHENTICATION", error.errorCategory());
        }

        @Test
        @DisplayName("Should create instance with null values")
        void shouldCreateWithNullValues() {
            ProcessingError error = ProcessingError.builder()
                    .errorCode(null)
                    .errorReason(null)
                    .errorCategory(null)
                    .build();

            assertNull(error.errorCode());
            assertNull(error.errorReason());
            assertNull(error.errorCategory());
        }

        @Test
        @DisplayName("Should create instance with partial fields")
        void shouldCreateWithPartialFields() {
            ProcessingError error = ProcessingError.builder()
                    .errorCode("TOKEN_EXPIRED")
                    .errorReason("The access token has expired")
                    .build();

            assertEquals("TOKEN_EXPIRED", error.errorCode());
            assertEquals("The access token has expired", error.errorReason());
            assertNull(error.errorCategory());
        }
    }

    @Nested
    @DisplayName("Equals and HashCode")
    class EqualsHashCodeTests {

        @Test
        @DisplayName("Should be equal when all fields match")
        void shouldBeEqualWhenFieldsMatch() {
            ProcessingError error1 = ProcessingError.builder()
                    .errorCode("ERR_001")
                    .errorReason("Test error")
                    .errorCategory("TEST")
                    .build();

            ProcessingError error2 = ProcessingError.builder()
                    .errorCode("ERR_001")
                    .errorReason("Test error")
                    .errorCategory("TEST")
                    .build();

            assertEquals(error1, error2);
            assertEquals(error1.hashCode(), error2.hashCode());
        }

        @Test
        @DisplayName("Should not be equal when errorCode differs")
        void shouldNotBeEqualWhenErrorCodeDiffers() {
            ProcessingError error1 = ProcessingError.builder()
                    .errorCode("ERR_001")
                    .errorReason("Test error")
                    .errorCategory("TEST")
                    .build();

            ProcessingError error2 = ProcessingError.builder()
                    .errorCode("ERR_002")
                    .errorReason("Test error")
                    .errorCategory("TEST")
                    .build();

            assertNotEquals(error1, error2);
        }

        @Test
        @DisplayName("Should not be equal when errorReason differs")
        void shouldNotBeEqualWhenErrorReasonDiffers() {
            ProcessingError error1 = ProcessingError.builder()
                    .errorCode("ERR_001")
                    .errorReason("First error")
                    .errorCategory("TEST")
                    .build();

            ProcessingError error2 = ProcessingError.builder()
                    .errorCode("ERR_001")
                    .errorReason("Second error")
                    .errorCategory("TEST")
                    .build();

            assertNotEquals(error1, error2);
        }

        @Test
        @DisplayName("Should not be equal when errorCategory differs")
        void shouldNotBeEqualWhenErrorCategoryDiffers() {
            ProcessingError error1 = ProcessingError.builder()
                    .errorCode("ERR_001")
                    .errorReason("Test error")
                    .errorCategory("CATEGORY_A")
                    .build();

            ProcessingError error2 = ProcessingError.builder()
                    .errorCode("ERR_001")
                    .errorReason("Test error")
                    .errorCategory("CATEGORY_B")
                    .build();

            assertNotEquals(error1, error2);
        }

        @Test
        @DisplayName("Should handle null values in equals")
        void shouldHandleNullsInEquals() {
            ProcessingError error1 = ProcessingError.builder()
                    .errorCode(null)
                    .errorReason(null)
                    .errorCategory(null)
                    .build();

            ProcessingError error2 = ProcessingError.builder()
                    .errorCode(null)
                    .errorReason(null)
                    .errorCategory(null)
                    .build();

            assertEquals(error1, error2);
            assertEquals(error1.hashCode(), error2.hashCode());
        }

        @Test
        @DisplayName("Should not be equal to null")
        void shouldNotBeEqualToNull() {
            ProcessingError error = ProcessingError.builder()
                    .errorCode("ERR_001")
                    .build();

            assertNotEquals(null, error);
        }

        @Test
        @DisplayName("Should be equal to itself")
        void shouldBeEqualToItself() {
            ProcessingError error = ProcessingError.builder()
                    .errorCode("ERR_001")
                    .errorReason("Test")
                    .errorCategory("TEST")
                    .build();

            assertEquals(error, error);
        }
    }

    @Nested
    @DisplayName("ToString")
    class ToStringTests {

        @Test
        @DisplayName("Should include all fields in toString")
        void shouldIncludeAllFieldsInToString() {
            ProcessingError error = ProcessingError.builder()
                    .errorCode("AUTH_FAILED")
                    .errorReason("Invalid credentials")
                    .errorCategory("SECURITY")
                    .build();

            String result = error.toString();

            assertTrue(result.contains("AUTH_FAILED"));
            assertTrue(result.contains("Invalid credentials"));
            assertTrue(result.contains("SECURITY"));
        }
    }

    @Nested
    @DisplayName("Getters")
    class GetterTests {

        @Test
        @DisplayName("Should return correct errorCode via getter")
        void shouldReturnCorrectErrorCode() {
            ProcessingError error = ProcessingError.builder()
                    .errorCode("TEST_CODE")
                    .build();

            assertEquals("TEST_CODE", error.errorCode());
        }

        @Test
        @DisplayName("Should return correct errorReason via getter")
        void shouldReturnCorrectErrorReason() {
            ProcessingError error = ProcessingError.builder()
                    .errorReason("Test reason message")
                    .build();

            assertEquals("Test reason message", error.errorReason());
        }

        @Test
        @DisplayName("Should return correct errorCategory via getter")
        void shouldReturnCorrectErrorCategory() {
            ProcessingError error = ProcessingError.builder()
                    .errorCategory("VALIDATION")
                    .build();

            assertEquals("VALIDATION", error.errorCategory());
        }
    }
}
