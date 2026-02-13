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
 * Utility class for reading NiFi component configuration via the REST API.
 * Supports both processors and controller services.
 */
public class NiFiConfigReader {

    private static final CuiLogger LOGGER = new CuiLogger(NiFiConfigReader.class);
    private static final JsonReaderFactory JSON_READER_FACTORY = Json.createReaderFactory(Map.of());

    /**
     * Retrieves processor properties from NiFi REST API.
     *
     * @param processorId The processor ID (must not be null)
     * @return Map of processor properties (never null)
     * @throws IOException If unable to fetch processor configuration
     */
    public Map<String, String> getProcessorProperties(String processorId) throws IOException {
        return getComponentProperties("processors", processorId);
    }

    /**
     * Retrieves controller service properties from NiFi REST API.
     *
     * @param serviceId The controller service ID (must not be null)
     * @return Map of controller service properties (never null)
     * @throws IOException If unable to fetch controller service configuration
     */
    public Map<String, String> getControllerServiceProperties(String serviceId) throws IOException {
        return getComponentProperties("controller-services", serviceId);
    }

    private Map<String, String> getComponentProperties(String componentType, String componentId) throws IOException {
        Objects.requireNonNull(componentId, "componentId must not be null");
        if (componentId.trim().isEmpty()) {
            throw new IllegalArgumentException("Component ID cannot be empty");
        }
        try {
            UUID.fromString(componentId);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Component ID must be a valid UUID");
        }

        String nifiApiUrl = buildNiFiApiUrl(componentType, componentId);
        LOGGER.debug("Fetching component configuration from: %s", nifiApiUrl);

        HttpHandler httpHandler = HttpHandler.builder()
                .uri(nifiApiUrl)
                .connectionTimeoutSeconds(5)
                .readTimeoutSeconds(10)
                .build();

        HttpResponse<String> response;
        try (HttpClient httpClient = httpHandler.createHttpClient()) {
            HttpRequest request = httpHandler.requestBuilder()
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Request to NiFi API was interrupted", e);
        }

        if (response.statusCode() == 404) {
            throw new IllegalArgumentException("Component not found: " + componentId);
        } else if (response.statusCode() != 200) {
            LOGGER.debug("Failed to fetch component config: HTTP %d - %s", response.statusCode(), response.body());
            throw new IOException("Failed to fetch component config: HTTP " + response.statusCode());
        }

        return parseComponentResponse(response.body(), componentId);
    }

    private String buildNiFiApiUrl(String componentType, String componentId) {
        String nifiHttpsHost = System.getProperty("nifi.web.https.host");
        String nifiHttpsPort = System.getProperty("nifi.web.https.port");
        String nifiHttpHost = System.getProperty("nifi.web.http.host", "localhost");
        String nifiHttpPort = System.getProperty("nifi.web.http.port", "8080");

        if (nifiHttpsHost != null && nifiHttpsPort != null) {
            return "https://%s:%s/nifi-api/%s/%s".formatted(nifiHttpsHost, nifiHttpsPort, componentType, componentId);
        }
        return "http://%s:%s/nifi-api/%s/%s".formatted(nifiHttpHost, nifiHttpPort, componentType, componentId);
    }

    private Map<String, String> parseComponentResponse(String responseBody, String componentId) throws IOException {
        try (JsonReader reader = JSON_READER_FACTORY.createReader(new StringReader(responseBody))) {
            JsonObject root = reader.readObject();
            if (!root.containsKey("component")) {
                throw new IOException("Invalid component response format: missing 'component' field");
            }
            JsonObject component = root.getJsonObject("component");

            // Controller services have properties directly on the component
            // Processors have properties under component.config.properties
            JsonObject properties;
            if (component.containsKey("config")) {
                JsonObject config = component.getJsonObject("config");
                if (!config.containsKey("properties")) {
                    throw new IOException("Invalid component response format: missing 'properties' field");
                }
                properties = config.getJsonObject("properties");
            } else if (component.containsKey("properties")) {
                properties = component.getJsonObject("properties");
            } else {
                throw new IOException("Invalid component response format: no properties found");
            }

            Map<String, String> propertyMap = new HashMap<>();
            for (String key : properties.keySet()) {
                String value = properties.getString(key, null);
                if (value != null) {
                    propertyMap.put(key, value);
                }
            }
            LOGGER.debug("Successfully parsed %d properties for component %s", propertyMap.size(), componentId);
            return propertyMap;
        } catch (JsonException e) {
            throw new IOException("Failed to parse component response JSON: " + e.getMessage(), e);
        } catch (ClassCastException e) {
            throw new IOException("Invalid JSON structure in component response: " + e.getMessage(), e);
        }
    }
}
