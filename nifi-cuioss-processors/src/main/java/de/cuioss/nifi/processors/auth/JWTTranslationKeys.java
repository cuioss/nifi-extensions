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
 * DSL-style nested constants for JWT-related translation keys.
 * This class organizes all JWT-related translation keys in a hierarchical structure
 * for better discoverability and type safety.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/internationalization.adoc">Internationalization Specification</a>
 */
@UtilityClass
public final class JWTTranslationKeys {

    /**
     * Property-related translation keys.
     */
    @UtilityClass
    public static final class Property {
        /**
         * Issuer property translation keys.
         */
        @UtilityClass
        public static final class Issuer {
            /**
             * Dynamic property name format.
             */
            public static final String DYNAMIC_NAME = "property.issuer.dynamic.name";

            /**
             * Dynamic property description format.
             */
            public static final String DYNAMIC_DESCRIPTION = "property.issuer.dynamic.description";

            /**
             * JWKS URL property description format.
             */
            public static final String JWKS_URL_DESCRIPTION = "property.issuer.jwks.url.description";

            /**
             * Issuer property description format.
             */
            public static final String ISSUER_DESCRIPTION = "property.issuer.issuer.description";

            /**
             * Audience property description format.
             */
            public static final String AUDIENCE_DESCRIPTION = "property.issuer.audience.description";

            /**
             * Client ID property description format.
             */
            public static final String CLIENT_ID_DESCRIPTION = "property.issuer.client.id.description";
        }
    }

    /**
     * Validation-related translation keys.
     */
    @UtilityClass
    public static final class Validation {
        /**
         * Issuer validation translation keys.
         */
        @UtilityClass
        public static final class Issuer {
            /**
             * Missing JWKS URL validation message.
             */
            public static final String MISSING_JWKS = "validation.issuer.missing.jwks";

            /**
             * Invalid JWKS URL validation message.
             */
            public static final String INVALID_URL = "validation.issuer.invalid.url";

            /**
             * HTTPS required for JWKS URL validation message.
             */
            public static final String REQUIRES_HTTPS = "validation.issuer.requires.https";

            /**
             * Missing issuer validation message.
             */
            public static final String MISSING_ISSUER = "validation.issuer.missing.issuer";
        }
    }

    /**
     * Error-related translation keys.
     */
    @UtilityClass
    public static final class Error {
        /**
         * No token found error message.
         */
        public static final String NO_TOKEN_FOUND = "error.no.token.found";

        /**
         * Token size limit exceeded error message.
         */
        public static final String TOKEN_SIZE_LIMIT = "error.token.size.limit";

        /**
         * Malformed token error message.
         */
        public static final String TOKEN_MALFORMED = "error.token.malformed";

        /**
         * Token validation failed error message.
         */
        public static final String TOKEN_VALIDATION_FAILED = "error.token.validation.failed";

        /**
         * Unknown error message.
         */
        public static final String UNKNOWN = "error.unknown";
    }
}