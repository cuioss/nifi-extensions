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
package de.cuioss.nifi.ui.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

@DisplayName("LogSanitizer Tests")
class LogSanitizerTest {

    @Nested
    @DisplayName("Control-character neutralization")
    class ControlCharacters {

        static Stream<Arguments> forgedLineBreaks() {
            return Stream.of(
                    Arguments.of("CR LF pair", "http://evil\r\nWARN forged entry", "http://evil__WARN forged entry"),
                    Arguments.of("bare LF", "path\nforged", "path_forged"),
                    Arguments.of("bare CR", "path\rforged", "path_forged"),
                    Arguments.of("tab", "path\tforged", "path_forged"),
                    Arguments.of("NEL", "path\u0085forged", "path_forged"),
                    Arguments.of("C1 control (CSI)", "path\u009bforged", "path_forged"),
                    Arguments.of("line separator", "path\u2028forged", "path_forged"),
                    Arguments.of("paragraph separator", "path\u2029forged", "path_forged"),
                    Arguments.of("NUL", "path\u0000forged", "path_forged"));
        }

        @ParameterizedTest(name = "{0}")
        @MethodSource("forgedLineBreaks")
        @DisplayName("Should replace every control character so the value stays on one line")
        void shouldNeutralizeControlCharacters(String label, String input, String expected) {
            // Arrange / Act
            String sanitized = LogSanitizer.forLog(input);

            // Assert
            assertEquals(expected, sanitized, label);
            assertFalse(sanitized.contains("\n"), "sanitized value must not contain LF");
            assertFalse(sanitized.contains("\r"), "sanitized value must not contain CR");
        }
    }

    @Nested
    @DisplayName("Pass-through behaviour")
    class PassThrough {

        @Test
        @DisplayName("Should leave a well-formed URL untouched")
        void shouldLeaveCleanValueUnchanged() {
            // Arrange
            String url = "https://idp.example.com:8443/realms/test/protocol/openid-connect/token";

            // Act
            String sanitized = LogSanitizer.forLog(url);

            // Assert
            assertEquals(url, sanitized);
        }

        @Test
        @DisplayName("Should render null as the literal 'null' rather than dropping the field")
        void shouldRenderNullAsLiteral() {
            // Arrange / Act
            String sanitized = LogSanitizer.forLog(null);

            // Assert
            assertEquals("null", sanitized);
        }

        @Test
        @DisplayName("Should return an empty string unchanged")
        void shouldReturnEmptyStringUnchanged() {
            // Arrange / Act
            String sanitized = LogSanitizer.forLog("");

            // Assert
            assertEquals("", sanitized);
        }
    }
}
