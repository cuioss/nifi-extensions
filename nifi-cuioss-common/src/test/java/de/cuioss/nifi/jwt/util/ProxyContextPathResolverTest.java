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
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Tests for {@link ProxyContextPathResolver}.
 *
 * <p>The resolver extracts the reverse-proxy context-path resolution — header
 * precedence, normalization, and the injection guard — that previously lived in
 * {@code ProxyContextPathServlet.normalize}. These tests assert the extracted
 * behaviour is identical to the original servlet semantics for every previously
 * covered case, driving {@link ProxyContextPathResolver#resolve} through a plain
 * {@link Map}-backed {@link Function} header accessor (no mocking framework).
 */
@EnableTestLogger
@DisplayName("ProxyContextPathResolver tests")
class ProxyContextPathResolverTest {

    private static final String HEADER_PROXY_CONTEXT_PATH = "X-ProxyContextPath";
    private static final String HEADER_FORWARDED_PREFIX = "X-Forwarded-Prefix";
    private static final String HEADER_FORWARDED = "Forwarded";

    /**
     * Builds a header accessor backed by a plain map: absent header names resolve
     * to {@code null}, exactly as {@code HttpServletRequest#getHeader} does.
     */
    private static Function<String, String> headers(Map<String, String> values) {
        return new HashMap<>(values)::get;
    }

    @Nested
    @DisplayName("Header precedence")
    class HeaderPrecedence {

        @Test
        @DisplayName("X-ProxyContextPath wins over both fallbacks")
        void proxyContextPathWins() {
            var lookup = headers(Map.of(
                    HEADER_PROXY_CONTEXT_PATH, "/primary",
                    HEADER_FORWARDED_PREFIX, "/secondary",
                    HEADER_FORWARDED, "for=192.0.2.1"));

            assertEquals("/primary", ProxyContextPathResolver.resolve(lookup),
                    "The most specific header must win");
        }

        @Test
        @DisplayName("X-Forwarded-Prefix used as fallback when primary absent")
        void forwardedPrefixFallback() {
            var lookup = headers(Map.of(
                    HEADER_FORWARDED_PREFIX, "/fallback",
                    HEADER_FORWARDED, "for=192.0.2.1"));

            assertEquals("/fallback", ProxyContextPathResolver.resolve(lookup),
                    "X-Forwarded-Prefix must be used when the primary header is absent");
        }

        @Test
        @DisplayName("X-Forwarded-Prefix used when primary present but blank")
        void blankPrimaryFallsThroughToPrefix() {
            var lookup = headers(Map.of(
                    HEADER_PROXY_CONTEXT_PATH, "   ",
                    HEADER_FORWARDED_PREFIX, "/fallback"));

            assertEquals("/fallback", ProxyContextPathResolver.resolve(lookup),
                    "A blank primary header must fall through to the prefix header");
        }

        @Test
        @DisplayName("Forwarded header alone resolves to empty (no prefix directive)")
        void forwardedSecondaryResolvesEmpty() {
            var lookup = headers(Map.of(HEADER_FORWARDED, "for=192.0.2.1;proto=https"));

            assertEquals("", ProxyContextPathResolver.resolve(lookup),
                    "RFC 7239 Forwarded carries no context-path directive and resolves empty");
        }

        @Test
        @DisplayName("Returns empty string when no proxy header is present")
        void noHeaderReturnsEmpty() {
            var lookup = headers(Map.of());

            assertEquals("", ProxyContextPathResolver.resolve(lookup),
                    "A request without any proxy header must resolve to empty");
        }
    }

    @Nested
    @DisplayName("Normalization")
    class Normalization {

        @Test
        @DisplayName("Returns empty for a null value")
        void nullValueReturnsEmpty() {
            assertEquals("", ProxyContextPathResolver.normalize(null),
                    "A null value must resolve to empty");
        }

        @Test
        @DisplayName("Returns empty for a blank value")
        void blankValueReturnsEmpty() {
            assertEquals("", ProxyContextPathResolver.normalize("   "),
                    "A blank value must resolve to empty");
        }

        @Test
        @DisplayName("Strips a single trailing slash")
        void stripsTrailingSlash() {
            assertEquals("/my-app", ProxyContextPathResolver.normalize("/my-app/"),
                    "A single trailing slash must be stripped");
        }

        @Test
        @DisplayName("Strips multiple trailing slashes")
        void stripsMultipleTrailingSlashes() {
            assertEquals("/my-app", ProxyContextPathResolver.normalize("/my-app///"),
                    "Multiple trailing slashes must be stripped");
        }

        @Test
        @DisplayName("Adds a leading slash when missing")
        void addsLeadingSlash() {
            assertEquals("/my-app/ui", ProxyContextPathResolver.normalize("my-app/ui"),
                    "A missing leading slash must be added");
        }

        @Test
        @DisplayName("Trims surrounding whitespace before normalizing")
        void trimsSurroundingWhitespace() {
            assertEquals("/my-app/ui", ProxyContextPathResolver.normalize("  /my-app/ui  "),
                    "Surrounding whitespace must be trimmed before normalizing");
        }

        @Test
        @DisplayName("Collapses a slash-only value to empty")
        void slashOnlyCollapsesToEmpty() {
            assertEquals("", ProxyContextPathResolver.normalize("/"),
                    "A slash-only value must collapse to empty");
        }
    }

    @Nested
    @DisplayName("Injection guard")
    class InjectionGuard {

        @ParameterizedTest(name = "control character U+{0} is rejected")
        @ValueSource(ints = {0x00, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x1B, 0x7F})
        @DisplayName("Rejects a value carrying any embedded control character")
        void rejectsControlCharacter(int controlChar) {
            var raw = "/app" + (char) controlChar + "Set-Cookie: x=1";

            assertEquals("", ProxyContextPathResolver.normalize(raw),
                    "A value carrying a control character must resolve to empty");
        }

        @Test
        @DisplayName("Rejects a value carrying a CR/LF injection sequence and warns")
        void rejectsCrlfInjection() {
            var normalized = ProxyContextPathResolver.normalize("/app\r\nSet-Cookie: x=1");

            assertEquals("", normalized,
                    "A CR/LF header-injection sequence must resolve to empty");
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN,
                    "Rejecting proxy context path with control characters");
        }

        @Test
        @DisplayName("Accepts a clean value carrying no control characters")
        void acceptsCleanValue() {
            assertEquals("/clean/app", ProxyContextPathResolver.normalize("/clean/app"),
                    "A value free of control characters must be preserved");
        }

        @Test
        @DisplayName("Rejects a protocol-relative value starting with double slashes and warns")
        void rejectsProtocolRelativeDoubleSlash() {
            assertEquals("", ProxyContextPathResolver.normalize("//attacker.com"),
                    "A '//host' value must be rejected to prevent protocol-relative URL injection");
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN,
                    "Rejecting proxy context path to prevent protocol-relative URL injection");
        }

        @Test
        @DisplayName("Rejects values carrying a backslash")
        void rejectsBackslash() {
            assertEquals("", ProxyContextPathResolver.normalize("\\\\attacker.com"),
                    "A leading backslash sequence must be rejected");
            assertEquals("", ProxyContextPathResolver.normalize("/\\attacker.com"),
                    "An embedded backslash must be rejected (browsers may normalize it to '/')");
        }
    }
}
