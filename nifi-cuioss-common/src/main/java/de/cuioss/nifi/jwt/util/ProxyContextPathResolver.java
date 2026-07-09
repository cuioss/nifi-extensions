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

import de.cuioss.nifi.jwt.JwtLogMessages;
import de.cuioss.tools.logging.CuiLogger;

import java.util.function.Function;

/**
 * Resolves the reverse-proxy context path from request headers and normalizes it
 * to a form safe to prepend to host-absolute {@code /nifi-api/...} URLs.
 *
 * <p>Shared across the UI servlet, the REST processors, and the integration tests
 * so the header-precedence rules and the injection guard live in exactly one
 * place.
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
 * other control characters, protocol-relative prefixes ({@code //host}), or
 * backslashes are rejected (resolved to empty) to guard against header and
 * protocol-relative URL injection.
 */
public final class ProxyContextPathResolver {

    private static final CuiLogger LOGGER = new CuiLogger(ProxyContextPathResolver.class);

    private static final String HEADER_PROXY_CONTEXT_PATH = "X-ProxyContextPath";
    private static final String HEADER_FORWARDED_PREFIX = "X-Forwarded-Prefix";
    private static final String HEADER_FORWARDED = "Forwarded";

    private ProxyContextPathResolver() {
    }

    /**
     * Resolves the normalized proxy context path from the supplied header lookup.
     *
     * @param headerLookup maps a header name to its value (or {@code null} when
     *                      absent); typically {@code request::getHeader}
     * @return the normalized prefix (exactly one leading slash, no trailing
     *         slash), or an empty string when no usable header is present
     */
    public static String resolve(Function<String, String> headerLookup) {
        return normalize(resolveRawPrefix(headerLookup));
    }

    /**
     * Resolves the raw (un-normalized) prefix from the headers in strict
     * precedence order, returning the first present non-empty value. Returns
     * {@code null} when no header carries a usable value.
     */
    private static String resolveRawPrefix(Function<String, String> headerLookup) {
        String proxyContextPath = headerLookup.apply(HEADER_PROXY_CONTEXT_PATH);
        if (isPresent(proxyContextPath)) {
            return proxyContextPath;
        }
        String forwardedPrefix = headerLookup.apply(HEADER_FORWARDED_PREFIX);
        if (isPresent(forwardedPrefix)) {
            return forwardedPrefix;
        }
        // RFC 7239 Forwarded has no standard prefix/context-path directive, so it
        // resolves empty by design; the first two headers carry the prefix.
        String forwarded = headerLookup.apply(HEADER_FORWARDED);
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
     * @param raw the raw header value (may be {@code null})
     * @return the normalized prefix, or an empty string when the value is absent
     *         or rejected
     */
    public static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        String trimmed = raw.strip();
        if (trimmed.isEmpty()) {
            return "";
        }
        if (containsControlCharacter(trimmed)) {
            LOGGER.warn(JwtLogMessages.WARN.CONTEXT_PATH_CONTROL_CHARACTERS_REJECTED, trimmed);
            return "";
        }
        // Reject protocol-relative values ("//host") and backslashes (which some
        // browsers normalize to "/"). Otherwise a value such as "//attacker.com"
        // would compose into "//attacker.com/nifi-api/..." in the browser — a
        // protocol-relative URL that exfiltrates the request (with its CSRF token
        // and processor-id headers) to an attacker-controlled host.
        if (trimmed.startsWith("//") || trimmed.contains("\\")) {
            LOGGER.warn(JwtLogMessages.WARN.CONTEXT_PATH_PROTOCOL_RELATIVE_REJECTED, trimmed);
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
