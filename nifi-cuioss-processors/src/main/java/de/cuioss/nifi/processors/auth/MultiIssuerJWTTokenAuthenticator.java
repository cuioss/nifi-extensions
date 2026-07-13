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

import de.cuioss.nifi.jwt.JwtAttributes;
import de.cuioss.nifi.jwt.JwtConstants;
import de.cuioss.nifi.jwt.JwtTranslationKeys;
import de.cuioss.nifi.jwt.config.JwtIssuerConfigService;
import de.cuioss.nifi.jwt.i18n.I18nResolver;
import de.cuioss.nifi.jwt.i18n.NiFiI18nResolver;
import de.cuioss.nifi.jwt.util.AuthorizationRequirements;
import de.cuioss.nifi.jwt.util.AuthorizationValidator;
import de.cuioss.nifi.jwt.util.ProcessingError;
import de.cuioss.nifi.jwt.util.TokenClaimMapper;
import de.cuioss.sheriff.token.validation.domain.token.AccessTokenContent;
import de.cuioss.sheriff.token.validation.exception.TokenValidationException;
import de.cuioss.tools.logging.CuiLogger;
import lombok.Getter;
import org.apache.nifi.annotation.behavior.ReadsAttribute;
import org.apache.nifi.annotation.behavior.ReadsAttributes;
import org.apache.nifi.annotation.behavior.WritesAttribute;
import org.apache.nifi.annotation.behavior.WritesAttributes;
import org.apache.nifi.annotation.documentation.CapabilityDescription;
import org.apache.nifi.annotation.documentation.Tags;
import org.apache.nifi.annotation.lifecycle.OnScheduled;
import org.apache.nifi.annotation.lifecycle.OnStopped;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.flowfile.FlowFile;
import org.apache.nifi.processor.*;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import static de.cuioss.nifi.processors.auth.JwtProcessorConstants.Properties;
import static de.cuioss.nifi.processors.auth.JwtProcessorConstants.Relationships;

/**
 * NiFi processor that validates JWT tokens from multiple issuers using a shared
 * {@link JwtIssuerConfigService} Controller Service.
 * <p>
 * Reads the raw JWT token from a configurable FlowFile attribute (default: {@code jwt.token}),
 * validates it via the CS, performs authorization checks, and routes flow files based on
 * validation results.
 *
 * @see JwtIssuerConfigService
 */
// NotNullFieldNotInitialized: i18nResolver is initialized in init(); the remaining fields are
// initialized in onScheduled. The NiFi lifecycle guarantees onTrigger runs only after onScheduled,
// so the fields are always set before use; onStopped resets the processed-file counter but
// intentionally leaves the fields in place so a subsequent onScheduled restart can reinitialize them.
// S2160: NiFi processors use identity equality (component identifier) inherited from
// AbstractProcessor; the added fields are transient runtime state, not part of identity, so
// overriding equals/hashCode would be incorrect for the NiFi lifecycle contract.
@SuppressWarnings({"NotNullFieldNotInitialized", "java:S2160"})
@Tags({"jwt", "oauth", "authentication", "authorization", "security", "token"})
@CapabilityDescription("Validates JWT tokens from multiple issuers using a shared JWT Issuer Config Service. " +
        "Reads a raw JWT token from a configurable FlowFile attribute, validates it against configured issuers, " +
        "and routes flow files based on validation results.")
@ReadsAttributes({
        @ReadsAttribute(attribute = "jwt.token",
                description = "FlowFile attribute containing the raw JWT token (configurable via Token Attribute property)")
})
@WritesAttributes({
        @WritesAttribute(attribute = JwtAttributes.Content.PREFIX + "*", description = "JWT token claims"),
        @WritesAttribute(attribute = JwtAttributes.Token.VALIDATED_AT, description = "Timestamp when the token was validated"),
        @WritesAttribute(attribute = JwtAttributes.Token.PRESENT, description = "Whether a JWT token is present"),
        @WritesAttribute(attribute = JwtAttributes.Error.CODE, description = "Error code if validation failed"),
        @WritesAttribute(attribute = JwtAttributes.Error.REASON, description = "Error reason if validation failed"),
        @WritesAttribute(attribute = JwtAttributes.Error.CATEGORY, description = "Error category if validation failed")
})
public class MultiIssuerJWTTokenAuthenticator extends AbstractProcessor {

    private static final CuiLogger LOGGER = new CuiLogger(MultiIssuerJWTTokenAuthenticator.class);

    private final AtomicLong processedFlowFilesCount = new AtomicLong();

    private JwtIssuerConfigService jwtConfigService;
    private AuthorizationRequirements authorizationRequirements;
    private I18nResolver i18nResolver;
    private String tokenAttributeName;

    @Getter private List<PropertyDescriptor> supportedPropertyDescriptors;
    @Getter private Set<Relationship> relationships;

    @Override
    protected void init(ProcessorInitializationContext context) {
        i18nResolver = NiFiI18nResolver.createDefault(context.getLogger());

        supportedPropertyDescriptors = List.of(
                Properties.JWT_ISSUER_CONFIG_SERVICE,
                Properties.TOKEN_ATTRIBUTE,
                Properties.REQUIRE_VALID_TOKEN,
                Properties.REQUIRED_ROLES,
                Properties.REQUIRED_SCOPES
        );

        relationships = Set.of(Relationships.SUCCESS, Relationships.AUTHENTICATION_FAILED);

        LOGGER.info(AuthLogMessages.INFO.PROCESSOR_INITIALIZED);
    }

    @OnScheduled
    public void onScheduled(ProcessContext context) {
        jwtConfigService = context.getProperty(Properties.JWT_ISSUER_CONFIG_SERVICE)
                .asControllerService(JwtIssuerConfigService.class);
        authorizationRequirements = AuthorizationRequirements.from(context);
        tokenAttributeName = context.getProperty(Properties.TOKEN_ATTRIBUTE).getValue();
    }

    @OnStopped
    public void onStopped() {
        processedFlowFilesCount.set(0);
        LOGGER.info(AuthLogMessages.INFO.PROCESSOR_STOPPED);
    }

    @Override
    public void onTrigger(ProcessContext context, ProcessSession session) {
        FlowFile flowFile = session.get();
        if (flowFile == null) {
            return;
        }

        // Use the returned count so concurrent tasks cannot skip or duplicate the interval log
        long processedCount = processedFlowFilesCount.incrementAndGet();
        if (processedCount % JwtConstants.LOG_METRICS_INTERVAL == 0) {
            LOGGER.info(AuthLogMessages.INFO.TOKEN_VALIDATION_METRICS, processedCount);
        }

        try {
            String token = flowFile.getAttribute(tokenAttributeName);

            if (token == null || token.isBlank()) {
                handleMissingToken(session, flowFile);
                return;
            }

            if (!validateTokenFormat(session, flowFile, token)) {
                return;
            }

            processValidToken(session, flowFile, token);

        } catch (TokenValidationException e) {
            handleTokenValidationException(session, flowFile, e);
        } catch (IllegalStateException e) {
            // Controller service not enabled (yet) — a transient administrative state, not a
            // token problem. Yield and roll back so the FlowFile stays queued and is retried
            // once the service becomes available.
            LOGGER.warn(AuthLogMessages.WARN.TOKEN_VALIDATION_FAILED_MSG, e.getMessage());
            context.yield();
            session.rollback();
        }
    }

    private void processValidToken(ProcessSession session, FlowFile flowFile, String token)
            throws TokenValidationException {
        AccessTokenContent accessToken = jwtConfigService.validateToken(token);

        Map<String, String> attributes = TokenClaimMapper.mapToAttributes(accessToken);
        attributes.put(JwtAttributes.Token.PRESENT, "true");

        if (authorizationRequirements.hasAuthorizationRequirements()) {
            AuthorizationValidator.AuthorizationResult authResult =
                    AuthorizationValidator.validate(accessToken, authorizationRequirements);
            if (!authResult.authorized()) {
                //noinspection DataFlowIssue
                LOGGER.warn(AuthLogMessages.WARN.AUTHORIZATION_FAILED,
                        accessToken.getSubject().orElse("unknown"),
                        accessToken.getIssuer(), authResult.reason());
                attributes.put(JwtAttributes.Authorization.AUTHORIZED, "false");
                flowFile = session.putAllAttributes(flowFile, attributes);
                handleError(session, flowFile, "AUTH-010",
                        "Authorization failed: " + authResult.reason(),
                        "AUTHORIZATION_FAILED");
                return;
            }
            attributes.put(JwtAttributes.Authorization.AUTHORIZED, "true");
        }

        flowFile = session.putAllAttributes(flowFile, attributes);
        session.transfer(flowFile, Relationships.SUCCESS);
    }

    // --- Token Format Validation ---

    private boolean validateTokenFormat(ProcessSession session, FlowFile flowFile, String token) {
        int maxTokenSize = jwtConfigService.getAuthenticationConfig().maxTokenSize();

        // Enforce the limit in actual UTF-8 bytes so the check agrees with the "bytes" message
        // and configuration semantics (String.length() would count UTF-16 code units instead).
        int tokenByteSize = token.getBytes(StandardCharsets.UTF_8).length;
        if (tokenByteSize > maxTokenSize) {
            LOGGER.warn(AuthLogMessages.WARN.TOKEN_SIZE_EXCEEDED, maxTokenSize);
            // Pass the byte count as a String so the MessageFormat-based resolver inserts it
            // verbatim ("16384") rather than applying locale-dependent number grouping
            // ("16,384" / "16.384"), which would make the "{0} bytes" message locale-fragile.
            handleError(session, flowFile, "AUTH-003",
                    i18nResolver.getTranslatedString(JwtTranslationKeys.Error.TOKEN_SIZE_LIMIT,
                            String.valueOf(maxTokenSize)),
                    "TOKEN_SIZE_VIOLATION");
            return false;
        }

        return true;
    }

    // --- Missing Token Handling ---

    private void handleMissingToken(ProcessSession session, FlowFile flowFile) {
        boolean requireValidToken = authorizationRequirements.requireValidToken();

        if (!requireValidToken) {
            LOGGER.info(AuthLogMessages.INFO.NO_TOKEN_NOT_REQUIRED);
            // Route to success without an error attribute: a missing token is an accepted outcome
            // here, not an error, so jwt.error.reason must not be set on the success FlowFile.
            Map<String, String> attributes = new HashMap<>();
            attributes.put(JwtAttributes.Token.PRESENT, "false");
            flowFile = session.putAllAttributes(flowFile, attributes);
            session.transfer(flowFile, Relationships.SUCCESS);
        } else {
            LOGGER.warn(AuthLogMessages.WARN.NO_TOKEN_FOUND, tokenAttributeName);
            handleError(session, flowFile, "AUTH-001",
                    i18nResolver.getTranslatedString(JwtTranslationKeys.Error.NO_TOKEN_FOUND, tokenAttributeName),
                    "EXTRACTION_ERROR");
        }
    }

    // --- Error Handling ---

    private void handleTokenValidationException(ProcessSession session, FlowFile flowFile,
            TokenValidationException e) {
        LOGGER.warn(AuthLogMessages.WARN.TOKEN_VALIDATION_FAILED_MSG, e.getMessage());
        String errorMessage = i18nResolver.getTranslatedString(
                JwtTranslationKeys.Error.TOKEN_VALIDATION_FAILED, e.getMessage());
        // Map the specific event type (e.g. TOKEN_EXPIRED, ISSUER_MISMATCH,
        // AUDIENCE_MISMATCH) to a fine-grained AUTH-xxx code. getEventType() — not
        // getCategory() — is the correct source: getCategory() returns the coarse
        // EventCategory (INVALID_STRUCTURE / INVALID_SIGNATURE / SEMANTIC_ISSUES),
        // whose names never contain "EXPIRED", "ISSUER", or "AUDIENCE", so those
        // codes would silently collapse to the AUTH-002 default. The coarse category
        // is still surfaced verbatim as the error.category attribute.
        String errorCode = mapEventTypeToErrorCode(e.getEventType().name());
        handleError(session, flowFile, errorCode, errorMessage, e.getCategory().name());
    }

    private String mapEventTypeToErrorCode(String eventType) {
        if (eventType.contains("EXPIRED")) {
            return "AUTH-005";
        }
        if (eventType.contains("SIGNATURE")) {
            return "AUTH-006";
        }
        if (eventType.contains("ISSUER")) {
            return "AUTH-007";
        }
        if (eventType.contains("AUDIENCE")) {
            return "AUTH-008";
        }
        return "AUTH-002";
    }

    private void handleError(ProcessSession session, FlowFile flowFile,
            String errorCode, String errorReason, String errorCategory) {
        ProcessingError error = ProcessingError.builder()
                .errorCode(errorCode)
                .errorReason(errorReason)
                .errorCategory(errorCategory)
                .build();

        Map<String, String> attributes = new HashMap<>();
        attributes.put(JwtAttributes.Error.CODE, error.errorCode());
        attributes.put(JwtAttributes.Error.REASON, error.errorReason());
        attributes.put(JwtAttributes.Error.CATEGORY, error.errorCategory());

        flowFile = session.putAllAttributes(flowFile, attributes);
        session.transfer(flowFile, Relationships.AUTHENTICATION_FAILED);
    }

}
