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
package de.cuioss.nifi.processors.auth.i18n;

/**
 * Interface for resolving internationalized messages.
 * Provides methods to retrieve translated strings based on message keys.
 */
public interface I18nResolver {

    /**
     * Gets a translated string for the given key.
     * 
     * @param key The message key to look up
     * @return The translated string, or the key itself if no translation is found
     */
    String getTranslatedString(String key);

    /**
     * Gets a translated string for the given key with parameter substitution.
     * Parameters in the translated string are represented by {0}, {1}, etc.
     * 
     * @param key The message key to look up
     * @param args The arguments to substitute into the translated string
     * @return The translated string with parameters substituted, or the key itself if no translation is found
     */
    String getTranslatedString(String key, Object... args);
}