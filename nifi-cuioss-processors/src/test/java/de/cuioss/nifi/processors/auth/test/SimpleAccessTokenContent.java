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
package de.cuioss.nifi.processors.auth.test;

import de.cuioss.sheriff.oauth.core.domain.claim.ClaimValue;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.sheriff.oauth.core.json.MapRepresentation;

import java.util.*;

/**
 * Simple test implementation of AccessTokenContent for testing purposes.
 * Replaces Mockito mocks to comply with CUI testing standards.
 */
public class SimpleAccessTokenContent extends AccessTokenContent {

    private final String subject;
    private final List<String> scopes;
    private final List<String> roles;

    public SimpleAccessTokenContent(String subject, List<String> scopes, List<String> roles) {
        super(createClaims(subject, scopes, roles), "test-raw-token", "at+jwt", new MapRepresentation(Collections.emptyMap()));
        this.subject = subject;
        this.scopes = scopes != null ? new ArrayList<>(scopes) : Collections.emptyList();
        this.roles = roles != null ? new ArrayList<>(roles) : Collections.emptyList();
    }

    private static Map<String, ClaimValue> createClaims(String subject, List<String> scopes, List<String> roles) {
        Map<String, ClaimValue> claims = new HashMap<>();

        if (subject != null) {
            claims.put("sub", ClaimValue.forPlainString(subject));
        }

        if (scopes != null && !scopes.isEmpty()) {
            claims.put("scope", ClaimValue.forPlainString(String.join(" ", scopes)));
        }

        if (roles != null && !roles.isEmpty()) {
            claims.put("roles", ClaimValue.forList("roles", roles));
        }

        return claims;
    }

    @Override
    public Optional<String> getSubject() {
        return Optional.ofNullable(subject);
    }

    @Override
    public List<String> getScopes() {
        return new ArrayList<>(scopes);
    }

    @Override
    public List<String> getRoles() {
        return new ArrayList<>(roles);
    }

    public static class Builder {
        private String subject;
        private List<String> scopes = Collections.emptyList();
        private List<String> roles = Collections.emptyList();

        public Builder subject(String subject) {
            this.subject = subject;
            return this;
        }

        public Builder scopes(List<String> scopes) {
            this.scopes = scopes;
            return this;
        }

        public Builder roles(List<String> roles) {
            this.roles = roles;
            return this;
        }

        public SimpleAccessTokenContent build() {
            return new SimpleAccessTokenContent(subject, scopes, roles);
        }
    }
}