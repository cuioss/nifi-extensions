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

import de.cuioss.http.security.monitoring.SecurityEventCounter;
import de.cuioss.nifi.jwt.config.ConfigurationManager;
import de.cuioss.nifi.jwt.config.JwtIssuerConfigService;
import de.cuioss.nifi.jwt.util.TokenClaimMapper;
import de.cuioss.nifi.rest.config.AuthMode;
import de.cuioss.nifi.rest.config.RouteConfiguration;
import de.cuioss.nifi.rest.config.RouteConfigurationParser;
import de.cuioss.nifi.rest.handler.*;
import de.cuioss.nifi.rest.server.JettyServerManager;
import de.cuioss.nifi.rest.validation.JsonSchemaValidator;
import de.cuioss.tools.logging.CuiLogger;
import org.apache.nifi.annotation.documentation.CapabilityDescription;
import org.apache.nifi.annotation.documentation.Tags;
import org.apache.nifi.annotation.lifecycle.OnScheduled;
import org.apache.nifi.annotation.lifecycle.OnStopped;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.flowfile.FlowFile;
import org.apache.nifi.processor.AbstractProcessor;
import org.apache.nifi.processor.ProcessContext;
import org.apache.nifi.processor.ProcessSession;
import org.apache.nifi.processor.Relationship;
import org.apache.nifi.processor.exception.ProcessException;
import org.apache.nifi.processor.util.StandardValidators;
import org.apache.nifi.ssl.SSLContextProvider;

import javax.net.ssl.SSLContext;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.stream.Collectors;

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
public class RestApiGatewayProcessor extends AbstractProcessor {

    private static final CuiLogger LOGGER = new CuiLogger(RestApiGatewayProcessor.class);

    private static final List<PropertyDescriptor> STATIC_PROPERTIES = List.of(
            RestApiGatewayConstants.Properties.LISTENING_PORT,
            RestApiGatewayConstants.Properties.LISTENING_HOST,
            RestApiGatewayConstants.Properties.JWT_ISSUER_CONFIG_SERVICE,
            RestApiGatewayConstants.Properties.SSL_CONTEXT_SERVICE,
            RestApiGatewayConstants.Properties.MAX_REQUEST_SIZE,
            RestApiGatewayConstants.Properties.REQUEST_QUEUE_SIZE,
            RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_ENABLED,
            RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_AUTH_MODE,
            RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_REQUIRED_ROLES,
            RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_REQUIRED_SCOPES,
            RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_ENABLED,
            RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_AUTH_MODE,
            RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_REQUIRED_ROLES,
            RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_REQUIRED_SCOPES);

    final JettyServerManager serverManager = new JettyServerManager();
    /** Injectable for testing — when null, a new instance is created in onScheduled. */
    ConfigurationManager configurationManager;
    /** Thread-safe queue — shared between Jetty handler threads and NiFi trigger threads. */
    private LinkedBlockingQueue<HttpRequestContainer> requestQueue;
    /** Thread-safe map — getRelationships() can be called from any NiFi framework thread. */
    private final ConcurrentHashMap<String, Relationship> dynamicRelationships = new ConcurrentHashMap<>();
    /** Maps route name → resolved outcome name (only for routes with createFlowFile=true). */
    private final ConcurrentHashMap<String, String> routeToOutcome = new ConcurrentHashMap<>();

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
        Set<Relationship> relationships = new HashSet<>(dynamicRelationships.values());
        relationships.add(RestApiGatewayConstants.Relationships.FAILURE);
        return relationships;
    }

    @OnScheduled
    public void onScheduled(ProcessContext context) {
        int queueSize = context.getProperty(RestApiGatewayConstants.Properties.REQUEST_QUEUE_SIZE).asInteger();
        requestQueue = new LinkedBlockingQueue<>(queueSize);

        // Load external config file routes first (lower priority)
        Map<String, String> allProperties = new HashMap<>();
        var configManager = (configurationManager != null) ? configurationManager : new ConfigurationManager();
        if (configManager.isConfigurationLoaded()) {
            configManager.getStaticProperties().forEach((key, value) -> {
                if (key.startsWith(RouteConfigurationParser.ROUTE_PREFIX)) {
                    allProperties.put(key, value);
                }
            });
            if (!allProperties.isEmpty()) {
                LOGGER.info(RestApiLogMessages.INFO.EXTERNAL_ROUTES_LOADED, allProperties.size());
            }
        }
        // NiFi dynamic properties override (higher priority)
        context.getProperties().forEach((key, value) -> allProperties.put(key.getName(), value));
        List<RouteConfiguration> routes = RouteConfigurationParser.parse(allProperties);

        if (routes.isEmpty()) {
            LOGGER.warn(RestApiLogMessages.WARN.INVALID_ROUTE_CONFIG, "(none)");
            return;
        }

        String routeNames = routes.stream()
                .map(RouteConfiguration::name)
                .collect(Collectors.joining(", "));
        LOGGER.info(RestApiLogMessages.INFO.ROUTES_CONFIGURED, routes.size(), routeNames);

        // Update dynamic relationships
        updateDynamicRelationships(routes);

        // Resolve services
        JwtIssuerConfigService configService = context.getProperty(
                RestApiGatewayConstants.Properties.JWT_ISSUER_CONFIG_SERVICE)
                .asControllerService(JwtIssuerConfigService.class);
        int maxRequestSize = context.getProperty(RestApiGatewayConstants.Properties.MAX_REQUEST_SIZE).asInteger();
        int port = context.getProperty(RestApiGatewayConstants.Properties.LISTENING_PORT).asInteger();

        // Build JSON Schema validator from route configurations
        JsonSchemaValidator schemaValidator = buildSchemaValidator(routes);

        // Pre-create shared event counters so all handlers + dispatcher share them
        var httpSecurityEvents = new SecurityEventCounter();
        var gatewaySecurityEvents = new GatewaySecurityEvents();

        // Build endpoint handlers: built-in management first, then user routes
        List<EndpointHandler> handlers = new ArrayList<>();

        // Health endpoint
        boolean healthEnabled = context.getProperty(
                RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_ENABLED).asBoolean();
        Set<AuthMode> healthAuthModes = AuthMode.fromValues(context.getProperty(
                RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_AUTH_MODE).getValue());
        Set<String> healthRoles = parseCommaSeparated(context.getProperty(
                RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_REQUIRED_ROLES).getValue());
        Set<String> healthScopes = parseCommaSeparated(context.getProperty(
                RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_REQUIRED_SCOPES).getValue());
        handlers.add(new HealthEndpointHandler(healthEnabled, healthAuthModes,
                healthRoles, healthScopes));

        // Metrics endpoint
        boolean metricsEnabled = context.getProperty(
                RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_ENABLED).asBoolean();
        Set<AuthMode> metricsAuthModes = AuthMode.fromValues(context.getProperty(
                RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_AUTH_MODE).getValue());
        Set<String> metricsRoles = parseCommaSeparated(context.getProperty(
                RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_REQUIRED_ROLES).getValue());
        Set<String> metricsScopes = parseCommaSeparated(context.getProperty(
                RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_REQUIRED_SCOPES).getValue());
        handlers.add(new MetricsEndpointHandler(configService, httpSecurityEvents,
                gatewaySecurityEvents, metricsEnabled, metricsAuthModes,
                metricsRoles, metricsScopes));

        // User route handlers
        for (RouteConfiguration route : routes) {
            handlers.add(new ApiRouteHandler(route, requestQueue, maxRequestSize,
                    schemaValidator, gatewaySecurityEvents));
        }

        var gatewayHandler = new GatewayRequestHandler(handlers, configService, maxRequestSize,
                httpSecurityEvents, gatewaySecurityEvents);

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

    @Override
    public void onTrigger(ProcessContext context, ProcessSession session) {
        HttpRequestContainer container = requestQueue.poll();
        if (container == null) {
            context.yield();
            return;
        }

        try {
            FlowFile flowFile = session.create();

            // Set route attributes
            Map<String, String> attributes = new HashMap<>();
            attributes.put(RestApiAttributes.ROUTE_NAME, container.routeName());
            attributes.put(RestApiAttributes.ROUTE_PATH, container.requestUri());
            attributes.put(RestApiAttributes.HTTP_METHOD, container.method());
            attributes.put(RestApiAttributes.HTTP_REQUEST_URI, container.requestUri());
            attributes.put(RestApiAttributes.HTTP_REMOTE_HOST, container.remoteHost());

            // Set content type
            if (container.contentType() != null) {
                attributes.put(RestApiAttributes.CONTENT_TYPE, container.contentType());
            }

            // Set query parameters
            container.queryParameters().forEach((key, value) ->
                    attributes.put(RestApiAttributes.QUERY_PARAM_PREFIX + key, value));

            // Map JWT claims (guard against null token for unauthenticated routes)
            if (container.token() != null) {
                attributes.putAll(TokenClaimMapper.mapToAttributes(container.token()));
            }

            // Resolve outcome relationship name
            String outcome = routeToOutcome.get(container.routeName());
            attributes.put(RestApiAttributes.ROUTE_OUTCOME, outcome);

            flowFile = session.putAllAttributes(flowFile, attributes);

            // Write body content
            if (container.body().length > 0) {
                flowFile = session.write(flowFile, out -> out.write(container.body()));
            }

            // Route to the outcome relationship (reuse pre-built instance)
            Relationship target = dynamicRelationships.get(outcome);
            if (target == null) {
                throw new ProcessException(
                        "No relationship found for route '%s' (outcome '%s') — this indicates an internal state inconsistency"
                                .formatted(container.routeName(), outcome));
            }
            session.transfer(flowFile, target);

            LOGGER.info(RestApiLogMessages.INFO.FLOWFILE_CREATED, container.routeName(), container.body().length);

        } catch (ProcessException e) {
            LOGGER.error(e, RestApiLogMessages.ERROR.FLOWFILE_CREATION_FAILED, container.routeName(), e.getMessage());
            FlowFile errorFile = session.create();
            errorFile = session.putAttribute(errorFile, "error.message", e.getMessage());
            session.transfer(errorFile, RestApiGatewayConstants.Relationships.FAILURE);
        }
    }

    @OnStopped
    public void onStopped() {
        serverManager.stop();

        int drained = 0;
        if (requestQueue != null) {
            drained = requestQueue.size();
            requestQueue.clear();
        }
        LOGGER.info(RestApiLogMessages.INFO.PROCESSOR_STOPPED, drained);
    }

    private static JsonSchemaValidator buildSchemaValidator(List<RouteConfiguration> routes) {
        Map<String, String> routeSchemas = new HashMap<>();
        for (RouteConfiguration route : routes) {
            if (route.hasSchemaValidation()) {
                routeSchemas.put(route.name(), route.schemaPath());
                LOGGER.info("Schema validation enabled for route '%s'", route.name());
            }
        }
        if (routeSchemas.isEmpty()) {
            return null;
        }
        return new JsonSchemaValidator(routeSchemas);
    }

    private static Set<String> parseCommaSeparated(String value) {
        if (value == null || value.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }

    private void updateDynamicRelationships(List<RouteConfiguration> routes) {
        dynamicRelationships.clear();
        routeToOutcome.clear();
        for (RouteConfiguration route : routes) {
            if (!route.createFlowFile()) {
                LOGGER.info("Route '%s' has createFlowFile=false — no NiFi relationship created", route.name());
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
