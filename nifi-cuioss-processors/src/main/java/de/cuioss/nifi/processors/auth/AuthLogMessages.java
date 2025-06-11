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
                .template("Creating issuer configuration for %s with properties: jwksUrl=%s, issuer=%s, audience=%s, clientId=%s")
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
    }
}
