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
package de.cuioss.nifi.jwt.config;

import de.cuioss.tools.concurrent.StripedRingBufferStatistics;
import org.jspecify.annotations.Nullable;

import java.util.List;

/**
 * Immutable snapshot of JWT validation metrics, read from the
 * {@link de.cuioss.sheriff.oauth.core.TokenValidator}'s built-in
 * {@link de.cuioss.sheriff.oauth.core.security.SecurityEventCounter}
 * and performance monitor.
 *
 * @param totalValidations     total number of token validation attempts
 * @param validTokens          number of successful validations
 * @param invalidTokens        number of failed validations
 * @param errorRate            ratio of failed to total validations (0.0 to 1.0)
 * @param topErrors            most frequent error types with counts
 * @param validationStatistics response time percentile statistics, or null
 */
public record MetricsSnapshot(
        long totalValidations,
        long validTokens,
        long invalidTokens,
        double errorRate,
        List<ErrorCount> topErrors,
        @Nullable StripedRingBufferStatistics validationStatistics
) {

    /**
     * Returns an empty metrics snapshot (used when the CS is not enabled).
     */
    public static MetricsSnapshot empty() {
        return new MetricsSnapshot(0, 0, 0, 0.0, List.of(), null);
    }

    /**
     * Error type with its occurrence count.
     *
     * @param error the error description
     * @param count the number of occurrences
     */
    public record ErrorCount(String error, long count) {
    }
}
