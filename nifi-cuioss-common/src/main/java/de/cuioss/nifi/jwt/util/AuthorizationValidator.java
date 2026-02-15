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
import lombok.Builder;
import lombok.Value;
import lombok.experimental.UtilityClass;
import org.jspecify.annotations.Nullable;

import java.util.*;

/**
 * Validates JWT token authorization using the oauth-sheriff API
 * ({@link AccessTokenContent#determineMissingScopes}, {@link AccessTokenContent#determineMissingRoles}).
 * <p>
 * Pure stateless utility — takes a token and requirements, returns a result.
 */
@UtilityClass
public class AuthorizationValidator {

    @Value
    @Builder
    public static class AuthorizationResult {
        boolean authorized;
        @Nullable String reason;
        Set<String> missingScopes;
        Set<String> missingRoles;
    }

    /**
     * Validates whether the given token satisfies the authorization requirements.
     * <p>
     * If no roles or scopes are required, the token is authorized.
     *
     * @param token        the validated access token (must not be null)
     * @param requirements the authorization requirements (must not be null)
     * @return the authorization result
     */
    public static AuthorizationResult validate(AccessTokenContent token, AuthorizationRequirements requirements) {
        Objects.requireNonNull(token, "token must not be null");
        Objects.requireNonNull(requirements, "requirements must not be null");

        if (!requirements.hasAuthorizationRequirements()) {
            return AuthorizationResult.builder()
                    .authorized(true)
                    .missingScopes(Collections.emptySet()).missingRoles(Collections.emptySet())
                    .build();
        }

        Set<String> requiredScopes = requirements.requiredScopes();
        Set<String> requiredRoles = requirements.requiredRoles();

        boolean hasScopeReqs = !requiredScopes.isEmpty();
        boolean hasRoleReqs = !requiredRoles.isEmpty();

        Set<String> missingScopes = hasScopeReqs
                ? token.determineMissingScopes(requiredScopes) : Collections.emptySet();
        Set<String> missingRoles = hasRoleReqs
                ? token.determineMissingRoles(requiredRoles) : Collections.emptySet();

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
