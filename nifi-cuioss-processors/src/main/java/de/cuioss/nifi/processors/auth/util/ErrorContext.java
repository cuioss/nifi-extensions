/*
 * Copyright 2023 the original author or authors.
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * <p>
 * https://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package de.cuioss.nifi.processors.auth.util;

import lombok.Builder;
import lombok.Getter;
import lombok.NonNull;
import lombok.experimental.UtilityClass;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.StringJoiner;

/**
 * Provides context information for error messages to improve debugging.
 * This class helps create detailed error messages with relevant context.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/error-handling.adoc">Error Handling Specification</a>
 */
@Getter
@Builder
public class ErrorContext {

    /**
     * Maximum depth for traversing exception cause chains to prevent infinite loops.
     */
    private static final int MAX_CAUSE_CHAIN_DEPTH = 50;

    /**
     * The operation being performed when the error occurred
     */
    @NonNull
    private final String operation;

    /**
     * The component or class where the error occurred
     */
    @NonNull
    private final String component;

    /**
     * Additional context information
     */
    @Builder.Default
    private final Map<String, Object> context = new HashMap<>();

    /**
     * The original exception if available
     */
    private final Throwable cause;

    /**
     * Error code for categorization
     */
    private final String errorCode;

    /**
     * Returns an unmodifiable view of the context map.
     *
     * @return unmodifiable context map
     */
    public Map<String, Object> getContext() {
        return Collections.unmodifiableMap(context);
    }

    /**
     * Adds context information
     *
     * @param key   the context key (must contain only alphanumeric characters, dots, hyphens, underscores)
     * @param value the context value
     * @return this ErrorContext for chaining
     */
    public ErrorContext with(String key, Object value) {
        if (key != null && key.matches("[a-zA-Z0-9._-]+") && value != null) {
            context.put(key, value);
        }
        return this;
    }


    /**
     * Builds a detailed error message with all context information
     *
     * @param baseMessage the base error message
     * @return the detailed error message
     */
    public String buildMessage(String baseMessage) {
        StringJoiner joiner = new StringJoiner(", ", "[", "]");

        // Add error code if present
        if (errorCode != null) {
            joiner.add("ErrorCode=" + errorCode);
        }

        // Add component and operation
        joiner.add("Component=" + component);
        joiner.add("Operation=" + operation);

        // Add context information
        for (Map.Entry<String, Object> entry : context.entrySet()) {
            String valueStr = entry.getValue() != null ? entry.getValue().toString() : "null";
            // Truncate long values
            if (valueStr.length() > 100) {
                valueStr = valueStr.substring(0, 97) + "...";
            }
            joiner.add(entry.getKey() + "=" + valueStr);
        }

        // Build the complete message
        StringBuilder message = new StringBuilder();
        message.append(baseMessage);
        message.append(" ").append(joiner.toString());

        // Add cause information if available
        if (cause != null) {
            message.append(" Caused by: ").append(cause.getClass().getSimpleName());
            if (cause.getMessage() != null) {
                message.append(": ").append(cause.getMessage());
            }

            // Add root cause if different
            Throwable rootCause = getRootCause(cause);
            if (rootCause != cause) {
                message.append(" Root cause: ").append(rootCause.getClass().getSimpleName());
                if (rootCause.getMessage() != null) {
                    message.append(": ").append(rootCause.getMessage());
                }
            }
        }

        return message.toString();
    }

    /**
     * Gets the root cause of an exception
     *
     * @param throwable the exception
     * @return the root cause
     */
    private Throwable getRootCause(Throwable throwable) {
        Throwable rootCause = throwable;
        int depth = 0;
        while (rootCause.getCause() != null && rootCause.getCause() != rootCause
                && depth < MAX_CAUSE_CHAIN_DEPTH) {
            rootCause = rootCause.getCause();
            depth++;
        }
        return rootCause;
    }

    /**
     * Creates an ErrorContext builder for a specific component
     *
     * @param component the component name
     * @return the builder
     */
    public static ErrorContextBuilder forComponent(String component) {
        return ErrorContext.builder().component(component);
    }

    /**
     * Common error codes for categorization
     */
    @UtilityClass
    public static final class ErrorCodes {
        public static final String CONFIGURATION_ERROR = "CONFIG_ERROR";
        public static final String VALIDATION_ERROR = "VALIDATION_ERROR";
        public static final String PROCESSING_ERROR = "PROCESSING_ERROR";
        public static final String SECURITY_ERROR = "SECURITY_ERROR";
        public static final String IO_ERROR = "IO_ERROR";
        public static final String AUTHENTICATION_ERROR = "AUTH_ERROR";
        public static final String AUTHORIZATION_ERROR = "AUTHZ_ERROR";
        public static final String TOKEN_ERROR = "TOKEN_ERROR";
        public static final String NETWORK_ERROR = "NETWORK_ERROR";
        public static final String RESOURCE_ERROR = "RESOURCE_ERROR";
    }
}