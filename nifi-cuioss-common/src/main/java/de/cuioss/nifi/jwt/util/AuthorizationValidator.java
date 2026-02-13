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

import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.tools.logging.CuiLogger;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.UtilityClass;
import org.jspecify.annotations.Nullable;

import java.util.*;

/**
 * Validates JWT token authorization using the oauth-sheriff API
 * ({@link AccessTokenContent#providesScopes}, {@link AccessTokenContent#determineMissingScopes}, etc.).
 */
@UtilityClass
public class AuthorizationValidator {

    private static final CuiLogger LOGGER = new CuiLogger(AuthorizationValidator.class);

    @Value
    @Builder
    public static class AuthorizationConfig {
        @Nullable Set<String> requiredScopes;
        @Nullable Set<String> requiredRoles;
        @Builder.Default boolean bypassAuthorization = false;
    }

    @Value
    @Builder
    public static class AuthorizationResult {
        boolean authorized;
        @Nullable String reason;
        Set<String> missingScopes;
        Set<String> missingRoles;
    }

    public static AuthorizationResult validate(AccessTokenContent token, AuthorizationConfig config) {
        Objects.requireNonNull(token, "token must not be null");
        Objects.requireNonNull(config, "config must not be null");

        if (config.bypassAuthorization) {
            return AuthorizationResult.builder()
                    .authorized(true).reason("Authorization bypassed")
                    .missingScopes(Collections.emptySet()).missingRoles(Collections.emptySet())
                    .build();
        }

        boolean hasScopeReqs = config.requiredScopes != null && !config.requiredScopes.isEmpty();
        boolean hasRoleReqs = config.requiredRoles != null && !config.requiredRoles.isEmpty();

        if (!hasScopeReqs && !hasRoleReqs) {
            return AuthorizationResult.builder()
                    .authorized(true)
                    .missingScopes(Collections.emptySet()).missingRoles(Collections.emptySet())
                    .build();
        }

        Set<String> missingScopes = hasScopeReqs
                ? token.determineMissingScopes(config.requiredScopes) : Collections.emptySet();
        Set<String> missingRoles = hasRoleReqs
                ? token.determineMissingRoles(config.requiredRoles) : Collections.emptySet();

        boolean scopesOk = !hasScopeReqs || missingScopes.isEmpty();
        boolean rolesOk = !hasRoleReqs || missingRoles.isEmpty();
        boolean authorized = scopesOk && rolesOk;

        String reason = null;
        if (!authorized) {
            List<String> reasons = new ArrayList<>();
            if (!scopesOk) reasons.add("Missing scopes: %s".formatted(missingScopes));
            if (!rolesOk) reasons.add("Missing roles: %s".formatted(missingRoles));
            reason = String.join("; ", reasons);
        }

        return AuthorizationResult.builder()
                .authorized(authorized).reason(reason)
                .missingScopes(missingScopes).missingRoles(missingRoles)
                .build();
    }
}
