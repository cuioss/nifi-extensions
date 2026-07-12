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

import de.cuioss.http.forwarded.ResolvedForwarding;

import java.util.Map;

/**
 * Holds the security-validated and normalized HTTP request components.
 * <p>
 * All values have been processed through the cui-http security validation
 * pipelines, which normalize encoding, detect attack patterns, and sanitize
 * the input. Downstream processing should use these normalized values
 * instead of raw request data.
 * <p>
 * {@code pathParameters} carries the values extracted from a matched
 * {@code {placeholder}} route. It is empty for exact/prefix-matched routes and
 * is attached after route resolution via {@link #withPathParameters(Map)}, since
 * the sanitized request is built before the handler is resolved.
 *
 * <p>{@code forwarding} is the honored reverse-proxy / forwarded view — resolved once,
 * at sanitization time, by the {@code ForwardedRequestResolver} against the operator's
 * trust model. Each field is present only when the deployment opted in (allowlist,
 * trust-all, or trusted-proxies); absent/un-honored fields are empty (secure by default).
 * Downstream consumers use the honored context-path (via {@link #proxyContextPath()}) to
 * strip the prefix before routing and to prepend it to generated URLs (202 {@code Location},
 * HATEOAS {@code _links}), the honored scheme/host/port to reflect the reverse-proxy-facing
 * URL, and the honored client IP for audit / rate-limit logging.
 *
 * @param path            the normalized URL path
 * @param queryParameters the normalized query parameter values (keys preserved, values sanitized)
 * @param headers         the normalized header values (Authorization excluded, values sanitized)
 * @param forwarding      the honored reverse-proxy / forwarded view (never {@code null};
 *                        {@link ResolvedForwarding#empty()} when nothing is honored)
 * @param pathParameters  the path parameters extracted from a pattern-matched route (empty otherwise)
 */
record SanitizedRequest(
String path,
Map<String, String> queryParameters,
Map<String, String> headers,
ResolvedForwarding forwarding,
Map<String, String> pathParameters) {

    SanitizedRequest {
        forwarding = forwarding == null ? ResolvedForwarding.empty() : forwarding;
        pathParameters = pathParameters == null ? Map.of() : Map.copyOf(pathParameters);
    }

    /**
     * The allowlist / trust-honored, normalized reverse-proxy context prefix ({@code ""} when no
     * proxy header is present or the client-supplied prefix is not honored). Convenience accessor
     * over {@link #forwarding()}.
     *
     * @return the honored context-path prefix, or {@code ""} when none is honored
     */
    String proxyContextPath() {
        return forwarding.contextPath();
    }

    /**
     * Returns a copy of this request with the given path parameters attached.
     *
     * @param extractedPathParameters the parameters extracted from the matched route
     * @return a new immutable {@code SanitizedRequest} carrying the path parameters
     */
    SanitizedRequest withPathParameters(Map<String, String> extractedPathParameters) {
        return new SanitizedRequest(path, queryParameters, headers, forwarding, extractedPathParameters);
    }
}
