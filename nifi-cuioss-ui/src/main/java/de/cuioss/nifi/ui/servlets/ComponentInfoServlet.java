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

import de.cuioss.nifi.ui.util.ComponentConfigReader;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.Json;
import jakarta.json.JsonWriterFactory;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.nifi.web.NiFiWebConfigurationContext;

import java.io.IOException;
import java.util.Map;

/**
 * Lightweight servlet that returns the component type and class for a NiFi
 * component (processor or controller service). Uses the existing
 * {@link ComponentConfigReader} for in-JVM detection without network
 * round-trips.
 *
 * <p>Mapped to {@code GET /nifi-api/processors/jwt/component-info}.
 * The processor ID is read from the {@code X-Processor-Id} header,
 * which is already validated by {@link ProcessorIdValidationFilter}.
 *
 * <p>Response format:
 * <pre>{@code
 * { "type": "PROCESSOR", "componentClass": "de.cuioss...RestApiGatewayProcessor" }
 * }</pre>
 */
public class ComponentInfoServlet extends HttpServlet {

    private static final CuiLogger LOGGER = new CuiLogger(ComponentInfoServlet.class);
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());
    private static final String PROCESSOR_ID_HEADER = "X-Processor-Id";

    private transient NiFiWebConfigurationContext configContext;

    @Override
    public void init() throws ServletException {
        super.init();
        configContext = (NiFiWebConfigurationContext) getServletContext()
                .getAttribute("nifi-web-configuration-context");
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String processorId = req.getHeader(PROCESSOR_ID_HEADER);
        if (processorId == null || processorId.isBlank()) {
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST, "Missing processor ID");
            return;
        }

        try {
            var config = resolveComponentConfig(processorId, req);

            var json = Json.createObjectBuilder()
                    .add("type", config.type().name())
                    .add("componentClass", config.componentClass())
                    .build();

            resp.setContentType("application/json");
            resp.setCharacterEncoding("UTF-8");
            resp.setStatus(HttpServletResponse.SC_OK);
            try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
                writer.writeObject(json);
            }
        } catch (IllegalArgumentException e) {
            LOGGER.debug("Component not found for ID %s: %s", processorId, e.getMessage());
            sendErrorResponse(resp, HttpServletResponse.SC_NOT_FOUND,
                    "Component not found: " + processorId);
        } catch (Exception e) {
            LOGGER.error(e, "Failed to resolve component info for %s", processorId);
            sendErrorResponse(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "Failed to resolve component info");
        }
    }

    /**
     * Resolves component configuration. Overridable for testing.
     */
    protected ComponentConfigReader.ComponentConfig resolveComponentConfig(
            String processorId, HttpServletRequest request) {
        var reader = new ComponentConfigReader(configContext);
        return reader.getComponentConfig(processorId, request);
    }

    private void sendErrorResponse(HttpServletResponse resp, int status, String message) {
        try {
            resp.setStatus(status);
            resp.setContentType("application/json");
            resp.setCharacterEncoding("UTF-8");

            var errorJson = Json.createObjectBuilder()
                    .add("error", message)
                    .build();

            try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
                writer.writeObject(errorJson);
            }
        } catch (IOException e) {
            LOGGER.warn("Failed to send error response (status %s): %s", status, e.getMessage());
        }
    }
}
