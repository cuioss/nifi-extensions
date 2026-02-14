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
import de.cuioss.nifi.jwt.util.AuthorizationValidator.AuthorizationConfig;
import de.cuioss.sheriff.oauth.core.IssuerConfig;
import de.cuioss.sheriff.oauth.core.ParserConfig;
import de.cuioss.sheriff.oauth.core.TokenValidator;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.sheriff.oauth.core.security.SecurityEventCounter;
import de.cuioss.sheriff.oauth.core.security.SignatureAlgorithmPreferences;
import de.cuioss.tools.logging.CuiLogger;
import org.apache.nifi.annotation.behavior.RequiresInstanceClassLoading;
import org.apache.nifi.annotation.documentation.CapabilityDescription;
import org.apache.nifi.annotation.documentation.Tags;
import org.apache.nifi.annotation.lifecycle.OnDisabled;
import org.apache.nifi.annotation.lifecycle.OnEnabled;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.controller.AbstractControllerService;
import org.apache.nifi.controller.ConfigurationContext;
import org.apache.nifi.processor.util.StandardValidators;
import org.jspecify.annotations.Nullable;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

/**
 * Standard implementation of {@link JwtIssuerConfigService}.
 * <p>
 * Manages the lifecycle of a {@link TokenValidator}, including NAR classloader
 * workarounds required by the dsl-json ServiceLoader mechanism, JWKS key refresh,
 * and per-issuer authorization configuration.
 * <p>
 * <b>Classloader workarounds (initialization-only):</b>
 * <ol>
 *   <li>{@code Thread.currentThread().setContextClassLoader(getClass().getClassLoader())}
 *       — sets NAR classloader so {@code ServiceLoader} finds dsl-json converters during init</li>
 *   <li>{@code parserConfig.getDslJson()} eager call — prevents lazy init on a ForkJoinPool thread</li>
 *   <li>{@link #prepareForkJoinPoolClassLoader()} — pre-warms {@code ForkJoinPool.commonPool()} threads
 *       with the NAR classloader for {@code HttpJwksLoader.initJWKSLoader()}</li>
 * </ol>
 * Runtime {@code validateToken()} calls do NOT use ServiceLoader or ForkJoinPool.
 * <p>
 * Metrics are tracked by the {@link TokenValidator} internally via its
 * {@link SecurityEventCounter} and performance monitor. This class reads from
 * those built-in facilities rather than duplicating the tracking.
 *
 * @see JwtIssuerConfigService
 */
@Tags({"jwt", "oauth", "authentication", "authorization", "security", "controller-service"})
@CapabilityDescription("Provides shared JWT issuer configuration and token validation. " +
        "Manages JWKS key retrieval, issuer configuration, and token validation lifecycle " +
        "so that multiple processors can share the same JWT configuration.")
@RequiresInstanceClassLoading
public class StandardJwtIssuerConfigService extends AbstractControllerService implements JwtIssuerConfigService {

    private static final CuiLogger LOGGER = new CuiLogger(StandardJwtIssuerConfigService.class);


    // --- NiFi Property Descriptors ---

    static final PropertyDescriptor JWKS_REFRESH_INTERVAL = new PropertyDescriptor.Builder()
            .name(JWTAttributes.Properties.Validation.JWKS_REFRESH_INTERVAL)
            .displayName("JWKS Refresh Interval")
            .description("Interval in seconds for refreshing JWKS keys")
            .required(true)
            .defaultValue("3600")
            .addValidator(StandardValidators.POSITIVE_INTEGER_VALIDATOR)
            .build();

    static final PropertyDescriptor MAXIMUM_TOKEN_SIZE = new PropertyDescriptor.Builder()
            .name(JWTAttributes.Properties.Validation.MAXIMUM_TOKEN_SIZE)
            .displayName("Maximum Token Size")
            .description("Maximum token size in bytes")
            .required(true)
            .defaultValue("16384")
            .addValidator(StandardValidators.POSITIVE_INTEGER_VALIDATOR)
            .build();

    static final PropertyDescriptor ALLOWED_ALGORITHMS = new PropertyDescriptor.Builder()
            .name(JWTAttributes.Properties.Validation.ALLOWED_ALGORITHMS)
            .displayName("Allowed Algorithms")
            .description("Comma-separated list of allowed JWT signing algorithms. " +
                    "The 'none' algorithm is never allowed regardless of this setting.")
            .required(false)
            .defaultValue(String.join(",", SignatureAlgorithmPreferences.getDefaultPreferredAlgorithms()))
            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
            .build();

    static final PropertyDescriptor REQUIRE_HTTPS_FOR_JWKS = new PropertyDescriptor.Builder()
            .name(JWTAttributes.Properties.Validation.REQUIRE_HTTPS_FOR_JWKS)
            .displayName("Require HTTPS for JWKS URLs")
            .description("Whether to require HTTPS for JWKS URLs. Strongly recommended for production.")
            .required(true)
            .defaultValue("true")
            .allowableValues("true", "false")
            .build();

    static final PropertyDescriptor JWKS_CONNECTION_TIMEOUT = new PropertyDescriptor.Builder()
            .name(JWTAttributes.Properties.Validation.JWKS_CONNECTION_TIMEOUT)
            .displayName("JWKS Connection Timeout")
            .description("Timeout in seconds for JWKS endpoint connections")
            .required(true)
            .defaultValue("10")
            .addValidator(StandardValidators.POSITIVE_INTEGER_VALIDATOR)
            .build();

    static final PropertyDescriptor JWKS_SOURCE_TYPE = new PropertyDescriptor.Builder()
            .name("jwks.source.type")
            .displayName("JWKS Source Type")
            .description("Default JWKS source type for issuers. Can be overridden per issuer.")
            .required(true)
            .defaultValue("url")
            .allowableValues("url", "file", "memory")
            .build();

    private static final List<PropertyDescriptor> PROPERTY_DESCRIPTORS = List.of(
            JWKS_REFRESH_INTERVAL,
            MAXIMUM_TOKEN_SIZE,
            ALLOWED_ALGORITHMS,
            REQUIRE_HTTPS_FOR_JWKS,
            JWKS_CONNECTION_TIMEOUT,
            JWKS_SOURCE_TYPE
    );

    // --- Internal State ---

    private final AtomicReference<TokenValidator> tokenValidator = new AtomicReference<>();
    @Nullable private ConfigurationManager configurationManager;
    private final Map<String, AuthorizationConfig> authorizationConfigCache = new ConcurrentHashMap<>();

    @Override
    protected List<PropertyDescriptor> getSupportedPropertyDescriptors() {
        return PROPERTY_DESCRIPTORS;
    }

    @Override
    protected PropertyDescriptor getSupportedDynamicPropertyDescriptor(String propertyDescriptorName) {
        if (propertyDescriptorName.startsWith(JwtConstants.ISSUER_PREFIX)) {
            return new PropertyDescriptor.Builder()
                    .name(propertyDescriptorName)
                    .displayName(propertyDescriptorName)
                    .description("Issuer configuration property")
                    .required(false)
                    .dynamic(true)
                    .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                    .build();
        }
        return new PropertyDescriptor.Builder()
                .name(propertyDescriptorName)
                .displayName(propertyDescriptorName)
                .description("Dynamic property")
                .required(false)
                .dynamic(true)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();
    }

    @OnEnabled
    public void onEnabled(ConfigurationContext context) {
        ClassLoader originalClassLoader = Thread.currentThread().getContextClassLoader();
        try {
            // Layer 1: Set NAR classloader so ServiceLoader finds dsl-json converters
            Thread.currentThread().setContextClassLoader(getClass().getClassLoader());

            configurationManager = new ConfigurationManager();
            Map<String, String> properties = convertContextToProperties(context);

            // Parse issuer configurations
            List<IssuerConfig> issuerConfigs = IssuerConfigurationParser.parseIssuerConfigs(
                    properties, configurationManager);

            if (issuerConfigs.isEmpty()) {
                LOGGER.warn(JwtLogMessages.WARN.NO_VALID_ISSUER_CONFIGS);
            }

            // Parse parser config and force eager dsl-json initialization
            ParserConfig parserConfig = IssuerConfigurationParser.parseParserConfig(properties);

            // Layer 2: Force eager DslJson initialization while NAR classloader is active
            parserConfig.getDslJson();

            // Layer 3: Pre-warm ForkJoinPool threads with NAR classloader
            prepareForkJoinPoolClassLoader();

            // Build TokenValidator
            TokenValidator newValidator = TokenValidator.builder()
                    .parserConfig(parserConfig)
                    .issuerConfigs(issuerConfigs)
                    .build();

            tokenValidator.set(newValidator);

            // Populate authorization config cache
            populateAuthorizationCache(properties);

            LOGGER.info(JwtLogMessages.INFO.CONTROLLER_SERVICE_ENABLED, issuerConfigs.size());
        } catch (Exception e) {
            LOGGER.error(e, JwtLogMessages.ERROR.CONTROLLER_SERVICE_ENABLE_FAILED, e.getMessage());
            throw new IllegalStateException("Failed to enable JwtIssuerConfigService", e);
        } finally {
            Thread.currentThread().setContextClassLoader(originalClassLoader);
        }
    }

    @OnDisabled
    public void onDisabled() {
        tokenValidator.set(null);
        configurationManager = null;
        authorizationConfigCache.clear();
        LOGGER.info(JwtLogMessages.INFO.CONTROLLER_SERVICE_DISABLED);
    }

    @Override
    public AccessTokenContent validateToken(String rawToken) {
        Objects.requireNonNull(rawToken, "rawToken must not be null");

        TokenValidator validator = tokenValidator.get();
        if (validator == null) {
            throw new IllegalStateException("JwtIssuerConfigService is not enabled or has no configuration");
        }

        return validator.createAccessToken(rawToken);
    }

    @Override
    public Optional<AuthorizationConfig> getAuthorizationConfig(String issuerName) {
        return Optional.ofNullable(authorizationConfigCache.get(issuerName));
    }

    @Override
    public Optional<SecurityEventCounter> getSecurityEventCounter() {
        TokenValidator validator = tokenValidator.get();
        return validator != null
                ? Optional.of(validator.getSecurityEventCounter())
                : Optional.empty();
    }

    // --- Internal Methods ---

    private Map<String, String> convertContextToProperties(ConfigurationContext context) {
        Map<String, String> properties = new HashMap<>();
        properties.put("Maximum Token Size", context.getProperty(MAXIMUM_TOKEN_SIZE).getValue());
        for (PropertyDescriptor descriptor : context.getProperties().keySet()) {
            String value = context.getProperty(descriptor).getValue();
            if (value != null) {
                properties.put(descriptor.getName(), value);
            }
        }
        return properties;
    }

    private void populateAuthorizationCache(Map<String, String> allProperties) {
        authorizationConfigCache.clear();

        // Load from external configuration first (highest precedence)
        if (configurationManager != null && configurationManager.isConfigurationLoaded()) {
            for (String issuerId : configurationManager.getIssuerIds()) {
                Map<String, String> issuerProps = configurationManager.getIssuerProperties(issuerId);
                buildAndStoreAuthorizationConfig(issuerProps);
            }
        }

        // Load from UI properties (lower precedence, won't override)
        Map<String, Map<String, String>> issuerPropertiesMap = groupPropertiesByIssuerIndex(allProperties);
        for (Map.Entry<String, Map<String, String>> entry : issuerPropertiesMap.entrySet()) {
            buildAndStoreAuthorizationConfig(entry.getValue());
        }
    }

    private void buildAndStoreAuthorizationConfig(Map<String, String> props) {
        String issuerIdentifier = props.get("name");
        if (issuerIdentifier == null || issuerIdentifier.isBlank()) {
            issuerIdentifier = props.get(JWTPropertyKeys.Issuer.ISSUER_NAME);
        }
        if (issuerIdentifier == null || issuerIdentifier.isBlank()) {
            return;
        }
        issuerIdentifier = issuerIdentifier.trim();

        if (authorizationConfigCache.containsKey(issuerIdentifier)) {
            return;
        }

        if ("true".equalsIgnoreCase(props.get(JWTPropertyKeys.Issuer.BYPASS_AUTHORIZATION))) {
            return;
        }

        Set<String> requiredRoles = parseCommaSeparated(props.get(JWTPropertyKeys.Issuer.REQUIRED_ROLES));
        Set<String> requiredScopes = parseCommaSeparated(props.get(JWTPropertyKeys.Issuer.REQUIRED_SCOPES));

        if (requiredRoles.isEmpty() && requiredScopes.isEmpty()) {
            return;
        }

        AuthorizationConfig authConfig = AuthorizationConfig.builder()
                .requiredRoles(requiredRoles)
                .requiredScopes(requiredScopes)
                .build();

        authorizationConfigCache.put(issuerIdentifier, authConfig);
    }

    private static Map<String, Map<String, String>> groupPropertiesByIssuerIndex(Map<String, String> allProperties) {
        Map<String, Map<String, String>> issuerPropertiesMap = new HashMap<>();
        for (Map.Entry<String, String> entry : allProperties.entrySet()) {
            String key = entry.getKey();
            if (key.startsWith(JwtConstants.ISSUER_PREFIX)) {
                String remainder = key.substring(JwtConstants.ISSUER_PREFIX.length());
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

    private static Set<String> parseCommaSeparated(@Nullable String value) {
        if (value == null || value.isBlank()) {
            return Collections.emptySet();
        }
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    /**
     * Sets the NAR classloader on ForkJoinPool common pool threads.
     * Required because HttpJwksLoader.initJWKSLoader() uses CompletableFuture.supplyAsync()
     * and the async task creates JwksHttpContentConverter with ServiceLoader.load().
     */
    private void prepareForkJoinPoolClassLoader() {
        ClassLoader targetClassLoader = getClass().getClassLoader();
        int poolSize = ForkJoinPool.commonPool().getParallelism() + 1;

        CountDownLatch allReady = new CountDownLatch(poolSize);
        CountDownLatch release = new CountDownLatch(1);

        List<CompletableFuture<Void>> tasks = new ArrayList<>();
        for (int i = 0; i < poolSize; i++) {
            tasks.add(CompletableFuture.supplyAsync(() -> {
                Thread.currentThread().setContextClassLoader(targetClassLoader);
                allReady.countDown();
                try {
                    if (!release.await(3, TimeUnit.SECONDS)) {
                        LOGGER.warn(JwtLogMessages.WARN.FORKJOINPOOL_LATCH_AWAIT_TIMEOUT, "release latch");
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return null;
            }));
        }
        try {
            if (!allReady.await(5, TimeUnit.SECONDS)) {
                LOGGER.warn(JwtLogMessages.WARN.FORKJOINPOOL_LATCH_AWAIT_TIMEOUT, "allReady latch");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.warn(JwtLogMessages.WARN.FORKJOINPOOL_CLASSLOADER_SETUP_INTERRUPTED);
        } finally {
            release.countDown();
        }
        try {
            CompletableFuture.allOf(tasks.toArray(new CompletableFuture[0]))
                    .get(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.warn(JwtLogMessages.WARN.FORKJOINPOOL_CLASSLOADER_SETUP_INTERRUPTED);
        } catch (ExecutionException | TimeoutException e) {
            LOGGER.warn(JwtLogMessages.WARN.FORKJOINPOOL_CLASSLOADER_SETUP_FAILED, e.getMessage());
        }
        LOGGER.info(JwtLogMessages.INFO.CLASSLOADER_WORKAROUND_APPLIED);
    }
}
