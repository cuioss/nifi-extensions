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
package de.cuioss.nifi.rest;

import lombok.experimental.UtilityClass;

/**
 * FlowFile attribute key constants for the REST API Gateway processor.
 * <p>
 * FlowFiles produced by the RestApiGateway carry these attributes to
 * describe the originating HTTP request and its matched route.
 */
@UtilityClass
public final class RestApiAttributes {

    /** The matched route name. */
    public static final String ROUTE_NAME = "rest.route.name";

    /** The resolved NiFi relationship (outcome) name for the route. */
    public static final String ROUTE_OUTCOME = "rest.route.outcome";

    /** The matched route path pattern. */
    public static final String ROUTE_PATH = "rest.route.path";

    /** The HTTP method of the request. */
    public static final String HTTP_METHOD = "http.method";

    /** The full request URI path. */
    public static final String HTTP_REQUEST_URI = "http.request.uri";

    /** The remote host address of the client. */
    public static final String HTTP_REMOTE_HOST = "http.remote.host";

    /** The MIME type of the request body. */
    public static final String CONTENT_TYPE = "mime.type";

    /** Prefix for query parameter attributes: {@code http.query.<name>}. */
    public static final String QUERY_PARAM_PREFIX = "http.query.";

    /** Prefix for header attributes: {@code http.header.<name>}. */
    public static final String HEADER_PREFIX = "http.header.";
}
