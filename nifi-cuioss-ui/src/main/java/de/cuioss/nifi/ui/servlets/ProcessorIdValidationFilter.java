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
 * one 400-JSON response contract. This ensures requests originate from the custom UI running
 * within an authenticated NiFi session (iframe).
 *
 * <p>Registration is via {@code web.xml} only (mirroring {@link SecurityHeadersFilter}); the
 * filter carries no {@code @WebFilter} annotation, so it is mapped exactly once.</p>
 *
 * <h3>Security note</h3>
 * <p>The processor-ID validation serves as a first line of defense against malformed input,
 * but the processor ID is <em>not</em> an authentication token. The actual trust boundary
 * is NiFi's session authentication — only authenticated users can reach this filter
 * because the Custom UI is loaded inside NiFi's authenticated iframe. The processor ID
 * only allows reading the referenced processor's own configuration; it cannot be used
 * to escalate privileges or access other components' data.</p>
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

        String remoteUser = httpRequest.getRemoteUser();
        if (remoteUser != null) {
            LOGGER.debug("Request from authenticated user: %s for processor %s", remoteUser, processorId);
        }

        // For requests from the custom UI (which runs in an iframe within NiFi),
        // we rely on the processor ID header and the fact that the UI is already
        // loaded within an authenticated NiFi session
        LOGGER.debug("Request validation successful for processor %s", processorId);

        chain.doFilter(request, response);
    }

    @Override
    public void destroy() {
        LOGGER.info(UILogMessages.INFO.FILTER_DESTROYED);
    }

}
