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
package de.cuioss.nifi.ui.service;

import de.cuioss.nifi.jwt.config.ConfigurationManager;
import de.cuioss.nifi.jwt.config.IssuerConfigurationParser;
import de.cuioss.nifi.ui.UILogMessages;
import de.cuioss.nifi.ui.util.ComponentConfigReader;
import de.cuioss.sheriff.oauth.core.IssuerConfig;
import de.cuioss.sheriff.oauth.core.ParserConfig;
import de.cuioss.sheriff.oauth.core.TokenValidator;
import de.cuioss.sheriff.oauth.core.domain.context.AccessTokenRequest;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.sheriff.oauth.core.exception.TokenValidationException;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.nifi.web.NiFiWebConfigurationContext;
import org.jspecify.annotations.Nullable;

import java.util.*;

import static de.cuioss.nifi.ui.util.TokenMasking.maskToken;

/**
 * Service for JWT token validation using the OAuth-Sheriff library.
 * This service retrieves processor configuration via NiFi's internal
 * {@link NiFiWebConfigurationContext} API and creates the same
 * TokenValidator instance that the processor uses.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/token-validation.adoc">Token Validation Specification</a>
 */
public class JwtValidationService {

    private static final CuiLogger LOGGER = new CuiLogger(JwtValidationService.class);

    private static final String CLAIM_ROLES = "roles";
    private static final String CLAIM_SCOPES = "scopes";

    /** Shared CS property keys — see {@link ComponentConfigReader#CONTROLLER_SERVICE_PROPERTY_KEYS}. */
    private static final List<String> CONTROLLER_SERVICE_PROPERTY_KEYS =
            ComponentConfigReader.CONTROLLER_SERVICE_PROPERTY_KEYS;

    private final NiFiWebConfigurationContext configContext;

    public JwtValidationService(NiFiWebConfigurationContext configContext) {
        this.configContext = Objects.requireNonNull(configContext, "configContext must not be null");
    }

    /**
     * Verifies a JWT token using the processor's configuration.
     *
     * @param token       The JWT token to verify (must not be null)
     * @param processorId The processor ID to get configuration from (must not be null)
     * @param request     The current HTTP servlet request (for authentication context)
     * @return TokenValidationResult containing validation results (never null)
     * @throws IllegalArgumentException If processor configuration is invalid
     * @throws IllegalStateException    If processor configuration is not available
     */
    public TokenValidationResult verifyToken(String token, String processorId, HttpServletRequest request)
            throws IllegalArgumentException, IllegalStateException {

        Objects.requireNonNull(processorId, "processorId must not be null");
        LOGGER.debug("verifyToken called with processorId=%s, token=%s", processorId, maskToken(token));

        var configReader = new ComponentConfigReader(configContext);
        Map<String, String> processorProperties = configReader.getProcessorProperties(processorId, request);

        // NiFi's Custom UI internal API redacts controller service reference values
        // (returns the property key but with an empty value). When this happens,
        // re-fetch processor properties via the NiFi REST API to get actual CS UUIDs.
        if (hasEmptyControllerServiceReference(processorProperties)) {
            LOGGER.debug("Internal API returned empty CS reference for processor %s, "
                    + "fetching via REST API", processorId);
            Map<String, String> restProps =
                    configReader.getProcessorPropertiesViaRest(processorId, request);
            if (!restProps.isEmpty()) {
                processorProperties = restProps;
                LOGGER.debug("REST API returned %s processor properties", processorProperties.size());
            } else {
                LOGGER.warn("REST API also returned empty processor properties for %s", processorId);
            }
        }

        // Resolve controller service properties if the processor references one
        Map<String, String> issuerProperties = resolveIssuerProperties(
                processorProperties, configReader, request);

        // 2. Parse configurations using shared parser (same logic as processor)
        // ParserConfig must be created first (on this servlet thread with the correct
        // classloader) and passed through so HttpJwksLoader reuses it instead of
        // triggering ServiceLoader on ForkJoinPool threads (OAuthSheriff#212).
        ParserConfig parserConfig = IssuerConfigurationParser.parseParserConfig(issuerProperties);
        parserConfig.getDslJson(); // Eagerly init DSL-JSON on this thread's classloader
        ConfigurationManager configurationManager = new ConfigurationManager();
        List<IssuerConfig> issuerConfigs = IssuerConfigurationParser.parseIssuerConfigs(
                issuerProperties, configurationManager, parserConfig);

        if (issuerConfigs.isEmpty()) {
            throw new IllegalStateException("No issuer configurations found for processor " + processorId
                    + " (properties: " + issuerProperties.keySet() + ")");
        }

        // 3. Build TokenValidator exactly as the processor does
        TokenValidator validator;
        try {
            validator = TokenValidator.builder()
                    .parserConfig(parserConfig)
                    .issuerConfigs(issuerConfigs)
                    .build();
        } catch (IllegalStateException | IllegalArgumentException e) {
            LOGGER.error(e, UILogMessages.ERROR.FAILED_CREATE_TOKEN_VALIDATOR, processorId);
            throw new IllegalStateException("Failed to create TokenValidator: " + e.getMessage(), e);
        }

        // 4. Validate token — metrics tracked by TokenValidator's SecurityEventCounter
        try {
            AccessTokenContent tokenContent = validator.createAccessToken(AccessTokenRequest.of(token));
            LOGGER.debug("Token validation successful for processor %s", processorId);
            return TokenValidationResult.success(tokenContent);
        } catch (TokenValidationException e) {
            LOGGER.debug("Token validation failed for processor %s: %s", processorId, e.getMessage());
            return TokenValidationResult.failure(e.getMessage());
        } catch (IllegalStateException | IllegalArgumentException e) {
            LOGGER.error(e, UILogMessages.ERROR.UNEXPECTED_VALIDATION_ERROR, processorId);
            return TokenValidationResult.failure("Unexpected validation error: " + e.getMessage());
        }
    }

    /**
     * Resolves the properties to use for issuer configuration parsing.
     * If the processor properties contain a controller service reference
     * (e.g., {@code jwt.issuer.config.service}), the controller service's
     * properties are returned instead, as the issuer configurations are
     * defined on the controller service rather than the processor itself.
     *
     * @param processorProperties the processor's property map
     * @param configReader        the component config reader
     * @param request             the HTTP servlet request (for authentication context)
     * @return the properties to use for issuer config parsing (never null)
     */
    private static Map<String, String> resolveIssuerProperties(
            Map<String, String> processorProperties,
            ComponentConfigReader configReader,
            HttpServletRequest request) {

        for (String key : CONTROLLER_SERVICE_PROPERTY_KEYS) {
            String controllerServiceId = processorProperties.get(key);
            if (controllerServiceId != null && !controllerServiceId.isBlank()) {
                LOGGER.debug("Resolving controller service %s from property '%s'",
                        controllerServiceId, key);
                return resolveControllerServiceProperties(
                        controllerServiceId, key, configReader, request);
            }
        }
        return processorProperties;
    }

    private static Map<String, String> resolveControllerServiceProperties(
            String controllerServiceId, String propertyKey,
            ComponentConfigReader configReader, HttpServletRequest request) {
        // Try internal NiFi API first
        Map<String, String> csProperties = fetchViaInternalApi(
                controllerServiceId, configReader, request);
        if (!csProperties.isEmpty()) {
            return csProperties;
        }

        // Fallback: fetch CS properties via NiFi REST API
        Map<String, String> restProperties = fetchViaRestApi(
                controllerServiceId, configReader, request);
        if (!restProperties.isEmpty()) {
            return restProperties;
        }

        throw new IllegalStateException(
                "Failed to resolve properties for controller service "
                        + controllerServiceId + " referenced by property '" + propertyKey + "'");
    }

    private static Map<String, String> fetchViaInternalApi(
            String controllerServiceId, ComponentConfigReader configReader,
            HttpServletRequest request) {
        try {
            Map<String, String> csProperties =
                    configReader.getComponentConfig(controllerServiceId, request).properties();
            LOGGER.debug("Resolved %s properties from controller service %s",
                    csProperties.size(), controllerServiceId);
            if (csProperties.isEmpty()) {
                LOGGER.warn("Internal API returned empty properties for controller service %s, "
                        + "trying NiFi REST API fallback", controllerServiceId);
            }
            return csProperties;
        } catch (RuntimeException e) {
            LOGGER.warn("Internal API failed for controller service %s: %s, "
                    + "trying NiFi REST API fallback", controllerServiceId, e.getMessage());
            return Map.of();
        }
    }

    private static Map<String, String> fetchViaRestApi(
            String controllerServiceId, ComponentConfigReader configReader,
            HttpServletRequest request) {
        try {
            Map<String, String> restProperties =
                    configReader.getControllerServicePropertiesViaRest(
                            controllerServiceId, request);
            if (!restProperties.isEmpty()) {
                LOGGER.debug("REST API returned %s properties for controller service %s",
                        restProperties.size(), controllerServiceId);
            } else {
                LOGGER.warn("REST API also returned empty properties for controller service %s",
                        controllerServiceId);
            }
            return restProperties;
        } catch (RuntimeException e) {
            LOGGER.warn("REST API fallback failed for controller service %s: %s",
                    controllerServiceId, e.getMessage());
            return Map.of();
        }
    }

    /**
     * Checks whether any controller service reference property exists but
     * has an empty or null value. This happens when NiFi's Custom UI
     * internal API redacts CS references in the processor WAR context.
     */
    static boolean hasEmptyControllerServiceReference(Map<String, String> processorProperties) {
        for (String key : CONTROLLER_SERVICE_PROPERTY_KEYS) {
            if (processorProperties.containsKey(key)) {
                String value = processorProperties.get(key);
                LOGGER.debug("CS reference property '%s' = '%s'", key,
                        describeValue(value));
                if (value == null || value.isBlank()) {
                    return true;
                }
            }
        }
        return false;
    }

    static String describeValue(@Nullable String value) {
        if (value == null) {
            return "<null>";
        }
        return value.isBlank() ? "<blank>" : value;
    }

    /**
     * Result of token validation.
     */
    public static class TokenValidationResult {
        private final boolean valid;
        private final String error;
        private final AccessTokenContent tokenContent;
        private String issuer;
        private boolean authorized;
        private List<String> scopes;
        private List<String> roles;

        private TokenValidationResult(boolean valid, String error, AccessTokenContent tokenContent) {
            this.valid = valid;
            this.error = error;
            this.tokenContent = tokenContent;
        }

        public static TokenValidationResult success(AccessTokenContent tokenContent) {
            return new TokenValidationResult(true, null, tokenContent);
        }

        public static TokenValidationResult failure(String error) {
            return new TokenValidationResult(false, error, null);
        }

        public boolean isValid() {
            return valid;
        }

        public String getError() {
            return error;
        }

        public AccessTokenContent getTokenContent() {
            return tokenContent;
        }

        public void setIssuer(String issuer) {
            this.issuer = issuer;
        }

        public String getIssuer() {
            if (issuer != null) {
                return issuer;
            }
            return tokenContent != null ? tokenContent.getIssuer() : null;
        }

        public void setAuthorized(boolean authorized) {
            this.authorized = authorized;
        }

        public boolean isAuthorized() {
            return authorized;
        }

        public void setScopes(List<String> scopes) {
            this.scopes = scopes;
        }

        public List<String> getScopes() {
            if (scopes != null) {
                return scopes;
            }
            return tokenContent != null ? tokenContent.getScopes() : null;
        }

        public void setRoles(List<String> roles) {
            this.roles = roles;
        }

        public List<String> getRoles() {
            if (roles != null) {
                return roles;
            }
            return tokenContent != null ? tokenContent.getRoles() : null;
        }

        /**
         * Gets the claims from the token content as a Map.
         * This is used for JSON serialization in the servlet response.
         *
         * @return Map of claims, or empty map if token is invalid
         */
        public Map<String, Object> getClaims() {
            if (tokenContent != null) {
                Map<String, Object> claims = new HashMap<>();

                // Add token identity information
                claims.put("sub", tokenContent.getSubject().orElse(""));
                claims.put("iss", tokenContent.getIssuer());
                claims.put("exp", tokenContent.getExpirationTime().toString());

                // Add roles as a list if available
                List<String> tokenRoles = tokenContent.getRoles();
                if (!tokenRoles.isEmpty()) {
                    claims.put(CLAIM_ROLES, tokenRoles);
                }

                // Add scopes as a list if available
                List<String> tokenScopes = tokenContent.getScopes();
                if (!tokenScopes.isEmpty()) {
                    claims.put(CLAIM_SCOPES, tokenScopes);
                }

                return claims;
            }
            return Collections.emptyMap();
        }
    }

}
