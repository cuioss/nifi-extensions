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
package de.cuioss.nifi.processors.auth.util;

import de.cuioss.nifi.processors.auth.AuthLogMessages;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.tools.logging.CuiLogger;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.UtilityClass;
import org.jspecify.annotations.Nullable;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Utility class for validating JWT token authorization based on scopes and roles.
 * This class provides functionality to validate if a token has the required scopes
 * and/or roles for authorization.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/technical-components.adoc">Technical Components Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/token-validation.adoc">Token Validation Specification</a>
 */
@UtilityClass
public class AuthorizationValidator {

    private static final CuiLogger LOGGER = new CuiLogger(AuthorizationValidator.class);

    /**
     * Configuration for authorization validation.
     */
    @Value
    @Builder
    public static class AuthorizationConfig {
        /**
         * Required scopes for authorization. At least one must be present in the token.
         * Can be null or empty if no scope validation is required.
         */
        @Nullable Set<String> requiredScopes;

        /**
         * Required roles for authorization. At least one must be present in the token.
         * Can be null or empty if no role validation is required.
         */
        @Nullable Set<String> requiredRoles;

        /**
         * Whether all required scopes must be present (AND) or at least one (OR).
         * Default is false (OR logic).
         */
        @Builder.Default boolean requireAllScopes = false;

        /**
         * Whether all required roles must be present (AND) or at least one (OR).
         * Default is false (OR logic).
         */
        @Builder.Default boolean requireAllRoles = false;

        /**
         * Whether to perform case-sensitive matching for scopes and roles.
         * Default is true (case-sensitive).
         */
        @Builder.Default boolean caseSensitive = true;

        /**
         * Explicit bypass flag to disable authorization entirely.
         * Must be explicitly set to true to bypass all authorization checks.
         * Default is false (authorization required).
         */
        @Builder.Default boolean bypassAuthorization = false;
    }

    /**
     * Result of authorization validation.
     */
    @Value
    @Builder
    public static class AuthorizationResult {
        /**
         * Whether the authorization check passed.
         */
        boolean authorized;

        /**
         * Reason for authorization failure, if any.
         */
        @Nullable String reason;

        /**
         * Matched scopes from the token.
         */
        Set<String> matchedScopes;

        /**
         * Matched roles from the token.
         */
        Set<String> matchedRoles;

        /**
         * Missing scopes that were required but not found.
         */
        Set<String> missingScopes;

        /**
         * Missing roles that were required but not found.
         */
        Set<String> missingRoles;
    }

    /**
     * Validates if the token meets the authorization requirements.
     *
     * @param token  The access token to validate
     * @param config The authorization configuration
     * @return The authorization result
     */
    public static AuthorizationResult validate(AccessTokenContent token, AuthorizationConfig config) {
        Objects.requireNonNull(token, "token must not be null");
        Objects.requireNonNull(config, "config must not be null");
        LOGGER.debug("Validating authorization for token with subject: %s", token.getSubject().orElse("unknown"));

        // Explicit bypass required to skip authorization
        if (config.bypassAuthorization) {
            LOGGER.warn(AuthLogMessages.WARN.AUTHORIZATION_BYPASS_SECURITY_WARNING,
                    token.getSubject().orElse("unknown"));
            return AuthorizationResult.builder()
                    .authorized(true)
                    .reason("Authorization bypassed")
                    .matchedScopes(Collections.emptySet())
                    .matchedRoles(Collections.emptySet())
                    .missingScopes(Collections.emptySet())
                    .missingRoles(Collections.emptySet())
                    .build();
        }

        // If no scopes AND no roles are configured, validation passes
        boolean hasScopeRequirements = config.requiredScopes != null && !config.requiredScopes.isEmpty();
        boolean hasRoleRequirements = config.requiredRoles != null && !config.requiredRoles.isEmpty();

        if (!hasScopeRequirements && !hasRoleRequirements) {
            return AuthorizationResult.builder()
                    .authorized(true)
                    .reason(null)
                    .matchedScopes(Collections.emptySet())
                    .matchedRoles(Collections.emptySet())
                    .missingScopes(Collections.emptySet())
                    .missingRoles(Collections.emptySet())
                    .build();
        }

        // Extract scopes and roles from token
        Set<String> tokenScopes = new HashSet<>(token.getScopes());
        Set<String> tokenRoles = new HashSet<>(token.getRoles());

        // Convert to lowercase if case-insensitive matching
        if (!config.caseSensitive) {
            tokenScopes = tokenScopes.stream()
                    .map(String::toLowerCase)
                    .collect(Collectors.toSet());
            tokenRoles = tokenRoles.stream()
                    .map(String::toLowerCase)
                    .collect(Collectors.toSet());
        }

        // Validate scopes
        ScopeValidationResult scopeResult = validateScopes(tokenScopes, config);

        // Validate roles
        RoleValidationResult roleResult = validateRoles(tokenRoles, config);

        // Determine overall authorization result
        boolean isAuthorized = scopeResult.valid() && roleResult.valid();

        // Build reason message if not authorized
        String reason = null;
        if (!isAuthorized) {
            List<String> reasons = new ArrayList<>();
            if (!scopeResult.valid()) {
                reasons.add(scopeResult.reason());
            }
            if (!roleResult.valid()) {
                reasons.add(roleResult.reason());
            }
            reason = String.join("; ", reasons);
        }

        return AuthorizationResult.builder()
                .authorized(isAuthorized)
                .reason(reason)
                .matchedScopes(scopeResult.matchedScopes())
                .matchedRoles(roleResult.matchedRoles())
                .missingScopes(scopeResult.missingScopes())
                .missingRoles(roleResult.missingRoles())
                .build();
    }

    /**
     * Validates scopes against the required configuration.
     */
    private static ScopeValidationResult validateScopes(Set<String> tokenScopes, AuthorizationConfig config) {
        // If no scopes are required, validation passes
        if (config.requiredScopes == null || config.requiredScopes.isEmpty()) {
            return new ScopeValidationResult(true, null, Collections.emptySet(), Collections.emptySet());
        }

        // Normalize required scopes if case-insensitive
        Set<String> requiredScopes = config.requiredScopes;
        if (!config.caseSensitive) {
            requiredScopes = requiredScopes.stream()
                    .map(String::toLowerCase)
                    .collect(Collectors.toSet());
        }

        // Find matching scopes
        Set<String> matchedScopes = new HashSet<>(tokenScopes);
        matchedScopes.retainAll(requiredScopes);

        // Find missing scopes
        Set<String> missingScopes = new HashSet<>(requiredScopes);
        missingScopes.removeAll(tokenScopes);

        // Determine if validation passes
        boolean isValid;
        String reason = null;

        if (config.requireAllScopes) {
            // All required scopes must be present
            isValid = missingScopes.isEmpty();
            if (!isValid) {
                reason = "Missing required scopes: %s".formatted(missingScopes);
            }
        } else {
            // At least one required scope must be present
            isValid = !matchedScopes.isEmpty();
            if (!isValid) {
                reason = "Token has none of the required scopes: %s".formatted(requiredScopes);
            }
        }

        return new ScopeValidationResult(isValid, reason, matchedScopes, missingScopes);
    }

    /**
     * Validates roles against the required configuration.
     */
    private static RoleValidationResult validateRoles(Set<String> tokenRoles, AuthorizationConfig config) {
        // If no roles are required, validation passes
        if (config.requiredRoles == null || config.requiredRoles.isEmpty()) {
            return new RoleValidationResult(true, null, Collections.emptySet(), Collections.emptySet());
        }

        // Normalize required roles if case-insensitive
        Set<String> requiredRoles = config.requiredRoles;
        if (!config.caseSensitive) {
            requiredRoles = requiredRoles.stream()
                    .map(String::toLowerCase)
                    .collect(Collectors.toSet());
        }

        // Find matching roles
        Set<String> matchedRoles = new HashSet<>(tokenRoles);
        matchedRoles.retainAll(requiredRoles);

        // Find missing roles
        Set<String> missingRoles = new HashSet<>(requiredRoles);
        missingRoles.removeAll(tokenRoles);

        // Determine if validation passes
        boolean isValid;
        String reason = null;

        if (config.requireAllRoles) {
            // All required roles must be present
            isValid = missingRoles.isEmpty();
            if (!isValid) {
                reason = "Missing required roles: %s".formatted(missingRoles);
            }
        } else {
            // At least one required role must be present
            isValid = !matchedRoles.isEmpty();
            if (!isValid) {
                reason = "Token has none of the required roles: %s".formatted(requiredRoles);
            }
        }

        return new RoleValidationResult(isValid, reason, matchedRoles, missingRoles);
    }

    /**
     * Internal record for scope validation results.
     */
    private record ScopeValidationResult(boolean valid, @Nullable String reason,
            Set<String> matchedScopes, Set<String> missingScopes) {
    }

    /**
     * Internal record for role validation results.
     */
    private record RoleValidationResult(boolean valid, @Nullable String reason,
            Set<String> matchedRoles, Set<String> missingRoles) {
    }
}