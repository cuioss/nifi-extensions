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

import de.cuioss.nifi.rest.RestApiLogMessages;
import de.cuioss.tools.logging.CuiLogger;
import lombok.NonNull;
import org.apache.nifi.distributed.cache.client.AtomicCacheEntry;
import org.apache.nifi.distributed.cache.client.AtomicDistributedMapCacheClient;
import org.apache.nifi.distributed.cache.client.Deserializer;
import org.apache.nifi.distributed.cache.client.DistributedMapCacheClient;
import org.apache.nifi.distributed.cache.client.Serializer;
import org.jspecify.annotations.Nullable;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Optional;

/**
 * Typed wrapper around {@link DistributedMapCacheClient} for storing and retrieving
 * request tracking status entries.
 * <p>
 * Keys are trace IDs (strings), values are JSON-serialized {@link RequestStatusEntry} objects.
 */
public class RequestStatusStore {

    private static final CuiLogger LOGGER = new CuiLogger(RequestStatusStore.class);

    /** Bounded compare-and-swap retries for {@link #updateStatus} before falling back. */
    private static final int MAX_CAS_ATTEMPTS = 5;

    private final DistributedMapCacheClient cacheClient;

    static final Serializer<String> STRING_SERIALIZER = (value, out) ->
            out.write(value.getBytes(StandardCharsets.UTF_8));

    static final Serializer<RequestStatusEntry> ENTRY_SERIALIZER = (value, out) ->
            out.write(value.toJson().getBytes(StandardCharsets.UTF_8));

    static final Deserializer<RequestStatusEntry> ENTRY_DESERIALIZER = bytes -> {
        if (bytes == null || bytes.length == 0) {
            return null;
        }
        String json = new String(bytes, StandardCharsets.UTF_8);
        return RequestStatusEntry.fromJson(json);
    };

    public RequestStatusStore(@NonNull DistributedMapCacheClient cacheClient) {
        this.cacheClient = cacheClient;
    }

    /**
     * Stores a new ACCEPTED status entry for the given trace ID.
     *
     * @param traceId       the unique trace identifier
     * @param parentTraceId optional parent trace ID for chained requests
     * @throws IOException if the cache operation fails
     */
    public void accept(String traceId, @Nullable String parentTraceId) throws IOException {
        var entry = RequestStatusEntry.accepted(traceId, parentTraceId);
        cacheClient.put(traceId, entry, STRING_SERIALIZER, ENTRY_SERIALIZER);
    }

    /**
     * Stores a new COLLECTING_ATTACHMENTS status entry for attachment-tracked routes.
     *
     * @param traceId             the unique trace identifier
     * @param parentTraceId       optional parent trace ID for chained requests
     * @param routeName           the route name for traceability
     * @param attachmentsMaxCount maximum number of attachments allowed
     * @param attachmentsMinCount minimum attachments required before auto-transitioning to PROCESSED
     * @throws IOException if the cache operation fails
     */
    public void collectingAttachments(String traceId, @Nullable String parentTraceId,
            @Nullable String routeName, int attachmentsMaxCount, int attachmentsMinCount) throws IOException {
        var entry = RequestStatusEntry.collectingAttachments(traceId, parentTraceId, routeName, attachmentsMaxCount, attachmentsMinCount);
        cacheClient.put(traceId, entry, STRING_SERIALIZER, ENTRY_SERIALIZER);
    }

    /**
     * Updates the status of an existing entry, preserving all other fields.
     * <p>
     * N16: the update is performed atomically via optimistic compare-and-swap
     * ({@link DistributedMapCacheClient#fetch} + {@link DistributedMapCacheClient#replace}) with a
     * bounded retry, so a concurrent transition (e.g. an attachment auto-transition racing a
     * downstream status write, or two cluster nodes) cannot lose an update. Cache implementations
     * that do not support the atomic primitives (they throw {@link UnsupportedOperationException})
     * fall back to a documented last-writer-wins get-then-put.
     *
     * @param traceId   the trace identifier to update
     * @param newStatus the new status to set
     * @throws IOException if the cache operation fails
     */
    public void updateStatus(String traceId, RequestStatus newStatus) throws IOException {
        if (cacheClient instanceof AtomicDistributedMapCacheClient<?> atomicClient) {
            compareAndSwapUpdate(atomicClient, traceId, newStatus);
            return;
        }
        // Cache client does not support atomic compare-and-swap — documented last-writer-wins.
        lastWriterWinsUpdate(traceId, newStatus);
    }

    private <R> void compareAndSwapUpdate(AtomicDistributedMapCacheClient<R> atomicClient,
            String traceId, RequestStatus newStatus) throws IOException {
        for (int attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt++) {
            AtomicCacheEntry<String, RequestStatusEntry, R> current =
                    atomicClient.fetch(traceId, STRING_SERIALIZER, ENTRY_DESERIALIZER);
            if (current == null || current.getValue() == null) {
                LOGGER.warn(RestApiLogMessages.WARN.STATUS_UPDATE_UNKNOWN_TRACE, traceId);
                return;
            }
            var updated = new AtomicCacheEntry<>(traceId,
                    withStatus(current.getValue(), newStatus),
                    current.getRevision().orElse(null));
            if (atomicClient.replace(updated, STRING_SERIALIZER, ENTRY_SERIALIZER)) {
                return;
            }
            // Another writer committed between the fetch and the replace — retry with a fresh revision.
        }
        // Do NOT fall back to a blind put here: that would clobber the concurrent winner's update,
        // reintroducing the very lost-update the CAS loop guards against.
        LOGGER.warn(RestApiLogMessages.WARN.STATUS_UPDATE_CAS_EXHAUSTED, traceId);
    }

    private void lastWriterWinsUpdate(String traceId, RequestStatus newStatus) throws IOException {
        RequestStatusEntry existing = cacheClient.get(traceId, STRING_SERIALIZER, ENTRY_DESERIALIZER);
        if (existing == null) {
            LOGGER.warn(RestApiLogMessages.WARN.STATUS_UPDATE_UNKNOWN_TRACE, traceId);
            return;
        }
        cacheClient.put(traceId, withStatus(existing, newStatus), STRING_SERIALIZER, ENTRY_SERIALIZER);
    }

    private static RequestStatusEntry withStatus(RequestStatusEntry existing, RequestStatus newStatus) {
        return new RequestStatusEntry(
                existing.traceId(), newStatus, existing.acceptedAt(), Instant.now(),
                existing.parentTraceId(), existing.errorDetail(),
                existing.attachmentsMaxCount(), existing.attachmentsMinCount(), existing.routeName(),
                existing.additionalFields());
    }

    /**
     * Removes the entry for the given trace ID. Used to evict tracking entries that never reached a
     * terminal state — e.g. a queue-full 503 after the entry was persisted, or containers discarded
     * on processor shutdown (M5).
     *
     * @param traceId the trace identifier to remove
     * @throws IOException if the cache operation fails
     */
    public void remove(String traceId) throws IOException {
        cacheClient.remove(traceId, STRING_SERIALIZER);
    }

    /**
     * Retrieves the status entry for the given trace ID.
     *
     * @param traceId the trace identifier to look up
     * @return the status entry, or empty if not found
     * @throws IOException if the cache operation fails
     */
    public Optional<RequestStatusEntry> getStatus(String traceId) throws IOException {
        RequestStatusEntry entry = cacheClient.get(traceId, STRING_SERIALIZER, ENTRY_DESERIALIZER);
        return Optional.ofNullable(entry);
    }
}
