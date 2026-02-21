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
package de.cuioss.nifi.rest;

import de.cuioss.nifi.jwt.config.JwtIssuerConfigService;
import lombok.experimental.UtilityClass;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.processor.Relationship;
import org.apache.nifi.processor.util.StandardValidators;
import org.apache.nifi.ssl.SSLContextProvider;

/**
 * DSL-style nested constants for the RestApiGateway processor configuration.
 *
 * @see RestApiAttributes
 */
@UtilityClass
public final class RestApiGatewayConstants {

    @UtilityClass
    public static final class Relationships {
        public static final Relationship FAILURE = new Relationship.Builder()
                .name("failure")
                .description("FlowFiles created from requests that caused internal errors are routed here")
                .build();
    }

    @UtilityClass
    public static final class Properties {
        public static final PropertyDescriptor LISTENING_PORT = new PropertyDescriptor.Builder()
                .name("rest.gateway.listening.port")
                .displayName("Listening Port")
                .description("The TCP port the embedded HTTP server listens on")
                .required(true)
                .defaultValue("9443")
                .addValidator(StandardValidators.PORT_VALIDATOR)
                .build();

        public static final PropertyDescriptor JWT_ISSUER_CONFIG_SERVICE = new PropertyDescriptor.Builder()
                .name("rest.gateway.jwt.config.service")
                .displayName("JWT Issuer Config Service")
                .description("The Controller Service that provides JWT issuer configuration and token validation")
                .required(true)
                .identifiesControllerService(JwtIssuerConfigService.class)
                .build();

        public static final PropertyDescriptor MAX_REQUEST_SIZE = new PropertyDescriptor.Builder()
                .name("rest.gateway.max.request.size")
                .displayName("Max Request Body Size")
                .description("Maximum allowed request body size in bytes")
                .required(true)
                .defaultValue("1048576")
                .addValidator(StandardValidators.POSITIVE_INTEGER_VALIDATOR)
                .build();

        public static final PropertyDescriptor REQUEST_QUEUE_SIZE = new PropertyDescriptor.Builder()
                .name("rest.gateway.request.queue.size")
                .displayName("Request Queue Size")
                .description("Maximum number of pending requests waiting for FlowFile creation")
                .required(true)
                .defaultValue("50")
                .addValidator(StandardValidators.POSITIVE_INTEGER_VALIDATOR)
                .build();

        public static final PropertyDescriptor SSL_CONTEXT_SERVICE = new PropertyDescriptor.Builder()
                .name("rest.gateway.ssl.context.service")
                .displayName("SSL Context Service")
                .description("The SSL Context Service to use for HTTPS. "
                        + "When configured, the embedded server uses HTTPS instead of HTTP.")
                .required(false)
                .identifiesControllerService(SSLContextProvider.class)
                .build();

        public static final PropertyDescriptor CORS_ALLOWED_ORIGINS = new PropertyDescriptor.Builder()
                .name("rest.gateway.cors.allowed.origins")
                .displayName("CORS Allowed Origins")
                .description("Comma-separated list of allowed CORS origins. "
                        + "Use '*' to allow all origins. Leave empty to disable CORS.")
                .required(false)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor LISTENING_HOST = new PropertyDescriptor.Builder()
                .name("rest.gateway.listening.host")
                .displayName("Listening Host")
                .description("The host/IP the embedded HTTP server binds to. "
                        + "Use '127.0.0.1' to restrict to localhost, '0.0.0.0' for all interfaces.")
                .required(false)
                .defaultValue("0.0.0.0")
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_API_KEY = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.api-key")
                .displayName("Management API Key")
                .description("When set, the /metrics management endpoint requires this key "
                        + "in the X-Api-Key header. Leave empty to allow unauthenticated access.")
                .required(false)
                .sensitive(true)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();
    }
}
