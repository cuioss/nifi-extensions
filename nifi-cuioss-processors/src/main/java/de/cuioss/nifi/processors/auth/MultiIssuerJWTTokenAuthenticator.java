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

import de.cuioss.jwt.validation.IssuerConfig;
import de.cuioss.jwt.validation.TokenValidator;
import de.cuioss.jwt.validation.domain.token.AccessTokenContent;
import de.cuioss.jwt.validation.exception.TokenValidationException;
import de.cuioss.jwt.validation.security.SecurityEventCounter;
import de.cuioss.nifi.processors.auth.config.ConfigurationManager;
import de.cuioss.nifi.processors.auth.i18n.I18nResolver;
import de.cuioss.nifi.processors.auth.i18n.NiFiI18nResolver;
import de.cuioss.tools.logging.CuiLogger;
import lombok.EqualsAndHashCode;
import lombok.Getter;
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

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.*;
import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Properties;
import static de.cuioss.nifi.processors.auth.JWTPropertyKeys.Issuer;
import static de.cuioss.nifi.processors.auth.JWTTranslationKeys.Property;
import static de.cuioss.nifi.processors.auth.JWTTranslationKeys.Validation;

/**
 * MultiIssuerJWTTokenAuthenticator is a NiFi processor that validates JWT tokens from multiple issuers.
 * It extracts JWT tokens from flow files, validates them against configured issuers, and routes
 * flow files based on validation results.
 */
@Tags({"jwt", "oauth", "authentication", "authorization", "security", "token"})
@CapabilityDescription("Validates JWT tokens from multiple issuers. Extracts JWT tokens from flow files, " +
    "validates them against configured issuers, and routes flow files based on validation results.")
@SeeAlso({})
@ReadsAttributes({
    @ReadsAttribute(attribute = "http.headers.authorization", description = "HTTP Authorization header containing the JWT token")
})
@WritesAttributes({
    @WritesAttribute(attribute = JWTAttributes.Content.PREFIX + "*", description = "JWT token claims"),
    @WritesAttribute(attribute = JWTAttributes.Token.VALIDATED_AT, description = "Timestamp when the token was validated"),
    @WritesAttribute(attribute = JWTAttributes.Token.AUTHORIZATION_PASSED, description = "Whether the token passed authorization checks"),
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

    private I18nResolver i18nResolver;

    @Getter
    private List<PropertyDescriptor> supportedPropertyDescriptors;

    @Getter
    private Set<Relationship> relationships;

    @Override
    protected void init(final ProcessorInitializationContext context) {
        // Initialize i18n resolver
        i18nResolver = NiFiI18nResolver.createDefault(context.getLogger());

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
        this.supportedPropertyDescriptors = descriptors;

        final Set<Relationship> rels = new HashSet<>();
        rels.add(Relationships.SUCCESS);
        rels.add(Relationships.AUTHENTICATION_FAILED);
        this.relationships = rels;

        LOGGER.info("MultiIssuerJWTTokenAuthenticator processor initialized with {} property descriptors",
            descriptors.size());
    }

    @Override
    protected PropertyDescriptor getSupportedDynamicPropertyDescriptor(final String propertyDescriptorName) {
        // Support dynamic properties for issuer configuration
        if (propertyDescriptorName.startsWith(ISSUER_PREFIX)) {
            String issuerProperty = propertyDescriptorName.substring(ISSUER_PREFIX.length());
            int dotIndex = issuerProperty.indexOf('.');

            if (dotIndex > 0) {
                String issuerName = issuerProperty.substring(0, dotIndex);
                String propertyKey = issuerProperty.substring(dotIndex + 1);

                // Create a more descriptive display name and description
                String displayName = i18nResolver.getTranslatedString(Property.Issuer.DYNAMIC_NAME, issuerName, propertyKey);


                // Add specific validators based on property key
                switch (propertyKey) {
                    case Issuer.JWKS_URL -> {
                        return new PropertyDescriptor.Builder()
                            .name(propertyDescriptorName)
                            .displayName(displayName)
                            .description(i18nResolver.getTranslatedString(Property.Issuer.JWKS_URL_DESCRIPTION, propertyKey, issuerName))
                            .required(false)
                            .dynamic(true)
                            .addValidator(StandardValidators.URL_VALIDATOR)
                            .build();
                    }
                    case Issuer.ISSUER_NAME -> {
                        return new PropertyDescriptor.Builder()
                            .name(propertyDescriptorName)
                            .displayName(displayName)
                            .description(i18nResolver.getTranslatedString(Property.Issuer.ISSUER_DESCRIPTION, propertyKey, issuerName))
                            .required(false)
                            .dynamic(true)
                            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                            .build();
                    }
                    case Issuer.AUDIENCE, Issuer.CLIENT_ID -> {
                        return new PropertyDescriptor.Builder()
                            .name(propertyDescriptorName)
                            .displayName(displayName)
                            .description(i18nResolver.getTranslatedString(
                                Issuer.AUDIENCE.equals(propertyKey) ? Property.Issuer.AUDIENCE_DESCRIPTION : Property.Issuer.CLIENT_ID_DESCRIPTION,
                                propertyKey, issuerName))
                            .required(false)
                            .dynamic(true)
                            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                            .build();
                    }
                    default -> new PropertyDescriptor.Builder()
                        .name(propertyDescriptorName)
                        .displayName(propertyDescriptorName)
                        .description("Dynamic property for issuer configuration")
                        .required(false)
                        .dynamic(true)
                        .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                        .build();
                }
            }
        }

        // Support other dynamic properties
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
    public void onScheduled(final ProcessContext context) {
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

                    // Create a new TokenValidator with issuer configurations
                    // The TokenValidator creates a SecurityEventCounter internally
                    TokenValidator newValidator = new TokenValidator(issuerConfigs.toArray(new IssuerConfig[0]));
                    tokenValidator.set(newValidator);

                    // Get the SecurityEventCounter for metrics
                    securityEventCounter = tokenValidator.get().getSecurityEventCounter();

                    // Update configuration hash
                    configurationHash.set(currentConfigHash);

                    LOGGER.info(AuthLogMessages.INFO.TOKEN_VALIDATOR_INITIALIZED.format(issuerConfigs.size()));

                    // Clear the issuer Config cache to ensure we don't use stale configurations
                    issuerConfigCache.clear();
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
        // Step 1: Load issuer properties from all sources
        Map<String, Map<String, String>> issuerPropertiesMap = new HashMap<>();
        Set<String> currentIssuerNames = new HashSet<>();

        // Load configurations from external sources and UI
        loadIssuerConfigurations(context, issuerPropertiesMap, currentIssuerNames);

        // Step 2: Clean up removed issuers from cache
        cleanupRemovedIssuers(currentIssuerNames);

        // Step 3: Process each issuer configuration
        List<IssuerConfig> issuerConfigs = processIssuerConfigurations(issuerPropertiesMap, context);

        // Step 4: Log summary
        logConfigurationSummary(issuerConfigs);

        return issuerConfigs;
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
                    issuerProps.computeIfAbsent(propertyKey, k-> context.getProperty(propertyDescriptor).getValue());
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
            IssuerConfig issuerConfig = createIssuerConfig(issuerName, properties, context);
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

        // Check required properties
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
     * @param context    The process context
     * @return The IssuerConfig object, or null if the required properties are missing
     */
    private IssuerConfig createIssuerConfig(String issuerName, Map<String, String> properties, ProcessContext context) {
        // Required properties
        String jwksUrl = properties.get(Issuer.JWKS_URL);
        String issuer = properties.get(Issuer.ISSUER_NAME);

        if (jwksUrl == null || jwksUrl.isEmpty()) {
            LOGGER.warn(AuthLogMessages.WARN.MISSING_JWKS_URL.format(issuerName));
            return null;
        }

        if (issuer == null || issuer.isEmpty()) {
            // Use issuer name as default if not specified
            issuer = issuerName;
            LOGGER.info("Using issuer name '%s' as default issuer value", issuerName);
        }

        // Optional properties
        String audience = properties.get(Issuer.AUDIENCE);
        String clientId = properties.get(Issuer.CLIENT_ID);

        // Log the properties for debugging
        LOGGER.info("Creating issuer configuration for %s with properties: jwksUrl=%s, issuer=%s, audience=%s, clientId=%s",
            issuerName, jwksUrl, issuer, audience, clientId);

        try {
            // TODO: Implement proper IssuerConfig creation using the cui-jwt-validation library
            // This requires proper integration with the library's API which is not yet available
            // For now, log a warning and return null to indicate validation will fail

            LOGGER.warn(AuthLogMessages.WARN.ISSUER_CONFIG_NOT_IMPLEMENTED.format(issuerName));

            // Return null to indicate that validation will fail
            // This should be replaced with proper implementation when the library integration is complete
            return null;
        } catch (Exception e) {
            LOGGER.error(e, AuthLogMessages.ERROR.ISSUER_CONFIG_ERROR.format(issuerName, e.getMessage()));
            return null;
        }
    }

    /**
     * Helper method to handle error cases and route to failure relationship.
     *
     * @param session       The process session
     * @param flowFile      The flow file to process
     * @param errorCode     The error code to set
     * @param errorReason   The error reason message
     * @param errorCategory The error category
     * @return The updated flow file with error attributes
     */
    private FlowFile handleError(
        ProcessSession session,
        FlowFile flowFile,
        String errorCode,
        String errorReason,
        String errorCategory) {

        // Add error attributes
        Map<String, String> attributes = new HashMap<>();
        attributes.put(JWTAttributes.Error.CODE, errorCode);
        attributes.put(JWTAttributes.Error.REASON, errorReason);
        attributes.put(JWTAttributes.Error.CATEGORY, errorCategory);

        // Update flow file with error attributes
        flowFile = session.putAllAttributes(flowFile, attributes);

        // Transfer to failure relationship
        session.transfer(flowFile, Relationships.AUTHENTICATION_FAILED);

        return flowFile;
    }

    @Override
    public void onTrigger(final ProcessContext context, final ProcessSession session) {
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
        String token = null;

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

            // If no token found, log warning and route to failure
            if (token == null || token.isEmpty()) {
                LOGGER.warn("No token found in the specified location: %s", tokenLocation);
                handleError(
                    session,
                    flowFile,
                    "AUTH-001",
                    i18nResolver.getTranslatedString(JWTTranslationKeys.Error.NO_TOKEN_FOUND, tokenLocation),
                    "EXTRACTION_ERROR"
                );
                return;
            }

            // Check token size limits
            int maxTokenSize = context.getProperty(Properties.MAXIMUM_TOKEN_SIZE).asInteger();
            if (token.length() > maxTokenSize) {
                LOGGER.warn(AuthLogMessages.WARN.TOKEN_SIZE_EXCEEDED.format(maxTokenSize));
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
                LOGGER.warn("Token is malformed (missing segments)");
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

            // Token is valid, add claims as attributes
            Map<String, String> attributes = extractClaims(accessToken);
            flowFile = session.putAllAttributes(flowFile, attributes);

            // Transfer to success relationship
            session.transfer(flowFile, Relationships.SUCCESS);

        } catch (TokenValidationException e) {
            // Token validation failed
            LOGGER.warn("Token validation failed: %s", e.getMessage());
            String errorMessage = i18nResolver.getTranslatedString(JWTTranslationKeys.Error.TOKEN_VALIDATION_FAILED, e.getMessage());

            // Determine more specific error code based on event type
            String errorCode = "AUTH-002"; // Default error code
            String category = e.getEventType().name();

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
            LOGGER.error(e, "Error processing flow file: %s", e.getMessage());
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
                contentBuilder.append(new String(buffer, 0, len, java.nio.charset.StandardCharsets.UTF_8));
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
        // Get the TokenValidator
        TokenValidator validator = getTokenValidator(context);
        return validator.createAccessToken(tokenString);
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
        claims.put(JWTAttributes.Token.AUTHORIZATION_PASSED, "true");

        // Add token identity information
        claims.put(JWTAttributes.Token.SUBJECT, token.getSubject());
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
