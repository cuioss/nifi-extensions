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
package de.cuioss.nifi.rest.config;

import java.util.Locale;

/**
 * Defines the authentication mode for an endpoint.
 * <ul>
 *   <li>{@link #BEARER} — JWT Bearer token required (default for user routes)</li>
 *   <li>{@link #NONE} — no authentication required (anonymous access)</li>
 *   <li>{@link #LOCAL_ONLY} — loopback requests bypass auth; remote requests need JWT
 *       (default for management endpoints)</li>
 * </ul>
 */
public enum AuthMode {

    /** JWT Bearer token required. */
    BEARER("bearer"),

    /** No authentication — anonymous access. */
    NONE("none"),

    /** Loopback bypass; remote requests require JWT Bearer token. */
    LOCAL_ONLY("local-only");

    private final String value;

    AuthMode(String value) {
        this.value = value;
    }

    /**
     * Returns the lowercase string representation used in configuration properties.
     */
    public String getValue() {
        return value;
    }

    /**
     * Parses a string value to an {@link AuthMode}, case-insensitive.
     * Returns {@link #BEARER} for {@code null}, blank, or unrecognized values.
     *
     * @param value the string to parse
     * @return the matching auth mode, or {@link #BEARER} as default
     */
    public static AuthMode fromValue(String value) {
        if (value == null || value.isBlank()) {
            return BEARER;
        }
        String normalized = value.strip().toLowerCase(Locale.ROOT);
        for (AuthMode mode : values()) {
            if (mode.value.equals(normalized)) {
                return mode;
            }
        }
        return BEARER;
    }
}
