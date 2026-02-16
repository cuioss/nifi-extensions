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

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * Thread-safe counter for application-level gateway security events.
 * <p>
 * Complements the transport-level counters from cui-http
 * ({@code de.cuioss.http.security.monitoring.SecurityEventCounter}) and the
 * token-level counters from oauth-sheriff
 * ({@code de.cuioss.sheriff.oauth.core.security.SecurityEventCounter}) by
 * tracking gateway-specific security decisions: authentication failures,
 * authorization denials, request size violations, and route probing.
 * <p>
 * All operations are atomic and lock-free, suitable for concurrent access
 * from Jetty handler threads.
 *
 * @see EventType
 */
public class GatewaySecurityEvents {

    private final ConcurrentHashMap<EventType, AtomicLong> counters = new ConcurrentHashMap<>();

    /**
     * Application-level security event types tracked by the gateway.
     */
    public enum EventType {
        /** 401 — no Authorization header or malformed Bearer prefix. */
        MISSING_BEARER_TOKEN,
        /** 401 — token validation failed (expired, bad signature, etc.). */
        AUTH_FAILED,
        /** 403 — valid token but missing required roles. */
        AUTHZ_ROLE_DENIED,
        /** 401 step-up — valid token but missing required scopes. */
        AUTHZ_SCOPE_DENIED,
        /** 413 — request body exceeds configured maximum size. */
        BODY_TOO_LARGE,
        /** 404 — no route configured for the requested path. */
        ROUTE_NOT_FOUND,
        /** 405 — route exists but HTTP method is not allowed. */
        METHOD_NOT_ALLOWED,
        /** 503 — request queue at capacity, back-pressure applied. */
        QUEUE_FULL
    }

    /**
     * Increments the counter for the specified event type.
     *
     * @param eventType the event type to increment
     * @return the new count after incrementing
     */
    public long increment(EventType eventType) {
        return counters.computeIfAbsent(eventType, k -> new AtomicLong(0))
                .incrementAndGet();
    }

    /**
     * Returns the current count for the specified event type.
     *
     * @param eventType the event type to query
     * @return the current count, or 0 if no events recorded
     */
    public long getCount(EventType eventType) {
        return Optional.ofNullable(counters.get(eventType))
                .map(AtomicLong::get)
                .orElse(0L);
    }

    /**
     * Returns a snapshot of all current counts as an immutable map.
     *
     * @return event types mapped to their current counts
     */
    public Map<EventType, Long> getAllCounts() {
        return counters.entrySet().stream()
                .collect(Collectors.toUnmodifiableMap(
                        Map.Entry::getKey,
                        entry -> entry.getValue().get()));
    }

    /**
     * Returns the total count across all event types.
     *
     * @return the sum of all event counters
     */
    public long getTotalCount() {
        return counters.values().stream()
                .mapToLong(AtomicLong::get)
                .sum();
    }

    /**
     * Resets all counters to zero, keeping event types in tracking.
     */
    public void reset() {
        counters.values().forEach(counter -> counter.set(0));
    }

    @Override
    public String toString() {
        return "GatewaySecurityEvents{totalEvents=%d, distinctTypes=%d}".formatted(
                getTotalCount(), counters.size());
    }
}
