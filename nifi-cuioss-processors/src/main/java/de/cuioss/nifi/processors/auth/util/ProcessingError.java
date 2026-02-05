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
package de.cuioss.nifi.processors.auth.util;

import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

/**
 * Value object representing a processing error with all necessary details.
 * This class encapsulates error information for flow file processing failures.
 */
@Value
@Builder
public class ProcessingError {

    /**
     * The error code identifying the type of error.
     */
    @NonNull
    String errorCode;

    /**
     * The human-readable reason for the error.
     */
    @NonNull
    String errorReason;

    /**
     * The category of the error (e.g., EXTRACTION_ERROR, VALIDATION_ERROR).
     */
    @NonNull
    String errorCategory;
}