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
package de.cuioss.nifi.jwt.util;

import lombok.Builder;
import lombok.Getter;
import lombok.experimental.UtilityClass;
import org.jspecify.annotations.Nullable;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.StringJoiner;

/**
 * Provides context information for error messages to improve debugging.
 */
@Getter
@Builder
public class ErrorContext {

    private static final int MAX_CAUSE_CHAIN_DEPTH = 50;

    private final String operation;
    private final String component;
    @Builder.Default private final Map<String, Object> context = new HashMap<>();
    @Nullable private final Throwable cause;
    @Nullable private final String errorCode;

    public Map<String, Object> getContext() {
        return Collections.unmodifiableMap(context);
    }

    public ErrorContext with(@Nullable String key, @Nullable Object value) {
        if (key != null && key.matches("[a-zA-Z0-9._-]+") && value != null) {
            context.put(key, value);
        }
        return this;
    }

    public String buildMessage(String baseMessage) {
        StringJoiner joiner = new StringJoiner(", ", "[", "]");
        if (errorCode != null) {
            joiner.add("ErrorCode=" + errorCode);
        }
        joiner.add("Component=" + component);
        joiner.add("Operation=" + operation);
        for (Map.Entry<String, Object> entry : context.entrySet()) {
            String valueStr = entry.getValue() != null ? entry.getValue().toString() : "null";
            if (valueStr.length() > 100) {
                valueStr = valueStr.substring(0, 97) + "...";
            }
            joiner.add(entry.getKey() + "=" + valueStr);
        }
        StringBuilder message = new StringBuilder();
        message.append(baseMessage);
        message.append(" ").append(joiner.toString());
        if (cause != null) {
            message.append(" Caused by: ").append(cause.getClass().getSimpleName());
            if (cause.getMessage() != null) {
                message.append(": ").append(cause.getMessage());
            }
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

    public static ErrorContextBuilder forComponent(String component) {
        return ErrorContext.builder().component(component);
    }

    @SuppressWarnings("java:S2094")
    public static class ErrorContextBuilder {
        // Lombok @Builder generates the full implementation
    }

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
