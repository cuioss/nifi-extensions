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
package de.cuioss.nifi.jwt;

import de.cuioss.tools.logging.LogRecord;
import de.cuioss.tools.logging.LogRecordModel;
import lombok.experimental.UtilityClass;

/**
 * Provides shared logging messages for JWT infrastructure across NiFi extension modules.
 * All messages follow the format: JWT-[identifier]: [message]
 * <p>
 * Processor-specific log messages remain in
 * {@code de.cuioss.nifi.processors.auth.AuthLogMessages}.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/error-handling.adoc">Error Handling Specification</a>
 */
@UtilityClass
public final class JwtLogMessages {

    private static final String PREFIX = "JWT";

    @UtilityClass
    public static final class INFO {
        public static final LogRecord CONFIG_LOADED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(1)
                .template("Configuration loaded successfully")
                .build();

        public static final LogRecord NO_EXTERNAL_CONFIG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(2)
                .template("No external configuration found, using UI configuration")
                .build();

        public static final LogRecord CONFIG_FILE_RELOADING = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(3)
                .template("Configuration file %s has been modified, reloading")
                .build();

        public static final LogRecord NO_CONFIG_FILE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(4)
                .template("No configuration file found")
                .build();

        public static final LogRecord LOADED_PROPERTIES_CONFIG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(5)
                .template("Loaded properties configuration from %s")
                .build();

        public static final LogRecord LOADED_YAML_CONFIG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(6)
                .template("Loaded YAML configuration from %s")
                .build();

        public static final LogRecord LOADING_EXTERNAL_CONFIGS = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(7)
                .template("Loading issuer configurations from external configuration")
                .build();

        public static final LogRecord CREATED_ISSUER_CONFIG_FOR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(8)
                .template("Created issuer configuration for %s")
                .build();

        public static final LogRecord ISSUER_DISABLED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(9)
                .template("Issuer %s is disabled, skipping")
                .build();

        public static final LogRecord TOKEN_VALIDATOR_INITIALIZED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(10)
                .template("TokenValidator successfully initialized with %s issuers")
                .build();

        public static final LogRecord CONTROLLER_SERVICE_ENABLED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(11)
                .template("JwtIssuerConfigService enabled with %s issuer configurations")
                .build();

        public static final LogRecord CONTROLLER_SERVICE_DISABLED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(12)
                .template("JwtIssuerConfigService disabled, resources cleaned up")
                .build();

        public static final LogRecord METRICS_SNAPSHOT_CREATED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(14)
                .template("Created metrics snapshot: %d total validations")
                .build();

        public static final LogRecord VALIDATION_SUCCESS = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(15)
                .template("Token validated successfully for issuer '%s', subject '%s'")
                .build();
    }

    @UtilityClass
    public static final class WARN {
        public static final LogRecord AUTHORIZATION_BYPASS_SECURITY_WARNING = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(100)
                .template("SECURITY WARNING: Authorization bypassed for token with subject: %s")
                .build();

        public static final LogRecord INVALID_CONFIG_VALUE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(101)
                .template("Invalid value '%s' for %s, falling back to default %s")
                .build();

        public static final LogRecord ISSUER_NO_NAME = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(102)
                .template("Issuer %s has no name configured, skipping")
                .build();

        public static final LogRecord JWKS_CONTENT_NOT_SUPPORTED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(103)
                .template("JWKS content configuration not yet supported in shared parser for issuer %s")
                .build();

        public static final LogRecord ISSUER_NO_JWKS_SOURCE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(104)
                .template("Issuer %s has no JWKS source configured (URL, file, or content), skipping")
                .build();

        public static final LogRecord CONFIG_FILE_NOT_FOUND = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(105)
                .template("Configuration file not found at specified path: %s")
                .build();

        public static final LogRecord UNSUPPORTED_CONFIG_FORMAT = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(106)
                .template("Unsupported configuration file format: %s")
                .build();

        public static final LogRecord YAML_EMPTY_OR_INVALID = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(107)
                .template("YAML file %s is empty or invalid")
                .build();

        public static final LogRecord NO_VALID_ISSUER_CONFIGS = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(108)
                .template("No valid issuer configurations found. Token validation will fail.")
                .build();

        public static final LogRecord TOKEN_VALIDATION_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(109)
                .template("Token validation failed: %s")
                .build();

    }

    @UtilityClass
    public static final class ERROR {
        public static final LogRecord CONFIG_RELOAD_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(200)
                .template("Failed to reload configuration, using previous configuration")
                .build();

        public static final LogRecord CONFIG_FILE_IO_ERROR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(201)
                .template("Error loading configuration file")
                .build();

        public static final LogRecord CONFIG_FILE_PARSE_ERROR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(202)
                .template("Error parsing configuration file")
                .build();

        public static final LogRecord ISSUER_CONFIG_PARSE_ERROR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(203)
                .template("Error creating issuer configuration")
                .build();

        public static final LogRecord TOKEN_VALIDATION_ERROR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(204)
                .template("Error during token validation: %s")
                .build();

        public static final LogRecord CONTROLLER_SERVICE_ENABLE_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(205)
                .template("Failed to enable JwtIssuerConfigService: %s")
                .build();
    }
}
