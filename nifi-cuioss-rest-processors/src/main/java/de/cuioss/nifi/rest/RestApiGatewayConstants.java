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
    }
}
