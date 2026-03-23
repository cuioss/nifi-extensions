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
package de.cuioss.nifi.processors.auth;

import de.cuioss.tools.logging.LogRecord;
import de.cuioss.tools.logging.LogRecordModel;
import lombok.experimental.UtilityClass;

/**
 * Provides logging messages for the JWT authentication processor.
 * All messages follow the format: AUTH-[identifier]: [message]
 * <p>
 * Shared JWT infrastructure log messages are in
 * {@code de.cuioss.nifi.jwt.JwtLogMessages} in the common module.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/reference/error-reference.adoc">Error Reference</a>
 */
@UtilityClass
public final class AuthLogMessages {

    private static final String PREFIX = "AUTH";

    @UtilityClass
    public static final class INFO {
        public static final LogRecord PROCESSOR_INITIALIZED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(1)
                .template("MultiIssuerJWTTokenAuthenticator initialized")
                .build();

        public static final LogRecord PROCESSOR_STOPPED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(2)
                .template("MultiIssuerJWTTokenAuthenticator stopped and resources cleaned up")
                .build();

        public static final LogRecord TOKEN_VALIDATION_METRICS = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(15)
                .template("Token validation metrics - Processed flow files: %d")
                .build();

        public static final LogRecord NO_TOKEN_NOT_REQUIRED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(37)
                .template("No token found but valid token not required, routing to success")
                .build();
    }

    @UtilityClass
    public static final class WARN {
        public static final LogRecord NO_TOKEN_FOUND = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(100)
                .template("No token found in the specified location: %s")
                .build();

        public static final LogRecord TOKEN_SIZE_EXCEEDED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(101)
                .template("Token exceeds maximum size limit of %d bytes")
                .build();

        public static final LogRecord AUTHORIZATION_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(112)
                .template("Authorization failed for token with subject '%s' from issuer '%s': %s")
                .build();

        public static final LogRecord TOKEN_VALIDATION_FAILED_MSG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(121)
                .template("Token validation failed: %s")
                .build();
    }
}
