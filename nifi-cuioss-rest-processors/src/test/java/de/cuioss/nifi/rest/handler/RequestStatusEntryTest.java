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

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("RequestStatusEntry")
class RequestStatusEntryTest {

    @Nested
    @DisplayName("Factory Methods")
    class FactoryMethods {

        @Test
        @DisplayName("Should create ACCEPTED entry with traceId")
        void shouldCreateAcceptedEntry() {
            String traceId = UUID.randomUUID().toString();

            var entry = RequestStatusEntry.accepted(traceId, null);

            assertEquals(traceId, entry.traceId());
            assertEquals(RequestStatus.ACCEPTED, entry.status());
            assertNotNull(entry.acceptedAt());
            assertNotNull(entry.updatedAt());
            assertEquals(entry.acceptedAt(), entry.updatedAt());
            assertNull(entry.parentTraceId());
            assertNull(entry.errorDetail());
        }

        @Test
        @DisplayName("Should create ACCEPTED entry with parentTraceId")
        void shouldCreateAcceptedEntryWithParent() {
            String traceId = UUID.randomUUID().toString();
            String parentTraceId = UUID.randomUUID().toString();

            var entry = RequestStatusEntry.accepted(traceId, parentTraceId);

            assertEquals(parentTraceId, entry.parentTraceId());
        }

        @Test
        @DisplayName("Should create COLLECTING_ATTACHMENTS entry")
        void shouldCreateCollectingAttachmentsEntry() {
            String traceId = UUID.randomUUID().toString();

            var entry = RequestStatusEntry.collectingAttachments(traceId, null, "upload", 5, 2);

            assertEquals(traceId, entry.traceId());
            assertEquals(RequestStatus.COLLECTING_ATTACHMENTS, entry.status());
            assertEquals("upload", entry.routeName());
            assertEquals(5, entry.attachmentsMaxCount());
            assertEquals(2, entry.attachmentsMinCount());
            assertNotNull(entry.acceptedAt());
            assertEquals(entry.acceptedAt(), entry.updatedAt());
        }
    }

    @Nested
    @DisplayName("JSON Serialization")
    class JsonSerialization {

        @Test
        @DisplayName("Should serialize and deserialize round-trip")
        void shouldSerializeDeserializeRoundTrip() {
            String traceId = UUID.randomUUID().toString();
            var entry = RequestStatusEntry.accepted(traceId, null);

            String json = entry.toJson();
            var deserialized = RequestStatusEntry.fromJson(json);

            assertEquals(entry.traceId(), deserialized.traceId());
            assertEquals(entry.status(), deserialized.status());
            assertEquals(entry.acceptedAt(), deserialized.acceptedAt());
            assertEquals(entry.updatedAt(), deserialized.updatedAt());
            assertNull(deserialized.parentTraceId());
            assertNull(deserialized.errorDetail());
        }

        @Test
        @DisplayName("Should serialize and deserialize with all optional fields")
        void shouldSerializeDeserializeWithOptionalFields() {
            String traceId = UUID.randomUUID().toString();
            String parentTraceId = UUID.randomUUID().toString();
            Instant now = Instant.now();
            var entry = new RequestStatusEntry(
                    traceId, RequestStatus.REJECTED, now, now,
                    parentTraceId, "Validation failed", 0, 0, null);

            String json = entry.toJson();
            var deserialized = RequestStatusEntry.fromJson(json);

            assertEquals(traceId, deserialized.traceId());
            assertEquals(RequestStatus.REJECTED, deserialized.status());
            assertEquals(parentTraceId, deserialized.parentTraceId());
            assertEquals("Validation failed", deserialized.errorDetail());
        }

        @ParameterizedTest
        @EnumSource(RequestStatus.class)
        @DisplayName("Should serialize all status values")
        void shouldSerializeAllStatusValues(RequestStatus status) {
            Instant now = Instant.now();
            var entry = new RequestStatusEntry(
                    UUID.randomUUID().toString(), status, now, now, null, null, 0, 0, null);

            String json = entry.toJson();
            var deserialized = RequestStatusEntry.fromJson(json);

            assertEquals(status, deserialized.status());
        }

        @Test
        @DisplayName("Should serialize and deserialize COLLECTING_ATTACHMENTS round-trip")
        void shouldSerializeDeserializeCollectingAttachments() {
            String traceId = UUID.randomUUID().toString();
            var entry = RequestStatusEntry.collectingAttachments(traceId, null, "upload", 3, 1);

            String json = entry.toJson();
            var deserialized = RequestStatusEntry.fromJson(json);

            assertEquals(RequestStatus.COLLECTING_ATTACHMENTS, deserialized.status());
            assertEquals("upload", deserialized.routeName());
            assertEquals(3, deserialized.attachmentsMaxCount());
            assertEquals(1, deserialized.attachmentsMinCount());
        }

        @Test
        @DisplayName("Should deserialize JSON without attachmentsMinCount for backward compatibility")
        void shouldDeserializeWithoutAttachmentsMinCount() {
            // Arrange — JSON from older version without attachmentsMinCount
            String json = "{\"traceId\":\"abc\",\"status\":\"COLLECTING_ATTACHMENTS\","
                    + "\"acceptedAt\":\"2026-01-01T00:00:00Z\",\"updatedAt\":\"2026-01-01T00:00:00Z\","
                    + "\"attachmentsMaxCount\":5}";

            var deserialized = RequestStatusEntry.fromJson(json);

            assertEquals(0, deserialized.attachmentsMinCount());
            assertEquals(5, deserialized.attachmentsMaxCount());
        }

        @Test
        @DisplayName("Should produce valid JSON")
        void shouldProduceValidJson() {
            var entry = RequestStatusEntry.accepted(UUID.randomUUID().toString(), null);

            String json = entry.toJson();

            assertTrue(json.contains("\"traceId\""));
            assertTrue(json.contains("\"status\":\"ACCEPTED\""));
            assertTrue(json.contains("\"acceptedAt\""));
            assertTrue(json.contains("\"updatedAt\""));
        }
    }
}
