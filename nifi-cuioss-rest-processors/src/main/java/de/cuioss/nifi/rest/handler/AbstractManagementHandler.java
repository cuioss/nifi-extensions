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
package de.cuioss.nifi.rest.handler;

import de.cuioss.nifi.rest.config.AuthMode;

import java.util.Set;

/**
 * Base class for built-in management endpoint handlers ({@code /health}, {@code /metrics}).
 * Provides shared implementation of {@link EndpointHandler} properties that are
 * identical across all management endpoints: GET-only, built-in, no authorization
 * requirements, no request body.
 */
abstract non-sealed class AbstractManagementHandler implements EndpointHandler {

    private final boolean enabled;
    private final Set<AuthMode> authModes;
    private final Set<String> requiredRoles;
    private final Set<String> requiredScopes;

    AbstractManagementHandler(boolean enabled, Set<AuthMode> authModes,
            Set<String> requiredRoles, Set<String> requiredScopes) {
        this.enabled = enabled;
        this.authModes = authModes;
        this.requiredRoles = requiredRoles;
        this.requiredScopes = requiredScopes;
    }

    @Override
    public Set<String> methods() {
        return Set.of("GET");
    }

    @Override
    public Set<AuthMode> authModes() {
        return authModes;
    }

    @Override
    public boolean enabled() {
        return enabled;
    }

    @Override
    public boolean builtIn() {
        return true;
    }

    @Override
    public Set<String> requiredRoles() {
        return requiredRoles;
    }

    @Override
    public Set<String> requiredScopes() {
        return requiredScopes;
    }

    @Override
    public int maxRequestSize() {
        return 0;
    }
}
