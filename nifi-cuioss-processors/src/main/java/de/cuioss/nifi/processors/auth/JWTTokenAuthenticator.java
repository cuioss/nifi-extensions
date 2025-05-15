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

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;


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
import org.apache.nifi.processor.AbstractProcessor;
import org.apache.nifi.processor.ProcessContext;
import org.apache.nifi.processor.ProcessSession;
import org.apache.nifi.processor.ProcessorInitializationContext;
import org.apache.nifi.processor.Relationship;
import org.apache.nifi.processor.util.StandardValidators;

import de.cuioss.tools.logging.CuiLogger;

/**
 * JWTTokenAuthenticator is a NiFi processor that extracts and validates JWT tokens.
 * It extracts JWT tokens from flow files and routes them based on validation results.
 * 
 * Note: This is a simplified version that only extracts tokens without validation.
 * Token validation will be implemented when the cui-jwt-validation library is available.
 */
@Tags({"jwt", "oauth", "authentication", "authorization", "security", "token"})
@CapabilityDescription("Extracts JWT tokens from flow files and routes them based on validation results.")
@SeeAlso({})
@ReadsAttributes({
        @ReadsAttribute(attribute = "http.headers.authorization", description = "HTTP Authorization header containing the JWT token")
})
@WritesAttributes({
        @WritesAttribute(attribute = JWTAttributes.TOKEN.VALUE, description = "The extracted JWT token"),
        @WritesAttribute(attribute = JWTAttributes.TOKEN.EXTRACTED_AT, description = "Timestamp when the token was extracted"),
        @WritesAttribute(attribute = JWTAttributes.ERROR.REASON, description = "Error reason if token extraction failed")
})
public class JWTTokenAuthenticator extends AbstractProcessor {

    private static final CuiLogger LOGGER = new CuiLogger(JWTTokenAuthenticator.class);

    // Relationships
    public static final Relationship SUCCESS = new Relationship.Builder()
            .name("success")
            .description("FlowFiles with extracted tokens will be routed to this relationship")
            .build();

    public static final Relationship FAILURE = new Relationship.Builder()
            .name("failure")
            .description("FlowFiles with extraction failures will be routed to this relationship")
            .build();

    // Property Descriptors
    public static final PropertyDescriptor TOKEN_LOCATION = new PropertyDescriptor.Builder()
            .name(JWTAttributes.PROPERTIES.TOKEN.LOCATION)
            .displayName("Token Location")
            .description("Defines where to extract the token from")
            .required(true)
            .allowableValues("AUTHORIZATION_HEADER", "CUSTOM_HEADER", "FLOW_FILE_CONTENT")
            .defaultValue("AUTHORIZATION_HEADER")
            .build();

    public static final PropertyDescriptor TOKEN_HEADER = new PropertyDescriptor.Builder()
            .name(JWTAttributes.PROPERTIES.TOKEN.HEADER)
            .displayName("Token Header")
            .description("The header name containing the token when using AUTHORIZATION_HEADER")
            .required(false)
            .defaultValue("Authorization")
            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
            .build();

    public static final PropertyDescriptor CUSTOM_HEADER_NAME = new PropertyDescriptor.Builder()
            .name(JWTAttributes.PROPERTIES.TOKEN.CUSTOM_HEADER_NAME)
            .displayName("Custom Header Name")
            .description("The custom header name when using CUSTOM_HEADER")
            .required(false)
            .defaultValue("X-Authorization")
            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
            .build();

    public static final PropertyDescriptor BEARER_TOKEN_PREFIX = new PropertyDescriptor.Builder()
            .name(JWTAttributes.PROPERTIES.TOKEN.BEARER_PREFIX)
            .displayName("Bearer Token Prefix")
            .description("The prefix to strip from the token (e.g., \"Bearer \")")
            .required(false)
            .defaultValue("Bearer")
            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
            .build();

    @Getter
    private List<PropertyDescriptor> supportedPropertyDescriptors;

    @Getter
    private Set<Relationship> relationships;

    @Override
    protected void init(final ProcessorInitializationContext context) {
        final List<PropertyDescriptor> descriptors = new ArrayList<>();
        descriptors.add(TOKEN_LOCATION);
        descriptors.add(TOKEN_HEADER);
        descriptors.add(CUSTOM_HEADER_NAME);
        descriptors.add(BEARER_TOKEN_PREFIX);
        this.supportedPropertyDescriptors = descriptors;

        final Set<Relationship> relationships = new HashSet<>();
        relationships.add(SUCCESS);
        relationships.add(FAILURE);
        this.relationships = relationships;
    }

    @Override
    public void onTrigger(final ProcessContext context, final ProcessSession session) {
        FlowFile flowFile = session.get();
        if (flowFile == null) {
            return;
        }

        // Extract token from flow file
        String tokenLocation = context.getProperty(TOKEN_LOCATION).getValue();
        String token = null;

        try {
            // Extract token based on configured location
            switch (tokenLocation) {
                case "AUTHORIZATION_HEADER":
                    token = extractTokenFromHeader(flowFile, context.getProperty(TOKEN_HEADER).getValue());
                    break;
                case "CUSTOM_HEADER":
                    token = extractTokenFromHeader(flowFile, context.getProperty(CUSTOM_HEADER_NAME).getValue());
                    break;
                case "FLOW_FILE_CONTENT":
                    token = extractTokenFromContent(flowFile, session);
                    break;
                default:
                    // Default to Authorization header
                    token = extractTokenFromHeader(flowFile, "Authorization");
            }

            // If no token found, log warning and route to failure
            if (token == null || token.isEmpty()) {
                LOGGER.warn("No token found in the specified location: %s", tokenLocation);

                // Add error attributes
                Map<String, String> attributes = new HashMap<>();
                attributes.put(JWTAttributes.ERROR.REASON, "No token found in the specified location: " + tokenLocation);
                flowFile = session.putAllAttributes(flowFile, attributes);

                session.transfer(flowFile, FAILURE);
                return;
            }

            // Add token and extraction timestamp to flow file attributes
            Map<String, String> attributes = new HashMap<>();
            attributes.put(JWTAttributes.TOKEN.VALUE, token);
            attributes.put(JWTAttributes.TOKEN.EXTRACTED_AT, Instant.now().toString());
            flowFile = session.putAllAttributes(flowFile, attributes);

            // Transfer to success relationship
            session.transfer(flowFile, SUCCESS);

        } catch (Exception e) {
            LOGGER.error(e, "Error processing flow file: %s", e.getMessage());

            // Add error attributes
            Map<String, String> attributes = new HashMap<>();
            attributes.put(JWTAttributes.ERROR.REASON, "Error processing flow file: " + e.getMessage());
            flowFile = session.putAllAttributes(flowFile, attributes);

            session.transfer(flowFile, FAILURE);
        }
    }

    /**
     * Extracts a token from a header in the flow file.
     * 
     * @param flowFile The flow file containing the header
     * @param headerName The name of the header containing the token
     * @return The extracted token, or null if not found
     */
    private String extractTokenFromHeader(FlowFile flowFile, String headerName) {
        String headerValue = flowFile.getAttribute("http.headers." + headerName.toLowerCase());

        if (headerValue == null || headerValue.isEmpty()) {
            return null;
        }

        // If header starts with Bearer prefix, strip it
        String prefix = "Bearer ";
        if (headerValue.startsWith(prefix)) {
            return headerValue.substring(prefix.length()).trim();
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
