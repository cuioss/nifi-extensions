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
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import org.eclipse.jetty.ee11.servlet.FilterHolder;
import org.eclipse.jetty.ee11.servlet.ServletHolder;
import org.junit.jupiter.api.*;

import java.io.IOException;
import java.util.EnumSet;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

/**
 * Tests for {@link ProcessorIdValidationFilter} with authenticated user context.
 * Uses a request wrapper to simulate {@code getRemoteUser()} returning a non-null value,
 * covering the authenticated user logging branch.
 */
@EnableTestLogger
@DisplayName("ProcessorIdValidationFilter authenticated user tests")
class ProcessorIdValidationFilterAuthTest {

    private static final String PROCESSOR_ID_HEADER = "X-Processor-Id";
    private static final String ENDPOINT = "/nifi-api/processors/jwt/validate";

    @BeforeAll
    static void startServer() throws Exception {
        EmbeddedServletTestSupport.startServer(ctx -> {
            // Wrapper filter that sets remoteUser on the request
            ctx.addFilter(new FilterHolder(new Filter() {
                @Override
                public void doFilter(ServletRequest req, ServletResponse resp, FilterChain chain)
                        throws IOException, ServletException {
                    chain.doFilter(new HttpServletRequestWrapper((HttpServletRequest) req) {
                        @Override
                        public String getRemoteUser() {
                            return "test-user";
                        }
                    }, resp);
                }
            }), "/nifi-api/processors/jwt/*", EnumSet.of(DispatcherType.REQUEST));

            ctx.addFilter(ProcessorIdValidationFilter.class, "/nifi-api/processors/jwt/*",
                    EnumSet.of(DispatcherType.REQUEST));
            ctx.addServlet(new ServletHolder(new EmbeddedServletTestSupport.PassthroughServlet()),
                    "/nifi-api/processors/jwt/*");
        });
    }

    @AfterAll
    static void stopServer() throws Exception {
        EmbeddedServletTestSupport.stopServer();
    }

    @Test
    @DisplayName("Should pass validation and log authenticated user")
    void shouldPassWithAuthenticatedUser() {
        given()
                .header(PROCESSOR_ID_HEADER, UUID.randomUUID().toString())
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body(equalTo("OK"));
    }

    @Test
    @DisplayName("Should handle filter lifecycle methods")
    void shouldHandleFilterLifecycle() throws ServletException {
        ProcessorIdValidationFilter filter = new ProcessorIdValidationFilter();
        filter.init(null);
        filter.destroy();
    }
}
