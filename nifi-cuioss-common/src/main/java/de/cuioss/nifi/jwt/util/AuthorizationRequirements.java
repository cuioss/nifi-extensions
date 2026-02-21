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

import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.processor.ProcessContext;
import org.apache.nifi.processor.util.StandardValidators;
import org.jspecify.annotations.Nullable;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Shared authorization requirements for JWT-secured processors.
 * <p>
 * Models the three per-processor-instance authorization aspects:
 * <ol>
 *   <li>{@code requireValidToken} — whether authentication is required (missing token handling)</li>
 *   <li>{@code requiredRoles} — roles the token must carry</li>
 *   <li>{@code requiredScopes} — scopes the token must carry</li>
 * </ol>
 * Each processor that needs JWT authorization includes
 * {@link #getPropertyDescriptors()} in its supported properties and reads
 * the configuration via {@link #from(ProcessContext)}.
 */
public record AuthorizationRequirements(
boolean requireValidToken,
Set<String> requiredRoles,
Set<String> requiredScopes) {

    /**
     * Compact constructor — defensive copies and null safety.
     */
    public AuthorizationRequirements {
        requiredRoles = requiredRoles != null ? Set.copyOf(requiredRoles) : Set.of();
        requiredScopes = requiredScopes != null ? Set.copyOf(requiredScopes) : Set.of();
    }

    /**
     * Whether any authorization check is configured (roles or scopes).
     * If false, the processor should skip the authorization step entirely.
     */
    public boolean hasAuthorizationRequirements() {
        return !requiredRoles.isEmpty() || !requiredScopes.isEmpty();
    }

    // --- NiFi PropertyDescriptors (shared across all JWT-secured processors) ---

    /**
     * Whether a valid token is required for processing.
     * When false, flow files without a token are routed to SUCCESS.
     */
    public static final PropertyDescriptor REQUIRE_VALID_TOKEN = new PropertyDescriptor.Builder()
            .name("jwt.validation.require.valid.token")
            .displayName("Require Valid Token")
            .description("Whether to require a valid token for processing. "
                    + "When false, flow files without a token are routed to success.")
            .required(true)
            .defaultValue("true")
            .allowableValues("true", "false")
            .build();

    /**
     * Comma-separated list of roles the token must carry.
     * If empty, no role check is performed.
     */
    public static final PropertyDescriptor REQUIRED_ROLES = new PropertyDescriptor.Builder()
            .name("jwt.authorization.required.roles")
            .displayName("Required Roles")
            .description("Comma-separated list of roles the token must carry. "
                    + "If empty, no role check is performed.")
            .required(false)
            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
            .build();

    /**
     * Comma-separated list of scopes the token must carry.
     * If empty, no scope check is performed.
     */
    public static final PropertyDescriptor REQUIRED_SCOPES = new PropertyDescriptor.Builder()
            .name("jwt.authorization.required.scopes")
            .displayName("Required Scopes")
            .description("Comma-separated list of scopes the token must carry. "
                    + "If empty, no scope check is performed.")
            .required(false)
            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
            .build();

    /**
     * Returns the authorization PropertyDescriptors for inclusion in a processor's
     * {@code getSupportedPropertyDescriptors()}.
     */
    public static List<PropertyDescriptor> getPropertyDescriptors() {
        return List.of(REQUIRE_VALID_TOKEN, REQUIRED_ROLES, REQUIRED_SCOPES);
    }

    /**
     * Reads authorization requirements from a NiFi {@link ProcessContext}.
     *
     * @param context the processor's process context
     * @return the parsed authorization requirements
     */
    public static AuthorizationRequirements from(ProcessContext context) {
        boolean requireValid = context.getProperty(REQUIRE_VALID_TOKEN).asBoolean();
        Set<String> roles = parseCommaSeparated(context.getProperty(REQUIRED_ROLES).getValue());
        Set<String> scopes = parseCommaSeparated(context.getProperty(REQUIRED_SCOPES).getValue());
        return new AuthorizationRequirements(requireValid, roles, scopes);
    }

    private static Set<String> parseCommaSeparated(@Nullable String value) {
        if (value == null || value.isBlank()) {
            return Collections.emptySet();
        }
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }
}
