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
package de.cuioss.nifi.ui;

import de.cuioss.tools.logging.LogRecord;
import de.cuioss.tools.logging.LogRecordModel;

/**
 * Provides logging messages for the NiFi UI module.
 * All messages follow the format: UI-[identifier]: [message]
 */
public final class UILogMessages {

    private UILogMessages() {
        // utility class
    }

    private static final String PREFIX = "UI";

    public static final class INFO {

        private INFO() {
            // utility class
        }

        public static final LogRecord FILTER_INITIALIZED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(1)
                .template("Initialized API Authentication Filter")
                .build();

        public static final LogRecord FILTER_DESTROYED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(2)
                .template("Destroying API Key Authentication Filter")
                .build();
    }

    public static final class WARN {

        private WARN() {
            // utility class
        }

        public static final LogRecord MISSING_PROCESSOR_ID = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(100)
                .template("Missing processor ID header in request to %s")
                .build();

        public static final LogRecord INVALID_PROCESSOR_ID_FORMAT = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(101)
                .template("Invalid processor ID format in request to %s")
                .build();

        public static final LogRecord INVALID_JSON_FORMAT = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(102)
                .template("Invalid JSON format in request: %s")
                .build();

        public static final LogRecord MISSING_REQUIRED_FIELD_TOKEN = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(103)
                .template("Missing required field: token")
                .build();

        public static final LogRecord INVALID_REQUEST = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(104)
                .template("Invalid request for processor %s: %s")
                .build();

        public static final LogRecord SSRF_BLOCKED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(105)
                .template("SSRF attempt blocked for JWKS URL: %s")
                .build();

        public static final LogRecord JWKS_IP_URI_CONSTRUCTION_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(106)
                .template("Failed to construct IP-based URI for JWKS URL: %s")
                .build();

        public static final LogRecord JWKS_URL_VALIDATION_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(107)
                .template("JWKS URL validation failed: %s - %s")
                .build();

        public static final LogRecord JWKS_FILE_OUTSIDE_BASE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(108)
                .template("JWKS file path outside allowed base directory: %s (allowed: %s)")
                .build();

        public static final LogRecord JWKS_FILE_VALIDATION_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(109)
                .template("JWKS file validation failed: %s")
                .build();

        public static final LogRecord URL_SECURITY_VIOLATION = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(110)
                .template("URL security violation for JWKS URL: %s - %s")
                .build();

        public static final LogRecord PATH_SECURITY_VIOLATION = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(111)
                .template("Path security violation for JWKS file: %s - %s")
                .build();

        public static final LogRecord GATEWAY_PROXY_PATH_REJECTED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(112)
                .template("Rejected non-whitelisted gateway proxy path: %s")
                .build();
    }

    public static final class ERROR {

        private ERROR() {
            // utility class
        }

        public static final LogRecord FAILED_WRITE_UNAUTHORIZED_RESPONSE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(200)
                .template("Failed to write unauthorized response")
                .build();

        public static final LogRecord ERROR_READING_REQUEST_BODY = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(201)
                .template("Error reading request body")
                .build();

        public static final LogRecord SERVICE_NOT_AVAILABLE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(202)
                .template("Service not available for processor %s: %s")
                .build();

        public static final LogRecord COMMUNICATION_ERROR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(203)
                .template("Communication error for processor %s")
                .build();

        public static final LogRecord FAILED_SEND_ERROR_RESPONSE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(204)
                .template("Failed to send error response")
                .build();

        public static final LogRecord FAILED_SEND_VALIDATION_RESPONSE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(205)
                .template("Failed to send validation response")
                .build();

        public static final LogRecord FAILED_WRITE_VALIDATION_RESPONSE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(206)
                .template("Failed to write validation response")
                .build();

        public static final LogRecord FAILED_WRITE_ERROR_RESPONSE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(207)
                .template("Failed to write error response")
                .build();

        public static final LogRecord ERROR_WRITING_METRICS = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(208)
                .template("Error writing metrics response")
                .build();

        public static final LogRecord ERROR_COLLECTING_METRICS = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(209)
                .template("Error collecting metrics")
                .build();

        public static final LogRecord FAILED_SEND_METRICS_ERROR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(210)
                .template("Failed to send error response")
                .build();

        public static final LogRecord FAILED_JWKS_REQUEST = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(211)
                .template("Failed to handle JWKS validation request for path: %s")
                .build();

        public static final LogRecord FAILED_FETCH_PROCESSOR_CONFIG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(212)
                .template("Failed to fetch processor configuration for %s")
                .build();

        public static final LogRecord FAILED_CREATE_TOKEN_VALIDATOR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(213)
                .template("Failed to create TokenValidator for processor %s")
                .build();

        public static final LogRecord UNEXPECTED_VALIDATION_ERROR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(214)
                .template("Unexpected error during token validation for processor %s")
                .build();

        public static final LogRecord GATEWAY_PROXY_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(215)
                .template("Gateway proxy request failed for processor %s")
                .build();

        public static final LogRecord GATEWAY_PORT_RESOLUTION_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(216)
                .template("Failed to resolve gateway port for processor %s")
                .build();
    }
}
