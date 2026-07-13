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

import de.cuioss.nifi.jwt.JwtAttributes;
import de.cuioss.nifi.jwt.JwtConstants;
import de.cuioss.nifi.jwt.JwtLogMessages;
import de.cuioss.nifi.jwt.JwtPropertyKeys;
import de.cuioss.nifi.jwt.util.DynamicPropertyGroupParser;
import de.cuioss.nifi.jwt.util.ErrorContext;
import de.cuioss.sheriff.token.validation.IssuerConfig;
import de.cuioss.sheriff.token.validation.ParserConfig;
import de.cuioss.sheriff.token.validation.jwks.http.HttpJwksLoaderConfig;
import de.cuioss.sheriff.token.validation.security.SignatureAlgorithmPreferences;
import de.cuioss.tools.logging.CuiLogger;
import lombok.experimental.UtilityClass;
import org.jspecify.annotations.Nullable;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
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
            JwtPropertyKeys.Issuer.CLIENT_ID,
            JwtPropertyKeys.Issuer.JWKS_CONTENT,
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
            @Nullable ConfigurationManager configurationManager) {
        return parseIssuerConfigs(properties, configurationManager, null);
    }

    public static List<IssuerConfig> parseIssuerConfigs(Map<String, String> properties,
            @Nullable ConfigurationManager configurationManager,
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
        // Prefer the property name; fall back to the legacy display-name key so both the
        // controller-service path (name-keyed) and older external configs keep working.
        String tokenSizeValue = properties.getOrDefault(
                JwtAttributes.Properties.Validation.MAXIMUM_TOKEN_SIZE,
                properties.getOrDefault(MAXIMUM_TOKEN_SIZE_KEY, String.valueOf(DEFAULT_MAX_TOKEN_SIZE)));
        try {
            maxTokenSize = Integer.parseInt(tokenSizeValue);
        } catch (NumberFormatException e) {
            LOGGER.warn(JwtLogMessages.WARN.INVALID_CONFIG_VALUE,
                    sanitizeLogValue(tokenSizeValue), MAXIMUM_TOKEN_SIZE_KEY, DEFAULT_MAX_TOKEN_SIZE);
        }
        if (maxTokenSize <= 0) {
            // External config files bypass the NiFi POSITIVE_INTEGER_VALIDATOR; a 0/negative
            // size would disable size enforcement entirely, so fall back to the default.
            LOGGER.warn(JwtLogMessages.WARN.INVALID_MAX_TOKEN_SIZE,
                    sanitizeLogValue(tokenSizeValue), MAXIMUM_TOKEN_SIZE_KEY, DEFAULT_MAX_TOKEN_SIZE);
            maxTokenSize = DEFAULT_MAX_TOKEN_SIZE;
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
        Map<String, Map<String, String>> groups = DynamicPropertyGroupParser.parse(
                JwtConstants.ISSUER_PREFIX, properties);
        for (Map.Entry<String, Map<String, String>> groupEntry : groups.entrySet()) {
            String issuerId = groupEntry.getKey();
            Map<String, String> groupProps = groupEntry.getValue();
            Map<String, String> issuerProps = issuerPropertiesMap.computeIfAbsent(issuerId, k -> new HashMap<>());
            issuerProps.putAll(groupProps);
            for (Map.Entry<String, String> propEntry : groupProps.entrySet()) {
                LOGGER.debug("Parsed UI property for issuer %s: %s = %s", sanitizeLogValue(issuerId),
                        sanitizeLogValue(propEntry.getKey()),
                        SENSITIVE_KEYS.contains(propEntry.getKey()) ? "***"
                                : sanitizeLogValue(propEntry.getValue()));
            }
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
                        .with("jwksUrl", issuerProps.get(JwtPropertyKeys.Issuer.JWKS_URL))
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
        parseAllowedAlgorithms(globalProperties)
                .ifPresent(algorithms -> builder.algorithmPreferences(
                        new SignatureAlgorithmPreferences(algorithms)));
        String jwksType = resolveJwksType(issuerId, issuerProps);
        if ("url".equals(jwksType) && !hasUrlSource(issuerProps)) {
            // jwks-type=url was declared but only a jwks-file is present; the resolved source is a
            // file path and must NOT be routed through the URL/HTTPS/private-address checks.
            LOGGER.warn(JwtLogMessages.WARN.JWKS_TYPE_URL_WITH_FILE_SOURCE, sanitizeLogValue(issuerId));
            jwksType = "file";
        }
        if ("url".equals(jwksType)) {
            if (!isJwksUrlAllowed(issuerId, jwksSource.get(), globalProperties)) {
                return Optional.empty();
            }
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
        String audience = issuerProps.get(JwtPropertyKeys.Issuer.AUDIENCE);
        if (audience != null && !audience.trim().isEmpty()) {
            builder.expectedAudience(audience.trim());
        } else {
            builder.audienceValidationDisabled(true);
        }
        String clientId = issuerProps.get(JwtPropertyKeys.Issuer.CLIENT_ID);
        if (clientId != null && !clientId.trim().isEmpty()) {
            builder.expectedClientId(clientId.trim());
        }
        return Optional.of(builder.build());
    }

    private static Optional<String> resolveIssuerName(String issuerId, Map<String, String> issuerProps) {
        String issuerName = issuerProps.get("name");
        if (issuerName == null || issuerName.trim().isEmpty()) {
            issuerName = issuerProps.get(JwtPropertyKeys.Issuer.ISSUER_NAME);
        }
        if (issuerName == null || issuerName.trim().isEmpty()) {
            LOGGER.warn(JwtLogMessages.WARN.ISSUER_NO_NAME, sanitizeLogValue(issuerId));
            return Optional.empty();
        }
        return Optional.of(issuerName.trim());
    }

    private static Optional<String> resolveJwksSource(String issuerId, Map<String, String> issuerProps) {
        String jwksUrl = issuerProps.get(JwtPropertyKeys.Issuer.JWKS_URL);
        if (jwksUrl != null && !jwksUrl.trim().isEmpty()) {
            return Optional.of(jwksUrl.trim());
        }
        String jwksUri = issuerProps.get("jwksUri");
        if (jwksUri != null && !jwksUri.trim().isEmpty()) {
            return Optional.of(jwksUri.trim());
        }
        String jwksFile = issuerProps.get(JwtPropertyKeys.Issuer.JWKS_FILE);
        if (jwksFile != null && !jwksFile.trim().isEmpty()) {
            return Optional.of(jwksFile.trim());
        }
        String jwksContent = issuerProps.get(JwtPropertyKeys.Issuer.JWKS_CONTENT);
        if (jwksContent != null && !jwksContent.trim().isEmpty()) {
            LOGGER.warn(JwtLogMessages.WARN.JWKS_CONTENT_NOT_SUPPORTED, sanitizeLogValue(issuerId));
            return Optional.empty();
        }
        LOGGER.warn(JwtLogMessages.WARN.ISSUER_NO_JWKS_SOURCE, sanitizeLogValue(issuerId));
        return Optional.empty();
    }

    private static String resolveJwksType(String issuerId, Map<String, String> issuerProps) {
        String explicitType = issuerProps.get(JwtPropertyKeys.Issuer.JWKS_TYPE);
        if (explicitType != null && !explicitType.trim().isEmpty()) {
            String normalizedType = explicitType.trim().toLowerCase(Locale.ROOT);
            if ("url".equals(normalizedType) || "file".equals(normalizedType)) {
                return normalizedType;
            }
            // Unknown jwks-type: do not silently treat it as "file"; warn and infer from the source.
            LOGGER.warn(JwtLogMessages.WARN.UNKNOWN_JWKS_TYPE,
                    sanitizeLogValue(explicitType), sanitizeLogValue(issuerId));
        }
        if (hasUrlSource(issuerProps)) {
            return "url";
        }
        return "file";
    }

    private static boolean hasUrlSource(Map<String, String> issuerProps) {
        String jwksUrl = issuerProps.get(JwtPropertyKeys.Issuer.JWKS_URL);
        if (jwksUrl != null && !jwksUrl.trim().isEmpty()) {
            return true;
        }
        String jwksUri = issuerProps.get("jwksUri");
        return jwksUri != null && !jwksUri.trim().isEmpty();
    }

    /**
     * Parses the globally configured allowed signing algorithms into an ordered list.
     * Trims entries and drops blanks/duplicates so values like {@code "RS256, ES256"} work.
     *
     * @param globalProperties the global (controller-service level) properties
     * @return the algorithm list, or empty if the property is absent/blank (library default applies)
     */
    private static Optional<List<String>> parseAllowedAlgorithms(Map<String, String> globalProperties) {
        String value = globalProperties.get(JwtAttributes.Properties.Validation.ALLOWED_ALGORITHMS);
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }
        List<String> algorithms = Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .toList();
        return algorithms.isEmpty() ? Optional.empty() : Optional.of(algorithms);
    }

    /**
     * Enforces the global JWKS URL restrictions: {@code Require HTTPS for JWKS URLs}
     * (default true) and {@code Allow Private Network Addresses for JWKS} (default false).
     * The private-address check resolves the host at configuration time; if the host
     * cannot be resolved, the check is deferred to the JWKS loader rather than
     * permanently excluding the issuer (the IdP may simply not be up yet).
     * <p>
     * <b>Known limitation (accepted risk):</b> because resolution happens once at config
     * time, this is a TOCTOU check that does not defend against DNS-rebinding where the
     * host later resolves to a private address. Covered private ranges include loopback,
     * link-local, site-local (RFC 1918), IPv6 unique-local (fc00::/7) and carrier-grade
     * NAT (100.64.0.0/10, RFC 6598).
     *
     * @return {@code true} if the URL passes the configured restrictions
     */
    private static boolean isJwksUrlAllowed(String issuerId, String jwksUrl,
            Map<String, String> globalProperties) {
        boolean requireHttps = !"false".equalsIgnoreCase(
                globalProperties.get(JwtAttributes.Properties.Validation.REQUIRE_HTTPS_FOR_JWKS));
        if (requireHttps && !jwksUrl.toLowerCase(Locale.ROOT).startsWith("https://")) {
            LOGGER.error(JwtLogMessages.ERROR.ISSUER_JWKS_HTTPS_REQUIRED,
                    sanitizeLogValue(issuerId), sanitizeLogValue(jwksUrl));
            return false;
        }
        boolean allowPrivate = "true".equalsIgnoreCase(globalProperties
                .get(JwtAttributes.Properties.Validation.JWKS_ALLOW_PRIVATE_NETWORK_ADDRESSES));
        if (!allowPrivate && resolvesToPrivateAddress(issuerId, jwksUrl)) {
            LOGGER.error(JwtLogMessages.ERROR.ISSUER_JWKS_PRIVATE_ADDRESS_REJECTED,
                    sanitizeLogValue(issuerId), sanitizeLogValue(jwksUrl));
            return false;
        }
        return true;
    }

    private static boolean resolvesToPrivateAddress(String issuerId, String jwksUrl) {
        String host;
        try {
            host = URI.create(jwksUrl).getHost();
        } catch (IllegalArgumentException e) {
            // Malformed URL — leave rejection to the JWKS loader, which reports it properly
            return false;
        }
        if (host == null) {
            return false;
        }
        try {
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (address.isLoopbackAddress() || address.isSiteLocalAddress()
                        || address.isLinkLocalAddress() || address.isAnyLocalAddress()
                        || isUniqueLocalIpv6(address) || isCarrierGradeNat(address)) {
                    return true;
                }
            }
        } catch (UnknownHostException e) {
            LOGGER.warn(JwtLogMessages.WARN.JWKS_HOST_NOT_RESOLVABLE,
                    sanitizeLogValue(host), sanitizeLogValue(issuerId));
        }
        return false;
    }

    /** IPv6 unique-local addresses (fc00::/7) are not covered by isSiteLocalAddress(). */
    private static boolean isUniqueLocalIpv6(InetAddress address) {
        byte[] bytes = address.getAddress();
        return bytes.length == 16 && (bytes[0] & 0xFE) == 0xFC;
    }

    /**
     * IPv4 carrier-grade NAT shared address space (100.64.0.0/10, RFC 6598) is not covered by
     * {@link InetAddress#isSiteLocalAddress()}; treat it as private for SSRF protection.
     */
    private static boolean isCarrierGradeNat(InetAddress address) {
        byte[] bytes = address.getAddress();
        // 100.64.0.0/10 => first octet 100, second octet in [64, 127].
        return bytes.length == 4 && (bytes[0] & 0xFF) == 100 && (bytes[1] & 0xC0) == 0x40;
    }

    private static void applyGlobalJwksSettings(
            HttpJwksLoaderConfig.HttpJwksLoaderConfigBuilder builder,
            Map<String, String> globalProperties) {
        String refreshInterval = globalProperties.get(JwtAttributes.Properties.Validation.JWKS_REFRESH_INTERVAL);
        if (refreshInterval != null && !refreshInterval.isBlank()) {
            try {
                builder.refreshIntervalSeconds(Integer.parseInt(refreshInterval));
            } catch (NumberFormatException e) {
                LOGGER.warn(JwtLogMessages.WARN.INVALID_CONFIG_VALUE,
                        sanitizeLogValue(refreshInterval), "JWKS Refresh Interval", 3600);
            }
        }
        String connectionTimeout = globalProperties.get(JwtAttributes.Properties.Validation.JWKS_CONNECTION_TIMEOUT);
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
