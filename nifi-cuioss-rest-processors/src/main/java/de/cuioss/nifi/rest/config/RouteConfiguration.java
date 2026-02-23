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

import de.cuioss.nifi.jwt.util.AuthorizationRequirements;
import lombok.NonNull;
import org.jspecify.annotations.Nullable;

import java.util.Objects;
import java.util.Set;

/**
 * Immutable configuration for a single REST API route.
 * <p>
 * Each route defines a URL path, allowed HTTP methods, and optional
 * authorization requirements (roles, scopes). Routes are configured
 * via {@code restapi.<name>.<property>} dynamic properties on the
 * RestApiGateway processor.
 *
 * @param name           the route name (from the property group key)
 * @param path           the URL path (e.g. {@code "/api/users"})
 * @param enabled        whether this route is active (disabled routes are skipped during matching)
 * @param methods        allowed HTTP methods (default: GET,POST,PUT,DELETE)
 * @param requiredRoles  roles the JWT token must carry for this route
 * @param requiredScopes scopes the JWT token must carry for this route
 * @param schemaName     optional JSON Schema name for request body validation
 */
public record RouteConfiguration(
@NonNull String name,
@NonNull String path,
boolean enabled,
Set<String> methods,
Set<String> requiredRoles,
Set<String> requiredScopes,
@Nullable String schemaName) {

    /** Default allowed HTTP methods when none are configured. */
    public static final Set<String> DEFAULT_METHODS = Set.of("GET", "POST", "PUT", "DELETE");

    /**
     * Compact constructor — validates inputs and creates defensive copies.
     */
    public RouteConfiguration {
        Objects.requireNonNull(name, "name must not be null");
        if (path.isBlank()) {
            throw new IllegalArgumentException("path must not be blank");
        }
        methods = methods != null && !methods.isEmpty() ? Set.copyOf(methods) : DEFAULT_METHODS;
        requiredRoles = requiredRoles != null ? Set.copyOf(requiredRoles) : Set.of();
        requiredScopes = requiredScopes != null ? Set.copyOf(requiredScopes) : Set.of();
    }

    /**
     * Whether this route has any authorization requirements (roles or scopes).
     */
    public boolean hasAuthorizationRequirements() {
        return !requiredRoles.isEmpty() || !requiredScopes.isEmpty();
    }

    /**
     * Converts this route's authorization requirements to an {@link AuthorizationRequirements}
     * instance for use with {@link de.cuioss.nifi.jwt.util.AuthorizationValidator}.
     *
     * @return the authorization requirements for this route
     */
    public AuthorizationRequirements toAuthorizationRequirements() {
        return new AuthorizationRequirements(true, requiredRoles, requiredScopes);
    }
}
