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
package de.cuioss.nifi.rest.config;

/**
 * Controls per-route request tracking behavior.
 *
 * <ul>
 *   <li>{@link #NONE} — No tracking (default). Requests receive a simple 200/202 response.</li>
 *   <li>{@link #SIMPLE} — Status tracking only. POST/PUT/PATCH requests receive a 202 with
 *       traceId and a HATEOAS {@code _links.status} link.</li>
 *   <li>{@link #ATTACHMENTS} — Status + attachments tracking. Like SIMPLE, but the 202 response
 *       also includes a {@code _links.attachments} link for uploading related documents.</li>
 * </ul>
 */
public enum TrackingMode {
    NONE,
    SIMPLE,
    ATTACHMENTS
}
