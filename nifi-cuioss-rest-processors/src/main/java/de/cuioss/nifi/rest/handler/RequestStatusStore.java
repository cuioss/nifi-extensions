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

import de.cuioss.tools.logging.CuiLogger;
import lombok.NonNull;
import org.apache.nifi.distributed.cache.client.Deserializer;
import org.apache.nifi.distributed.cache.client.DistributedMapCacheClient;
import org.apache.nifi.distributed.cache.client.Serializer;
import org.jspecify.annotations.Nullable;

import java.io.IOException;
import java.io.OutputStream;
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
     * Stores a new ACCEPTED status entry with attachment metadata.
     *
     * @param traceId             the unique trace identifier
     * @param parentTraceId       optional parent trace ID for chained requests
     * @param routeName           the route name for traceability
     * @param attachmentsMaxCount maximum number of attachments allowed
     * @throws IOException if the cache operation fails
     */
    public void accept(String traceId, @Nullable String parentTraceId,
            @Nullable String routeName, int attachmentsMaxCount) throws IOException {
        var entry = RequestStatusEntry.accepted(traceId, parentTraceId, routeName, attachmentsMaxCount);
        cacheClient.put(traceId, entry, STRING_SERIALIZER, ENTRY_SERIALIZER);
    }

    /**
     * Stores a new COLLECTING_ATTACHMENTS status entry for attachment-tracked routes.
     *
     * @param traceId             the unique trace identifier
     * @param parentTraceId       optional parent trace ID for chained requests
     * @param routeName           the route name for traceability
     * @param attachmentsMaxCount maximum number of attachments allowed
     * @throws IOException if the cache operation fails
     */
    public void collectingAttachments(String traceId, @Nullable String parentTraceId,
            @Nullable String routeName, int attachmentsMaxCount) throws IOException {
        var entry = RequestStatusEntry.collectingAttachments(traceId, parentTraceId, routeName, attachmentsMaxCount);
        cacheClient.put(traceId, entry, STRING_SERIALIZER, ENTRY_SERIALIZER);
    }

    /**
     * Updates the status of an existing entry, preserving all other fields.
     *
     * @param traceId   the trace identifier to update
     * @param newStatus the new status to set
     * @throws IOException if the cache operation fails
     */
    public void updateStatus(String traceId, RequestStatus newStatus) throws IOException {
        RequestStatusEntry existing = cacheClient.get(traceId, STRING_SERIALIZER, ENTRY_DESERIALIZER);
        if (existing == null) {
            LOGGER.warn("Cannot update status for unknown traceId '%s'", traceId);
            return;
        }
        var updated = new RequestStatusEntry(
                existing.traceId(), newStatus, existing.acceptedAt(), Instant.now(),
                existing.parentTraceId(), existing.errorDetail(),
                existing.attachmentsMaxCount(), existing.routeName());
        cacheClient.put(traceId, updated, STRING_SERIALIZER, ENTRY_SERIALIZER);
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
