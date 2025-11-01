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

import de.cuioss.nifi.processors.auth.JWTProcessorConstants.Error;
import de.cuioss.nifi.processors.auth.JWTProcessorConstants.Http;
import de.cuioss.nifi.processors.auth.JWTProcessorConstants.Relationships;
import de.cuioss.nifi.processors.auth.JWTProcessorConstants.TokenLocation;
import de.cuioss.nifi.processors.auth.i18n.I18nResolver;
import de.cuioss.nifi.processors.auth.i18n.NiFiI18nResolver;
import de.cuioss.nifi.processors.auth.util.ErrorContext;
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

import java.time.Instant;
import java.util.*;

import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.Properties;

/**
 * JWTTokenAuthenticator is a NiFi processor that extracts and validates JWT tokens.
 * It extracts JWT tokens from flow files and routes them based on validation results.
 * <p>
 * Note: This is a simplified version that only extracts tokens without validation.
 * Token validation will be implemented when the cui-jwt-validation library is available.
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

    private I18nResolver i18nResolver;

    @Getter
    private List<PropertyDescriptor> supportedPropertyDescriptors;

    @Getter
    private Set<Relationship> relationships;

    @Override
    protected void init(final ProcessorInitializationContext context) {
        // Initialize i18n resolver
        i18nResolver = NiFiI18nResolver.createDefault(context.getLogger());

        final List<PropertyDescriptor> descriptors = new ArrayList<>();
        descriptors.add(Properties.TOKEN_LOCATION);
        descriptors.add(Properties.TOKEN_HEADER);
        descriptors.add(Properties.CUSTOM_HEADER_NAME);
        descriptors.add(Properties.BEARER_TOKEN_PREFIX);
        this.supportedPropertyDescriptors = descriptors;

        final Set<Relationship> rels = new HashSet<>();
        rels.add(Relationships.SUCCESS);
        rels.add(Relationships.FAILURE);
        this.relationships = rels;
    }

    @Override
    public void onTrigger(final ProcessContext context, final ProcessSession session) {
        FlowFile flowFile = session.get();
        if (flowFile == null) {
            return;
        }

        // Extract token from flow file
        String tokenLocation = context.getProperty(Properties.TOKEN_LOCATION).getValue();
        String token;

        // Extract token based on configured location
        token = switch (tokenLocation) {
            case TokenLocation.AUTHORIZATION_HEADER ->
                extractTokenFromHeader(flowFile, context.getProperty(Properties.TOKEN_HEADER).getValue());
            case TokenLocation.CUSTOM_HEADER ->
                extractTokenFromHeader(flowFile, context.getProperty(Properties.CUSTOM_HEADER_NAME).getValue());
            case TokenLocation.FLOW_FILE_CONTENT -> extractTokenFromContent(flowFile, session);
            default ->
                // Default to Authorization header
                extractTokenFromHeader(flowFile, Http.AUTHORIZATION_HEADER);
        };

        // If no token found, log warning and route to failure
        if (token == null || token.isEmpty()) {
            LOGGER.warn("No token found in the specified location: %s", tokenLocation);

            // Add error attributes
            Map<String, String> attributes = new HashMap<>();
            attributes.put(JWTAttributes.Error.CODE, Error.Code.NO_TOKEN_FOUND);
            attributes.put(JWTAttributes.Error.REASON, i18nResolver.getTranslatedString(JWTTranslationKeys.Error.NO_TOKEN_FOUND, tokenLocation));
            attributes.put(JWTAttributes.Error.CATEGORY, Error.Category.EXTRACTION_ERROR);
            flowFile = session.putAllAttributes(flowFile, attributes);

            session.transfer(flowFile, Relationships.FAILURE);
            return;
        }

        // Add token and extraction timestamp to flow file attributes
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
     * @return The extracted token, or null if not found
     */
    private String extractTokenFromHeader(FlowFile flowFile, String headerName) {
        String headerValue = flowFile.getAttribute(Http.HEADERS_PREFIX + headerName.toLowerCase());

        if (headerValue == null || headerValue.isEmpty()) {
            return null;
        }

        // If header starts with Bearer prefix, strip it
        if (headerValue.startsWith(Http.BEARER_PREFIX)) {
            return headerValue.substring(Http.BEARER_PREFIX.length()).trim();
        }

        return headerValue.trim();
    }

    /**
     * Extracts a token from the content of the flow file.
     *
     * @param flowFile The flow file containing the token
     * @param session The process session
     * @return The extracted token, or null if not found
     */
    private String extractTokenFromContent(FlowFile flowFile, ProcessSession session) {
        final StringBuilder contentBuilder = new StringBuilder();

        session.read(flowFile, inputStream -> {
            byte[] buffer = new byte[4096];
            int len;
            while ((len = inputStream.read(buffer)) != -1) {
                contentBuilder.append(new String(buffer, 0, len));
            }
        });

        String content = contentBuilder.toString().trim();
        return content.isEmpty() ? null : content;
    }
}
