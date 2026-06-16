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

import de.cuioss.http.security.config.SecurityConfiguration;
import de.cuioss.http.security.core.HttpSecurityValidator;
import de.cuioss.http.security.exceptions.UrlSecurityException;
import de.cuioss.http.security.monitoring.SecurityEventCounter;
import de.cuioss.http.security.pipeline.PipelineFactory;
import de.cuioss.nifi.ui.UILogMessages;
import de.cuioss.nifi.ui.util.ComponentConfigReader;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.Json;
import jakarta.json.JsonWriterFactory;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.nifi.web.ClusterRequestException;
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

    /**
     * cui-http header-value security validator built once with a strict
     * configuration. This servlet is a validation boundary, so it follows the
     * {@code JwksValidationServlet} strict/throw baseline (reject-on-violation).
     */
    private final transient HttpSecurityValidator headerValueValidator;

    public ComponentInfoServlet() {
        SecurityEventCounter counter = new SecurityEventCounter();
        SecurityConfiguration secConfig = SecurityConfiguration.strict();
        headerValueValidator = PipelineFactory.createHeaderValuePipeline(secConfig, counter);
    }

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
        if (!validateHeaderSecurity(processorId, resp)) {
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
        } catch (ClusterRequestException | IllegalStateException e) {
            LOGGER.error(e, UILogMessages.ERROR.FAILED_RESOLVE_COMPONENT_INFO, processorId);
            sendErrorResponse(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "Failed to resolve component info");
        } catch (IOException e) {
            // getOutputStream() / response writing failed — the client connection is
            // likely broken, so handle here rather than letting it escape the servlet
            // method (java:S1989); a further error response would also fail.
            LOGGER.warn(UILogMessages.WARN.FAILED_WRITE_COMPONENT_INFO_RESPONSE, processorId, e.getMessage());
        }
    }

    /**
     * Validates the externally-sourced {@code X-Processor-Id} header value
     * through the cui-http header-value security pipeline. On violation, rejects
     * with HTTP 400 and a {@code WARN} log entry, mirroring the
     * {@code JwksValidationServlet} baseline.
     *
     * @param value the header value to validate
     * @param resp  the response to write a 400 error to on violation
     * @return {@code true} when the value is safe, {@code false} when rejected
     */
    private boolean validateHeaderSecurity(String value, HttpServletResponse resp) {
        try {
            headerValueValidator.validate(value);
            return true;
        } catch (UrlSecurityException e) {
            LOGGER.warn(UILogMessages.WARN.HEADER_SECURITY_VIOLATION, value, e.getFailureType());
            sendErrorResponse(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Invalid header value: " + e.getFailureType().getDescription());
            return false;
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
            LOGGER.warn(UILogMessages.WARN.FAILED_SEND_ERROR_RESPONSE, status, e.getMessage());
        }
    }
}
