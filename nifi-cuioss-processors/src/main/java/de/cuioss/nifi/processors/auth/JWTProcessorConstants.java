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
package de.cuioss.nifi.processors.auth;

import de.cuioss.nifi.jwt.JWTAttributes;
import de.cuioss.nifi.jwt.JwtConstants;
import de.cuioss.nifi.jwt.config.JwtIssuerConfigService;
import de.cuioss.nifi.jwt.util.AuthorizationRequirements;
import lombok.experimental.UtilityClass;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.processor.Relationship;
import org.apache.nifi.processor.util.StandardValidators;

/**
 * DSL-style nested constants for JWT processor configuration.
 * <p>
 * Contains only processor-specific constants (relationships, processor-level properties).
 * Shared JWT constants (token location, HTTP headers, error codes) are in
 * {@link JwtConstants} in the common module.
 *
 * @see JwtConstants
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/configuration.adoc">Configuration Specification</a>
 */
@UtilityClass
public final class JWTProcessorConstants {

    /**
     * Processor relationships.
     */
    @UtilityClass
    public static final class Relationships {
        /**
         * FlowFiles with valid tokens will be routed to this relationship.
         */
        public static final Relationship SUCCESS = new Relationship.Builder()
                .name("success")
                .description("FlowFiles with valid tokens will be routed to this relationship")
                .build();

        /**
         * FlowFiles with invalid tokens will be routed to this relationship.
         */
        public static final Relationship AUTHENTICATION_FAILED = new Relationship.Builder()
                .name("authentication-failed")
                .description("FlowFiles with invalid tokens will be routed to this relationship")
                .build();

        /**
         * FlowFiles with extraction failures will be routed to this relationship.
         */
        public static final Relationship FAILURE = new Relationship.Builder()
                .name("failure")
                .description("FlowFiles with extraction failures will be routed to this relationship")
                .build();
    }

    /**
     * Property descriptors for processor configuration.
     * <p>
     * Issuer-related properties (JWKS refresh, allowed algorithms, HTTPS requirement,
     * connection timeout, source type) are now managed by the
     * {@link JwtIssuerConfigService} Controller Service.
     */
    @UtilityClass
    public static final class Properties {
        /**
         * Reference to the JwtIssuerConfigService Controller Service.
         */
        public static final PropertyDescriptor JWT_ISSUER_CONFIG_SERVICE = new PropertyDescriptor.Builder()
                .name("jwt.issuer.config.service")
                .displayName("JWT Issuer Config Service")
                .description("The Controller Service that provides JWT issuer configuration and token validation")
                .required(true)
                .identifiesControllerService(JwtIssuerConfigService.class)
                .build();

        /**
         * Defines where to extract the token from.
         */
        public static final PropertyDescriptor TOKEN_LOCATION = new PropertyDescriptor.Builder()
                .name(JWTAttributes.Properties.Validation.TOKEN_LOCATION)
                .displayName("Token Location")
                .description("Defines where to extract the token from")
                .required(true)
                .allowableValues(JwtConstants.TokenLocation.AUTHORIZATION_HEADER,
                        JwtConstants.TokenLocation.CUSTOM_HEADER,
                        JwtConstants.TokenLocation.FLOW_FILE_CONTENT)
                .defaultValue(JwtConstants.TokenLocation.AUTHORIZATION_HEADER)
                .build();

        /**
         * The header name containing the token when using AUTHORIZATION_HEADER.
         */
        public static final PropertyDescriptor TOKEN_HEADER = new PropertyDescriptor.Builder()
                .name(JWTAttributes.Properties.Validation.TOKEN_HEADER)
                .displayName("Token Header")
                .description("The header name containing the token when using AUTHORIZATION_HEADER")
                .required(false)
                .defaultValue(JwtConstants.Http.AUTHORIZATION_HEADER)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        /**
         * The custom header name when using CUSTOM_HEADER.
         */
        public static final PropertyDescriptor CUSTOM_HEADER_NAME = new PropertyDescriptor.Builder()
                .name(JWTAttributes.Properties.Validation.CUSTOM_HEADER_NAME)
                .displayName("Custom Header Name")
                .description("The custom header name when using CUSTOM_HEADER")
                .required(false)
                .defaultValue("X-Authorization")
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        /**
         * The prefix to strip from the token (e.g., "Bearer ").
         */
        public static final PropertyDescriptor BEARER_TOKEN_PREFIX = new PropertyDescriptor.Builder()
                .name(JWTAttributes.Properties.Validation.BEARER_TOKEN_PREFIX)
                .displayName("Bearer Token Prefix")
                .description("The prefix to strip from the token (e.g., \"Bearer \")")
                .required(false)
                .defaultValue("Bearer")
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        /**
         * Whether to require a valid token for processing.
         * Delegates to shared {@link AuthorizationRequirements#REQUIRE_VALID_TOKEN}.
         */
        public static final PropertyDescriptor REQUIRE_VALID_TOKEN =
                AuthorizationRequirements.REQUIRE_VALID_TOKEN;

        /**
         * Comma-separated list of required roles.
         * Delegates to shared {@link AuthorizationRequirements#REQUIRED_ROLES}.
         */
        public static final PropertyDescriptor REQUIRED_ROLES =
                AuthorizationRequirements.REQUIRED_ROLES;

        /**
         * Comma-separated list of required scopes.
         * Delegates to shared {@link AuthorizationRequirements#REQUIRED_SCOPES}.
         */
        public static final PropertyDescriptor REQUIRED_SCOPES =
                AuthorizationRequirements.REQUIRED_SCOPES;
    }
}
