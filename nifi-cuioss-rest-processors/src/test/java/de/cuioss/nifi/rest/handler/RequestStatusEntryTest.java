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

import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonValue;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

import java.io.StringReader;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("RequestStatusEntry")
class RequestStatusEntryTest {

    /** Fixed timestamp — avoids the system clock so serialization tests stay deterministic. */
    private static final Instant FIXED_INSTANT = Instant.parse("2024-01-01T00:00:00Z");

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
            Instant now = FIXED_INSTANT;
            var entry = new RequestStatusEntry(
                    traceId, RequestStatus.REJECTED, now, now,
                    parentTraceId, "Validation failed", null, null, null, null, null,
                    0, 0, null, Map.of());

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
            Instant now = FIXED_INSTANT;
            var entry = new RequestStatusEntry(
                    UUID.randomUUID().toString(), status, now, now, null, null,
                    null, null, null, null, null, 0, 0, null, Map.of());

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

    @Nested
    @DisplayName("Additional Fields")
    class AdditionalFields {

        /** Minimal valid reserved-field JSON prefix; extra keys are appended per test. */
        private String baseJson(String extraKeysWithLeadingComma) {
            return "{\"traceId\":\"abc\",\"status\":\"ACCEPTED\","
                    + "\"acceptedAt\":\"2024-01-01T00:00:00Z\",\"updatedAt\":\"2024-01-01T00:00:00Z\""
                    + extraKeysWithLeadingComma + "}";
        }

        @Test
        @DisplayName("Should capture extra top-level string keys in encounter order")
        void shouldCaptureExtraTopLevelKeys() {
            var deserialized = RequestStatusEntry.fromJson(
                    baseJson(",\"tenant\":\"acme\",\"channel\":\"web\""));

            assertEquals(Map.of("tenant", "acme", "channel", "web"), deserialized.additionalFields());
            assertEquals(List.of("tenant", "channel"),
                    List.copyOf(deserialized.additionalFields().keySet()));
        }

        @Test
        @DisplayName("Should coerce number and boolean scalars to their string form")
        void shouldCoerceScalarValues() {
            var deserialized = RequestStatusEntry.fromJson(
                    baseJson(",\"count\":7,\"enabled\":true,\"archived\":false"));

            assertEquals("7", deserialized.additionalFields().get("count"));
            assertEquals("true", deserialized.additionalFields().get("enabled"));
            assertEquals("false", deserialized.additionalFields().get("archived"));
        }

        @Test
        @DisplayName("Should drop object, array and null values without failing the parse")
        void shouldDropNonScalarValues() {
            var deserialized = RequestStatusEntry.fromJson(
                    baseJson(",\"meta\":{\"k\":\"v\"},\"tags\":[1,2],\"missing\":null,\"kept\":\"yes\""));

            assertEquals(Map.of("kept", "yes"), deserialized.additionalFields());
        }

        @Test
        @DisplayName("Should keep the reserved typed value and never capture a reserved key")
        void shouldKeepReservedKeyValueOnCollision() {
            // routeName is a reserved, typed key — even though it appears at the top level it must
            // populate the typed component and never leak into additionalFields.
            var deserialized = RequestStatusEntry.fromJson(
                    baseJson(",\"routeName\":\"upload\",\"extra\":\"kept\""));

            assertEquals("upload", deserialized.routeName());
            assertFalse(deserialized.additionalFields().containsKey("routeName"));
            assertEquals(Map.of("extra", "kept"), deserialized.additionalFields());
        }

        @Test
        @DisplayName("Should yield an empty map when no additional fields are present")
        void shouldYieldEmptyMapWhenAbsent() {
            var deserialized = RequestStatusEntry.fromJson(baseJson(""));

            assertTrue(deserialized.additionalFields().isEmpty());
        }

        @Test
        @DisplayName("Factory-created entries carry an empty additional-fields map")
        void factoryEntriesHaveEmptyAdditionalFields() {
            var entry = RequestStatusEntry.accepted(UUID.randomUUID().toString(), null);

            assertTrue(entry.additionalFields().isEmpty());
        }

        @Test
        @DisplayName("Should preserve additional fields across a toJson/fromJson round-trip")
        void shouldRoundTripAdditionalFields() {
            Map<String, String> extras = new LinkedHashMap<>();
            extras.put("tenant", "acme");
            extras.put("priority", "5");
            var entry = new RequestStatusEntry(
                    UUID.randomUUID().toString(), RequestStatus.ACCEPTED, FIXED_INSTANT, FIXED_INSTANT,
                    null, null, null, null, null, null, null, 0, 0, null, extras);

            var deserialized = RequestStatusEntry.fromJson(entry.toJson());

            assertEquals(extras, deserialized.additionalFields());
        }

        @Test
        @DisplayName("Should defensively skip a reserved key present in additionalFields when serializing")
        void shouldSkipReservedKeyOnSerialize() {
            Map<String, String> extras = new LinkedHashMap<>();
            extras.put("routeName", "shadow");
            extras.put("extra", "kept");
            var entry = new RequestStatusEntry(
                    "abc", RequestStatus.ACCEPTED, FIXED_INSTANT, FIXED_INSTANT,
                    null, null, null, null, null, null, null, 0, 0, "real", extras);

            var deserialized = RequestStatusEntry.fromJson(entry.toJson());

            // The typed routeName wins; the shadow additional-field entry is not re-emitted.
            assertEquals("real", deserialized.routeName());
            assertEquals(Map.of("extra", "kept"), deserialized.additionalFields());
        }
    }

    @Nested
    @DisplayName("RFC 9457 Error Components")
    class Rfc9457ErrorComponents {

        private static final String VIOLATIONS_JSON =
                "[{\"pointer\":\"/items/0/id\",\"detail\":\"must not be blank\"},"
                        + "{\"pointer\":\"/customer/email\",\"detail\":\"must be a well-formed address\"}]";

        /** Entry carrying every RFC 9457 error component, all as String scalars. */
        private RequestStatusEntry fullErrorEntry() {
            return new RequestStatusEntry(
                    "abc", RequestStatus.REJECTED, FIXED_INSTANT, FIXED_INSTANT,
                    null, "One or more fields are invalid",
                    "https://example.com/problems/validation", "422", "Validation Failed",
                    "/status/abc", VIOLATIONS_JSON,
                    0, 0, null, Map.of());
        }

        /** Minimal valid reserved-field JSON prefix; extra keys are appended per test. */
        private String baseJson(String extraKeysWithLeadingComma) {
            return "{\"traceId\":\"abc\",\"status\":\"ERROR\","
                    + "\"acceptedAt\":\"2024-01-01T00:00:00Z\",\"updatedAt\":\"2024-01-01T00:00:00Z\""
                    + extraKeysWithLeadingComma + "}";
        }

        private String componentOf(RequestStatusEntry entry, String key) {
            return switch (key) {
                case "errorType" -> entry.errorType();
                case "errorStatus" -> entry.errorStatus();
                case "errorTitle" -> entry.errorTitle();
                case "errorInstance" -> entry.errorInstance();
                case "errorViolations" -> entry.errorViolations();
                default -> throw new IllegalArgumentException("Unknown error component: " + key);
            };
        }

        @Test
        @DisplayName("Should round-trip all five error components through toJson/fromJson")
        void shouldRoundTripAllErrorComponents() {
            var entry = fullErrorEntry();

            var deserialized = RequestStatusEntry.fromJson(entry.toJson());

            assertEquals("One or more fields are invalid", deserialized.errorDetail());
            assertEquals("https://example.com/problems/validation", deserialized.errorType());
            assertEquals("422", deserialized.errorStatus());
            assertEquals("Validation Failed", deserialized.errorTitle());
            assertEquals("/status/abc", deserialized.errorInstance());
            assertEquals(VIOLATIONS_JSON, deserialized.errorViolations());
        }

        @ParameterizedTest
        @CsvSource({
                "errorType,https://example.com/problems/validation",
                "errorStatus,422",
                "errorTitle,Validation Failed",
                "errorInstance,/status/abc",
                "errorViolations,[]"
        })
        @DisplayName("Should read each error component from the cache JSON as a String scalar")
        void shouldReadEachErrorComponentAsStringScalar(String key, String value) {
            var deserialized = RequestStatusEntry.fromJson(
                    baseJson(",\"" + key + "\":\"" + value + "\""));

            assertEquals(value, componentOf(deserialized, key));
        }

        @ParameterizedTest
        @CsvSource({"errorType", "errorStatus", "errorTitle", "errorInstance", "errorViolations"})
        @DisplayName("Should not capture a reserved error key into additionalFields")
        void shouldNotCaptureErrorKeyAsAdditionalField(String key) {
            var deserialized = RequestStatusEntry.fromJson(
                    baseJson(",\"" + key + "\":\"seeded\",\"tenant\":\"acme\""));

            assertEquals("seeded", componentOf(deserialized, key));
            assertFalse(deserialized.additionalFields().containsKey(key),
                    key + " is reserved and must not leak into additionalFields");
            assertEquals(Map.of("tenant", "acme"), deserialized.additionalFields());
        }

        @Test
        @DisplayName("Should keep the five error keys out of additionalFields when all are present")
        void shouldKeepAllErrorKeysOutOfAdditionalFields() {
            var deserialized = RequestStatusEntry.fromJson(baseJson(
                    ",\"errorDetail\":\"boom\""
                            + ",\"errorType\":\"https://example.com/problems/validation\""
                            + ",\"errorStatus\":\"422\""
                            + ",\"errorTitle\":\"Validation Failed\""
                            + ",\"errorInstance\":\"/status/abc\""
                            + ",\"errorViolations\":\"[]\""
                            + ",\"tenant\":\"acme\""));

            assertEquals(Map.of("tenant", "acme"), deserialized.additionalFields());
            assertEquals("boom", deserialized.errorDetail());
            assertEquals("https://example.com/problems/validation", deserialized.errorType());
            assertEquals("422", deserialized.errorStatus());
            assertEquals("Validation Failed", deserialized.errorTitle());
            assertEquals("/status/abc", deserialized.errorInstance());
            assertEquals("[]", deserialized.errorViolations());
        }

        @Test
        @DisplayName("Should preserve errorViolations verbatim as a JSON-array-serialized String")
        void shouldPreserveViolationsVerbatim() {
            var entry = fullErrorEntry();

            String json = entry.toJson();

            JsonObject raw = Json.createReader(new StringReader(json)).readObject();
            assertEquals(JsonValue.ValueType.STRING, raw.get("errorViolations").getValueType(),
                    "errorViolations is stored as a String scalar, never as a nested JSON array");
            assertEquals(VIOLATIONS_JSON, raw.getString("errorViolations"));
            assertEquals(VIOLATIONS_JSON, RequestStatusEntry.fromJson(json).errorViolations());
        }

        @Test
        @DisplayName("Should emit none of the five error keys when no error component is set")
        void shouldEmitNoErrorKeysWhenAbsent() {
            var entry = RequestStatusEntry.accepted("abc", null);

            String json = entry.toJson();

            JsonObject raw = Json.createReader(new StringReader(json)).readObject();
            assertFalse(raw.containsKey("errorDetail"));
            assertFalse(raw.containsKey("errorType"));
            assertFalse(raw.containsKey("errorStatus"));
            assertFalse(raw.containsKey("errorTitle"));
            assertFalse(raw.containsKey("errorInstance"));
            assertFalse(raw.containsKey("errorViolations"));
        }

        @Test
        @DisplayName("Should expose null error components on factory-created entries")
        void shouldExposeNullErrorComponentsOnFactoryEntries() {
            var accepted = RequestStatusEntry.accepted("abc", null);
            var collecting = RequestStatusEntry.collectingAttachments("abc", null, "upload", 3, 1);

            for (RequestStatusEntry entry : List.of(accepted, collecting)) {
                assertNull(entry.errorType());
                assertNull(entry.errorStatus());
                assertNull(entry.errorTitle());
                assertNull(entry.errorInstance());
                assertNull(entry.errorViolations());
            }
        }

        @Test
        @DisplayName("Should deserialize to null error components when the keys are absent")
        void shouldDeserializeAbsentErrorComponentsAsNull() {
            var deserialized = RequestStatusEntry.fromJson(baseJson(""));

            assertNull(deserialized.errorType());
            assertNull(deserialized.errorStatus());
            assertNull(deserialized.errorTitle());
            assertNull(deserialized.errorInstance());
            assertNull(deserialized.errorViolations());
        }
    }
}
