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

@DisplayName("NiFiConfigReader")
class NiFiConfigReaderTest {

    private final NiFiConfigReader reader = new NiFiConfigReader();

    @Nested
    @DisplayName("Input Validation")
    class InputValidationTests {

        @Test
        @DisplayName("Should throw NullPointerException when processor ID is null")
        void shouldThrowNpeForNullProcessorId() {
            // Act & Assert
            assertThrows(NullPointerException.class,
                    () -> reader.getProcessorProperties(null));
        }

        @Test
        @DisplayName("Should throw NullPointerException when service ID is null")
        void shouldThrowNpeForNullServiceId() {
            // Act & Assert
            assertThrows(NullPointerException.class,
                    () -> reader.getControllerServiceProperties(null));
        }

        @Test
        @DisplayName("Should throw IllegalArgumentException for empty processor ID")
        void shouldThrowIaeForEmptyProcessorId() {
            // Act & Assert
            IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                    () -> reader.getProcessorProperties(""));
            assertTrue(exception.getMessage().contains("empty"));
        }

        @Test
        @DisplayName("Should throw IllegalArgumentException for whitespace-only processor ID")
        void shouldThrowIaeForWhitespaceProcessorId() {
            // Act & Assert
            IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                    () -> reader.getProcessorProperties("   "));
            assertTrue(exception.getMessage().contains("empty"));
        }

        @Test
        @DisplayName("Should throw IllegalArgumentException for invalid UUID format")
        void shouldThrowIaeForInvalidUuid() {
            // Act & Assert
            IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                    () -> reader.getProcessorProperties("not-a-valid-uuid"));
            assertTrue(exception.getMessage().contains("UUID"));
        }

        @Test
        @DisplayName("Should throw IllegalArgumentException for empty service ID")
        void shouldThrowIaeForEmptyServiceId() {
            // Act & Assert
            assertThrows(IllegalArgumentException.class,
                    () -> reader.getControllerServiceProperties(""));
        }

        @Test
        @DisplayName("Should throw IllegalArgumentException for invalid UUID in service ID")
        void shouldThrowIaeForInvalidServiceUuid() {
            // Act & Assert
            assertThrows(IllegalArgumentException.class,
                    () -> reader.getControllerServiceProperties("invalid-uuid-format"));
        }
    }
}
