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
package de.cuioss.nifi.ui.servlets;

import de.cuioss.nifi.ui.UILogMessages;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.Json;
import jakarta.json.JsonWriterFactory;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

/**
 * Resolves the reverse-proxy context path from the incoming request headers and
 * returns it as JSON so the browser UI can prepend it to host-absolute
 * {@code /nifi-api/...} URLs.
 *
 * <p>Browser JavaScript cannot read the proxy context-path headers directly:
 * they are added by the reverse proxy on the hop to NiFi and are never exposed
 * to the browser. This servlet — which DOES receive those headers — reads them
 * and returns the resolved prefix.
 *
 * <p>Mapped to {@code GET /nifi-api/context-path}, deliberately OUTSIDE the
 * {@code /nifi-api/processors/jwt/*} pattern guarded by
 * {@link ProcessorIdValidationFilter} (which requires a UUID processor-ID
 * header), since the context-path request carries no processor ID.
 *
 * <p>Header precedence (first present non-empty value wins):
 * <ol>
 *     <li>{@code X-ProxyContextPath} — NiFi-native, most specific</li>
 *     <li>{@code X-Forwarded-Prefix} — de-facto reverse-proxy prefix header</li>
 *     <li>RFC 7239 {@code Forwarded} — resolves empty (no standard prefix directive)</li>
 * </ol>
 *
 * <p>The resolved value is normalized: exactly one leading slash, no trailing
 * slash, and an empty string when no header is present (so direct, non-proxied
 * deployments are byte-identical to prior behaviour). Values carrying CR, LF, or
 * other control characters are rejected (resolved to empty) to guard against
 * header injection.
 *
 * <p>Response format (always HTTP 200):
 * <pre>{@code
 * { "contextPath": "/my-app/ui" }
 * }</pre>
 */
public class ProxyContextPathServlet extends HttpServlet {

    private static final CuiLogger LOGGER = new CuiLogger(ProxyContextPathServlet.class);
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());

    private static final String HEADER_PROXY_CONTEXT_PATH = "X-ProxyContextPath";
    private static final String HEADER_FORWARDED_PREFIX = "X-Forwarded-Prefix";
    private static final String HEADER_FORWARDED = "Forwarded";

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
        String contextPath = normalize(resolveRawPrefix(req));

        var json = Json.createObjectBuilder()
                .add("contextPath", contextPath)
                .build();

        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        resp.setStatus(HttpServletResponse.SC_OK);
        // Handle the response-write IOException here rather than letting it
        // propagate out of the servlet method (which would leak a stack trace to
        // the client and trip SonarCloud rule java:S1989).
        try (var writer = JSON_WRITER.createWriter(resp.getOutputStream())) {
            writer.writeObject(json);
        } catch (IOException e) {
            LOGGER.warn(e, UILogMessages.WARN.FAILED_WRITE_CONTEXT_PATH_RESPONSE);
        }
    }

    /**
     * Resolves the raw (un-normalized) prefix from the request headers in strict
     * precedence order, returning the first present non-empty value. Returns
     * {@code null} when no header carries a usable value.
     */
    private static String resolveRawPrefix(HttpServletRequest req) {
        String proxyContextPath = req.getHeader(HEADER_PROXY_CONTEXT_PATH);
        if (isPresent(proxyContextPath)) {
            return proxyContextPath;
        }
        String forwardedPrefix = req.getHeader(HEADER_FORWARDED_PREFIX);
        if (isPresent(forwardedPrefix)) {
            return forwardedPrefix;
        }
        // RFC 7239 Forwarded has no standard prefix/context-path directive, so it
        // resolves empty by design; the first two headers carry the prefix.
        String forwarded = req.getHeader(HEADER_FORWARDED);
        if (isPresent(forwarded)) {
            LOGGER.debug("Forwarded header present but carries no context-path directive: %s", forwarded);
        }
        return null;
    }

    private static boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }

    /**
     * Normalizes a raw prefix to exactly one leading slash and no trailing slash.
     * Returns an empty string when the value is absent, blank, carries control
     * characters (CR/LF or other), starts with {@code //} (protocol-relative), or
     * contains a backslash — guarding against header and protocol-relative URL
     * injection.
     *
     * <p>Package-private so the injection guard and normalization rules can be
     * unit-tested directly: a real HTTP round-trip sanitizes control characters
     * in header values before the servlet sees them, so the guard cannot be
     * exercised through the transport path.
     */
    static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        String trimmed = raw.strip();
        if (trimmed.isEmpty()) {
            return "";
        }
        if (containsControlCharacter(trimmed)) {
            LOGGER.warn(UILogMessages.WARN.CONTEXT_PATH_CONTROL_CHARACTERS_REJECTED, trimmed);
            return "";
        }
        // Reject protocol-relative values ("//host") and backslashes (which some
        // browsers normalize to "/"). Otherwise a value such as "//attacker.com"
        // would compose into "//attacker.com/nifi-api/..." in the browser — a
        // protocol-relative URL that exfiltrates the request (with its CSRF token
        // and processor-id headers) to an attacker-controlled host.
        if (trimmed.startsWith("//") || trimmed.contains("\\")) {
            LOGGER.warn(UILogMessages.WARN.CONTEXT_PATH_PROTOCOL_RELATIVE_REJECTED, trimmed);
            return "";
        }
        String withLeadingSlash = trimmed.startsWith("/") ? trimmed : "/" + trimmed;
        String withoutTrailingSlash = stripTrailingSlashes(withLeadingSlash);
        // A value of only slashes (e.g. "/") collapses to empty.
        return "/".equals(withoutTrailingSlash) ? "" : withoutTrailingSlash;
    }

    private static boolean containsControlCharacter(String value) {
        for (int i = 0; i < value.length(); i++) {
            if (Character.isISOControl(value.charAt(i))) {
                return true;
            }
        }
        return false;
    }

    private static String stripTrailingSlashes(String value) {
        int end = value.length();
        while (end > 1 && value.charAt(end - 1) == '/') {
            end--;
        }
        return value.substring(0, end);
    }
}
