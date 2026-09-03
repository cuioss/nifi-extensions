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
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

/**
 * Validates that requests to JWT API endpoints include a valid processor ID header.
 * <p>
 * This filter intercepts requests to {@code /nifi-api/processors/jwt/*} and validates
 * the {@code X-Processor-Id} header through the shared {@link ProcessorIdHeaderValidator},
 * so the filter and the component-facing servlets apply one identical processor-ID rule and
 * one 400-JSON response contract.
 *
 * <p>Registration is via {@code web.xml} only (mirroring {@link SecurityHeadersFilter}); the
 * filter carries no {@code @WebFilter} annotation, so it is mapped exactly once.</p>
 *
 * <h3>Security note</h3>
 * <p>This filter enforces exactly two things: that the {@code X-Processor-Id} header is present
 * and non-blank, and that its value satisfies the shared processor-ID format rule — rejecting
 * anything else with the 400-JSON contract. It is an input-shape gate, nothing more. The
 * processor ID is <em>not</em> an authentication token, and this filter is <em>not</em> the
 * trust boundary.</p>
 *
 * <p>The two guarantees it does not provide are owned elsewhere:</p>
 * <ul>
 *   <li><strong>Authentication</strong> — owned by NiFi's session authentication. This filter
 *       reads {@code getRemoteUser()} for a debug log only; it never gates on it, so an
 *       unauthenticated request is not stopped here.</li>
 *   <li><strong>Per-user authorization for the referenced processor</strong> — owned by the
 *       {@code ComponentConfigReader.getComponentConfig} read the downstream servlets perform on
 *       every request. A validly-formatted processor ID says nothing about whether the caller may
 *       read that processor; only that read does.</li>
 * </ul>
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/reference/configuration.adoc">Configuration Reference</a>
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/architecture/gateway.adoc">Gateway Architecture</a>
 */
public class ProcessorIdValidationFilter implements Filter {

    private static final CuiLogger LOGGER = new CuiLogger(ProcessorIdValidationFilter.class);

    private static final String PROCESSOR_ID_HEADER = "X-Processor-Id";

    /** Shared processor-ID rule + 400 response contract, identical to the servlets. */
    private final ProcessorIdHeaderValidator processorIdValidator = new ProcessorIdHeaderValidator();

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        LOGGER.info(UILogMessages.INFO.FILTER_INITIALIZED);
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String requestPath = httpRequest.getServletPath();
        String method = httpRequest.getMethod();

        LOGGER.debug("Processing request: %s %s", method, requestPath);

        String processorId = httpRequest.getHeader(PROCESSOR_ID_HEADER);

        // Require the header to be present, then apply the shared processor-ID rule.
        // Both branches emit the identical 400-JSON contract the servlets use.
        if (processorId == null || processorId.trim().isEmpty()) {
            LOGGER.warn(UILogMessages.WARN.MISSING_PROCESSOR_ID, requestPath);
            ProcessorIdHeaderValidator.sendBadRequest(httpResponse, "Missing processor ID");
            return;
        }
        if (!processorIdValidator.validate(processorId, httpResponse)) {
            // A 400 JSON error response has already been written by the shared validator.
            return;
        }

        // Diagnostic only — the request is NOT gated on the user being present. NiFi's session
        // authentication owns that; this filter would pass an unauthenticated request through.
        String remoteUser = httpRequest.getRemoteUser();
        if (remoteUser != null) {
            LOGGER.debug("Request from authenticated user: %s for processor %s", remoteUser, processorId);
        }

        // The header is well-formed. Whether the caller may read this processor is decided
        // downstream by the servlets' per-request ComponentConfigReader.getComponentConfig read.
        LOGGER.debug("Request validation successful for processor %s", processorId);

        chain.doFilter(request, response);
    }

    @Override
    public void destroy() {
        LOGGER.info(UILogMessages.INFO.FILTER_DESTROYED);
    }

}
