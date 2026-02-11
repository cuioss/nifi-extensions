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

import de.cuioss.nifi.processors.auth.config.ConfigurationManager;
import de.cuioss.nifi.processors.auth.config.IssuerConfigurationParser;
import de.cuioss.nifi.processors.auth.config.IssuerPropertyDescriptorFactory;
import de.cuioss.nifi.processors.auth.i18n.I18nResolver;
import de.cuioss.nifi.processors.auth.i18n.NiFiI18nResolver;
import de.cuioss.nifi.processors.auth.util.AuthorizationValidator;
import de.cuioss.nifi.processors.auth.util.ErrorContext;
import de.cuioss.nifi.processors.auth.util.ProcessingError;
import de.cuioss.sheriff.oauth.core.IssuerConfig;
import de.cuioss.sheriff.oauth.core.ParserConfig;
import de.cuioss.sheriff.oauth.core.TokenValidator;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.sheriff.oauth.core.exception.TokenValidationException;
import de.cuioss.sheriff.oauth.core.metrics.TokenValidatorMonitor;
import de.cuioss.sheriff.oauth.core.security.SecurityEventCounter;
import de.cuioss.sheriff.oauth.core.security.SecurityEventCounter.EventType;
import de.cuioss.sheriff.oauth.core.security.SignatureAlgorithmPreferences;
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
import org.jspecify.annotations.Nullable;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.*;
import java.util.Base64;
import java.util.concurrent.*;
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
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/configuration.adoc">Configuration Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/observability.adoc">Observability Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/technical-components.adoc">Technical Components Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/token-validation.adoc">Token Validation Specification</a>
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

    // Constants for string literals used multiple times
    private static final String COMPONENT_NAME = "MultiIssuerJWTTokenAuthenticator";
    private static final String FLOW_FILE_UUID_KEY = "flowFileUuid";
    private static final String VALIDATE_TOKEN_ALGORITHM_OP = "validateTokenAlgorithm";
    private static final String JWKS_TYPE_MEMORY = "memory";
    private static final String ISSUER_PREFIX_STRING = "Issuer ";
    private static final String ISSUER_CONFIG_PREFIX = "jwt.validation.issuer.";
    private static final String BOOLEAN_FALSE = "false";

    // TokenValidator instance for token validation
    private final AtomicReference<TokenValidator> tokenValidator = new AtomicReference<>();

    // Security event counter for tracking validation events
    @Nullable private SecurityEventCounter securityEventCounter;

    // Lock object for thread-safe initialization
    private final Object tokenValidatorLock = new Object();

    // Counter for tracking when to log metrics
    private final AtomicLong processedFlowFilesCount = new AtomicLong();

    // Configuration manager for static files and environment variables
    @Nullable private ConfigurationManager configurationManager;

    // Flag to track if configuration was reloaded
    private volatile boolean configurationRefreshed = false;

    // Hash of current configuration to detect changes
    private final AtomicReference<String> configurationHash = new AtomicReference<>("");

    // Configuration cache to avoid recreating objects unnecessarily
    private final Map<String, IssuerConfig> issuerConfigCache = new ConcurrentHashMap<>();

    // Authorization configuration cache
    private final Map<String, AuthorizationValidator.AuthorizationConfig> authorizationConfigCache = new ConcurrentHashMap<>();

    @Nullable private I18nResolver i18nResolver;

    @Nullable private IssuerPropertyDescriptorFactory propertyDescriptorFactory;

    @Getter private List<PropertyDescriptor> supportedPropertyDescriptors;

    @Getter private Set<Relationship> relationships;

    @Override
    protected void init(final ProcessorInitializationContext context) {
        // Initialize i18n resolver
        i18nResolver = NiFiI18nResolver.createDefault(context.getLogger());
        propertyDescriptorFactory = new IssuerPropertyDescriptorFactory(i18nResolver);

        LOGGER.info(AuthLogMessages.INFO.PROCESSOR_INITIALIZING);

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

        LOGGER.info(AuthLogMessages.INFO.PROCESSOR_INITIALIZED_WITH_DESCRIPTORS, descriptors.size());
    }

    @Override
    protected PropertyDescriptor getSupportedDynamicPropertyDescriptor(final String propertyDescriptorName) {
        Objects.requireNonNull(propertyDescriptorName, "propertyDescriptorName must not be null");
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
    private PropertyDescriptor createIssuerPropertyDescriptor(final String propertyDescriptorName) {
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
    private PropertyDescriptor createDefaultPropertyDescriptor(final String propertyDescriptorName) {
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
        LOGGER.info(AuthLogMessages.INFO.CONFIG_MANAGER_INITIALIZED, configurationManager.isConfigurationLoaded());

        // Log all available property descriptors to help with debugging
        LOGGER.info(AuthLogMessages.INFO.AVAILABLE_PROPERTY_DESCRIPTORS);
        for (PropertyDescriptor descriptor : getSupportedPropertyDescriptors()) {
            LOGGER.info(AuthLogMessages.INFO.PROPERTY_DESCRIPTOR_DETAIL, descriptor.getName(), descriptor.getDisplayName());
        }

        // Initialize the TokenValidator
        getTokenValidator(context);
        LOGGER.info(AuthLogMessages.INFO.PROCESSOR_INITIALIZED);
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
                LOGGER.info(AuthLogMessages.INFO.PROCESSOR_STOPPED);
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
     * @return The TokenValidator instance, or empty if not configured
     */
    private Optional<TokenValidator> getTokenValidator(final ProcessContext context) {
        boolean configFileChanged = checkExternalConfigurationChange();
        String currentConfigHash = generateConfigurationHash(context);

        if (shouldRecreateValidator(currentConfigHash, configFileChanged)) {
            synchronized (tokenValidatorLock) {
                if (shouldRecreateValidator(currentConfigHash, configFileChanged)) {
                    recreateTokenValidator(context, currentConfigHash);
                }
            }
        }

        return Optional.ofNullable(tokenValidator.get());
    }

    /**
     * Checks if external configuration file has changed.
     *
     * @return true if configuration file was modified, false otherwise
     */
    private boolean checkExternalConfigurationChange() {
        if (configurationManager == null) {
            return false;
        }

        boolean configFileChanged = configurationManager.checkAndReloadConfiguration();
        if (configFileChanged) {
            LOGGER.info(AuthLogMessages.INFO.EXTERNAL_CONFIG_CHANGED);
            configurationRefreshed = true;
        }

        return configFileChanged;
    }

    /**
     * Determines if the TokenValidator needs to be recreated.
     *
     * @param currentConfigHash The current configuration hash
     * @param configFileChanged Whether the configuration file changed
     * @return true if validator should be recreated, false otherwise
     */
    private boolean shouldRecreateValidator(String currentConfigHash, boolean configFileChanged) {
        return tokenValidator.get() == null
                || !configurationHash.get().equals(currentConfigHash)
                || configFileChanged;
    }

    /**
     * Recreates the TokenValidator with new configuration.
     *
     * @param context           The process context
     * @param currentConfigHash The current configuration hash
     */
    private void recreateTokenValidator(ProcessContext context, String currentConfigHash) {
        LOGGER.info(AuthLogMessages.INFO.CONFIG_CHANGE_DETECTED);

        // NiFi NAR classloader isolates ServiceLoader, so DSL-JSON cannot find its
        // compile-time generated converters. Setting the context classloader to the
        // NAR classloader allows ServiceLoader.load() to discover them.
        ClassLoader originalClassLoader = Thread.currentThread().getContextClassLoader();
        try {
            Thread.currentThread().setContextClassLoader(getClass().getClassLoader());

            logConfigurationChange(currentConfigHash);
            List<IssuerConfig> issuerConfigs = createIssuerConfigs(context);

            if (issuerConfigs.isEmpty()) {
                handleEmptyIssuerConfigs(context, currentConfigHash);
                return;
            }

            buildAndConfigureTokenValidator(context, issuerConfigs, currentConfigHash);
        } finally {
            Thread.currentThread().setContextClassLoader(originalClassLoader);
        }
    }

    /**
     * Logs configuration change details if this is a reconfiguration.
     *
     * @param currentConfigHash The new configuration hash
     */
    private void logConfigurationChange(String currentConfigHash) {
        if (tokenValidator.get() != null) {
            LOGGER.info(AuthLogMessages.INFO.CONFIG_HASH_CHANGED, configurationHash.get(), currentConfigHash);
            cleanupResources();
        }
    }

    /**
     * Handles the case when no issuer configurations are found.
     *
     * @param context           The process context
     * @param currentConfigHash The current configuration hash
     */
    private void handleEmptyIssuerConfigs(ProcessContext context, String currentConfigHash) {
        boolean requireValidToken = context.getProperty(Properties.REQUIRE_VALID_TOKEN).asBoolean();

        if (!requireValidToken) {
            LOGGER.warn(AuthLogMessages.WARN.NO_ISSUER_CONFIGS_NOT_REQUIRED);
            tokenValidator.set(null);
            securityEventCounter = null;
            configurationHash.set(currentConfigHash);
        } else {
            throw new IllegalArgumentException(
                    "At least one issuer configuration must be provided when require-valid-token is true");
        }
    }

    /**
     * Builds and configures a new TokenValidator instance.
     *
     * @param context           The process context
     * @param issuerConfigs     The issuer configurations
     * @param currentConfigHash The current configuration hash
     */
    private void buildAndConfigureTokenValidator(ProcessContext context,
            List<IssuerConfig> issuerConfigs,
            String currentConfigHash) {
        Map<String, String> properties = convertContextToProperties(context);
        ParserConfig parserConfig = IssuerConfigurationParser.parseParserConfig(properties);

        // Force eager initialization of DSL-JSON while the NAR classloader is active.
        // ParserConfig uses @Getter(lazy=true) for dslJson, so without this call the
        // DslJson instance would be created on a ForkJoinPool background thread during
        // JWKS loading, where ServiceLoader cannot discover the compile-time converters.
        parserConfig.getDslJson();

        // Prepare ForkJoinPool common pool threads with the NAR classloader.
        // TokenValidator.builder().build() triggers IssuerConfigResolver which calls
        // HttpJwksLoader.initJWKSLoader() → CompletableFuture.supplyAsync() on the
        // ForkJoinPool common pool. The async task creates JwksHttpContentConverter
        // with a fresh ParserConfig/DslJson that calls ServiceLoader.load() to find
        // DSL-JSON converters. ForkJoinPool threads default to the system classloader,
        // so ServiceLoader can't discover NAR-isolated converters without this setup.
        prepareForkJoinPoolClassLoader();

        TokenValidator newValidator = TokenValidator.builder()
                .parserConfig(parserConfig)
                .issuerConfigs(issuerConfigs)
                .build();

        tokenValidator.set(newValidator);
        securityEventCounter = tokenValidator.get().getSecurityEventCounter();
        configurationHash.set(currentConfigHash);

        LOGGER.info(AuthLogMessages.INFO.TOKEN_VALIDATOR_INITIALIZED, issuerConfigs.size());

        issuerConfigCache.clear();
        authorizationConfigCache.clear();

        // Populate caches from configured issuers and their properties
        populateCaches(issuerConfigs, properties);
    }

    /**
     * Sets the NAR classloader as the thread context classloader on ForkJoinPool
     * common pool threads.
     * <p>
     * The OAuth-Sheriff library's {@code HttpJwksLoader.initJWKSLoader()} uses
     * {@code CompletableFuture.supplyAsync()} which runs on the ForkJoinPool common
     * pool. Inside that async task, a new {@code JwksHttpContentConverter} is created
     * with a fresh {@code ParserConfig/DslJson} that calls
     * {@code ServiceLoader.load(Configuration.class)} to discover DSL-JSON converters.
     * ForkJoinPool threads default to the system classloader, so ServiceLoader cannot
     * find the compile-time generated DSL-JSON converters that live in the NAR
     * classloader. This method proactively sets the correct classloader on pool threads.
     */
    private void prepareForkJoinPoolClassLoader() {
        ClassLoader targetClassLoader = getClass().getClassLoader();
        int poolSize = ForkJoinPool.commonPool().getParallelism() + 1;

        // Use a CountDownLatch to force tasks onto different threads.
        // Without this, lightweight tasks would be work-stolen and all
        // execute on 1-2 threads, missing the thread that later loads JWKS.
        CountDownLatch allReady = new CountDownLatch(poolSize);
        CountDownLatch release = new CountDownLatch(1);

        List<CompletableFuture<Void>> tasks = new ArrayList<>();
        for (int i = 0; i < poolSize; i++) {
            tasks.add(CompletableFuture.supplyAsync(() -> {
                Thread.currentThread().setContextClassLoader(targetClassLoader);
                allReady.countDown();
                try {
                    release.await(3, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return null;
            }));
        }
        try {
            // Wait for all tasks to be running on separate threads
            allReady.await(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.warn(AuthLogMessages.WARN.FORKJOINPOOL_CLASSLOADER_SETUP_INTERRUPTED);
        } finally {
            // Release all blocked tasks
            release.countDown();
        }
        try {
            CompletableFuture.allOf(tasks.toArray(new CompletableFuture[0]))
                    .get(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.warn(AuthLogMessages.WARN.FORKJOINPOOL_CLASSLOADER_SETUP_INTERRUPTED);
        } catch (ExecutionException | TimeoutException e) {
            LOGGER.warn(AuthLogMessages.WARN.FORKJOINPOOL_CLASSLOADER_SETUP_FAILED, e.getMessage());
        }
    }

    /**
     * Cleans up resources before recreating the TokenValidator.
     * This ensures proper resource management during configuration changes.
     */
    private void cleanupResources() {
        LOGGER.info(AuthLogMessages.INFO.CLEANING_RESOURCES);

        // Clean up TokenValidator resources if needed
        if (tokenValidator.get() != null) {
            // Note: The current TokenValidator implementation doesn't have explicit cleanup methods
            // If future versions add cleanup methods, they should be called here

            // For now, we just null out the references to allow garbage collection
            tokenValidator.set(null);
            securityEventCounter = null;
        }

        // Clear the issuer Config cache to ensure we don't use stale configurations
        // during the transition period
        issuerConfigCache.clear();
        authorizationConfigCache.clear();
    }

    /**
     * Generates a SHA-256 hash of the current configuration.
     * Uses cryptographic hashing to avoid logging sensitive configuration values.
     *
     * @param context The process context
     * @return A SHA-256 hex string representing the current configuration
     */
    private String generateConfigurationHash(final ProcessContext context) {
        StringBuilder configBuilder = new StringBuilder();

        // Add static properties to hash
        configBuilder.append(context.getProperty(Properties.JWKS_REFRESH_INTERVAL).getValue());
        configBuilder.append(context.getProperty(Properties.MAXIMUM_TOKEN_SIZE).getValue());
        configBuilder.append(context.getProperty(Properties.REQUIRE_VALID_TOKEN).getValue());

        // Add dynamic properties (issuers) to hash
        for (PropertyDescriptor propertyDescriptor : context.getProperties().keySet()) {
            String propertyName = propertyDescriptor.getName();
            if (propertyName.startsWith(ISSUER_PREFIX)) {
                configBuilder.append(propertyName)
                        .append("=")
                        .append(context.getProperty(propertyDescriptor).getValue())
                        .append(";");
            }
        }

        // Add external configuration to hash if available
        if (configurationManager != null && configurationManager.isConfigurationLoaded()) {
            // Add static properties from external configuration
            for (Map.Entry<String, String> entry : configurationManager.getStaticProperties().entrySet()) {
                configBuilder.append(entry.getKey())
                        .append("=")
                        .append(entry.getValue())
                        .append(";");
            }

            // Add issuer properties from external configuration
            for (String issuerId : configurationManager.getIssuerIds()) {
                Map<String, String> issuerProps = configurationManager.getIssuerProperties(issuerId);
                for (Map.Entry<String, String> entry : issuerProps.entrySet()) {
                    configBuilder.append("issuer.")
                            .append(issuerId)
                            .append(".")
                            .append(entry.getKey())
                            .append("=")
                            .append(entry.getValue())
                            .append(";");
                }
            }
        }

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(configBuilder.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is guaranteed to be available in every Java implementation
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
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
     * Removes issuers from cache that are no longer in the current configuration.
     *
     * @param currentIssuerNames Set of current issuer names
     */
    private void cleanupRemovedIssuers(Set<String> currentIssuerNames) {
        Set<String> cachedIssuerNames = new HashSet<>(issuerConfigCache.keySet());
        for (String cachedIssuerName : cachedIssuerNames) {
            if (!currentIssuerNames.contains(cachedIssuerName)) {
                LOGGER.info(AuthLogMessages.INFO.REMOVING_ISSUER_CONFIG, cachedIssuerName);
                issuerConfigCache.remove(cachedIssuerName);
                authorizationConfigCache.remove(cachedIssuerName);
            }
        }
    }

    /**
     * Populates the issuer config cache and authorization config cache from the configured issuers.
     * Handles both UI properties and external configuration from ConfigurationManager.
     *
     * @param issuerConfigs The configured issuers
     * @param allProperties All processor properties (UI-based)
     */
    private void populateCaches(List<IssuerConfig> issuerConfigs, Map<String, String> allProperties) {
        // Populate issuer config cache keyed by issuer identifier
        for (IssuerConfig config : issuerConfigs) {
            issuerConfigCache.put(config.getIssuerIdentifier(), config);
        }

        // 1. Load authorization config from external configuration (highest precedence)
        if (configurationManager != null && configurationManager.isConfigurationLoaded()) {
            for (String issuerId : configurationManager.getIssuerIds()) {
                Map<String, String> issuerProps = configurationManager.getIssuerProperties(issuerId);
                buildAndStoreAuthorizationConfig(issuerProps);
            }
        }

        // 2. Load authorization config from UI properties (lower precedence, won't override)
        Map<String, Map<String, String>> issuerPropertiesMap = groupPropertiesByIssuerIndex(allProperties);
        for (Map.Entry<String, Map<String, String>> entry : issuerPropertiesMap.entrySet()) {
            buildAndStoreAuthorizationConfig(entry.getValue());
        }

        LOGGER.debug("Populated caches: %d issuer configs, %d authorization configs",
                issuerConfigCache.size(), authorizationConfigCache.size());
    }

    /**
     * Groups flat issuer properties (e.g., "issuer.keycloak.required-roles") by issuer index.
     *
     * @param allProperties All processor properties
     * @return Map of issuer index to their property maps
     */
    private static Map<String, Map<String, String>> groupPropertiesByIssuerIndex(Map<String, String> allProperties) {
        Map<String, Map<String, String>> issuerPropertiesMap = new HashMap<>();
        for (Map.Entry<String, String> entry : allProperties.entrySet()) {
            String key = entry.getKey();
            if (key.startsWith(ISSUER_PREFIX)) {
                String remainder = key.substring(ISSUER_PREFIX.length());
                int dotIndex = remainder.indexOf('.');
                if (dotIndex > 0) {
                    String issuerIndex = remainder.substring(0, dotIndex);
                    String property = remainder.substring(dotIndex + 1);
                    issuerPropertiesMap.computeIfAbsent(issuerIndex, k -> new HashMap<>())
                            .put(property, entry.getValue());
                }
            }
        }
        return issuerPropertiesMap;
    }

    /**
     * Builds and stores an AuthorizationConfig for the given issuer properties.
     * Resolves the issuer identifier and only stores if authorization requirements exist.
     * Does not override existing entries (external config takes precedence over UI).
     *
     * @param props The issuer property map
     */
    private void buildAndStoreAuthorizationConfig(Map<String, String> props) {
        // Resolve issuer name (same logic as IssuerConfigurationParser.resolveIssuerName)
        String issuerIdentifier = props.get("name");
        if (issuerIdentifier == null || issuerIdentifier.trim().isEmpty()) {
            issuerIdentifier = props.get(Issuer.ISSUER_NAME);
        }
        if (issuerIdentifier == null || issuerIdentifier.trim().isEmpty()) {
            return;
        }
        issuerIdentifier = issuerIdentifier.trim();

        // Don't override existing entry (external config has higher precedence)
        if (authorizationConfigCache.containsKey(issuerIdentifier)) {
            return;
        }

        // Check for explicit bypass
        if ("true".equalsIgnoreCase(props.get(Issuer.BYPASS_AUTHORIZATION))) {
            // null authConfig means bypass in performAuthorizationCheck()
            return;
        }

        // Extract authorization requirements
        Set<String> requiredRoles = parseCommaSeparated(props.get(Issuer.REQUIRED_ROLES));
        Set<String> requiredScopes = parseCommaSeparated(props.get(Issuer.REQUIRED_SCOPES));

        // Only create config if there are actual requirements
        if (requiredRoles.isEmpty() && requiredScopes.isEmpty()) {
            return;
        }

        AuthorizationValidator.AuthorizationConfig authConfig = AuthorizationValidator.AuthorizationConfig.builder()
                .requiredRoles(requiredRoles)
                .requiredScopes(requiredScopes)
                .requireAllRoles("true".equalsIgnoreCase(props.get(Issuer.REQUIRE_ALL_ROLES)))
                .requireAllScopes("true".equalsIgnoreCase(props.get(Issuer.REQUIRE_ALL_SCOPES)))
                .caseSensitive(!"false".equalsIgnoreCase(props.get(Issuer.CASE_SENSITIVE_MATCHING)))
                .build();

        authorizationConfigCache.put(issuerIdentifier, authConfig);
    }

    /**
     * Parses a comma-separated string into a Set of trimmed, non-empty strings.
     *
     * @param value The comma-separated string (may be null)
     * @return A set of parsed values, empty if input is null or blank
     */
    private static Set<String> parseCommaSeparated(@Nullable String value) {
        if (value == null || value.trim().isEmpty()) {
            return Collections.emptySet();
        }
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    /**
     * Logs a summary of the issuer configuration process.
     *
     * @param issuerConfigs The list of issuer configurations
     */
    private void logConfigurationSummary(List<IssuerConfig> issuerConfigs) {
        if (issuerConfigs.isEmpty()) {
            LOGGER.warn(AuthLogMessages.WARN.NO_VALID_ISSUER_CONFIGS);
        } else {
            LOGGER.info(AuthLogMessages.INFO.CREATED_ISSUER_CONFIGS, issuerConfigs.size());
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
    private FlowFile handleError(ProcessSession session,
            FlowFile flowFile,
            ProcessingError error) {
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
    private FlowFile handleError(ProcessSession session,
            FlowFile flowFile,
            String errorCode,
            String errorReason,
            String errorCategory) {
        ProcessingError error = ProcessingError.builder()
                .errorCode(errorCode)
                .errorReason(errorReason)
                .errorCategory(errorCategory)
                .build();
        return handleError(session, flowFile, error);
    }

    @Override
    public void onTrigger(final ProcessContext context, final ProcessSession session) {
        FlowFile flowFile = session.get();
        if (flowFile == null) {
            return;
        }

        flowFile = handleMetricsAndConfiguration(flowFile, session);
        String tokenLocation = context.getProperty(Properties.TOKEN_LOCATION).getValue();

        try {
            Optional<String> tokenOpt = extractTokenByLocation(flowFile, session, context, tokenLocation);

            if (tokenOpt.isEmpty()) {
                handleMissingToken(session, flowFile, context, tokenLocation);
                return;
            }

            String token = tokenOpt.get();
            if (!validateTokenFormat(session, flowFile, token, context)) {
                return;
            }

            processValidToken(session, flowFile, token, context);

        } catch (TokenValidationException e) {
            handleTokenValidationException(session, flowFile, e);
        }
    }

    /**
     * Handles metrics logging and configuration refresh for the flow file.
     *
     * @param flowFile The flow file to process
     * @param session  The process session
     * @return The potentially modified flow file
     */
    private FlowFile handleMetricsAndConfiguration(FlowFile flowFile, ProcessSession session) {
        processedFlowFilesCount.incrementAndGet();

        if (processedFlowFilesCount.intValue() % LOG_METRICS_INTERVAL == 0) {
            logSecurityMetrics();
        }

        if (configurationRefreshed) {
            flowFile = session.putAttribute(flowFile, JWTAttributes.Config.REFRESHED, "true");
            LOGGER.info(AuthLogMessages.INFO.CONFIG_REFRESHED_ATTRIBUTE);
            configurationRefreshed = false;
        }

        return flowFile;
    }

    /**
     * Extracts token from the configured location.
     *
     * @param flowFile      The flow file containing the token
     * @param session       The process session
     * @param context       The process context
     * @param tokenLocation The configured token location
     * @return The extracted token, or empty if not found
     */
    private Optional<String> extractTokenByLocation(FlowFile flowFile, ProcessSession session,
            ProcessContext context, String tokenLocation) {
        String bearerPrefix = context.getProperty(Properties.BEARER_TOKEN_PREFIX).getValue();
        int maxTokenSize = context.getProperty(Properties.MAXIMUM_TOKEN_SIZE).asInteger();
        return switch (tokenLocation) {
            case "AUTHORIZATION_HEADER" ->
                extractTokenFromHeader(flowFile, context.getProperty(Properties.TOKEN_HEADER).getValue(), bearerPrefix);
            case "CUSTOM_HEADER" ->
                extractTokenFromHeader(flowFile, context.getProperty(Properties.CUSTOM_HEADER_NAME).getValue(), bearerPrefix);
            case "FLOW_FILE_CONTENT" -> extractTokenFromContent(flowFile, session, maxTokenSize);
            default -> extractTokenFromHeader(flowFile, "Authorization", bearerPrefix);
        };
    }

    /**
     * Handles the case when no token is found in the flow file.
     *
     * @param session       The process session
     * @param flowFile      The flow file
     * @param context       The process context
     * @param tokenLocation The configured token location
     */
    private void handleMissingToken(ProcessSession session, FlowFile flowFile,
            ProcessContext context, String tokenLocation) {
        boolean requireValidToken = context.getProperty(Properties.REQUIRE_VALID_TOKEN).asBoolean();

        if (!requireValidToken) {
            routeFlowFileWithoutToken(session, flowFile);
        } else {
            handleMissingRequiredToken(session, flowFile, tokenLocation);
        }
    }

    /**
     * Routes a flow file to success when no token is present but not required.
     *
     * @param session  The process session
     * @param flowFile The flow file
     */
    private void routeFlowFileWithoutToken(ProcessSession session, FlowFile flowFile) {
        LOGGER.info(AuthLogMessages.INFO.NO_TOKEN_NOT_REQUIRED);

        Map<String, String> attributes = new HashMap<>();
        attributes.put(JWTAttributes.Error.REASON, "No token provided");
        attributes.put(JWTAttributes.Token.PRESENT, BOOLEAN_FALSE);
        attributes.put(JWTAttributes.Authorization.AUTHORIZED, BOOLEAN_FALSE);

        flowFile = session.putAllAttributes(flowFile, attributes);
        session.transfer(flowFile, Relationships.SUCCESS);
    }

    /**
     * Handles error when a required token is missing.
     *
     * @param session       The process session
     * @param flowFile      The flow file
     * @param tokenLocation The configured token location
     */
    private void handleMissingRequiredToken(ProcessSession session, FlowFile flowFile, String tokenLocation) {
        String contextMessage = ErrorContext.forComponent(COMPONENT_NAME)
                .operation("extractToken")
                .errorCode(ErrorContext.ErrorCodes.VALIDATION_ERROR)
                .build()
                .with("tokenLocation", tokenLocation)
                .with(FLOW_FILE_UUID_KEY, flowFile.getAttribute("uuid"))
                .buildMessage("No token found in the specified location");

        LOGGER.warn(AuthLogMessages.WARN.NO_TOKEN_FOUND, tokenLocation);
        LOGGER.debug(contextMessage);
        handleError(
                session,
                flowFile,
                "AUTH-001",
                i18nResolver.getTranslatedString(JWTTranslationKeys.Error.NO_TOKEN_FOUND, tokenLocation),
                "EXTRACTION_ERROR"
        );
    }

    /**
     * Validates token format including size and structure.
     *
     * @param session  The process session
     * @param flowFile The flow file
     * @param token    The token to validate
     * @param context  The process context
     * @return true if token format is valid, false if error was handled
     */
    private boolean validateTokenFormat(ProcessSession session, FlowFile flowFile,
            String token, ProcessContext context) {
        int maxTokenSize = context.getProperty(Properties.MAXIMUM_TOKEN_SIZE).asInteger();

        if (token.length() > maxTokenSize) {
            String contextMessage = ErrorContext.forComponent(COMPONENT_NAME)
                    .operation("validateTokenSize")
                    .errorCode(ErrorContext.ErrorCodes.VALIDATION_ERROR)
                    .build()
                    .with("tokenSize", token.length())
                    .with("maxTokenSize", maxTokenSize)
                    .with(FLOW_FILE_UUID_KEY, flowFile.getAttribute("uuid"))
                    .buildMessage("Token exceeds maximum size limit");

            LOGGER.warn(AuthLogMessages.WARN.TOKEN_SIZE_EXCEEDED, maxTokenSize);
            LOGGER.debug(contextMessage);
            handleError(
                    session,
                    flowFile,
                    "AUTH-003",
                    i18nResolver.getTranslatedString(JWTTranslationKeys.Error.TOKEN_SIZE_LIMIT, maxTokenSize),
                    "TOKEN_SIZE_VIOLATION"
            );
            return false;
        }

        if (!token.contains(".")) {
            String contextMessage = ErrorContext.forComponent(COMPONENT_NAME)
                    .operation("validateTokenFormat")
                    .errorCode(ErrorContext.ErrorCodes.TOKEN_ERROR)
                    .build()
                    .with("tokenSegments", token.split("\\.").length)
                    .with(FLOW_FILE_UUID_KEY, flowFile.getAttribute("uuid"))
                    .buildMessage("Token is malformed (missing segments)");

            LOGGER.warn(AuthLogMessages.WARN.TOKEN_MALFORMED);
            LOGGER.debug(contextMessage);
            handleError(
                    session,
                    flowFile,
                    "AUTH-004",
                    i18nResolver.getTranslatedString(JWTTranslationKeys.Error.TOKEN_MALFORMED),
                    "MALFORMED_TOKEN"
            );
            return false;
        }

        return true;
    }

    /**
     * Processes a valid token and routes the flow file appropriately.
     *
     * @param session  The process session
     * @param flowFile The flow file
     * @param token    The token to validate
     * @param context  The process context
     * @throws TokenValidationException if token validation fails
     */
    private void processValidToken(ProcessSession session, FlowFile flowFile,
            String token, ProcessContext context) throws TokenValidationException {
        AccessTokenContent accessToken = validateToken(token, context);
        AuthorizationCheckResult authResult = performAuthorizationCheckWithDetails(accessToken);

        Map<String, String> attributes = extractClaims(accessToken);
        attributes.put(JWTAttributes.Token.PRESENT, "true");
        attributes.put(JWTAttributes.Authorization.AUTHORIZED, String.valueOf(authResult.isAuthorized()));

        if (authResult.isBypassed()) {
            attributes.put(JWTAttributes.Authorization.BYPASSED, "true");
        }

        flowFile = session.putAllAttributes(flowFile, attributes);

        if (authResult.isAuthorized()) {
            session.transfer(flowFile, Relationships.SUCCESS);
        } else {
            handleError(session, flowFile, "AUTH-010",
                    "Authorization failed: required roles/scopes not present",
                    "AUTHORIZATION_FAILED");
        }
    }

    /**
     * Handles TokenValidationException by mapping to specific error codes.
     *
     * @param session  The process session
     * @param flowFile The flow file
     * @param e        The validation exception
     */
    private void handleTokenValidationException(ProcessSession session, FlowFile flowFile,
            TokenValidationException e) {
        LOGGER.warn(AuthLogMessages.WARN.TOKEN_VALIDATION_FAILED_MSG, e.getMessage());
        String errorMessage = i18nResolver.getTranslatedString(
                JWTTranslationKeys.Error.TOKEN_VALIDATION_FAILED, e.getMessage());

        String category = e.getCategory().name();
        String errorCode = mapValidationCategoryToErrorCode(category);

        handleError(session, flowFile, errorCode, errorMessage, category);
    }

    /**
     * Maps validation exception category to specific error code.
     *
     * @param category The exception category
     * @return The corresponding error code
     */
    private String mapValidationCategoryToErrorCode(String category) {
        if (category.contains("EXPIRED")) {
            return "AUTH-005";
        } else if (category.contains("SIGNATURE")) {
            return "AUTH-006";
        } else if (category.contains("ISSUER")) {
            return "AUTH-007";
        } else if (category.contains("AUDIENCE")) {
            return "AUTH-008";
        }
        return "AUTH-002"; // Default error code
    }

    /**
     * Extracts a token from a header in the flow file.
     *
     * @param flowFile     The flow file containing the header
     * @param headerName   The name of the header containing the token
     * @param bearerPrefix The configured bearer prefix (e.g. "Bearer")
     * @return The extracted token, or empty if not found
     */
    private Optional<String> extractTokenFromHeader(FlowFile flowFile, String headerName, String bearerPrefix) {
        // Try exact match first (e.g., "http.headers.Authorization")
        String attributeKey = Http.HEADERS_PREFIX + headerName;
        String headerValue = flowFile.getAttribute(attributeKey);

        // HTTP header names are case-insensitive per RFC 7230 — try case-insensitive match
        if (headerValue == null) {
            for (Map.Entry<String, String> entry : flowFile.getAttributes().entrySet()) {
                if (entry.getKey().equalsIgnoreCase(attributeKey)) {
                    headerValue = entry.getValue();
                    break;
                }
            }
        }

        if (headerValue == null || headerValue.isEmpty()) {
            return Optional.empty();
        }

        // If header starts with configured prefix, strip it
        String fullPrefix = bearerPrefix + " ";
        String token;
        if (headerValue.startsWith(fullPrefix)) {
            token = headerValue.substring(fullPrefix.length()).trim();
        } else {
            token = headerValue.trim();
        }

        return token.isEmpty() ? Optional.empty() : Optional.of(token);
    }

    /**
     * Extracts a token from the content of the flow file.
     *
     * @param flowFile The flow file containing the token
     * @param session  The process session
     * @param maxSize  The maximum allowed content size in bytes
     * @return The extracted token, or empty if content is empty or exceeds size limit
     */
    private Optional<String> extractTokenFromContent(FlowFile flowFile, ProcessSession session, int maxSize) {
        if (flowFile.getSize() > maxSize) {
            LOGGER.warn(AuthLogMessages.WARN.FLOW_FILE_SIZE_EXCEEDED, flowFile.getSize(), maxSize);
            return Optional.empty();
        }

        final StringBuilder contentBuilder = new StringBuilder();

        session.read(flowFile, inputStream -> {
            byte[] buffer = new byte[4096];
            int len;
            while ((len = inputStream.read(buffer)) != -1) {
                contentBuilder.append(new String(buffer, 0, len, StandardCharsets.UTF_8));
            }
        });

        String content = contentBuilder.toString().trim();
        return content.isEmpty() ? Optional.empty() : Optional.of(content);
    }

    /**
     * Validates a token using the TokenValidator from OAuth-Sheriff.
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
        TokenValidator validator = getTokenValidator(context)
                .orElseThrow(() -> new IllegalStateException(
                        "No TokenValidator available - no issuer configurations provided"));

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
                        .toList();
                algorithmPreferences = new SignatureAlgorithmPreferences(configuredAlgorithms);
                LOGGER.debug("Using configured signature algorithms: %s", configuredAlgorithms);
            } else {
                // Use secure defaults from SignatureAlgorithmPreferences
                algorithmPreferences = new SignatureAlgorithmPreferences();
                LOGGER.debug("Using default secure signature algorithms: %s", algorithmPreferences.getPreferredAlgorithms());
            }

            // Validate the algorithm using SignatureAlgorithmPreferences
            if (!algorithmPreferences.isSupported(algorithm)) {
                String contextMessage = ErrorContext.forComponent(COMPONENT_NAME)
                        .operation(VALIDATE_TOKEN_ALGORITHM_OP)
                        .errorCode(ErrorContext.ErrorCodes.SECURITY_ERROR)
                        .build()
                        .with("algorithm", algorithm)
                        .with("supportedAlgorithms", algorithmPreferences.getPreferredAlgorithms())
                        .buildMessage("Token uses unsupported or insecure algorithm");
                LOGGER.warn(AuthLogMessages.WARN.TOKEN_VALIDATION_FAILED_MSG, "Unsupported algorithm: " + algorithm);
                LOGGER.debug(contextMessage);
                throw new TokenValidationException(EventType.SIGNATURE_VALIDATION_FAILED,
                        "Token algorithm '" + algorithm + "' is not supported. Supported algorithms: " + algorithmPreferences.getPreferredAlgorithms());
            }

            LOGGER.debug("Token algorithm '%s' is supported and secure", algorithm);

        } catch (IllegalArgumentException e) {
            // Base64 decoding failed
            String contextMessage = ErrorContext.forComponent(COMPONENT_NAME)
                    .operation(VALIDATE_TOKEN_ALGORITHM_OP)
                    .errorCode(ErrorContext.ErrorCodes.TOKEN_ERROR)
                    .cause(e)
                    .build()
                    .buildMessage("Failed to decode JWT header");
            LOGGER.warn(AuthLogMessages.WARN.TOKEN_VALIDATION_FAILED_MSG, "Failed to decode JWT header");
            LOGGER.debug(contextMessage);
            throw new TokenValidationException(EventType.SIGNATURE_VALIDATION_FAILED, "Invalid JWT token format - cannot decode header");
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

        // Look for the "alg" field in the JSON
        String algPattern = "\"alg\"\\s*:\\s*\"([^\"]+)\"";
        Pattern pattern = Pattern.compile(algPattern);
        Matcher matcher = pattern.matcher(headerJson);

        if (matcher.find()) {
            return matcher.group(1);
        }

        // If no algorithm found, this is suspicious
        throw new TokenValidationException(EventType.SIGNATURE_VALIDATION_FAILED, "JWT header does not contain algorithm field");
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
        var tokenClaims = token.getClaims();
        for (var entry : tokenClaims.entrySet()) {
            if (!FILTERED_CLAIM_KEYS.contains(entry.getKey())) {
                claims.put(JWTAttributes.Content.PREFIX + entry.getKey(), entry.getValue().getOriginalString());
            }
        }

        return claims;
    }

    /**
     * Result of authorization check including bypass status.
     */
    private record AuthorizationCheckResult(boolean authorized, boolean bypassed) {
        boolean isAuthorized() {
            return authorized;
        }

        boolean isBypassed() {
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
            LOGGER.error(AuthLogMessages.ERROR.NO_ISSUER_CONFIG_FOR_TOKEN, tokenIssuer);
            return false;
        }

        // If authorization config is null, it means bypass was explicitly set
        if (authConfig == null) {
            LOGGER.info(AuthLogMessages.INFO.AUTHORIZATION_BYPASSED, tokenIssuer);
            return true;
        }

        // Perform authorization validation
        AuthorizationValidator.AuthorizationResult result = AuthorizationValidator.validate(accessToken, authConfig);

        if (!result.isAuthorized()) {
            LOGGER.warn(AuthLogMessages.WARN.AUTHORIZATION_FAILED, accessToken.getSubject().orElse("unknown"), tokenIssuer, result.getReason());
        } else {
            LOGGER.debug("Authorization successful for token with subject '%s' from issuer '%s'",
                    accessToken.getSubject().orElse("unknown"), tokenIssuer);
        }

        return result.isAuthorized();
    }

    /**
     * Logs security metrics information.
     * This provides visibility into token validation activity.
     */
    private void logSecurityMetrics() {
        LOGGER.info(AuthLogMessages.INFO.TOKEN_VALIDATION_METRICS, processedFlowFilesCount);

        // Log information about the SecurityEventCounter if available
        if (securityEventCounter != null) {
            LOGGER.info(AuthLogMessages.INFO.SECURITY_COUNTER_AVAILABLE);

            // Note: In future versions, more detailed metrics will be available from the SecurityEventCounter
            // For now, we just log that it's available
        } else {
            LOGGER.info(AuthLogMessages.INFO.SECURITY_COUNTER_UNAVAILABLE);
        }

    }

}
