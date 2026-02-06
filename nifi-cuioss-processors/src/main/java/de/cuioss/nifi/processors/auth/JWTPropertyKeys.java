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
 * DSL-style nested constants for JWT-related property keys.
 * This class organizes all JWT-related property keys in a hierarchical structure
 * for better discoverability and type safety.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/configuration-ui.adoc">UI Configuration Specification</a>
 */
@UtilityClass
public final class JWTPropertyKeys {

    /**
     * Issuer-related property keys.
     */
    @UtilityClass
    public static final class Issuer {
        /**
         * JWKS URL property key.
         */
        public static final String JWKS_URL = "jwks-url";

        /**
         * JWKS file path property key.
         */
        public static final String JWKS_FILE = "jwks-file";

        /**
         * JWKS content property key for in-memory JWKS.
         */
        public static final String JWKS_CONTENT = "jwks-content";

        /**
         * JWKS source type property key.
         */
        public static final String JWKS_TYPE = "jwks-type";

        /**
         * Issuer property key.
         */
        public static final String ISSUER_NAME = "issuer";

        /**
         * Audience property key.
         */
        public static final String AUDIENCE = "audience";

        /**
         * Client ID property key.
         */
        public static final String CLIENT_ID = "client-id";

        /**
         * Required scopes property key.
         */
        public static final String REQUIRED_SCOPES = "required-scopes";

        /**
         * Required roles property key.
         */
        public static final String REQUIRED_ROLES = "required-roles";

        /**
         * Require all scopes property key.
         */
        public static final String REQUIRE_ALL_SCOPES = "require-all-scopes";

        /**
         * Require all roles property key.
         */
        public static final String REQUIRE_ALL_ROLES = "require-all-roles";

        /**
         * Case sensitive matching property key.
         */
        public static final String CASE_SENSITIVE_MATCHING = "case-sensitive-matching";

        /**
         * Bypass authorization property key.
         * Must be explicitly set to true to bypass all authorization checks.
         */
        public static final String BYPASS_AUTHORIZATION = "bypass-authorization";
    }
}