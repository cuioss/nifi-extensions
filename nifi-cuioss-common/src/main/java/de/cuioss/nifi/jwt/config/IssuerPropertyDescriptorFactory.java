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

import de.cuioss.nifi.jwt.i18n.I18nResolver;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.processor.util.StandardValidators;

import java.util.Objects;

import static de.cuioss.nifi.jwt.JWTPropertyKeys.Issuer;
import static de.cuioss.nifi.jwt.JWTTranslationKeys.Property;

/**
 * Factory class for creating issuer-specific property descriptors.
 */
public class IssuerPropertyDescriptorFactory {

    private final I18nResolver i18nResolver;

    public IssuerPropertyDescriptorFactory(I18nResolver i18nResolver) {
        this.i18nResolver = Objects.requireNonNull(i18nResolver, "i18nResolver must not be null");
    }

    public PropertyDescriptor createDescriptor(String propertyDescriptorName,
            String issuerName, String propertyKey, String displayName) {
        Objects.requireNonNull(propertyDescriptorName, "propertyDescriptorName must not be null");
        Objects.requireNonNull(issuerName, "issuerName must not be null");
        Objects.requireNonNull(propertyKey, "propertyKey must not be null");
        Objects.requireNonNull(displayName, "displayName must not be null");
        return switch (propertyKey) {
            case Issuer.JWKS_TYPE -> createJwksTypeDescriptor(propertyDescriptorName, displayName);
            case Issuer.JWKS_URL -> createJwksUrlDescriptor(propertyDescriptorName, displayName, issuerName, propertyKey);
            case Issuer.JWKS_FILE -> createJwksFileDescriptor(propertyDescriptorName, displayName);
            case Issuer.JWKS_CONTENT -> createJwksContentDescriptor(propertyDescriptorName, displayName);
            case Issuer.ISSUER_NAME -> createIssuerNameDescriptor(propertyDescriptorName, displayName, issuerName, propertyKey);
            case Issuer.AUDIENCE, Issuer.CLIENT_ID -> createAudienceOrClientIdDescriptor(propertyDescriptorName, displayName, issuerName, propertyKey);
            default -> createDefaultDescriptor(propertyDescriptorName);
        };
    }

    private PropertyDescriptor createJwksTypeDescriptor(String name, String displayName) {
        return new PropertyDescriptor.Builder().name(name).displayName(displayName)
                .description("JWKS source type for this issuer (url, file, or memory)")
                .required(false).dynamic(true).allowableValues("url", "file", "memory").defaultValue("url").build();
    }

    private PropertyDescriptor createJwksUrlDescriptor(String name, String displayName, String issuerName, String propertyKey) {
        return new PropertyDescriptor.Builder().name(name).displayName(displayName)
                .description(i18nResolver.getTranslatedString(Property.Issuer.JWKS_URL_DESCRIPTION, propertyKey, issuerName))
                .required(false).dynamic(true).addValidator(StandardValidators.URL_VALIDATOR).build();
    }

    private PropertyDescriptor createJwksFileDescriptor(String name, String displayName) {
        return new PropertyDescriptor.Builder().name(name).displayName(displayName)
                .description("File path to JWKS JSON file for this issuer")
                .required(false).dynamic(true).addValidator(StandardValidators.FILE_EXISTS_VALIDATOR).build();
    }

    private PropertyDescriptor createJwksContentDescriptor(String name, String displayName) {
        return new PropertyDescriptor.Builder().name(name).displayName(displayName)
                .description("JWKS JSON content for this issuer (for in-memory configuration)")
                .required(false).dynamic(true).addValidator(StandardValidators.NON_EMPTY_VALIDATOR).build();
    }

    private PropertyDescriptor createIssuerNameDescriptor(String name, String displayName, String issuerName, String propertyKey) {
        return new PropertyDescriptor.Builder().name(name).displayName(displayName)
                .description(i18nResolver.getTranslatedString(Property.Issuer.ISSUER_DESCRIPTION, propertyKey, issuerName))
                .required(false).dynamic(true).addValidator(StandardValidators.NON_EMPTY_VALIDATOR).build();
    }

    private PropertyDescriptor createAudienceOrClientIdDescriptor(String name, String displayName, String issuerName, String propertyKey) {
        String descriptionKey = Issuer.AUDIENCE.equals(propertyKey) ? Property.Issuer.AUDIENCE_DESCRIPTION : Property.Issuer.CLIENT_ID_DESCRIPTION;
        return new PropertyDescriptor.Builder().name(name).displayName(displayName)
                .description(i18nResolver.getTranslatedString(descriptionKey, propertyKey, issuerName))
                .required(false).dynamic(true).addValidator(StandardValidators.NON_EMPTY_VALIDATOR).build();
    }

    private PropertyDescriptor createDefaultDescriptor(String name) {
        return new PropertyDescriptor.Builder().name(name).displayName(name)
                .description("Dynamic property for issuer configuration")
                .required(false).dynamic(true).addValidator(StandardValidators.NON_EMPTY_VALIDATOR).build();
    }
}
