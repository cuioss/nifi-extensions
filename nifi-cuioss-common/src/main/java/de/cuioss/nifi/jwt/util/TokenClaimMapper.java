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

import de.cuioss.nifi.jwt.JWTAttributes;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import lombok.experimental.UtilityClass;

import java.time.Instant;
import java.util.*;

/**
 * Maps a validated {@link AccessTokenContent} to a flat {@code Map<String, String>}
 * of named attributes suitable for FlowFile attributes, HTTP headers, or JSON output.
 * <p>
 * The mapping rules are static and self-contained:
 * <ul>
 *   <li>Standard claims (subject, issuer, expiration) map to dedicated attribute keys</li>
 *   <li>Roles, groups, and scopes map to comma-separated list attributes</li>
 *   <li>Remaining custom claims map to {@code jwt.content.*} prefixed keys</li>
 *   <li>A validation timestamp is always included</li>
 * </ul>
 * <p>
 * Claims that already have dedicated attribute mappings (sub, iss, exp, roles, groups,
 * scope, scopes) are excluded from the custom claims prefix to avoid duplication.
 * <p>
 * This class does <b>not</b> handle routing concerns ({@code jwt.present},
 * {@code jwt.authorized}) — those are the responsibility of the caller.
 *
 * @see JWTAttributes
 * @see AuthorizationValidator
 */
@UtilityClass
public class TokenClaimMapper {

    /**
     * Claim keys that are mapped to dedicated attributes and therefore excluded
     * from the generic {@code jwt.content.*} prefix.
     */
    private static final Set<String> DEDICATED_CLAIM_KEYS = Set.of(
            "sub", "iss", "exp", "roles", "groups", "scope", "scopes"
    );

    /**
     * Extracts claims from a validated {@link AccessTokenContent} into a flat
     * string-to-string map using the attribute keys defined in {@link JWTAttributes}.
     * <p>
     * The returned map is mutable so callers can add additional attributes
     * (e.g., {@code jwt.present}, {@code jwt.authorized}) before applying them.
     *
     * @param token the validated access token (must not be null)
     * @return a mutable map of attribute key to string value
     */
    public static Map<String, String> mapToAttributes(AccessTokenContent token) {
        Objects.requireNonNull(token, "token must not be null");

        Map<String, String> attributes = new HashMap<>();

        // Validation timestamp
        attributes.put(JWTAttributes.Token.VALIDATED_AT, Instant.now().toString());

        // Standard claims
        attributes.put(JWTAttributes.Token.SUBJECT, token.getSubject().orElse(""));
        attributes.put(JWTAttributes.Token.ISSUER, token.getIssuer());
        attributes.put(JWTAttributes.Token.EXPIRATION, token.getExpirationTime().toString());

        // Roles
        List<String> roles = token.getRoles();
        if (!roles.isEmpty()) {
            attributes.put(JWTAttributes.Authorization.ROLES, String.join(",", roles));
        }

        // Groups
        List<String> groups = token.getGroups();
        if (!groups.isEmpty()) {
            attributes.put(JWTAttributes.Authorization.GROUPS, String.join(",", groups));
        }

        // Scopes (only if the claim exists)
        if (token.getClaims().containsKey("scope")) {
            List<String> scopes = token.getScopes();
            if (!scopes.isEmpty()) {
                attributes.put(JWTAttributes.Authorization.SCOPES, String.join(",", scopes));
            }
        }

        // Custom claims (everything not already mapped to a dedicated attribute)
        var tokenClaims = token.getClaims();
        for (var entry : tokenClaims.entrySet()) {
            if (!DEDICATED_CLAIM_KEYS.contains(entry.getKey())) {
                attributes.put(JWTAttributes.Content.PREFIX + entry.getKey(),
                        entry.getValue().getOriginalString());
            }
        }

        return attributes;
    }
}
