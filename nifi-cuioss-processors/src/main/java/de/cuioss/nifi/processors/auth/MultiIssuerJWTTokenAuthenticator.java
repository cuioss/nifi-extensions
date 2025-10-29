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
package de.cuioss.nifi.processors.auth;

import de.cuioss.sheriff.oauth.core.IssuerConfig;
import de.cuioss.sheriff.oauth.core.ParserConfig;
import de.cuioss.sheriff.oauth.core.TokenValidator;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.sheriff.oauth.core.exception.TokenValidationException;
import de.cuioss.sheriff.oauth.core.metrics.TokenValidatorMonitor;
import de.cuioss.sheriff.oauth.core.security.SecurityEventCounter;
import de.cuioss.sheriff.oauth.core.security.SecurityEventCounter.EventType;
import de.cuioss.sheriff.oauth.core.security.SignatureAlgorithmPreferences;
import de.cuioss.nifi.processors.auth.config.ConfigurationManager;
import de.cuioss.nifi.processors.auth.config.IssuerConfigurationParser;
import de.cuioss.nifi.processors.auth.config.IssuerPropertyDescriptorFactory;
import de.cuioss.nifi.processors.auth.i18n.I18nResolver;
import de.cuioss.nifi.processors.auth.i18n.NiFiI18nResolver;
import de.cuioss.nifi.processors.auth.util.AuthorizationValidator;
import de.cuioss.nifi.processors.auth.util.ErrorContext;
import de.cuioss.nifi.processors.auth.util.ProcessingError;
import de.cuioss.tools.logging.CuiLogger;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NonNull;
import org.apache.nifi.annotation.behavior.*;
import org.apache.nifi.annotation.documentation.CapabilityDescription;
import org.apache.nifi.annotation.documentation.SeeAlso;
import org.apache.nifi.annotation.documentation.Tags;
import org.apache.nifi.annotation.lifecycle.OnScheduled;
import org.apache.nifi.annotation.lifecycle.OnStopped;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.flowfile.FlowFile;
import org.apache.nifi.processor.*;
import org.apache.nifi.processor.util.StandardValidators;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.Base64;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.*;
import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Properties;
import static de.cuioss.nifi.processors.auth.JWTPropertyKeys.Issuer;
import static de.cuioss.nifi.processors.auth.JWTTranslationKeys.Property;
import static de.cuioss.nifi.processors.auth.JWTTranslationKeys.Validation;

/**
 * MultiIssuerJWTTokenAuthenticator is a NiFi processor that validates JWT tokens from multiple issuers.
 * It extracts JWT tokens from flow files, validates them against configured issuers, and routes
 * flow files based on validation results.
 * 
 * <p>JWKS Configuration:</p>
 * <p>The processor supports three types of JWKS sources for each issuer:</p>
 * <ul>
 *   <li><b>URL:</b> Fetches JWKS from a remote endpoint (default). Use issuer.{name}.jwks-url property.</li>
 *   <li><b>File:</b> Loads JWKS from a local file. Use issuer.{name}.jwks-file property.</li>
 *   <li><b>Memory:</b> Uses inline JWKS content. Use issuer.{name}.jwks-content property.</li>
 * </ul>
 * <p>Set the JWKS source type using issuer.{name}.jwks-type property (url, file, or memory).</p>
 */
@Tags({"jwt", "oauth", "authentication", "authorization", "security", "token"})
@CapabilityDescription("Validates JWT tokens from multiple issuers. Extracts JWT tokens from flow files, " +
        "validates them against configured issuers, and routes flow files based on validation results. " +
        "Supports URL, file, and in-memory JWKS configurations for flexible key management.")
@SeeAlso()
@ReadsAttributes({
        @ReadsAttribute(attribute = "http.headers.authorization", description = "HTTP Authorization header containing the JWT token")
})
@WritesAttributes({
        @WritesAttribute(attribute = JWTAttributes.Content.PREFIX + "*", description = "JWT token claims"),
        @WritesAttribute(attribute = JWTAttributes.Token.VALIDATED_AT, description = "Timestamp when the token was validated"),
        @WritesAttribute(attribute = JWTAttributes.Token.PRESENT, description = "Whether a JWT token is present in the request"),
        @WritesAttribute(attribute = JWTAttributes.Token.AUTHORIZATION_PASSED, description = "Whether the token passed authorization checks"),
        @WritesAttribute(attribute = JWTAttributes.Authorization.AUTHORIZED, description = "Whether the token is authorized based on scope/role checks"),
        @WritesAttribute(attribute = JWTAttributes.Authorization.BYPASSED, description = "Whether authorization was bypassed (explicitly configured)"),
        @WritesAttribute(attribute = JWTAttributes.Error.CODE, description = "Error code if token validation failed"),
        @WritesAttribute(attribute = JWTAttributes.Error.REASON, description = "Error reason if token validation failed"),
        @WritesAttribute(attribute = JWTAttributes.Error.CATEGORY, description = "Error category if token validation failed")
})
@RequiresInstanceClassLoading
@EqualsAndHashCode(callSuper = true)
public class MultiIssuerJWTTokenAuthenticator extends AbstractProcessor {

    /**
     * Standard JWT claim names that should be filtered out when adding claims to flow file attributes.
     * Using TreeSet for better performance in lookups.
     */
    private static final Set<String> FILTERED_CLAIM_KEYS = new TreeSet<>(Arrays.asList(
            "sub",   // Subject
            "iss",   // Issuer
            "exp",   // Expiration time
            "roles", // Roles
            "groups", // Groups
            "scope", // Scope (singular)
            "scopes" // Scope (plural)
    ));

    private static final CuiLogger LOGGER = new CuiLogger(MultiIssuerJWTTokenAuthenticator.class);

    // TokenValidator instance for token validation
    private final AtomicReference<TokenValidator> tokenValidator = new AtomicReference<>();

    // Security event counter for tracking validation events
    private SecurityEventCounter securityEventCounter;

    // Lock object for thread-safe initialization
    private final Object tokenValidatorLock = new Object();

    // Counter for tracking when to log metrics
    private final AtomicLong processedFlowFilesCount = new AtomicLong();

    // Configuration manager for static files and environment variables
    private ConfigurationManager configurationManager;

    // Flag to track if configuration was reloaded
    private volatile boolean configurationRefreshed = false;

    // Hash of current configuration to detect changes
    private final AtomicReference<String> configurationHash = new AtomicReference<>("");

    // Configuration cache to avoid recreating objects unnecessarily
    private final Map<String, IssuerConfig> issuerConfigCache = new ConcurrentHashMap<>();

    // Authorization configuration cache
    private final Map<String, AuthorizationValidator.AuthorizationConfig> authorizationConfigCache = new ConcurrentHashMap<>();

    private I18nResolver i18nResolver;

    private IssuerPropertyDescriptorFactory propertyDescriptorFactory;

    @Getter
    private List<PropertyDescriptor> supportedPropertyDescriptors;

    @Getter
    private Set<Relationship> relationships;

    @Override
    protected void init(@NonNull final ProcessorInitializationContext context) {
        // Initialize i18n resolver
        i18nResolver = NiFiI18nResolver.createDefault(context.getLogger());
        propertyDescriptorFactory = new IssuerPropertyDescriptorFactory(i18nResolver);

        LOGGER.info("Initializing MultiIssuerJWTTokenAuthenticator processor");

        final List<PropertyDescriptor> descriptors = new ArrayList<>();
        descriptors.add(Properties.TOKEN_LOCATION);
        descriptors.add(Properties.TOKEN_HEADER);
        descriptors.add(Properties.CUSTOM_HEADER_NAME);
        descriptors.add(Properties.BEARER_TOKEN_PREFIX);
        descriptors.add(Properties.REQUIRE_VALID_TOKEN);
        descriptors.add(Properties.JWKS_REFRESH_INTERVAL);
        descriptors.add(Properties.MAXIMUM_TOKEN_SIZE);
        descriptors.add(Properties.ALLOWED_ALGORITHMS);
        descriptors.add(Properties.REQUIRE_HTTPS_FOR_JWKS);
        descriptors.add(Properties.JWKS_CONNECTION_TIMEOUT);
        descriptors.add(Properties.JWKS_SOURCE_TYPE);
        this.supportedPropertyDescriptors = descriptors;

        final Set<Relationship> rels = new HashSet<>();
        rels.add(Relationships.SUCCESS);
        rels.add(Relationships.AUTHENTICATION_FAILED);
        this.relationships = rels;

        LOGGER.info("MultiIssuerJWTTokenAuthenticator processor initialized with {} property descriptors",
                descriptors.size());
    }

    @Override
    protected PropertyDescriptor getSupportedDynamicPropertyDescriptor(@NonNull final String propertyDescriptorName) {
        // Support dynamic properties for issuer configuration
        if (propertyDescriptorName.startsWith(ISSUER_PREFIX)) {
            return createIssuerPropertyDescriptor(propertyDescriptorName);
        }

        // Support other dynamic properties
        return createDefaultPropertyDescriptor(propertyDescriptorName);
    }

    /**
     * Creates a property descriptor for issuer-specific properties.
     *
     * @param propertyDescriptorName The full property descriptor name
     * @return The created PropertyDescriptor
     */
    @NonNull
    private PropertyDescriptor createIssuerPropertyDescriptor(@NonNull final String propertyDescriptorName) {
        String issuerProperty = propertyDescriptorName.substring(ISSUER_PREFIX.length());
        int dotIndex = issuerProperty.indexOf('.');

        if (dotIndex > 0) {
            String issuerName = issuerProperty.substring(0, dotIndex);
            String propertyKey = issuerProperty.substring(dotIndex + 1);
            String displayName = i18nResolver.getTranslatedString(Property.Issuer.DYNAMIC_NAME, issuerName, propertyKey);

            return propertyDescriptorFactory.createDescriptor(propertyDescriptorName, issuerName, propertyKey, displayName);
        }

        return createDefaultPropertyDescriptor(propertyDescriptorName);
    }

    /**
     * Creates a default property descriptor for non-issuer properties.
     *
     * @param propertyDescriptorName The property descriptor name
     * @return The created PropertyDescriptor
     */
    @NonNull
    private PropertyDescriptor createDefaultPropertyDescriptor(@NonNull final String propertyDescriptorName) {
        return new PropertyDescriptor.Builder()
                .name(propertyDescriptorName)
                .displayName(propertyDescriptorName)
                .description("Dynamic property")
                .required(false)
                .dynamic(true)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();
    }

    /**
     * Initializes the TokenValidator when the processor is scheduled.
     *
     * @param context The process context
     */
    @OnScheduled
    public void onScheduled(@NonNull final ProcessContext context) {
        // Initialize the ConfigurationManager
        configurationManager = new ConfigurationManager();
        LOGGER.info("Configuration manager initialized, external configuration loaded: %s",
                configurationManager.isConfigurationLoaded());

        // Log all available property descriptors to help with debugging
        LOGGER.info("Available property descriptors:");
        for (PropertyDescriptor descriptor : getSupportedPropertyDescriptors()) {
            LOGGER.info(" - Property: %s (Display: %s)", descriptor.getName(), descriptor.getDisplayName());
        }

        // Initialize the TokenValidator
        getTokenValidator(context);
        LOGGER.info(AuthLogMessages.INFO.PROCESSOR_INITIALIZED.format());
    }

    /**
     * Cleans up resources when the processor is stopped.
     */
    @OnStopped
    public void onStopped() {
        synchronized (tokenValidatorLock) {
            if (tokenValidator.get() != null) {
                // No explicit cleanup needed for TokenValidator in current version
                tokenValidator.set(null);
                securityEventCounter = null;
                LOGGER.info(AuthLogMessages.INFO.PROCESSOR_STOPPED.format());
            }

            // Clean up configuration manager
            configurationManager = null;
            configurationRefreshed = false;
        }
    }

    /**
     * Gets or creates the TokenValidator instance.
     *
     * @param context The process context
     * @return The TokenValidator instance
     */
    private TokenValidator getTokenValidator(final ProcessContext context) {
        // Check if configuration file has been modified
        boolean configFileChanged = false;
        if (configurationManager != null) {
            configFileChanged = configurationManager.checkAndReloadConfiguration();
            if (configFileChanged) {
                LOGGER.info("External configuration file changed, forcing TokenValidator recreation");
                configurationRefreshed = true;
            }
        }

        // Generate a hash of the current configuration
        String currentConfigHash = generateConfigurationHash(context);

        // Check if configuration has changed
        if (tokenValidator.get() == null || !configurationHash.get().equals(currentConfigHash) || configFileChanged) {
            synchronized (tokenValidatorLock) {
                // Double-check inside synchronized block
                if (tokenValidator.get() == null || !configurationHash.get().equals(currentConfigHash) || configFileChanged) {
                    LOGGER.info(AuthLogMessages.INFO.CONFIG_CHANGE_DETECTED.format());

                    // Log what changed if this is a reconfiguration (not initial setup)
                    if (tokenValidator.get() != null) {
                        LOGGER.info(AuthLogMessages.INFO.CONFIG_HASH_CHANGED.format(
                                configurationHash.get(), currentConfigHash));

                        // Clean up old resources before creating new ones
                        cleanupResources();
                    }

                    // Create issuer configurations
                    List<IssuerConfig> issuerConfigs = createIssuerConfigs(context);

                    // Check if we have any issuer configurations
                    if (issuerConfigs.isEmpty()) {
                        // If no issuer configurations and require-valid-token is false, we can continue without a validator
                        boolean requireValidToken = context.getProperty(Properties.REQUIRE_VALID_TOKEN).asBoolean();
                        if (!requireValidToken) {
                            LOGGER.warn("No issuer configurations found, but require-valid-token is false. TokenValidator will not be initialized.");
                            tokenValidator.set(null);
                            securityEventCounter = null;
                            configurationHash.set(currentConfigHash);
                            return null;
                        } else {
                            throw new IllegalArgumentException("At least one issuer configuration must be provided when require-valid-token is true");
                        }
                    }

                    // Create a new TokenValidator with issuer configurations
                    // Create parser configuration using shared parser
                    Map<String, String> properties = convertContextToProperties(context);
                    ParserConfig parserConfig = IssuerConfigurationParser.parseParserConfig(properties);

                    // Use the TokenValidator builder pattern
                    TokenValidator newValidator = TokenValidator.builder()
                            .parserConfig(parserConfig)
                            .issuerConfigs(issuerConfigs)
                            .build();
                    tokenValidator.set(newValidator);

                    // Get the SecurityEventCounter for metrics
                    securityEventCounter = tokenValidator.get().getSecurityEventCounter();

                    // Update configuration hash
                    configurationHash.set(currentConfigHash);

                    LOGGER.info(AuthLogMessages.INFO.TOKEN_VALIDATOR_INITIALIZED.format(issuerConfigs.size()));

                    // Clear the issuer Config cache to ensure we don't use stale configurations
                    issuerConfigCache.clear();
                    authorizationConfigCache.clear();
                }
            }
        }

        return tokenValidator.get();
    }

    /**
     * Cleans up resources before recreating the TokenValidator.
     * This ensures proper resource management during configuration changes.
     */
    private void cleanupResources() {
        LOGGER.info(AuthLogMessages.INFO.CLEANING_RESOURCES.format());

        // Clean up TokenValidator resources if needed
        if (tokenValidator.get() != null) {
            try {
                // Note: The current TokenValidator implementation doesn't have explicit cleanup methods
                // If future versions add cleanup methods, they should be called here

                // For now, we just null out the references to allow garbage collection
                tokenValidator.set(null);
                securityEventCounter = null;
            } catch (Exception e) {
                LOGGER.warn(AuthLogMessages.WARN.RESOURCE_CLEANUP_ERROR.format(e.getMessage()));
            }
        }

        // Clear the issuer Config cache to ensure we don't use stale configurations
        // during the transition period
        issuerConfigCache.clear();
        authorizationConfigCache.clear();
    }

    /**
     * Generates a hash of the current configuration.
     *
     * @param context The process context
     * @return A hash string representing the current configuration
     */
    private String generateConfigurationHash(final ProcessContext context) {
        StringBuilder hashBuilder = new StringBuilder();

        // Add static properties to hash
        hashBuilder.append(context.getProperty(Properties.JWKS_REFRESH_INTERVAL).getValue());
        hashBuilder.append(context.getProperty(Properties.MAXIMUM_TOKEN_SIZE).getValue());
        hashBuilder.append(context.getProperty(Properties.REQUIRE_VALID_TOKEN).getValue());

        // Add dynamic properties (issuers) to hash
        for (PropertyDescriptor propertyDescriptor : context.getProperties().keySet()) {
            String propertyName = propertyDescriptor.getName();
            if (propertyName.startsWith(ISSUER_PREFIX)) {
                hashBuilder.append(propertyName)
                        .append("=")
                        .append(context.getProperty(propertyDescriptor).getValue())
                        .append(";");
            }
        }

        // Add external configuration to hash if available
        if (configurationManager != null && configurationManager.isConfigurationLoaded()) {
            // Add static properties from external configuration
            for (Map.Entry<String, String> entry : configurationManager.getStaticProperties().entrySet()) {
                hashBuilder.append(entry.getKey())
                        .append("=")
                        .append(entry.getValue())
                        .append(";");
            }

            // Add issuer properties from external configuration
            for (String issuerId : configurationManager.getIssuerIds()) {
                Map<String, String> issuerProps = configurationManager.getIssuerProperties(issuerId);
                for (Map.Entry<String, String> entry : issuerProps.entrySet()) {
                    hashBuilder.append("issuer.")
                            .append(issuerId)
                            .append(".")
                            .append(entry.getKey())
                            .append("=")
                            .append(entry.getValue())
                            .append(";");
                }
            }
        }

        return hashBuilder.toString();
    }

    /**
     * Creates issuer configurations based on processor properties and external configuration.
     *
     * @param context The process context
     * @return A list of issuer configurations
     */
    private List<IssuerConfig> createIssuerConfigs(final ProcessContext context) {
        // Convert ProcessContext to properties map for shared parser
        Map<String, String> properties = convertContextToProperties(context);

        // Use shared parser to create issuer configurations
        List<IssuerConfig> issuerConfigs = IssuerConfigurationParser.parseIssuerConfigs(properties, configurationManager);

        // Clean up removed issuers from cache (extract current issuer names)
        Set<String> currentIssuerNames = issuerConfigs.stream()
                .map(IssuerConfig::getIssuerIdentifier)
                .collect(Collectors.toSet());
        cleanupRemovedIssuers(currentIssuerNames);

        // Log summary
        logConfigurationSummary(issuerConfigs);

        return issuerConfigs;
    }

    /**
     * Converts ProcessContext to a simple properties map for use with shared parser.
     * 
     * @param context The process context
     * @return Map of property names to values
     */
    private Map<String, String> convertContextToProperties(final ProcessContext context) {
        Map<String, String> properties = new HashMap<>();

        // Add static properties
        properties.put("Maximum Token Size", context.getProperty(Properties.MAXIMUM_TOKEN_SIZE).getValue());

        // Add dynamic properties (issuers)
        for (PropertyDescriptor propertyDescriptor : context.getProperties().keySet()) {
            String propertyName = propertyDescriptor.getName();
            String propertyValue = context.getProperty(propertyDescriptor).getValue();
            if (propertyValue != null) {
                properties.put(propertyName, propertyValue);
            }
        }

        return properties;
    }

    /**
     * Loads issuer configurations from external configuration and UI properties.
     *
     * @param context             The process context
     * @param issuerPropertiesMap Map to store issuer properties
     * @param currentIssuerNames  Set to track current issuer names
     */
    private void loadIssuerConfigurations(
            final ProcessContext context,
            Map<String, Map<String, String>> issuerPropertiesMap,
            Set<String> currentIssuerNames) {

        // First, load external configuration if available (highest precedence)
        loadExternalConfigurations(issuerPropertiesMap, currentIssuerNames);

        // Then, load UI configuration (lower precedence)
        loadUIConfigurations(context, issuerPropertiesMap, currentIssuerNames);
    }

    /**
     * Loads issuer configurations from external configuration source.
     *
     * @param issuerPropertiesMap Map to store issuer properties
     * @param currentIssuerNames  Set to track current issuer names
     */
    private void loadExternalConfigurations(
            Map<String, Map<String, String>> issuerPropertiesMap,
            Set<String> currentIssuerNames) {

        if (configurationManager != null && configurationManager.isConfigurationLoaded()) {
            LOGGER.info("Loading issuer configurations from external configuration");

            // Get issuer IDs from external configuration
            List<String> externalIssuerIds = configurationManager.getIssuerIds();
            for (String issuerId : externalIssuerIds) {
                // Track current issuer names for cache cleanup
                currentIssuerNames.add(issuerId);

                // Get properties for this issuer
                Map<String, String> issuerProps = configurationManager.getIssuerProperties(issuerId);

                // Store in issuer properties map
                issuerPropertiesMap.put(issuerId, new HashMap<>(issuerProps));

                LOGGER.info("Loaded external configuration for issuer %s: %s", issuerId, issuerProps);
            }
        }
    }

    /**
     * Loads issuer configurations from UI properties.
     *
     * @param context             The process context
     * @param issuerPropertiesMap Map to store issuer properties
     * @param currentIssuerNames  Set to track current issuer names
     */
    private void loadUIConfigurations(
            final ProcessContext context,
            Map<String, Map<String, String>> issuerPropertiesMap,
            Set<String> currentIssuerNames) {

        // Get all properties that start with the issuer prefix
        for (PropertyDescriptor propertyDescriptor : context.getProperties().keySet()) {
            String propertyName = propertyDescriptor.getName();
            if (propertyName.startsWith(ISSUER_PREFIX)) {
                // Extract issuer name and property key
                String issuerProperty = propertyName.substring(ISSUER_PREFIX.length());
                int dotIndex = issuerProperty.indexOf('.');
                if (dotIndex > 0) {
                    String issuerName = issuerProperty.substring(0, dotIndex);
                    String propertyKey = issuerProperty.substring(dotIndex + 1);

                    // Track current issuer names for cache cleanup
                    currentIssuerNames.add(issuerName);

                    // Only add UI property if it doesn't exist in external configuration
                    // This implements the precedence order: external Config > UI Config
                    Map<String, String> issuerProps = issuerPropertiesMap.computeIfAbsent(issuerName, k -> new HashMap<>());
                    issuerProps.computeIfAbsent(propertyKey, k -> context.getProperty(propertyDescriptor).getValue());
                }
            }
        }
    }

    /**
     * Removes issuers from cache that are no longer in the current configuration.
     *
     * @param currentIssuerNames Set of current issuer names
     */
    private void cleanupRemovedIssuers(Set<String> currentIssuerNames) {
        Set<String> cachedIssuerNames = new HashSet<>(issuerConfigCache.keySet());
        for (String cachedIssuerName : cachedIssuerNames) {
            if (!currentIssuerNames.contains(cachedIssuerName)) {
                LOGGER.info(AuthLogMessages.INFO.REMOVING_ISSUER_CONFIG.format(cachedIssuerName));
                issuerConfigCache.remove(cachedIssuerName);
                authorizationConfigCache.remove(cachedIssuerName);
            }
        }
    }

    /**
     * Processes each issuer configuration, validating and creating IssuerConfig objects.
     *
     * @param issuerPropertiesMap Map of issuer properties
     * @param context             The process context
     * @return List of valid IssuerConfig objects
     */
    private List<IssuerConfig> processIssuerConfigurations(
            Map<String, Map<String, String>> issuerPropertiesMap,
            final ProcessContext context) {

        List<IssuerConfig> issuerConfigs = new ArrayList<>();

        for (Map.Entry<String, Map<String, String>> entry : issuerPropertiesMap.entrySet()) {
            String issuerName = entry.getKey();
            Map<String, String> properties = entry.getValue();

            LOGGER.info(AuthLogMessages.INFO.FOUND_ISSUER_CONFIG.format(issuerName, properties));

            // Try to use cached config or create a new one
            IssuerConfig issuerConfig = getOrCreateIssuerConfig(issuerName, properties, context);
            if (issuerConfig != null) {
                issuerConfigs.add(issuerConfig);

                // Also create and cache authorization configuration
                AuthorizationValidator.AuthorizationConfig authConfig = createAuthorizationConfig(issuerName, properties);
                if (authConfig != null) {
                    authorizationConfigCache.put(issuerName, authConfig);
                }
            }
        }

        return issuerConfigs;
    }

    /**
     * Gets a cached issuer config or creates a new one if needed.
     *
     * @param issuerName The name of the issuer
     * @param properties The properties for the issuer
     * @param context    The process context
     * @return The IssuerConfig object, or null if invalid
     */
    private IssuerConfig getOrCreateIssuerConfig(
            String issuerName,
            Map<String, String> properties,
            final ProcessContext context) {

        // Generate a hash for this issuer's properties to detect changes
        String issuerPropertiesHash = generateIssuerPropertiesHash(properties);

        // Check if we can reuse the cached issuer Config
        IssuerConfig cachedConfig = issuerConfigCache.get(issuerName);
        if (cachedConfig != null && issuerPropertiesHash.equals(cachedConfig.toString())) {
            LOGGER.info(AuthLogMessages.INFO.REUSING_CACHED_CONFIG.format(issuerName));
            return cachedConfig;
        }

        // Validate issuer configuration
        List<String> validationErrors = validateIssuerConfig(issuerName, properties, context);
        if (!validationErrors.isEmpty()) {
            for (String error : validationErrors) {
                LOGGER.warn(error);
            }
            LOGGER.warn(AuthLogMessages.WARN.INVALID_ISSUER_CONFIG.format(issuerName));
            return null;
        }

        try {
            // Create issuer configuration
            IssuerConfig issuerConfig = createIssuerConfig(issuerName, properties);
            if (issuerConfig != null) {
                // Cache the issuer Config for future use
                issuerConfigCache.put(issuerName, issuerConfig);
                LOGGER.info(AuthLogMessages.INFO.CREATED_CACHED_CONFIG.format(issuerName));
            }
            return issuerConfig;
        } catch (Exception e) {
            LOGGER.error(e, AuthLogMessages.ERROR.ISSUER_CONFIG_ERROR.format(issuerName, e.getMessage()));
            return null;
        }
    }

    /**
     * Logs a summary of the issuer configuration process.
     *
     * @param issuerConfigs The list of issuer configurations
     */
    private void logConfigurationSummary(List<IssuerConfig> issuerConfigs) {
        if (issuerConfigs.isEmpty()) {
            LOGGER.warn(AuthLogMessages.WARN.NO_VALID_ISSUER_CONFIGS.format());
        } else {
            LOGGER.info(AuthLogMessages.INFO.CREATED_ISSUER_CONFIGS.format(issuerConfigs.size()));
        }
    }

    /**
     * Generates a hash for an issuer's properties to detect changes.
     *
     * @param properties The issuer properties
     * @return A hash string representing the properties
     */
    private String generateIssuerPropertiesHash(Map<String, String> properties) {
        StringBuilder hashBuilder = new StringBuilder();

        // Sort keys for consistent hash generation
        List<String> sortedKeys = new ArrayList<>(properties.keySet());
        Collections.sort(sortedKeys);

        for (String key : sortedKeys) {
            hashBuilder.append(key)
                    .append("=")
                    .append(properties.get(key))
                    .append(";");
        }

        return hashBuilder.toString();
    }

    /**
     * Validates an issuer configuration.
     *
     * @param issuerName The name of the issuer
     * @param properties The properties for the issuer
     * @param context    The process context
     * @return A list of validation errors, empty if valid
     */
    private List<String> validateIssuerConfig(String issuerName, Map<String, String> properties, ProcessContext context) {
        List<String> errors = new ArrayList<>();

        // Determine JWKS source type (default to URL for backward compatibility)
        String jwksType = properties.getOrDefault(Issuer.JWKS_TYPE, "url");

        // Validate based on JWKS source type
        switch (jwksType) {
            case "url" -> {
                // Check required properties for URL type
                if (!properties.containsKey(Issuer.JWKS_URL) || properties.get(Issuer.JWKS_URL).isEmpty()) {
                    errors.add(i18nResolver.getTranslatedString(Validation.Issuer.MISSING_JWKS, issuerName));
                } else {
                    // Validate jwks-url format
                    String jwksUrl = properties.get(Issuer.JWKS_URL);
                    if (!jwksUrl.startsWith(Http.HTTP_PROTOCOL) && !jwksUrl.startsWith(Http.HTTPS_PROTOCOL)) {
                        errors.add(i18nResolver.getTranslatedString(Validation.Issuer.INVALID_URL, issuerName, jwksUrl));
                    }

                    // Enforce HTTPS for JWKS URLs if required
                    boolean requireHttps = context.getProperty(Properties.REQUIRE_HTTPS_FOR_JWKS).asBoolean();
                    if (requireHttps && jwksUrl.startsWith(Http.HTTP_PROTOCOL)) {
                        errors.add(i18nResolver.getTranslatedString(Validation.Issuer.REQUIRES_HTTPS, issuerName));
                        LOGGER.error(AuthLogMessages.ERROR.HTTPS_REQUIRED.format(issuerName));
                    } else if (jwksUrl.startsWith(Http.HTTP_PROTOCOL)) {
                        // Just warn if HTTPS is not required but HTTP is used
                        LOGGER.warn(AuthLogMessages.WARN.INSECURE_JWKS_URL.format(issuerName));
                    }
                }
            }
            case "file" -> {
                // Check required properties for file type
                if (!properties.containsKey(Issuer.JWKS_FILE) || properties.get(Issuer.JWKS_FILE).isEmpty()) {
                    errors.add("Issuer " + issuerName + " is configured with jwks-type 'file' but missing jwks-file property");
                }
            }
            case "memory" -> {
                // Check required properties for memory type
                if (!properties.containsKey(Issuer.JWKS_CONTENT) || properties.get(Issuer.JWKS_CONTENT).isEmpty()) {
                    errors.add("Issuer " + issuerName + " is configured with jwks-type 'memory' but missing jwks-content property");
                }
            }
            default -> errors.add("Issuer " + issuerName + " has invalid jwks-type: " + jwksType);
        }

        // Check issuer property
        if (!properties.containsKey(Issuer.ISSUER_NAME) || properties.get(Issuer.ISSUER_NAME).isEmpty()) {
            errors.add(i18nResolver.getTranslatedString(Validation.Issuer.MISSING_ISSUER, issuerName));
            LOGGER.info(AuthLogMessages.INFO.NO_ISSUER_PROPERTY.format(issuerName));
        }

        // Check for recommended properties
        if (!properties.containsKey(Issuer.AUDIENCE) && !properties.containsKey(Issuer.CLIENT_ID)) {
            LOGGER.warn(AuthLogMessages.WARN.NO_AUDIENCE_OR_CLIENT_ID.format(issuerName));
        }

        return errors;
    }

    /**
     * Creates an IssuerConfig object from the given properties.
     *
     * @param issuerName The name of the issuer
     * @param properties The properties for the issuer
     * @return The IssuerConfig object, or null if the required properties are missing
     */
    private IssuerConfig createIssuerConfig(String issuerName, Map<String, String> properties) {
        // Get issuer name
        String issuer = properties.get(Issuer.ISSUER_NAME);
        if (issuer == null || issuer.isEmpty()) {
            // Use issuer name as default if not specified
            issuer = issuerName;
            LOGGER.info("Using issuer name '%s' as default issuer value", issuerName);
        }

        // Determine JWKS source type (default to URL for backward compatibility)
        String jwksType = properties.getOrDefault(Issuer.JWKS_TYPE, "url");

        // Get JWKS configuration based on type
        String jwksSource = null;
        switch (jwksType) {
            case "url" -> {
                jwksSource = properties.get(Issuer.JWKS_URL);
                if (jwksSource == null || jwksSource.isEmpty()) {
                    LOGGER.warn(AuthLogMessages.WARN.MISSING_JWKS_URL.format(issuerName));
                    return null;
                }
            }
            case "file" -> {
                jwksSource = properties.get(Issuer.JWKS_FILE);
                if (jwksSource == null || jwksSource.isEmpty()) {
                    LOGGER.warn("Missing jwks-file for issuer: %s", issuerName);
                    return null;
                }
            }
            case "memory" -> {
                jwksSource = properties.get(Issuer.JWKS_CONTENT);
                if (jwksSource == null || jwksSource.isEmpty()) {
                    LOGGER.warn("Missing jwks-content for issuer: %s", issuerName);
                    return null;
                }
            }
            default -> {
                LOGGER.error("Invalid jwks-type for issuer %s: %s", issuerName, jwksType);
                return null;
            }
        }

        // Optional properties
        String audience = properties.get(Issuer.AUDIENCE);
        String clientId = properties.get(Issuer.CLIENT_ID);

        // Log the properties for debugging
        LOGGER.info("Creating issuer configuration for %s with properties: jwksType=%s, jwksSource=%s, issuer=%s, audience=%s, clientId=%s",
                issuerName, jwksType, "memory".equals(jwksType) ? "[CONTENT]" : jwksSource, issuer, audience, clientId);

        try {
            // Create issuer configuration using builder pattern
            IssuerConfig.IssuerConfigBuilder builder = IssuerConfig.builder()
                    .issuerIdentifier(issuer)
                    // Add optional audience if provided
                    .expectedAudience(audience != null && !audience.isEmpty() ? audience : null)
                    // Add optional client ID if provided
                    .expectedClientId(clientId != null && !clientId.isEmpty() ? clientId : null);

            // Configure JWKS source based on type
            switch (jwksType) {
                case "url", "file" -> {
                    // For both URL and file, use jwksFilePath (the library handles both)
                    builder.jwksFilePath(jwksSource);
                }
                case "memory" -> {
                    // For memory, we need to use jwksContent directly
                    // Note: This assumes the library supports setting JWKS content directly
                    // If not, we may need to create a temporary file or use a different approach
                    builder.jwksFilePath(jwksSource); // This might need adjustment based on library capabilities
                }
            }

            IssuerConfig issuerConfig = builder.build();
            LOGGER.info(AuthLogMessages.INFO.ISSUER_CONFIG_CREATED.format(issuerName));

            return issuerConfig;
        } catch (Exception e) {
            LOGGER.error(e, AuthLogMessages.ERROR.ISSUER_CONFIG_ERROR.format(issuerName, e.getMessage()));
            return null;
        }
    }

    /**
     * Helper method to handle error cases and route to failure relationship.
     *
     * @param session The process session
     * @param flowFile The flow file to process
     * @param error The processing error details
     * @return The updated flow file with error attributes
     */
    @NonNull
    private FlowFile handleError(@NonNull ProcessSession session,
            @NonNull FlowFile flowFile,
            @NonNull ProcessingError error) {
        // Add error attributes
        Map<String, String> attributes = new HashMap<>();
        attributes.put(JWTAttributes.Error.CODE, error.getErrorCode());
        attributes.put(JWTAttributes.Error.REASON, error.getErrorReason());
        attributes.put(JWTAttributes.Error.CATEGORY, error.getErrorCategory());

        // Update flow file with error attributes
        flowFile = session.putAllAttributes(flowFile, attributes);

        // Transfer to failure relationship
        session.transfer(flowFile, Relationships.AUTHENTICATION_FAILED);

        return flowFile;
    }

    /**
     * Helper method to handle error cases and route to failure relationship (backward compatibility).
     *
     * @param session The process session
     * @param flowFile The flow file to process
     * @param errorCode The error code to set
     * @param errorReason The error reason message
     * @param errorCategory The error category
     * @return The updated flow file with error attributes
     */
    @NonNull
    private FlowFile handleError(@NonNull ProcessSession session,
            @NonNull FlowFile flowFile,
            @NonNull String errorCode,
            @NonNull String errorReason,
            @NonNull String errorCategory) {
        ProcessingError error = ProcessingError.builder()
                .errorCode(errorCode)
                .errorReason(errorReason)
                .errorCategory(errorCategory)
                .build();
        return handleError(session, flowFile, error);
    }

    @Override
    public void onTrigger(@NonNull final ProcessContext context, @NonNull final ProcessSession session) {
        FlowFile flowFile = session.get();
        if (flowFile == null) {
            return;
        }

        // Increment the processed flow files count
        processedFlowFilesCount.incrementAndGet();

        // Log metrics periodically
        if (processedFlowFilesCount.intValue() % LOG_METRICS_INTERVAL == 0) {
            logSecurityMetrics();
        }

        // Add configuration refreshed attribute if configuration was reloaded
        if (configurationRefreshed) {
            flowFile = session.putAttribute(flowFile, JWTAttributes.Config.REFRESHED, "true");
            LOGGER.info("Added " + JWTAttributes.Config.REFRESHED + " attribute to flow file");
            configurationRefreshed = false;
        }

        // Extract token from flow file
        String tokenLocation = context.getProperty(Properties.TOKEN_LOCATION).getValue();
        String token;

        // Extract token based on configured location
        try {
            token = switch (tokenLocation) {
                case "AUTHORIZATION_HEADER" ->
                    extractTokenFromHeader(flowFile, context.getProperty(Properties.TOKEN_HEADER).getValue());
                case "CUSTOM_HEADER" ->
                    extractTokenFromHeader(flowFile, context.getProperty(Properties.CUSTOM_HEADER_NAME).getValue());
                case "FLOW_FILE_CONTENT" -> extractTokenFromContent(flowFile, session);
                default ->
                    // Default to Authorization header
                    extractTokenFromHeader(flowFile, "Authorization");
            };

            // If no token found, check if valid token is required
            if (token == null || token.isEmpty()) {
                boolean requireValidToken = context.getProperty(Properties.REQUIRE_VALID_TOKEN).asBoolean();

                if (!requireValidToken) {
                    // If valid token is not required, route to success
                    LOGGER.info("No token found but valid token not required, routing to success");

                    // Set attributes to indicate no token was present
                    Map<String, String> attributes = new HashMap<>();
                    attributes.put(JWTAttributes.Error.REASON, "No token provided");
                    attributes.put(JWTAttributes.Token.PRESENT, "false");
                    attributes.put(JWTAttributes.Authorization.AUTHORIZED, "false");

                    flowFile = session.putAllAttributes(flowFile, attributes);
                    session.transfer(flowFile, Relationships.SUCCESS);
                    return;
                } else {
                    // If valid token is required, route to failure
                    String contextMessage = ErrorContext.forComponent("MultiIssuerJWTTokenAuthenticator")
                            .operation("extractToken")
                            .errorCode(ErrorContext.ErrorCodes.VALIDATION_ERROR)
                            .build()
                            .with("tokenLocation", tokenLocation)
                            .with("flowFileUuid", flowFile.getAttribute("uuid"))
                            .buildMessage("No token found in the specified location");

                    LOGGER.warn(contextMessage);
                    handleError(
                            session,
                            flowFile,
                            "AUTH-001",
                            i18nResolver.getTranslatedString(JWTTranslationKeys.Error.NO_TOKEN_FOUND, tokenLocation),
                            "EXTRACTION_ERROR"
                    );
                    return;
                }
            }

            // Check token size limits
            int maxTokenSize = context.getProperty(Properties.MAXIMUM_TOKEN_SIZE).asInteger();
            if (token.length() > maxTokenSize) {
                String contextMessage = ErrorContext.forComponent("MultiIssuerJWTTokenAuthenticator")
                        .operation("validateTokenSize")
                        .errorCode(ErrorContext.ErrorCodes.VALIDATION_ERROR)
                        .build()
                        .with("tokenSize", token.length())
                        .with("maxTokenSize", maxTokenSize)
                        .with("flowFileUuid", flowFile.getAttribute("uuid"))
                        .buildMessage("Token exceeds maximum size limit");

                LOGGER.warn(contextMessage);
                handleError(
                        session,
                        flowFile,
                        "AUTH-003",
                        i18nResolver.getTranslatedString(JWTTranslationKeys.Error.TOKEN_SIZE_LIMIT, maxTokenSize),
                        "TOKEN_SIZE_VIOLATION"
                );
                return;
            }

            // Check for obviously malformed tokens (should have at least 2 dots for header.payload.signature)
            if (!token.contains(".")) {
                String contextMessage = ErrorContext.forComponent("MultiIssuerJWTTokenAuthenticator")
                        .operation("validateTokenFormat")
                        .errorCode(ErrorContext.ErrorCodes.TOKEN_ERROR)
                        .build()
                        .with("tokenSegments", token.split("\\.").length)
                        .with("flowFileUuid", flowFile.getAttribute("uuid"))
                        .buildMessage("Token is malformed (missing segments)");

                LOGGER.warn(contextMessage);
                handleError(
                        session,
                        flowFile,
                        "AUTH-004",
                        i18nResolver.getTranslatedString(JWTTranslationKeys.Error.TOKEN_MALFORMED),
                        "MALFORMED_TOKEN"
                );
                return;
            }

            // Validate token using the TokenValidator - will throw TokenValidationException if invalid
            AccessTokenContent accessToken = validateToken(token, context);

            // Perform authorization check
            AuthorizationCheckResult authResult = performAuthorizationCheckWithDetails(accessToken);

            // Token is valid, add claims as attributes
            Map<String, String> attributes = extractClaims(accessToken);

            // Add token presence indicator
            attributes.put(JWTAttributes.Token.PRESENT, "true");

            // Add authorization result
            attributes.put(JWTAttributes.Authorization.AUTHORIZED, String.valueOf(authResult.isAuthorized()));
            if (authResult.isBypassed()) {
                attributes.put(JWTAttributes.Authorization.BYPASSED, "true");
            }

            flowFile = session.putAllAttributes(flowFile, attributes);

            // Transfer to success relationship
            session.transfer(flowFile, Relationships.SUCCESS);

        } catch (TokenValidationException e) {
            // Token validation failed
            LOGGER.warn("Token validation failed: %s", e.getMessage());
            String errorMessage = i18nResolver.getTranslatedString(JWTTranslationKeys.Error.TOKEN_VALIDATION_FAILED, e.getMessage());

            // Determine more specific error code based on event type
            String errorCode = "AUTH-002"; // Default error code
            String category = e.getCategory().name();

            // Map common validation failures to specific error codes
            if (category.contains("EXPIRED")) {
                errorCode = "AUTH-005";
            } else if (category.contains("SIGNATURE")) {
                errorCode = "AUTH-006";
            } else if (category.contains("ISSUER")) {
                errorCode = "AUTH-007";
            } else if (category.contains("AUDIENCE")) {
                errorCode = "AUTH-008";
            }

            handleError(session, flowFile, errorCode, errorMessage, category);
        } catch (Exception e) {
            String contextMessage = ErrorContext.forComponent("MultiIssuerJWTTokenAuthenticator")
                    .operation("onTrigger")
                    .errorCode(ErrorContext.ErrorCodes.PROCESSING_ERROR)
                    .cause(e)
                    .build()
                    .with("flowFileUuid", flowFile.getAttribute("uuid"))
                    .with("tokenLocation", tokenLocation)
                    .buildMessage("Error processing flow file");

            LOGGER.error(e, contextMessage);
            handleError(
                    session,
                    flowFile,
                    "AUTH-999",
                    i18nResolver.getTranslatedString(JWTTranslationKeys.Error.UNKNOWN, e.getMessage()),
                    "PROCESSING_ERROR"
            );
        }
    }

    /**
     * Extracts a token from a header in the flow file.
     *
     * @param flowFile   The flow file containing the header
     * @param headerName The name of the header containing the token
     * @return The extracted token, or null if not found
     */
    private String extractTokenFromHeader(FlowFile flowFile, String headerName) {
        String headerValue = flowFile.getAttribute("http.headers." + headerName.toLowerCase());

        if (headerValue == null || headerValue.isEmpty()) {
            return null;
        }

        // If header starts with Bearer prefix, strip it
        String prefix = "Bearer ";
        if (headerValue.startsWith(prefix)) {
            return headerValue.substring(prefix.length()).trim();
        }

        return headerValue.trim();
    }

    /**
     * Extracts a token from the content of the flow file.
     *
     * @param flowFile The flow file containing the token
     * @param session  The process session
     * @return The extracted token, or null if not found
     */
    private String extractTokenFromContent(FlowFile flowFile, ProcessSession session) {
        final StringBuilder contentBuilder = new StringBuilder();

        session.read(flowFile, inputStream -> {
            byte[] buffer = new byte[4096];
            int len;
            while ((len = inputStream.read(buffer)) != -1) {
                contentBuilder.append(new String(buffer, 0, len, StandardCharsets.UTF_8));
            }
        });

        String content = contentBuilder.toString().trim();
        return content.isEmpty() ? null : content;
    }

    /**
     * Validates a token using the TokenValidator from cui-jwt-validation.
     *
     * @param tokenString The JWT token string to validate
     * @param context     The process context
     * @return The parsed token if valid
     * @throws TokenValidationException if the token is invalid
     */
    private AccessTokenContent validateToken(String tokenString, ProcessContext context) throws TokenValidationException {
        // Validate algorithm before token processing
        validateTokenAlgorithm(tokenString, context);

        // Get the TokenValidator
        TokenValidator validator = getTokenValidator(context);

        if (validator == null) {
            throw new IllegalStateException("No TokenValidator available - no issuer configurations provided");
        }

        return validator.createAccessToken(tokenString);
    }

    /**
     * Validates that the JWT token uses an allowed signing algorithm.
     *
     * @param tokenString The JWT token string to validate
     * @param context     The process context
     * @throws TokenValidationException if the algorithm is not allowed
     */
    private void validateTokenAlgorithm(String tokenString, ProcessContext context) throws TokenValidationException {
        try {
            // Parse the JWT header to extract the algorithm
            String[] tokenParts = tokenString.split("\\.");
            if (tokenParts.length < 2) {
                throw new TokenValidationException(EventType.SIGNATURE_VALIDATION_FAILED, "Invalid JWT token format - insufficient segments");
            }

            // Decode the header (first part)
            String headerJson = new String(Base64.getDecoder().decode(tokenParts[0]), StandardCharsets.UTF_8);

            // Parse the JSON to extract the algorithm
            String algorithm = extractAlgorithmFromHeader(headerJson);

            // Create SignatureAlgorithmPreferences instance
            // Check if custom algorithms are configured, otherwise use secure defaults
            SignatureAlgorithmPreferences algorithmPreferences;
            String allowedAlgorithmsConfig = context.getProperty(Properties.ALLOWED_ALGORITHMS).getValue();

            if (allowedAlgorithmsConfig != null && !allowedAlgorithmsConfig.trim().isEmpty()) {
                // Use configured algorithms
                List<String> configuredAlgorithms = Arrays.stream(allowedAlgorithmsConfig.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .collect(Collectors.toList());
                algorithmPreferences = new SignatureAlgorithmPreferences(configuredAlgorithms);
                LOGGER.debug("Using configured signature algorithms: %s", configuredAlgorithms);
            } else {
                // Use secure defaults from SignatureAlgorithmPreferences
                algorithmPreferences = new SignatureAlgorithmPreferences();
                LOGGER.debug("Using default secure signature algorithms: %s", algorithmPreferences.getPreferredAlgorithms());
            }

            // Validate the algorithm using SignatureAlgorithmPreferences
            if (!algorithmPreferences.isSupported(algorithm)) {
                String contextMessage = ErrorContext.forComponent("MultiIssuerJWTTokenAuthenticator")
                        .operation("validateTokenAlgorithm")
                        .errorCode(ErrorContext.ErrorCodes.SECURITY_ERROR)
                        .build()
                        .with("algorithm", algorithm)
                        .with("supportedAlgorithms", algorithmPreferences.getPreferredAlgorithms())
                        .buildMessage("Token uses unsupported or insecure algorithm");
                LOGGER.warn(contextMessage);
                throw new TokenValidationException(EventType.SIGNATURE_VALIDATION_FAILED,
                        "Token algorithm '" + algorithm + "' is not supported. Supported algorithms: " + algorithmPreferences.getPreferredAlgorithms());
            }

            LOGGER.debug("Token algorithm '%s' is supported and secure", algorithm);

        } catch (IllegalArgumentException e) {
            // Base64 decoding failed
            String contextMessage = ErrorContext.forComponent("MultiIssuerJWTTokenAuthenticator")
                    .operation("validateTokenAlgorithm")
                    .errorCode(ErrorContext.ErrorCodes.TOKEN_ERROR)
                    .cause(e)
                    .build()
                    .buildMessage("Failed to decode JWT header");
            LOGGER.warn(contextMessage);
            throw new TokenValidationException(EventType.SIGNATURE_VALIDATION_FAILED, "Invalid JWT token format - cannot decode header");
        } catch (Exception e) {
            // Any other parsing error
            String contextMessage = ErrorContext.forComponent("MultiIssuerJWTTokenAuthenticator")
                    .operation("validateTokenAlgorithm")
                    .errorCode(ErrorContext.ErrorCodes.TOKEN_ERROR)
                    .cause(e)
                    .build()
                    .buildMessage("Failed to validate JWT algorithm");
            LOGGER.warn(contextMessage);
            throw new TokenValidationException(EventType.SIGNATURE_VALIDATION_FAILED, "Failed to validate JWT algorithm");
        }
    }

    /**
     * Extracts the algorithm claim from a JWT header JSON string.
     *
     * @param headerJson The JWT header as JSON string
     * @return The algorithm value
     * @throws TokenValidationException if the algorithm cannot be extracted
     */
    private String extractAlgorithmFromHeader(String headerJson) throws TokenValidationException {
        // Simple JSON parsing to extract the "alg" field
        // Using a simple approach to avoid adding JSON parsing dependencies
        try {
            // Look for the "alg" field in the JSON
            String algPattern = "\"alg\"\\s*:\\s*\"([^\"]+)\"";
            Pattern pattern = Pattern.compile(algPattern);
            Matcher matcher = pattern.matcher(headerJson);

            if (matcher.find()) {
                return matcher.group(1);
            }

            // If no algorithm found, this is suspicious
            throw new TokenValidationException(EventType.SIGNATURE_VALIDATION_FAILED, "JWT header does not contain algorithm field");

        } catch (Exception e) {
            throw new TokenValidationException(EventType.SIGNATURE_VALIDATION_FAILED, "Failed to parse JWT header for algorithm");
        }
    }


    /**
     * Extracts claims from a token and converts them to a map of attributes.
     *
     * @param token The parsed access token
     * @return A map of claim names to string values
     */
    private Map<String, String> extractClaims(AccessTokenContent token) {
        Map<String, String> claims = new HashMap<>();

        // Add validation metadata
        claims.put(JWTAttributes.Token.VALIDATED_AT, Instant.now().toString());

        // Add token identity information
        claims.put(JWTAttributes.Token.SUBJECT, token.getSubject().orElse(""));
        claims.put(JWTAttributes.Token.ISSUER, token.getIssuer());
        claims.put(JWTAttributes.Token.EXPIRATION, token.getExpirationTime().toString());

        // Add roles as a comma-separated list if available
        List<String> roles = token.getRoles();
        if (!roles.isEmpty()) {
            claims.put(JWTAttributes.Authorization.ROLES, String.join(",", roles));
        }

        // Add groups as a comma-separated list if available
        List<String> groups = token.getGroups();
        if (!groups.isEmpty()) {
            claims.put(JWTAttributes.Authorization.GROUPS, String.join(",", groups));
        }

        // Get scopes directly from the token
        List<String> scopes = token.getScopes();
        if (!scopes.isEmpty()) {
            claims.put(JWTAttributes.Authorization.SCOPES, String.join(",", scopes));
        }

        // Add all token claims with consistent "jwt.content." prefix, filtering out duplicates
        token.getClaims().forEach((key, claimValue) -> {
            if (!FILTERED_CLAIM_KEYS.contains(key)) {
                claims.put(JWTAttributes.Content.PREFIX + key, claimValue.getOriginalString());
            }
        });

        return claims;
    }

    /**
     * Creates authorization configuration from issuer properties.
     * BREAKING CHANGE: Now requires explicit authorization configuration or bypass.
     *
     * @param issuerName The name of the issuer
     * @param properties The issuer properties
     * @return The authorization configuration, or null if bypass is explicitly set
     */
    private AuthorizationValidator.AuthorizationConfig createAuthorizationConfig(String issuerName, Map<String, String> properties) {
        // Check if bypass authorization is explicitly set
        boolean bypassAuthorization = Boolean.parseBoolean(properties.getOrDefault(Issuer.BYPASS_AUTHORIZATION, "false"));

        if (bypassAuthorization) {
            LOGGER.warn(AuthLogMessages.WARN.AUTHORIZATION_BYPASS_ENABLED.format(issuerName));
            return null;
        }

        // Check if any authorization properties are set
        String requiredScopes = properties.get(Issuer.REQUIRED_SCOPES);
        String requiredRoles = properties.get(Issuer.REQUIRED_ROLES);

        if ((requiredScopes == null || requiredScopes.isEmpty()) &&
                (requiredRoles == null || requiredRoles.isEmpty())) {
            // BREAKING CHANGE: No authorization configuration is now considered a security error
            LOGGER.error(AuthLogMessages.ERROR.NO_AUTHORIZATION_CONFIG.format(issuerName));
            // Create a configuration that will deny all access
            return AuthorizationValidator.AuthorizationConfig.builder()
                    .requiredScopes(Set.of("__DENY_ALL__"))  // Impossible scope to match
                    .requireAllScopes(true)
                    .build();
        }

        // Parse comma-separated values
        Set<String> scopeSet = null;
        if (requiredScopes != null && !requiredScopes.isEmpty()) {
            scopeSet = new HashSet<>(Arrays.asList(requiredScopes.split(",")));
            scopeSet.removeIf(String::isEmpty);
        }

        Set<String> roleSet = null;
        if (requiredRoles != null && !requiredRoles.isEmpty()) {
            roleSet = new HashSet<>(Arrays.asList(requiredRoles.split(",")));
            roleSet.removeIf(String::isEmpty);
        }

        // Get boolean properties
        boolean requireAllScopes = Boolean.parseBoolean(properties.getOrDefault(Issuer.REQUIRE_ALL_SCOPES, "false"));
        boolean requireAllRoles = Boolean.parseBoolean(properties.getOrDefault(Issuer.REQUIRE_ALL_ROLES, "false"));
        boolean caseSensitive = Boolean.parseBoolean(properties.getOrDefault(Issuer.CASE_SENSITIVE_MATCHING, "true"));

        return AuthorizationValidator.AuthorizationConfig.builder()
                .requiredScopes(scopeSet)
                .requiredRoles(roleSet)
                .requireAllScopes(requireAllScopes)
                .requireAllRoles(requireAllRoles)
                .caseSensitive(caseSensitive)
                .build();
    }

    /**
     * Result of authorization check including bypass status.
     */
    private static class AuthorizationCheckResult {
        private final boolean authorized;
        private final boolean bypassed;

        public AuthorizationCheckResult(boolean authorized, boolean bypassed) {
            this.authorized = authorized;
            this.bypassed = bypassed;
        }

        public boolean isAuthorized() {
            return authorized;
        }

        public boolean isBypassed() {
            return bypassed;
        }
    }

    /**
     * Performs authorization check for the validated token with detailed result.
     * BREAKING CHANGE: Now fails secure - denies access if no authorization configuration exists.
     *
     * @param accessToken The validated access token
     * @return AuthorizationCheckResult with authorization status and bypass flag
     */
    private AuthorizationCheckResult performAuthorizationCheckWithDetails(AccessTokenContent accessToken) {
        boolean isAuthorized = performAuthorizationCheck(accessToken);
        // Check if this was a bypass by checking if auth config is null for this issuer
        String tokenIssuer = accessToken.getIssuer();
        boolean bypassed = false;

        for (Map.Entry<String, IssuerConfig> issuerEntry : issuerConfigCache.entrySet()) {
            String issuerName = issuerEntry.getKey();
            IssuerConfig issuerConfig = issuerEntry.getValue();

            if (issuerConfig != null && tokenIssuer.equals(issuerConfig.getIssuerIdentifier())) {
                AuthorizationValidator.AuthorizationConfig authConfig = authorizationConfigCache.get(issuerName);
                if (authConfig == null && isAuthorized) {
                    bypassed = true;
                }
                break;
            }
        }

        return new AuthorizationCheckResult(isAuthorized, bypassed);
    }

    /**
     * Performs authorization check for the validated token.
     * BREAKING CHANGE: Now fails secure - denies access if no authorization configuration exists.
     *
     * @param accessToken The validated access token
     * @return true if authorized, false otherwise
     */
    private boolean performAuthorizationCheck(AccessTokenContent accessToken) {
        // Get the issuer from the token
        String tokenIssuer = accessToken.getIssuer();

        // Find the matching authorization configuration
        // First try to find exact match by issuer value
        AuthorizationValidator.AuthorizationConfig authConfig = null;
        boolean issuerFound = false;

        // Look through all issuer configurations to find a match
        for (Map.Entry<String, IssuerConfig> issuerEntry : issuerConfigCache.entrySet()) {
            String issuerName = issuerEntry.getKey();
            IssuerConfig issuerConfig = issuerEntry.getValue();

            // Check if this issuer configuration matches the token issuer
            if (issuerConfig != null && tokenIssuer.equals(issuerConfig.getIssuerIdentifier())) {
                // Found matching issuer
                issuerFound = true;
                authConfig = authorizationConfigCache.get(issuerName);
                break;
            }
        }

        // BREAKING CHANGE: If no matching issuer found, deny access (fail-secure)
        if (!issuerFound) {
            LOGGER.error(AuthLogMessages.ERROR.NO_ISSUER_CONFIG_FOR_TOKEN.format(tokenIssuer));
            return false;
        }

        // If authorization config is null, it means bypass was explicitly set
        if (authConfig == null) {
            LOGGER.info(AuthLogMessages.INFO.AUTHORIZATION_BYPASSED.format(tokenIssuer));
            return true;
        }

        // Perform authorization validation
        AuthorizationValidator.AuthorizationResult result = AuthorizationValidator.validate(accessToken, authConfig);

        if (!result.isAuthorized()) {
            LOGGER.warn(AuthLogMessages.WARN.AUTHORIZATION_FAILED.format(
                    accessToken.getSubject().orElse("unknown"), tokenIssuer, result.getReason()));
        } else {
            LOGGER.debug(AuthLogMessages.INFO.AUTHORIZATION_SUCCESSFUL.format(
                    accessToken.getSubject().orElse("unknown"), tokenIssuer));
        }

        return result.isAuthorized();
    }

    /**
     * Logs security metrics information.
     * This provides visibility into token validation activity.
     */
    private void logSecurityMetrics() {
        LOGGER.info("Token validation metrics - Processed flow files: %d", processedFlowFilesCount);

        // Log information about the SecurityEventCounter if available
        if (securityEventCounter != null) {
            LOGGER.info("Security event counter is available for monitoring");

            // Note: In future versions, more detailed metrics will be available from the SecurityEventCounter
            // For now, we just log that it's available
        } else {
            LOGGER.info("Security event counter is not available for monitoring");
        }

    }

}
