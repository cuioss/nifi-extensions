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
    ENDPOINTS: {
        VALIDATE_JWKS_URL: '/validate-jwks-url',
        VERIFY_TOKEN: '/verify-token',
        GET_ISSUER_CONFIG: '/issuer-config',
        SET_ISSUER_CONFIG: '/issuer-config'
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
        VALID: 'valid'
    },
    SELECTORS: {
        ERROR_CONTAINER: '.error-container',
        SUCCESS_CONTAINER: '.success-container',
        LOADING_INDICATOR: '.loading-indicator',
        FORM_GROUP: '.form-group',
        INPUT_FIELD: '.input-field',
        BUTTON: '.button',
        TOOLTIP: '.tooltip'
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
