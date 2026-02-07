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
package de.cuioss.nifi.processors.auth.config;

import de.cuioss.nifi.processors.auth.JWTPropertyKeys;
import de.cuioss.nifi.processors.auth.util.ErrorContext;
import de.cuioss.sheriff.oauth.core.IssuerConfig;
import de.cuioss.sheriff.oauth.core.ParserConfig;
import de.cuioss.tools.logging.CuiLogger;
import lombok.NonNull;
import lombok.experimental.UtilityClass;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Shared utility for parsing issuer configurations from processor properties.
 * This avoids duplicating logic between the processor and REST endpoints.
 *
 * The parser supports both UI-based configuration (using dynamic properties)
 * and external configuration files.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/configuration-static.adoc">Static Configuration Specification</a>
 */
@UtilityClass
public class IssuerConfigurationParser {

    private static final CuiLogger LOGGER = new CuiLogger(IssuerConfigurationParser.class);

    /**
     * Property key for the maximum token size configuration.
     */
    static final String MAXIMUM_TOKEN_SIZE_KEY = "Maximum Token Size";

    /**
     * Default maximum token size in bytes.
     */
    private static final int DEFAULT_MAX_TOKEN_SIZE = 16384;

    // Property prefixes for UI configuration
    private static final String ISSUER_PREFIX = "issuer.";

    /**
     * Sensitive property keys whose values must be masked in log output.
     */
    private static final Set<String> SENSITIVE_KEYS = Set.of(
            JWTPropertyKeys.Issuer.CLIENT_ID,
            JWTPropertyKeys.Issuer.JWKS_CONTENT,
            "client-secret"
    );

    /**
     * Sanitizes a log value by stripping control characters (newline, carriage return, tab).
     *
     * @param value the value to sanitize
     * @return the sanitized value
     */
    private static String sanitizeLogValue(String value) {
        if (value == null) {
            return "null";
        }
        return value.replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    /**
     * Creates a sanitized summary of issuer properties for logging,
     * masking sensitive values like client-id and jwks-content.
     *
     * @param issuerProps the properties map
     * @return a sanitized string representation
     */
    private static String sanitizePropertiesForLog(Map<String, String> issuerProps) {
        return issuerProps.entrySet().stream()
                .map(e -> sanitizeLogValue(e.getKey()) + "="
                        + (SENSITIVE_KEYS.contains(e.getKey()) ? "***" : sanitizeLogValue(e.getValue())))
                .collect(Collectors.joining(", ", "{", "}"));
    }

    /**
     * Extracts all issuer configurations from processor properties.
     * This method handles both UI-based dynamic properties and external configuration.
     *
     * @param properties The processor's property map
     * @param configurationManager Optional external configuration manager
     * @return List of IssuerConfig objects
     */
    public static List<IssuerConfig> parseIssuerConfigs(@NonNull Map<String, String> properties,
            ConfigurationManager configurationManager) {
        Map<String, Map<String, String>> issuerPropertiesMap = new HashMap<>();
        Set<String> currentIssuerNames = new HashSet<>();

        // First, load external configuration if available (highest precedence)
        if (configurationManager != null && configurationManager.isConfigurationLoaded()) {
            loadExternalConfigurations(configurationManager, issuerPropertiesMap, currentIssuerNames);
        }

        // Then, load UI configuration (lower precedence)
        loadUIConfigurations(properties, issuerPropertiesMap, currentIssuerNames);

        // Process each issuer configuration
        return processIssuerConfigurations(issuerPropertiesMap);
    }

    /**
     * Extracts parser configuration from processor properties.
     *
     * @param properties The processor's property map
     * @return ParserConfig object
     */
    public static ParserConfig parseParserConfig(@NonNull Map<String, String> properties) {
        int maxTokenSize = DEFAULT_MAX_TOKEN_SIZE;
        String tokenSizeValue = properties.getOrDefault(MAXIMUM_TOKEN_SIZE_KEY,
                String.valueOf(DEFAULT_MAX_TOKEN_SIZE));
        try {
            maxTokenSize = Integer.parseInt(tokenSizeValue);
        } catch (NumberFormatException e) {
            LOGGER.warn("Invalid value '%s' for %s, falling back to default %s",
                    sanitizeLogValue(tokenSizeValue), MAXIMUM_TOKEN_SIZE_KEY, DEFAULT_MAX_TOKEN_SIZE);
        }
        return ParserConfig.builder()
                .maxTokenSize(maxTokenSize)
                .build();
    }

    /**
     * Loads issuer configurations from external configuration source.
     */
    private static void loadExternalConfigurations(ConfigurationManager configurationManager,
            Map<String, Map<String, String>> issuerPropertiesMap,
            Set<String> currentIssuerNames) {
        LOGGER.info("Loading issuer configurations from external configuration");

        List<String> externalIssuerIds = configurationManager.getIssuerIds();
        for (String issuerId : externalIssuerIds) {
            currentIssuerNames.add(issuerId);
            Map<String, String> issuerProps = configurationManager.getIssuerProperties(issuerId);
            issuerPropertiesMap.put(issuerId, new HashMap<>(issuerProps));
            LOGGER.debug("Loaded external configuration for issuer %s: %s", sanitizeLogValue(issuerId),
                    sanitizePropertiesForLog(issuerProps));
        }
    }

    /**
     * Loads issuer configurations from UI properties.
     */
    private static void loadUIConfigurations(Map<String, String> properties,
            Map<String, Map<String, String>> issuerPropertiesMap,
            Set<String> currentIssuerNames) {

        // Parse dynamic properties that follow the pattern "issuer.N.property"
        for (Map.Entry<String, String> entry : properties.entrySet()) {
            String propertyName = entry.getKey();
            String propertyValue = entry.getValue();

            if (propertyName.startsWith(ISSUER_PREFIX)) {
                parseIssuerProperty(propertyName, propertyValue, issuerPropertiesMap, currentIssuerNames);
            }
        }
    }

    /**
     * Parses an individual issuer property from UI configuration.
     */
    private static void parseIssuerProperty(String propertyName, String propertyValue,
            Map<String, Map<String, String>> issuerPropertiesMap,
            Set<String> currentIssuerNames) {
        // Format: issuer.N.property (e.g., "issuer.1.name", "issuer.1.jwks.url")
        String issuerPart = propertyName.substring(ISSUER_PREFIX.length());
        int dotIndex = issuerPart.indexOf('.');

        if (dotIndex > 0) {
            String issuerIndex = issuerPart.substring(0, dotIndex);
            String property = issuerPart.substring(dotIndex + 1);

            // Track current issuer names for cache cleanup
            currentIssuerNames.add(issuerIndex);

            // Store in issuer properties map (always create entry regardless of property order)
            Map<String, String> issuerProps = issuerPropertiesMap.computeIfAbsent(issuerIndex, k -> new HashMap<>());
            issuerProps.put(property, propertyValue);

            LOGGER.debug("Parsed UI property for issuer %s: %s = %s", sanitizeLogValue(issuerIndex),
                    sanitizeLogValue(property),
                    SENSITIVE_KEYS.contains(property) ? "***" : sanitizeLogValue(propertyValue));
        }
    }

    /**
     * Processes issuer configurations and creates IssuerConfig objects.
     */
    private static List<IssuerConfig> processIssuerConfigurations(Map<String, Map<String, String>> issuerPropertiesMap) {
        List<IssuerConfig> issuerConfigs = new ArrayList<>();

        for (Map.Entry<String, Map<String, String>> entry : issuerPropertiesMap.entrySet()) {
            String issuerId = entry.getKey();
            Map<String, String> issuerProps = entry.getValue();

            try {
                createIssuerConfig(issuerId, issuerProps).ifPresent(issuerConfig -> {
                    issuerConfigs.add(issuerConfig);
                    LOGGER.info("Created issuer configuration for %s", sanitizeLogValue(issuerId));
                });
            } catch (IllegalStateException | IllegalArgumentException e) {
                // Catch configuration creation errors
                String contextMessage = ErrorContext.forComponent("IssuerConfigurationParser")
                        .operation("parseIssuers")
                        .errorCode(ErrorContext.ErrorCodes.CONFIGURATION_ERROR)
                        .cause(e)
                        .build()
                        .with("issuerId", issuerId)
                        .with("issuerName", issuerProps.get("name"))
                        .with("jwksUrl", issuerProps.get(JWTPropertyKeys.Issuer.JWKS_URL))
                        .buildMessage("Failed to create issuer configuration");

                LOGGER.error(e, contextMessage);
            }
        }

        return issuerConfigs;
    }

    /**
     * Creates an IssuerConfig from properties.
     *
     * @param issuerId    the issuer identifier
     * @param issuerProps the issuer properties
     * @return an Optional containing the IssuerConfig, or empty if the issuer should be skipped
     */
    private static Optional<IssuerConfig> createIssuerConfig(String issuerId, Map<String, String> issuerProps) {
        // Check if issuer is enabled (default to true if not specified)
        String enabledValue = issuerProps.get("enabled");
        if ("false".equalsIgnoreCase(enabledValue)) {
            LOGGER.info("Issuer %s is disabled, skipping", sanitizeLogValue(issuerId));
            return Optional.empty();
        }

        // Get issuer name (required) - use either "name" or "issuer" property
        String issuerName = issuerProps.get("name");
        if (issuerName == null || issuerName.trim().isEmpty()) {
            issuerName = issuerProps.get(JWTPropertyKeys.Issuer.ISSUER_NAME);
        }
        if (issuerName == null || issuerName.trim().isEmpty()) {
            LOGGER.warn("Issuer %s has no name configured, skipping", sanitizeLogValue(issuerId));
            return Optional.empty();
        }

        // Create builder using the same pattern as the processor
        String jwksUrl = issuerProps.get(JWTPropertyKeys.Issuer.JWKS_URL);
        String jwksFile = issuerProps.get(JWTPropertyKeys.Issuer.JWKS_FILE);
        String jwksContent = issuerProps.get(JWTPropertyKeys.Issuer.JWKS_CONTENT);

        // Also check for 'jwksUri' which is used in YAML external configuration
        String jwksUri = issuerProps.get("jwksUri");

        // Determine JWKS source - at least one is required
        String jwksSource;
        if (jwksUrl != null && !jwksUrl.trim().isEmpty()) {
            jwksSource = jwksUrl.trim();
        } else if (jwksUri != null && !jwksUri.trim().isEmpty()) {
            // YAML configuration uses 'jwksUri' instead of 'jwks-url'
            jwksSource = jwksUri.trim();
        } else if (jwksFile != null && !jwksFile.trim().isEmpty()) {
            jwksSource = jwksFile.trim();
        } else if (jwksContent != null && !jwksContent.trim().isEmpty()) {
            // For content, we would need a different approach
            LOGGER.warn("JWKS content configuration not yet supported in shared parser for issuer %s",
                    sanitizeLogValue(issuerId));
            return Optional.empty();
        } else {
            LOGGER.warn("Issuer %s has no JWKS source configured (URL, file, or content), skipping",
                    sanitizeLogValue(issuerId));
            return Optional.empty();
        }

        // Build the issuer config using the same pattern as the processor
        var builder = IssuerConfig.builder()
                .issuerIdentifier(issuerName.trim())
                .jwksFilePath(jwksSource);

        // Add optional properties
        String audience = issuerProps.get(JWTPropertyKeys.Issuer.AUDIENCE);
        if (audience != null && !audience.trim().isEmpty()) {
            builder.expectedAudience(audience.trim());
        }

        String clientId = issuerProps.get(JWTPropertyKeys.Issuer.CLIENT_ID);
        if (clientId != null && !clientId.trim().isEmpty()) {
            builder.expectedClientId(clientId.trim());
        }

        return Optional.of(builder.build());
    }

    /**
     * Creates a map of processor properties from a ProcessContext.
     * This is a helper method for servlets that need to convert NiFi's ProcessContext
     * to a simple Map that can be used with this parser.
     *
     * @param processorProperties Map from NiFi REST API response
     * @return Simple property map
     */
    public static Map<String, String> extractPropertiesFromProcessorDTO(@NonNull Map<String, String> processorProperties) {
        // The processor properties from REST API are already in the correct format
        return new HashMap<>(processorProperties);
    }
}