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

import de.cuioss.nifi.jwt.util.AuthorizationValidator.AuthorizationConfig;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.sheriff.oauth.core.exception.TokenValidationException;
import org.apache.nifi.controller.ControllerService;

import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * NiFi Controller Service for shared JWT issuer configuration and token validation.
 * <p>
 * Centralizes JWT issuer management, JWKS key retrieval, and token validation
 * so that multiple processors can share the same configuration without duplication.
 * <p>
 * Exposes oauth-sheriff's {@link AccessTokenContent} directly — no wrapping.
 * Both libraries are cuioss-owned, so no abstraction layer is needed.
 *
 * @see StandardJwtIssuerConfigService
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/technical-components.adoc">Technical Components Specification</a>
 */
public interface JwtIssuerConfigService extends ControllerService {

    /**
     * Validates a raw JWT token string and returns the parsed token content.
     * <p>
     * Internally records metrics on each call (success/failure, duration, issuer, error type).
     *
     * @param rawToken the raw JWT token string (must not be null or empty)
     * @return the parsed {@link AccessTokenContent} on successful validation
     * @throws TokenValidationException if the token is invalid, expired, or cannot be validated
     * @throws IllegalArgumentException if rawToken is null or empty
     */
    AccessTokenContent validateToken(String rawToken);

    /**
     * Returns the names of all configured issuers.
     *
     * @return an unmodifiable set of issuer names (never null, may be empty)
     */
    Set<String> getIssuerNames();

    /**
     * Returns the authorization configuration for a specific issuer.
     *
     * @param issuerName the issuer name to look up
     * @return the authorization config if configured, or empty if no authorization
     *         requirements are set for this issuer (bypass or unconfigured)
     */
    Optional<AuthorizationConfig> getAuthorizationConfig(String issuerName);

    /**
     * Returns the list of allowed JWT signing algorithms.
     *
     * @return an unmodifiable list of algorithm names (never null)
     */
    List<String> getAllowedAlgorithms();

    /**
     * Returns an immutable snapshot of aggregated validation metrics.
     * <p>
     * Includes total validations, error rates, per-issuer stats, and response time
     * percentiles. Intended for use by the metrics servlet in the UI module.
     *
     * @return the current metrics snapshot (never null)
     */
    MetricsSnapshot getMetricsSnapshot();
}
