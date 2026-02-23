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

import de.cuioss.nifi.rest.handler.GatewaySecurityEvents.EventType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("GatewaySecurityEvents")
class GatewaySecurityEventsTest {

    private GatewaySecurityEvents events;

    @BeforeEach
    void setUp() {
        events = new GatewaySecurityEvents();
    }

    @Nested
    @DisplayName("Counting")
    class Counting {

        @Test
        @DisplayName("Should return zero for unrecorded event type")
        void shouldReturnZeroForUnrecordedEventType() {
            assertEquals(0L, events.getCount(EventType.AUTH_FAILED));
        }

        @Test
        @DisplayName("Should increment and return new count")
        void shouldIncrementAndReturnNewCount() {
            assertEquals(1L, events.increment(EventType.AUTH_FAILED));
            assertEquals(2L, events.increment(EventType.AUTH_FAILED));
            assertEquals(2L, events.getCount(EventType.AUTH_FAILED));
        }

        @Test
        @DisplayName("Should track distinct event types independently")
        void shouldTrackDistinctEventTypesIndependently() {
            events.increment(EventType.AUTH_FAILED);
            events.increment(EventType.AUTH_FAILED);
            events.increment(EventType.ROUTE_NOT_FOUND);

            assertEquals(2L, events.getCount(EventType.AUTH_FAILED));
            assertEquals(1L, events.getCount(EventType.ROUTE_NOT_FOUND));
            assertEquals(0L, events.getCount(EventType.QUEUE_FULL));
        }

        @Test
        @DisplayName("Should calculate total count across all types")
        void shouldCalculateTotalCount() {
            events.increment(EventType.AUTH_FAILED);
            events.increment(EventType.AUTHZ_ROLE_DENIED);
            events.increment(EventType.AUTHZ_SCOPE_DENIED);

            assertEquals(3L, events.getTotalCount());
        }

        @Test
        @DisplayName("Should return zero total for fresh instance")
        void shouldReturnZeroTotalForFreshInstance() {
            assertEquals(0L, events.getTotalCount());
        }
    }

    @Nested
    @DisplayName("Snapshots")
    class Snapshots {

        @Test
        @DisplayName("Should return empty map for fresh instance")
        void shouldReturnEmptyMapForFreshInstance() {
            assertTrue(events.getAllCounts().isEmpty());
        }

        @Test
        @DisplayName("Should return immutable snapshot of all counts")
        void shouldReturnImmutableSnapshot() {
            events.increment(EventType.MISSING_BEARER_TOKEN);
            events.increment(EventType.BODY_TOO_LARGE);

            var counts = events.getAllCounts();

            assertEquals(2, counts.size());
            assertEquals(1L, counts.get(EventType.MISSING_BEARER_TOKEN));
            assertEquals(1L, counts.get(EventType.BODY_TOO_LARGE));
            assertThrows(UnsupportedOperationException.class,
                    () -> counts.put(EventType.AUTH_FAILED, 99L));
        }
    }

    @Nested
    @DisplayName("Reset")
    class Reset {

        @Test
        @DisplayName("Should reset all counters to zero")
        void shouldResetAllCountersToZero() {
            events.increment(EventType.AUTH_FAILED);
            events.increment(EventType.ROUTE_NOT_FOUND);

            events.reset();

            assertEquals(0L, events.getCount(EventType.AUTH_FAILED));
            assertEquals(0L, events.getCount(EventType.ROUTE_NOT_FOUND));
            assertEquals(0L, events.getTotalCount());
        }
    }

    @Nested
    @DisplayName("EventType Coverage")
    class EventTypeCoverage {

        @Test
        @DisplayName("Should have exactly 9 event types")
        void shouldHaveExpectedEventTypeCount() {
            assertEquals(9, EventType.values().length);
        }

        @Test
        @DisplayName("Should increment every event type without error")
        void shouldIncrementEveryEventType() {
            for (EventType type : EventType.values()) {
                assertEquals(1L, events.increment(type));
            }
            assertEquals(9L, events.getTotalCount());
        }
    }

    @Nested
    @DisplayName("toString")
    class ToStringContract {

        @Test
        @DisplayName("Should include total and distinct type counts")
        void shouldIncludeTotalAndDistinctTypeCounts() {
            events.increment(EventType.AUTH_FAILED);
            events.increment(EventType.AUTH_FAILED);
            events.increment(EventType.QUEUE_FULL);

            var result = events.toString();

            assertTrue(result.contains("totalEvents=3"));
            assertTrue(result.contains("distinctTypes=2"));
        }
    }
}
