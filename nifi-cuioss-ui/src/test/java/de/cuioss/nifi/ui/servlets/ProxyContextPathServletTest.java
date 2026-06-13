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
package de.cuioss.nifi.ui.servlets;

import de.cuioss.test.juli.junit5.EnableTestLogger;
import org.eclipse.jetty.ee11.servlet.ServletHolder;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Tests for {@link ProxyContextPathServlet} using embedded Jetty + REST Assured.
 *
 * <p>The servlet resolves the reverse-proxy context path from request headers in
 * strict precedence order, normalizes the result (one leading slash, no trailing
 * slash), and guards against header injection. Each case is exercised through a
 * real HTTP round-trip so the header-reading and JSON-serialization paths are
 * covered end-to-end.
 */
@EnableTestLogger
@DisplayName("ProxyContextPathServlet tests")
class ProxyContextPathServletTest {

    private static final String HEADER_PROXY_CONTEXT_PATH = "X-ProxyContextPath";
    private static final String HEADER_FORWARDED_PREFIX = "X-Forwarded-Prefix";
    private static final String HEADER_FORWARDED = "Forwarded";

    private static EmbeddedServletTestSupport.ServerHandle handle;

    @BeforeAll
    static void startServer() throws Exception {
        handle = EmbeddedServletTestSupport.startServer(ctx ->
                ctx.addServlet(new ServletHolder(new ProxyContextPathServlet()), "/context-path"));
    }

    @AfterAll
    static void stopServer() throws Exception {
        handle.close();
    }

    @Nested
    @DisplayName("Header precedence")
    class HeaderPrecedence {

        @Test
        @DisplayName("X-ProxyContextPath wins over both fallbacks")
        void proxyContextPathWins() {
            handle.spec()
                    .header(HEADER_PROXY_CONTEXT_PATH, "/primary")
                    .header(HEADER_FORWARDED_PREFIX, "/secondary")
                    .header(HEADER_FORWARDED, "for=192.0.2.1")
                    .when()
                    .get("/context-path")
                    .then()
                    .statusCode(200)
                    .contentType(containsString("application/json"))
                    .body("contextPath", equalTo("/primary"));
        }

        @Test
        @DisplayName("X-Forwarded-Prefix used as fallback when primary absent")
        void forwardedPrefixFallback() {
            handle.spec()
                    .header(HEADER_FORWARDED_PREFIX, "/fallback")
                    .header(HEADER_FORWARDED, "for=192.0.2.1")
                    .when()
                    .get("/context-path")
                    .then()
                    .statusCode(200)
                    .body("contextPath", equalTo("/fallback"));
        }

        @Test
        @DisplayName("X-Forwarded-Prefix used when primary present but blank")
        void blankPrimaryFallsThroughToPrefix() {
            handle.spec()
                    .header(HEADER_PROXY_CONTEXT_PATH, "   ")
                    .header(HEADER_FORWARDED_PREFIX, "/fallback")
                    .when()
                    .get("/context-path")
                    .then()
                    .statusCode(200)
                    .body("contextPath", equalTo("/fallback"));
        }

        @Test
        @DisplayName("Forwarded header alone resolves to empty (no prefix directive)")
        void forwardedSecondaryResolvesEmpty() {
            handle.spec()
                    .header(HEADER_FORWARDED, "for=192.0.2.1;proto=https")
                    .when()
                    .get("/context-path")
                    .then()
                    .statusCode(200)
                    .body("contextPath", equalTo(""));
        }
    }

    @Nested
    @DisplayName("No-header case")
    class NoHeader {

        @Test
        @DisplayName("Returns empty string when no proxy header is present")
        void noHeaderReturnsEmpty() {
            handle.spec()
                    .when()
                    .get("/context-path")
                    .then()
                    .statusCode(200)
                    .contentType(containsString("application/json"))
                    .body("contextPath", equalTo(""));
        }
    }

    @Nested
    @DisplayName("Normalization")
    class Normalization {

        @Test
        @DisplayName("Strips a single trailing slash")
        void stripsTrailingSlash() {
            handle.spec()
                    .header(HEADER_PROXY_CONTEXT_PATH, "/my-app/")
                    .when()
                    .get("/context-path")
                    .then()
                    .statusCode(200)
                    .body("contextPath", equalTo("/my-app"));
        }

        @Test
        @DisplayName("Strips multiple trailing slashes")
        void stripsMultipleTrailingSlashes() {
            handle.spec()
                    .header(HEADER_PROXY_CONTEXT_PATH, "/my-app///")
                    .when()
                    .get("/context-path")
                    .then()
                    .statusCode(200)
                    .body("contextPath", equalTo("/my-app"));
        }

        @Test
        @DisplayName("Adds a leading slash when missing")
        void addsLeadingSlash() {
            handle.spec()
                    .header(HEADER_PROXY_CONTEXT_PATH, "my-app/ui")
                    .when()
                    .get("/context-path")
                    .then()
                    .statusCode(200)
                    .body("contextPath", equalTo("/my-app/ui"));
        }

        @Test
        @DisplayName("Trims surrounding whitespace before normalizing")
        void trimsSurroundingWhitespace() {
            handle.spec()
                    .header(HEADER_PROXY_CONTEXT_PATH, "  /my-app/ui  ")
                    .when()
                    .get("/context-path")
                    .then()
                    .statusCode(200)
                    .body("contextPath", equalTo("/my-app/ui"));
        }

        @Test
        @DisplayName("Collapses a slash-only value to empty")
        void slashOnlyCollapsesToEmpty() {
            handle.spec()
                    .header(HEADER_PROXY_CONTEXT_PATH, "/")
                    .when()
                    .get("/context-path")
                    .then()
                    .statusCode(200)
                    .body("contextPath", equalTo(""));
        }
    }

    @Nested
    @DisplayName("Injection guard")
    class InjectionGuard {

        // The injection guard is exercised against ProxyContextPathServlet.normalize
        // directly rather than through a real HTTP round-trip: the HTTP client and
        // Jetty's header parser sanitize control characters in header values
        // (replacing CR/LF/VT with a space, or rejecting the request) before the
        // servlet ever sees them, so the servlet's own containsControlCharacter
        // guard — defense-in-depth on top of container sanitization — cannot be
        // reached through transport. The direct call is the only way to assert it.

        @ParameterizedTest(name = "control character U+{0} is rejected")
        @ValueSource(ints = {0x00, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x1B, 0x7F})
        @DisplayName("Rejects a value carrying any embedded control character")
        void rejectsControlCharacter(int controlChar) {
            var raw = "/app" + (char) controlChar + "Set-Cookie: x=1";

            var normalized = ProxyContextPathServlet.normalize(raw);

            assertEquals("", normalized,
                    "A value carrying a control character must resolve to empty");
        }

        @Test
        @DisplayName("Rejects a value carrying a CR/LF injection sequence")
        void rejectsCrlfInjection() {
            var raw = "/app\r\nSet-Cookie: x=1";

            var normalized = ProxyContextPathServlet.normalize(raw);

            assertEquals("", normalized,
                    "A CR/LF header-injection sequence must resolve to empty");
        }

        @Test
        @DisplayName("Accepts a clean value carrying no control characters")
        void acceptsCleanValue() {
            var normalized = ProxyContextPathServlet.normalize("/clean/app");

            assertEquals("/clean/app", normalized,
                    "A value free of control characters must be preserved");
        }
    }
}
