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

import de.cuioss.http.forwarded.ForwardedResolverConfig;
import de.cuioss.nifi.jwt.util.ForwardedRequestResolver;
import de.cuioss.nifi.ui.UILogMessages;
import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.Json;
import jakarta.json.JsonWriterFactory;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Properties;
import java.util.Set;

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
 * <p>The header precedence, normalization, injection guard, and trust model live
 * in the shared {@link ForwardedRequestResolver} (a thin wrapper over cui-http
 * {@code de.cuioss.http.forwarded}), so the UI servlet, the REST processors, and
 * the integration tests resolve the prefix identically.
 *
 * <p><strong>Secure by default.</strong> The honored context-path allowlist is
 * derived at {@link #init()} from NiFi's {@code nifi.web.proxy.context.path}
 * property (mirroring the platform's own whitelist) via
 * {@link ForwardedResolverConfig#parseAllowlist(String)}. A servlet
 * {@code allowedContextPaths} init-param, when present, overrides that derived
 * value; an optional {@code trustAll} init-param honors any sanitized prefix.
 * When neither the property nor the init-param is set the allowlist is empty, so
 * the resolver honors nothing and every prefix resolves to {@code ""}.
 *
 * <p>Response format (always HTTP 200):
 * <pre>{@code
 * { "contextPath": "/my-app/ui" }
 * }</pre>
 */
public class ProxyContextPathServlet extends HttpServlet {

    private static final CuiLogger LOGGER = new CuiLogger(ProxyContextPathServlet.class);
    private static final JsonWriterFactory JSON_WRITER = Json.createWriterFactory(Map.of());

    /** NiFi property whose value seeds the honored context-path allowlist. */
    private static final String NIFI_PROXY_CONTEXT_PATH_PROPERTY = "nifi.web.proxy.context.path";
    /** System property locating the active {@code nifi.properties} file. */
    private static final String NIFI_PROPERTIES_FILE_PATH = "nifi.properties.file.path";
    /** Servlet init-param overriding the NiFi-derived allowlist. */
    private static final String INIT_PARAM_ALLOWED_CONTEXT_PATHS = "allowedContextPaths";
    /** Servlet init-param enabling trust-all context-path honoring. */
    private static final String INIT_PARAM_TRUST_ALL = "trustAll";

    /**
     * The configured resolver that resolves the honored context-path prefix from the
     * request headers against the operator's trust model. Built once in {@link #init()};
     * {@code transient} because it is not part of the servlet's serializable state.
     */
    private transient ForwardedRequestResolver resolver;

    /**
     * Builds the context-path resolver from the operator's trust configuration.
     *
     * <p>Allowlist precedence: an explicit {@value #INIT_PARAM_ALLOWED_CONTEXT_PATHS}
     * servlet init-param overrides the value derived from NiFi's
     * {@code nifi.web.proxy.context.path} property. When neither is set the allowlist is
     * empty, so the resolver honors nothing (secure default).
     */
    @Override
    public void init() throws ServletException {
        super.init();
        String initParamAllowlist = getInitParameter(INIT_PARAM_ALLOWED_CONTEXT_PATHS);
        String rawAllowlist = initParamAllowlist != null ? initParamAllowlist : readNifiProxyContextPath();
        Set<String> allowedContextPaths = ForwardedResolverConfig.parseAllowlist(rawAllowlist);
        boolean trustAll = Boolean.parseBoolean(getInitParameter(INIT_PARAM_TRUST_ALL));
        resolver = ForwardedRequestResolver.create(trustAll, allowedContextPaths, Set.of(), "defaults");
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
        String contextPath = resolver.resolve(req::getHeader).contextPath();

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
     * Reads {@code nifi.web.proxy.context.path} from the NiFi properties file located via the
     * {@value #NIFI_PROPERTIES_FILE_PATH} system property. Returns {@code null} when the file or
     * property is absent or unreadable, so the caller falls through to the secure (empty allowlist)
     * default.
     *
     * @return the raw {@code nifi.web.proxy.context.path} value, or {@code null} when unavailable
     */
    private static String readNifiProxyContextPath() {
        String nifiPropertiesPath = System.getProperty(NIFI_PROPERTIES_FILE_PATH);
        if (nifiPropertiesPath == null || nifiPropertiesPath.isBlank()) {
            return null;
        }
        Path path = Path.of(nifiPropertiesPath);
        if (!Files.isRegularFile(path)) {
            return null;
        }
        Properties properties = new Properties();
        try (InputStream in = Files.newInputStream(path)) {
            properties.load(in);
        } catch (IOException e) {
            LOGGER.debug(e, "Unable to read %s from %s; honoring no proxy context path",
                    NIFI_PROXY_CONTEXT_PATH_PROPERTY, nifiPropertiesPath);
            return null;
        }
        return properties.getProperty(NIFI_PROXY_CONTEXT_PATH_PROPERTY);
    }
}
