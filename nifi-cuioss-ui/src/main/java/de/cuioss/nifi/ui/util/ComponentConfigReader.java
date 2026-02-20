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

import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonReaderFactory;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.nifi.web.*;
import org.jspecify.annotations.Nullable;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.IOException;
import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Utility class for reading NiFi component configuration via the framework's
 * internal {@link NiFiWebConfigurationContext} API. This provides proper
 * authentication (NiFi handles auth using the request's security context)
 * and direct in-JVM access without network round-trips.
 *
 * <p>Supports both processors and controller services, auto-detecting the
 * component type by trying the processor API first, then falling back
 * to the controller service API.</p>
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/security.adoc">Security Specification</a>
 */
public class ComponentConfigReader {

    private static final CuiLogger LOGGER = new CuiLogger(ComponentConfigReader.class);

    /** NiFi component types. */
    public enum ComponentType {
        PROCESSOR, CONTROLLER_SERVICE
    }

    /**
     * Immutable configuration snapshot of a NiFi component.
     *
     * @param type           the component type (processor or controller service)
     * @param componentClass the fully qualified class name
     * @param properties     the component properties
     */
    public record ComponentConfig(
            ComponentType type,
            String componentClass,
            Map<String, String> properties) {
    }

    private final NiFiWebConfigurationContext configContext;

    /**
     * Creates a new reader backed by the given NiFi configuration context.
     *
     * @param configContext the NiFi web configuration context (never null)
     */
    public ComponentConfigReader(NiFiWebConfigurationContext configContext) {
        this.configContext = Objects.requireNonNull(configContext, "configContext must not be null");
    }

    /**
     * Auto-detects the component type and retrieves its configuration.
     * Tries the processor API first, then falls back to controller service.
     *
     * @param componentId the NiFi component ID (must be a valid UUID)
     * @param request     the current HTTP servlet request (for authentication context)
     * @return the component configuration (never null)
     * @throws IllegalArgumentException if the component is not found or the ID is invalid
     */
    public ComponentConfig getComponentConfig(String componentId, HttpServletRequest request) {
        validateComponentId(componentId);

        // Try processor first
        try {
            ComponentDetails details = fetchDetails(componentId,
                    UiExtensionType.ProcessorConfiguration, request);
            LOGGER.debug("Found processor configuration for %s", componentId);
            return toComponentConfig(details, ComponentType.PROCESSOR);
        } catch (ResourceNotFoundException processorNotFound) {
            // Try controller service
            try {
                ComponentDetails details = fetchDetails(componentId,
                        UiExtensionType.ControllerServiceConfiguration, request);
                LOGGER.debug("Found controller service configuration for %s", componentId);
                return toComponentConfig(details, ComponentType.CONTROLLER_SERVICE);
            } catch (ResourceNotFoundException csNotFound) {
                throw new IllegalArgumentException(
                        "Component not found: " + componentId
                                + " (tried both processor and controller-service APIs)");
            }
        }
    }

    /**
     * Retrieves processor properties using NiFi's internal API.
     *
     * @param processorId The processor ID (must not be null, must be a valid UUID)
     * @param request     the current HTTP servlet request (for authentication context)
     * @return Map of processor properties (never null)
     * @throws IllegalArgumentException If processor ID is invalid, null, or component not found
     */
    public Map<String, String> getProcessorProperties(String processorId, HttpServletRequest request) {
        validateComponentId(processorId);
        return getComponentConfig(processorId, request).properties();
    }

    /**
     * Fetches controller service properties via NiFi's REST API as a fallback
     * when the internal {@link NiFiWebConfigurationContext} API returns empty
     * properties (which happens when a processor WAR accesses a controller
     * service in certain authentication contexts).
     *
     * @param controllerServiceId the controller service UUID
     * @param request             the current HTTP request (auth context is forwarded)
     * @return the controller service properties, or empty map on failure
     */
    public Map<String, String> getControllerServicePropertiesViaRest(
            String controllerServiceId, HttpServletRequest request) {
        return getComponentPropertiesViaRest("controller-services", controllerServiceId, request);
    }

    /**
     * Fetches processor properties via NiFi's REST API as a fallback
     * when the internal {@link NiFiWebConfigurationContext} API returns
     * redacted controller service reference values (which happens when
     * a processor WAR accesses its own configuration in certain contexts).
     *
     * @param processorId the processor UUID
     * @param request     the current HTTP request (auth context is forwarded)
     * @return the processor properties, or empty map on failure
     */
    public Map<String, String> getProcessorPropertiesViaRest(
            String processorId, HttpServletRequest request) {
        return getComponentPropertiesViaRest("processors", processorId, request);
    }

    /**
     * Fetches component properties via NiFi's REST API. Both processor
     * and controller service responses share the same JSON structure:
     * {@code {component: {properties: {...}}}}.
     *
     * <p>The REST API URL uses the local server address ({@code request.getLocalPort()})
     * rather than the remote/proxy address ({@code request.getServerPort()}) because
     * the servlet runs inside the NiFi JVM and needs to reach the local NiFi REST API,
     * not the external proxy/Docker-mapped port.</p>
     *
     * @param apiPathSegment "processors" or "controller-services"
     * @param componentId    the component UUID
     * @param request        the current HTTP request (auth context is forwarded)
     * @return the component properties, or empty map on failure
     */
    private Map<String, String> getComponentPropertiesViaRest(
            String apiPathSegment, String componentId, HttpServletRequest request) {
        validateComponentId(componentId);

        // Use the local server address (inside the JVM) rather than the
        // external/proxy address to reach NiFi's own REST API reliably.
        String baseUrl = request.getScheme() + "://localhost:" + request.getLocalPort();
        String apiUrl = baseUrl + "/nifi-api/" + apiPathSegment + "/" + componentId;

        LOGGER.debug("Fetching component %s via REST API: %s", componentId, apiUrl);

        try {
            HttpClient client = buildTrustAllHttpClient();
            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .GET()
                    .timeout(Duration.ofSeconds(10));

            // Forward authentication: prefer Authorization header, fall back
            // to extracting the JWT from NiFi's __Secure-Authorization-Bearer
            // cookie. The Custom UI iframe uses cookie-based auth (no header),
            // so the cookie extraction is essential for E2E browser contexts.
            String resolvedAuth = resolveAuthHeader(request);
            if (resolvedAuth != null) {
                reqBuilder.header("Authorization", resolvedAuth);
            } else {
                LOGGER.warn("No auth credentials available for REST API fallback "
                        + "(no Authorization header, no %s cookie)", NIFI_AUTH_COOKIE);
            }

            // Forward cookies as additional auth context
            addCookieHeader(reqBuilder, request);

            HttpResponse<String> response = client.send(
                    reqBuilder.build(), HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                LOGGER.warn("REST API returned %s for component %s (auth: %s)",
                        response.statusCode(), componentId,
                        resolvedAuth != null ? "present" : "none");
                return Map.of();
            }

            Map<String, String> result = parseComponentProperties(response.body());
            LOGGER.debug("REST API returned %s properties for component %s",
                    result.size(), componentId);
            return result;
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            LOGGER.warn("REST API call failed for component %s: %s",
                    componentId, e.getMessage());
            return Map.of();
        }
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    private static final JsonReaderFactory JSON_READER = Json.createReaderFactory(Map.of());
    private static final String JSON_VALUE_KEY = "value";

    /**
     * Parses component properties from a NiFi REST API response. Handles both
     * processor and controller service JSON structures:
     * <ul>
     *   <li>Controller services: {@code component.properties}</li>
     *   <li>Processors: {@code component.config.properties}</li>
     * </ul>
     *
     * <p>NiFi returns controller service reference properties with null values
     * in {@code properties}. The actual CS UUID is found in
     * {@code descriptors.<key>.allowableValues[0].allowableValue.value}.
     * This method resolves null CS references from descriptors.</p>
     */
    private static Map<String, String> parseComponentProperties(String jsonBody) {
        try (var reader = JSON_READER.createReader(new StringReader(jsonBody))) {
            JsonObject root = reader.readObject();
            JsonObject component = root.getJsonObject("component");
            if (component == null) {
                return Map.of();
            }

            // Locate properties and descriptors — structure differs by component type
            JsonObject config = component.getJsonObject("config");
            JsonObject properties = (config != null)
                    ? config.getJsonObject("properties")
                    : component.getJsonObject("properties");
            if (properties == null) {
                return Map.of();
            }

            JsonObject descriptors = (config != null)
                    ? config.getJsonObject("descriptors")
                    : component.getJsonObject("descriptors");

            Map<String, String> result = new HashMap<>();
            for (String key : properties.keySet()) {
                if (!properties.isNull(key)) {
                    result.put(key, properties.getString(key));
                } else {
                    // NiFi returns null for controller service references in the
                    // properties map. Resolve from descriptors.allowableValues.
                    String csValue = resolveControllerServiceFromDescriptors(
                            key, descriptors);
                    if (!csValue.isEmpty()) {
                        result.put(key, csValue);
                    }
                }
            }
            return result;
        } catch (Exception e) {
            LOGGER.warn("Failed to parse REST API response: %s", e.getMessage());
            return Map.of();
        }
    }

    /**
     * Resolves a controller service UUID from NiFi REST API descriptors.
     * When a property {@code identifiesControllerService}, its value in
     * {@code properties} is null, but the configured CS UUID is in
     * {@code descriptors.<key>.allowableValues[0].allowableValue.value}.
     *
     * @param key         the property key
     * @param descriptors the descriptors JSON object (may be null)
     * @return the controller service UUID, or empty string if not a CS reference
     */
    private static String resolveControllerServiceFromDescriptors(
            String key, @Nullable JsonObject descriptors) {
        if (descriptors == null) {
            return "";
        }
        JsonObject descriptor = descriptors.getJsonObject(key);
        if (descriptor == null || !descriptor.containsKey("identifiesControllerService")) {
            return "";
        }
        // CS reference with a single allowable value → that's the configured CS
        var allowableValues = descriptor.getJsonArray("allowableValues");
        if (allowableValues != null && allowableValues.size() == 1) {
            JsonObject avWrapper = allowableValues.getJsonObject(0);
            JsonObject av = avWrapper.getJsonObject("allowableValue");
            if (av != null && av.containsKey(JSON_VALUE_KEY) && !av.isNull(JSON_VALUE_KEY)) {
                String csId = av.getString(JSON_VALUE_KEY);
                LOGGER.debug("Resolved CS reference '%s' = '%s' from descriptors", key, csId);
                return csId;
            }
        }
        return "";
    }

    /**
     * NiFi's authentication cookie name. The value is a JWT that NiFi accepts
     * as a Bearer token via its {@code StandardBearerTokenResolver}.
     */
    private static final String NIFI_AUTH_COOKIE = "__Secure-Authorization-Bearer";

    /**
     * Resolves the authorization header value. Prefers the Authorization header
     * from the request, falls back to extracting a Bearer token from NiFi's
     * authentication cookie.
     *
     * @return the resolved auth header value, or null if no auth is available
     */
    @Nullable
    private static String resolveAuthHeader(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && !header.isBlank()) {
            return header;
        }
        // Fall back to NiFi's authentication cookie
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (NIFI_AUTH_COOKIE.equals(cookie.getName())) {
                    String jwt = cookie.getValue();
                    if (jwt != null && !jwt.isBlank()) {
                        LOGGER.debug("Extracted Bearer token from %s cookie", NIFI_AUTH_COOKIE);
                        return "Bearer " + jwt;
                    }
                }
            }
        }
        return null;
    }

    /**
     * Adds a Cookie header to the request builder if cookies are present.
     */
    private static void addCookieHeader(HttpRequest.Builder reqBuilder, HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null || cookies.length == 0) {
            return;
        }
        StringBuilder sb = new StringBuilder();
        for (Cookie cookie : cookies) {
            if (!sb.isEmpty()) {
                sb.append("; ");
            }
            sb.append(cookie.getName()).append("=").append(cookie.getValue());
        }
        reqBuilder.header("Cookie", sb.toString());
    }

    @SuppressWarnings("java:S4830") // Trust-all is required: NiFi uses self-signed certs in Docker
    private static HttpClient buildTrustAllHttpClient() {
        try {
            TrustManager[] trustAllCerts = {new X509TrustManager() {
                @Override
                public X509Certificate[] getAcceptedIssuers() {
                    return new X509Certificate[0];
                }

                @Override
                public void checkClientTrusted(X509Certificate[] certs, String authType) {
                    // Trust all — required for NiFi's self-signed certificates
                }

                @Override
                public void checkServerTrusted(X509Certificate[] certs, String authType) {
                    // Trust all — required for NiFi's self-signed certificates
                }
            }};

            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustAllCerts, new SecureRandom());

            return HttpClient.newBuilder()
                    .sslContext(sslContext)
                    .connectTimeout(Duration.ofSeconds(5))
                    .build();
        } catch (NoSuchAlgorithmException | KeyManagementException e) {
            throw new IllegalStateException("Failed to create trust-all HTTP client", e);
        }
    }

    private ComponentDetails fetchDetails(String componentId, UiExtensionType extensionType,
                                          HttpServletRequest request) {
        // Implement NiFiWebRequestContext directly instead of using HttpServletRequestContext
        // from nifi-custom-ui-utils, which is not available in the Custom UI WAR classloader.
        NiFiWebRequestContext requestContext = new NiFiWebRequestContext() {
            @Override
            public UiExtensionType getExtensionType() {
                return extensionType;
            }

            @Override
            public String getScheme() {
                return request.getScheme();
            }

            @Override
            public String getId() {
                return componentId;
            }
        };
        return configContext.getComponentDetails(requestContext);
    }

    private static ComponentConfig toComponentConfig(ComponentDetails details, ComponentType type) {
        Map<String, String> properties = details.getProperties();
        if (properties == null) {
            properties = Map.of();
        }
        return new ComponentConfig(type, details.getType(), properties);
    }

    static void validateComponentId(String componentId) {
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
}
