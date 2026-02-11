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
package de.cuioss.nifi.processors.auth;

import de.cuioss.tools.logging.LogRecord;
import de.cuioss.tools.logging.LogRecordModel;
import lombok.experimental.UtilityClass;

/**
 * Provides logging messages for the JWT authentication processors.
 * All messages follow the format: AUTH-[identifier]: [message]
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/error-handling.adoc">Error Handling Specification</a>
 */
@UtilityClass
public final class AuthLogMessages {

    private static final String PREFIX = "AUTH";

    @UtilityClass
    public static final class INFO {
        public static final LogRecord PROCESSOR_INITIALIZED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(1)
                .template("MultiIssuerJWTTokenAuthenticator initialized")
                .build();

        public static final LogRecord PROCESSOR_STOPPED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(2)
                .template("MultiIssuerJWTTokenAuthenticator stopped and resources cleaned up")
                .build();

        public static final LogRecord CONFIG_CHANGE_DETECTED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(3)
                .template("Detected configuration change, creating new TokenValidator instance")
                .build();

        public static final LogRecord CONFIG_HASH_CHANGED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(4)
                .template("Configuration hash changed from '%s' to '%s'")
                .build();

        public static final LogRecord CLEANING_RESOURCES = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(5)
                .template("Cleaning up resources before configuration reload")
                .build();

        public static final LogRecord REMOVING_ISSUER_CONFIG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(6)
                .template("Removing issuer configuration for %s from cache as it no longer exists")
                .build();

        public static final LogRecord FOUND_ISSUER_CONFIG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(7)
                .template("Found issuer configuration for %s: %s")
                .build();

        public static final LogRecord REUSING_CACHED_CONFIG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(8)
                .template("Reusing cached issuer configuration for %s")
                .build();

        public static final LogRecord CREATED_CACHED_CONFIG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(9)
                .template("Created and cached new issuer configuration for %s")
                .build();

        public static final LogRecord CREATED_ISSUER_CONFIGS = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(10)
                .template("Created %s issuer configurations")
                .build();

        public static final LogRecord NO_ISSUER_PROPERTY = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(11)
                .template("No 'issuer' property specified for issuer %s, will use issuer name as default")
                .build();

        public static final LogRecord USING_ISSUER_NAME = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(12)
                .template("Using issuer name '%s' as default issuer value")
                .build();

        public static final LogRecord CREATING_ISSUER_CONFIG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(13)
                .template("Creating issuer configuration for %s with properties: jwksUrl=%s, issuer=%s, audience=%s")
                .build();

        public static final LogRecord TOKEN_VALIDATOR_INITIALIZED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(14)
                .template("TokenValidator successfully initialized with %s issuers")
                .build();

        public static final LogRecord TOKEN_VALIDATION_METRICS = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(15)
                .template("Token validation metrics - Processed flow files: %d")
                .build();

        public static final LogRecord SECURITY_COUNTER_AVAILABLE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(16)
                .template("Security event counter is available for monitoring")
                .build();

        public static final LogRecord SECURITY_COUNTER_UNAVAILABLE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(17)
                .template("Security event counter is not available for monitoring")
                .build();

        public static final LogRecord ISSUER_CONFIG_CREATED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(18)
                .template("Successfully created issuer configuration for %s")
                .build();

        public static final LogRecord AUTHORIZATION_BYPASSED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(19)
                .template("Authorization bypassed for issuer '%s' (explicitly configured)")
                .build();

        public static final LogRecord AUTHORIZATION_SUCCESSFUL = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(20)
                .template("Authorization successful for token with subject '%s' from issuer '%s'")
                .build();

        public static final LogRecord CONFIG_LOADED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(21)
                .template("Configuration loaded successfully")
                .build();

        public static final LogRecord NO_EXTERNAL_CONFIG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(22)
                .template("No external configuration found, using UI configuration")
                .build();

        public static final LogRecord CONFIG_FILE_RELOADING = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(23)
                .template("Configuration file %s has been modified, reloading")
                .build();

        public static final LogRecord NO_CONFIG_FILE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(24)
                .template("No configuration file found")
                .build();

        public static final LogRecord LOADED_PROPERTIES_CONFIG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(25)
                .template("Loaded properties configuration from %s")
                .build();

        public static final LogRecord LOADED_YAML_CONFIG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(26)
                .template("Loaded YAML configuration from %s")
                .build();

        public static final LogRecord LOADING_EXTERNAL_CONFIGS = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(27)
                .template("Loading issuer configurations from external configuration")
                .build();

        public static final LogRecord CREATED_ISSUER_CONFIG_FOR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(28)
                .template("Created issuer configuration for %s")
                .build();

        public static final LogRecord ISSUER_DISABLED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(29)
                .template("Issuer %s is disabled, skipping")
                .build();

        public static final LogRecord PROCESSOR_INITIALIZING = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(30)
                .template("Initializing MultiIssuerJWTTokenAuthenticator processor")
                .build();

        public static final LogRecord PROCESSOR_INITIALIZED_WITH_DESCRIPTORS = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(31)
                .template("MultiIssuerJWTTokenAuthenticator processor initialized with %s property descriptors")
                .build();

        public static final LogRecord CONFIG_MANAGER_INITIALIZED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(32)
                .template("Configuration manager initialized, external configuration loaded: %s")
                .build();

        public static final LogRecord AVAILABLE_PROPERTY_DESCRIPTORS = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(33)
                .template("Available property descriptors")
                .build();

        public static final LogRecord PROPERTY_DESCRIPTOR_DETAIL = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(34)
                .template("Property: %s (Display: %s)")
                .build();

        public static final LogRecord EXTERNAL_CONFIG_CHANGED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(35)
                .template("External configuration file changed, forcing TokenValidator recreation")
                .build();

        public static final LogRecord CONFIG_REFRESHED_ATTRIBUTE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(36)
                .template("Added config-refreshed attribute to flow file")
                .build();

        public static final LogRecord NO_TOKEN_NOT_REQUIRED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(37)
                .template("No token found but valid token not required, routing to success")
                .build();
    }

    @UtilityClass
    public static final class WARN {
        public static final LogRecord NO_TOKEN_FOUND = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(100)
                .template("No token found in the specified location: %s")
                .build();

        public static final LogRecord TOKEN_SIZE_EXCEEDED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(101)
                .template("Token exceeds maximum size limit of %d bytes")
                .build();

        public static final LogRecord TOKEN_MALFORMED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(102)
                .template("Token is malformed (missing segments)")
                .build();

        public static final LogRecord TOKEN_VALIDATION_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(103)
                .template("Token validation failed: %s")
                .build();

        public static final LogRecord RESOURCE_CLEANUP_ERROR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(104)
                .template("Error during resource cleanup: %s")
                .build();

        public static final LogRecord NO_VALID_ISSUER_CONFIGS = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(105)
                .template("No valid issuer configurations found. Token validation will fail.")
                .build();

        public static final LogRecord INVALID_ISSUER_CONFIG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(110)
                .template("Issuer configuration for %s is invalid and will be skipped")
                .build();

        public static final LogRecord INSECURE_JWKS_URL = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(106)
                .template("Using insecure http:// for jwks-url in issuer %s. This is not recommended for production.")
                .build();

        public static final LogRecord NO_AUDIENCE_OR_CLIENT_ID = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(107)
                .template("Neither 'audience' nor 'client-id' specified for issuer %s. This reduces security as token audience will not be validated.")
                .build();

        public static final LogRecord MISSING_JWKS_URL = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(108)
                .template("Missing required property 'jwks-url' for issuer %s")
                .build();

        public static final LogRecord ISSUER_CONFIG_NOT_IMPLEMENTED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(109)
                .template("IssuerConfig creation not yet fully implemented. Validation will fail.")
                .build();

        public static final LogRecord AUTHORIZATION_BYPASS_ENABLED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(111)
                .template("Authorization bypass explicitly enabled for issuer %s. This is a security risk!")
                .build();

        public static final LogRecord AUTHORIZATION_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(112)
                .template("Authorization failed for token with subject '%s' from issuer '%s': %s")
                .build();

        public static final LogRecord CONFIG_FILE_NOT_FOUND = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(113)
                .template("Configuration file not found at specified path: %s")
                .build();

        public static final LogRecord UNSUPPORTED_CONFIG_FORMAT = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(114)
                .template("Unsupported configuration file format: %s")
                .build();

        public static final LogRecord YAML_EMPTY_OR_INVALID = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(115)
                .template("YAML file %s is empty or invalid")
                .build();

        public static final LogRecord INVALID_CONFIG_VALUE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(116)
                .template("Invalid value '%s' for %s, falling back to default %s")
                .build();

        public static final LogRecord ISSUER_NO_NAME = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(117)
                .template("Issuer %s has no name configured, skipping")
                .build();

        public static final LogRecord JWKS_CONTENT_NOT_SUPPORTED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(118)
                .template("JWKS content configuration not yet supported in shared parser for issuer %s")
                .build();

        public static final LogRecord ISSUER_NO_JWKS_SOURCE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(119)
                .template("Issuer %s has no JWKS source configured (URL, file, or content), skipping")
                .build();

        public static final LogRecord NO_ISSUER_CONFIGS_NOT_REQUIRED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(120)
                .template("No issuer configurations found, but require-valid-token is false. TokenValidator will not be initialized.")
                .build();

        public static final LogRecord TOKEN_VALIDATION_FAILED_MSG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(121)
                .template("Token validation failed: %s")
                .build();

        public static final LogRecord FLOW_FILE_SIZE_EXCEEDED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(122)
                .template("Flow file content size %d exceeds maximum allowed size %d")
                .build();

        public static final LogRecord AUTHORIZATION_BYPASS_SECURITY_WARNING = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(123)
                .template("SECURITY WARNING: Authorization bypassed for token with subject: %s")
                .build();

        public static final LogRecord FORKJOINPOOL_CLASSLOADER_SETUP_INTERRUPTED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(124)
                .template("Interrupted while setting NAR classloader on ForkJoinPool threads")
                .build();

        public static final LogRecord FORKJOINPOOL_CLASSLOADER_SETUP_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(125)
                .template("Failed to set NAR classloader on ForkJoinPool threads: %s")
                .build();

        public static final LogRecord FORKJOINPOOL_LATCH_AWAIT_TIMEOUT = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(126)
                .template("CountDownLatch await timed out during ForkJoinPool classloader setup: %s")
                .build();
    }

    @UtilityClass
    public static final class ERROR {
        public static final LogRecord ISSUER_CONFIG_ERROR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(200)
                .template("Error creating issuer configuration for %s: %s")
                .build();

        public static final LogRecord FLOW_FILE_PROCESSING_ERROR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(201)
                .template("Error processing flow file: %s")
                .build();

        public static final LogRecord ISSUER_CONFIG_CREATION_ERROR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(202)
                .template("Error creating IssuerConfig for %s: %s")
                .build();

        public static final LogRecord HTTPS_REQUIRED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(203)
                .template("HTTPS is required for JWKS URL but HTTP was provided for issuer %s. Use HTTPS for production environments.")
                .build();

        public static final LogRecord UNSUPPORTED_ALGORITHM = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(204)
                .template("Token uses unsupported algorithm '%s'. Allowed algorithms: %s")
                .build();

        public static final LogRecord NO_AUTHORIZATION_CONFIG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(205)
                .template("No authorization configuration (required-scopes or required-roles) for issuer %s. " +
                        "Set bypass-authorization=true to explicitly bypass authorization (NOT recommended).")
                .build();

        public static final LogRecord NO_ISSUER_CONFIG_FOR_TOKEN = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(206)
                .template("No issuer configuration found for token issuer '%s'. Access denied (fail-secure).")
                .build();

        public static final LogRecord CONFIG_RELOAD_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(207)
                .template("Failed to reload configuration, using previous configuration")
                .build();

        public static final LogRecord CONFIG_FILE_IO_ERROR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(208)
                .template("Error loading configuration file")
                .build();

        public static final LogRecord CONFIG_FILE_PARSE_ERROR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(209)
                .template("Error parsing configuration file")
                .build();

        public static final LogRecord ISSUER_CONFIG_PARSE_ERROR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(210)
                .template("Error creating issuer configuration")
                .build();
    }
}
