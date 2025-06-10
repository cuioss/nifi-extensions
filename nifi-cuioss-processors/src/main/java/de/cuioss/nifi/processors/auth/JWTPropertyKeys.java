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
    }
}