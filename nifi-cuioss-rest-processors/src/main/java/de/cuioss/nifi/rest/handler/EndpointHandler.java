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
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import org.jspecify.annotations.Nullable;

import java.io.IOException;
import java.util.Set;

/**
 * Command-pattern interface for endpoint handlers in the REST API Gateway.
 * <p>
 * The dispatcher ({@link GatewayRequestHandler}) performs shared concerns
 * (sanitization, method check, auth-mode dispatch, authorization, body size check)
 * before delegating to {@link #process(SanitizedRequest, AccessTokenContent, byte[], Request, Response, Callback)}.
 */
public interface EndpointHandler {

    /** Human-readable name for logging and diagnostics. */
    String name();

    /** The URL path this handler is registered for. */
    String path();

    /** Allowed HTTP methods (uppercase, e.g. {@code GET}, {@code POST}). */
    Set<String> methods();

    /** Authentication mode for this endpoint. */
    AuthMode authMode();

    /** Whether this endpoint is currently active. */
    boolean enabled();

    /** Whether this is a built-in (non-removable) endpoint like /health or /metrics. */
    boolean builtIn();

    /** Required JWT roles — empty set means no role check. */
    Set<String> requiredRoles();

    /** Required JWT scopes — empty set means no scope check. */
    Set<String> requiredScopes();

    /**
     * Maximum allowed request body size in bytes.
     * <ul>
     *   <li>{@code 0} means no body expected (GET-only handlers)</li>
     *   <li>Positive value is the per-handler body limit</li>
     * </ul>
     */
    int maxRequestSize();

    /**
     * Processes the request after the dispatcher has completed shared checks:
     * sanitization, method check, auth-mode dispatch, authorization, and body size check.
     *
     * @param sanitized the sanitized request components (path, query params, headers)
     * @param token     the validated JWT token, or {@code null} for unauthenticated requests
     * @param body      the pre-read request body (empty byte array for GET-only handlers)
     * @param request   the raw Jetty request
     * @param response  the Jetty response
     * @param callback  the Jetty callback
     * @throws IOException if an I/O error occurs during response writing
     */
    void process(SanitizedRequest sanitized,
            @Nullable AccessTokenContent token,
            byte[] body,
            Request request, Response response, Callback callback) throws IOException;
}
