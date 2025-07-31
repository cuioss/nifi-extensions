/**
 * I18nKeys constants class for type-safe internationalization key access.
 * This module provides centralized constant definitions for all translation keys
 * used throughout the JWT Authenticator UI.
 * 
 * @fileoverview Type-safe internationalization key constants
 * @author CUIOSS Team
 * @since 1.0.0
 */
'use strict';

/**
 * Centralized internationalization key constants.
 * These constants provide type safety and IDE autocomplete support
 * for internationalization keys used throughout the application.
 * 
 * @readonly
 * @enum {string}
 */
export const I18nKeys = Object.freeze({
    // Common UI Text
    COMMON_LOADING: 'common.loading',
    COMMON_ERROR: 'common.error',
    COMMON_SUCCESS: 'common.success',
    COMMON_SAVE: 'common.save',
    COMMON_CANCEL: 'common.cancel',
    COMMON_ADD: 'common.add',
    COMMON_REMOVE: 'common.remove',
    COMMON_EDIT: 'common.edit',
    COMMON_VERIFY: 'common.verify',
    COMMON_DETAILS: 'common.details',
    COMMON_NAME: 'common.name',
    COMMON_VALUE: 'common.value',
    COMMON_YES: 'common.yes',
    COMMON_NO: 'common.no',

    // JWT Validator
    JWT_VALIDATOR_TITLE: 'jwt.validator.title',
    JWT_VALIDATOR_LOADING: 'jwt.validator.loading',
    JWT_VALIDATOR_METRICS_TITLE: 'jwt.validator.metrics.title',
    JWT_VALIDATOR_METRICS_TAB_NAME: 'jwt.validator.metrics.tab.name',
    JWT_VALIDATOR_HELP_TITLE: 'jwt.validator.help.title',
    JWT_VALIDATOR_HELP_TAB_NAME: 'jwt.validator.help.tab.name',

    // Token Verification
    TOKEN_VERIFICATION_TITLE: 'token.verification.title',
    TOKEN_VERIFICATION_INPUT_LABEL: 'token.verification.input.label',
    TOKEN_VERIFICATION_BUTTON: 'token.verification.button',
    TOKEN_VERIFICATION_VALID: 'token.verification.valid',
    TOKEN_VERIFICATION_INVALID: 'token.verification.invalid',
    TOKEN_VERIFICATION_ERROR: 'token.verification.error',
    TOKEN_VERIFICATION_LOADING: 'token.verification.loading',
    TOKEN_VERIFICATION_DETAILS: 'token.verification.details',
    TOKEN_VERIFICATION_CLAIMS: 'token.verification.claims',
    TOKEN_VERIFICATION_RAW: 'token.verification.raw',

    // JWKS Validation
    JWKS_VALIDATION_TITLE: 'jwks.validation.title',
    JWKS_VALIDATION_BUTTON: 'jwks.validation.button',
    JWKS_VALIDATION_SUCCESS: 'jwks.validation.success',
    JWKS_VALIDATION_ERROR: 'jwks.validation.error',
    PROCESSOR_JWT_FAILED: 'processor.jwt.failed',
    PROCESSOR_JWT_OK: 'processor.jwt.ok',

    // Issuer Configuration
    ISSUER_CONFIG_TITLE: 'issuer.config.title',
    ISSUER_CONFIG_ADD: 'issuer.config.add',
    ISSUER_CONFIG_REMOVE: 'issuer.config.remove',
    ISSUER_CONFIG_SAVE: 'issuer.config.save',
    ISSUER_CONFIG_ISSUER_NAME: 'issuer.config.issuer.name',
    ISSUER_CONFIG_ISSUER_URL: 'issuer.config.issuer.url',
    ISSUER_CONFIG_JWKS_URL: 'issuer.config.jwks.url',
    ISSUER_CONFIG_AUDIENCE: 'issuer.config.audience',
    ISSUER_CONFIG_CLAIM_MAPPINGS: 'issuer.config.claim.mappings',

    // Property Help Text
    PROPERTY_TOKEN_LOCATION_HELP: 'property.token.location.help',
    PROPERTY_TOKEN_HEADER_HELP: 'property.token.header.help',
    PROPERTY_CUSTOM_HEADER_NAME_HELP: 'property.custom.header.name.help',
    PROPERTY_BEARER_TOKEN_PREFIX_HELP: 'property.bearer.token.prefix.help',
    PROPERTY_REQUIRE_VALID_TOKEN_HELP: 'property.require.valid.token.help',
    PROPERTY_JWKS_REFRESH_INTERVAL_HELP: 'property.jwks.refresh.interval.help',
    PROPERTY_MAXIMUM_TOKEN_SIZE_HELP: 'property.maximum.token.size.help',
    PROPERTY_ALLOWED_ALGORITHMS_HELP: 'property.allowed.algorithms.help',
    PROPERTY_REQUIRE_HTTPS_JWKS_HELP: 'property.require.https.jwks.help',

    // Test-only key
    TEST_ONLY_IN_ENGLISH: 'test.onlyInEnglish'
});

/**
 * Helper function to validate that a key exists in the I18nKeys constants.
 * 
 * @param {string} key - The key to validate
 * @returns {boolean} True if the key exists in I18nKeys
 */
export const isValidI18nKey = (key) => {
    return Object.values(I18nKeys).includes(key);
};

/**
 * Helper function to get all available i18n keys.
 * 
 * @returns {string[]} Array of all available i18n keys
 */
export const getAllI18nKeys = () => {
    return Object.values(I18nKeys);
};

/**
 * Helper function to get I18n key by constant name.
 * 
 * @param {string} constantName - The constant name (e.g., 'JWT_VALIDATOR_TITLE')
 * @returns {string|null} The i18n key or null if not found
 */
export const getI18nKeyByConstant = (constantName) => {
    return I18nKeys[constantName] || null;
};