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
import jakarta.servlet.http.HttpServletRequest;
import org.apache.nifi.web.*;

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

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    private ComponentDetails fetchDetails(String componentId, UiExtensionType extensionType,
                                          HttpServletRequest request) {
        NiFiWebRequestContext requestContext = new HttpServletRequestContext(extensionType, request) {
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
