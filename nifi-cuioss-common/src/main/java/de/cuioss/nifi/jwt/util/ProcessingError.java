/*
 * Copyright 2023 the original author or authors.
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * <p>
 * https://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package de.cuioss.nifi.jwt.util;

import lombok.Builder;

/**
 * Immutable value object representing a processing error with all necessary details.
 *
 * @param errorCode     the error code identifier
 * @param errorReason   the human-readable error reason
 * @param errorCategory the error category for classification
 */
@Builder
public record ProcessingError(
String errorCode,
String errorReason,
String errorCategory) {
}
