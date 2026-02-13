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

import lombok.experimental.UtilityClass;

/**
 * Shared JWT constants used across NiFi extension modules.
 * Contains generic constants for token location, HTTP headers, and error codes
 * that are not specific to any particular NiFi processor.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/configuration.adoc">Configuration Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/technical-components.adoc">Technical Components Specification</a>
 */
@UtilityClass
public final class JwtConstants {

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
}
