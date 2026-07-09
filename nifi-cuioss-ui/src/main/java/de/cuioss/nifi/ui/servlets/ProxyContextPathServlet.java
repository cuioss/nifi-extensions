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

import de.cuioss.nifi.jwt.util.ProxyContextPathResolver;
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
 * <p>The header precedence, normalization, and injection guard live in the shared
 * {@link ProxyContextPathResolver} so the UI servlet, the REST processors, and the
 * integration tests resolve the prefix identically.
 *
 * <p>Response format (always HTTP 200):
 * <pre>{@code
 * { "contextPath": "/my-app/ui" }
 * }</pre>
 */
public class ProxyContextPathServlet extends HttpServlet {

    private static final CuiLogger LOGGER = new CuiLogger(ProxyContextPathServlet.class);
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
        String contextPath = ProxyContextPathResolver.resolve(req::getHeader);

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
     * Delegates to {@link ProxyContextPathResolver#normalize(String)}.
     *
     * <p>Package-private so the injection guard and normalization rules can be
     * unit-tested directly: a real HTTP round-trip sanitizes control characters
     * in header values before the servlet sees them, so the guard cannot be
     * exercised through the transport path.
     *
     * @param raw the raw header value (may be {@code null})
     * @return the normalized prefix, or an empty string when the value is absent
     *         or rejected
     */
    static String normalize(String raw) {
        return ProxyContextPathResolver.normalize(raw);
    }
}
