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
package de.cuioss.nifi.jwt.util;

import lombok.experimental.UtilityClass;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Generic parser for prefix-based grouped dynamic properties.
 * <p>
 * Properties following the pattern {@code prefix.groupName.property} are grouped
 * into a {@code Map<groupName, Map<property, value>>}. This utility is shared
 * across issuer configuration parsing and REST API route configuration parsing.
 * <p>
 * Example: given prefix {@code "restapi."} and properties:
 * <pre>
 *   restapi.health.path = /api/health
 *   restapi.health.methods = GET
 *   restapi.users.path = /api/users
 * </pre>
 * The result is:
 * <pre>
 *   { "health" -> { "path" -> "/api/health", "methods" -> "GET" },
 *     "users"  -> { "path" -> "/api/users" } }
 * </pre>
 */
@UtilityClass
public class DynamicPropertyGroupParser {

    /**
     * Groups properties by prefix: {@code prefix.groupName.property} into
     * {@code Map<groupName, Map<property, value>>}.
     * <p>
     * Properties that do not start with the given prefix are ignored.
     * Properties that match the prefix but have no dot after the group name
     * (e.g. {@code "restapi.health"} without a trailing {@code .property})
     * are also ignored.
     * <p>
     * When a property name contains multiple dots after the group name,
     * everything after the first dot is treated as the property key
     * (e.g. {@code "restapi.users.some.nested.key"} yields group {@code "users"}
     * with property {@code "some.nested.key"}).
     *
     * @param prefix     the property name prefix including trailing dot (e.g. {@code "issuer."})
     * @param properties the flat property map to parse (must not be null)
     * @return a mutable grouped map; never null
     */
    public static Map<String, Map<String, String>> parse(String prefix, Map<String, String> properties) {
        Objects.requireNonNull(prefix, "prefix must not be null");
        Objects.requireNonNull(properties, "properties must not be null");

        Map<String, Map<String, String>> groups = new HashMap<>();

        for (Map.Entry<String, String> entry : properties.entrySet()) {
            String propertyName = entry.getKey();
            if (!propertyName.startsWith(prefix)) {
                continue;
            }
            String remainder = propertyName.substring(prefix.length());
            int dotIndex = remainder.indexOf('.');
            if (dotIndex <= 0) {
                // No dot found or dot is the first character — skip
                continue;
            }
            String groupName = remainder.substring(0, dotIndex);
            String property = remainder.substring(dotIndex + 1);
            groups.computeIfAbsent(groupName, k -> new HashMap<>())
                    .put(property, entry.getValue());
        }

        return groups;
    }
}
