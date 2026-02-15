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

import de.cuioss.nifi.jwt.util.DynamicPropertyGroupParser;
import de.cuioss.tools.logging.CuiLogger;
import lombok.experimental.UtilityClass;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Parses {@code restapi.*} dynamic properties into {@link RouteConfiguration} instances.
 * <p>
 * Uses {@link DynamicPropertyGroupParser} to group properties by route name,
 * then maps each group to a validated {@link RouteConfiguration}.
 * <p>
 * Supported properties per route:
 * <ul>
 *   <li>{@code path} — required URL path</li>
 *   <li>{@code methods} — comma-separated HTTP methods (default: GET,POST,PUT,DELETE)</li>
 *   <li>{@code required-roles} — comma-separated roles</li>
 *   <li>{@code required-scopes} — comma-separated scopes</li>
 *   <li>{@code schema} — optional JSON Schema name</li>
 * </ul>
 */
@UtilityClass
public class RouteConfigurationParser {

    private static final CuiLogger LOGGER = new CuiLogger(RouteConfigurationParser.class);

    /** Dynamic property prefix for route configuration. */
    public static final String ROUTE_PREFIX = "restapi.";

    /** Property key for the URL path. */
    static final String PATH_KEY = "path";
    /** Property key for allowed HTTP methods. */
    static final String METHODS_KEY = "methods";
    /** Property key for required roles. */
    static final String REQUIRED_ROLES_KEY = "required-roles";
    /** Property key for required scopes. */
    static final String REQUIRED_SCOPES_KEY = "required-scopes";
    /** Property key for JSON Schema name. */
    static final String SCHEMA_KEY = "schema";

    /**
     * Parses route configurations from the given flat property map.
     *
     * @param properties the flat property map containing {@code restapi.*} entries
     * @return an unmodifiable list of valid route configurations
     */
    public static List<RouteConfiguration> parse(Map<String, String> properties) {
        Objects.requireNonNull(properties, "properties must not be null");

        Map<String, Map<String, String>> groups = DynamicPropertyGroupParser.parse(ROUTE_PREFIX, properties);

        List<RouteConfiguration> routes = new ArrayList<>();
        for (Map.Entry<String, Map<String, String>> entry : groups.entrySet()) {
            String routeName = entry.getKey();
            Map<String, String> routeProps = entry.getValue();

            String path = routeProps.get(PATH_KEY);
            if (path == null || path.isBlank()) {
                LOGGER.warn("Route '%s' has no path configured, skipping", routeName);
                continue;
            }

            Set<String> methods = parseCommaSeparated(routeProps.get(METHODS_KEY));
            Set<String> roles = parseCommaSeparated(routeProps.get(REQUIRED_ROLES_KEY));
            Set<String> scopes = parseCommaSeparated(routeProps.get(REQUIRED_SCOPES_KEY));
            String schema = routeProps.get(SCHEMA_KEY);

            routes.add(new RouteConfiguration(routeName, path, methods, roles, scopes, schema));
            LOGGER.debug("Parsed route '%s': path=%s, methods=%s", routeName, path, methods);
        }

        return Collections.unmodifiableList(routes);
    }

    private static Set<String> parseCommaSeparated(String value) {
        if (value == null || value.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toUpperCase)
                .collect(Collectors.toSet());
    }
}
