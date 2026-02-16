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
package de.cuioss.nifi.ui.util;

import de.cuioss.http.client.handler.HttpHandler;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.*;

import java.io.IOException;
import java.io.StringReader;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Utility class for reading NiFi component configuration via REST API.
 * Supports both processors and controller services, auto-detecting the
 * component type by trying the processor API first, then falling back
 * to the controller service API.
 *
 * <p><strong>Design Decision:</strong> Uses cuiHttp's HttpHandler for HTTP communication
 * instead of direct HttpClient usage. This provides automatic SSL context management
 * and consistent timeout handling across the application.</p>
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/security.adoc">Security Specification</a>
 */
public class ComponentConfigReader {

    private static final CuiLogger LOGGER = new CuiLogger(ComponentConfigReader.class);
    private static final JsonReaderFactory JSON_READER_FACTORY = Json.createReaderFactory(Map.of());

    /** NiFi component types. */
    public enum ComponentType {
        PROCESSOR, CONTROLLER_SERVICE
    }

    /**
     * Immutable configuration snapshot of a NiFi component.
     *
     * @param type           the component type (processor or controller service)
     * @param componentClass the fully qualified class name (e.g. {@code de.cuioss.nifi.rest.RestApiGatewayProcessor})
     * @param properties     the component properties
     * @param revision       the NiFi revision object for optimistic locking
     */
    public record ComponentConfig(
            ComponentType type,
            String componentClass,
            Map<String, String> properties,
            JsonObject revision) {
    }

    /**
     * Auto-detects the component type and retrieves its configuration.
     * Tries the processor API first, then falls back to controller service.
     *
     * @param componentId the NiFi component ID (must be a valid UUID)
     * @return the component configuration (never null)
     * @throws IOException if unable to fetch configuration
     * @throws IllegalArgumentException if the component is not found or the ID is invalid
     */
    public ComponentConfig getComponentConfig(String componentId) throws IOException {
        validateComponentId(componentId);

        // Try processor first
        try {
            return fetchComponent(componentId, ComponentType.PROCESSOR,
                    "nifi-api/processors/" + componentId);
        } catch (IllegalArgumentException processorNotFound) {
            // Try controller service
            try {
                return fetchComponent(componentId, ComponentType.CONTROLLER_SERVICE,
                        "nifi-api/controller-services/" + componentId);
            } catch (IllegalArgumentException csNotFound) {
                throw new IllegalArgumentException(
                        "Component not found: " + componentId
                                + " (tried both processor and controller-service APIs)");
            }
        }
    }

    /**
     * Retrieves processor properties from NiFi REST API.
     * Kept for backward compatibility — delegates to {@link #getComponentConfig}.
     *
     * @param processorId The processor ID (must not be null)
     * @return Map of processor properties (never null)
     * @throws IOException If unable to fetch processor configuration
     * @throws IllegalArgumentException If processor ID is invalid or null
     */
    public Map<String, String> getProcessorProperties(String processorId)
            throws IOException, IllegalArgumentException {
        validateComponentId(processorId);

        String nifiApiUrl = buildNiFiApiUrl("nifi-api/processors/" + processorId);
        LOGGER.debug("Fetching processor configuration from: %s", nifiApiUrl);

        HttpResponse<String> response = executeGet(nifiApiUrl);

        if (response.statusCode() == 404) {
            throw new IllegalArgumentException("Processor not found: " + processorId);
        } else if (response.statusCode() != 200) {
            LOGGER.debug("Failed to fetch processor config: HTTP %d - %s",
                    response.statusCode(), response.body());
            throw new IOException("Failed to fetch processor config: HTTP " + response.statusCode());
        }

        return parseProcessorResponse(response.body(), processorId);
    }

    // -----------------------------------------------------------------------
    // Internal — component fetching
    // -----------------------------------------------------------------------

    private ComponentConfig fetchComponent(String componentId, ComponentType type, String apiPath)
            throws IOException {
        String nifiApiUrl = buildNiFiApiUrl(apiPath);
        LOGGER.debug("Fetching %s configuration from: %s", type, nifiApiUrl);

        HttpResponse<String> response = executeGet(nifiApiUrl);

        if (response.statusCode() == 404) {
            throw new IllegalArgumentException("Component not found at: " + apiPath);
        } else if (response.statusCode() != 200) {
            throw new IOException("Failed to fetch component config: HTTP " + response.statusCode());
        }

        return parseComponentResponse(response.body(), componentId, type);
    }

    ComponentConfig parseComponentResponse(String responseBody, String componentId,
                                           ComponentType type) throws IOException {
        try (JsonReader reader = JSON_READER_FACTORY.createReader(new StringReader(responseBody))) {
            JsonObject root = reader.readObject();

            if (!root.containsKey("component")) {
                throw new IOException("Invalid response format: missing 'component' field");
            }

            JsonObject component = root.getJsonObject("component");
            String componentClass = component.getString("type", "");

            // Processors: root.component.config.properties
            // Controller Services: root.component.properties
            JsonObject properties;
            if (type == ComponentType.PROCESSOR) {
                if (!component.containsKey("config")) {
                    throw new IOException("Invalid processor response: missing 'config' field");
                }
                JsonObject config = component.getJsonObject("config");
                if (!config.containsKey("properties")) {
                    throw new IOException("Invalid processor response: missing 'properties' field");
                }
                properties = config.getJsonObject("properties");
            } else {
                if (!component.containsKey("properties")) {
                    throw new IOException("Invalid CS response: missing 'properties' field");
                }
                properties = component.getJsonObject("properties");
            }

            Map<String, String> propertyMap = new HashMap<>();
            for (String key : properties.keySet()) {
                String value = properties.getString(key, null);
                if (value != null) {
                    propertyMap.put(key, value);
                }
            }

            JsonObject revision = root.containsKey("revision") ? root.getJsonObject("revision") : null;

            LOGGER.debug("Successfully parsed %d properties for %s %s",
                    propertyMap.size(), type, componentId);
            return new ComponentConfig(type, componentClass, propertyMap, revision);

        } catch (JsonException e) {
            throw new IOException("Failed to parse component response JSON: " + e.getMessage(), e);
        } catch (ClassCastException e) {
            throw new IOException("Invalid JSON structure in component response: " + e.getMessage(), e);
        }
    }

    // -----------------------------------------------------------------------
    // Internal — backward-compatible processor parsing
    // -----------------------------------------------------------------------

    Map<String, String> parseProcessorResponse(String responseBody, String processorId)
            throws IOException {
        return parseComponentResponse(responseBody, processorId, ComponentType.PROCESSOR).properties();
    }

    // -----------------------------------------------------------------------
    // Internal — HTTP + URL building
    // -----------------------------------------------------------------------

    private static void validateComponentId(String componentId) {
        Objects.requireNonNull(componentId, "processorId must not be null");
        if (componentId.trim().isEmpty()) {
            throw new IllegalArgumentException("Processor ID cannot be empty");
        }
        try {
            UUID.fromString(componentId);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Processor ID must be a valid UUID");
        }
    }

    private String buildNiFiApiUrl(String apiPath) {
        String nifiHttpsHost = System.getProperty("nifi.web.https.host");
        String nifiHttpsPort = System.getProperty("nifi.web.https.port");
        String nifiHttpHost = System.getProperty("nifi.web.http.host", "localhost");
        String nifiHttpPort = System.getProperty("nifi.web.http.port", "8080");

        if (nifiHttpsHost != null && nifiHttpsPort != null) {
            return "https://%s:%s/%s".formatted(nifiHttpsHost, nifiHttpsPort, apiPath);
        }
        return "http://%s:%s/%s".formatted(nifiHttpHost, nifiHttpPort, apiPath);
    }

    private HttpResponse<String> executeGet(String url) throws IOException {
        HttpHandler httpHandler = HttpHandler.builder()
                .uri(url)
                .connectionTimeoutSeconds(5)
                .readTimeoutSeconds(10)
                .build();

        try (HttpClient httpClient = httpHandler.createHttpClient()) {
            HttpRequest request = httpHandler.requestBuilder()
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Request to NiFi API was interrupted", e);
        }
    }
}
