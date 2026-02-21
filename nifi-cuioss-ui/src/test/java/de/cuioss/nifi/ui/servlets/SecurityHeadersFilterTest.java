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

import jakarta.servlet.DispatcherType;
import org.eclipse.jetty.ee11.servlet.ServletHolder;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.EnumSet;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;

/**
 * Tests for {@link SecurityHeadersFilter} using embedded Jetty + REST Assured.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/security.adoc">Security Specification</a>
 */
@DisplayName("Security Headers Filter Tests")
class SecurityHeadersFilterTest {

    private static EmbeddedServletTestSupport.ServerHandle handle;

    @BeforeAll
    static void startServer() throws Exception {
        handle = EmbeddedServletTestSupport.startServer(ctx -> {
            ctx.addFilter(SecurityHeadersFilter.class, "/*",
                    EnumSet.of(DispatcherType.REQUEST));
            ctx.addServlet(new ServletHolder(new EmbeddedServletTestSupport.PassthroughServlet()), "/*");
        });
    }

    @AfterAll
    static void stopServer() throws Exception {
        handle.close();
    }

    @Test
    @DisplayName("Should set all security headers on response")
    void shouldSetAllSecurityHeaders() {
        handle.spec()
                .when()
                .get("/test")
                .then()
                .statusCode(200)
                .header("X-Content-Type-Options", "nosniff")
                .header("X-Frame-Options", "SAMEORIGIN")
                .header("Referrer-Policy", "strict-origin-when-cross-origin")
                .header("Content-Security-Policy", containsString("default-src 'self'"));
    }

    @Test
    @DisplayName("Should continue filter chain after setting headers")
    void shouldContinueFilterChain() {
        handle.spec()
                .when()
                .get("/test")
                .then()
                .statusCode(200)
                .body(equalTo("OK"));
    }
}
