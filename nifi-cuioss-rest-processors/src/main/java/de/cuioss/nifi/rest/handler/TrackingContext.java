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

import org.jspecify.annotations.Nullable;

/**
 * Immutable correlation pair carrying the trace identifiers for a tracked
 * request through the FlowFile enqueue path.
 * <p>
 * Grouping the two trace identifiers into a single parameter object keeps the
 * enqueue helpers below the method-parameter threshold while making the
 * tracking-correlation relationship explicit at every call site.
 *
 * @param traceId       the unique trace identifier for request tracking
 *                      (null when tracking disabled)
 * @param parentTraceId optional parent trace ID for chained requests
 *                      (null when not chained)
 */
record TrackingContext(@Nullable String traceId, @Nullable String parentTraceId) {
}
