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
import de.cuioss.nifi.jwt.i18n.I18nResolver;
import de.cuioss.nifi.jwt.i18n.NiFiI18nResolver;
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
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.flowfile.FlowFile;
import org.apache.nifi.processor.*;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Properties;
import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Relationships;

/**
 * JWTTokenAuthenticator is a NiFi processor that extracts and validates JWT tokens.
 * It extracts JWT tokens from flow files and routes them based on validation results.
 * <p>
 * Note: This is a simplified version that only extracts tokens without validation.
 * Token validation is implemented using the OAuth-Sheriff library.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/technical-components.adoc">Technical Components Specification</a>
 */
@Tags({"jwt", "oauth", "authentication", "authorization", "security", "token"})
@CapabilityDescription("Extracts JWT tokens from flow files and routes them based on validation results.")
@SeeAlso()
@ReadsAttributes({
        @ReadsAttribute(attribute = "http.headers.authorization", description = "HTTP Authorization header containing the JWT token")
})
@WritesAttributes({
        @WritesAttribute(attribute = JWTAttributes.Token.VALUE, description = "The extracted JWT token"),
        @WritesAttribute(attribute = JWTAttributes.Token.EXTRACTED_AT, description = "Timestamp when the token was extracted"),
        @WritesAttribute(attribute = JWTAttributes.Error.REASON, description = "Error reason if token extraction failed")
})
@EqualsAndHashCode(callSuper = true)
public class JWTTokenAuthenticator extends AbstractProcessor {

    private static final CuiLogger LOGGER = new CuiLogger(JWTTokenAuthenticator.class);

    private static final int DEFAULT_MAX_CONTENT_SIZE = 16384;

    private I18nResolver i18nResolver;

    @Getter private List<PropertyDescriptor> supportedPropertyDescriptors;

    @Getter private Set<Relationship> relationships;

    @Override
    protected void init(final ProcessorInitializationContext context) {
        // Initialize i18n resolver
        i18nResolver = NiFiI18nResolver.createDefault(context.getLogger());

        supportedPropertyDescriptors = List.of(
                Properties.TOKEN_LOCATION,
                Properties.TOKEN_HEADER,
                Properties.CUSTOM_HEADER_NAME,
                Properties.BEARER_TOKEN_PREFIX
        );

        relationships = Set.of(Relationships.SUCCESS, Relationships.FAILURE);
    }

    @Override
    public void onTrigger(final ProcessContext context, final ProcessSession session) {
        FlowFile flowFile = session.get();
        if (flowFile == null) {
            return;
        }

        // Extract token from flow file
        String tokenLocation = context.getProperty(Properties.TOKEN_LOCATION).getValue();
        String bearerPrefix = context.getProperty(Properties.BEARER_TOKEN_PREFIX).getValue();

        // Extract token based on configured location
        Optional<String> tokenOpt = switch (tokenLocation) {
            case "AUTHORIZATION_HEADER" ->
                extractTokenFromHeader(flowFile, context.getProperty(Properties.TOKEN_HEADER).getValue(), bearerPrefix);
            case "CUSTOM_HEADER" ->
                extractTokenFromHeader(flowFile, context.getProperty(Properties.CUSTOM_HEADER_NAME).getValue(), bearerPrefix);
            case "FLOW_FILE_CONTENT" -> extractTokenFromContent(flowFile, session);
            default ->
                extractTokenFromHeader(flowFile, JwtConstants.Http.AUTHORIZATION_HEADER, bearerPrefix);
        };

        // If no token found, log warning and route to failure
        if (tokenOpt.isEmpty()) {
            LOGGER.warn(AuthLogMessages.WARN.NO_TOKEN_FOUND, tokenLocation);

            // Add error attributes
            Map<String, String> attributes = new HashMap<>();
            attributes.put(JWTAttributes.Error.CODE, JwtConstants.Error.Code.NO_TOKEN_FOUND);
            attributes.put(JWTAttributes.Error.REASON, i18nResolver.getTranslatedString(JWTTranslationKeys.Error.NO_TOKEN_FOUND, tokenLocation));
            attributes.put(JWTAttributes.Error.CATEGORY, JwtConstants.Error.Category.EXTRACTION_ERROR);
            flowFile = session.putAllAttributes(flowFile, attributes);

            session.transfer(flowFile, Relationships.FAILURE);
            return;
        }

        // Add token and extraction timestamp to flow file attributes
        String token = tokenOpt.get();
        Map<String, String> attributes = new HashMap<>();
        attributes.put(JWTAttributes.Token.VALUE, token);
        attributes.put(JWTAttributes.Token.EXTRACTED_AT, Instant.now().toString());
        flowFile = session.putAllAttributes(flowFile, attributes);

        // Transfer to success relationship
        session.transfer(flowFile, Relationships.SUCCESS);
    }

    /**
     * Extracts a token from a header in the flow file.
     *
     * @param flowFile The flow file containing the header
     * @param headerName The name of the header containing the token
     * @param bearerPrefix The configured bearer prefix (e.g. "Bearer")
     * @return The extracted token, or empty if not found
     */
    private Optional<String> extractTokenFromHeader(FlowFile flowFile, String headerName, String bearerPrefix) {
        // Try exact match first (e.g., "http.headers.Authorization")
        String attributeKey = JwtConstants.Http.HEADERS_PREFIX + headerName;
        String headerValue = flowFile.getAttribute(attributeKey);

        // HTTP header names are case-insensitive per RFC 7230 — try case-insensitive match
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

        // If header starts with configured prefix, strip it
        String fullPrefix = bearerPrefix + " ";
        String token;
        if (headerValue.startsWith(fullPrefix)) {
            token = headerValue.substring(fullPrefix.length()).trim();
        } else {
            token = headerValue.trim();
        }

        return token.isEmpty() ? Optional.empty() : Optional.of(token);
    }

    /**
     * Extracts a token from the content of the flow file.
     *
     * @param flowFile The flow file containing the token
     * @param session The process session
     * @return The extracted token, or empty if content is empty or exceeds size limit
     */
    private Optional<String> extractTokenFromContent(FlowFile flowFile, ProcessSession session) {
        if (flowFile.getSize() > DEFAULT_MAX_CONTENT_SIZE) {
            LOGGER.warn(AuthLogMessages.WARN.FLOW_FILE_SIZE_EXCEEDED,
                    flowFile.getSize(), DEFAULT_MAX_CONTENT_SIZE);
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
}
