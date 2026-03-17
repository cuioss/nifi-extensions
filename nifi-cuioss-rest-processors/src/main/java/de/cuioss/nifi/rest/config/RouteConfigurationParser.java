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
import de.cuioss.tools.string.Splitter;
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
 *   <li>{@code enabled} — whether the route is active (default: true)</li>
 *   <li>{@code methods} — comma-separated HTTP methods (default: GET,POST,PUT,DELETE)</li>
 *   <li>{@code required-roles} — comma-separated roles</li>
 *   <li>{@code required-scopes} — comma-separated scopes</li>
 *   <li>{@code schema} — optional file path to a JSON Schema file for request body validation</li>
 *   <li>{@code success-outcome} — NiFi relationship name; required for routes with create-flowfile=true, auto-populated with route name when absent</li>
 *   <li>{@code create-flowfile} — whether to create a FlowFile for this route (default: true)</li>
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
    /** Property key for JSON Schema file path. */
    static final String SCHEMA_KEY = "schema";
    /** Property key for enabled flag. */
    static final String ENABLED_KEY = "enabled";
    /** Property key for NiFi relationship name override. */
    static final String SUCCESS_OUTCOME_KEY = "success-outcome";
    /** Property key for FlowFile creation flag. */
    static final String CREATE_FLOWFILE_KEY = "create-flowfile";
    /** Property key for authentication mode. */
    static final String AUTH_MODE_KEY = "auth-mode";
    /** Property key for per-route maximum request body size. */
    static final String MAX_REQUEST_SIZE_KEY = "max-request-size";
    /** Property key for request tracking mode. */
    static final String TRACKING_MODE_KEY = "tracking-mode";
    /** Property key for minimum number of attachments. */
    static final String ATTACHMENTS_MIN_COUNT_KEY = "attachments-min-count";
    /** Property key for maximum number of attachments. */
    static final String ATTACHMENTS_MAX_COUNT_KEY = "attachments-max-count";

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

            boolean enabled = !"false".equalsIgnoreCase(routeProps.get(ENABLED_KEY));
            Set<String> methods = parseHttpMethods(routeProps.get(METHODS_KEY));
            Set<String> roles = parseCommaSeparated(routeProps.get(REQUIRED_ROLES_KEY));
            Set<String> scopes = parseCommaSeparated(routeProps.get(REQUIRED_SCOPES_KEY));
            String schema = routeProps.get(SCHEMA_KEY);
            String successOutcome = routeProps.get(SUCCESS_OUTCOME_KEY);
            boolean createFlowFile = !"false".equalsIgnoreCase(routeProps.get(CREATE_FLOWFILE_KEY));
            if ((successOutcome == null || successOutcome.isBlank()) && createFlowFile) {
                successOutcome = routeName;
            }
            String authModeRaw = routeProps.get(AUTH_MODE_KEY);
            Set<AuthMode> authModes;
            if (authModeRaw == null || authModeRaw.isBlank()) {
                authModes = EnumSet.of(AuthMode.BEARER);
            } else {
                try {
                    authModes = AuthMode.fromValues(authModeRaw);
                } catch (IllegalArgumentException e) {
                    LOGGER.warn("Route '%s' has invalid auth-mode '%s', defaulting to BEARER: %s",
                            routeName, authModeRaw, e.getMessage());
                    authModes = EnumSet.of(AuthMode.BEARER);
                }
            }
            int maxRequestSize = parsePositiveInt(routeProps.get(MAX_REQUEST_SIZE_KEY), 0);
            TrackingMode trackingMode = parseTrackingMode(routeProps.get(TRACKING_MODE_KEY));
            int attachmentsMinCount = parseNonNegativeInt(routeProps.get(ATTACHMENTS_MIN_COUNT_KEY), 0);
            int attachmentsMaxCount = parseNonNegativeInt(routeProps.get(ATTACHMENTS_MAX_COUNT_KEY), 0);

            if (authModes.contains(AuthMode.NONE) && (!roles.isEmpty() || !scopes.isEmpty())) {
                LOGGER.warn("Route '%s' has auth-mode=none but also has roles/scopes configured — "
                        + "roles and scopes will be ignored", routeName);
            }

            routes.add(RouteConfiguration.builder()
                    .name(routeName).path(path).enabled(enabled)
                    .methods(methods).requiredRoles(roles).requiredScopes(scopes)
                    .schemaPath(schema).successOutcome(successOutcome).createFlowFile(createFlowFile)
                    .authModes(authModes).maxRequestSize(maxRequestSize)
                    .trackingMode(trackingMode)
                    .attachmentsMinCount(attachmentsMinCount)
                    .attachmentsMaxCount(attachmentsMaxCount)
                    .build());
            LOGGER.debug("Parsed route '%s': path=%s, enabled=%s, methods=%s, authModes=%s",
                    routeName, path, enabled, methods, authModes);
        }

        return Collections.unmodifiableList(routes);
    }

    private static Set<String> parseHttpMethods(String value) {
        if (value == null || value.isBlank()) {
            return Set.of();
        }
        return Splitter.on(',').trimResults().omitEmptyStrings().splitToList(value)
                .stream()
                .map(String::toUpperCase)
                .collect(Collectors.toUnmodifiableSet());
    }

    private static Set<String> parseCommaSeparated(String value) {
        if (value == null || value.isBlank()) {
            return Set.of();
        }
        return Set.copyOf(Splitter.on(',').trimResults().omitEmptyStrings().splitToList(value));
    }

    private static int parsePositiveInt(String value, int defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            int parsed = Integer.parseInt(value.strip());
            return parsed > 0 ? parsed : defaultValue;
        } catch (NumberFormatException e) {
            LOGGER.warn("Invalid integer value '%s', using default %d", value, defaultValue);
            return defaultValue;
        }
    }

    private static int parseNonNegativeInt(String value, int defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            int parsed = Integer.parseInt(value.strip());
            return parsed >= 0 ? parsed : defaultValue;
        } catch (NumberFormatException e) {
            LOGGER.warn("Invalid integer value '%s', using default %d", value, defaultValue);
            return defaultValue;
        }
    }

    private static TrackingMode parseTrackingMode(String value) {
        if (value == null || value.isBlank()) {
            return TrackingMode.NONE;
        }
        try {
            return TrackingMode.valueOf(value.strip().toUpperCase());
        } catch (IllegalArgumentException e) {
            LOGGER.warn("Invalid tracking-mode '%s', defaulting to NONE", value);
            return TrackingMode.NONE;
        }
    }
}
