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

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;


import lombok.Getter;
import org.apache.nifi.annotation.behavior.ReadsAttribute;
import org.apache.nifi.annotation.behavior.ReadsAttributes;
import org.apache.nifi.annotation.behavior.RequiresInstanceClassLoading;
import org.apache.nifi.annotation.behavior.WritesAttribute;
import org.apache.nifi.annotation.behavior.WritesAttributes;
import org.apache.nifi.annotation.documentation.CapabilityDescription;
import org.apache.nifi.annotation.documentation.SeeAlso;
import org.apache.nifi.annotation.documentation.Tags;
import org.apache.nifi.annotation.lifecycle.OnScheduled;
import org.apache.nifi.annotation.lifecycle.OnStopped;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.flowfile.FlowFile;
import org.apache.nifi.processor.AbstractProcessor;
import org.apache.nifi.processor.ProcessContext;
import org.apache.nifi.processor.ProcessSession;
import org.apache.nifi.processor.ProcessorInitializationContext;
import org.apache.nifi.processor.Relationship;
import org.apache.nifi.processor.util.StandardValidators;

import de.cuioss.jwt.validation.IssuerConfig;
import de.cuioss.jwt.validation.TokenValidator;
import de.cuioss.jwt.validation.domain.token.AccessTokenContent;
import de.cuioss.jwt.validation.exception.TokenValidationException;
import de.cuioss.jwt.validation.security.SecurityEventCounter;
import de.cuioss.nifi.processors.auth.config.ConfigurationManager;
import de.cuioss.nifi.processors.auth.i18n.I18nResolver;
import de.cuioss.nifi.processors.auth.i18n.NiFiI18nResolver;
import de.cuioss.tools.logging.CuiLogger;

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
public class MultiIssuerJWTTokenAuthenticator extends AbstractProcessor {

    private static final CuiLogger LOGGER = new CuiLogger(MultiIssuerJWTTokenAuthenticator.class);

    // TokenValidator instance for token validation
    private final AtomicReference<TokenValidator> tokenValidator = new AtomicReference<>();

    // Security event counter for tracking validation events
    private SecurityEventCounter securityEventCounter;

    // Lock object for thread-safe initialization
    private final Object tokenValidatorLock = new Object();

    // Counter for tracking when to log metrics
    private final AtomicLong processedFlowFilesCount = new AtomicLong();
    private static final long LOG_METRICS_INTERVAL = 100; // Log metrics every 100 flow files

    // Configuration manager for static files and environment variables
    private ConfigurationManager configurationManager;

    // Flag to track if configuration was reloaded
    private volatile boolean configurationRefreshed = false;

    // Hash of current configuration to detect changes
    private final AtomicReference<String> configurationHash = new AtomicReference<>("");

    // Configuration cache to avoid recreating objects unnecessarily
    private final Map<String, IssuerConfig> issuerConfigCache = new ConcurrentHashMap<>();

    // I18n resolver for internationalization
    private I18nResolver i18nResolver;

    // Issuer prefix for dynamic properties
    public static final String ISSUER_PREFIX = "issuer.";

    // Relationships
    public static final Relationship SUCCESS = new Relationship.Builder()
            .name("success")
            .description("FlowFiles with valid tokens will be routed to this relationship")
            .build();

    public static final Relationship AUTHENTICATION_FAILED = new Relationship.Builder()
            .name("authentication-failed")
            .description("FlowFiles with invalid tokens will be routed to this relationship")
            .build();

    // Property Descriptors
    public static final PropertyDescriptor TOKEN_LOCATION = new PropertyDescriptor.Builder()
            .name(JWTAttributes.Properties.Validation.TOKEN_LOCATION)
            .displayName("Token Location") // Will be set dynamically in init method
            .description("Defines where to extract the token from") // Will be set dynamically in init method
            .required(true)
            .allowableValues("AUTHORIZATION_HEADER", "CUSTOM_HEADER", "FLOW_FILE_CONTENT")
            .defaultValue("AUTHORIZATION_HEADER")
            .build();

    public static final PropertyDescriptor TOKEN_HEADER = new PropertyDescriptor.Builder()
            .name(JWTAttributes.Properties.Validation.TOKEN_HEADER)
            .displayName("Token Header")
            .description("The header name containing the token when using AUTHORIZATION_HEADER")
            .required(false)
            .defaultValue("Authorization")
            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
            .build();

    public static final PropertyDescriptor CUSTOM_HEADER_NAME = new PropertyDescriptor.Builder()
            .name(JWTAttributes.Properties.Validation.CUSTOM_HEADER_NAME)
            .displayName("Custom Header Name")
            .description("The custom header name when using CUSTOM_HEADER")
            .required(false)
            .defaultValue("X-Authorization")
            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
            .build();

    public static final PropertyDescriptor BEARER_TOKEN_PREFIX = new PropertyDescriptor.Builder()
            .name(JWTAttributes.Properties.Validation.BEARER_TOKEN_PREFIX)
            .displayName("Bearer Token Prefix")
            .description("The prefix to strip from the token (e.g., \"Bearer \")")
            .required(false)
            .defaultValue("Bearer")
            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
            .build();

    public static final PropertyDescriptor REQUIRE_VALID_TOKEN = new PropertyDescriptor.Builder()
            .name(JWTAttributes.Properties.Validation.REQUIRE_VALID_TOKEN)
            .displayName("Require Valid Token")
            .description("Whether to require a valid token for processing")
            .required(true)
            .defaultValue("true")
            .allowableValues("true", "false")
            .build();

    public static final PropertyDescriptor JWKS_REFRESH_INTERVAL = new PropertyDescriptor.Builder()
            .name(JWTAttributes.Properties.Validation.JWKS_REFRESH_INTERVAL)
            .displayName("JWKS Refresh Interval")
            .description("Interval in seconds for refreshing JWKS keys")
            .required(true)
            .defaultValue("3600")
            .addValidator(StandardValidators.POSITIVE_INTEGER_VALIDATOR)
            .build();

    public static final PropertyDescriptor MAXIMUM_TOKEN_SIZE = new PropertyDescriptor.Builder()
            .name(JWTAttributes.Properties.Validation.MAXIMUM_TOKEN_SIZE)
            .displayName("Maximum Token Size")
            .description("Maximum token size in bytes")
            .required(true)
            .defaultValue("16384")
            .addValidator(StandardValidators.POSITIVE_INTEGER_VALIDATOR)
            .build();

    public static final PropertyDescriptor ALLOWED_ALGORITHMS = new PropertyDescriptor.Builder()
            .name(JWTAttributes.Properties.Validation.ALLOWED_ALGORITHMS)
            .displayName("Allowed Algorithms")
            .description("Comma-separated list of allowed JWT signing algorithms. " +
                    "Recommended secure algorithms: RS256, RS384, RS512, ES256, ES384, ES512, PS256, PS384, PS512. " +
                    "The 'none' algorithm is never allowed regardless of this setting.")
            .required(true)
            .defaultValue("RS256,RS384,RS512,ES256,ES384,ES512,PS256,PS384,PS512")
            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
            .build();

    public static final PropertyDescriptor REQUIRE_HTTPS_FOR_JWKS = new PropertyDescriptor.Builder()
            .name(JWTAttributes.Properties.Validation.REQUIRE_HTTPS_FOR_JWKS)
            .displayName("Require HTTPS for JWKS URLs")
            .description("Whether to require HTTPS for JWKS URLs. Strongly recommended for production environments.")
            .required(true)
            .defaultValue("true")
            .allowableValues("true", "false")
            .build();

    public static final PropertyDescriptor JWKS_CONNECTION_TIMEOUT = new PropertyDescriptor.Builder()
            .name(JWTAttributes.Properties.Validation.JWKS_CONNECTION_TIMEOUT)
            .displayName("JWKS Connection Timeout")
            .description("Timeout in seconds for JWKS endpoint connections")
            .required(true)
            .defaultValue("10")
            .addValidator(StandardValidators.POSITIVE_INTEGER_VALIDATOR)
            .build();


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
        descriptors.add(TOKEN_LOCATION);
        descriptors.add(TOKEN_HEADER);
        descriptors.add(CUSTOM_HEADER_NAME);
        descriptors.add(BEARER_TOKEN_PREFIX);
        descriptors.add(REQUIRE_VALID_TOKEN);
        descriptors.add(JWKS_REFRESH_INTERVAL);
        descriptors.add(MAXIMUM_TOKEN_SIZE);
        descriptors.add(ALLOWED_ALGORITHMS);
        descriptors.add(REQUIRE_HTTPS_FOR_JWKS);
        descriptors.add(JWKS_CONNECTION_TIMEOUT);
        this.supportedPropertyDescriptors = descriptors;

        final Set<Relationship> relationships = new HashSet<>();
        relationships.add(SUCCESS);
        relationships.add(AUTHENTICATION_FAILED);
        this.relationships = relationships;

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
                String displayName = i18nResolver.getTranslatedString("property.issuer.dynamic.name", issuerName, propertyKey);
                String description = i18nResolver.getTranslatedString("property.issuer.dynamic.description", propertyKey, issuerName);

                // Add specific validators based on property key
                if ("jwks-url".equals(propertyKey)) {
                    return new PropertyDescriptor.Builder()
                            .name(propertyDescriptorName)
                            .displayName(displayName)
                            .description(i18nResolver.getTranslatedString("property.issuer.jwks.url.description", propertyKey, issuerName))
                            .required(false)
                            .dynamic(true)
                            .addValidator(StandardValidators.URL_VALIDATOR)
                            .build();
                } else if ("issuer".equals(propertyKey)) {
                    return new PropertyDescriptor.Builder()
                            .name(propertyDescriptorName)
                            .displayName(displayName)
                            .description(i18nResolver.getTranslatedString("property.issuer.issuer.description", propertyKey, issuerName))
                            .required(false)
                            .dynamic(true)
                            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                            .build();
                } else if ("audience".equals(propertyKey) || "client-id".equals(propertyKey)) {
                    return new PropertyDescriptor.Builder()
                            .name(propertyDescriptorName)
                            .displayName(displayName)
                            .description(i18nResolver.getTranslatedString(
                                    "audience".equals(propertyKey) ? "property.issuer.audience.description" : "property.issuer.client.id.description",
                                    propertyKey, issuerName))
                            .required(false)
                            .dynamic(true)
                            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                            .build();
                }
            }

            // Default issuer property descriptor
            return new PropertyDescriptor.Builder()
                    .name(propertyDescriptorName)
                    .displayName(propertyDescriptorName)
                    .description("Dynamic property for issuer configuration")
                    .required(false)
                    .dynamic(true)
                    .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                    .build();
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
        hashBuilder.append(context.getProperty(JWKS_REFRESH_INTERVAL).getValue());
        hashBuilder.append(context.getProperty(MAXIMUM_TOKEN_SIZE).getValue());
        hashBuilder.append(context.getProperty(REQUIRE_VALID_TOKEN).getValue());

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
        List<IssuerConfig> issuerConfigs = new ArrayList<>();
        Map<String, Map<String, String>> issuerPropertiesMap = new HashMap<>();
        Set<String> currentIssuerNames = new HashSet<>();

        // First, load external configuration if available (highest precedence)
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

        // Then, load UI configuration (lower precedence)
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
                    if (!issuerProps.containsKey(propertyKey)) {
                        issuerProps.put(propertyKey, context.getProperty(propertyDescriptor).getValue());
                    }
                }
            }
        }

        // Clean up removed issuers from cache
        Set<String> cachedIssuerNames = new HashSet<>(issuerConfigCache.keySet());
        for (String cachedIssuerName : cachedIssuerNames) {
            if (!currentIssuerNames.contains(cachedIssuerName)) {
                LOGGER.info(AuthLogMessages.INFO.REMOVING_ISSUER_CONFIG.format(cachedIssuerName));
                issuerConfigCache.remove(cachedIssuerName);
            }
        }

        // Validate and create issuer configurations
        for (Map.Entry<String, Map<String, String>> entry : issuerPropertiesMap.entrySet()) {
            String issuerName = entry.getKey();
            Map<String, String> properties = entry.getValue();

            LOGGER.info(AuthLogMessages.INFO.FOUND_ISSUER_CONFIG.format(issuerName, properties));

            // Generate a hash for this issuer's properties to detect changes
            String issuerPropertiesHash = generateIssuerPropertiesHash(properties);

            // Check if we can reuse the cached issuer Config
            IssuerConfig cachedConfig = issuerConfigCache.get(issuerName);
            if (cachedConfig != null && issuerPropertiesHash.equals(cachedConfig.toString())) {
                LOGGER.info(AuthLogMessages.INFO.REUSING_CACHED_CONFIG.format(issuerName));
                issuerConfigs.add(cachedConfig);
                continue;
            }

            // Validate issuer configuration
            List<String> validationErrors = validateIssuerConfig(issuerName, properties, context);
            if (!validationErrors.isEmpty()) {
                for (String error : validationErrors) {
                    LOGGER.warn(error);
                }
                LOGGER.warn(AuthLogMessages.WARN.INVALID_ISSUER_CONFIG.format(issuerName));
                continue;
            }

            try {
                // Create issuer configuration
                IssuerConfig issuerConfig = createIssuerConfig(issuerName, properties, context);
                if (issuerConfig != null) {
                    issuerConfigs.add(issuerConfig);
                    // Cache the issuer Config for future use
                    issuerConfigCache.put(issuerName, issuerConfig);
                    LOGGER.info(AuthLogMessages.INFO.CREATED_CACHED_CONFIG.format(issuerName));
                }
            } catch (Exception e) {
                LOGGER.error(e, AuthLogMessages.ERROR.ISSUER_CONFIG_ERROR.format(issuerName, e.getMessage()));
            }
        }

        if (issuerConfigs.isEmpty()) {
            LOGGER.warn(AuthLogMessages.WARN.NO_VALID_ISSUER_CONFIGS.format());
        } else {
            LOGGER.info(AuthLogMessages.INFO.CREATED_ISSUER_CONFIGS.format(issuerConfigs.size()));
        }

        return issuerConfigs;
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
     * @param context The process context
     * @return A list of validation errors, empty if valid
     */
    private List<String> validateIssuerConfig(String issuerName, Map<String, String> properties, ProcessContext context) {
        List<String> errors = new ArrayList<>();

        // Check required properties
        if (!properties.containsKey("jwks-url") || properties.get("jwks-url").isEmpty()) {
            errors.add(i18nResolver.getTranslatedString("validation.issuer.missing.jwks", issuerName));
        } else {
            // Validate jwks-url format
            String jwksUrl = properties.get("jwks-url");
            if (!jwksUrl.startsWith("http://") && !jwksUrl.startsWith("https://")) {
                errors.add(i18nResolver.getTranslatedString("validation.issuer.invalid.url", issuerName, jwksUrl));
            }

            // Enforce HTTPS for JWKS URLs if required
            boolean requireHttps = context.getProperty(REQUIRE_HTTPS_FOR_JWKS).asBoolean();
            if (requireHttps && jwksUrl.startsWith("http://")) {
                errors.add(i18nResolver.getTranslatedString("validation.issuer.requires.https", issuerName));
                LOGGER.error(AuthLogMessages.ERROR.HTTPS_REQUIRED.format(issuerName));
            } else if (jwksUrl.startsWith("http://")) {
                // Just warn if HTTPS is not required but HTTP is used
                LOGGER.warn(AuthLogMessages.WARN.INSECURE_JWKS_URL.format(issuerName));
            }
        }

        // Check issuer property
        if (!properties.containsKey("issuer") || properties.get("issuer").isEmpty()) {
            errors.add(i18nResolver.getTranslatedString("validation.issuer.missing.issuer", issuerName));
            LOGGER.info(AuthLogMessages.INFO.NO_ISSUER_PROPERTY.format(issuerName));
        }

        // Check for recommended properties
        if (!properties.containsKey("audience") && !properties.containsKey("client-id")) {
            LOGGER.warn(AuthLogMessages.WARN.NO_AUDIENCE_OR_CLIENT_ID.format(issuerName));
        }

        return errors;
    }

    /**
     * Creates an IssuerConfig object from the given properties.
     *
     * @param issuerName The name of the issuer
     * @param properties The properties for the issuer
     * @param context The process context
     * @return The IssuerConfig object, or null if the required properties are missing
     */
    private IssuerConfig createIssuerConfig(String issuerName, Map<String, String> properties, ProcessContext context) {
        // Required properties
        String jwksUrl = properties.get("jwks-url");
        String issuer = properties.get("issuer");

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
        String audience = properties.get("audience");
        String clientId = properties.get("client-id");

        // Log the properties for debugging
        LOGGER.info("Creating issuer configuration for %s with properties: jwksUrl=%s, issuer=%s, audience=%s, clientId=%s",
                issuerName, jwksUrl, issuer, audience, clientId);

        try {
            // TODO: Implement proper IssuerConfig creation once the cui-jwt-validation library API is better understood
            // For now, return null to allow the processor to run but fail validation
            LOGGER.warn("IssuerConfig creation not yet fully implemented. Validation will fail.");
            return null;
        } catch (Exception e) {
            LOGGER.error(e, "Error creating IssuerConfig for %s: %s", issuerName, e.getMessage());
            return null;
        }
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
        String tokenLocation = context.getProperty(TOKEN_LOCATION).getValue();
        String token = null;

        try {
            // Extract token based on configured location
            switch (tokenLocation) {
                case "AUTHORIZATION_HEADER":
                    token = extractTokenFromHeader(flowFile, context.getProperty(TOKEN_HEADER).getValue());
                    break;
                case "CUSTOM_HEADER":
                    token = extractTokenFromHeader(flowFile, context.getProperty(CUSTOM_HEADER_NAME).getValue());
                    break;
                case "FLOW_FILE_CONTENT":
                    token = extractTokenFromContent(flowFile, session);
                    break;
                default:
                    // Default to Authorization header
                    token = extractTokenFromHeader(flowFile, "Authorization");
            }

            // If no token found, log warning and route to failure
            if (token == null || token.isEmpty()) {
                LOGGER.warn("No token found in the specified location: %s", tokenLocation);

                // Add error attributes
                Map<String, String> attributes = new HashMap<>();
                attributes.put(JWTAttributes.Error.CODE, "AUTH-001");
                attributes.put(JWTAttributes.Error.REASON, i18nResolver.getTranslatedString("error.no.token.found", tokenLocation));
                attributes.put(JWTAttributes.Error.CATEGORY, "EXTRACTION_ERROR");
                flowFile = session.putAllAttributes(flowFile, attributes);

                session.transfer(flowFile, AUTHENTICATION_FAILED);
                return;
            }

            // Check token size limits
            int maxTokenSize = context.getProperty(MAXIMUM_TOKEN_SIZE).asInteger();
            if (token.length() > maxTokenSize) {
                LOGGER.warn(AuthLogMessages.WARN.TOKEN_SIZE_EXCEEDED.format(maxTokenSize));

                // Add error attributes
                Map<String, String> attributes = new HashMap<>();
                attributes.put(JWTAttributes.Error.CODE, "AUTH-003");
                attributes.put(JWTAttributes.Error.REASON, i18nResolver.getTranslatedString("error.token.size.limit", maxTokenSize));
                attributes.put(JWTAttributes.Error.CATEGORY, "TOKEN_SIZE_VIOLATION");
                flowFile = session.putAllAttributes(flowFile, attributes);

                session.transfer(flowFile, AUTHENTICATION_FAILED);
                return;
            }

            // Check for obviously malformed tokens (should have at least 2 dots for header.payload.signature)
            if (!token.contains(".")) {
                LOGGER.warn("Token is malformed (missing segments)");

                // Add error attributes
                Map<String, String> attributes = new HashMap<>();
                attributes.put(JWTAttributes.Error.CODE, "AUTH-004");
                attributes.put(JWTAttributes.Error.REASON, i18nResolver.getTranslatedString("error.token.malformed"));
                attributes.put(JWTAttributes.Error.CATEGORY, "MALFORMED_TOKEN");
                flowFile = session.putAllAttributes(flowFile, attributes);

                session.transfer(flowFile, AUTHENTICATION_FAILED);
                return;
            }


            try {
                // Validate token using the TokenValidator - will throw TokenValidationException if invalid
                AccessTokenContent accessToken = validateToken(token, context);

                // Token is valid, add claims as attributes
                Map<String, String> attributes = extractClaims(accessToken);
                flowFile = session.putAllAttributes(flowFile, attributes);

                // Transfer to success relationship
                session.transfer(flowFile, SUCCESS);

            } catch (TokenValidationException e) {
                // Token validation failed
                LOGGER.warn("Token validation failed: %s", e.getMessage());
                String errorMessage = i18nResolver.getTranslatedString("error.token.validation.failed", e.getMessage());

                // Add error attributes
                Map<String, String> attributes = new HashMap<>();

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

                attributes.put(JWTAttributes.Error.CODE, errorCode);
                attributes.put(JWTAttributes.Error.REASON, errorMessage);
                attributes.put(JWTAttributes.Error.CATEGORY, category);
                flowFile = session.putAllAttributes(flowFile, attributes);

                session.transfer(flowFile, AUTHENTICATION_FAILED);
            }

        } catch (Exception e) {
            LOGGER.error(e, "Error processing flow file: %s", e.getMessage());

            // Add error attributes
            Map<String, String> attributes = new HashMap<>();
            attributes.put(JWTAttributes.Error.CODE, "AUTH-999");
            attributes.put(JWTAttributes.Error.REASON, i18nResolver.getTranslatedString("error.unknown", e.getMessage()));
            attributes.put(JWTAttributes.Error.CATEGORY, "PROCESSING_ERROR");
            flowFile = session.putAllAttributes(flowFile, attributes);

            session.transfer(flowFile, AUTHENTICATION_FAILED);
        }
    }

    /**
     * Extracts a token from a header in the flow file.
     *
     * @param flowFile The flow file containing the header
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
     * @param session The process session
     * @return The extracted token, or null if not found
     */
    private String extractTokenFromContent(FlowFile flowFile, ProcessSession session) {
        final StringBuilder contentBuilder = new StringBuilder();

        session.read(flowFile, inputStream -> {
            byte[] buffer = new byte[4096];
            int len;
            while ((len = inputStream.read(buffer)) != -1) {
                contentBuilder.append(new String(buffer, 0, len));
            }
        });

        String content = contentBuilder.toString().trim();
        return content.isEmpty() ? null : content;
    }

    /**
     * Validates a token using the TokenValidator from cui-jwt-validation.
     *
     * @param tokenString The JWT token string to validate
     * @param context The process context
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

        // Add expiration information if available
        if (token.getExpirationTime() != null) {
            claims.put(JWTAttributes.Token.EXPIRATION, token.getExpirationTime().toString());
        }

        // Add roles as a comma-separated list if available
        List<String> roles = token.getRoles();
        if (roles != null && !roles.isEmpty()) {
            claims.put(JWTAttributes.Authorization.ROLES, String.join(",", roles));

            // Add individual roles with index for easier processing
            for (int i = 0; i < roles.size(); i++) {
                claims.put(JWTAttributes.Authorization.ROLES_PREFIX + i, roles.get(i));
            }
        }

        // Add groups as a comma-separated list if available
        List<String> groups = token.getGroups();
        if (groups != null && !groups.isEmpty()) {
            claims.put(JWTAttributes.Authorization.GROUPS, String.join(",", groups));

            // Add individual groups with index for easier processing
            for (int i = 0; i < groups.size(); i++) {
                claims.put(JWTAttributes.Authorization.GROUPS_PREFIX + i, groups.get(i));
            }
        }

        // Extract scopes if available (typically space-separated in 'scope' claim)
        if (token.getClaims().containsKey("scope")) {
            String scopeValue = token.getClaims().get("scope").getOriginalString();
            if (scopeValue != null && !scopeValue.isEmpty()) {
                claims.put(JWTAttributes.Authorization.SCOPES, scopeValue);

                // Split scopes by space and add individual scopes with index
                String[] scopes = scopeValue.split(" ");
                for (int i = 0; i < scopes.length; i++) {
                    if (!scopes[i].isEmpty()) {
                        claims.put(JWTAttributes.Authorization.SCOPES_PREFIX + i, scopes[i]);
                    }
                }
            }
        }

        // Add all token claims with consistent "jwt.content." prefix
        token.getClaims().forEach((key, claimValue) -> {
            claims.put(JWTAttributes.Content.PREFIX + key, claimValue.getOriginalString());
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
