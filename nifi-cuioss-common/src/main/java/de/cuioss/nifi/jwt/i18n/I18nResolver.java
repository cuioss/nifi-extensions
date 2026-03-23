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
package de.cuioss.nifi.jwt.i18n;

/**
 * Interface for resolving internationalized messages.
 */
public interface I18nResolver {

    /**
     * Resolves a translated message for the given key.
     *
     * @param key the message key (must not be null)
     * @return the translated message, or the key itself if no translation is found
     */
    String getTranslatedString(String key);

    /**
     * Resolves a translated message for the given key and formats it with the provided arguments.
     *
     * @param key  the message key (must not be null)
     * @param args arguments referenced by format specifiers in the message template
     * @return the formatted translated message
     */
    String getTranslatedString(String key, Object... args);
}
