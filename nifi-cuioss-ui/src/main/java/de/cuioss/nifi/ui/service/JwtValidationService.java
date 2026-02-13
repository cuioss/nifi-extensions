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
import de.cuioss.nifi.ui.util.ProcessorConfigReader;
import de.cuioss.sheriff.oauth.core.IssuerConfig;
import de.cuioss.sheriff.oauth.core.ParserConfig;
import de.cuioss.sheriff.oauth.core.TokenValidator;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.sheriff.oauth.core.exception.TokenValidationException;
import de.cuioss.tools.logging.CuiLogger;

import java.io.IOException;
import java.util.*;

import static de.cuioss.nifi.ui.util.TokenMasking.maskToken;

/**
 * Service for JWT token validation using the OAuth-Sheriff library.
 * This service retrieves processor configuration via NiFi's REST API and
 * creates the same TokenValidator instance that the processor uses.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/token-validation.adoc">Token Validation Specification</a>
 */
public class JwtValidationService {

    private static final CuiLogger LOGGER = new CuiLogger(JwtValidationService.class);

    private static final String CLAIM_ROLES = "roles";
    private static final String CLAIM_SCOPES = "scopes";

    private final ProcessorConfigReader configReader;

    public JwtValidationService() {
        this.configReader = new ProcessorConfigReader();
    }

    // For testing - allows injection of config reader
    JwtValidationService(ProcessorConfigReader configReader) {
        this.configReader = configReader;
    }

    /**
     * Verifies a JWT token using the processor's configuration.
     *
     * @param token The JWT token to verify (must not be null)
     * @param processorId The processor ID to get configuration from (must not be null)
     * @return TokenValidationResult containing validation results (never null)
     * @throws IOException If unable to fetch processor configuration
     * @throws IllegalArgumentException If processor configuration is invalid
     * @throws IllegalStateException If processor configuration is not available
     */
    public TokenValidationResult verifyToken(String token, String processorId)
            throws IOException, IllegalArgumentException, IllegalStateException {

        Objects.requireNonNull(processorId, "processorId must not be null");
        LOGGER.debug("verifyToken called with processorId=%s, token=%s", processorId, maskToken(token));
        Map<String, String> properties;

        try {
            properties = configReader.getProcessorProperties(processorId);
        } catch (IOException e) {
            LOGGER.error(e, UILogMessages.ERROR.FAILED_FETCH_PROCESSOR_CONFIG, processorId);
            throw new IOException("Failed to fetch processor configuration: " + e.getMessage(), e);
        }

        // 2. Parse configurations using shared parser (same logic as processor)
        ConfigurationManager configurationManager = new ConfigurationManager();
        List<IssuerConfig> issuerConfigs = IssuerConfigurationParser.parseIssuerConfigs(properties, configurationManager);
        ParserConfig parserConfig = IssuerConfigurationParser.parseParserConfig(properties);

        if (issuerConfigs.isEmpty()) {
            throw new IllegalStateException("No issuer configurations found for processor " + processorId);
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

        // 4. Validate token and record metrics
        String resolvedIssuer = null;
        long startNanos = System.nanoTime();
        try {
            try {
                AccessTokenContent tokenContent = validator.createAccessToken(token);
                resolvedIssuer = tokenContent.getIssuer();
                LOGGER.debug("Token validation successful for processor %s", processorId);
                return TokenValidationResult.success(tokenContent);
            } catch (TokenValidationException e) {
                LOGGER.debug("Token validation failed for processor %s: %s", processorId, e.getMessage());
                return TokenValidationResult.failure(e.getMessage());
            } catch (IllegalStateException | IllegalArgumentException e) {
                LOGGER.error(e, UILogMessages.ERROR.UNEXPECTED_VALIDATION_ERROR, processorId);
                return TokenValidationResult.failure("Unexpected validation error: " + e.getMessage());
            }
        } finally {
            long durationNanos = System.nanoTime() - startNanos;
            SecurityMetricsStore.recordValidation(
                    validator.getSecurityEventCounter(), durationNanos, resolvedIssuer);
        }
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

