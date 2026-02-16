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
package de.cuioss.nifi.jwt.test;

import de.cuioss.nifi.jwt.config.JwtAuthenticationConfig;
import de.cuioss.nifi.jwt.config.JwtIssuerConfigService;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.sheriff.oauth.core.exception.TokenValidationException;
import de.cuioss.sheriff.oauth.core.security.SecurityEventCounter;
import org.apache.nifi.controller.AbstractControllerService;

import java.util.Optional;
import java.util.Set;

/**
 * Test implementation of {@link JwtIssuerConfigService} for processor unit tests.
 * Allows configuring token validation behavior without real JWKS/issuer infrastructure.
 * <p>
 * This class lives in the {@code nifi-cuioss-common} test-jar so both
 * {@code nifi-cuioss-processors} and {@code nifi-cuioss-rest-processors} can reuse it.
 */
public class TestJwtIssuerConfigService extends AbstractControllerService implements JwtIssuerConfigService {

    private static final JwtAuthenticationConfig DEFAULT_CONFIG =
            new JwtAuthenticationConfig(16384, Set.of(), true);

    private AccessTokenContent tokenToReturn;
    private TokenValidationException exceptionToThrow;
    private JwtAuthenticationConfig authenticationConfig = DEFAULT_CONFIG;

    public void configureValidToken(AccessTokenContent token) {
        this.tokenToReturn = token;
        this.exceptionToThrow = null;
    }

    public void configureValidationFailure(TokenValidationException exception) {
        this.exceptionToThrow = exception;
        this.tokenToReturn = null;
    }

    public void configureMaxTokenSize(int maxTokenSize) {
        this.authenticationConfig = new JwtAuthenticationConfig(maxTokenSize, Set.of(), true);
    }

    @Override
    public AccessTokenContent validateToken(String rawToken) throws TokenValidationException {
        if (exceptionToThrow != null) {
            throw exceptionToThrow;
        }
        if (tokenToReturn == null) {
            throw new IllegalStateException("TestJwtIssuerConfigService not configured — call configureValidToken() or configureValidationFailure()");
        }
        return tokenToReturn;
    }

    @Override
    public JwtAuthenticationConfig getAuthenticationConfig() {
        return authenticationConfig;
    }

    @Override
    public Optional<SecurityEventCounter> getSecurityEventCounter() {
        return Optional.empty();
    }
}
