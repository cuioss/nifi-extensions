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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasKey;

/**
 * Tests for {@link ProxyContextPathServlet} using embedded Jetty + REST Assured.
 *
 * <p>The servlet resolves the reverse-proxy context path through the shared
 * {@link de.cuioss.nifi.jwt.util.ForwardedRequestResolver} (a thin wrapper over cui-http
 * {@code de.cuioss.http.forwarded}). The honored context-path allowlist is derived at
 * servlet {@code init()} from NiFi's {@code nifi.web.proxy.context.path} property, with an
 * optional {@code allowedContextPaths} / {@code trustAll} servlet init-param override that
 * takes precedence. Header precedence, normalization, and the injection guard now live in
 * cui-http and are exercised directly at {@code ForwardedRequestResolverTest}; here they are
 * observed only through the servlet's end-to-end HTTP + JSON path.
 *
 * <p>Each scenario starts a dedicated embedded server whose servlet is configured through the
 * NiFi property (a temporary {@code nifi.properties} file addressed by the
 * {@code nifi.properties.file.path} system property) and/or init-params, then drives a real
 * HTTP round-trip so the header-reading and JSON-serialization paths are covered end-to-end.
 */
@EnableTestLogger
@DisplayName("ProxyContextPathServlet tests")
class ProxyContextPathServletTest {

    private static final String HEADER_PROXY_CONTEXT_PATH = "X-ProxyContextPath";
    private static final String HEADER_FORWARDED_PREFIX = "X-Forwarded-Prefix";
    private static final String NIFI_PROPERTIES_FILE_PATH = "nifi.properties.file.path";

    @TempDir
    static Path tempDir;

    private static final AtomicInteger PROPERTIES_FILE_COUNTER = new AtomicInteger();

    /**
     * Starts an embedded server whose {@link ProxyContextPathServlet} is configured from an
     * optional NiFi {@code nifi.web.proxy.context.path} value and optional servlet init-params.
     *
     * <p>The servlet is loaded eagerly ({@code setInitOrder(0)}) so its {@code init()} reads the
     * NiFi property while the {@code nifi.properties.file.path} system property is still set — the
     * property is cleared before the request round-trip, proving the value was captured at init.
     *
     * @param nifiProxyContextPath the {@code nifi.web.proxy.context.path} value to stub, or
     *                             {@code null} to leave the property unset (secure default)
     * @param initParams           servlet init-params ({@code allowedContextPaths} / {@code trustAll})
     * @return a running server handle
     */
    private static EmbeddedServletTestSupport.ServerHandle startServer(
            String nifiProxyContextPath, Map<String, String> initParams) throws Exception {
        // Capture and restore the surrounding value so this helper isolates the global
        // system property instead of leaking/clobbering it across tests. When no proxy
        // context path is requested, clear the property so secure-default scenarios truly
        // see no property (an inherited value would invalidate the secure-default assertion).
        String previous = System.getProperty(NIFI_PROPERTIES_FILE_PATH);
        if (nifiProxyContextPath != null) {
            Path propertiesFile = tempDir.resolve(
                    "nifi-" + PROPERTIES_FILE_COUNTER.incrementAndGet() + ".properties");
            Files.writeString(propertiesFile, "nifi.web.proxy.context.path=" + nifiProxyContextPath + "\n");
            System.setProperty(NIFI_PROPERTIES_FILE_PATH, propertiesFile.toString());
        } else {
            System.clearProperty(NIFI_PROPERTIES_FILE_PATH);
        }
        try {
            return EmbeddedServletTestSupport.startServer(ctx -> {
                var holder = new ServletHolder(new ProxyContextPathServlet());
                initParams.forEach(holder::setInitParameter);
                holder.setInitOrder(0);
                ctx.addServlet(holder, "/context-path");
            });
        } finally {
            if (previous != null) {
                System.setProperty(NIFI_PROPERTIES_FILE_PATH, previous);
            } else {
                System.clearProperty(NIFI_PROPERTIES_FILE_PATH);
            }
        }
    }

    @Nested
    @DisplayName("Allowlist derived from nifi.web.proxy.context.path")
    class DerivedAllowlist {

        @Test
        @DisplayName("Honors a prefix present in the derived allowlist")
        void honorsDerivedPrefix() throws Exception {
            try (var handle = startServer("/nifi-proxy", Map.of())) {
                handle.spec()
                        .header(HEADER_PROXY_CONTEXT_PATH, "/nifi-proxy")
                        .when()
                        .get("/context-path")
                        .then()
                        .statusCode(200)
                        .contentType(containsString("application/json"))
                        .body("contextPath", equalTo("/nifi-proxy"));
            }
        }

        @Test
        @DisplayName("Ignores a spoofed prefix absent from the derived allowlist")
        void ignoresNonAllowlistedPrefix() throws Exception {
            try (var handle = startServer("/nifi-proxy", Map.of())) {
                handle.spec()
                        .header(HEADER_PROXY_CONTEXT_PATH, "/attacker")
                        .when()
                        .get("/context-path")
                        .then()
                        .statusCode(200)
                        .body("contextPath", equalTo(""));
            }
        }

        @Test
        @DisplayName("Uses X-Forwarded-Prefix as fallback when both prefixes are allowlisted")
        void forwardedPrefixFallbackHonored() throws Exception {
            try (var handle = startServer("/nifi-proxy,/fallback", Map.of())) {
                handle.spec()
                        .header(HEADER_FORWARDED_PREFIX, "/fallback")
                        .when()
                        .get("/context-path")
                        .then()
                        .statusCode(200)
                        .body("contextPath", equalTo("/fallback"));
            }
        }

        @Test
        @DisplayName("X-ProxyContextPath wins over the X-Forwarded-Prefix fallback")
        void proxyContextPathWinsOverPrefix() throws Exception {
            try (var handle = startServer("/nifi-proxy,/fallback", Map.of())) {
                handle.spec()
                        .header(HEADER_PROXY_CONTEXT_PATH, "/nifi-proxy")
                        .header(HEADER_FORWARDED_PREFIX, "/fallback")
                        .when()
                        .get("/context-path")
                        .then()
                        .statusCode(200)
                        .body("contextPath", equalTo("/nifi-proxy"));
            }
        }
    }

    @Nested
    @DisplayName("Servlet init-param override")
    class InitParamOverride {

        @Test
        @DisplayName("Init-param allowlist overrides the NiFi-derived value")
        void overrideHonored() throws Exception {
            try (var handle = startServer("/derived", Map.of("allowedContextPaths", "/override"))) {
                handle.spec()
                        .header(HEADER_PROXY_CONTEXT_PATH, "/override")
                        .when()
                        .get("/context-path")
                        .then()
                        .statusCode(200)
                        .body("contextPath", equalTo("/override"));
            }
        }

        @Test
        @DisplayName("NiFi-derived value is ignored once an init-param override is present")
        void derivedValueIgnoredWhenOverridden() throws Exception {
            try (var handle = startServer("/derived", Map.of("allowedContextPaths", "/override"))) {
                handle.spec()
                        .header(HEADER_PROXY_CONTEXT_PATH, "/derived")
                        .when()
                        .get("/context-path")
                        .then()
                        .statusCode(200)
                        .body("contextPath", equalTo(""));
            }
        }
    }

    @Nested
    @DisplayName("Secure default (no NiFi property, no init-param)")
    class SecureDefault {

        @Test
        @DisplayName("Honors nothing when neither the property nor an init-param is set")
        void noConfigHonorsNothing() throws Exception {
            try (var handle = startServer(null, Map.of())) {
                handle.spec()
                        .header(HEADER_PROXY_CONTEXT_PATH, "/anything")
                        .when()
                        .get("/context-path")
                        .then()
                        .statusCode(200)
                        .body("contextPath", equalTo(""));
            }
        }

        @Test
        @DisplayName("Returns empty string when no proxy header is present")
        void noHeaderReturnsEmpty() throws Exception {
            try (var handle = startServer(null, Map.of())) {
                handle.spec()
                        .when()
                        .get("/context-path")
                        .then()
                        .statusCode(200)
                        .contentType(containsString("application/json"))
                        .body("contextPath", equalTo(""));
            }
        }
    }

    @Nested
    @DisplayName("Normalization (delegated to cui-http, exercised under trustAll)")
    class Normalization {

        @Test
        @DisplayName("Strips a single trailing slash")
        void stripsTrailingSlash() throws Exception {
            try (var handle = startServer(null, Map.of("trustAll", "true"))) {
                handle.spec()
                        .header(HEADER_PROXY_CONTEXT_PATH, "/my-app/")
                        .when()
                        .get("/context-path")
                        .then()
                        .statusCode(200)
                        .body("contextPath", equalTo("/my-app"));
            }
        }

        @Test
        @DisplayName("Collapses a slash-only value to empty")
        void slashOnlyCollapsesToEmpty() throws Exception {
            try (var handle = startServer(null, Map.of("trustAll", "true"))) {
                handle.spec()
                        .header(HEADER_PROXY_CONTEXT_PATH, "/")
                        .when()
                        .get("/context-path")
                        .then()
                        .statusCode(200)
                        .body("contextPath", equalTo(""));
            }
        }
    }

    @Nested
    @DisplayName("Injection guard delegated to cui-http")
    class InjectionGuard {

        @Test
        @DisplayName("Rejects a protocol-relative //host prefix under trustAll")
        void rejectsProtocolRelative() throws Exception {
            try (var handle = startServer(null, Map.of("trustAll", "true"))) {
                handle.spec()
                        .header(HEADER_PROXY_CONTEXT_PATH, "//attacker.com")
                        .when()
                        .get("/context-path")
                        .then()
                        .statusCode(200)
                        .body("contextPath", equalTo(""));
            }
        }

        @Test
        @DisplayName("Rejects a value carrying a backslash under trustAll")
        void rejectsBackslash() throws Exception {
            try (var handle = startServer(null, Map.of("trustAll", "true"))) {
                handle.spec()
                        .header(HEADER_PROXY_CONTEXT_PATH, "/\\attacker.com")
                        .when()
                        .get("/context-path")
                        .then()
                        .statusCode(200)
                        .body("contextPath", equalTo(""));
            }
        }
    }

    @Nested
    @DisplayName("JSON response contract")
    class JsonContract {

        @Test
        @DisplayName("Response is application/json carrying a contextPath field")
        void responseCarriesContextPathField() throws Exception {
            try (var handle = startServer("/nifi-proxy", Map.of())) {
                handle.spec()
                        .header(HEADER_PROXY_CONTEXT_PATH, "/nifi-proxy")
                        .when()
                        .get("/context-path")
                        .then()
                        .statusCode(200)
                        .contentType(containsString("application/json"))
                        .body("$", hasKey("contextPath"));
            }
        }
    }
}
