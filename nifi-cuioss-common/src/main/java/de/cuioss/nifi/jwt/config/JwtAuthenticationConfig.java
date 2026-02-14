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
 * Immutable representation of the current JWT authentication configuration
 * as configured on the {@link JwtIssuerConfigService} Controller Service.
 * <p>
 * Shared across all consumers (processors, servlets, etc.) to provide
 * consistent access to the centrally configured authentication settings.
 *
 * @param maxTokenSize               maximum token size in bytes
 * @param allowedAlgorithms          allowed JWT signing algorithms
 * @param requireHttpsForJwks        whether HTTPS is required for JWKS URLs
 * @param jwksRefreshIntervalSeconds interval in seconds for refreshing JWKS keys
 * @param jwksConnectionTimeoutSeconds timeout in seconds for JWKS endpoint connections
 * @param jwksSourceType             default JWKS source type (url, file, memory)
 */
public record JwtAuthenticationConfig(
        int maxTokenSize,
        Set<String> allowedAlgorithms,
        boolean requireHttpsForJwks,
        int jwksRefreshIntervalSeconds,
        int jwksConnectionTimeoutSeconds,
        String jwksSourceType) {

    public JwtAuthenticationConfig {
        allowedAlgorithms = allowedAlgorithms != null ? Set.copyOf(allowedAlgorithms) : Set.of();
        jwksSourceType = jwksSourceType != null ? jwksSourceType : "url";
    }
}
