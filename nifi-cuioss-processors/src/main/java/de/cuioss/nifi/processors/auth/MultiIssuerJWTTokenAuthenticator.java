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
import de.cuioss.nifi.jwt.JWTTranslationKeys;
import de.cuioss.nifi.jwt.JwtConstants;
import de.cuioss.nifi.jwt.config.JwtIssuerConfigService;
import de.cuioss.nifi.jwt.i18n.I18nResolver;
import de.cuioss.nifi.jwt.i18n.NiFiI18nResolver;
import de.cuioss.nifi.jwt.util.AuthorizationRequirements;
import de.cuioss.nifi.jwt.util.AuthorizationValidator;
import de.cuioss.nifi.jwt.util.ErrorContext;
import de.cuioss.nifi.jwt.util.ProcessingError;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.sheriff.oauth.core.exception.TokenValidationException;
import de.cuioss.tools.logging.CuiLogger;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import org.apache.nifi.annotation.behavior.ReadsAttribute;
import org.apache.nifi.annotation.behavior.ReadsAttributes;
import org.apache.nifi.annotation.behavior.WritesAttribute;
import org.apache.nifi.annotation.behavior.WritesAttributes;
import org.apache.nifi.annotation.documentation.CapabilityDescription;
import org.apache.nifi.annotation.documentation.SeeAlso;
import org.apache.nifi.annotation.documentation.Tags;
import org.apache.nifi.annotation.lifecycle.OnScheduled;
import org.apache.nifi.annotation.lifecycle.OnStopped;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.flowfile.FlowFile;
import org.apache.nifi.processor.*;
import org.jspecify.annotations.Nullable;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Properties;
import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Relationships;

/**
 * NiFi processor that validates JWT tokens from multiple issuers using a shared
 * {@link JwtIssuerConfigService} Controller Service.
 * <p>
 * Extracts JWT tokens from flow files, validates them via the CS, performs authorization
 * checks, and routes flow files based on validation results.
 *
 * @see JwtIssuerConfigService
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/configuration.adoc">Configuration Specification</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/token-validation.adoc">Token Validation Specification</a>
 */
@Tags({"jwt", "oauth", "authentication", "authorization", "security", "token"})
@CapabilityDescription("Validates JWT tokens from multiple issuers using a shared JWT Issuer Config Service. " +
        "Extracts JWT tokens from flow files, validates them against configured issuers, and routes " +
        "flow files based on validation results.")
@SeeAlso()
@ReadsAttributes({
        @ReadsAttribute(attribute = "http.headers.authorization",
                description = "HTTP Authorization header containing the JWT token")
})
@WritesAttributes({
        @WritesAttribute(attribute = JWTAttributes.Content.PREFIX + "*", description = "JWT token claims"),
        @WritesAttribute(attribute = JWTAttributes.Token.VALIDATED_AT, description = "Timestamp when the token was validated"),
        @WritesAttribute(attribute = JWTAttributes.Token.PRESENT, description = "Whether a JWT token is present"),
        @WritesAttribute(attribute = JWTAttributes.Error.CODE, description = "Error code if validation failed"),
        @WritesAttribute(attribute = JWTAttributes.Error.REASON, description = "Error reason if validation failed"),
        @WritesAttribute(attribute = JWTAttributes.Error.CATEGORY, description = "Error category if validation failed")
})
@EqualsAndHashCode(callSuper = true)
public class MultiIssuerJWTTokenAuthenticator extends AbstractProcessor {

    private static final Set<String> FILTERED_CLAIM_KEYS = new TreeSet<>(Arrays.asList(
            "sub", "iss", "exp", "roles", "groups", "scope", "scopes"
    ));

    private static final CuiLogger LOGGER = new CuiLogger(MultiIssuerJWTTokenAuthenticator.class);
    private static final String COMPONENT_NAME = "MultiIssuerJWTTokenAuthenticator";
    private static final String FLOW_FILE_UUID_KEY = "flowFileUuid";

    private final AtomicLong processedFlowFilesCount = new AtomicLong();

    @Nullable private JwtIssuerConfigService jwtConfigService;
    @Nullable private AuthorizationRequirements authorizationRequirements;
    @Nullable private I18nResolver i18nResolver;

    @Getter private List<PropertyDescriptor> supportedPropertyDescriptors;
    @Getter private Set<Relationship> relationships;

    @Override
    protected void init(ProcessorInitializationContext context) {
        i18nResolver = NiFiI18nResolver.createDefault(context.getLogger());

        supportedPropertyDescriptors = List.of(
                Properties.JWT_ISSUER_CONFIG_SERVICE,
                Properties.TOKEN_LOCATION,
                Properties.TOKEN_HEADER,
                Properties.CUSTOM_HEADER_NAME,
                Properties.BEARER_TOKEN_PREFIX,
                Properties.REQUIRE_VALID_TOKEN,
                Properties.REQUIRED_ROLES,
                Properties.REQUIRED_SCOPES,
                Properties.MAXIMUM_TOKEN_SIZE
        );

        relationships = Set.of(Relationships.SUCCESS, Relationships.AUTHENTICATION_FAILED);

        LOGGER.info(AuthLogMessages.INFO.PROCESSOR_INITIALIZED);
    }

    @OnScheduled
    public void onScheduled(ProcessContext context) {
        jwtConfigService = context.getProperty(Properties.JWT_ISSUER_CONFIG_SERVICE)
                .asControllerService(JwtIssuerConfigService.class);
        authorizationRequirements = AuthorizationRequirements.from(context);
        LOGGER.info(AuthLogMessages.INFO.PROCESSOR_INITIALIZED);
    }

    @OnStopped
    public void onStopped() {
        jwtConfigService = null;
        authorizationRequirements = null;
        processedFlowFilesCount.set(0);
        LOGGER.info(AuthLogMessages.INFO.PROCESSOR_STOPPED);
    }

    @Override
    public void onTrigger(ProcessContext context, ProcessSession session) {
        FlowFile flowFile = session.get();
        if (flowFile == null) {
            return;
        }

        processedFlowFilesCount.incrementAndGet();
        if (processedFlowFilesCount.intValue() % JwtConstants.LOG_METRICS_INTERVAL == 0) {
            LOGGER.info(AuthLogMessages.INFO.TOKEN_VALIDATION_METRICS, processedFlowFilesCount);
        }

        String tokenLocation = context.getProperty(Properties.TOKEN_LOCATION).getValue();

        try {
            Optional<String> tokenOpt = extractTokenByLocation(flowFile, session, context, tokenLocation);

            if (tokenOpt.isEmpty()) {
                handleMissingToken(session, flowFile, context, tokenLocation);
                return;
            }

            String token = tokenOpt.get();
            if (!validateTokenFormat(session, flowFile, token, context)) {
                return;
            }

            processValidToken(session, flowFile, token);

        } catch (TokenValidationException e) {
            handleTokenValidationException(session, flowFile, e);
        }
    }

    private void processValidToken(ProcessSession session, FlowFile flowFile, String token)
            throws TokenValidationException {
        AccessTokenContent accessToken = jwtConfigService.validateToken(token);

        Map<String, String> attributes = extractClaims(accessToken);
        attributes.put(JWTAttributes.Token.PRESENT, "true");

        // Authorization check using processor-level properties (cached in onScheduled)
        if (authorizationRequirements.hasAuthorizationRequirements()) {
            AuthorizationValidator.AuthorizationResult authResult =
                    AuthorizationValidator.validate(accessToken, authorizationRequirements);
            if (!authResult.isAuthorized()) {
                LOGGER.warn(AuthLogMessages.WARN.AUTHORIZATION_FAILED,
                        accessToken.getSubject().orElse("unknown"),
                        accessToken.getIssuer(), authResult.getReason());
                attributes.put(JWTAttributes.Authorization.AUTHORIZED, "false");
                flowFile = session.putAllAttributes(flowFile, attributes);
                handleError(session, flowFile, "AUTH-010",
                        "Authorization failed: " + authResult.getReason(),
                        "AUTHORIZATION_FAILED");
                return;
            }
            attributes.put(JWTAttributes.Authorization.AUTHORIZED, "true");
        }

        flowFile = session.putAllAttributes(flowFile, attributes);
        session.transfer(flowFile, Relationships.SUCCESS);
    }

    // --- Token Extraction ---

    private Optional<String> extractTokenByLocation(FlowFile flowFile, ProcessSession session,
            ProcessContext context, String tokenLocation) {
        String bearerPrefix = context.getProperty(Properties.BEARER_TOKEN_PREFIX).getValue();
        int maxTokenSize = context.getProperty(Properties.MAXIMUM_TOKEN_SIZE).asInteger();
        return switch (tokenLocation) {
            case "AUTHORIZATION_HEADER" ->
                extractTokenFromHeader(flowFile, context.getProperty(Properties.TOKEN_HEADER).getValue(), bearerPrefix);
            case "CUSTOM_HEADER" ->
                extractTokenFromHeader(flowFile, context.getProperty(Properties.CUSTOM_HEADER_NAME).getValue(), bearerPrefix);
            case "FLOW_FILE_CONTENT" -> extractTokenFromContent(flowFile, session, maxTokenSize);
            default -> extractTokenFromHeader(flowFile, "Authorization", bearerPrefix);
        };
    }

    private Optional<String> extractTokenFromHeader(FlowFile flowFile, String headerName, String bearerPrefix) {
        String attributeKey = JwtConstants.Http.HEADERS_PREFIX + headerName;
        String headerValue = flowFile.getAttribute(attributeKey);

        // HTTP header names are case-insensitive per RFC 7230
        if (headerValue == null) {
            for (Map.Entry<String, String> entry : flowFile.getAttributes().entrySet()) {
                if (entry.getKey().equalsIgnoreCase(attributeKey)) {
                    headerValue = entry.getValue();
                    break;
                }
            }
        }

        if (headerValue == null || headerValue.isEmpty()) {
            return Optional.empty();
        }

        String fullPrefix = bearerPrefix + " ";
        String token;
        if (headerValue.startsWith(fullPrefix)) {
            token = headerValue.substring(fullPrefix.length()).trim();
        } else {
            token = headerValue.trim();
        }

        return token.isEmpty() ? Optional.empty() : Optional.of(token);
    }

    private Optional<String> extractTokenFromContent(FlowFile flowFile, ProcessSession session, int maxSize) {
        if (flowFile.getSize() > maxSize) {
            LOGGER.warn(AuthLogMessages.WARN.FLOW_FILE_SIZE_EXCEEDED, flowFile.getSize(), maxSize);
            return Optional.empty();
        }

        final StringBuilder contentBuilder = new StringBuilder();
        session.read(flowFile, inputStream -> {
            byte[] buffer = new byte[4096];
            int len;
            while ((len = inputStream.read(buffer)) != -1) {
                contentBuilder.append(new String(buffer, 0, len, StandardCharsets.UTF_8));
            }
        });

        String content = contentBuilder.toString().trim();
        return content.isEmpty() ? Optional.empty() : Optional.of(content);
    }

    // --- Token Format Validation ---

    private boolean validateTokenFormat(ProcessSession session, FlowFile flowFile,
            String token, ProcessContext context) {
        int maxTokenSize = context.getProperty(Properties.MAXIMUM_TOKEN_SIZE).asInteger();

        if (token.length() > maxTokenSize) {
            LOGGER.warn(AuthLogMessages.WARN.TOKEN_SIZE_EXCEEDED, maxTokenSize);
            handleError(session, flowFile, "AUTH-003",
                    i18nResolver.getTranslatedString(JWTTranslationKeys.Error.TOKEN_SIZE_LIMIT, maxTokenSize),
                    "TOKEN_SIZE_VIOLATION");
            return false;
        }

        if (!token.contains(".")) {
            LOGGER.warn(AuthLogMessages.WARN.TOKEN_MALFORMED);
            handleError(session, flowFile, "AUTH-004",
                    i18nResolver.getTranslatedString(JWTTranslationKeys.Error.TOKEN_MALFORMED),
                    "MALFORMED_TOKEN");
            return false;
        }

        return true;
    }

    // --- Missing Token Handling ---

    private void handleMissingToken(ProcessSession session, FlowFile flowFile,
            ProcessContext context, String tokenLocation) {
        boolean requireValidToken = authorizationRequirements.requireValidToken();

        if (!requireValidToken) {
            LOGGER.info(AuthLogMessages.INFO.NO_TOKEN_NOT_REQUIRED);
            Map<String, String> attributes = new HashMap<>();
            attributes.put(JWTAttributes.Error.REASON, "No token provided");
            attributes.put(JWTAttributes.Token.PRESENT, "false");
            flowFile = session.putAllAttributes(flowFile, attributes);
            session.transfer(flowFile, Relationships.SUCCESS);
        } else {
            LOGGER.warn(AuthLogMessages.WARN.NO_TOKEN_FOUND, tokenLocation);
            handleError(session, flowFile, "AUTH-001",
                    i18nResolver.getTranslatedString(JWTTranslationKeys.Error.NO_TOKEN_FOUND, tokenLocation),
                    "EXTRACTION_ERROR");
        }
    }

    // --- Error Handling ---

    private void handleTokenValidationException(ProcessSession session, FlowFile flowFile,
            TokenValidationException e) {
        LOGGER.warn(AuthLogMessages.WARN.TOKEN_VALIDATION_FAILED_MSG, e.getMessage());
        String errorMessage = i18nResolver.getTranslatedString(
                JWTTranslationKeys.Error.TOKEN_VALIDATION_FAILED, e.getMessage());
        String category = e.getCategory().name();
        String errorCode = mapValidationCategoryToErrorCode(category);
        handleError(session, flowFile, errorCode, errorMessage, category);
    }

    private String mapValidationCategoryToErrorCode(String category) {
        if (category.contains("EXPIRED")) return "AUTH-005";
        if (category.contains("SIGNATURE")) return "AUTH-006";
        if (category.contains("ISSUER")) return "AUTH-007";
        if (category.contains("AUDIENCE")) return "AUTH-008";
        return "AUTH-002";
    }

    private FlowFile handleError(ProcessSession session, FlowFile flowFile,
            String errorCode, String errorReason, String errorCategory) {
        ProcessingError error = ProcessingError.builder()
                .errorCode(errorCode)
                .errorReason(errorReason)
                .errorCategory(errorCategory)
                .build();

        Map<String, String> attributes = new HashMap<>();
        attributes.put(JWTAttributes.Error.CODE, error.getErrorCode());
        attributes.put(JWTAttributes.Error.REASON, error.getErrorReason());
        attributes.put(JWTAttributes.Error.CATEGORY, error.getErrorCategory());

        flowFile = session.putAllAttributes(flowFile, attributes);
        session.transfer(flowFile, Relationships.AUTHENTICATION_FAILED);
        return flowFile;
    }

    // --- Claim Extraction ---

    private Map<String, String> extractClaims(AccessTokenContent token) {
        Map<String, String> claims = new HashMap<>();

        claims.put(JWTAttributes.Token.VALIDATED_AT, Instant.now().toString());
        claims.put(JWTAttributes.Token.SUBJECT, token.getSubject().orElse(""));
        claims.put(JWTAttributes.Token.ISSUER, token.getIssuer());
        claims.put(JWTAttributes.Token.EXPIRATION, token.getExpirationTime().toString());

        List<String> roles = token.getRoles();
        if (!roles.isEmpty()) {
            claims.put(JWTAttributes.Authorization.ROLES, String.join(",", roles));
        }

        List<String> groups = token.getGroups();
        if (!groups.isEmpty()) {
            claims.put(JWTAttributes.Authorization.GROUPS, String.join(",", groups));
        }

        if (token.getClaims().containsKey("scope")) {
            List<String> scopes = token.getScopes();
            if (!scopes.isEmpty()) {
                claims.put(JWTAttributes.Authorization.SCOPES, String.join(",", scopes));
            }
        }

        var tokenClaims = token.getClaims();
        for (var entry : tokenClaims.entrySet()) {
            if (!FILTERED_CLAIM_KEYS.contains(entry.getKey())) {
                claims.put(JWTAttributes.Content.PREFIX + entry.getKey(), entry.getValue().getOriginalString());
            }
        }

        return claims;
    }
}
