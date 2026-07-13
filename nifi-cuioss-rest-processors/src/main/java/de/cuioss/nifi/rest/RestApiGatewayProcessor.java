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

import de.cuioss.http.forwarded.ForwardedResolverConfig;
import de.cuioss.http.security.monitoring.SecurityEventCounter;
import de.cuioss.nifi.jwt.config.ConfigurationManager;
import de.cuioss.nifi.jwt.config.JwtIssuerConfigService;
import de.cuioss.nifi.jwt.util.ForwardedRequestResolver;
import de.cuioss.nifi.jwt.util.TokenClaimMapper;
import de.cuioss.nifi.rest.config.AuthMode;
import de.cuioss.nifi.rest.config.RouteConfiguration;
import de.cuioss.nifi.rest.config.RouteConfigurationParser;
import de.cuioss.nifi.rest.config.TrackingMode;
import de.cuioss.nifi.rest.handler.*;
import de.cuioss.nifi.rest.server.JettyServerManager;
import de.cuioss.nifi.rest.validation.JsonSchemaValidator;
import de.cuioss.tools.logging.CuiLogger;
import org.apache.nifi.annotation.documentation.CapabilityDescription;
import org.apache.nifi.annotation.documentation.Tags;
import org.apache.nifi.annotation.lifecycle.OnScheduled;
import org.apache.nifi.annotation.lifecycle.OnStopped;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.components.ValidationContext;
import org.apache.nifi.components.ValidationResult;
import org.apache.nifi.distributed.cache.client.DistributedMapCacheClient;
import org.apache.nifi.flowfile.FlowFile;
import org.apache.nifi.processor.AbstractProcessor;
import org.apache.nifi.processor.ProcessContext;
import org.apache.nifi.processor.ProcessSession;
import org.apache.nifi.processor.Relationship;
import org.apache.nifi.processor.exception.FlowFileAccessException;
import org.apache.nifi.processor.exception.ProcessException;
import org.apache.nifi.processor.util.StandardValidators;
import org.apache.nifi.ssl.SSLContextProvider;

import javax.net.ssl.SSLContext;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

import static de.cuioss.nifi.jwt.util.AuthorizationRequirements.parseCommaSeparated;

/**
 * Multi-route REST API gateway with embedded HTTP server, JWT authentication,
 * per-route authorization, and request body validation.
 * <p>
 * Routes are configured via {@code restapi.<route-name>.<property>} dynamic properties.
 * Each route produces a named NiFi relationship. HTTP responses are sent synchronously
 * in the Jetty handler thread, then a FlowFile is enqueued for {@code onTrigger()} to emit.
 */
@Tags({"rest", "api", "gateway", "jwt", "authentication", "authorization"})
@CapabilityDescription("Multi-route REST API gateway with embedded HTTP server, "
        + "JWT authentication via JwtIssuerConfigService, per-route authorization "
        + "(roles and scopes), and configurable request body size limits. "
        + "Routes are configured via restapi.<name>.<property> dynamic properties.")
@SuppressWarnings("java:S2160") // NiFi processors are framework-managed singletons; equality is identity-based
public class RestApiGatewayProcessor extends AbstractProcessor {

    private static final CuiLogger LOGGER = new CuiLogger(RestApiGatewayProcessor.class);

    private static final List<PropertyDescriptor> STATIC_PROPERTIES = List.of(
            RestApiGatewayConstants.Properties.LISTENING_PORT,
            RestApiGatewayConstants.Properties.LISTENING_HOST,
            RestApiGatewayConstants.Properties.JWT_ISSUER_CONFIG_SERVICE,
            RestApiGatewayConstants.Properties.SSL_CONTEXT_SERVICE,
            RestApiGatewayConstants.Properties.MAX_REQUEST_SIZE,
            RestApiGatewayConstants.Properties.REQUEST_QUEUE_SIZE,
            RestApiGatewayConstants.Properties.DISTRIBUTED_MAP_CACHE_CLIENT,
            RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_ENABLED,
            RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_AUTH_MODE,
            RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_REQUIRED_ROLES,
            RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_REQUIRED_SCOPES,
            RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_ENABLED,
            RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_AUTH_MODE,
            RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_REQUIRED_ROLES,
            RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_REQUIRED_SCOPES,
            RestApiGatewayConstants.Properties.MANAGEMENT_STATUS_ENABLED,
            RestApiGatewayConstants.Properties.MANAGEMENT_STATUS_AUTH_MODE,
            RestApiGatewayConstants.Properties.MANAGEMENT_STATUS_REQUIRED_ROLES,
            RestApiGatewayConstants.Properties.MANAGEMENT_STATUS_REQUIRED_SCOPES,
            RestApiGatewayConstants.Properties.MANAGEMENT_ATTACHMENTS_ENABLED,
            RestApiGatewayConstants.Properties.MANAGEMENT_ATTACHMENTS_AUTH_MODE,
            RestApiGatewayConstants.Properties.MANAGEMENT_ATTACHMENTS_REQUIRED_ROLES,
            RestApiGatewayConstants.Properties.MANAGEMENT_ATTACHMENTS_REQUIRED_SCOPES,
            RestApiGatewayConstants.Properties.MANAGEMENT_ATTACHMENTS_MAX_REQUEST_SIZE,
            RestApiGatewayConstants.Properties.MANAGEMENT_ATTACHMENTS_HARD_LIMIT,
            RestApiGatewayConstants.Properties.PROXY_CONTEXT_PATH_WHITELIST,
            RestApiGatewayConstants.Properties.PROXY_CONTEXT_PATH_TRUST_ALL,
            RestApiGatewayConstants.Properties.PROXY_TRUSTED_PROXIES,
            RestApiGatewayConstants.Properties.PROXY_SECURITY_CONFIG_PRESET);

    final JettyServerManager serverManager = new JettyServerManager();
    /** Injectable for testing — when null, a new instance is created in onScheduled. */
    ConfigurationManager configurationManager;
    /**
     * Thread-safe queue — shared between Jetty handler threads and NiFi trigger threads.
     * Declared {@code volatile} so the {@code @OnScheduled} assignment safely publishes the queue
     * reference to the concurrent onTrigger reads (the queue's own operations are already
     * thread-safe; {@code volatile} covers publication of the reference itself).
     */
    // S3077: the referenced queue is already thread-safe; volatile only safely publishes the
    // reference on @OnScheduled reassignment, which is the intended and sufficient guarantee.
    @SuppressWarnings("java:S3077")
    private volatile LinkedBlockingQueue<HttpRequestContainer> requestQueue;
    /** Thread-safe map — getRelationships() can be called from any NiFi framework thread. */
    private final ConcurrentHashMap<String, Relationship> dynamicRelationships = new ConcurrentHashMap<>();
    /** Maps route name → resolved outcome name (only for routes with createFlowFile=true). */
    private final ConcurrentHashMap<String, String> routeToOutcome = new ConcurrentHashMap<>();
    /** Maps route name → attachments timeout (only for ATTACHMENTS tracking mode). */
    private final ConcurrentHashMap<String, String> routeToAttachmentsTimeout = new ConcurrentHashMap<>();
    /** Maps route name → attachments min count (only for ATTACHMENTS tracking mode). */
    private final ConcurrentHashMap<String, Integer> routeToAttachmentsMinCount = new ConcurrentHashMap<>();
    /** Guards lazy loading of external config relationships before @OnScheduled. */
    private final AtomicBoolean externalRelationshipsLoaded = new AtomicBoolean(false);

    /**
     * Request-tracking store, resolved in {@code onScheduled} when a Distributed Map Cache Client is
     * configured (otherwise {@code null}). Held as a field so {@code onStopped} can evict the tracking
     * entries of queued-but-discarded containers (M5). {@code volatile} safely publishes the reference
     * between the @OnScheduled writer thread and the @OnStopped reader thread.
     */
    // S3077: volatile only safely publishes the reference between the @OnScheduled writer and the
    // @OnStopped reader; the store itself is thread-safe, so a thread-safe container adds nothing.
    @SuppressWarnings("java:S3077")
    private volatile RequestStatusStore trackingStore;

    /**
     * Gateway application-level security events; shared with the Jetty handlers, read in onTrigger.
     * Held in an {@link AtomicReference} (a thread-safe type) so the @OnScheduled publish and the
     * onTrigger read of the reference are safely visible across NiFi framework threads.
     */
    final AtomicReference<GatewaySecurityEvents> gatewaySecurityEvents = new AtomicReference<>();
    /** Transport-level (cui-http) security events; shared with the Jetty handlers, read in onTrigger. */
    final AtomicReference<SecurityEventCounter> httpSecurityEvents = new AtomicReference<>();
    /** Config service supplying the token-sheriff token-validation counter; resolved in onScheduled. */
    final AtomicReference<JwtIssuerConfigService> configService = new AtomicReference<>();
    /**
     * Last-published cumulative count per counter name. onTrigger publishes the delta
     * (current cumulative count − last-published count) as a NiFi counter so the native
     * counters stay cumulative-correct without double-counting across triggers.
     */
    private final ConcurrentHashMap<String, Long> lastPublishedCounts = new ConcurrentHashMap<>();

    @Override
    protected List<PropertyDescriptor> getSupportedPropertyDescriptors() {
        return STATIC_PROPERTIES;
    }

    @Override
    protected PropertyDescriptor getSupportedDynamicPropertyDescriptor(String propertyDescriptorName) {
        if (propertyDescriptorName != null && propertyDescriptorName.startsWith(RouteConfigurationParser.ROUTE_PREFIX)) {
            return new PropertyDescriptor.Builder()
                    .name(propertyDescriptorName)
                    .dynamic(true)
                    .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
                    .build();
        }
        return null;
    }

    @Override
    public Set<Relationship> getRelationships() {
        if (!externalRelationshipsLoaded.get() && dynamicRelationships.isEmpty()) {
            loadExternalConfigRelationships();
        }
        // I14: the ATTACHMENTS relationship is advertised only when attachment tracking is actually
        // configured — onScheduled adds it to dynamicRelationships when a cache client is present.
        // Advertising it unconditionally forced users of a non-tracking gateway to terminate a dead
        // relationship. FAILURE is always present.
        Set<Relationship> relationships = new HashSet<>(dynamicRelationships.values());
        relationships.add(RestApiGatewayConstants.Relationships.FAILURE);
        return relationships;
    }

    /**
     * M4: enforces the "Distributed Map Cache Client required when tracking ≠ none" contract. Without
     * a cache client a route with {@code tracking-mode=simple|attachments} silently degrades (bare
     * 202/200 without traceId/Location/_links, and the /status + /attachments endpoints are never
     * registered). Surfacing it as an invalid-processor state prevents that silent functional
     * downgrade.
     */
    @Override
    protected Collection<ValidationResult> customValidate(ValidationContext validationContext) {
        Map<String, String> properties = new HashMap<>();
        validationContext.getProperties().forEach((descriptor, value) -> {
            if (value != null) {
                properties.put(descriptor.getName(), value);
            }
        });
        boolean anyTracked = RouteConfigurationParser.parse(properties).stream()
                .anyMatch(RouteConfiguration::isTracked);
        boolean cacheClientSet = validationContext.getProperty(
                RestApiGatewayConstants.Properties.DISTRIBUTED_MAP_CACHE_CLIENT).isSet();
        if (anyTracked && !cacheClientSet) {
            return List.of(new ValidationResult.Builder()
                    .subject(RestApiGatewayConstants.Properties.DISTRIBUTED_MAP_CACHE_CLIENT.getDisplayName())
                    .valid(false)
                    .explanation("A Distributed Map Cache Client is required when any route has "
                            + "tracking-mode other than 'none'. Configure the '"
                            + RestApiGatewayConstants.Properties.DISTRIBUTED_MAP_CACHE_CLIENT.getDisplayName()
                            + "' property, or set every route to tracking-mode=none.")
                    .build());
        }
        return List.of();
    }

    private void loadExternalConfigRelationships() {
        if (!externalRelationshipsLoaded.compareAndSet(false, true)) {
            return;
        }
        Map<String, String> routeProps = getExternalRouteProperties();
        if (!routeProps.isEmpty()) {
            List<RouteConfiguration> routes = RouteConfigurationParser.parse(routeProps);
            updateDynamicRelationships(routes);
        }
    }

    private Map<String, String> getExternalRouteProperties() {
        var configManager = (configurationManager != null) ? configurationManager : new ConfigurationManager();
        if (!configManager.isConfigurationLoaded()) {
            return Map.of();
        }
        Map<String, String> routeProps = new HashMap<>();
        configManager.getStaticProperties().forEach((key, value) -> {
            if (key.startsWith(RouteConfigurationParser.ROUTE_PREFIX)) {
                routeProps.put(key, value);
            }
        });
        return routeProps;
    }

    @OnScheduled
    public void onScheduled(ProcessContext context) {
        int queueSize = context.getProperty(RestApiGatewayConstants.Properties.REQUEST_QUEUE_SIZE).asInteger();
        requestQueue = new LinkedBlockingQueue<>(queueSize);

        // Load external config file routes first (lower priority)
        Map<String, String> allProperties = new HashMap<>(getExternalRouteProperties());
        if (!allProperties.isEmpty()) {
            LOGGER.info(RestApiLogMessages.INFO.EXTERNAL_ROUTES_LOADED, allProperties.size());
        }
        // NiFi dynamic properties override (higher priority)
        context.getProperties().forEach((key, value) -> allProperties.put(key.getName(), value));
        List<RouteConfiguration> routes = RouteConfigurationParser.parse(allProperties);

        if (routes.isEmpty()) {
            LOGGER.warn(RestApiLogMessages.WARN.INVALID_ROUTE_CONFIG, "(none)");
            // Clear relationships from a previous schedule so stale routes do not survive;
            // the embedded server (incl. management endpoints) is intentionally not started.
            updateDynamicRelationships(List.of());
            return;
        }

        String routeNames = routes.stream()
                .map(RouteConfiguration::name)
                .collect(Collectors.joining(", "));
        LOGGER.info(RestApiLogMessages.INFO.ROUTES_CONFIGURED, routes.size(), routeNames);

        // Update dynamic relationships
        updateDynamicRelationships(routes);
        externalRelationshipsLoaded.set(true);

        // Resolve services
        JwtIssuerConfigService configService = context.getProperty(
                RestApiGatewayConstants.Properties.JWT_ISSUER_CONFIG_SERVICE)
                .asControllerService(JwtIssuerConfigService.class);
        this.configService.set(configService);
        int maxRequestSize = context.getProperty(RestApiGatewayConstants.Properties.MAX_REQUEST_SIZE).asInteger();
        int port = context.getProperty(RestApiGatewayConstants.Properties.LISTENING_PORT).asInteger();

        // Build JSON Schema validator from route configurations (absent when no route uses one)
        JsonSchemaValidator schemaValidator = buildSchemaValidator(routes).orElse(null);

        // Pre-create shared event counters so all handlers + dispatcher share them.
        // Held as fields so onTrigger can bridge their cumulative counts to NiFi counters.
        var httpSecurityEvents = new SecurityEventCounter();
        var gatewaySecurityEvents = new GatewaySecurityEvents();
        this.httpSecurityEvents.set(httpSecurityEvents);
        this.gatewaySecurityEvents.set(gatewaySecurityEvents);
        // Reset the per-instance delta baseline on each (re)schedule so a restart
        // republishes from the freshly-zeroed counters without spurious deltas.
        lastPublishedCounts.clear();

        // Resolve optional DistributedMapCacheClient for request tracking
        DistributedMapCacheClient cacheClient = context.getProperty(
                RestApiGatewayConstants.Properties.DISTRIBUTED_MAP_CACHE_CLIENT)
                .asControllerService(DistributedMapCacheClient.class);
        RequestStatusStore statusStore = (cacheClient != null) ? new RequestStatusStore(cacheClient) : null;
        this.trackingStore = statusStore;

        // Build endpoint handlers: built-in management first, then user routes
        List<EndpointHandler> handlers = new ArrayList<>(List.of(
                createHealthHandler(context),
                createMetricsHandler(context, configService, httpSecurityEvents, gatewaySecurityEvents)));
        if (statusStore != null) {
            handlers.add(createStatusHandler(context, statusStore));
        }

        // Startup validation: validate attachment bounds against hard limit
        int hardLimit = context.getProperty(
                RestApiGatewayConstants.Properties.MANAGEMENT_ATTACHMENTS_HARD_LIMIT).asInteger();
        validateAndRegisterAttachmentRoutes(routes, hardLimit);

        // Attachments endpoint (only if cache client is available)
        if (statusStore != null) {
            handlers.add(createAttachmentsHandler(context, statusStore, gatewaySecurityEvents));
            routeToOutcome.put(AttachmentsEndpointHandler.ATTACHMENTS_ROUTE_NAME, "attachments");
            dynamicRelationships.put("attachments", RestApiGatewayConstants.Relationships.ATTACHMENTS);
        }

        // User route handlers — pass the attachments hard limit so ApiRouteHandler can resolve the
        // C1 fallback (attachments-max-count = 0 ⇒ hard limit) at registration time.
        for (RouteConfiguration route : routes) {
            handlers.add(new ApiRouteHandler(route, requestQueue, maxRequestSize,
                    schemaValidator, gatewaySecurityEvents, statusStore, hardLimit));
        }

        // Build the configured forwarded-header resolver from the full proxy config surface
        // (secure by default: with no opt-in nothing is honored, so a direct client on the
        // 0.0.0.0 listener cannot spoof any forwarded value).
        Set<String> allowedContextPaths = ForwardedResolverConfig.parseAllowlist(
                context.getProperty(RestApiGatewayConstants.Properties.PROXY_CONTEXT_PATH_WHITELIST).getValue());
        boolean trustAllProxyContextPaths = context.getProperty(
                RestApiGatewayConstants.Properties.PROXY_CONTEXT_PATH_TRUST_ALL).asBoolean();
        Set<String> trustedProxies = parseTrustedProxies(context.getProperty(
                RestApiGatewayConstants.Properties.PROXY_TRUSTED_PROXIES).getValue());
        String securityConfigPreset = context.getProperty(
                RestApiGatewayConstants.Properties.PROXY_SECURITY_CONFIG_PRESET).getValue();
        ForwardedRequestResolver forwardedResolver = ForwardedRequestResolver.create(
                trustAllProxyContextPaths, allowedContextPaths, trustedProxies, securityConfigPreset,
                httpSecurityEvents);
        LOGGER.info(RestApiLogMessages.INFO.PROXY_WHITELIST_CONFIGURED,
                trustAllProxyContextPaths ? "(trust-all — any proxy context path honored)"
                        : allowedContextPaths.isEmpty() ? "(none — proxy headers ignored)" : allowedContextPaths);
        LOGGER.info(RestApiLogMessages.INFO.PROXY_FORWARDED_CONFIGURED,
                trustedProxies.isEmpty() ? "(none — forwarded client IP ignored)" : trustedProxies,
                securityConfigPreset);

        boolean contextPathHonoringConfigured = trustAllProxyContextPaths || !allowedContextPaths.isEmpty();
        var gatewayHandler = new GatewayRequestHandler(handlers, configService, maxRequestSize,
                httpSecurityEvents, gatewaySecurityEvents, forwardedResolver, contextPathHonoringConfigured);

        // Resolve optional SSL context for HTTPS
        SSLContextProvider sslProvider = context.getProperty(
                RestApiGatewayConstants.Properties.SSL_CONTEXT_SERVICE)
                .asControllerService(SSLContextProvider.class);
        SSLContext sslContext = (sslProvider != null) ? sslProvider.createContext() : null;

        // Resolve optional listening host
        String host = context.getProperty(RestApiGatewayConstants.Properties.LISTENING_HOST).getValue();

        serverManager.start(port, host, gatewayHandler, sslContext);

        LOGGER.info(RestApiLogMessages.INFO.PROCESSOR_INITIALIZED);
    }

    /**
     * Parses the comma-separated trusted-proxies property into a set of trimmed, non-blank
     * IP / CIDR specs. A {@code null} or blank value yields an empty set (secure default: no
     * forwarded client IP is honored). Malformed specs are rejected downstream by
     * {@link ForwardedRequestResolver#create} when the resolver config is built.
     *
     * @param commaSeparated the raw property value (may be {@code null})
     * @return the parsed trusted-proxy specs, empty when none are configured
     */
    private static Set<String> parseTrustedProxies(String commaSeparated) {
        if (commaSeparated == null || commaSeparated.isBlank()) {
            return Set.of();
        }
        Set<String> trustedProxies = new LinkedHashSet<>();
        for (String entry : commaSeparated.split(",")) {
            String trimmed = entry.strip();
            if (!trimmed.isEmpty()) {
                trustedProxies.add(trimmed);
            }
        }
        return trustedProxies;
    }

    private StatusEndpointHandler createStatusHandler(ProcessContext context,
            RequestStatusStore statusStore) {
        return new StatusEndpointHandler(statusStore,
                context.getProperty(RestApiGatewayConstants.Properties.MANAGEMENT_STATUS_ENABLED).asBoolean(),
                AuthMode.fromValues(context.getProperty(RestApiGatewayConstants.Properties.MANAGEMENT_STATUS_AUTH_MODE).getValue()),
                parseCommaSeparated(context.getProperty(RestApiGatewayConstants.Properties.MANAGEMENT_STATUS_REQUIRED_ROLES).getValue()),
                parseCommaSeparated(context.getProperty(RestApiGatewayConstants.Properties.MANAGEMENT_STATUS_REQUIRED_SCOPES).getValue()));
    }

    private void validateAndRegisterAttachmentRoutes(List<RouteConfiguration> routes, int hardLimit) {
        for (RouteConfiguration route : routes) {
            if (route.trackingMode() != TrackingMode.ATTACHMENTS) {
                continue;
            }
            int effectiveMax = route.attachmentsMaxCount() > 0 ? route.attachmentsMaxCount() : hardLimit;
            if (route.attachmentsMaxCount() > hardLimit) {
                throw new ProcessException(
                        "Route '%s' has attachments-max-count=%d exceeding hard limit=%d"
                                .formatted(route.name(), route.attachmentsMaxCount(), hardLimit));
            }
            LOGGER.info(RestApiLogMessages.INFO.ROUTE_ATTACHMENTS_BOUNDS,
                    route.name(), route.attachmentsMinCount(), route.attachmentsMaxCount(),
                    effectiveMax, hardLimit);
            if (route.attachmentsTimeout() != null) {
                routeToAttachmentsTimeout.put(route.name(), route.attachmentsTimeout());
            }
            if (route.attachmentsMinCount() > 0) {
                routeToAttachmentsMinCount.put(route.name(), route.attachmentsMinCount());
            }
        }
    }

    private AttachmentsEndpointHandler createAttachmentsHandler(ProcessContext context,
            RequestStatusStore statusStore, GatewaySecurityEvents gatewaySecurityEvents) {
        var config = AttachmentsEndpointHandler.Config.builder()
                .statusStore(statusStore)
                .queue(requestQueue)
                .maxRequestSize(context.getProperty(
                        RestApiGatewayConstants.Properties.MANAGEMENT_ATTACHMENTS_MAX_REQUEST_SIZE).asInteger())
                .enabled(context.getProperty(
                        RestApiGatewayConstants.Properties.MANAGEMENT_ATTACHMENTS_ENABLED).asBoolean())
                .authModes(AuthMode.fromValues(context.getProperty(
                        RestApiGatewayConstants.Properties.MANAGEMENT_ATTACHMENTS_AUTH_MODE).getValue()))
                .requiredRoles(parseCommaSeparated(context.getProperty(
                        RestApiGatewayConstants.Properties.MANAGEMENT_ATTACHMENTS_REQUIRED_ROLES).getValue()))
                .requiredScopes(parseCommaSeparated(context.getProperty(
                        RestApiGatewayConstants.Properties.MANAGEMENT_ATTACHMENTS_REQUIRED_SCOPES).getValue()))
                .gatewaySecurityEvents(gatewaySecurityEvents)
                .build();
        return new AttachmentsEndpointHandler(config);
    }

    private HealthEndpointHandler createHealthHandler(ProcessContext context) {
        return new HealthEndpointHandler(
                context.getProperty(RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_ENABLED).asBoolean(),
                AuthMode.fromValues(context.getProperty(RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_AUTH_MODE).getValue()),
                parseCommaSeparated(context.getProperty(RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_REQUIRED_ROLES).getValue()),
                parseCommaSeparated(context.getProperty(RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_REQUIRED_SCOPES).getValue()));
    }

    private MetricsEndpointHandler createMetricsHandler(ProcessContext context,
            JwtIssuerConfigService configService,
            SecurityEventCounter httpSecurityEvents,
            GatewaySecurityEvents gatewaySecurityEvents) {
        return new MetricsEndpointHandler(configService, httpSecurityEvents, gatewaySecurityEvents,
                context.getProperty(RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_ENABLED).asBoolean(),
                AuthMode.fromValues(context.getProperty(RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_AUTH_MODE).getValue()),
                parseCommaSeparated(context.getProperty(RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_REQUIRED_ROLES).getValue()),
                parseCommaSeparated(context.getProperty(RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_REQUIRED_SCOPES).getValue()));
    }

    @Override
    public void onTrigger(ProcessContext context, ProcessSession session) {
        // Bridge gateway metric counts to NiFi-native counters before any early return,
        // so idle ticks (no queued request) still flush newly-accumulated event deltas.
        publishCounterDeltas(session);

        HttpRequestContainer container = requestQueue.poll();
        if (container == null) {
            context.yield();
            return;
        }

        FlowFile flowFile = null;
        try {
            // Resolve the outcome relationship up front: a missing outcome throws a ProcessException
            // HERE (routed to `failure` by the catch below) instead of NPE-ing later when a null
            // outcome would be written into a FlowFile attribute — keeping the failure-relationship
            // transfer reachable for the case it guards.
            String outcome = routeToOutcome.get(container.routeName());
            if (outcome == null) {
                throw new ProcessException(
                        "No outcome relationship resolved for route '%s' — internal state inconsistency"
                                .formatted(container.routeName()));
            }

            flowFile = session.create();

            // Set route attributes
            Map<String, String> attributes = new HashMap<>(Map.of(
                    RestApiAttributes.ROUTE_NAME, container.routeName(),
                    RestApiAttributes.HTTP_METHOD, container.method(),
                    RestApiAttributes.HTTP_REQUEST_URI, container.requestUri(),
                    RestApiAttributes.HTTP_REMOTE_HOST, container.remoteHost()));

            // Set content type
            if (container.contentType() != null) {
                attributes.put(RestApiAttributes.CONTENT_TYPE, container.contentType());
            }

            // Set query parameters
            container.queryParameters().forEach((key, value) ->
                    attributes.put(RestApiAttributes.QUERY_PARAM_PREFIX + key, value));

            // Set sanitized request headers (Authorization is excluded upstream);
            // header names are lowercased for deterministic attribute keys.
            // Null values are skipped — FlowFile attributes reject null.
            container.headers().forEach((name, value) -> {
                if (value != null) {
                    attributes.put(RestApiAttributes.HEADER_PREFIX + name.toLowerCase(Locale.ROOT), value);
                }
            });

            // Set path parameters extracted from a pattern-matched route
            container.pathParameters().forEach((key, value) ->
                    attributes.put(RestApiAttributes.PATH_PARAM_PREFIX + key, value));

            // Set trace ID attributes for request tracking
            if (container.traceId() != null) {
                attributes.put(RestApiAttributes.TRACE_ID, container.traceId());
                attributes.put(RestApiAttributes.TRACE_ACCEPTED_AT, Instant.now().toString());
            }
            if (container.parentTraceId() != null) {
                attributes.put(RestApiAttributes.PARENT_TRACE_ID, container.parentTraceId());
            }

            // Set attachment attributes for Wait processor Expression Language
            String attachmentsTimeout = routeToAttachmentsTimeout.get(container.routeName());
            if (attachmentsTimeout != null) {
                attributes.put(RestApiAttributes.TRACE_ATTACHMENTS_TIMEOUT, attachmentsTimeout);
            }
            Integer attachmentsMinCount = routeToAttachmentsMinCount.get(container.routeName());
            if (attachmentsMinCount != null) {
                attributes.put(RestApiAttributes.TRACE_ATTACHMENTS_MIN_COUNT, String.valueOf(attachmentsMinCount));
            }

            // Map JWT claims (guard against null token for unauthenticated routes)
            var token = container.token();
            if (token != null) {
                attributes.putAll(TokenClaimMapper.mapToAttributes(token));
            }

            attributes.put(RestApiAttributes.ROUTE_OUTCOME, outcome);

            flowFile = session.putAllAttributes(flowFile, attributes);

            // Write body content
            if (container.body().length > 0) {
                flowFile = session.write(flowFile, out -> out.write(container.body()));
            }

            // Record provenance RECEIVE event for traceability
            session.getProvenanceReporter().receive(flowFile, container.requestUri());

            // Route to the outcome relationship (reuse pre-built instance)
            Relationship target = dynamicRelationships.get(outcome);
            if (target == null) {
                throw new ProcessException(
                        "No relationship found for route '%s' (outcome '%s') — this indicates an internal state inconsistency"
                                .formatted(container.routeName(), outcome));
            }
            session.transfer(flowFile, target);

            LOGGER.info(RestApiLogMessages.INFO.FLOWFILE_CREATED, container.routeName(), container.body().length);

        } catch (ProcessException | FlowFileAccessException e) {
            // FlowFileAccessException (thrown by session.write on an I/O failure) does NOT extend
            // ProcessException, so it must be caught explicitly — otherwise it would escape and the
            // FlowFile would be left neither transferred nor removed, and the failure transfer below
            // would be unreachable.
            LOGGER.error(e, RestApiLogMessages.ERROR.FLOWFILE_CREATION_FAILED, container.routeName(), e.getMessage());
            // Remove the partially-built FlowFile: leaving it neither transferred nor removed
            // makes the session commit throw FlowFileHandlingException, which would roll back
            // the error FlowFile too and the failure relationship would never receive anything.
            if (flowFile != null) {
                session.remove(flowFile);
            }
            FlowFile errorFile = session.create();
            errorFile = session.putAttribute(errorFile, "error.message", e.getMessage());
            session.transfer(errorFile, RestApiGatewayConstants.Relationships.FAILURE);
        }
    }

    /**
     * Bridges the gateway's three internal event sources to NiFi-native counters.
     * <p>
     * For each event the current cumulative count is compared against the
     * last-published value in {@link #lastPublishedCounts}; only the positive delta
     * is forwarded to {@link ProcessSession#adjustCounter} so the native counter
     * accumulates the same cumulative total without double-counting across triggers.
     * The counter names follow {@link RestApiGatewayConstants.Counters}, which is the
     * stable contract surfaced on NiFi's {@code /nifi-api/counters} and
     * {@code /nifi-api/flow/metrics/prometheus} endpoints.
     */
    void publishCounterDeltas(ProcessSession session) {
        GatewaySecurityEvents gatewayEvents = this.gatewaySecurityEvents.get();
        if (gatewayEvents != null) {
            gatewayEvents.getAllCounts().forEach((eventType, count) ->
                    publishDelta(session,
                            RestApiGatewayConstants.Counters.counterName(
                                    RestApiGatewayConstants.Counters.GATEWAY_EVENT_PREFIX, eventType.name()),
                            count));
        }

        SecurityEventCounter httpEvents = this.httpSecurityEvents.get();
        if (httpEvents != null) {
            httpEvents.getAllCounts().forEach((failureType, count) ->
                    publishDelta(session,
                            RestApiGatewayConstants.Counters.counterName(
                                    RestApiGatewayConstants.Counters.HTTP_SECURITY_PREFIX, failureType.name()),
                            count));
        }

        JwtIssuerConfigService service = this.configService.get();
        if (service != null) {
            service.getSecurityEventCounter().ifPresent(tokenCounter ->
                    tokenCounter.getCounters().forEach((eventType, count) ->
                            publishDelta(session,
                                    RestApiGatewayConstants.Counters.counterName(
                                            RestApiGatewayConstants.Counters.TOKEN_VALIDATION_PREFIX, eventType.name()),
                                    count)));
        }
    }

    private void publishDelta(ProcessSession session, String counterName, long count) {
        // RestApiGatewayProcessor is not @TriggerSerially, so concurrent onTrigger threads may
        // call publishDelta for the same counter at once. A plain get/compute/put would let two
        // threads read the same baseline and both publish the same delta (double-counting).
        // ConcurrentHashMap.compute is atomic per key: the baseline read, delta capture, and new
        // baseline write happen under the bin lock, so the delta for each (current - previous)
        // transition is captured exactly once. The holder carries the delta out of the lambda.
        long[] deltaHolder = new long[1];
        lastPublishedCounts.compute(counterName, (key, previous) -> {
            long prior = (previous == null) ? 0L : previous;
            // Re-baseline on a rollback/reset of the cumulative source counter: a decrease must
            // never publish a negative adjustCounter. The new (lower) value becomes the baseline
            // so the next genuine increase publishes the correct forward delta.
            long delta = (count > prior) ? (count - prior) : 0L;
            deltaHolder[0] = delta;
            return count;
        });
        long delta = deltaHolder[0];
        if (delta > 0) {
            // immediate=true writes through to the FlowController counter repository at once,
            // so the counter persists even on the idle early-return path (where the session is
            // yielded, not committed) and surfaces on NiFi's /nifi-api/counters and
            // /nifi-api/flow/metrics/prometheus endpoints independent of session lifecycle.
            session.adjustCounter(counterName, delta, true);
        }
    }

    @OnStopped
    public void onStopped() {
        serverManager.stop();

        int drained = 0;
        if (requestQueue != null) {
            List<HttpRequestContainer> pending = new ArrayList<>();
            requestQueue.drainTo(pending);
            drained = pending.size();
            removeTrackedEntries(pending);
        }
        LOGGER.info(RestApiLogMessages.INFO.PROCESSOR_STOPPED, drained);
    }

    /**
     * M5: on shutdown the queued containers are discarded without ever producing a FlowFile, yet
     * their clients already received a 202 + traceId. Evict their non-terminal tracking entries so
     * they do not remain ACCEPTED/COLLECTING_ATTACHMENTS in the distributed cache forever.
     */
    private void removeTrackedEntries(List<HttpRequestContainer> pending) {
        RequestStatusStore store = this.trackingStore;
        if (store == null) {
            return;
        }
        for (HttpRequestContainer container : pending) {
            String traceId = container.traceId();
            if (traceId != null) {
                try {
                    store.remove(traceId);
                } catch (IOException e) {
                    LOGGER.warn(RestApiLogMessages.WARN.STATUS_STORE_ERROR, e.getMessage());
                }
            }
        }
    }

    private static Optional<JsonSchemaValidator> buildSchemaValidator(List<RouteConfiguration> routes) {
        Map<String, String> routeSchemas = new HashMap<>();
        for (RouteConfiguration route : routes) {
            if (route.hasSchemaValidation()) {
                routeSchemas.put(route.name(), route.schemaPath());
                LOGGER.info(RestApiLogMessages.INFO.SCHEMA_VALIDATION_ENABLED, route.name());
            }
        }
        if (routeSchemas.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new JsonSchemaValidator(routeSchemas));
    }

    private void updateDynamicRelationships(List<RouteConfiguration> routes) {
        dynamicRelationships.clear();
        routeToOutcome.clear();
        routeToAttachmentsTimeout.clear();
        routeToAttachmentsMinCount.clear();
        for (RouteConfiguration route : routes) {
            if (!route.createFlowFile()) {
                LOGGER.info(RestApiLogMessages.INFO.ROUTE_NO_RELATIONSHIP, route.name());
                continue;
            }
            String outcome = route.successOutcome();
            routeToOutcome.put(route.name(), outcome);
            dynamicRelationships.computeIfAbsent(outcome, k ->
                    new Relationship.Builder()
                            .name(k)
                            .description("Requests matching outcome '%s'".formatted(k))
                            .build());
        }
    }
}
