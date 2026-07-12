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

import java.util.Locale;

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
        private static final String DEFAULT_AUTH_MODE = "local-only,bearer";
        private static final String BEARER_RELEVANCE_DESC = "Only relevant when auth-mode includes 'bearer'.";
        private static final String FALSE_VALUE = "false";
        private static final String PROXY_PRESET_STRICT = "strict";
        private static final String PROXY_PRESET_LENIENT = "lenient";
        private static final String PROXY_PRESET_DEFAULTS = "defaults";

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
                .allowableValues("true", FALSE_VALUE)
                .build();

        public static final PropertyDescriptor MANAGEMENT_HEALTH_AUTH_MODE = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.health.auth-mode")
                .displayName("Health Endpoint Auth Mode")
                .description("Authentication modes for the /health endpoint (comma-separated): "
                        + "'local-only' (loopback bypass), 'bearer' (JWT required), 'none' (anonymous). "
                        + "Combine modes, e.g. 'local-only,bearer' for loopback bypass OR JWT.")
                .required(false)
                .defaultValue(DEFAULT_AUTH_MODE)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_HEALTH_REQUIRED_ROLES = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.health.required-roles")
                .displayName("Health Endpoint Required Roles")
                .description("Comma-separated roles required in the JWT token for the /health endpoint. "
                        + BEARER_RELEVANCE_DESC)
                .required(false)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_HEALTH_REQUIRED_SCOPES = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.health.required-scopes")
                .displayName("Health Endpoint Required Scopes")
                .description("Comma-separated scopes required in the JWT token for the /health endpoint. "
                        + BEARER_RELEVANCE_DESC)
                .required(false)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_METRICS_ENABLED = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.metrics.enabled")
                .displayName("Metrics Endpoint Enabled")
                .description("Whether the /metrics management endpoint is active")
                .required(false)
                .defaultValue("true")
                .allowableValues("true", FALSE_VALUE)
                .build();

        public static final PropertyDescriptor MANAGEMENT_METRICS_AUTH_MODE = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.metrics.auth-mode")
                .displayName("Metrics Endpoint Auth Mode")
                .description("Authentication modes for the /metrics endpoint (comma-separated): "
                        + "'local-only' (loopback bypass), 'bearer' (JWT required), 'none' (anonymous). "
                        + "Combine modes, e.g. 'local-only,bearer' for loopback bypass OR JWT.")
                .required(false)
                .defaultValue(DEFAULT_AUTH_MODE)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_METRICS_REQUIRED_ROLES = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.metrics.required-roles")
                .displayName("Metrics Endpoint Required Roles")
                .description("Comma-separated roles required in the JWT token for the /metrics endpoint. "
                        + BEARER_RELEVANCE_DESC)
                .required(false)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor MANAGEMENT_METRICS_REQUIRED_SCOPES = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.metrics.required-scopes")
                .displayName("Metrics Endpoint Required Scopes")
                .description("Comma-separated scopes required in the JWT token for the /metrics endpoint. "
                        + BEARER_RELEVANCE_DESC)
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
                .allowableValues("true", FALSE_VALUE)
                .build();

        public static final PropertyDescriptor MANAGEMENT_STATUS_AUTH_MODE = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.status.auth-mode")
                .displayName("Status Endpoint Auth Mode")
                .description("Authentication modes for the /status endpoint (comma-separated): "
                        + "'local-only' (loopback bypass), 'bearer' (JWT required), 'none' (anonymous).")
                .required(false)
                .defaultValue(DEFAULT_AUTH_MODE)
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
                .allowableValues("true", FALSE_VALUE)
                .build();

        public static final PropertyDescriptor MANAGEMENT_ATTACHMENTS_AUTH_MODE = new PropertyDescriptor.Builder()
                .name("rest.gateway.management.attachments.auth-mode")
                .displayName("Attachments Endpoint Auth Mode")
                .description("Authentication modes for the /attachments endpoint (comma-separated): "
                        + "'local-only' (loopback bypass), 'bearer' (JWT required), 'none' (anonymous).")
                .required(false)
                .defaultValue(DEFAULT_AUTH_MODE)
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

        public static final PropertyDescriptor PROXY_CONTEXT_PATH_WHITELIST = new PropertyDescriptor.Builder()
                .name("rest.gateway.proxy.context-path.whitelist")
                .displayName("Proxy Context Path Whitelist")
                .description("Comma-separated allowlist of reverse-proxy context paths honored from the "
                        + "X-ProxyContextPath / X-Forwarded-Prefix headers (e.g. '/nifi-proxy'). When empty "
                        + "(the default) the gateway ignores client-supplied proxy context-path headers and "
                        + "does NOT trust them — routing and generated URLs use the raw request path. Only "
                        + "prefixes listed here are honored for inbound route matching and for the context "
                        + "prefix prepended to the 202 Location header and HATEOAS _links. Mirrors NiFi's "
                        + "nifi.web.proxy.context.path allowlist; configure it only when the gateway sits "
                        + "behind a reverse proxy that sets these headers.")
                .required(false)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor PROXY_CONTEXT_PATH_TRUST_ALL = new PropertyDescriptor.Builder()
                .name("rest.gateway.proxy.context-path.trust-all")
                .displayName("Proxy Context Path Trust All")
                .description("When true, the gateway honors ANY reverse-proxy context path supplied in the "
                        + "X-ProxyContextPath / X-Forwarded-Prefix headers WITHOUT checking the allowlist (the "
                        + "value is still normalized and injection-guarded). Enable this ONLY when the gateway is "
                        + "exclusively reachable through a trusted reverse proxy that sets these headers — a "
                        + "directly-reachable listener (0.0.0.0) with trust-all enabled lets any client spoof the "
                        + "context path. When false (the default) the allowlist in "
                        + "'rest.gateway.proxy.context-path.whitelist' governs which context paths are honored. "
                        + "Secure default: false.")
                .required(false)
                .allowableValues("true", FALSE_VALUE)
                .defaultValue(FALSE_VALUE)
                .build();

        public static final PropertyDescriptor PROXY_TRUSTED_PROXIES = new PropertyDescriptor.Builder()
                .name("rest.gateway.proxy.trusted-proxies")
                .displayName("Proxy Trusted Proxies")
                .description("Comma-separated allowlist of trusted reverse-proxy hops as IP literals or CIDR "
                        + "ranges (e.g. '10.0.0.0/8, 192.168.1.5'). Required to honor the forwarded client IP "
                        + "from the X-Forwarded-For / Forwarded headers for audit and rate-limit logging: the "
                        + "chain is walked right-to-left, skipping these trusted hops, and the first untrusted "
                        + "address is used as the client IP. When empty (the default) NO forwarded client IP is "
                        + "honored and the raw socket remote address is used. Enable this ONLY when the gateway "
                        + "is exclusively reachable through the listed proxies — a directly-reachable listener "
                        + "lets any client forge the X-Forwarded-For chain. Secure default: empty.")
                .required(false)
                .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                .build();

        public static final PropertyDescriptor PROXY_SECURITY_CONFIG_PRESET = new PropertyDescriptor.Builder()
                .name("rest.gateway.proxy.security-config.preset")
                .displayName("Proxy Security Config Preset")
                .description("Security posture for the forwarded-header sanitization pipeline: 'strict' "
                        + "(tightest restrictions), 'lenient' (maximum compatibility, trusted environments only), "
                        + "or 'defaults' (balanced). Governs how X-Forwarded-* / Forwarded header values are "
                        + "sanitized before they are honored. Default: defaults.")
                .required(false)
                .allowableValues(PROXY_PRESET_STRICT, PROXY_PRESET_LENIENT, PROXY_PRESET_DEFAULTS)
                .defaultValue(PROXY_PRESET_DEFAULTS)
                .build();

    }

    /**
     * Stable counter-name convention for the NiFi-native counters bridged from the
     * gateway's internal event sources in {@code onTrigger} via
     * {@code session.adjustCounter}.
     * <p>
     * Each gateway event source maps to a dedicated dotted prefix; the per-event
     * name is the prefix followed by the lower-cased event identifier. These names
     * are the contract consumed by external monitoring: they surface verbatim as
     * the {@code counter_name} label of the {@code nifi_processor_counters} metric
     * family on {@code /nifi-api/flow/metrics/prometheus} and as the counter name in
     * {@code /nifi-api/counters}. The names MUST remain stable — documentation
     * (doc/reference/metrics-api.adoc) and integration tests assert them directly.
     */
    @UtilityClass
    public static final class Counters {
        /**
         * Prefix for application-level gateway security events
         * ({@code GatewaySecurityEvents.EventType}). Full name example:
         * {@code gateway.events.missing_bearer_token}.
         */
        public static final String GATEWAY_EVENT_PREFIX = "gateway.events.";

        /**
         * Prefix for token-validation events (token-sheriff
         * {@code SecurityEventCounter}). Full name example:
         * {@code gateway.token.valid_tokens}.
         */
        public static final String TOKEN_VALIDATION_PREFIX = "gateway.token.";

        /**
         * Prefix for transport-level HTTP security events (cui-http
         * {@code SecurityEventCounter}). Full name example:
         * {@code gateway.http.security.path_traversal}.
         */
        public static final String HTTP_SECURITY_PREFIX = "gateway.http.security.";

        /**
         * Builds the stable counter name for a source prefix and an event
         * identifier, lower-casing the identifier so the name matches the
         * Prometheus label casing used elsewhere.
         *
         * @param prefix one of the {@code *_PREFIX} constants in this class
         * @param eventName the raw event identifier (enum name)
         * @return the fully-qualified, lower-cased counter name
         */
        public static String counterName(String prefix, String eventName) {
            return prefix + eventName.toLowerCase(Locale.ROOT);
        }
    }
}
