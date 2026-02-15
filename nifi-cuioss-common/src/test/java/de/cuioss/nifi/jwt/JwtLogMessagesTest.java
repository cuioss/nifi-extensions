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

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("JwtLogMessages")
class JwtLogMessagesTest {

    @Nested
    @DisplayName("INFO LogRecords")
    class InfoLogRecordsTest {

        @Test
        @DisplayName("Should initialize CONFIG_LOADED LogRecord")
        void shouldInitializeConfigLoaded() {
            // Act & Assert
            assertNotNull(JwtLogMessages.INFO.CONFIG_LOADED);
        }

        @Test
        @DisplayName("Should initialize NO_EXTERNAL_CONFIG LogRecord")
        void shouldInitializeNoExternalConfig() {
            // Act & Assert
            assertNotNull(JwtLogMessages.INFO.NO_EXTERNAL_CONFIG);
        }

        @Test
        @DisplayName("Should initialize CONFIG_FILE_RELOADING LogRecord")
        void shouldInitializeConfigFileReloading() {
            // Act & Assert
            assertNotNull(JwtLogMessages.INFO.CONFIG_FILE_RELOADING);
        }

        @Test
        @DisplayName("Should initialize NO_CONFIG_FILE LogRecord")
        void shouldInitializeNoConfigFile() {
            // Act & Assert
            assertNotNull(JwtLogMessages.INFO.NO_CONFIG_FILE);
        }

        @Test
        @DisplayName("Should initialize LOADED_PROPERTIES_CONFIG LogRecord")
        void shouldInitializeLoadedPropertiesConfig() {
            // Act & Assert
            assertNotNull(JwtLogMessages.INFO.LOADED_PROPERTIES_CONFIG);
        }

        @Test
        @DisplayName("Should initialize LOADED_YAML_CONFIG LogRecord")
        void shouldInitializeLoadedYamlConfig() {
            // Act & Assert
            assertNotNull(JwtLogMessages.INFO.LOADED_YAML_CONFIG);
        }

        @Test
        @DisplayName("Should initialize LOADING_EXTERNAL_CONFIGS LogRecord")
        void shouldInitializeLoadingExternalConfigs() {
            // Act & Assert
            assertNotNull(JwtLogMessages.INFO.LOADING_EXTERNAL_CONFIGS);
        }

        @Test
        @DisplayName("Should initialize CREATED_ISSUER_CONFIG_FOR LogRecord")
        void shouldInitializeCreatedIssuerConfigFor() {
            // Act & Assert
            assertNotNull(JwtLogMessages.INFO.CREATED_ISSUER_CONFIG_FOR);
        }

        @Test
        @DisplayName("Should initialize ISSUER_DISABLED LogRecord")
        void shouldInitializeIssuerDisabled() {
            // Act & Assert
            assertNotNull(JwtLogMessages.INFO.ISSUER_DISABLED);
        }

        @Test
        @DisplayName("Should initialize TOKEN_VALIDATOR_INITIALIZED LogRecord")
        void shouldInitializeTokenValidatorInitialized() {
            // Act & Assert
            assertNotNull(JwtLogMessages.INFO.TOKEN_VALIDATOR_INITIALIZED);
        }

        @Test
        @DisplayName("Should initialize CONTROLLER_SERVICE_ENABLED LogRecord")
        void shouldInitializeControllerServiceEnabled() {
            // Act & Assert
            assertNotNull(JwtLogMessages.INFO.CONTROLLER_SERVICE_ENABLED);
        }

        @Test
        @DisplayName("Should initialize CONTROLLER_SERVICE_DISABLED LogRecord")
        void shouldInitializeControllerServiceDisabled() {
            // Act & Assert
            assertNotNull(JwtLogMessages.INFO.CONTROLLER_SERVICE_DISABLED);
        }

        @Test
        @DisplayName("Should initialize METRICS_SNAPSHOT_CREATED LogRecord")
        void shouldInitializeMetricsSnapshotCreated() {
            // Act & Assert
            assertNotNull(JwtLogMessages.INFO.METRICS_SNAPSHOT_CREATED);
        }

        @Test
        @DisplayName("Should initialize VALIDATION_SUCCESS LogRecord")
        void shouldInitializeValidationSuccess() {
            // Act & Assert
            assertNotNull(JwtLogMessages.INFO.VALIDATION_SUCCESS);
        }
    }

    @Nested
    @DisplayName("WARN LogRecords")
    class WarnLogRecordsTest {

        @Test
        @DisplayName("Should initialize AUTHORIZATION_BYPASS_SECURITY_WARNING LogRecord")
        void shouldInitializeAuthorizationBypassSecurityWarning() {
            // Act & Assert
            assertNotNull(JwtLogMessages.WARN.AUTHORIZATION_BYPASS_SECURITY_WARNING);
        }

        @Test
        @DisplayName("Should initialize INVALID_CONFIG_VALUE LogRecord")
        void shouldInitializeInvalidConfigValue() {
            // Act & Assert
            assertNotNull(JwtLogMessages.WARN.INVALID_CONFIG_VALUE);
        }

        @Test
        @DisplayName("Should initialize ISSUER_NO_NAME LogRecord")
        void shouldInitializeIssuerNoName() {
            // Act & Assert
            assertNotNull(JwtLogMessages.WARN.ISSUER_NO_NAME);
        }

        @Test
        @DisplayName("Should initialize JWKS_CONTENT_NOT_SUPPORTED LogRecord")
        void shouldInitializeJwksContentNotSupported() {
            // Act & Assert
            assertNotNull(JwtLogMessages.WARN.JWKS_CONTENT_NOT_SUPPORTED);
        }

        @Test
        @DisplayName("Should initialize ISSUER_NO_JWKS_SOURCE LogRecord")
        void shouldInitializeIssuerNoJwksSource() {
            // Act & Assert
            assertNotNull(JwtLogMessages.WARN.ISSUER_NO_JWKS_SOURCE);
        }

        @Test
        @DisplayName("Should initialize CONFIG_FILE_NOT_FOUND LogRecord")
        void shouldInitializeConfigFileNotFound() {
            // Act & Assert
            assertNotNull(JwtLogMessages.WARN.CONFIG_FILE_NOT_FOUND);
        }

        @Test
        @DisplayName("Should initialize UNSUPPORTED_CONFIG_FORMAT LogRecord")
        void shouldInitializeUnsupportedConfigFormat() {
            // Act & Assert
            assertNotNull(JwtLogMessages.WARN.UNSUPPORTED_CONFIG_FORMAT);
        }

        @Test
        @DisplayName("Should initialize YAML_EMPTY_OR_INVALID LogRecord")
        void shouldInitializeYamlEmptyOrInvalid() {
            // Act & Assert
            assertNotNull(JwtLogMessages.WARN.YAML_EMPTY_OR_INVALID);
        }

        @Test
        @DisplayName("Should initialize NO_VALID_ISSUER_CONFIGS LogRecord")
        void shouldInitializeNoValidIssuerConfigs() {
            // Act & Assert
            assertNotNull(JwtLogMessages.WARN.NO_VALID_ISSUER_CONFIGS);
        }

        @Test
        @DisplayName("Should initialize TOKEN_VALIDATION_FAILED LogRecord")
        void shouldInitializeTokenValidationFailed() {
            // Act & Assert
            assertNotNull(JwtLogMessages.WARN.TOKEN_VALIDATION_FAILED);
        }
    }

    @Nested
    @DisplayName("ERROR LogRecords")
    class ErrorLogRecordsTest {

        @Test
        @DisplayName("Should initialize CONFIG_RELOAD_FAILED LogRecord")
        void shouldInitializeConfigReloadFailed() {
            // Act & Assert
            assertNotNull(JwtLogMessages.ERROR.CONFIG_RELOAD_FAILED);
        }

        @Test
        @DisplayName("Should initialize CONFIG_FILE_IO_ERROR LogRecord")
        void shouldInitializeConfigFileIoError() {
            // Act & Assert
            assertNotNull(JwtLogMessages.ERROR.CONFIG_FILE_IO_ERROR);
        }

        @Test
        @DisplayName("Should initialize CONFIG_FILE_PARSE_ERROR LogRecord")
        void shouldInitializeConfigFileParseError() {
            // Act & Assert
            assertNotNull(JwtLogMessages.ERROR.CONFIG_FILE_PARSE_ERROR);
        }

        @Test
        @DisplayName("Should initialize ISSUER_CONFIG_PARSE_ERROR LogRecord")
        void shouldInitializeIssuerConfigParseError() {
            // Act & Assert
            assertNotNull(JwtLogMessages.ERROR.ISSUER_CONFIG_PARSE_ERROR);
        }

        @Test
        @DisplayName("Should initialize TOKEN_VALIDATION_ERROR LogRecord")
        void shouldInitializeTokenValidationError() {
            // Act & Assert
            assertNotNull(JwtLogMessages.ERROR.TOKEN_VALIDATION_ERROR);
        }

        @Test
        @DisplayName("Should initialize CONTROLLER_SERVICE_ENABLE_FAILED LogRecord")
        void shouldInitializeControllerServiceEnableFailed() {
            // Act & Assert
            assertNotNull(JwtLogMessages.ERROR.CONTROLLER_SERVICE_ENABLE_FAILED);
        }
    }
}
