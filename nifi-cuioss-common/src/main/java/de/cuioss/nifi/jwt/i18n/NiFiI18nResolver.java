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

import de.cuioss.tools.string.MoreStrings;
import org.apache.nifi.logging.ComponentLog;
import org.jspecify.annotations.Nullable;

import java.util.Locale;
import java.util.MissingResourceException;
import java.util.Objects;
import java.util.ResourceBundle;

/**
 * Implementation of I18nResolver for NiFi components.
 */
public class NiFiI18nResolver implements I18nResolver {

    private static final String BUNDLE_NAME = "i18n/nifi-cuioss-common-resources";
    @Nullable private final ResourceBundle resourceBundle;
    @Nullable private final ComponentLog logger;

    private NiFiI18nResolver(Locale locale, @Nullable ComponentLog logger) {
        this.logger = logger;
        ResourceBundle bundle = null;
        try {
            bundle = ResourceBundle.getBundle(BUNDLE_NAME, locale);
        } catch (MissingResourceException e) {
            if (logger != null) {
                logger.warn("Could not load resource bundle for locale {}: {}", locale, e.getMessage());
            }
            try {
                bundle = ResourceBundle.getBundle(BUNDLE_NAME);
            } catch (MissingResourceException e2) {
                if (logger != null) {
                    logger.error("Could not load default resource bundle: {}", e2.getMessage());
                }
            }
        }
        this.resourceBundle = bundle;
    }

    public static I18nResolver createDefault(ComponentLog logger) {
        return new NiFiI18nResolver(Locale.getDefault(), logger);
    }

    public static I18nResolver createResolver(Locale locale) {
        return new NiFiI18nResolver(locale, null);
    }

    @Override
    public String getTranslatedString(String key) {
        Objects.requireNonNull(key, "key must not be null");
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
        Objects.requireNonNull(key, "key must not be null");
        String pattern = getTranslatedString(key);
        return MoreStrings.lenientFormat(pattern, args);
    }
}
