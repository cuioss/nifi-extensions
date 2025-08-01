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

import de.cuioss.tools.logging.CuiLogger;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.io.PrintWriter;

/**
 * Servlet that provides the session API key to authenticated UI clients.
 * This endpoint is accessible without API key authentication since it's
 * used to retrieve the API key for subsequent API calls.
 */
@WebServlet("/nifi-api/processors/jwt/session-key")
public class ApiKeyServlet extends HttpServlet {

    private static final CuiLogger LOGGER = new CuiLogger(ApiKeyServlet.class);

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        LOGGER.debug("Session key request from: %s", request.getRemoteAddr());
        
        // Get the current session API key
        String sessionKey = ApiKeyAuthenticationFilter.getSessionApiKey();
        
        // Build JSON response
        JsonObject jsonResponse = Json.createObjectBuilder()
                .add("sessionKey", sessionKey)
                .add("success", true)
                .build();
        
        // Set response headers
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        response.setHeader("Pragma", "no-cache");
        response.setHeader("Expires", "0");
        
        // Write response
        try (PrintWriter writer = response.getWriter()) {
            writer.write(jsonResponse.toString());
        }
        
        LOGGER.debug("Session key provided to client");
    }
}