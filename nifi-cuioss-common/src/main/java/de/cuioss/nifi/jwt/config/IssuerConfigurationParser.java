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
package de.cuioss.nifi.jwt.config;

import de.cuioss.nifi.jwt.JWTAttributes;
import de.cuioss.nifi.jwt.JWTPropertyKeys;
import de.cuioss.nifi.jwt.JwtConstants;
import de.cuioss.nifi.jwt.JwtLogMessages;
import de.cuioss.nifi.jwt.util.ErrorContext;
import de.cuioss.sheriff.oauth.core.IssuerConfig;
import de.cuioss.sheriff.oauth.core.ParserConfig;
import de.cuioss.sheriff.oauth.core.jwks.http.HttpJwksLoaderConfig;
import de.cuioss.tools.logging.CuiLogger;
import lombok.experimental.UtilityClass;
import org.jspecify.annotations.Nullable;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Shared utility for parsing issuer configurations from properties.
 * Supports both UI-based dynamic properties and external configuration files.
 */
@UtilityClass
public class IssuerConfigurationParser {

    private static final CuiLogger LOGGER = new CuiLogger(IssuerConfigurationParser.class);

    static final String MAXIMUM_TOKEN_SIZE_KEY = "Maximum Token Size";
    private static final int DEFAULT_MAX_TOKEN_SIZE = 16384;

    private static final Set<String> SENSITIVE_KEYS = Set.of(
            JWTPropertyKeys.Issuer.CLIENT_ID,
            JWTPropertyKeys.Issuer.JWKS_CONTENT,
            "client-secret"
    );

    private static String sanitizeLogValue(@Nullable String value) {
        if (value == null) {
            return "null";
        }
        return value.replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    private static String sanitizePropertiesForLog(Map<String, String> issuerProps) {
        return issuerProps.entrySet().stream()
                .map(e -> sanitizeLogValue(e.getKey()) + "="
                        + (SENSITIVE_KEYS.contains(e.getKey()) ? "***" : sanitizeLogValue(e.getValue())))
                .collect(Collectors.joining(", ", "{", "}"));
    }

    public static List<IssuerConfig> parseIssuerConfigs(Map<String, String> properties,
            ConfigurationManager configurationManager) {
        return parseIssuerConfigs(properties, configurationManager, null);
    }

    public static List<IssuerConfig> parseIssuerConfigs(Map<String, String> properties,
            ConfigurationManager configurationManager,
            @Nullable ParserConfig parserConfig) {
        Objects.requireNonNull(properties, "properties must not be null");
        Map<String, Map<String, String>> issuerPropertiesMap = new HashMap<>();

        if (configurationManager != null && configurationManager.isConfigurationLoaded()) {
            loadExternalConfigurations(configurationManager, issuerPropertiesMap);
        }

        loadUIConfigurations(properties, issuerPropertiesMap);
        return processIssuerConfigurations(issuerPropertiesMap, properties, parserConfig);
    }

    public static ParserConfig parseParserConfig(Map<String, String> properties) {
        Objects.requireNonNull(properties, "properties must not be null");
        int maxTokenSize = DEFAULT_MAX_TOKEN_SIZE;
        String tokenSizeValue = properties.getOrDefault(MAXIMUM_TOKEN_SIZE_KEY,
                String.valueOf(DEFAULT_MAX_TOKEN_SIZE));
        try {
            maxTokenSize = Integer.parseInt(tokenSizeValue);
        } catch (NumberFormatException e) {
            LOGGER.warn(JwtLogMessages.WARN.INVALID_CONFIG_VALUE,
                    sanitizeLogValue(tokenSizeValue), MAXIMUM_TOKEN_SIZE_KEY, DEFAULT_MAX_TOKEN_SIZE);
        }
        return ParserConfig.builder()
                .maxTokenSize(maxTokenSize)
                .build();
    }

    private static void loadExternalConfigurations(ConfigurationManager configurationManager,
            Map<String, Map<String, String>> issuerPropertiesMap) {
        LOGGER.info(JwtLogMessages.INFO.LOADING_EXTERNAL_CONFIGS);
        List<String> externalIssuerIds = configurationManager.getIssuerIds();
        for (String issuerId : externalIssuerIds) {
            Map<String, String> issuerProps = configurationManager.getIssuerProperties(issuerId);
            issuerPropertiesMap.put(issuerId, new HashMap<>(issuerProps));
            LOGGER.debug("Loaded external configuration for issuer %s: %s", sanitizeLogValue(issuerId),
                    sanitizePropertiesForLog(issuerProps));
        }
    }

    private static void loadUIConfigurations(Map<String, String> properties,
            Map<String, Map<String, String>> issuerPropertiesMap) {
        for (Map.Entry<String, String> entry : properties.entrySet()) {
            String propertyName = entry.getKey();
            String propertyValue = entry.getValue();
            if (propertyName.startsWith(JwtConstants.ISSUER_PREFIX)) {
                parseIssuerProperty(propertyName, propertyValue, issuerPropertiesMap);
            }
        }
    }

    private static void parseIssuerProperty(String propertyName, String propertyValue,
            Map<String, Map<String, String>> issuerPropertiesMap) {
        String issuerPart = propertyName.substring(JwtConstants.ISSUER_PREFIX.length());
        int dotIndex = issuerPart.indexOf('.');
        if (dotIndex > 0) {
            String issuerIndex = issuerPart.substring(0, dotIndex);
            String property = issuerPart.substring(dotIndex + 1);
            Map<String, String> issuerProps = issuerPropertiesMap.computeIfAbsent(issuerIndex, k -> new HashMap<>());
            issuerProps.put(property, propertyValue);
            LOGGER.debug("Parsed UI property for issuer %s: %s = %s", sanitizeLogValue(issuerIndex),
                    sanitizeLogValue(property),
                    SENSITIVE_KEYS.contains(property) ? "***" : sanitizeLogValue(propertyValue));
        }
    }

    private static List<IssuerConfig> processIssuerConfigurations(
            Map<String, Map<String, String>> issuerPropertiesMap, Map<String, String> globalProperties,
            @Nullable ParserConfig parserConfig) {
        List<IssuerConfig> issuerConfigs = new ArrayList<>();
        for (Map.Entry<String, Map<String, String>> entry : issuerPropertiesMap.entrySet()) {
            String issuerId = entry.getKey();
            Map<String, String> issuerProps = entry.getValue();
            try {
                createIssuerConfig(issuerId, issuerProps, globalProperties, parserConfig).ifPresent(issuerConfig -> {
                    issuerConfigs.add(issuerConfig);
                    LOGGER.info(JwtLogMessages.INFO.CREATED_ISSUER_CONFIG_FOR, sanitizeLogValue(issuerId));
                });
            } catch (IllegalStateException | IllegalArgumentException e) {
                String contextMessage = ErrorContext.forComponent("IssuerConfigurationParser")
                        .operation("parseIssuers")
                        .errorCode(ErrorContext.ErrorCodes.CONFIGURATION_ERROR)
                        .cause(e)
                        .build()
                        .with("issuerId", issuerId)
                        .with("issuerName", issuerProps.get("name"))
                        .with("jwksUrl", issuerProps.get(JWTPropertyKeys.Issuer.JWKS_URL))
                        .buildMessage("Failed to create issuer configuration");
                LOGGER.error(e, JwtLogMessages.ERROR.ISSUER_CONFIG_PARSE_ERROR);
                LOGGER.debug(contextMessage);
            }
        }
        return issuerConfigs;
    }

    private static Optional<IssuerConfig> createIssuerConfig(String issuerId,
            Map<String, String> issuerProps, Map<String, String> globalProperties,
            @Nullable ParserConfig parserConfig) {
        String enabledValue = issuerProps.get("enabled");
        if ("false".equalsIgnoreCase(enabledValue)) {
            LOGGER.info(JwtLogMessages.INFO.ISSUER_DISABLED, sanitizeLogValue(issuerId));
            return Optional.empty();
        }
        Optional<String> issuerName = resolveIssuerName(issuerId, issuerProps);
        if (issuerName.isEmpty()) {
            return Optional.empty();
        }
        Optional<String> jwksSource = resolveJwksSource(issuerId, issuerProps);
        if (jwksSource.isEmpty()) {
            return Optional.empty();
        }
        var builder = IssuerConfig.builder()
                .issuerIdentifier(issuerName.get());
        String jwksType = resolveJwksType(issuerProps);
        if ("url".equals(jwksType)) {
            var httpConfigBuilder = HttpJwksLoaderConfig.builder()
                    .jwksUrl(jwksSource.get())
                    .issuerIdentifier(issuerName.get());
            if (parserConfig != null) {
                httpConfigBuilder.parserConfig(parserConfig);
            }
            applyGlobalJwksSettings(httpConfigBuilder, globalProperties);
            builder.httpJwksLoaderConfig(httpConfigBuilder.build());
        } else {
            builder.jwksFilePath(jwksSource.get());
        }
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

    private static Optional<String> resolveIssuerName(String issuerId, Map<String, String> issuerProps) {
        String issuerName = issuerProps.get("name");
        if (issuerName == null || issuerName.trim().isEmpty()) {
            issuerName = issuerProps.get(JWTPropertyKeys.Issuer.ISSUER_NAME);
        }
        if (issuerName == null || issuerName.trim().isEmpty()) {
            LOGGER.warn(JwtLogMessages.WARN.ISSUER_NO_NAME, sanitizeLogValue(issuerId));
            return Optional.empty();
        }
        return Optional.of(issuerName.trim());
    }

    private static Optional<String> resolveJwksSource(String issuerId, Map<String, String> issuerProps) {
        String jwksUrl = issuerProps.get(JWTPropertyKeys.Issuer.JWKS_URL);
        if (jwksUrl != null && !jwksUrl.trim().isEmpty()) {
            return Optional.of(jwksUrl.trim());
        }
        String jwksUri = issuerProps.get("jwksUri");
        if (jwksUri != null && !jwksUri.trim().isEmpty()) {
            return Optional.of(jwksUri.trim());
        }
        String jwksFile = issuerProps.get(JWTPropertyKeys.Issuer.JWKS_FILE);
        if (jwksFile != null && !jwksFile.trim().isEmpty()) {
            return Optional.of(jwksFile.trim());
        }
        String jwksContent = issuerProps.get(JWTPropertyKeys.Issuer.JWKS_CONTENT);
        if (jwksContent != null && !jwksContent.trim().isEmpty()) {
            LOGGER.warn(JwtLogMessages.WARN.JWKS_CONTENT_NOT_SUPPORTED, sanitizeLogValue(issuerId));
            return Optional.empty();
        }
        LOGGER.warn(JwtLogMessages.WARN.ISSUER_NO_JWKS_SOURCE, sanitizeLogValue(issuerId));
        return Optional.empty();
    }

    private static String resolveJwksType(Map<String, String> issuerProps) {
        String explicitType = issuerProps.get(JWTPropertyKeys.Issuer.JWKS_TYPE);
        if (explicitType != null && !explicitType.trim().isEmpty()) {
            return explicitType.trim().toLowerCase(Locale.ROOT);
        }
        String jwksUrl = issuerProps.get(JWTPropertyKeys.Issuer.JWKS_URL);
        if (jwksUrl != null && !jwksUrl.trim().isEmpty()) {
            return "url";
        }
        String jwksUri = issuerProps.get("jwksUri");
        if (jwksUri != null && !jwksUri.trim().isEmpty()) {
            return "url";
        }
        return "file";
    }

    private static void applyGlobalJwksSettings(
            HttpJwksLoaderConfig.HttpJwksLoaderConfigBuilder builder,
            Map<String, String> globalProperties) {
        String refreshInterval = globalProperties.get(JWTAttributes.Properties.Validation.JWKS_REFRESH_INTERVAL);
        if (refreshInterval != null && !refreshInterval.isBlank()) {
            try {
                builder.refreshIntervalSeconds(Integer.parseInt(refreshInterval));
            } catch (NumberFormatException e) {
                LOGGER.warn(JwtLogMessages.WARN.INVALID_CONFIG_VALUE,
                        sanitizeLogValue(refreshInterval), "JWKS Refresh Interval", 3600);
            }
        }
        String connectionTimeout = globalProperties.get(JWTAttributes.Properties.Validation.JWKS_CONNECTION_TIMEOUT);
        if (connectionTimeout != null && !connectionTimeout.isBlank()) {
            try {
                builder.connectTimeoutSeconds(Integer.parseInt(connectionTimeout));
            } catch (NumberFormatException e) {
                LOGGER.warn(JwtLogMessages.WARN.INVALID_CONFIG_VALUE,
                        sanitizeLogValue(connectionTimeout), "JWKS Connection Timeout", 10);
            }
        }
    }

}
