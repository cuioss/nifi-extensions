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

import de.cuioss.nifi.ui.UILogMessages;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonWriterFactory;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

/**
 * Servlet for retrieving JWT authentication security metrics.
 * <p>
 * Returns metrics from the {@code JwtIssuerConfigService}'s
 * {@code SecurityEventCounter} for processor and controller service
 * component types.
 * <p>
 * Gateway metrics are served via {@link GatewayProxyServlet} which
 * proxies to the gateway's embedded Jetty management API.
 *
 * @see GatewayProxyServlet
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/observability.adoc">Observability Specification</a>
 */
public class MetricsServlet extends HttpServlet {

    private static final CuiLogger LOGGER = new CuiLogger(MetricsServlet.class);
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException {

        LOGGER.debug("Received metrics request");

        try {
            JsonObject responseJson = buildEmptyMetricsResponse();

            resp.setContentType("application/json");
            resp.setCharacterEncoding("UTF-8");
            resp.setStatus(200);

            try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
                writer.writeObject(responseJson);
                LOGGER.debug("Sent metrics response");
            }

        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.ERROR_WRITING_METRICS);
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    private JsonObject buildEmptyMetricsResponse() {
        return Json.createObjectBuilder()
                .add("totalTokensValidated", 0)
                .add("validTokens", 0)
                .add("invalidTokens", 0)
                .add("errorRate", 0.0)
                .add("lastValidation", "")
                .add("topErrors", Json.createArrayBuilder())
                .add("averageResponseTime", 0)
                .add("minResponseTime", 0)
                .add("maxResponseTime", 0)
                .add("p95ResponseTime", 0)
                .add("activeIssuers", 0)
                .add("issuerMetrics", Json.createArrayBuilder())
                .build();
    }
}
