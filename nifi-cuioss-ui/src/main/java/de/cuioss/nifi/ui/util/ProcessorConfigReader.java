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
 * Utility class for reading processor configuration via NiFi's REST API.
 * This class handles the communication with NiFi to retrieve processor properties
 * that are needed for JWT validation.
 *
 * <p><strong>Design Decision:</strong> Uses cuiHttp's HttpHandler for HTTP communication
 * instead of direct HttpClient usage. This provides automatic SSL context management
 * and consistent timeout handling across the application.</p>
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/security.adoc">Security Specification</a>
 */
public class ProcessorConfigReader {

    private static final CuiLogger LOGGER = new CuiLogger(ProcessorConfigReader.class);
    private static final JsonReaderFactory JSON_READER_FACTORY = Json.createReaderFactory(Map.of());

    /**
     * Retrieves processor properties from NiFi REST API.
     *
     * @param processorId The processor ID (must not be null)
     * @return Map of processor properties (never null)
     * @throws IOException If unable to fetch processor configuration
     * @throws IllegalArgumentException If processor ID is invalid or null
     */
    public Map<String, String> getProcessorProperties(String processorId)
            throws IOException, IllegalArgumentException {

        Objects.requireNonNull(processorId, "processorId must not be null");
        if (processorId.trim().isEmpty()) {
            throw new IllegalArgumentException("Processor ID cannot be empty");
        }
        // Validate processor ID is a valid UUID to prevent URL injection
        try {
            UUID.fromString(processorId);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Processor ID must be a valid UUID");
        }

        // Build NiFi API URL
        String nifiApiUrl = buildNiFiApiUrl(processorId);
        LOGGER.debug("Fetching processor configuration from: %s", nifiApiUrl);

        // Create HTTP handler with appropriate timeouts
        HttpHandler httpHandler = HttpHandler.builder()
                .uri(nifiApiUrl)
                .connectionTimeoutSeconds(5)
                .readTimeoutSeconds(10)
                .build();

        // Execute HTTP request
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

        // Check response status
        if (response.statusCode() == 404) {
            throw new IllegalArgumentException("Processor not found: " + processorId);
        } else if (response.statusCode() != 200) {
            LOGGER.debug("Failed to fetch processor config: HTTP %d - %s", response.statusCode(), response.body());
            throw new IOException("Failed to fetch processor config: HTTP " + response.statusCode());
        }

        // Parse JSON response
        return parseProcessorResponse(response.body(), processorId);
    }

    /**
     * Builds the NiFi API URL for fetching processor configuration.
     * Automatically detects whether NiFi is running on HTTP or HTTPS.
     */
    private String buildNiFiApiUrl(String processorId) {
        // Determine if HTTPS is enabled based on system properties
        String nifiHttpsHost = System.getProperty("nifi.web.https.host");
        String nifiHttpsPort = System.getProperty("nifi.web.https.port");
        String nifiHttpHost = System.getProperty("nifi.web.http.host", "localhost");
        String nifiHttpPort = System.getProperty("nifi.web.http.port", "8080");

        String nifiApiUrl;
        if (nifiHttpsHost != null && nifiHttpsPort != null) {
            nifiApiUrl = "https://%s:%s/nifi-api/processors/%s".formatted(
                    nifiHttpsHost, nifiHttpsPort, processorId);
        } else {
            nifiApiUrl = "http://%s:%s/nifi-api/processors/%s".formatted(
                    nifiHttpHost, nifiHttpPort, processorId);
        }

        return nifiApiUrl;
    }

    /**
     * Parses the JSON response from NiFi API and extracts processor properties.
     */
    private Map<String, String> parseProcessorResponse(String responseBody, String processorId)
            throws IOException {

        try (JsonReader reader = JSON_READER_FACTORY.createReader(new StringReader(responseBody))) {
            JsonObject root = reader.readObject();

            // Navigate to processor properties: root.component.config.properties
            if (!root.containsKey("component")) {
                throw new IOException("Invalid processor response format: missing 'component' field");
            }

            JsonObject component = root.getJsonObject("component");
            if (!component.containsKey("config")) {
                throw new IOException("Invalid processor response format: missing 'config' field");
            }

            JsonObject config = component.getJsonObject("config");
            if (!config.containsKey("properties")) {
                throw new IOException("Invalid processor response format: missing 'properties' field");
            }

            JsonObject properties = config.getJsonObject("properties");

            // Convert JsonObject to Map<String, String>
            Map<String, String> propertyMap = new HashMap<>();
            for (String key : properties.keySet()) {
                String value = properties.getString(key, null);
                if (value != null) {
                    propertyMap.put(key, value);
                }
            }

            LOGGER.debug("Successfully parsed %d properties for processor %s", propertyMap.size(), processorId);
            return propertyMap;

        } catch (JsonException e) {
            throw new IOException("Failed to parse processor response JSON: " + e.getMessage(), e);
        } catch (ClassCastException e) {
            throw new IOException("Invalid JSON structure in processor response: " + e.getMessage(), e);
        }
    }
}