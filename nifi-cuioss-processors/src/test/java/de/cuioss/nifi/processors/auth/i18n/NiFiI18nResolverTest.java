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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Locale;


import org.apache.nifi.logging.ComponentLog;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

/**
 * Test class for {@link NiFiI18nResolver}.
 */
@DisplayName("Tests for NiFiI18nResolver")
class NiFiI18nResolverTest {

    @Mock
    private ComponentLog logger;

    private I18nResolver defaultResolver;
    private I18nResolver germanResolver;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        // Explicitly use English locale for default resolver to ensure consistent test results
        defaultResolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);
        germanResolver = NiFiI18nResolver.createResolver(Locale.GERMAN);
    }

    @Test
    @DisplayName("Should return translated string for existing key")
    void shouldReturnTranslatedStringForExistingKey() {
        // Given a key that exists in the resource bundle
        String key = "error.token.malformed";

        // When getting the translated string
        String result = defaultResolver.getTranslatedString(key);

        // Then it should return the translated string
        assertNotEquals(key, result, "Should return translated string, not the key itself");
        // The actual translation depends on the system locale, but it should contain key parts
        assertTrue(result.contains("malformed") || result.contains("fehlerhaft") || result.contains("fehlt"),
                "Translation should contain expected words");
    }

    @Test
    @DisplayName("Should return key for non-existing key")
    void shouldReturnKeyForNonExistingKey() {
        // Given a key that doesn't exist in the resource bundle
        String key = "non.existing.key";

        // When getting the translated string
        String result = defaultResolver.getTranslatedString(key);

        // Then it should return the key itself
        assertEquals(key, result);
    }

    @Test
    @DisplayName("Should format message with parameters")
    void shouldFormatMessageWithParameters() {
        // Given a key with placeholders
        String key = "error.no.token.found";
        String param = "AUTHORIZATION_HEADER";

        // When getting the translated string with parameters
        String result = defaultResolver.getTranslatedString(key, param);

        // Then it should return the formatted string
        assertTrue(result.contains(param), "Result should contain the parameter");
        // The actual translation depends on the system locale
        assertTrue(result.contains("token") || result.contains("Token"),
                "Result should contain the word 'token' or 'Token'");
    }

    @Test
    @DisplayName("Should return German translation for German locale")
    void shouldReturnGermanTranslationForGermanLocale() {
        // Given a key that exists in both English and German bundles
        String key = "error.token.malformed";

        // When getting the translated string with German locale
        String germanResult = germanResolver.getTranslatedString(key);

        // Then it should contain German words
        assertTrue(germanResult.contains("fehlerhaft") || germanResult.contains("fehlt"),
                "German translation should contain German words");
    }

    @Test
    @DisplayName("Should format message with parameters for German locale")
    void shouldFormatMessageWithParametersForGermanLocale() {
        // Given a key with placeholders
        String key = "error.token.size.limit";
        Integer param = 16384;

        // When getting the translated string with parameters for German locale
        String germanResult = germanResolver.getTranslatedString(key, param);

        // Then it should return the formatted string in German
        // Note: The parameter might be formatted differently in different locales
        // so we check for the presence of the number in some form
        assertTrue(germanResult.contains("16384") || germanResult.contains("16.384"),
                "Result should contain the parameter in some format");
        assertTrue(germanResult.contains("Bytes") || germanResult.contains("Größe") ||
                germanResult.contains("überschreitet"),
                "German translation should contain German words");
    }

    @Test
    @DisplayName("Should handle missing resource bundle gracefully")
    void shouldHandleMissingResourceBundleGracefully() {
        // Given a resolver with a locale that doesn't have a resource bundle
        I18nResolver nonExistingLocaleResolver = NiFiI18nResolver.createResolver(Locale.CHINESE);

        // When getting a translated string
        String key = "error.token.malformed";
        String result = nonExistingLocaleResolver.getTranslatedString(key);

        // Then it should fall back to the default bundle
        assertNotEquals(key, result, "Should fall back to default bundle");
    }

    @Test
    @DisplayName("Should handle formatting errors gracefully")
    void shouldHandleFormattingErrorsGracefully() {
        // Given a key with placeholders
        String key = "error.token.size.limit";

        // When getting the translated string with wrong number of parameters
        String result = defaultResolver.getTranslatedString(key); // Missing required parameter

        // Then it should handle the error gracefully
        assertNotEquals(key, result, "Should return the pattern even if formatting fails");
    }
}
