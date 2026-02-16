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

import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.sheriff.oauth.core.exception.TokenValidationException;
import de.cuioss.sheriff.oauth.core.security.SecurityEventCounter;
import org.apache.nifi.controller.ControllerService;

import java.util.Optional;

/**
 * NiFi Controller Service for shared JWT issuer configuration and token validation.
 * <p>
 * Centralizes JWT issuer management, JWKS key retrieval, and token validation
 * so that multiple processors can share the same configuration without duplication.
 * <p>
 * Exposes oauth-sheriff's {@link AccessTokenContent} directly — no wrapping.
 * Metrics are exposed via the library's own {@link SecurityEventCounter} — no
 * intermediate data structures.
 */
public interface JwtIssuerConfigService extends ControllerService {

    /**
     * Validates a raw JWT token string and returns the parsed token content.
     *
     * @param rawToken the raw JWT token string (must not be null)
     * @return the parsed {@link AccessTokenContent} on successful validation
     * @throws TokenValidationException if the token is invalid, expired, or cannot be validated
     */
    AccessTokenContent validateToken(String rawToken);

    /**
     * Returns the immutable authentication configuration snapshot.
     * Provides consistent access to centrally configured settings
     * (max token size, allowed algorithms, JWKS settings, etc.).
     *
     * @return the current authentication configuration
     */
    JwtAuthenticationConfig getAuthenticationConfig();

    /**
     * Returns the security event counter from the underlying TokenValidator.
     * Tracks success/failure counts by event type (expired, signature failed, etc.).
     *
     * @return the security event counter, or empty if the service is not enabled
     */
    Optional<SecurityEventCounter> getSecurityEventCounter();
}
