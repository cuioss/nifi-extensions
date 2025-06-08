/**
 * Centralized constants and configuration for the NiFi CUIOSS UI components.
 * This module provides a single source of truth for all hardcoded values
 * used throughout the application.
 */
'use strict';

/**
 * API Configuration
 */
export const API = {
    BASE_URL: '../nifi-api/processors/jwt',
    NIFI_BASE_URL: '../nifi-api/processors',
    ENDPOINTS: {
        VALIDATE_JWKS_URL: '/validate-jwks-url',
        VERIFY_TOKEN: '/verify-token',
        GET_ISSUER_CONFIG: '/issuer-config',
        SET_ISSUER_CONFIG: '/issuer-config',
        // Additional endpoints found in components
        JWKS_VALIDATE_URL: '../nifi-api/processors/jwks/validate-url',
        JWT_VERIFY_TOKEN: '../nifi-api/processors/jwt/verify-token'
    },
    TIMEOUTS: {
        DEFAULT: 5000,
        LONG_OPERATION: 10000,
        SHORT_OPERATION: 2000
    }
};

/**
 * CSS Classes and Selectors
 */
export const CSS = {
    CLASSES: {
        SUCCESS_MESSAGE: 'success-message',
        ERROR_MESSAGE: 'error-message',
        WARNING_MESSAGE: 'warning-message',
        LOADING: 'loading',
        HIDDEN: 'hidden',
        DISABLED: 'disabled',
        INVALID: 'invalid',
        VALID: 'valid',
        // Main component classes
        PROPERTY_LABEL: 'property-label',
        HELP_TOOLTIP: 'help-tooltip',
        PROCESSOR_DIALOG: 'processor-dialog',
        PROCESSOR_TYPE: 'processor-type',
        JWT_VALIDATOR_TITLE: 'jwt-validator-title',
        // FontAwesome classes
        FA: 'fa',
        FA_QUESTION_CIRCLE: 'fa-question-circle'
    },
    SELECTORS: {
        ERROR_CONTAINER: '.error-container',
        SUCCESS_CONTAINER: '.success-container',
        LOADING_INDICATOR: '.loading-indicator',
        FORM_GROUP: '.form-group',
        INPUT_FIELD: '.input-field',
        BUTTON: '.button',
        TOOLTIP: '.tooltip',
        // Main component selectors
        PROPERTY_LABEL: '.property-label',
        HELP_TOOLTIP: '.help-tooltip',
        PROCESSOR_DIALOG: '.processor-dialog',
        PROCESSOR_TYPE: '.processor-type',
        JWT_VALIDATOR_TITLE: '.jwt-validator-title'
    },
    IDS: {
        LOADING_INDICATOR: 'loading-indicator',
        JWT_VALIDATOR_TABS: 'jwt-validator-tabs'
    },
    // Component-specific CSS classes
    ISSUER_CONFIG: {
        CONTAINER: 'issuer-config-editor',
        ISSUERS_CONTAINER: 'issuers-container',
        GLOBAL_ERROR_MESSAGES: 'global-error-messages',
        ADD_ISSUER_BUTTON: 'add-issuer-button',
        REMOVE_ISSUER_BUTTON: 'remove-issuer-button',
        SAVE_ISSUER_BUTTON: 'save-issuer-button',
        ISSUER_FORM: 'issuer-form',
        FORM_HEADER: 'form-header',
        FORM_FIELDS: 'form-fields'
    },
    TOKEN_VERIFIER: {
        CONTAINER: 'token-verification-container',
        INPUT_SECTION: 'token-input-section',
        RESULTS_SECTION: 'token-results-section',
        TOKEN_INPUT: 'token-input',
        VERIFY_BUTTON: 'verify-token-button',
        RESULTS_CONTENT: 'token-results-content',
        TOKEN_ERROR: 'token-error',
        TOKEN_LOADING: 'token-loading',
        TOKEN_VALID: 'token-valid',
        TOKEN_DETAILS: 'token-details'
    }
};

/**
 * Component Configuration
 */
export const COMPONENTS = {
    ISSUER_CONFIG_EDITOR: {
        DEFAULT_ISSUER_NAME: 'sample-issuer',
        SAMPLE_ISSUER_URL: 'https://sample-issuer.example.com',
        SAMPLE_JWKS_URL: 'https://sample-issuer.example.com/.well-known/jwks.json',
        SAMPLE_AUDIENCE: 'sample-audience',
        SAMPLE_CLIENT_ID: 'sample-client'
    },
    TOKEN_VERIFIER: {
        MAX_TOKEN_LENGTH: 10000,
        MIN_TOKEN_LENGTH: 10
    },
    JWKS_VALIDATOR: {
        MAX_URL_LENGTH: 2048,
        VALIDATION_TIMEOUT: 10000
    }
};

/**
 * NiFi Component Registration Keys
 */
export const NIFI = {
    COMPONENT_TABS: {
        ISSUER_CONFIG: 'jwt.validation.issuer.configuration',
        TOKEN_VERIFICATION: 'jwt.validation.token.verification'
    },
    PROCESSOR_TYPES: {
        MULTI_ISSUER_JWT_AUTHENTICATOR: 'MultiIssuerJWTTokenAuthenticator'
    }
};

/**
 * UI Text and Help Content Configuration
 */
export const UI_TEXT = {
    HELP_TEXT_KEYS: {
        TOKEN_LOCATION: 'property.token.location.help',
        TOKEN_HEADER: 'property.token.header.help',
        CUSTOM_HEADER_NAME: 'property.custom.header.name.help',
        BEARER_TOKEN_PREFIX: 'property.bearer.token.prefix.help',
        REQUIRE_VALID_TOKEN: 'property.require.valid.token.help',
        JWKS_REFRESH_INTERVAL: 'property.jwks.refresh.interval.help',
        MAXIMUM_TOKEN_SIZE: 'property.maximum.token.size.help',
        ALLOWED_ALGORITHMS: 'property.allowed.algorithms.help',
        REQUIRE_HTTPS_JWKS: 'property.require.https.jwks.help'
    },
    PROPERTY_LABELS: {
        'Token Location': 'property.token.location.help',
        'Token Header': 'property.token.header.help',
        'Custom Header Name': 'property.custom.header.name.help',
        'Bearer Token Prefix': 'property.bearer.token.prefix.help',
        'Require Valid Token': 'property.require.valid.token.help',
        'JWKS Refresh Interval': 'property.jwks.refresh.interval.help',
        'Maximum Token Size': 'property.maximum.token.size.help',
        'Allowed Algorithms': 'property.allowed.algorithms.help',
        'Require HTTPS for JWKS URLs': 'property.require.https.jwks.help'
    },
    I18N_KEYS: {
        JWT_VALIDATOR_LOADING: 'jwt.validator.loading',
        JWT_VALIDATOR_TITLE: 'jwt.validator.title'
    }
};

/**
 * Validation Patterns and Rules
 */
export const VALIDATION = {
    PATTERNS: {
        PROCESSOR_ID: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
        URL: /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*([/?#].*)?$/,
        HTTPS_URL: /^https:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*([/?#].*)?$/,
        JWT_TOKEN: /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
        EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        SAFE_STRING: /^[a-zA-Z0-9._-]+$/
    },
    LIMITS: {
        ISSUER_NAME_MIN: 2,
        ISSUER_NAME_MAX: 100,
        AUDIENCE_MAX: 500,
        CLIENT_ID_MAX: 200,
        URL_MAX: 2048,
        TOKEN_MIN: 10,
        TOKEN_MAX: 10000
    }
};

/**
 * Environment Detection
 */

// Test override for localhost detection
let isLocalhostOverride = null;

/**
 * Unified localhost detection utility.
 * Consolidates multiple localhost detection implementations across components.
 * @returns {boolean} True if running in localhost/development environment
 */
export const getIsLocalhost = () => {
    // Test override takes precedence
    if (isLocalhostOverride !== null) {
        return isLocalhostOverride;
    }

    // Global test mock support (for issuerConfigEditor compatibility)
    /* eslint-disable no-undef */
    if (typeof global !== 'undefined' && typeof global.getIsLocalhost === 'function') {
        return global.getIsLocalhost();
    }
    /* eslint-enable no-undef */

    // Environment check
    if (typeof window === 'undefined' || !window.location) {
        return false;
    }

    const hostname = window.location.hostname || '';
    const href = window.location.href || '';

    // Comprehensive localhost detection
    return hostname === 'localhost' ||
           hostname === '127.0.0.1' ||
           hostname.startsWith('192.168.') ||
           hostname.endsWith('.local') ||
           href.includes('localhost') ||
           href.includes('127.0.0.1');
};

/**
 * Set localhost override for testing.
 * @param {boolean|null} value - Override value (null to reset)
 */
export const setIsLocalhostForTesting = (value) => {
    isLocalhostOverride = (value === null) ? null : !!value;
};
