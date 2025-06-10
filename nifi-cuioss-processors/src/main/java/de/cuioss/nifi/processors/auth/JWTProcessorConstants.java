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
package de.cuioss.nifi.processors.auth;

import lombok.experimental.UtilityClass;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.processor.Relationship;
import org.apache.nifi.processor.util.StandardValidators;

/**
 * DSL-style nested constants for JWT processor configuration.
 * This class organizes all JWT processor-related constants in a hierarchical structure
 * for better discoverability and type safety.
 */
@UtilityClass
public final class JWTProcessorConstants {

    /**
     * Issuer prefix for dynamic properties.
     */
    public static final String ISSUER_PREFIX = "issuer.";

    /**
     * Log metrics interval - log metrics every 100 flow files.
     */
    public static final long LOG_METRICS_INTERVAL = 100;

    /**
     * Token location values.
     */
    @UtilityClass
    public static final class TokenLocation {
        /**
         * Extract token from Authorization header.
         */
        public static final String AUTHORIZATION_HEADER = "AUTHORIZATION_HEADER";

        /**
         * Extract token from custom header.
         */
        public static final String CUSTOM_HEADER = "CUSTOM_HEADER";

        /**
         * Extract token from flow file content.
         */
        public static final String FLOW_FILE_CONTENT = "FLOW_FILE_CONTENT";
    }

    /**
     * HTTP related constants.
     */
    @UtilityClass
    public static final class Http {
        /**
         * Prefix for HTTP headers in flow file attributes.
         */
        public static final String HEADERS_PREFIX = "http.headers.";

        /**
         * Default Authorization header name.
         */
        public static final String AUTHORIZATION_HEADER = "Authorization";

        /**
         * Bearer token prefix.
         */
        public static final String BEARER_PREFIX = "Bearer ";

        /**
         * HTTP protocol prefix.
         */
        public static final String HTTP_PROTOCOL = "http://";

        /**
         * HTTPS protocol prefix.
         */
        public static final String HTTPS_PROTOCOL = "https://";
    }

    /**
     * Error related constants.
     */
    @UtilityClass
    public static final class Error {
        /**
         * Error codes.
         */
        @UtilityClass
        public static final class Code {
            /**
             * No token found error code.
             */
            public static final String NO_TOKEN_FOUND = "AUTH-001";

            /**
             * Unknown error code.
             */
            public static final String UNKNOWN = "AUTH-999";
        }

        /**
         * Error categories.
         */
        @UtilityClass
        public static final class Category {
            /**
             * Extraction error category.
             */
            public static final String EXTRACTION_ERROR = "EXTRACTION_ERROR";

            /**
             * Processing error category.
             */
            public static final String PROCESSING_ERROR = "PROCESSING_ERROR";
        }
    }

    /**
     * Processor relationships.
     */
    @UtilityClass
    public static final class Relationships {
        /**
         * FlowFiles with valid tokens will be routed to this relationship.
         */
        public static final Relationship SUCCESS = new Relationship.Builder()
                .name("success")
                .description("FlowFiles with valid tokens will be routed to this relationship")
                .build();

        /**
         * FlowFiles with invalid tokens will be routed to this relationship.
         */
        public static final Relationship AUTHENTICATION_FAILED = new Relationship.Builder()
                .name("authentication-failed")
                .description("FlowFiles with invalid tokens will be routed to this relationship")
                .build();

        /**
         * FlowFiles with extraction failures will be routed to this relationship.
         */
        public static final Relationship FAILURE = new Relationship.Builder()
                .name("failure")
                .description("FlowFiles with extraction failures will be routed to this relationship")
                .build();
    }

    /**
     * Property descriptors for processor configuration.
     */
    @UtilityClass
    public static final class Properties {
        /**
         * Defines where to extract the token from.
         */
        public static final PropertyDescriptor TOKEN_LOCATION = new PropertyDescriptor.Builder()
                .name(JWTAttributes.Properties.Validation.TOKEN_LOCATION)
                .displayName("Token Location")
                .description("Defines where to extract the token from")
                .required(true)
                .allowableValues(TokenLocation.AUTHORIZATION_HEADER, TokenLocation.CUSTOM_HEADER, TokenLocation.FLOW_FILE_CONTENT)
                .defaultValue(TokenLocation.AUTHORIZATION_HEADER)
                .build();

        /**
         * The header name containing the token when using AUTHORIZATION_HEADER.
         */
        public static final PropertyDescriptor TOKEN_HEADER = new PropertyDescriptor.Builder()
                .name(JWTAttributes.Properties.Validation.TOKEN_HEADER)
                .displayName("Token Header")
                .description("The header name containing the token when using AUTHORIZATION_HEADER")
                .required(false)
                .defaultValue(Http.AUTHORIZATION_HEADER)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        /**
         * The custom header name when using CUSTOM_HEADER.
         */
        public static final PropertyDescriptor CUSTOM_HEADER_NAME = new PropertyDescriptor.Builder()
                .name(JWTAttributes.Properties.Validation.CUSTOM_HEADER_NAME)
                .displayName("Custom Header Name")
                .description("The custom header name when using CUSTOM_HEADER")
                .required(false)
                .defaultValue("X-Authorization")
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        /**
         * The prefix to strip from the token (e.g., "Bearer ").
         */
        public static final PropertyDescriptor BEARER_TOKEN_PREFIX = new PropertyDescriptor.Builder()
                .name(JWTAttributes.Properties.Validation.BEARER_TOKEN_PREFIX)
                .displayName("Bearer Token Prefix")
                .description("The prefix to strip from the token (e.g., \"Bearer \")")
                .required(false)
                .defaultValue("Bearer")
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        /**
         * Whether to require a valid token for processing.
         */
        public static final PropertyDescriptor REQUIRE_VALID_TOKEN = new PropertyDescriptor.Builder()
                .name(JWTAttributes.Properties.Validation.REQUIRE_VALID_TOKEN)
                .displayName("Require Valid Token")
                .description("Whether to require a valid token for processing")
                .required(true)
                .defaultValue("true")
                .allowableValues("true", "false")
                .build();

        /**
         * Interval in seconds for refreshing JWKS keys.
         */
        public static final PropertyDescriptor JWKS_REFRESH_INTERVAL = new PropertyDescriptor.Builder()
                .name(JWTAttributes.Properties.Validation.JWKS_REFRESH_INTERVAL)
                .displayName("JWKS Refresh Interval")
                .description("Interval in seconds for refreshing JWKS keys")
                .required(true)
                .defaultValue("3600")
                .addValidator(StandardValidators.POSITIVE_INTEGER_VALIDATOR)
                .build();

        /**
         * Maximum token size in bytes.
         */
        public static final PropertyDescriptor MAXIMUM_TOKEN_SIZE = new PropertyDescriptor.Builder()
                .name(JWTAttributes.Properties.Validation.MAXIMUM_TOKEN_SIZE)
                .displayName("Maximum Token Size")
                .description("Maximum token size in bytes")
                .required(true)
                .defaultValue("16384")
                .addValidator(StandardValidators.POSITIVE_INTEGER_VALIDATOR)
                .build();

        /**
         * Comma-separated list of allowed JWT signing algorithms.
         */
        public static final PropertyDescriptor ALLOWED_ALGORITHMS = new PropertyDescriptor.Builder()
                .name(JWTAttributes.Properties.Validation.ALLOWED_ALGORITHMS)
                .displayName("Allowed Algorithms")
                .description("Comma-separated list of allowed JWT signing algorithms. " +
                        "Recommended secure algorithms: RS256, RS384, RS512, ES256, ES384, ES512, PS256, PS384, PS512. " +
                        "The 'none' algorithm is never allowed regardless of this setting.")
                .required(true)
                .defaultValue("RS256,RS384,RS512,ES256,ES384,ES512,PS256,PS384,PS512")
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        /**
         * Whether to require HTTPS for JWKS URLs.
         */
        public static final PropertyDescriptor REQUIRE_HTTPS_FOR_JWKS = new PropertyDescriptor.Builder()
                .name(JWTAttributes.Properties.Validation.REQUIRE_HTTPS_FOR_JWKS)
                .displayName("Require HTTPS for JWKS URLs")
                .description("Whether to require HTTPS for JWKS URLs. Strongly recommended for production environments.")
                .required(true)
                .defaultValue("true")
                .allowableValues("true", "false")
                .build();

        /**
         * Timeout in seconds for JWKS endpoint connections.
         */
        public static final PropertyDescriptor JWKS_CONNECTION_TIMEOUT = new PropertyDescriptor.Builder()
                .name(JWTAttributes.Properties.Validation.JWKS_CONNECTION_TIMEOUT)
                .displayName("JWKS Connection Timeout")
                .description("Timeout in seconds for JWKS endpoint connections")
                .required(true)
                .defaultValue("10")
                .addValidator(StandardValidators.POSITIVE_INTEGER_VALIDATOR)
                .build();
    }
}
