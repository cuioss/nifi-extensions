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
import de.cuioss.sheriff.token.validation.IssuerConfig;
import de.cuioss.sheriff.token.validation.ParserConfig;
import de.cuioss.sheriff.token.validation.TokenValidator;
import de.cuioss.sheriff.token.validation.domain.context.AccessTokenRequest;
import de.cuioss.sheriff.token.validation.domain.token.AccessTokenContent;
import de.cuioss.sheriff.token.validation.security.SecurityEventCounter;
import de.cuioss.sheriff.token.validation.security.SignatureAlgorithmPreferences;
import de.cuioss.tools.logging.CuiLogger;
import org.apache.nifi.annotation.behavior.RequiresInstanceClassLoading;
import org.apache.nifi.annotation.behavior.SupportsSensitiveDynamicProperties;
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
import java.util.stream.Collectors;

/**
 * Standard implementation of {@link JwtIssuerConfigService}.
 * <p>
 * Manages the lifecycle of a {@link TokenValidator}, including JWKS key refresh
 * and per-issuer configuration. During {@link #onEnabled(ConfigurationContext)},
 * the NAR classloader is temporarily set as context classloader so that
 * {@code ServiceLoader} finds dsl-json converters for {@link ParserConfig} initialization.
 * The pre-initialized {@code ParserConfig} is then passed to each
 * {@link de.cuioss.sheriff.token.validation.jwks.http.HttpJwksLoaderConfig}, avoiding
 * any classloader issues on async threads.
 * <p>
 * Runtime {@code validateToken()} calls do NOT use ServiceLoader.
 * <p>
 * Metrics are tracked by the {@link TokenValidator} internally via its
 * {@link SecurityEventCounter}. This class reads from those built-in facilities
 * rather than duplicating the tracking.
 *
 * @see JwtIssuerConfigService
 */
@Tags({"jwt", "oauth", "authentication", "authorization", "security", "controller-service"})
@CapabilityDescription("Provides shared JWT issuer configuration and token validation. " +
        "Manages JWKS key retrieval, issuer configuration, and token validation lifecycle " +
        "so that multiple processors can share the same JWT configuration.")
@SupportsSensitiveDynamicProperties
@RequiresInstanceClassLoading
// S2160: NiFi components use identity equality (component identifier) inherited from
// AbstractControllerService; the added fields are transient runtime state, not part of identity,
// so overriding equals/hashCode would be incorrect for the NiFi lifecycle contract.
@SuppressWarnings("java:S2160")
public class StandardJwtIssuerConfigService extends AbstractControllerService implements JwtIssuerConfigService {

    private static final CuiLogger LOGGER = new CuiLogger(StandardJwtIssuerConfigService.class);

    // --- NiFi Property Descriptors ---

    private static final String BOOLEAN_FALSE = "false";

    static final PropertyDescriptor JWKS_REFRESH_INTERVAL = new PropertyDescriptor.Builder()
            .name(JwtAttributes.Properties.Validation.JWKS_REFRESH_INTERVAL)
            .displayName("JWKS Refresh Interval")
            .description("Interval in seconds for refreshing JWKS keys")
            .required(true)
            .defaultValue("3600")
            .addValidator(StandardValidators.POSITIVE_INTEGER_VALIDATOR)
            .build();

    static final PropertyDescriptor MAXIMUM_TOKEN_SIZE = new PropertyDescriptor.Builder()
            .name(JwtAttributes.Properties.Validation.MAXIMUM_TOKEN_SIZE)
            .displayName("Maximum Token Size")
            .description("Maximum token size in bytes")
            .required(true)
            .defaultValue("16384")
            .addValidator(StandardValidators.POSITIVE_INTEGER_VALIDATOR)
            .build();

    static final PropertyDescriptor ALLOWED_ALGORITHMS = new PropertyDescriptor.Builder()
            .name(JwtAttributes.Properties.Validation.ALLOWED_ALGORITHMS)
            .displayName("Allowed Algorithms")
            .description("Comma-separated list of allowed JWT signing algorithms. " +
                    "The 'none' algorithm is never allowed regardless of this setting.")
            .required(false)
            .defaultValue(String.join(",", new SignatureAlgorithmPreferences().getPreferredAlgorithms()))
            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
            .build();

    static final PropertyDescriptor REQUIRE_HTTPS_FOR_JWKS = new PropertyDescriptor.Builder()
            .name(JwtAttributes.Properties.Validation.REQUIRE_HTTPS_FOR_JWKS)
            .displayName("Require HTTPS for JWKS URLs")
            .description("Whether to require HTTPS for JWKS URLs. Strongly recommended for production.")
            .required(true)
            .defaultValue("true")
            .allowableValues("true", BOOLEAN_FALSE)
            .build();

    static final PropertyDescriptor JWKS_CONNECTION_TIMEOUT = new PropertyDescriptor.Builder()
            .name(JwtAttributes.Properties.Validation.JWKS_CONNECTION_TIMEOUT)
            .displayName("JWKS Connection Timeout")
            .description("Timeout in seconds for JWKS endpoint connections")
            .required(true)
            .defaultValue("10")
            .addValidator(StandardValidators.POSITIVE_INTEGER_VALIDATOR)
            .build();

    static final PropertyDescriptor JWKS_ALLOW_PRIVATE_NETWORK_ADDRESSES = new PropertyDescriptor.Builder()
            .name(JwtAttributes.Properties.Validation.JWKS_ALLOW_PRIVATE_NETWORK_ADDRESSES)
            .displayName("Allow Private Network Addresses for JWKS")
            .description("When true, allows JWKS URLs that resolve to private/loopback network addresses. "
                    + "Enable this when the IdP (e.g. Keycloak) runs on an internal network. "
                    + "Default: false (blocks private addresses for SSRF protection).")
            .required(true)
            .defaultValue(BOOLEAN_FALSE)
            .allowableValues("true", BOOLEAN_FALSE)
            .build();

    private static final List<PropertyDescriptor> PROPERTY_DESCRIPTORS = List.of(
            JWKS_REFRESH_INTERVAL,
            MAXIMUM_TOKEN_SIZE,
            ALLOWED_ALGORITHMS,
            REQUIRE_HTTPS_FOR_JWKS,
            JWKS_CONNECTION_TIMEOUT,
            JWKS_ALLOW_PRIVATE_NETWORK_ADDRESSES
    );

    // --- Internal State ---
    // Written on the @OnEnabled/@OnDisabled lifecycle thread and read by processor threads
    // via validateToken()/getAuthenticationConfig(); declared volatile to establish a
    // happens-before edge and safely publish the fully constructed instances.

    // S3077: volatile-on-reference is intentional — these fields only publish a fully constructed,
    // effectively immutable instance reference (safe publication); no compound state mutation is
    // performed through the reference, so a thread-safe container would add no guarantee.
    @SuppressWarnings("java:S3077")
    @Nullable private volatile TokenValidator tokenValidator;
    @SuppressWarnings("java:S3077")
    @Nullable private volatile JwtAuthenticationConfig authenticationConfig;
    @SuppressWarnings("java:S3077")
    @Nullable private volatile ConfigurationManager configurationManager;

    @Override
    protected List<PropertyDescriptor> getSupportedPropertyDescriptors() {
        return PROPERTY_DESCRIPTORS;
    }

    @Override
    protected PropertyDescriptor getSupportedDynamicPropertyDescriptor(String propertyDescriptorName) {
        String description = propertyDescriptorName.startsWith(JwtConstants.ISSUER_PREFIX)
                ? "Issuer configuration property"
                : "Dynamic property";
        return new PropertyDescriptor.Builder()
                .name(propertyDescriptorName)
                .displayName(propertyDescriptorName)
                .description(description)
                .required(false)
                .dynamic(true)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();
    }

    @OnEnabled
    public void onEnabled(ConfigurationContext context) {
        ClassLoader originalClassLoader = Thread.currentThread().getContextClassLoader();
        try {
            // Set NAR classloader so ServiceLoader finds dsl-json converters during ParserConfig init
            Thread.currentThread().setContextClassLoader(getClass().getClassLoader());

            configurationManager = new ConfigurationManager();
            authenticationConfig = buildAuthenticationConfig(context);
            Map<String, String> properties = convertContextToProperties(context);

            // Parse parser config and eagerly initialize dsl-json while NAR classloader is active
            ParserConfig parserConfig = IssuerConfigurationParser.parseParserConfig(properties);
            parserConfig.getDslJson();

            // Parse issuer configurations, passing parserConfig so each HttpJwksLoaderConfig
            // reuses the pre-initialized ParserConfig (avoids ServiceLoader on ForkJoinPool threads)
            List<IssuerConfig> issuerConfigs = IssuerConfigurationParser.parseIssuerConfigs(
                    properties, configurationManager, parserConfig);

            if (issuerConfigs.isEmpty()) {
                LOGGER.warn(JwtLogMessages.WARN.NO_VALID_ISSUER_CONFIGS);
            }

            tokenValidator = TokenValidator.builder()
                    .parserConfig(parserConfig)
                    .issuerConfigs(issuerConfigs)
                    .build();

            LOGGER.info(JwtLogMessages.INFO.CONTROLLER_SERVICE_ENABLED, issuerConfigs.size());
        } catch (IllegalStateException | IllegalArgumentException e) {
            LOGGER.error(e, JwtLogMessages.ERROR.CONTROLLER_SERVICE_ENABLE_FAILED, e.getMessage());
            throw new IllegalStateException("Failed to enable JwtIssuerConfigService", e);
        } finally {
            Thread.currentThread().setContextClassLoader(originalClassLoader);
        }
    }

    @OnDisabled
    public void onDisabled() {
        try {
            TokenValidator validator = tokenValidator;
            if (validator != null) {
                // Release the validator's background JWKS refresh resources
                validator.close();
            }
        } finally {
            // Always null the lifecycle state and log cleanup, even if close() throws,
            // so a failing close does not leave a stale validator reachable.
            tokenValidator = null;
            authenticationConfig = null;
            configurationManager = null;
            LOGGER.info(JwtLogMessages.INFO.CONTROLLER_SERVICE_DISABLED);
        }
    }

    @Override
    public AccessTokenContent validateToken(String rawToken) {
        Objects.requireNonNull(rawToken, "rawToken must not be null");

        TokenValidator validator = tokenValidator;
        if (validator == null) {
            throw new IllegalStateException("JwtIssuerConfigService is not enabled or has no configuration");
        }

        return validator.createAccessToken(AccessTokenRequest.of(rawToken));
    }

    @Override
    public JwtAuthenticationConfig getAuthenticationConfig() {
        JwtAuthenticationConfig config = authenticationConfig;
        if (config == null) {
            throw new IllegalStateException("JwtIssuerConfigService is not enabled");
        }
        return config;
    }

    @Override
    public Optional<SecurityEventCounter> getSecurityEventCounter() {
        TokenValidator validator = tokenValidator;
        return validator != null
                ? Optional.of(validator.getSecurityEventCounter())
                : Optional.empty();
    }

    // --- Internal Methods ---

    private static JwtAuthenticationConfig buildAuthenticationConfig(ConfigurationContext context) {
        int maxTokenSize = context.getProperty(MAXIMUM_TOKEN_SIZE).asInteger();
        boolean requireHttps = context.getProperty(REQUIRE_HTTPS_FOR_JWKS).asBoolean();

        String algorithmsValue = context.getProperty(ALLOWED_ALGORITHMS).getValue();
        // Trim entries and tolerate duplicates — Set.of would throw on "RS256,RS256"
        Set<String> allowedAlgorithms = algorithmsValue != null
                ? Arrays.stream(algorithmsValue.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toUnmodifiableSet())
                : Set.of();

        return new JwtAuthenticationConfig(maxTokenSize, allowedAlgorithms, requireHttps);
    }

    private Map<String, String> convertContextToProperties(ConfigurationContext context) {
        Map<String, String> properties = new HashMap<>();
        for (PropertyDescriptor descriptor : context.getProperties().keySet()) {
            String value = context.getProperty(descriptor).getValue();
            if (value != null) {
                properties.put(descriptor.getName(), value);
            }
        }
        return properties;
    }

}
