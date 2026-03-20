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

import org.apache.nifi.controller.AbstractControllerService;
import org.apache.nifi.distributed.cache.client.Deserializer;
import org.apache.nifi.distributed.cache.client.DistributedMapCacheClient;
import org.apache.nifi.distributed.cache.client.Serializer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("RequestStatusStore")
class RequestStatusStoreTest {

    private InMemoryMapCacheClient cacheClient;
    private RequestStatusStore store;

    @BeforeEach
    void setUp() {
        cacheClient = new InMemoryMapCacheClient();
        store = new RequestStatusStore(cacheClient);
    }

    @Nested
    @DisplayName("Accept and Query")
    class AcceptAndQuery {

        @Test
        @DisplayName("Should store and retrieve ACCEPTED entry")
        void shouldStoreAndRetrieveAcceptedEntry() throws Exception {
            // Arrange
            String traceId = UUID.randomUUID().toString();

            // Act
            store.accept(traceId, null);
            var result = store.getStatus(traceId);

            // Assert
            assertTrue(result.isPresent());
            assertEquals(traceId, result.get().traceId());
            assertEquals(RequestStatus.ACCEPTED, result.get().status());
            assertNull(result.get().parentTraceId());
        }

        @Test
        @DisplayName("Should store with parentTraceId")
        void shouldStoreWithParentTraceId() throws Exception {
            // Arrange
            String traceId = UUID.randomUUID().toString();
            String parentTraceId = UUID.randomUUID().toString();

            // Act
            store.accept(traceId, parentTraceId);
            var result = store.getStatus(traceId);

            // Assert
            assertTrue(result.isPresent());
            assertEquals(parentTraceId, result.get().parentTraceId());
        }

        @Test
        @DisplayName("Should return empty for unknown traceId")
        void shouldReturnEmptyForUnknownTraceId() throws Exception {
            // Act
            var result = store.getStatus(UUID.randomUUID().toString());

            // Assert
            assertTrue(result.isEmpty());
        }

        @Test
        @DisplayName("Should store COLLECTING_ATTACHMENTS entry")
        void shouldStoreCollectingAttachmentsEntry() throws Exception {
            // Arrange
            String traceId = UUID.randomUUID().toString();

            // Act
            store.collectingAttachments(traceId, null, "upload", 5, 1);
            var result = store.getStatus(traceId);

            // Assert
            assertTrue(result.isPresent());
            assertEquals(RequestStatus.COLLECTING_ATTACHMENTS, result.get().status());
            assertEquals("upload", result.get().routeName());
            assertEquals(5, result.get().attachmentsMaxCount());
        }

        @Test
        @DisplayName("Should update status preserving other fields")
        void shouldUpdateStatusPreservingOtherFields() throws Exception {
            // Arrange
            String traceId = UUID.randomUUID().toString();
            store.collectingAttachments(traceId, null, "upload", 5, 1);

            // Act
            store.updateStatus(traceId, RequestStatus.PROCESSING);
            var result = store.getStatus(traceId);

            // Assert
            assertTrue(result.isPresent());
            assertEquals(RequestStatus.PROCESSING, result.get().status());
            assertEquals("upload", result.get().routeName());
            assertEquals(5, result.get().attachmentsMaxCount());
            assertEquals(1, result.get().attachmentsMinCount());
        }

        @Test
        @DisplayName("Should handle updateStatus for unknown traceId gracefully")
        void shouldHandleUpdateStatusForUnknownTraceId() throws Exception {
            // Act & Assert — should not throw
            store.updateStatus(UUID.randomUUID().toString(), RequestStatus.PROCESSING);
        }
    }

    @Nested
    @DisplayName("Serialization")
    class Serialization {

        @Test
        @DisplayName("Should serialize string key correctly")
        void shouldSerializeStringKey() throws Exception {
            // Arrange
            String key = "test-key";
            var out = new ByteArrayOutputStream();

            // Act
            RequestStatusStore.STRING_SERIALIZER.serialize(key, out);

            // Assert
            assertEquals(key, out.toString(StandardCharsets.UTF_8));
        }

        @Test
        @DisplayName("Should serialize and deserialize entry round-trip")
        void shouldSerializeDeserializeEntryRoundTrip() throws Exception {
            // Arrange
            var entry = RequestStatusEntry.accepted(UUID.randomUUID().toString(), null);
            var out = new ByteArrayOutputStream();

            // Act
            RequestStatusStore.ENTRY_SERIALIZER.serialize(entry, out);
            var deserialized = RequestStatusStore.ENTRY_DESERIALIZER.deserialize(out.toByteArray());

            // Assert
            assertNotNull(deserialized);
            assertEquals(entry.traceId(), deserialized.traceId());
            assertEquals(entry.status(), deserialized.status());
        }

        @Test
        @DisplayName("Should return null for empty byte array")
        void shouldReturnNullForEmptyBytes() throws Exception {
            // Act
            var result = RequestStatusStore.ENTRY_DESERIALIZER.deserialize(new byte[0]);

            // Assert
            assertNull(result);
        }

        @Test
        @DisplayName("Should return null for null byte array")
        void shouldReturnNullForNullBytes() throws Exception {
            // Act
            var result = RequestStatusStore.ENTRY_DESERIALIZER.deserialize(null);

            // Assert
            assertNull(result);
        }
    }

    /**
     * Simple in-memory implementation of DistributedMapCacheClient for testing.
     * Extends AbstractControllerService to satisfy NiFi's ControllerService contract.
     */
    static class InMemoryMapCacheClient extends AbstractControllerService implements DistributedMapCacheClient {

        private final Map<String, byte[]> store = new HashMap<>();

        @Override
        public <K, V> boolean putIfAbsent(K key, V value, Serializer<K> keySerializer,
                Serializer<V> valueSerializer) throws IOException {
            String k = serializeToString(key, keySerializer);
            if (store.containsKey(k)) {
                return false;
            }
            store.put(k, serializeToBytes(value, valueSerializer));
            return true;
        }

        @Override
        public <K, V> V getAndPutIfAbsent(K key, V value, Serializer<K> keySerializer,
                Serializer<V> valueSerializer, Deserializer<V> valueDeserializer) throws IOException {
            String k = serializeToString(key, keySerializer);
            byte[] existing = store.get(k);
            if (existing != null) {
                return valueDeserializer.deserialize(existing);
            }
            store.put(k, serializeToBytes(value, valueSerializer));
            return null;
        }

        @Override
        public <K> boolean containsKey(K key, Serializer<K> keySerializer) throws IOException {
            return store.containsKey(serializeToString(key, keySerializer));
        }

        @Override
        public <K, V> void put(K key, V value, Serializer<K> keySerializer,
                Serializer<V> valueSerializer) throws IOException {
            store.put(serializeToString(key, keySerializer), serializeToBytes(value, valueSerializer));
        }

        @Override
        public <K, V> V get(K key, Serializer<K> keySerializer,
                Deserializer<V> valueDeserializer) throws IOException {
            String k = serializeToString(key, keySerializer);
            byte[] bytes = store.get(k);
            if (bytes == null) {
                return null;
            }
            return valueDeserializer.deserialize(bytes);
        }

        @Override
        public void close() {
            store.clear();
        }

        @Override
        public <K> boolean remove(K key, Serializer<K> keySerializer) throws IOException {
            return store.remove(serializeToString(key, keySerializer)) != null;
        }

        private <T> String serializeToString(T value, Serializer<T> serializer) throws IOException {
            var out = new ByteArrayOutputStream();
            serializer.serialize(value, out);
            return out.toString(StandardCharsets.UTF_8);
        }

        private <T> byte[] serializeToBytes(T value, Serializer<T> serializer) throws IOException {
            var out = new ByteArrayOutputStream();
            serializer.serialize(value, out);
            return out.toByteArray();
        }
    }
}
