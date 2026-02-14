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

import java.util.Set;

/**
 * Immutable representation of the issuer-invariant JWT authentication
 * configuration as configured on the {@link JwtIssuerConfigService}
 * Controller Service.
 * <p>
 * Contains only settings that apply globally across all issuers.
 * Per-issuer operational settings (JWKS refresh interval, connection timeout,
 * source type) are passed directly to the oauth-sheriff
 * {@link de.cuioss.sheriff.oauth.core.jwks.http.HttpJwksLoaderConfig} per issuer.
 *
 * @param maxTokenSize        maximum token size in bytes
 * @param allowedAlgorithms   allowed JWT signing algorithms
 * @param requireHttpsForJwks whether HTTPS is required for JWKS URLs
 */
public record JwtAuthenticationConfig(
        int maxTokenSize,
        Set<String> allowedAlgorithms,
        boolean requireHttpsForJwks) {

    public JwtAuthenticationConfig {
        allowedAlgorithms = allowedAlgorithms != null ? Set.copyOf(allowedAlgorithms) : Set.of();
    }
}
