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

/**
 * DSL-style nested constants for JWT-related attribute keys.
 * This class organizes all JWT-related attribute keys in a hierarchical structure
 * for better discoverability and type safety.
 */
@UtilityClass
public final class JWTAttributes {

    /**
     * Basic JWT token attributes.
     */
    @UtilityClass
    public static final class Token {
        /**
         * The extracted JWT token.
         */
        public static final String VALUE = "jwt.token";

        /**
         * Timestamp when the token was extracted.
         */
        public static final String EXTRACTED_AT = "jwt.extractedAt";

        /**
         * The subject claim from the token.
         */
        public static final String SUBJECT = "jwt.subject";

        /**
         * The issuer claim from the token.
         */
        public static final String ISSUER = "jwt.issuer";

        /**
         * The expiration time from the token.
         */
        public static final String EXPIRATION = "jwt.expiration";

        /**
         * Timestamp when the token was validated.
         */
        public static final String VALIDATED_AT = "jwt.validatedAt";

        /**
         * Whether the token passed authorization checks.
         */
        public static final String AUTHORIZATION_PASSED = "jwt.authorization.passed";
    }

    /**
     * JWT token content attributes.
     */
    @UtilityClass
    public static final class Content {
        /**
         * Prefix for all token claims.
         */
        public static final String PREFIX = "jwt.content.";
    }

    /**
     * JWT error attributes.
     */
    @UtilityClass
    public static final class Error {
        /**
         * Error code if token validation failed.
         */
        public static final String CODE = "jwt.error.code";

        /**
         * Error reason if token extraction or validation failed.
         */
        public static final String REASON = "jwt.error.reason";

        /**
         * Error category if token validation failed.
         */
        public static final String CATEGORY = "jwt.error.category";
    }

    /**
     * JWT configuration attributes.
     */
    @UtilityClass
    public static final class Config {
        /**
         * Whether the configuration was refreshed.
         */
        public static final String REFRESHED = "jwt.Config.refreshed";
    }

    /**
     * JWT roles and groups attributes.
     */
    @UtilityClass
    public static final class Authorization {
        /**
         * Comma-separated list of roles.
         */
        public static final String ROLES = "jwt.roles";

        /**
         * Prefix for individual roles with index.
         */
        public static final String ROLES_PREFIX = "jwt.roles.";

        /**
         * Comma-separated list of groups.
         */
        public static final String GROUPS = "jwt.groups";

        /**
         * Prefix for individual groups with index.
         */
        public static final String GROUPS_PREFIX = "jwt.groups.";

        /**
         * Comma-separated list of scopes.
         */
        public static final String SCOPES = "jwt.scopes";

        /**
         * Prefix for individual scopes with index.
         */
        public static final String SCOPES_PREFIX = "jwt.scopes.";

        /**
         * Whether the token is authorized based on scope/role checks.
         */
        public static final String AUTHORIZED = "jwt.authorized";

        /**
         * Whether authorization was bypassed (explicitly configured).
         * BREAKING CHANGE: Added for fail-secure authorization feature.
         */
        public static final String BYPASSED = "jwt.authorization.bypassed";
    }

    /**
     * JWT property descriptors for configuration.
     */
    @UtilityClass
    public static final class Properties {
        /**
         * Basic JWT token properties.
         */
        @UtilityClass
        public static final class Token {
            /**
             * Defines where to extract the token from.
             */
            public static final String LOCATION = "jwt.token.location";

            /**
             * The header name containing the token when using AUTHORIZATION_HEADER.
             */
            public static final String HEADER = "jwt.token.header";

            /**
             * The prefix to strip from the token (e.g., "Bearer ").
             */
            public static final String BEARER_PREFIX = "jwt.bearer.token.prefix";

            /**
             * The custom header name when using CUSTOM_HEADER.
             */
            public static final String CUSTOM_HEADER_NAME = "jwt.custom.header.name";
        }

        /**
         * JWT validation properties.
         */
        @UtilityClass
        public static final class Validation {
            /**
             * Defines where to extract the token from.
             */
            public static final String TOKEN_LOCATION = "jwt.validation.token.location";

            /**
             * The header name containing the token when using AUTHORIZATION_HEADER.
             */
            public static final String TOKEN_HEADER = "jwt.validation.token.header";

            /**
             * The custom header name when using CUSTOM_HEADER.
             */
            public static final String CUSTOM_HEADER_NAME = "jwt.validation.custom.header.name";

            /**
             * The prefix to strip from the token (e.g., "Bearer ").
             */
            public static final String BEARER_TOKEN_PREFIX = "jwt.validation.bearer.token.prefix";

            /**
             * Whether to require a valid token for processing.
             */
            public static final String REQUIRE_VALID_TOKEN = "jwt.validation.require.valid.token";

            /**
             * Interval in seconds for refreshing JWKS keys.
             */
            public static final String JWKS_REFRESH_INTERVAL = "jwt.validation.jwks.refresh.interval";

            /**
             * Maximum token size in bytes.
             */
            public static final String MAXIMUM_TOKEN_SIZE = "jwt.validation.maximum.token.size";

            /**
             * Comma-separated list of allowed JWT signing algorithms.
             */
            public static final String ALLOWED_ALGORITHMS = "jwt.validation.allowed.algorithms";

            /**
             * Whether to require HTTPS for JWKS URLs.
             */
            public static final String REQUIRE_HTTPS_FOR_JWKS = "jwt.validation.require.https.for.jwks";

            /**
             * Timeout in seconds for JWKS endpoint connections.
             */
            public static final String JWKS_CONNECTION_TIMEOUT = "jwt.validation.jwks.connection.timeout";
        }
    }
}