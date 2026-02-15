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

import org.apache.nifi.util.MockComponentLog;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Locale;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("NiFiI18nResolver")
class NiFiI18nResolverTest {

    @Nested
    @DisplayName("Factory Methods")
    class FactoryMethodTests {

        @Test
        @DisplayName("Should create resolver with specific locale")
        void shouldCreateResolverWithLocale() {
            // Arrange & Act
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);

            // Assert
            assertNotNull(resolver, "Resolver should be created");
        }

        @Test
        @DisplayName("Should create default resolver with logger")
        void shouldCreateDefaultResolver() {
            // Arrange
            var logger = new MockComponentLog("test", new Object());

            // Act
            I18nResolver resolver = NiFiI18nResolver.createDefault(logger);

            // Assert
            assertNotNull(resolver, "Default resolver should be created");
        }

        @Test
        @DisplayName("Should create resolver with unusual locale and fall back to default bundle")
        void shouldFallbackToDefaultBundleForUnusualLocale() {
            // Arrange
            Locale unusualLocale = Locale.forLanguageTag("xx-YY");

            // Act
            I18nResolver resolver = NiFiI18nResolver.createResolver(unusualLocale);

            // Assert
            assertNotNull(resolver, "Resolver should be created even with unusual locale");
            String result = resolver.getTranslatedString("property.jwks.refresh.interval.name");
            assertNotNull(result, "Should return some value (key or translation)");
        }
    }

    @Nested
    @DisplayName("Translation - Single Argument")
    class SingleArgumentTranslationTests {

        @Test
        @DisplayName("Should return key when key not found in bundle")
        void shouldReturnKeyWhenNotFound() {
            // Arrange
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);
            String nonExistentKey = "this.key.does.not.exist.in.bundle";

            // Act
            String result = resolver.getTranslatedString(nonExistentKey);

            // Assert
            assertEquals(nonExistentKey, result, "Should return the key itself when translation not found");
        }

        @Test
        @DisplayName("Should return translated string for existing key")
        void shouldReturnTranslatedString() {
            // Arrange
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);
            String existingKey = "property.jwks.refresh.interval.name";

            // Act
            String result = resolver.getTranslatedString(existingKey);

            // Assert
            assertNotNull(result, "Translation should not be null");
            assertFalse(result.isEmpty(), "Translation should not be empty");
        }

        @Test
        @DisplayName("Should throw NullPointerException for null key")
        void shouldThrowExceptionForNullKey() {
            // Arrange
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);

            // Act & Assert
            assertThrows(NullPointerException.class,
                    () -> resolver.getTranslatedString(null),
                    "Should throw NullPointerException for null key");
        }
    }

    @Nested
    @DisplayName("Translation - With Arguments")
    class TranslationWithArgumentsTests {

        @Test
        @DisplayName("Should throw NullPointerException for null key with arguments")
        void shouldThrowExceptionForNullKeyWithArgs() {
            // Arrange
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);

            // Act & Assert
            assertThrows(NullPointerException.class,
                    () -> resolver.getTranslatedString(null, "arg1", "arg2"),
                    "Should throw NullPointerException for null key");
        }

        @Test
        @DisplayName("Should format arguments into translated string")
        void shouldFormatArguments() {
            // Arrange
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);
            String key = "property.issuer.jwks.url.description";
            String arg1 = "jwks-url";
            String arg2 = "myIssuer";

            // Act
            String result = resolver.getTranslatedString(key, arg1, arg2);

            // Assert
            assertNotNull(result, "Result should not be null");
            assertTrue(result.contains(arg1) || result.contains(arg2) || result.equals(key),
                    "Result should contain arguments or be the key if not found");
        }

        @Test
        @DisplayName("Should handle formatting for non-existent key with arguments")
        void shouldFormatNonExistentKeyWithArguments() {
            // Arrange
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);
            String nonExistentKey = "non.existent.key.with.placeholder";
            String arg = "testArg";

            // Act
            String result = resolver.getTranslatedString(nonExistentKey, arg);

            // Assert — lenientFormat appends args even when key is returned as-is
            assertTrue(result.contains(nonExistentKey),
                    "Should contain the key when not found in bundle");
        }

        @Test
        @DisplayName("Should handle empty arguments array")
        void shouldHandleEmptyArguments() {
            // Arrange
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);
            String key = "property.jwks.refresh.interval.name";

            // Act
            String result = resolver.getTranslatedString(key);

            // Assert
            assertNotNull(result, "Result should not be null");
        }

        @Test
        @DisplayName("Should handle lenient formatting with mismatched argument count")
        void shouldHandleMismatchedArguments() {
            // Arrange
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);
            String key = "property.issuer.jwks.url.description";

            // Act - provide fewer arguments than placeholders
            String result = resolver.getTranslatedString(key, "onlyOneArg");

            // Assert
            assertNotNull(result, "Should handle mismatched arguments gracefully");
        }
    }

    @Nested
    @DisplayName("Logger Integration")
    class LoggerIntegrationTests {

        @Test
        @DisplayName("Should work without logger")
        void shouldWorkWithoutLogger() {
            // Arrange
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);

            // Act
            String result = resolver.getTranslatedString("property.jwks.refresh.interval.name");

            // Assert
            assertNotNull(result, "Should work without logger");
        }

        @Test
        @DisplayName("Should work with logger provided")
        void shouldWorkWithLogger() {
            // Arrange
            var logger = new MockComponentLog("test", new Object());
            I18nResolver resolver = NiFiI18nResolver.createDefault(logger);

            // Act
            String result = resolver.getTranslatedString("property.jwks.refresh.interval.name");

            // Assert
            assertNotNull(result, "Should work with logger provided");
        }

        @Test
        @DisplayName("Should handle missing key gracefully with logger")
        void shouldHandleMissingKeyWithLogger() {
            // Arrange
            var logger = new MockComponentLog("test", new Object());
            I18nResolver resolver = NiFiI18nResolver.createDefault(logger);
            String missingKey = "this.key.is.missing";

            // Act
            String result = resolver.getTranslatedString(missingKey);

            // Assert
            assertEquals(missingKey, result, "Should return key when missing");
        }
    }
}
