/**
 * Centralized constants and configuration for the NiFi CUIOSS UI components.
 * This module provides a single source of truth for all hardcoded values
 * used throughout the application.
 *
 * @fileoverview Configuration constants for NiFi CUIOSS JWT validation UI components
 * @author CUIOSS Team
 * @since 1.0.0
 */
'use strict';

/**
 * API Configuration object containing all endpoint URLs, base paths, and timeout values.
 *
 * @typedef {Object} APIConfig
 * @property {string} BASE_URL - Base URL for JWT-specific API endpoints
 * @property {string} NIFI_BASE_URL - Base URL for general NiFi processor endpoints
 * @property {Object} ENDPOINTS - Specific API endpoint paths
 * @property {Object} TIMEOUTS - Timeout values in milliseconds for different operation types
 *
 * @example
 * // Using API endpoints
 * $.ajax({
 *   url: API.ENDPOINTS.JWT_VERIFY_TOKEN,
 *   timeout: API.TIMEOUTS.DEFAULT
 * });
 */
export const API = {
    /** @type {string} Base URL for JWT-specific API endpoints */
    BASE_URL: '../nifi-api/processors/jwt',

    /** @type {string} Base URL for general NiFi processor endpoints */
    NIFI_BASE_URL: '../nifi-api/processors',

    /**
     * API endpoint paths for various operations
     * @type {Object<string, string>}
     */
    ENDPOINTS: {
        /** @type {string} Endpoint for validating JWKS URL format */
        VALIDATE_JWKS_URL: '/validate-jwks-url',

        /** @type {string} Endpoint for verifying JWT tokens */
        VERIFY_TOKEN: '/verify-token',

        /** @type {string} Endpoint for retrieving issuer configuration */
        GET_ISSUER_CONFIG: '/issuer-config',

        /** @type {string} Endpoint for setting issuer configuration */
        SET_ISSUER_CONFIG: '/issuer-config',

        /** @type {string} Full URL for JWKS validation endpoint */
        JWKS_VALIDATE_URL: '../nifi-api/processors/jwks/validate-url',

        /** @type {string} Full URL for JWT token verification endpoint */
        JWT_VERIFY_TOKEN: '../nifi-api/processors/jwt/verify-token'
    },

    /**
     * Timeout values in milliseconds for different operation types
     * @type {Object<string, number>}
     */
    TIMEOUTS: {
        /** @type {number} Default timeout for standard operations (5 seconds) */
        DEFAULT: 5000,

        /** @type {number} Extended timeout for long-running operations (10 seconds) */
        LONG_OPERATION: 10000,

        /** @type {number} Short timeout for quick operations (2 seconds) */
        SHORT_OPERATION: 2000,

        /** @type {number} Dialog delay for NiFi processor initialization (500ms) */
        DIALOG_DELAY: 500,

        /** @type {number} UI fallback timeout for initialization (3 seconds) */
        UI_FALLBACK_TIMEOUT: 3000,

        /** @type {number} Token cache duration (1 hour in milliseconds) */
        TOKEN_CACHE_DURATION: 3600000,

        /** @type {number} Error display timeout (5 seconds) */
        ERROR_DISPLAY_TIMEOUT: 5000
    }
};

/**
 * CSS Classes and Selectors for UI component styling and DOM manipulation.
 * Centralizes all CSS class names and selectors used throughout the application.
 *
 * @typedef {Object} CSSConfig
 * @property {Object} CLASSES - CSS class names without dots
 * @property {Object} SELECTORS - CSS selectors with dots for jQuery/DOM queries
 * @property {Object} IDS - Element ID names without hashes
 * @property {Object} ISSUER_CONFIG - Component-specific CSS classes for issuer configuration
 * @property {Object} TOKEN_VERIFIER - Component-specific CSS classes for token verification
 *
 * @example
 * // Using CSS classes
 * const $element = $(`<div class="${CSS.CLASSES.LOADING}"></div>`);
 * $(CSS.SELECTORS.PROPERTY_LABEL).addClass(CSS.CLASSES.VALID);
 */
export const CSS = {
    /**
     * CSS class names for styling (without dot selectors)
     * @type {Object<string, string>}
     */
    CLASSES: {
        /** @type {string} Class for success message styling */
        SUCCESS_MESSAGE: 'success-message',

        /** @type {string} Class for error message styling */
        ERROR_MESSAGE: 'error-message',

        /** @type {string} Class for warning message styling */
        WARNING_MESSAGE: 'warning-message',

        /** @type {string} Class for loading state indication */
        LOADING: 'loading',

        /** @type {string} Class to hide elements */
        HIDDEN: 'hidden',

        /** @type {string} Class for disabled state */
        DISABLED: 'disabled',

        /** @type {string} Class for invalid input state */
        INVALID: 'invalid',

        /** @type {string} Class for valid input state */
        VALID: 'valid',

        /** @type {string} Class for property label elements */
        PROPERTY_LABEL: 'property-label',

        /** @type {string} Class for help tooltip icons */
        HELP_TOOLTIP: 'help-tooltip',

        /** @type {string} Class for processor dialog containers */
        PROCESSOR_DIALOG: 'processor-dialog',

        /** @type {string} Class for processor type display elements */
        PROCESSOR_TYPE: 'processor-type',

        /** @type {string} Class for JWT validator title elements */
        JWT_VALIDATOR_TITLE: 'jwt-validator-title',

        /** @type {string} FontAwesome base class */
        FA: 'fa',

        /** @type {string} FontAwesome question circle icon class */
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
        TOKEN_INVALID: 'token-invalid',
        TOKEN_DETAILS: 'token-details',
        TOKEN_ERROR_DETAILS: 'token-error-details',
        TOKEN_ERROR_MESSAGE: 'token-error-message',
        TOKEN_ERROR_CATEGORY: 'token-error-category',
        TOKEN_RAW_CLAIMS: 'token-raw-claims',
        TOKEN_CLAIMS_TABLE: 'token-claims-table',
        TOKEN_INSTRUCTIONS: 'token-instructions'
    },
    JWKS_VALIDATOR: {
        CONTAINER: 'jwks-verification-container',
        BUTTON_WRAPPER: 'jwks-button-wrapper',
        VERIFY_BUTTON: 'verify-jwks-button',
        VERIFICATION_RESULT: 'verification-result'
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
        URL: new RegExp('^https?:\\/\\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?' +
                        '(\\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*([/?#].*)?$'),
        HTTPS_URL: new RegExp('^https:\\/\\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?' +
                               '(\\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*([/?#].*)?$'),
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
 * Environment Detection utilities for determining runtime context.
 */

/** @type {boolean|null} Test override for localhost detection (null = use auto-detection) */
let isLocalhostOverride = null;

/**
 * Unified localhost detection utility that consolidates multiple detection methods.
 *
 * This function provides a centralized way to determine if the application is running
 * in a localhost/development environment. It supports test overrides and multiple
 * detection strategies for maximum compatibility.
 *
 * Detection priority:
 * 1. Test override (if set via setIsLocalhostForTesting)
 * 2. Global test mock (for unit test compatibility)
 * 3. Automatic hostname/URL analysis
 *
 * @returns {boolean} True if running in localhost/development environment
 *
 * @example
 * // Check if in development environment
 * if (getIsLocalhost()) {
 *   console.log('Running in development mode');
 * }
 *
 * @example
 * // Use in conditional API calls
 * const apiUrl = getIsLocalhost() ? 'http://localhost:8080' : 'https://api.prod.com';
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
 * Sets a test override for localhost detection to enable predictable testing.
 *
 * This function allows tests to override the automatic localhost detection
 * with a fixed value, ensuring consistent test behavior regardless of the
 * actual runtime environment.
 *
 * @param {boolean|null} value - Override value: true (force localhost),
 *                               false (force non-localhost), null (reset to auto-detection)
 *
 * @example
 * // Force localhost detection in tests
 * setIsLocalhostForTesting(true);
 * console.log(getIsLocalhost()); // Always returns true
 *
 * @example
 * // Reset to automatic detection
 * setIsLocalhostForTesting(null);
 * console.log(getIsLocalhost()); // Returns actual environment detection
 */
export const setIsLocalhostForTesting = (value) => {
    isLocalhostOverride = (value === null) ? null : !!value;
};
