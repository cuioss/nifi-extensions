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

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.easymock.EasyMock.*;

/**
 * Tests for {@link SecurityHeadersFilter}.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/security.adoc">Security Specification</a>
 */
@DisplayName("Security Headers Filter Tests")
class SecurityHeadersFilterTest {

    private SecurityHeadersFilter filter;
    private HttpServletRequest mockRequest;
    private HttpServletResponse mockResponse;
    private FilterChain mockChain;

    @BeforeEach
    void setUp() {
        filter = new SecurityHeadersFilter();
        mockRequest = createMock(HttpServletRequest.class);
        mockResponse = createMock(HttpServletResponse.class);
        mockChain = createMock(FilterChain.class);
    }

    @Test
    @DisplayName("Should set X-Content-Type-Options header")
    void shouldSetXContentTypeOptionsHeader() throws Exception {
        mockResponse.setHeader("X-Content-Type-Options", "nosniff");
        expectLastCall().once();
        mockResponse.setHeader("X-Frame-Options", "SAMEORIGIN");
        expectLastCall().once();
        mockResponse.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        expectLastCall().once();
        mockResponse.setHeader(eq("Content-Security-Policy"), anyString());
        expectLastCall().once();
        mockChain.doFilter(mockRequest, mockResponse);
        expectLastCall().once();

        replay(mockRequest, mockResponse, mockChain);

        filter.doFilter(mockRequest, mockResponse, mockChain);

        verify(mockRequest, mockResponse, mockChain);
    }

    @Test
    @DisplayName("Should set X-Frame-Options to SAMEORIGIN for NiFi iframe")
    void shouldSetXFrameOptionsToSameOrigin() throws Exception {
        mockResponse.setHeader("X-Content-Type-Options", "nosniff");
        expectLastCall().once();
        mockResponse.setHeader("X-Frame-Options", "SAMEORIGIN");
        expectLastCall().once();
        mockResponse.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        expectLastCall().once();
        mockResponse.setHeader(eq("Content-Security-Policy"), anyString());
        expectLastCall().once();
        mockChain.doFilter(mockRequest, mockResponse);
        expectLastCall().once();

        replay(mockRequest, mockResponse, mockChain);

        filter.doFilter(mockRequest, mockResponse, mockChain);

        verify(mockRequest, mockResponse, mockChain);
    }

    @Test
    @DisplayName("Should continue filter chain after setting headers")
    void shouldContinueFilterChain() throws Exception {
        mockResponse.setHeader(anyString(), anyString());
        expectLastCall().anyTimes();
        mockChain.doFilter(mockRequest, mockResponse);
        expectLastCall().once();

        replay(mockRequest, mockResponse, mockChain);

        filter.doFilter(mockRequest, mockResponse, mockChain);

        verify(mockChain);
    }
}
