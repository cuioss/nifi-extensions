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
package de.cuioss.nifi.jwt;

import de.cuioss.tools.logging.LogRecord;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("JwtLogMessages")
class JwtLogMessagesTest {

    private static final String EXPECTED_PREFIX = "JWT";

    private static void assertWellFormed(LogRecord logRecord) {
        assertAll("LogRecord is well-formed",
                () -> assertNotNull(logRecord, "LogRecord should be defined"),
                () -> assertNotNull(logRecord.getTemplate(), "Template should be defined"),
                () -> assertTrue(logRecord.getTemplate() != null && !logRecord.getTemplate().isBlank(),
                        "Template should not be blank"),
                () -> assertTrue(logRecord.resolveIdentifierString().startsWith(EXPECTED_PREFIX + "-"),
                        "Resolved identifier should carry the JWT prefix"));
    }

    @Nested
    @DisplayName("INFO LogRecords")
    class InfoLogRecordsTest {

        static Stream<Arguments> infoRecords() {
            return Stream.of(
                    Arguments.of("CONFIG_LOADED", JwtLogMessages.INFO.CONFIG_LOADED),
                    Arguments.of("NO_EXTERNAL_CONFIG", JwtLogMessages.INFO.NO_EXTERNAL_CONFIG),
                    Arguments.of("CONFIG_FILE_RELOADING", JwtLogMessages.INFO.CONFIG_FILE_RELOADING),
                    Arguments.of("NO_CONFIG_FILE", JwtLogMessages.INFO.NO_CONFIG_FILE),
                    Arguments.of("LOADED_PROPERTIES_CONFIG", JwtLogMessages.INFO.LOADED_PROPERTIES_CONFIG),
                    Arguments.of("LOADED_YAML_CONFIG", JwtLogMessages.INFO.LOADED_YAML_CONFIG),
                    Arguments.of("LOADING_EXTERNAL_CONFIGS", JwtLogMessages.INFO.LOADING_EXTERNAL_CONFIGS),
                    Arguments.of("CREATED_ISSUER_CONFIG_FOR", JwtLogMessages.INFO.CREATED_ISSUER_CONFIG_FOR),
                    Arguments.of("ISSUER_DISABLED", JwtLogMessages.INFO.ISSUER_DISABLED),
                    Arguments.of("TOKEN_VALIDATOR_INITIALIZED", JwtLogMessages.INFO.TOKEN_VALIDATOR_INITIALIZED),
                    Arguments.of("CONTROLLER_SERVICE_ENABLED", JwtLogMessages.INFO.CONTROLLER_SERVICE_ENABLED),
                    Arguments.of("CONTROLLER_SERVICE_DISABLED", JwtLogMessages.INFO.CONTROLLER_SERVICE_DISABLED),
                    Arguments.of("METRICS_SNAPSHOT_CREATED", JwtLogMessages.INFO.METRICS_SNAPSHOT_CREATED),
                    Arguments.of("VALIDATION_SUCCESS", JwtLogMessages.INFO.VALIDATION_SUCCESS));
        }

        @ParameterizedTest(name = "INFO.{0} should be a well-formed LogRecord")
        @MethodSource("infoRecords")
        @DisplayName("Should define well-formed INFO LogRecords")
        void shouldDefineWellFormedInfoRecord(String name, LogRecord logRecord) {
            assertWellFormed(logRecord);
        }
    }

    @Nested
    @DisplayName("WARN LogRecords")
    class WarnLogRecordsTest {

        static Stream<Arguments> warnRecords() {
            return Stream.of(
                    Arguments.of("AUTHORIZATION_BYPASS_SECURITY_WARNING",
                            JwtLogMessages.WARN.AUTHORIZATION_BYPASS_SECURITY_WARNING),
                    Arguments.of("INVALID_CONFIG_VALUE", JwtLogMessages.WARN.INVALID_CONFIG_VALUE),
                    Arguments.of("ISSUER_NO_NAME", JwtLogMessages.WARN.ISSUER_NO_NAME),
                    Arguments.of("JWKS_CONTENT_NOT_SUPPORTED", JwtLogMessages.WARN.JWKS_CONTENT_NOT_SUPPORTED),
                    Arguments.of("ISSUER_NO_JWKS_SOURCE", JwtLogMessages.WARN.ISSUER_NO_JWKS_SOURCE),
                    Arguments.of("CONFIG_FILE_NOT_FOUND", JwtLogMessages.WARN.CONFIG_FILE_NOT_FOUND),
                    Arguments.of("UNSUPPORTED_CONFIG_FORMAT", JwtLogMessages.WARN.UNSUPPORTED_CONFIG_FORMAT),
                    Arguments.of("YAML_EMPTY_OR_INVALID", JwtLogMessages.WARN.YAML_EMPTY_OR_INVALID),
                    Arguments.of("NO_VALID_ISSUER_CONFIGS", JwtLogMessages.WARN.NO_VALID_ISSUER_CONFIGS),
                    Arguments.of("TOKEN_VALIDATION_FAILED", JwtLogMessages.WARN.TOKEN_VALIDATION_FAILED));
        }

        @ParameterizedTest(name = "WARN.{0} should be a well-formed LogRecord")
        @MethodSource("warnRecords")
        @DisplayName("Should define well-formed WARN LogRecords")
        void shouldDefineWellFormedWarnRecord(String name, LogRecord logRecord) {
            assertWellFormed(logRecord);
        }
    }

    @Nested
    @DisplayName("ERROR LogRecords")
    class ErrorLogRecordsTest {

        static Stream<Arguments> errorRecords() {
            return Stream.of(
                    Arguments.of("CONFIG_RELOAD_FAILED", JwtLogMessages.ERROR.CONFIG_RELOAD_FAILED),
                    Arguments.of("CONFIG_FILE_IO_ERROR", JwtLogMessages.ERROR.CONFIG_FILE_IO_ERROR),
                    Arguments.of("CONFIG_FILE_PARSE_ERROR", JwtLogMessages.ERROR.CONFIG_FILE_PARSE_ERROR),
                    Arguments.of("ISSUER_CONFIG_PARSE_ERROR", JwtLogMessages.ERROR.ISSUER_CONFIG_PARSE_ERROR),
                    Arguments.of("TOKEN_VALIDATION_ERROR", JwtLogMessages.ERROR.TOKEN_VALIDATION_ERROR),
                    Arguments.of("CONTROLLER_SERVICE_ENABLE_FAILED",
                            JwtLogMessages.ERROR.CONTROLLER_SERVICE_ENABLE_FAILED));
        }

        @ParameterizedTest(name = "ERROR.{0} should be a well-formed LogRecord")
        @MethodSource("errorRecords")
        @DisplayName("Should define well-formed ERROR LogRecords")
        void shouldDefineWellFormedErrorRecord(String name, LogRecord logRecord) {
            assertWellFormed(logRecord);
        }
    }
}
