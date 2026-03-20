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

import de.cuioss.tools.logging.LogRecord;
import de.cuioss.tools.logging.LogRecordModel;
import lombok.experimental.UtilityClass;

/**
 * Provides logging messages for the REST API Gateway processor.
 * All messages follow the format: REST-[identifier]: [message]
 * <p>
 * Identifier ranges:
 * <ul>
 *   <li>INFO 1-15: server lifecycle, route matching, request processing</li>
 *   <li>WARN 100-115: auth failures, validation failures, back-pressure</li>
 *   <li>ERROR 200-210: server start failure, unexpected handler errors</li>
 * </ul>
 */
@UtilityClass
public final class RestApiLogMessages {

    private static final String PREFIX = "REST";

    @UtilityClass
    public static final class INFO {

        public static final LogRecord SERVER_STARTED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(1)
                .template("REST API Gateway server started on port %s")
                .build();

        public static final LogRecord SERVER_STOPPED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(2)
                .template("REST API Gateway server stopped")
                .build();

        public static final LogRecord ROUTE_MATCHED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(3)
                .template("Route matched: %s %s -> route '%s'")
                .build();

        public static final LogRecord REQUEST_PROCESSED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(4)
                .template("Request processed for route '%s': %s %s from %s")
                .build();

        public static final LogRecord FLOWFILE_CREATED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(5)
                .template("FlowFile created for route '%s' with %d bytes content")
                .build();

        public static final LogRecord ROUTES_CONFIGURED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(6)
                .template("Configured %d routes: %s")
                .build();

        public static final LogRecord PROCESSOR_INITIALIZED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(7)
                .template("RestApiGateway processor initialized")
                .build();

        public static final LogRecord PROCESSOR_STOPPED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(8)
                .template("RestApiGateway processor stopped, drained %d pending requests")
                .build();

        public static final LogRecord AUTH_SUCCESSFUL = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(9)
                .template("Authentication successful for %s %s from %s")
                .build();

        public static final LogRecord EXTERNAL_ROUTES_LOADED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(10)
                .template("Loaded %s route properties from external configuration file")
                .build();

        public static final LogRecord REQUEST_TRACKED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(11)
                .template("Request accepted with traceId=%s, route=%s")
                .build();

        public static final LogRecord STATUS_QUERIED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(12)
                .template("Status queried for traceId=%s, status=%s")
                .build();

        public static final LogRecord ATTACHMENT_ACCEPTED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(13)
                .template("Attachment accepted with traceId=%s, parentTraceId=%s (count %s/%s)")
                .build();

        public static final LogRecord ATTACHMENTS_MIN_MET = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(14)
                .template("Minimum attachment count met for parentTraceId=%s (count %s/%s), transitioning to PROCESSED")
                .build();

    }

    @UtilityClass
    public static final class WARN {

        public static final LogRecord AUTH_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(100)
                .template("Authentication failed for %s %s from %s: %s")
                .build();

        public static final LogRecord AUTHZ_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(101)
                .template("Authorization failed for %s %s from %s: %s")
                .build();

        public static final LogRecord QUEUE_FULL = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(102)
                .template("Request queue full, rejecting %s %s from %s")
                .build();

        public static final LogRecord METHOD_NOT_ALLOWED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(103)
                .template("Method %s not allowed on route '%s' (path: %s)")
                .build();

        public static final LogRecord ROUTE_NOT_FOUND = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(104)
                .template("No route found for path: %s")
                .build();

        public static final LogRecord BODY_TOO_LARGE = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(105)
                .template("Request body size %d exceeds maximum %d for %s %s")
                .build();

        public static final LogRecord VALIDATION_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(106)
                .template("Request body validation failed for route '%s': %s")
                .build();

        public static final LogRecord MISSING_BEARER_TOKEN = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(107)
                .template("Missing or malformed Bearer token for %s %s from %s")
                .build();

        public static final LogRecord INVALID_ROUTE_CONFIG = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(108)
                .template("Invalid route configuration, route '%s' has no path")
                .build();

        public static final LogRecord SECURITY_VIOLATION = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(109)
                .template("Security violation detected for %s %s from %s: %s")
                .build();

        public static final LogRecord STATUS_NOT_FOUND = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(110)
                .template("Status query for unknown traceId: %s")
                .build();

        public static final LogRecord STATUS_STORE_ERROR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(111)
                .template("Failed to access status store: %s")
                .build();

        public static final LogRecord PARENT_TRACE_NOT_FOUND = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(112)
                .template("Attachment rejected: parent traceId not found: %s")
                .build();

        public static final LogRecord ATTACHMENTS_NOT_SUPPORTED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(113)
                .template("Attachment rejected: parent %s does not accept attachments")
                .build();

        public static final LogRecord ATTACHMENT_LIMIT_REACHED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(114)
                .template("Attachment rejected: limit reached for parent %s (%s/%s)")
                .build();
    }

    @UtilityClass
    public static final class ERROR {

        public static final LogRecord SERVER_START_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(200)
                .template("Failed to start REST API Gateway server on port %s: %s")
                .build();

        public static final LogRecord HANDLER_ERROR = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(201)
                .template("Unexpected error in request handler: %s")
                .build();

        public static final LogRecord SERVER_STOP_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(202)
                .template("Error stopping REST API Gateway server: %s")
                .build();

        public static final LogRecord FLOWFILE_CREATION_FAILED = LogRecordModel.builder()
                .prefix(PREFIX)
                .identifier(203)
                .template("Failed to create FlowFile for route '%s': %s")
                .build();
    }
}
