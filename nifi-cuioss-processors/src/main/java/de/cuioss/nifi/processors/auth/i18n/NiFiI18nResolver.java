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

import de.cuioss.tools.string.MoreStrings;
import org.apache.nifi.logging.ComponentLog;

import java.util.Locale;
import java.util.MissingResourceException;
import java.util.ResourceBundle;

/**
 * Implementation of I18nResolver for NiFi processors.
 * Loads resource bundles and resolves translated strings.
 */
public class NiFiI18nResolver implements I18nResolver {

    private static final String BUNDLE_NAME = "i18n/nifi-cuioss-processors-resources";
    private final ResourceBundle resourceBundle;
    private final ComponentLog logger;

    /**
     * Creates a new NiFiI18nResolver with the specified locale.
     *
     * @param locale The locale to use for translations
     * @param logger The logger to use for logging errors
     */
    private NiFiI18nResolver(Locale locale, ComponentLog logger) {
        this.logger = logger;
        ResourceBundle bundle = null;
        try {
            bundle = ResourceBundle.getBundle(BUNDLE_NAME, locale);
        } catch (MissingResourceException e) {
            if (logger != null) {
                logger.warn("Could not load resource bundle for locale {}: {}", locale, e.getMessage());
            }
            try {
                // Fall back to default locale
                bundle = ResourceBundle.getBundle(BUNDLE_NAME);
            } catch (MissingResourceException e2) {
                if (logger != null) {
                    logger.error("Could not load default resource bundle: {}", e2.getMessage());
                }
            }
        }
        this.resourceBundle = bundle;
    }

    /**
     * Creates a default I18nResolver using the system default locale.
     *
     * @param logger The logger to use for logging errors
     * @return A new I18nResolver
     */
    public static I18nResolver createDefault(ComponentLog logger) {
        return new NiFiI18nResolver(Locale.getDefault(), logger);
    }

    /**
     * Creates an I18nResolver for the specified locale.
     *
     * @param locale The locale to use for translations
     * @return A new I18nResolver
     */
    public static I18nResolver createResolver(Locale locale) {
        return new NiFiI18nResolver(locale, null);
    }

    @Override
    public String getTranslatedString(String key) {
        if (resourceBundle == null) {
            return key;
        }

        try {
            return resourceBundle.getString(key);
        } catch (MissingResourceException e) {
            if (logger != null) {
                logger.debug("No translation found for key: {}", key);
            }
            return key;
        }
    }

    @Override
    public String getTranslatedString(String key, Object... args) {
        String pattern = getTranslatedString(key);
        return MoreStrings.lenientFormat(pattern, args);
    }
}
