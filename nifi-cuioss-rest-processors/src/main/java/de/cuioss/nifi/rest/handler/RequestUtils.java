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

import de.cuioss.http.forwarded.ResolvedForwarding;
import jakarta.json.Json;
import jakarta.json.JsonObjectBuilder;
import lombok.experimental.UtilityClass;
import org.eclipse.jetty.http.HttpHeader;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;

import java.net.InetSocketAddress;
import java.net.SocketAddress;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.UUID;

/**
 * Shared request utilities for endpoint handlers.
 */
@UtilityClass
class RequestUtils {

    /**
     * Returns {@code true} if the request originates from a loopback address.
     * <p>
     * Uses the remote {@link InetSocketAddress} and
     * {@link java.net.InetAddress#isLoopbackAddress()} instead of comparing the
     * string form: Jetty renders IPv6 addresses in normalized/bracketed form
     * (e.g. {@code [0:0:0:0:0:0:0:1]}), which a literal {@code "::1"} comparison
     * never matches.
     *
     * @param request the Jetty request
     * @return {@code true} for loopback requests
     */
    public static boolean isLoopbackRequest(Request request) {
        SocketAddress remote = request.getConnectionMetaData().getRemoteSocketAddress();
        return remote instanceof InetSocketAddress inet
                && inet.getAddress() != null
                && inet.getAddress().isLoopbackAddress();
    }

    /**
     * Extracts and validates a UUID path parameter after the given prefix.
     * On failure, a Problem Details response is sent and empty is returned.
     *
     * @param path      the sanitized request path
     * @param prefix    the path prefix including trailing slash (e.g. {@code /status/})
     * @param paramName the parameter name used in error messages (e.g. {@code traceId})
     * @param response  the response to send errors to
     * @param callback  the Jetty callback
     * @return the validated UUID string, or empty if an error response was sent
     */
    public static Optional<String> extractUuidPathParameter(String path, String prefix,
            String paramName, Response response, Callback callback) {
        if (!path.startsWith(prefix) || path.length() <= prefix.length()) {
            ProblemDetail.badRequest("Missing %s in path. Expected: %s{%s}"
                    .formatted(paramName, prefix, paramName))
                    .sendResponse(response, callback);
            return Optional.empty();
        }
        String id = path.substring(prefix.length());
        try {
            UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            ProblemDetail.badRequest("Invalid %s format. Expected UUID.".formatted(paramName))
                    .sendResponse(response, callback);
            return Optional.empty();
        }
        return Optional.of(id);
    }

    /**
     * Builds the absolute {@code Location} URI for the status endpoint of the given traceId,
     * omitting default ports (80/443).
     *
     * <p>Each of scheme / host / port prefers the honored forwarded value from the request's
     * {@link SanitizedRequest#forwarding()} view, falling back per-field to the raw Jetty accessor
     * when that field was not honored — so a reverse-proxy-facing URL is reflected under opt-in and
     * the URI is byte-identical to the raw request otherwise. The honored reverse-proxy context
     * prefix ({@link SanitizedRequest#proxyContextPath()}) is prepended.
     *
     * @param request   the originating Jetty request (raw scheme/host/port fallback source)
     * @param sanitized the sanitized request carrying the honored forwarding view
     * @param traceId   the trace ID
     * @return the absolute status URI
     */
    public static String buildStatusLocationUri(Request request, SanitizedRequest sanitized, String traceId) {
        ResolvedForwarding forwarding = sanitized.forwarding();
        String scheme = forwarding.scheme().orElseGet(() -> request.getHttpURI().getScheme());
        String host = forwarding.host().orElseGet(() -> Request.getServerName(request));
        int port = forwarding.port().orElseGet(() -> Request.getServerPort(request));
        String proxyContextPath = sanitized.proxyContextPath();
        boolean isDefaultPort = ("http".equals(scheme) && port == 80)
                || ("https".equals(scheme) && port == 443);
        if (isDefaultPort) {
            return "%s://%s%s/status/%s".formatted(scheme, host, proxyContextPath, traceId);
        }
        return "%s://%s:%d%s/status/%s".formatted(scheme, host, port, proxyContextPath, traceId);
    }

    /**
     * Sends the shared 202 Accepted response with {@code Location} header and
     * HATEOAS {@code _links} body used by tracked routes and the attachments endpoint.
     *
     * @param request                the originating Jetty request
     * @param sanitized              the sanitized request carrying the honored forwarding view;
     *                               its context prefix is prepended to the {@code Location} header
     *                               and the {@code _links} hrefs, and its honored scheme/host/port
     *                               are reflected in the absolute {@code Location} URI
     * @param response               the response
     * @param callback               the Jetty callback
     * @param traceId                the accepted request's trace ID
     * @param includeAttachmentsLink whether to add the {@code attachments} link
     *                               (routes in ATTACHMENTS tracking mode)
     */
    public static void sendAcceptedResponse(Request request, SanitizedRequest sanitized,
            Response response, Callback callback,
            String traceId, boolean includeAttachmentsLink) {
        String proxyContextPath = sanitized.proxyContextPath();
        String statusPath = proxyContextPath + "/status/" + traceId;
        JsonObjectBuilder linksBuilder = Json.createObjectBuilder()
                .add("status", Json.createObjectBuilder().add("href", statusPath));
        if (includeAttachmentsLink) {
            linksBuilder.add("attachments", Json.createObjectBuilder()
                    .add("href", proxyContextPath + "/attachments/" + traceId));
        }
        byte[] responseBody = Json.createObjectBuilder()
                .add("status", "accepted")
                .add("traceId", traceId)
                .add("_links", linksBuilder)
                .build()
                .toString()
                .getBytes(StandardCharsets.UTF_8);

        response.setStatus(202);
        response.getHeaders().put(HttpHeader.LOCATION,
                buildStatusLocationUri(request, sanitized, traceId));
        response.getHeaders().put(HttpHeader.CONTENT_TYPE, "application/json");
        response.getHeaders().put(HttpHeader.CONTENT_LENGTH, responseBody.length);
        response.write(true, ByteBuffer.wrap(responseBody), callback);
    }
}
