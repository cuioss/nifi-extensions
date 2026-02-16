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
import org.junit.jupiter.api.*;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * Tests for {@link MetricsServlet} using embedded Jetty + REST Assured.
 */
@EnableTestLogger
@DisplayName("MetricsServlet tests")
class MetricsServletTest {

    @BeforeAll
    static void startServer() throws Exception {
        EmbeddedServletTestSupport.startServer(ctx ->
                ctx.addServlet(new ServletHolder(new MetricsServlet()), "/metrics"));
    }

    @AfterAll
    static void stopServer() throws Exception {
        EmbeddedServletTestSupport.stopServer();
    }

    @Nested
    @DisplayName("Metrics response")
    class MetricsResponse {

        @Test
        @DisplayName("Should return empty metrics response with correct structure")
        void shouldReturnEmptyMetricsResponse() {
            given()
                    .when()
                    .get("/metrics")
                    .then()
                    .statusCode(200)
                    .contentType(containsString("application/json"))
                    .body("totalTokensValidated", equalTo(0))
                    .body("validTokens", equalTo(0))
                    .body("invalidTokens", equalTo(0))
                    .body("errorRate", equalTo(0.0f))
                    .body("lastValidation", equalTo(""))
                    .body("topErrors", empty())
                    .body("activeIssuers", equalTo(0))
                    .body("issuerMetrics", empty());
        }
    }
}
