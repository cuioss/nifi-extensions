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

import de.cuioss.http.forwarded.ForwardedHeaderResolver;
import de.cuioss.http.forwarded.ForwardedResolverConfig;
import de.cuioss.http.forwarded.ResolvedForwarding;
import de.cuioss.http.security.config.SecurityConfiguration;
import de.cuioss.http.security.monitoring.SecurityEventCounter;

import java.util.Locale;
import java.util.Set;
import java.util.function.Function;

/**
 * Configured wrapper over the cui-http {@link ForwardedHeaderResolver} that resolves the full
 * reverse-proxy / forwarded-header family — honored scheme, host, port, context-path prefix, and
 * client IP — into a single sanitized {@link ResolvedForwarding}.
 *
 * <p>This is the single seam through which the UI servlet, the REST processors, and the
 * integration tests obtain forwarded-header resolution, so the trust model, header precedence, and
 * injection guards live in exactly one place (delegated to cui-http {@code de.cuioss.http.forwarded}).
 *
 * <p><strong>Secure-by-default.</strong> Built from the four project config inputs, the wrapper
 * honors nothing unless the deployment opts in: {@code trustAll} enables the sanitized
 * scheme/host/port and any sanitized context-path; {@code allowedContextPaths} honors specific
 * normalized prefixes even when {@code trustAll} is {@code false} (mirroring NiFi's
 * {@code nifi.web.proxy.context.path}); {@code trustedProxies} (CIDR/IP) gates
 * {@code X-Forwarded-For} client-IP resolution. With no opt-in the resolver returns
 * {@link ResolvedForwarding#empty()}.
 *
 * <p><strong>Trusted network placement is mandatory.</strong> The resolver trusts HTTP headers, not
 * the socket peer; the deployment MUST guarantee that only trusted proxies can connect directly.
 * See {@link ForwardedHeaderResolver} for the full security precondition.
 *
 * <p>Instances are immutable and thread-safe.
 */
public final class ForwardedRequestResolver {

    private static final String PRESET_STRICT = "strict";
    private static final String PRESET_LENIENT = "lenient";
    private static final String PRESET_DEFAULTS = "defaults";

    private final ForwardedHeaderResolver resolver;

    private ForwardedRequestResolver(ForwardedHeaderResolver resolver) {
        this.resolver = resolver;
    }

    /**
     * The secure-by-default resolver: honors nothing (no context-path allowlist, no trust-all, no
     * trusted proxies) with the {@code defaults} sanitization preset. Equivalent to
     * {@code create(false, Set.of(), Set.of(), "defaults")}.
     *
     * @return an immutable resolver that honors no forwarded value
     */
    public static ForwardedRequestResolver secureDefault() {
        return create(false, Set.of(), Set.of(), PRESET_DEFAULTS);
    }

    /**
     * Builds a resolver from the project's four config inputs.
     *
     * @param trustAll             honor the sanitized scheme / host / port and any sanitized
     *                             context-path (use only behind a fully trusted proxy)
     * @param allowedContextPaths  normalized context paths honored even when {@code trustAll} is
     *                             {@code false}; {@code null} or empty honors no context path.
     *                             Callers typically produce this via
     *                             {@link ForwardedResolverConfig#parseAllowlist(String)}
     * @param trustedProxies       CIDR ranges / IP literals defining trusted proxy hops required for
     *                             {@code X-Forwarded-For} client-IP resolution; {@code null} or
     *                             empty honors no client IP
     * @param securityConfigPreset the sanitization-pipeline preset selector — {@code "strict"},
     *                             {@code "lenient"}, or {@code "defaults"} (any other value, or
     *                             {@code null}, falls back to {@code defaults})
     * @return an immutable, configured resolver
     * @throws IllegalArgumentException if a {@code trustedProxies} entry is not a valid IP / CIDR
     */
    public static ForwardedRequestResolver create(boolean trustAll,
            Set<String> allowedContextPaths,
            Set<String> trustedProxies,
            String securityConfigPreset) {
        ForwardedResolverConfig config = ForwardedResolverConfig.builder()
                .trustAll(trustAll)
                .allowedContextPaths(allowedContextPaths == null ? Set.of() : allowedContextPaths)
                .trustedProxies(trustedProxies == null ? Set.of() : trustedProxies)
                .securityConfig(securityConfigFor(securityConfigPreset))
                .build();
        return new ForwardedRequestResolver(new ForwardedHeaderResolver(config, new SecurityEventCounter()));
    }

    /**
     * Resolves the sanitized, honored forwarded-header family from the supplied header accessor.
     *
     * @param headerLookup maps a header name to its value (or {@code null} when absent); typically
     *                     {@code request::getHeader}
     * @return the resolved forwarding view; never {@code null}, {@link ResolvedForwarding#empty()}
     *         when nothing is present or honored
     */
    public ResolvedForwarding resolve(Function<String, String> headerLookup) {
        return resolver.resolve(headerLookup);
    }

    /**
     * Maps a preset selector string onto the cui-http {@link SecurityConfiguration} that drives the
     * header-value sanitization pipeline. Package-visible for direct unit testing.
     *
     * @param preset {@code "strict"}, {@code "lenient"}, or any other value / {@code null}
     * @return {@link SecurityConfiguration#strict()}, {@link SecurityConfiguration#lenient()}, or
     *         {@link SecurityConfiguration#defaults()} for unknown / {@code null} presets
     */
    static SecurityConfiguration securityConfigFor(String preset) {
        if (preset == null) {
            return SecurityConfiguration.defaults();
        }
        return switch (preset.strip().toLowerCase(Locale.ROOT)) {
            case PRESET_STRICT -> SecurityConfiguration.strict();
            case PRESET_LENIENT -> SecurityConfiguration.lenient();
            default -> SecurityConfiguration.defaults();
        };
    }
}
