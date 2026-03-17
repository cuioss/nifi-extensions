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
import org.apache.nifi.distributed.cache.client.DistributedMapCacheClient;
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

        public static final Relationship ATTACHMENTS = new Relationship.Builder()
                .name("attachments")
                .description("FlowFiles created from attachment upload requests are routed here")
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

        public static final PropertyDescriptor LISTENING_HOST = new PropertyDescriptor.Builder()
                .name("rest.gateway.listening.host")
                .displayName("Listening Host")
                .description("The host/IP the embedded HTTP server binds to. "
                        + "Use '127.0.0.1' to restrict to localhost, '0.0.0.0' for all interfaces.")
                .required(false)
                .defaultValue("0.0.0.0")
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_HEALTH_ENABLED = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.health.enabled")
                .displayName("Health Endpoint Enabled")
                .description("Whether the /health management endpoint is active")
                .required(false)
                .defaultValue("true")
                .allowableValues("true", "false")
                .build();

        public static final PropertyDescriptor MANAGEMENT_HEALTH_AUTH_MODE = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.health.auth-mode")
                .displayName("Health Endpoint Auth Mode")
                .description("Authentication modes for the /health endpoint (comma-separated): "
                        + "'local-only' (loopback bypass), 'bearer' (JWT required), 'none' (anonymous). "
                        + "Combine modes, e.g. 'local-only,bearer' for loopback bypass OR JWT.")
                .required(false)
                .defaultValue("local-only,bearer")
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_HEALTH_REQUIRED_ROLES = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.health.required-roles")
                .displayName("Health Endpoint Required Roles")
                .description("Comma-separated roles required in the JWT token for the /health endpoint. "
                        + "Only relevant when auth-mode includes 'bearer'.")
                .required(false)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_HEALTH_REQUIRED_SCOPES = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.health.required-scopes")
                .displayName("Health Endpoint Required Scopes")
                .description("Comma-separated scopes required in the JWT token for the /health endpoint. "
                        + "Only relevant when auth-mode includes 'bearer'.")
                .required(false)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_METRICS_ENABLED = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.metrics.enabled")
                .displayName("Metrics Endpoint Enabled")
                .description("Whether the /metrics management endpoint is active")
                .required(false)
                .defaultValue("true")
                .allowableValues("true", "false")
                .build();

        public static final PropertyDescriptor MANAGEMENT_METRICS_AUTH_MODE = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.metrics.auth-mode")
                .displayName("Metrics Endpoint Auth Mode")
                .description("Authentication modes for the /metrics endpoint (comma-separated): "
                        + "'local-only' (loopback bypass), 'bearer' (JWT required), 'none' (anonymous). "
                        + "Combine modes, e.g. 'local-only,bearer' for loopback bypass OR JWT.")
                .required(false)
                .defaultValue("local-only,bearer")
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_METRICS_REQUIRED_ROLES = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.metrics.required-roles")
                .displayName("Metrics Endpoint Required Roles")
                .description("Comma-separated roles required in the JWT token for the /metrics endpoint. "
                        + "Only relevant when auth-mode includes 'bearer'.")
                .required(false)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_METRICS_REQUIRED_SCOPES = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.metrics.required-scopes")
                .displayName("Metrics Endpoint Required Scopes")
                .description("Comma-separated scopes required in the JWT token for the /metrics endpoint. "
                        + "Only relevant when auth-mode includes 'bearer'.")
                .required(false)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor DISTRIBUTED_MAP_CACHE_CLIENT = new PropertyDescriptor.Builder()
                .name("rest.gateway.distributed-map-cache-client")
                .displayName("Distributed Map Cache Client")
                .description("The Controller Service providing distributed map cache for request tracking. "
                        + "Required when any route has tracking-mode other than 'none'.")
                .required(false)
                .identifiesControllerService(DistributedMapCacheClient.class)
                .build();

        public static final PropertyDescriptor MANAGEMENT_STATUS_ENABLED = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.status.enabled")
                .displayName("Status Endpoint Enabled")
                .description("Whether the /status/{traceId} management endpoint is active")
                .required(false)
                .defaultValue("true")
                .allowableValues("true", "false")
                .build();

        public static final PropertyDescriptor MANAGEMENT_STATUS_AUTH_MODE = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.status.auth-mode")
                .displayName("Status Endpoint Auth Mode")
                .description("Authentication modes for the /status endpoint (comma-separated): "
                        + "'local-only' (loopback bypass), 'bearer' (JWT required), 'none' (anonymous).")
                .required(false)
                .defaultValue("local-only,bearer")
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_STATUS_REQUIRED_ROLES = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.status.required-roles")
                .displayName("Status Endpoint Required Roles")
                .description("Comma-separated roles required in the JWT token for the /status endpoint.")
                .required(false)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_STATUS_REQUIRED_SCOPES = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.status.required-scopes")
                .displayName("Status Endpoint Required Scopes")
                .description("Comma-separated scopes required in the JWT token for the /status endpoint.")
                .required(false)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_ATTACHMENTS_ENABLED = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.attachments.enabled")
                .displayName("Attachments Endpoint Enabled")
                .description("Whether the /attachments/{parentTraceId} endpoint is active")
                .required(false)
                .defaultValue("true")
                .allowableValues("true", "false")
                .build();

        public static final PropertyDescriptor MANAGEMENT_ATTACHMENTS_AUTH_MODE = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.attachments.auth-mode")
                .displayName("Attachments Endpoint Auth Mode")
                .description("Authentication modes for the /attachments endpoint (comma-separated): "
                        + "'local-only' (loopback bypass), 'bearer' (JWT required), 'none' (anonymous).")
                .required(false)
                .defaultValue("local-only,bearer")
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_ATTACHMENTS_REQUIRED_ROLES = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.attachments.required-roles")
                .displayName("Attachments Endpoint Required Roles")
                .description("Comma-separated roles required in the JWT token for the /attachments endpoint.")
                .required(false)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_ATTACHMENTS_REQUIRED_SCOPES = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.attachments.required-scopes")
                .displayName("Attachments Endpoint Required Scopes")
                .description("Comma-separated scopes required in the JWT token for the /attachments endpoint.")
                .required(false)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_ATTACHMENTS_MAX_REQUEST_SIZE = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.attachments.max-request-size")
                .displayName("Attachments Max Request Size")
                .description("Maximum allowed request body size in bytes for attachment uploads. "
                        + "0 means use the global max request size.")
                .required(false)
                .defaultValue("0")
                .addValidator(StandardValidators.NON_NEGATIVE_INTEGER_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_ATTACHMENTS_HARD_LIMIT = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.attachments.hard-limit")
                .displayName("Attachments Hard Limit")
                .description("Global maximum number of attachments allowed per parent request. "
                        + "Routes cannot configure attachments-max-count higher than this value.")
                .required(false)
                .defaultValue("20")
                .addValidator(StandardValidators.POSITIVE_INTEGER_VALIDATOR)
                .build();

    }
}
