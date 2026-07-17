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
import org.apache.nifi.distributed.cache.client.AtomicCacheEntry;
import org.apache.nifi.distributed.cache.client.AtomicDistributedMapCacheClient;
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
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("RequestStatusStore")
// S5786: this class stays public because its nested InMemoryMapCacheClient test double is shared
// cross-package (RestApiGatewayProcessorTest in de.cuioss.nifi.rest); a package-private outer class
// would make the public nested double unreachable from that package.
@SuppressWarnings("java:S5786")
public class RequestStatusStoreTest {

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
            String traceId = UUID.randomUUID().toString();

            store.accept(traceId, null);
            var result = store.getStatus(traceId);

            assertTrue(result.isPresent());
            assertEquals(traceId, result.get().traceId());
            assertEquals(RequestStatus.ACCEPTED, result.get().status());
            assertNull(result.get().parentTraceId());
        }

        @Test
        @DisplayName("Should store with parentTraceId")
        void shouldStoreWithParentTraceId() throws Exception {
            String traceId = UUID.randomUUID().toString();
            String parentTraceId = UUID.randomUUID().toString();

            store.accept(traceId, parentTraceId);
            var result = store.getStatus(traceId);

            assertTrue(result.isPresent());
            assertEquals(parentTraceId, result.get().parentTraceId());
        }

        @Test
        @DisplayName("Should return empty for unknown traceId")
        void shouldReturnEmptyForUnknownTraceId() throws Exception {
            var result = store.getStatus(UUID.randomUUID().toString());

            assertTrue(result.isEmpty());
        }

        @Test
        @DisplayName("Should store COLLECTING_ATTACHMENTS entry")
        void shouldStoreCollectingAttachmentsEntry() throws Exception {
            String traceId = UUID.randomUUID().toString();

            store.collectingAttachments(traceId, null, "upload", 5, 1);
            var result = store.getStatus(traceId);

            assertTrue(result.isPresent());
            assertEquals(RequestStatus.COLLECTING_ATTACHMENTS, result.get().status());
            assertEquals("upload", result.get().routeName());
            assertEquals(5, result.get().attachmentsMaxCount());
        }

        @Test
        @DisplayName("Should update status preserving other fields")
        void shouldUpdateStatusPreservingOtherFields() throws Exception {
            String traceId = UUID.randomUUID().toString();
            store.collectingAttachments(traceId, null, "upload", 5, 1);

            store.updateStatus(traceId, RequestStatus.PROCESSING);
            var result = store.getStatus(traceId);

            assertTrue(result.isPresent());
            assertEquals(RequestStatus.PROCESSING, result.get().status());
            assertEquals("upload", result.get().routeName());
            assertEquals(5, result.get().attachmentsMaxCount());
            assertEquals(1, result.get().attachmentsMinCount());
        }

        @Test
        @DisplayName("Should preserve additional fields across a status transition")
        void shouldPreserveAdditionalFieldsAcrossStatusTransition() throws Exception {
            String traceId = UUID.randomUUID().toString();
            Map<String, String> extras = new LinkedHashMap<>();
            extras.put("tenant", "acme");
            extras.put("priority", "5");
            var entry = new RequestStatusEntry(traceId, RequestStatus.COLLECTING_ATTACHMENTS,
                    Instant.now(), Instant.now(), null, null, 5, 1, "upload", extras);
            cacheClient.put(traceId, entry,
                    RequestStatusStore.STRING_SERIALIZER, RequestStatusStore.ENTRY_SERIALIZER);

            store.updateStatus(traceId, RequestStatus.PROCESSING);
            var result = store.getStatus(traceId);

            assertTrue(result.isPresent());
            assertEquals(RequestStatus.PROCESSING, result.get().status());
            assertEquals(extras, result.get().additionalFields());
        }

        @Test
        @DisplayName("Should handle updateStatus for unknown traceId gracefully")
        void shouldHandleUpdateStatusForUnknownTraceId() {
            // Act & Assert — should not throw
            assertDoesNotThrow(() ->
                    store.updateStatus(UUID.randomUUID().toString(), RequestStatus.PROCESSING));
        }

        @Test
        @DisplayName("Should remove an entry (M5 — evict leaked tracking entries)")
        void shouldRemoveEntry() throws Exception {
            String traceId = UUID.randomUUID().toString();
            store.accept(traceId, null);
            assertTrue(store.getStatus(traceId).isPresent());

            store.remove(traceId);

            assertTrue(store.getStatus(traceId).isEmpty());
        }

        @Test
        @DisplayName("Should not fail removing an unknown traceId")
        void shouldNotFailRemovingUnknownTraceId() {
            assertDoesNotThrow(() -> store.remove(UUID.randomUUID().toString()));
        }
    }

    @Nested
    @DisplayName("Atomic Update (N16 — compare-and-swap)")
    class AtomicUpdate {

        @Test
        @DisplayName("Should update status via compare-and-swap when the client is atomic")
        void shouldUpdateStatusViaCompareAndSwap() throws Exception {
            var atomicClient = new InMemoryAtomicMapCacheClient();
            var atomicStore = new RequestStatusStore(atomicClient);
            String traceId = UUID.randomUUID().toString();
            atomicStore.collectingAttachments(traceId, null, "upload", 5, 1);
            long revisionBefore = atomicClient.revisionOf(traceId);

            atomicStore.updateStatus(traceId, RequestStatus.PROCESSED);

            var result = atomicStore.getStatus(traceId);
            assertTrue(result.isPresent());
            assertEquals(RequestStatus.PROCESSED, result.get().status());
            assertEquals("upload", result.get().routeName());
            assertEquals(5, result.get().attachmentsMaxCount());
            assertTrue(atomicClient.revisionOf(traceId) > revisionBefore,
                    "compare-and-swap must bump the cache revision");
        }

        @Test
        @DisplayName("Should not lose sequential updates on an atomic client")
        void shouldNotLoseSequentialUpdates() throws Exception {
            var atomicClient = new InMemoryAtomicMapCacheClient();
            var atomicStore = new RequestStatusStore(atomicClient);
            String traceId = UUID.randomUUID().toString();
            atomicStore.accept(traceId, null);

            atomicStore.updateStatus(traceId, RequestStatus.PROCESSING);
            atomicStore.updateStatus(traceId, RequestStatus.PROCESSED);

            var result = atomicStore.getStatus(traceId);
            assertTrue(result.isPresent());
            assertEquals(RequestStatus.PROCESSED, result.get().status());
        }

        @Test
        @DisplayName("Should handle atomic update for unknown traceId gracefully")
        void shouldHandleAtomicUpdateForUnknownTraceId() {
            var atomicStore = new RequestStatusStore(new InMemoryAtomicMapCacheClient());
            assertDoesNotThrow(() ->
                    atomicStore.updateStatus(UUID.randomUUID().toString(), RequestStatus.PROCESSING));
        }
    }

    @Nested
    @DisplayName("Serialization")
    class Serialization {

        @Test
        @DisplayName("Should serialize string key correctly")
        void shouldSerializeStringKey() throws Exception {
            String key = "test-key";
            var out = new ByteArrayOutputStream();

            RequestStatusStore.STRING_SERIALIZER.serialize(key, out);

            assertEquals(key, out.toString(StandardCharsets.UTF_8));
        }

        @Test
        @DisplayName("Should serialize and deserialize entry round-trip")
        void shouldSerializeDeserializeEntryRoundTrip() throws Exception {
            var entry = RequestStatusEntry.accepted(UUID.randomUUID().toString(), null);
            var out = new ByteArrayOutputStream();

            RequestStatusStore.ENTRY_SERIALIZER.serialize(entry, out);
            var deserialized = RequestStatusStore.ENTRY_DESERIALIZER.deserialize(out.toByteArray());

            assertNotNull(deserialized);
            assertEquals(entry.traceId(), deserialized.traceId());
            assertEquals(entry.status(), deserialized.status());
        }

        @Test
        @DisplayName("Should return null for empty byte array")
        void shouldReturnNullForEmptyBytes() throws Exception {
            var result = RequestStatusStore.ENTRY_DESERIALIZER.deserialize(new byte[0]);

            assertNull(result);
        }

        @Test
        @DisplayName("Should return null for null byte array")
        void shouldReturnNullForNullBytes() throws Exception {
            var result = RequestStatusStore.ENTRY_DESERIALIZER.deserialize(null);

            assertNull(result);
        }
    }

    /**
     * Simple in-memory implementation of DistributedMapCacheClient for testing.
     * Extends AbstractControllerService to satisfy NiFi's ControllerService contract.
     */
    public static class InMemoryMapCacheClient extends AbstractControllerService implements DistributedMapCacheClient {

        protected final Map<String, byte[]> store = new HashMap<>();

        /** Test helper: number of entries currently stored (used to assert no leaked entries). */
        int size() {
            return store.size();
        }

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

        protected <T> String serializeToString(T value, Serializer<T> serializer) throws IOException {
            var out = new ByteArrayOutputStream();
            serializer.serialize(value, out);
            return out.toString(StandardCharsets.UTF_8);
        }

        protected <T> byte[] serializeToBytes(T value, Serializer<T> serializer) throws IOException {
            var out = new ByteArrayOutputStream();
            serializer.serialize(value, out);
            return out.toByteArray();
        }
    }

    /**
     * In-memory client that additionally implements the atomic fetch/replace contract so the
     * {@link RequestStatusStore#updateStatus} compare-and-swap path (N16) can be exercised. Each
     * key carries a monotonically increasing revision; {@code replace} only succeeds when the
     * supplied revision matches the stored one (optimistic concurrency).
     */
    static class InMemoryAtomicMapCacheClient extends InMemoryMapCacheClient
            implements AtomicDistributedMapCacheClient<Long> {

        private final Map<String, Long> revisions = new HashMap<>();

        long revisionOf(String key) {
            return revisions.getOrDefault(key, 0L);
        }

        @Override
        public <K, V> void put(K key, V value, Serializer<K> keySerializer,
                Serializer<V> valueSerializer) throws IOException {
            String k = serializeToString(key, keySerializer);
            super.put(key, value, keySerializer, valueSerializer);
            revisions.merge(k, 1L, Long::sum);
        }

        @Override
        public <K, V> AtomicCacheEntry<K, V, Long> fetch(K key, Serializer<K> keySerializer,
                Deserializer<V> valueDeserializer) throws IOException {
            String k = serializeToString(key, keySerializer);
            byte[] bytes = store.get(k);
            if (bytes == null) {
                return null;
            }
            return new AtomicCacheEntry<>(key, valueDeserializer.deserialize(bytes), revisions.getOrDefault(k, 0L));
        }

        @Override
        public <K, V> boolean replace(AtomicCacheEntry<K, V, Long> entry, Serializer<K> keySerializer,
                Serializer<V> valueSerializer) throws IOException {
            String k = serializeToString(entry.getKey(), keySerializer);
            Long expected = entry.getRevision().orElse(null);
            Long actual = revisions.get(k);
            if (expected == null ? store.containsKey(k) : !Objects.equals(expected, actual)) {
                return false;
            }
            store.put(k, serializeToBytes(entry.getValue(), valueSerializer));
            revisions.merge(k, 1L, Long::sum);
            return true;
        }
    }
}
