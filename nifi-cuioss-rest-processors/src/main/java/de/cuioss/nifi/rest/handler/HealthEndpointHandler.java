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

import de.cuioss.nifi.rest.config.AuthMode;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import jakarta.json.Json;
import org.eclipse.jetty.http.HttpHeader;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import org.jspecify.annotations.Nullable;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

/**
 * Built-in handler for the {@code /health} management endpoint.
 * Returns a JSON response with status and timestamp.
 */
public class HealthEndpointHandler extends AbstractManagementHandler {

    static final String HEALTH_PATH = "/health";
    private static final String JSON_CONTENT_TYPE = "application/json";

    public HealthEndpointHandler(boolean enabled, AuthMode authMode) {
        super(enabled, authMode);
    }

    @Override
    public String name() {
        return "health";
    }

    @Override
    public String path() {
        return HEALTH_PATH;
    }

    @Override
    public void process(SanitizedRequest sanitized,
            @Nullable AccessTokenContent token,
            byte[] body,
            Request request, Response response, Callback callback) {
        String responseBody = Json.createObjectBuilder()
                .add("status", "UP")
                .add("timestamp", Instant.now().toString())
                .build()
                .toString();
        byte[] bytes = responseBody.getBytes(StandardCharsets.UTF_8);
        response.setStatus(200);
        response.getHeaders().put(HttpHeader.CONTENT_TYPE, JSON_CONTENT_TYPE);
        response.getHeaders().put(HttpHeader.CONTENT_LENGTH, bytes.length);
        response.write(true, ByteBuffer.wrap(bytes), callback);
    }
}
