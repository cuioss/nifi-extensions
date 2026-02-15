/*
 * Copyright 2023 the original author or authors.
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * <p>
 * https://www.apache.org/licenses/LICENSE-2.0
 * <p>
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
            // Arrange & Act
            ProcessingError error = ProcessingError.builder()
                    .errorCode("AUTH_001")
                    .errorReason("Invalid token signature")
                    .errorCategory("AUTHENTICATION")
                    .build();

            // Assert
            assertEquals("AUTH_001", error.getErrorCode());
            assertEquals("Invalid token signature", error.getErrorReason());
            assertEquals("AUTHENTICATION", error.getErrorCategory());
        }

        @Test
        @DisplayName("Should create instance with null values")
        void shouldCreateWithNullValues() {
            // Arrange & Act
            ProcessingError error = ProcessingError.builder()
                    .errorCode(null)
                    .errorReason(null)
                    .errorCategory(null)
                    .build();

            // Assert
            assertNull(error.getErrorCode());
            assertNull(error.getErrorReason());
            assertNull(error.getErrorCategory());
        }

        @Test
        @DisplayName("Should create instance with partial fields")
        void shouldCreateWithPartialFields() {
            // Arrange & Act
            ProcessingError error = ProcessingError.builder()
                    .errorCode("TOKEN_EXPIRED")
                    .errorReason("The access token has expired")
                    .build();

            // Assert
            assertEquals("TOKEN_EXPIRED", error.getErrorCode());
            assertEquals("The access token has expired", error.getErrorReason());
            assertNull(error.getErrorCategory());
        }
    }

    @Nested
    @DisplayName("Equals and HashCode")
    class EqualsHashCodeTests {

        @Test
        @DisplayName("Should be equal when all fields match")
        void shouldBeEqualWhenFieldsMatch() {
            // Arrange
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

            // Act & Assert
            assertEquals(error1, error2);
            assertEquals(error1.hashCode(), error2.hashCode());
        }

        @Test
        @DisplayName("Should not be equal when errorCode differs")
        void shouldNotBeEqualWhenErrorCodeDiffers() {
            // Arrange
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

            // Act & Assert
            assertNotEquals(error1, error2);
        }

        @Test
        @DisplayName("Should not be equal when errorReason differs")
        void shouldNotBeEqualWhenErrorReasonDiffers() {
            // Arrange
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

            // Act & Assert
            assertNotEquals(error1, error2);
        }

        @Test
        @DisplayName("Should not be equal when errorCategory differs")
        void shouldNotBeEqualWhenErrorCategoryDiffers() {
            // Arrange
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

            // Act & Assert
            assertNotEquals(error1, error2);
        }

        @Test
        @DisplayName("Should handle null values in equals")
        void shouldHandleNullsInEquals() {
            // Arrange
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

            // Act & Assert
            assertEquals(error1, error2);
            assertEquals(error1.hashCode(), error2.hashCode());
        }

        @Test
        @DisplayName("Should not be equal to null")
        void shouldNotBeEqualToNull() {
            // Arrange
            ProcessingError error = ProcessingError.builder()
                    .errorCode("ERR_001")
                    .build();

            // Act & Assert
            assertNotEquals(null, error);
        }

        @Test
        @DisplayName("Should be equal to itself")
        void shouldBeEqualToItself() {
            // Arrange
            ProcessingError error = ProcessingError.builder()
                    .errorCode("ERR_001")
                    .errorReason("Test")
                    .errorCategory("TEST")
                    .build();

            // Act & Assert
            assertEquals(error, error);
        }
    }

    @Nested
    @DisplayName("ToString")
    class ToStringTests {

        @Test
        @DisplayName("Should include all fields in toString")
        void shouldIncludeAllFieldsInToString() {
            // Arrange
            ProcessingError error = ProcessingError.builder()
                    .errorCode("AUTH_FAILED")
                    .errorReason("Invalid credentials")
                    .errorCategory("SECURITY")
                    .build();

            // Act
            String result = error.toString();

            // Assert
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
            // Arrange
            ProcessingError error = ProcessingError.builder()
                    .errorCode("TEST_CODE")
                    .build();

            // Act & Assert
            assertEquals("TEST_CODE", error.getErrorCode());
        }

        @Test
        @DisplayName("Should return correct errorReason via getter")
        void shouldReturnCorrectErrorReason() {
            // Arrange
            ProcessingError error = ProcessingError.builder()
                    .errorReason("Test reason message")
                    .build();

            // Act & Assert
            assertEquals("Test reason message", error.getErrorReason());
        }

        @Test
        @DisplayName("Should return correct errorCategory via getter")
        void shouldReturnCorrectErrorCategory() {
            // Arrange
            ProcessingError error = ProcessingError.builder()
                    .errorCategory("VALIDATION")
                    .build();

            // Act & Assert
            assertEquals("VALIDATION", error.getErrorCategory());
        }
    }
}
