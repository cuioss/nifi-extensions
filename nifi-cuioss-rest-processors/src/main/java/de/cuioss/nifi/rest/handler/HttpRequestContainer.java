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
package de.cuioss.nifi.rest.handler;

import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import lombok.NonNull;
import org.jspecify.annotations.Nullable;

import java.util.Arrays;
import java.util.Map;
import java.util.Objects;

/**
 * Immutable container bridging an incoming HTTP request from the Jetty handler
 * to the NiFi processor's {@code onTrigger()} method for FlowFile creation.
 * <p>
 * Instances are enqueued by {@code GatewayRequestHandler} after successful
 * authentication and validation. The processor polls the queue and creates
 * a FlowFile with the request data and JWT claims as attributes.
 *
 * @param routeName       the matched route name
 * @param method          the HTTP method (GET, POST, etc.)
 * @param requestUri      the full request URI path
 * @param queryParameters query string parameters as key-value pairs
 * @param headers         HTTP request headers
 * @param remoteHost      the client's remote host address
 * @param body            the request body bytes (empty array for GET/DELETE)
 * @param contentType     the Content-Type header value
 * @param token           the validated JWT access token (null for unauthenticated routes)
 * @param traceId         the unique trace identifier for request tracking (null when tracking disabled)
 * @param parentTraceId   optional parent trace ID for chained requests (null when not chained)
 */
public record HttpRequestContainer(
@NonNull String routeName,
@NonNull String method,
@NonNull String requestUri,
Map<String, String> queryParameters,
Map<String, String> headers,
@NonNull String remoteHost,
byte[] body,
@Nullable String contentType,
@Nullable AccessTokenContent token,
@Nullable String traceId,
@Nullable String parentTraceId) {

    /**
     * Compact constructor — defensive copies for maps, null-safe body.
     */
    public HttpRequestContainer {
        queryParameters = queryParameters != null ? Map.copyOf(queryParameters) : Map.of();
        headers = headers != null ? Map.copyOf(headers) : Map.of();
        body = body != null ? body.clone() : new byte[0];
    }

    /**
     * Returns a copy of the request body to prevent mutation.
     */
    @Override
    public byte[] body() {
        return body.clone();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof HttpRequestContainer(
                var thatRouteName, var thatMethod, var thatRequestUri,
                var thatQueryParameters, var thatHeaders, var thatRemoteHost,
                var thatBody, var thatContentType, var thatToken,
                var thatTraceId, var thatParentTraceId))) return false;
        return Objects.equals(routeName, thatRouteName)
                && Objects.equals(method, thatMethod)
                && Objects.equals(requestUri, thatRequestUri)
                && Objects.equals(queryParameters, thatQueryParameters)
                && Objects.equals(headers, thatHeaders)
                && Objects.equals(remoteHost, thatRemoteHost)
                && Arrays.equals(body, thatBody)
                && Objects.equals(contentType, thatContentType)
                && Objects.equals(token, thatToken)
                && Objects.equals(traceId, thatTraceId)
                && Objects.equals(parentTraceId, thatParentTraceId);
    }

    @Override
    public int hashCode() {
        int result = Objects.hash(routeName, method, requestUri, queryParameters,
                headers, remoteHost, contentType, token, traceId, parentTraceId);
        result = 31 * result + Arrays.hashCode(body);
        return result;
    }

    @Override
    public String toString() {
        return "HttpRequestContainer[routeName=%s, method=%s, requestUri=%s, bodyLength=%d, traceId=%s]"
                .formatted(routeName, method, requestUri, body.length, traceId);
    }
}
