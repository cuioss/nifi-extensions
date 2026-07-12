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

import de.cuioss.http.forwarded.ResolvedForwarding;
import de.cuioss.http.security.config.SecurityConfiguration;
import de.cuioss.test.juli.LogAsserts;
import de.cuioss.test.juli.TestLogLevel;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests for {@link ForwardedRequestResolver}, the configured wrapper over the cui-http
 * {@code ForwardedHeaderResolver}.
 *
 * <p>The wrapper resolves the full forwarded-header family (scheme, host, port, context-path, and
 * client IP) while preserving secure-by-default semantics: nothing is honored unless the deployment
 * opts in via {@code trustAll}, an {@code allowedContextPaths} allowlist, or a {@code trustedProxies}
 * set. Resolution is driven through a plain {@link Map}-backed {@link Function} header accessor (no
 * mocking framework), and the injection guards / rejection logging now live in cui-http.
 */
@EnableTestLogger
@DisplayName("ForwardedRequestResolver tests")
class ForwardedRequestResolverTest {

    private static final String HEADER_PROXY_CONTEXT_PATH = "X-ProxyContextPath";
    private static final String HEADER_FORWARDED_PREFIX = "X-Forwarded-Prefix";
    private static final String HEADER_FORWARDED_PROTO = "X-Forwarded-Proto";
    private static final String HEADER_FORWARDED_HOST = "X-Forwarded-Host";
    private static final String HEADER_FORWARDED_PORT = "X-Forwarded-Port";
    private static final String HEADER_FORWARDED_FOR = "X-Forwarded-For";

    private static final String PRESET_DEFAULTS = "defaults";
    private static final String TRUSTED_PROXY_PRIVATE = "10.0.0.0/8";

    /**
     * Builds a header accessor backed by a plain map: absent header names resolve to {@code null},
     * exactly as {@code HttpServletRequest#getHeader} does.
     */
    private static Function<String, String> headers(Map<String, String> values) {
        return new HashMap<>(values)::get;
    }

    private static ForwardedRequestResolver secureDefaultResolver() {
        return ForwardedRequestResolver.create(false, Set.of(), Set.of(), PRESET_DEFAULTS);
    }

    private static ForwardedRequestResolver trustAllResolver() {
        return ForwardedRequestResolver.create(true, Set.of(), Set.of(), PRESET_DEFAULTS);
    }

    @Nested
    @DisplayName("Context-path resolution")
    class ContextPathResolution {

        @Test
        @DisplayName("Honors nothing under the secure default (no opt-in)")
        void secureDefaultHonorsNothing() {
            var resolver = secureDefaultResolver();
            var lookup = headers(Map.of(HEADER_PROXY_CONTEXT_PATH, "/nifi-proxy"));

            assertEquals("", resolver.resolve(lookup).contextPath(),
                    "Without any opt-in nothing is honored");
        }

        @Test
        @DisplayName("Honors an allowlisted prefix even when trustAll is false")
        void honorsAllowlistedPrefix() {
            var resolver = ForwardedRequestResolver.create(false, Set.of("/nifi-proxy"), Set.of(), PRESET_DEFAULTS);
            var lookup = headers(Map.of(HEADER_PROXY_CONTEXT_PATH, "/nifi-proxy"));

            assertEquals("/nifi-proxy", resolver.resolve(lookup).contextPath(),
                    "An allowlisted prefix must be honored");
        }

        @Test
        @DisplayName("Ignores a spoofed prefix that is not in the allowlist")
        void ignoresNonAllowlistedPrefix() {
            var resolver = ForwardedRequestResolver.create(false, Set.of("/nifi-proxy"), Set.of(), PRESET_DEFAULTS);
            var lookup = headers(Map.of(HEADER_PROXY_CONTEXT_PATH, "/attacker"));

            assertEquals("", resolver.resolve(lookup).contextPath(),
                    "A prefix absent from the allowlist must not be honored");
        }

        @Test
        @DisplayName("Honors any clean prefix under trustAll")
        void trustAllHonorsAnyPrefix() {
            var resolver = trustAllResolver();
            var lookup = headers(Map.of(HEADER_PROXY_CONTEXT_PATH, "/anything/"));

            assertEquals("/anything", resolver.resolve(lookup).contextPath(),
                    "Under trustAll a clean prefix is honored and normalized (trailing slash stripped)");
        }

        @Test
        @DisplayName("X-ProxyContextPath wins over the X-Forwarded-Prefix fallback")
        void proxyContextPathPrecedence() {
            var resolver = trustAllResolver();
            var lookup = headers(Map.of(
                    HEADER_PROXY_CONTEXT_PATH, "/primary",
                    HEADER_FORWARDED_PREFIX, "/secondary"));

            assertEquals("/primary", resolver.resolve(lookup).contextPath(),
                    "The most specific header must win");
        }
    }

    @Nested
    @DisplayName("Injection guard (delegated to cui-http)")
    class InjectionGuard {

        @ParameterizedTest(name = "control character U+{0} is rejected")
        @ValueSource(ints = {0x00, 0x09, 0x0A, 0x0D, 0x1B, 0x7F})
        @DisplayName("Rejects a value carrying any embedded control character")
        void rejectsControlCharacter(int controlChar) {
            var resolver = trustAllResolver();
            var raw = "/app" + (char) controlChar + "Set-Cookie: x=1";
            var lookup = headers(Map.of(HEADER_PROXY_CONTEXT_PATH, raw));

            assertEquals("", resolver.resolve(lookup).contextPath(),
                    "A value carrying a control character must resolve to empty");
        }

        @Test
        @DisplayName("Rejects a CR/LF injection sequence and warns")
        void rejectsCrlfInjectionAndWarns() {
            var resolver = trustAllResolver();
            var lookup = headers(Map.of(HEADER_PROXY_CONTEXT_PATH, "/app\r\nSet-Cookie: x=1"));

            assertEquals("", resolver.resolve(lookup).contextPath(),
                    "A CR/LF header-injection sequence must resolve to empty");
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN,
                    "Rejecting proxy context path with control characters");
        }

        @Test
        @DisplayName("Rejects a protocol-relative //host prefix and warns")
        void rejectsProtocolRelativeAndWarns() {
            var resolver = trustAllResolver();
            var lookup = headers(Map.of(HEADER_PROXY_CONTEXT_PATH, "//attacker.com"));

            assertEquals("", resolver.resolve(lookup).contextPath(),
                    "A '//host' value must be rejected to prevent protocol-relative URL injection");
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN,
                    "Rejecting proxy context path to prevent protocol-relative URL injection");
        }

        @Test
        @DisplayName("Rejects a value carrying a backslash")
        void rejectsBackslash() {
            var resolver = trustAllResolver();
            var lookup = headers(Map.of(HEADER_PROXY_CONTEXT_PATH, "/\\attacker.com"));

            assertEquals("", resolver.resolve(lookup).contextPath(),
                    "An embedded backslash must be rejected (browsers may normalize it to '/')");
        }
    }

    @Nested
    @DisplayName("Scheme / host / port resolution")
    class SchemeHostPort {

        @Test
        @DisplayName("Honors forwarded scheme, host, and explicit port under trustAll")
        void honorsSchemeHostPortUnderTrustAll() {
            var resolver = trustAllResolver();
            var lookup = headers(Map.of(
                    HEADER_FORWARDED_PROTO, "https",
                    HEADER_FORWARDED_HOST, "proxy.example.com",
                    HEADER_FORWARDED_PORT, "8443"));

            ResolvedForwarding resolved = resolver.resolve(lookup);

            assertAll("Honored forwarding view",
                    () -> assertEquals("https", resolved.scheme().orElseThrow(),
                            "Scheme must be honored under trustAll"),
                    () -> assertEquals("proxy.example.com", resolved.host().orElseThrow(),
                            "Host must be honored under trustAll"),
                    () -> assertEquals(8443, resolved.port().orElseThrow(),
                            "Explicit forwarded port must be honored under trustAll"));
        }

        @Test
        @DisplayName("Derives the port from a host:port token when no explicit port header is present")
        void derivesPortFromHostToken() {
            var resolver = trustAllResolver();
            var lookup = headers(Map.of(
                    HEADER_FORWARDED_PROTO, "https",
                    HEADER_FORWARDED_HOST, "proxy.example.com:9443"));

            ResolvedForwarding resolved = resolver.resolve(lookup);

            assertAll("Host:port fallback",
                    () -> assertEquals("proxy.example.com", resolved.host().orElseThrow(),
                            "Host must be split from the host:port token"),
                    () -> assertEquals(9443, resolved.port().orElseThrow(),
                            "Port must fall back to the host:port token when no port header is present"));
        }

        @Test
        @DisplayName("Honors no scheme / host / port under the secure default")
        void secureDefaultHonorsNoSchemeHostPort() {
            var resolver = secureDefaultResolver();
            var lookup = headers(Map.of(
                    HEADER_FORWARDED_PROTO, "https",
                    HEADER_FORWARDED_HOST, "proxy.example.com",
                    HEADER_FORWARDED_PORT, "8443"));

            ResolvedForwarding resolved = resolver.resolve(lookup);

            assertAll("Nothing honored without trustAll",
                    () -> assertTrue(resolved.scheme().isEmpty(), "Scheme must not be honored"),
                    () -> assertTrue(resolved.host().isEmpty(), "Host must not be honored"),
                    () -> assertTrue(resolved.port().isEmpty(), "Port must not be honored"));
        }
    }

    @Nested
    @DisplayName("Client-IP resolution")
    class ClientIpResolution {

        @Test
        @DisplayName("Returns the first untrusted hop walking the chain right-to-left")
        void resolvesFirstUntrustedHop() {
            var resolver = ForwardedRequestResolver.create(
                    false, Set.of(), Set.of(TRUSTED_PROXY_PRIVATE), PRESET_DEFAULTS);
            var lookup = headers(Map.of(HEADER_FORWARDED_FOR, "203.0.113.5, 10.0.0.1"));

            assertEquals("203.0.113.5", resolver.resolve(lookup).clientIp().orElseThrow(),
                    "The rightmost untrusted hop is the resolved client IP");
        }

        @Test
        @DisplayName("Honors no client IP when trustedProxies is unconfigured (secure default)")
        void noTrustedProxiesHonorsNoClientIp() {
            var resolver = secureDefaultResolver();
            var lookup = headers(Map.of(HEADER_FORWARDED_FOR, "203.0.113.5, 10.0.0.1"));

            assertTrue(resolver.resolve(lookup).clientIp().isEmpty(),
                    "Without trusted proxies no forwarded client IP is honored");
        }

        @Test
        @DisplayName("Honors no client IP when every chain hop is a trusted proxy")
        void allTrustedHopsHonorsNoClientIp() {
            var resolver = ForwardedRequestResolver.create(
                    false, Set.of(), Set.of(TRUSTED_PROXY_PRIVATE), PRESET_DEFAULTS);
            var lookup = headers(Map.of(HEADER_FORWARDED_FOR, "10.0.0.5, 10.0.0.1"));

            assertTrue(resolver.resolve(lookup).clientIp().isEmpty(),
                    "An all-trusted chain leaves no untrusted client hop");
        }
    }

    @Nested
    @DisplayName("Security-config preset selector")
    class SecurityConfigPreset {

        @Test
        @DisplayName("Maps 'strict' to SecurityConfiguration.strict()")
        void mapsStrict() {
            assertSame(SecurityConfiguration.strict(), ForwardedRequestResolver.securityConfigFor("strict"),
                    "'strict' must select the strict preset");
        }

        @Test
        @DisplayName("Maps 'lenient' to SecurityConfiguration.lenient()")
        void mapsLenient() {
            assertSame(SecurityConfiguration.lenient(), ForwardedRequestResolver.securityConfigFor("lenient"),
                    "'lenient' must select the lenient preset");
        }

        @Test
        @DisplayName("Maps 'defaults' to SecurityConfiguration.defaults()")
        void mapsDefaults() {
            assertSame(SecurityConfiguration.defaults(), ForwardedRequestResolver.securityConfigFor("defaults"),
                    "'defaults' must select the default preset");
        }

        @ParameterizedTest(name = "preset selector \"{0}\" falls back to defaults")
        @ValueSource(strings = {"unknown", "STRICT-ish", "  ", ""})
        @DisplayName("Falls back to defaults for an unknown preset")
        void unknownFallsBackToDefaults(String preset) {
            assertSame(SecurityConfiguration.defaults(), ForwardedRequestResolver.securityConfigFor(preset),
                    "An unknown preset must fall back to defaults");
        }

        @Test
        @DisplayName("Falls back to defaults for a null preset")
        void nullFallsBackToDefaults() {
            assertSame(SecurityConfiguration.defaults(), ForwardedRequestResolver.securityConfigFor(null),
                    "A null preset must fall back to defaults");
        }

        @Test
        @DisplayName("Is case-insensitive and trims surrounding whitespace")
        void isCaseInsensitiveAndTrims() {
            assertSame(SecurityConfiguration.strict(), ForwardedRequestResolver.securityConfigFor("  STRICT  "),
                    "The selector must lower-case and trim before matching");
        }
    }

    @Nested
    @DisplayName("Factory null-guards (secure default)")
    class FactoryNullGuards {

        @Test
        @DisplayName("Treats null allowedContextPaths and null trustedProxies as honoring nothing")
        void nullSetsHonorNothing() {
            var resolver = ForwardedRequestResolver.create(false, null, null, null);
            var lookup = headers(Map.of(
                    HEADER_PROXY_CONTEXT_PATH, "/nifi-proxy",
                    HEADER_FORWARDED_FOR, "203.0.113.5, 10.0.0.1"));

            ResolvedForwarding resolved = resolver.resolve(lookup);

            assertAll("Null config inputs collapse to the secure default",
                    () -> assertEquals("", resolved.contextPath(),
                            "A null allowlist honors no context path"),
                    () -> assertTrue(resolved.clientIp().isEmpty(),
                            "Null trusted proxies honor no client IP"));
        }

        @Test
        @DisplayName("Resolves to the empty forwarding view for a request with no proxy headers")
        void emptyRequestResolvesEmpty() {
            var resolver = trustAllResolver();

            ResolvedForwarding resolved = resolver.resolve(headers(Map.of()));

            assertAll("Empty request",
                    () -> assertEquals("", resolved.contextPath(), "No context path"),
                    () -> assertTrue(resolved.scheme().isEmpty(), "No scheme"),
                    () -> assertTrue(resolved.host().isEmpty(), "No host"),
                    () -> assertTrue(resolved.port().isEmpty(), "No port"),
                    () -> assertFalse(resolved.clientIp().isPresent(), "No client IP"));
        }
    }
}
