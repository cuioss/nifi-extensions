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

import de.cuioss.jwt.validation.IssuerConfig;
import de.cuioss.jwt.validation.ParserConfig;
import de.cuioss.jwt.validation.TokenValidator;
import de.cuioss.jwt.validation.domain.token.AccessTokenContent;
import de.cuioss.jwt.validation.exception.TokenValidationException;
import de.cuioss.nifi.processors.auth.config.ConfigurationManager;
import de.cuioss.nifi.processors.auth.config.IssuerConfigurationParser;
import de.cuioss.nifi.ui.servlets.MetricsServlet;
import de.cuioss.nifi.ui.util.ProcessorConfigReader;
import de.cuioss.tools.logging.CuiLogger;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service for JWT token validation using the cui-jwt-validation library.
 * This service retrieves processor configuration via NiFi's REST API and 
 * creates the same TokenValidator instance that the processor uses.
 */
public class JwtValidationService {

    private static final CuiLogger LOGGER = new CuiLogger(JwtValidationService.class);

    /**
     * Verifies a JWT token using the processor's configuration.
     * 
     * @param token The JWT token to verify
     * @param processorId The processor ID to get configuration from
     * @return TokenValidationResult containing validation results
     * @throws IOException If unable to fetch processor configuration
     * @throws IllegalArgumentException If processor configuration is invalid
     * @throws IllegalStateException If processor configuration is not available
     */
    public TokenValidationResult verifyToken(String token, String processorId)
            throws IOException, IllegalArgumentException, IllegalStateException {

        // 1. Get processor configuration via NiFi REST API
        ProcessorConfigReader configReader = new ProcessorConfigReader();
        Map<String, String> properties;

        try {
            properties = configReader.getProcessorProperties(processorId);
        } catch (IOException e) {
            LOGGER.error(e, "Failed to fetch processor configuration for %s", processorId);
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
        } catch (Exception e) {
            LOGGER.error(e, "Failed to create TokenValidator for processor %s", processorId);
            throw new IllegalStateException("Failed to create TokenValidator: " + e.getMessage(), e);
        }

        // 4. Validate token using the same logic as the processor
        try {
            AccessTokenContent tokenContent = validator.createAccessToken(token);
            LOGGER.debug("Token validation successful for processor %s", processorId);

            // Record successful validation in metrics
            MetricsServlet.recordValidToken();

            return TokenValidationResult.success(tokenContent);
        } catch (TokenValidationException e) {
            LOGGER.debug("Token validation failed for processor %s: %s", processorId, e.getMessage());

            // Record failed validation in metrics
            MetricsServlet.recordInvalidToken(e.getMessage());

            return TokenValidationResult.failure(e.getMessage());
        } catch (Exception e) {
            LOGGER.error(e, "Unexpected error during token validation for processor %s", processorId);

            String errorMessage = "Unexpected validation error: " + e.getMessage();
            // Record failed validation in metrics
            MetricsServlet.recordInvalidToken(errorMessage);

            return TokenValidationResult.failure(errorMessage);
        }
    }

    /**
     * Result of token validation.
     */
    public static class TokenValidationResult {
        private final boolean valid;
        private final String error;
        private final AccessTokenContent tokenContent;

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

        /**
         * Gets the claims from the token content as a Map.
         * This is used for JSON serialization in the servlet response.
         * 
         * @return Map of claims, or null if token is invalid
         */
        public Map<String, Object> getClaims() {
            if (tokenContent != null) {
                Map<String, Object> claims = new HashMap<>();

                // Add token identity information
                claims.put("sub", tokenContent.getSubject().orElse(""));
                claims.put("iss", tokenContent.getIssuer());
                claims.put("exp", tokenContent.getExpirationTime().toString());

                // Add roles as a list if available
                List<String> roles = tokenContent.getRoles();
                if (!roles.isEmpty()) {
                    claims.put("roles", roles);
                }

                // Add scopes as a list if available
                List<String> scopes = tokenContent.getScopes();
                if (!scopes.isEmpty()) {
                    claims.put("scopes", scopes);
                }

                return claims;
            }
            return null;
        }
    }
}