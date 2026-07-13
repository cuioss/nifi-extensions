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
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);

            assertNotNull(resolver, "Resolver should be created");
        }

        @Test
        @DisplayName("Should create default resolver with logger")
        void shouldCreateDefaultResolver() {
            var logger = new MockComponentLog("test", new Object());

            I18nResolver resolver = NiFiI18nResolver.createDefault(logger);

            assertNotNull(resolver, "Default resolver should be created");
        }

        @Test
        @DisplayName("Should create resolver with unusual locale and fall back to default bundle")
        void shouldFallbackToDefaultBundleForUnusualLocale() {
            Locale unusualLocale = Locale.forLanguageTag("xx-YY");

            I18nResolver resolver = NiFiI18nResolver.createResolver(unusualLocale);

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
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);
            String nonExistentKey = "this.key.does.not.exist.in.bundle";

            String result = resolver.getTranslatedString(nonExistentKey);

            assertEquals(nonExistentKey, result, "Should return the key itself when translation not found");
        }

        @Test
        @DisplayName("Should return translated string for existing key")
        void shouldReturnTranslatedString() {
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);
            String existingKey = "property.jwks.refresh.interval.name";

            String result = resolver.getTranslatedString(existingKey);

            assertNotNull(result, "Translation should not be null");
            assertFalse(result.isEmpty(), "Translation should not be empty");
        }

        @Test
        @DisplayName("Should throw NullPointerException for null key")
        void shouldThrowExceptionForNullKey() {
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);

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
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);

            assertThrows(NullPointerException.class,
                    () -> resolver.getTranslatedString(null, "arg1", "arg2"),
                    "Should throw NullPointerException for null key");
        }

        @Test
        @DisplayName("Should format arguments into translated string")
        void shouldFormatArguments() {
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);
            String key = "property.issuer.jwks.url.description";
            String arg1 = "jwks-url";
            String arg2 = "myIssuer";

            String result = resolver.getTranslatedString(key, arg1, arg2);

            assertNotNull(result, "Result should not be null");
            assertTrue(result.contains(arg1) || result.contains(arg2) || result.equals(key),
                    "Result should contain arguments or be the key if not found");
        }

        @Test
        @DisplayName("Should handle formatting for non-existent key with arguments")
        void shouldFormatNonExistentKeyWithArguments() {
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);
            String nonExistentKey = "non.existent.key.with.placeholder";
            String arg = "testArg";

            String result = resolver.getTranslatedString(nonExistentKey, arg);

            // Assert — a missing, placeholder-free key is returned unchanged;
            // MessageFormat leaves it verbatim rather than appending the arguments
            assertTrue(result.contains(nonExistentKey),
                    "Should contain the key when not found in bundle");
        }

        @Test
        @DisplayName("Should fall back to the raw pattern when MessageFormat rejects a malformed pattern")
        void shouldFallBackToRawPatternOnMalformedPattern() {
            // Arrange — a key absent from the bundle is returned verbatim as the
            // pattern; an unbalanced brace makes MessageFormat throw
            // IllegalArgumentException when arguments are supplied.
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);
            String malformed = "malformed pattern {0 with an unbalanced brace";

            // Act
            String result = resolver.getTranslatedString(malformed, "value");

            // Assert — the raw pattern is returned rather than propagating the exception.
            assertEquals(malformed, result,
                    "Malformed pattern should be returned verbatim on formatting failure");
        }

        @Test
        @DisplayName("Should log a warning and fall back to the raw pattern when a logger is present")
        void shouldLogAndFallBackWhenLoggerPresent() {
            // Arrange — createDefault supplies a (non-null) logger, exercising the
            // warn branch of the malformed-pattern fallback.
            var logger = new MockComponentLog("test", new Object());
            I18nResolver resolver = NiFiI18nResolver.createDefault(logger);
            String malformed = "another malformed {0 pattern";

            // Act
            String result = resolver.getTranslatedString(malformed, "value");

            // Assert
            assertEquals(malformed, result,
                    "Malformed pattern should be returned verbatim even with a logger present");
        }

        @Test
        @DisplayName("Should handle empty arguments array")
        void shouldHandleEmptyArguments() {
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);
            String key = "property.jwks.refresh.interval.name";

            String result = resolver.getTranslatedString(key);

            assertNotNull(result, "Result should not be null");
        }

        @Test
        @DisplayName("Should handle lenient formatting with mismatched argument count")
        void shouldHandleMismatchedArguments() {
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);
            String key = "property.issuer.jwks.url.description";

            // Act - provide fewer arguments than placeholders
            String result = resolver.getTranslatedString(key, "onlyOneArg");

            assertNotNull(result, "Should handle mismatched arguments gracefully");
        }
    }

    @Nested
    @DisplayName("Logger Integration")
    class LoggerIntegrationTests {

        @Test
        @DisplayName("Should work without logger")
        void shouldWorkWithoutLogger() {
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);

            String result = resolver.getTranslatedString("property.jwks.refresh.interval.name");

            assertNotNull(result, "Should work without logger");
        }

        @Test
        @DisplayName("Should work with logger provided")
        void shouldWorkWithLogger() {
            var logger = new MockComponentLog("test", new Object());
            I18nResolver resolver = NiFiI18nResolver.createDefault(logger);

            String result = resolver.getTranslatedString("property.jwks.refresh.interval.name");

            assertNotNull(result, "Should work with logger provided");
        }

        @Test
        @DisplayName("Should handle missing key gracefully with logger")
        void shouldHandleMissingKeyWithLogger() {
            var logger = new MockComponentLog("test", new Object());
            I18nResolver resolver = NiFiI18nResolver.createDefault(logger);
            String missingKey = "this.key.is.missing";

            String result = resolver.getTranslatedString(missingKey);

            assertEquals(missingKey, result, "Should return key when missing");
        }
    }

    @Nested
    @DisplayName("MessageFormat Placeholder Substitution")
    class MessageFormatSubstitutionTests {

        @Test
        @DisplayName("Should substitute {0} and {1} placeholders with the supplied arguments")
        void shouldSubstitutePlaceholders() {
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);

            String result = resolver.getTranslatedString(
                    "property.issuer.dynamic.description", "jwks-url", "myIssuer");

            assertEquals("Configuration property 'jwks-url' for issuer 'myIssuer'", result,
                    "MessageFormat placeholders must be replaced with the supplied arguments");
            assertFalse(result.contains("{0}") || result.contains("{1}"),
                    "No raw placeholders should remain after substitution");
        }

        @Test
        @DisplayName("Should collapse doubled single-quotes and substitute placeholders together")
        void shouldRenderDoubledQuotesWithArguments() {
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);

            String result = resolver.getTranslatedString(
                    "property.issuer.jwks.url.description", "jwks-url", "myIssuer");

            assertEquals(
                    "Configuration property 'jwks-url' for issuer 'myIssuer' (URL to JWKS endpoint)",
                    result,
                    "Doubled single-quotes must collapse to one while placeholders are substituted");
        }

        @Test
        @DisplayName("Should return the raw pattern verbatim when the arguments array is empty")
        void shouldReturnPatternVerbatimForEmptyArguments() {
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);

            String result = resolver.getTranslatedString(
                    "property.issuer.dynamic.description", new Object[0]);

            assertEquals("Configuration property ''{0}'' for issuer ''{1}''", result,
                    "With no arguments the pattern must be returned untouched, without "
                            + "MessageFormat quote processing");
        }

        @Test
        @DisplayName("Should return a placeholder-free missing key unchanged when arguments are supplied")
        void shouldReturnMissingKeyUnchangedWithArguments() {
            I18nResolver resolver = NiFiI18nResolver.createResolver(Locale.ENGLISH);
            String missingKey = "missing.key.without.placeholders";

            String result = resolver.getTranslatedString(missingKey, "unusedArg");

            assertEquals(missingKey, result,
                    "A missing key has no placeholders, so MessageFormat returns it unchanged");
        }
    }
}
