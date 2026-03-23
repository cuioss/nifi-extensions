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

import lombok.experimental.UtilityClass;
import org.eclipse.jetty.server.Request;

/**
 * Shared request utilities for endpoint handlers.
 */
@UtilityClass
class RequestUtils {

    private static final String IPV4_LOOPBACK = "127.0.0.1";
    private static final String IPV6_LOOPBACK = "::1";

    /**
     * Returns {@code true} if the request originates from a loopback address
     * (127.0.0.1 or ::1).
     *
     * @param request the Jetty request
     * @return {@code true} for loopback requests
     */
    public static boolean isLoopbackRequest(Request request) {
        String remoteAddr = Request.getRemoteAddr(request);
        return IPV4_LOOPBACK.equals(remoteAddr) || IPV6_LOOPBACK.equals(remoteAddr);
    }
}
