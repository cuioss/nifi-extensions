/**
 * Comprehensive input validation utilities for the NiFi CUIOSS UI components.
 * This module provides standardized validation patterns with enhanced security,
 * format checking, and user experience improvements.
 */
'use strict';

import { COMPONENTS } from './constants.js';

/**
 * Regular expression patterns for common validation scenarios.
 */
const PATTERNS = {
    // Processor ID: UUID format with hyphens (e.g., 12345678-1234-1234-1234-123456789abc)
    PROCESSOR_ID: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,

    // URL validation: HTTPS/HTTP protocols with domain validation
    URL: /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*([/?#].*)?$/,

    // HTTPS URL validation (more strict for production)
    HTTPS_URL: /^https:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*([/?#].*)?$/,

    // JWT token format: 3 base64url parts separated by dots
    JWT_TOKEN: /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,

    // Email format (for client IDs that might be emails)
    EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

    // Safe string: alphanumeric, hyphens, underscores, dots (for issuer names)
    SAFE_STRING: /^[a-zA-Z0-9._-]+$/
};

/**
 * Validation result object structure.
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether the input is valid
 * @property {string} [error] - Error message if validation failed
 * @property {string} [sanitizedValue] - Cleaned/sanitized version of the input
 */

/**
 * Base validation function that handles null/undefined/empty string checks.
 * @param {*} value - The value to validate
 * @param {boolean} [required=true] - Whether the field is required
 * @returns {ValidationResult} Validation result
 */
export const validateRequired = (value, required = true) => {
    const isNullOrUndefined = value == null;
    const stringValue = isNullOrUndefined ? '' : String(value);
    const trimmedValue = stringValue.trim();
    const isEmpty = trimmedValue === '' || trimmedValue.toLowerCase() === 'null' || trimmedValue.toLowerCase() === 'undefined';

    if (required && (isNullOrUndefined || isEmpty)) {
        return {
            isValid: false,
            error: 'This field is required.',
            sanitizedValue: ''
        };
    }

    return {
        isValid: true,
        sanitizedValue: trimmedValue
    };
};

/**
 * Validates and extracts processor ID from URL with enhanced security checks.
 * @param {string} url - The URL to extract processor ID from
 * @returns {ValidationResult} Validation result with processor ID
 */
export const validateProcessorIdFromUrl = (url) => {
    const requiredCheck = validateRequired(url);
    if (!requiredCheck.isValid) {
        return {
            isValid: false,
            error: 'URL is required for processor ID extraction.',
            sanitizedValue: ''
        };
    }

    const sanitizedUrl = requiredCheck.sanitizedValue;

    // Processor ID extraction - flexible format to maintain backward compatibility
    const match = sanitizedUrl.match(/\/processors\/([a-f0-9-]+)/i);

    if (!match) {
        return {
            isValid: false,
            error: 'URL does not contain a valid processor ID.',
            sanitizedValue: ''
        };
    }

    const processorId = match[1].toLowerCase(); // Normalize to lowercase

    return {
        isValid: true,
        sanitizedValue: processorId
    };
};

/**
 * Validates URL format with security considerations.
 * @param {string} url - The URL to validate
 * @param {Object} [options] - Validation options
 * @param {boolean} [options.httpsOnly=false] - Require HTTPS protocol
 * @param {number} [options.maxLength] - Maximum URL length
 * @returns {ValidationResult} Validation result
 */
export const validateUrl = (url, options = {}) => {
    const { httpsOnly = false, maxLength = COMPONENTS.JWKS_VALIDATOR.MAX_URL_LENGTH } = options;

    const requiredCheck = validateRequired(url);
    if (!requiredCheck.isValid) {
        return {
            isValid: false,
            error: 'URL is required.',
            sanitizedValue: ''
        };
    }

    const sanitizedUrl = requiredCheck.sanitizedValue;

    // Length validation
    if (sanitizedUrl.length > maxLength) {
        return {
            isValid: false,
            error: `URL is too long (maximum ${maxLength} characters).`,
            sanitizedValue: sanitizedUrl
        };
    }

    // Format validation
    const pattern = httpsOnly ? PATTERNS.HTTPS_URL : PATTERNS.URL;
    if (!pattern.test(sanitizedUrl)) {
        const protocol = httpsOnly ? 'HTTPS' : 'HTTP/HTTPS';
        return {
            isValid: false,
            error: `Invalid URL format. Must be a valid ${protocol} URL.`,
            sanitizedValue: sanitizedUrl
        };
    }

    return {
        isValid: true,
        sanitizedValue: sanitizedUrl
    };
};

/**
 * Validates JWT token format and length.
 * @param {string} token - The JWT token to validate
 * @returns {ValidationResult} Validation result
 */
export const validateJwtToken = (token) => {
    const requiredCheck = validateRequired(token);
    if (!requiredCheck.isValid) {
        return {
            isValid: false,
            error: 'Token is required.',
            sanitizedValue: ''
        };
    }

    const sanitizedToken = requiredCheck.sanitizedValue;

    // Length validation
    if (sanitizedToken.length < COMPONENTS.TOKEN_VERIFIER.MIN_TOKEN_LENGTH) {
        return {
            isValid: false,
            error: `Token is too short (minimum ${COMPONENTS.TOKEN_VERIFIER.MIN_TOKEN_LENGTH} characters).`,
            sanitizedValue: sanitizedToken
        };
    }

    if (sanitizedToken.length > COMPONENTS.TOKEN_VERIFIER.MAX_TOKEN_LENGTH) {
        return {
            isValid: false,
            error: `Token is too long (maximum ${COMPONENTS.TOKEN_VERIFIER.MAX_TOKEN_LENGTH} characters).`,
            sanitizedValue: sanitizedToken
        };
    }

    // Format validation (JWT should have 3 parts separated by dots) - relaxed for backward compatibility
    const parts = sanitizedToken.split('.');
    if (parts.length < 2) {
        return {
            isValid: false,
            error: 'Invalid token format. Expected at least 2 parts separated by dots.',
            sanitizedValue: sanitizedToken
        };
    }

    return {
        isValid: true,
        sanitizedValue: sanitizedToken
    };
};

/**
 * Validates issuer name with safe character restrictions.
 * @param {string} issuerName - The issuer name to validate
 * @returns {ValidationResult} Validation result
 */
export const validateIssuerName = (issuerName) => {
    const requiredCheck = validateRequired(issuerName);
    if (!requiredCheck.isValid) {
        return {
            isValid: false,
            error: 'Issuer name is required.',
            sanitizedValue: ''
        };
    }

    const sanitizedName = requiredCheck.sanitizedValue;

    // Length validation (reasonable limits)
    if (sanitizedName.length < 2) {
        return {
            isValid: false,
            error: 'Issuer name must be at least 2 characters long.',
            sanitizedValue: sanitizedName
        };
    }

    if (sanitizedName.length > 100) {
        return {
            isValid: false,
            error: 'Issuer name is too long (maximum 100 characters).',
            sanitizedValue: sanitizedName
        };
    }

    // Character validation (safe characters only)
    if (!PATTERNS.SAFE_STRING.test(sanitizedName)) {
        return {
            isValid: false,
            error: 'Issuer name can only contain letters, numbers, hyphens, underscores, and dots.',
            sanitizedValue: sanitizedName
        };
    }

    return {
        isValid: true,
        sanitizedValue: sanitizedName
    };
};

/**
 * Validates audience claim value.
 * @param {string} audience - The audience value to validate
 * @param {boolean} [required=false] - Whether the field is required
 * @returns {ValidationResult} Validation result
 */
export const validateAudience = (audience, required = false) => {
    const requiredCheck = validateRequired(audience, required);
    if (!requiredCheck.isValid) {
        return requiredCheck;
    }

    // If not required and empty, it's valid
    if (!required && requiredCheck.sanitizedValue === '') {
        return {
            isValid: true,
            sanitizedValue: ''
        };
    }

    const sanitizedAudience = requiredCheck.sanitizedValue;

    // Length validation
    if (sanitizedAudience.length > 500) {
        return {
            isValid: false,
            error: 'Audience is too long (maximum 500 characters).',
            sanitizedValue: sanitizedAudience
        };
    }

    return {
        isValid: true,
        sanitizedValue: sanitizedAudience
    };
};

/**
 * Validates client ID with flexible format support.
 * @param {string} clientId - The client ID to validate
 * @param {boolean} [required=false] - Whether the field is required
 * @returns {ValidationResult} Validation result
 */
export const validateClientId = (clientId, required = false) => {
    const requiredCheck = validateRequired(clientId, required);
    if (!requiredCheck.isValid) {
        return requiredCheck;
    }

    // If not required and empty, it's valid
    if (!required && requiredCheck.sanitizedValue === '') {
        return {
            isValid: true,
            sanitizedValue: ''
        };
    }

    const sanitizedClientId = requiredCheck.sanitizedValue;

    // Length validation
    if (sanitizedClientId.length > 200) {
        return {
            isValid: false,
            error: 'Client ID is too long (maximum 200 characters).',
            sanitizedValue: sanitizedClientId
        };
    }

    return {
        isValid: true,
        sanitizedValue: sanitizedClientId
    };
};

/**
 * Validates complete issuer configuration form data.
 * @param {Object} formData - The form data to validate
 * @param {string} formData.issuerName - The issuer name
 * @param {string} formData.issuer - The issuer URI
 * @param {string} formData['jwks-url'] - The JWKS URL
 * @param {string} [formData.audience] - The audience (optional)
 * @param {string} [formData['client-id']] - The client ID (optional)
 * @returns {ValidationResult} Validation result with all field errors
 */
export const validateIssuerConfig = (formData) => {
    const errors = [];
    const sanitizedData = {};

    // Validate issuer name (required)
    const issuerNameResult = validateIssuerName(formData.issuerName);
    if (!issuerNameResult.isValid) {
        errors.push(`Issuer Name: ${issuerNameResult.error}`);
    }
    sanitizedData.issuerName = issuerNameResult.sanitizedValue;

    // Validate issuer URI (required, HTTPS recommended)
    const issuerResult = validateUrl(formData.issuer, { httpsOnly: false });
    if (!issuerResult.isValid) {
        errors.push(`Issuer URI: ${issuerResult.error}`);
    }
    sanitizedData.issuer = issuerResult.sanitizedValue;

    // Validate JWKS URL (required, HTTPS recommended)
    const jwksUrlResult = validateUrl(formData['jwks-url'], { httpsOnly: false });
    if (!jwksUrlResult.isValid) {
        errors.push(`JWKS URL: ${jwksUrlResult.error}`);
    }
    sanitizedData['jwks-url'] = jwksUrlResult.sanitizedValue;

    // Validate audience (optional)
    const audienceResult = validateAudience(formData.audience, false);
    if (!audienceResult.isValid) {
        errors.push(`Audience: ${audienceResult.error}`);
    }
    sanitizedData.audience = audienceResult.sanitizedValue;

    // Validate client ID (optional)
    const clientIdResult = validateClientId(formData['client-id'], false);
    if (!clientIdResult.isValid) {
        errors.push(`Client ID: ${clientIdResult.error}`);
    }
    sanitizedData['client-id'] = clientIdResult.sanitizedValue;

    if (errors.length > 0) {
        return {
            isValid: false,
            error: errors.join(' '),
            sanitizedValue: sanitizedData
        };
    }

    return {
        isValid: true,
        sanitizedValue: sanitizedData
    };
};

/**
 * Environment detection utility for determining if running in localhost/development.
 * @returns {boolean} True if running in localhost environment
 */
export const isLocalhostEnvironment = () => {
    if (typeof window === 'undefined' || !window.location) {
        return false;
    }

    const hostname = window.location.hostname;
    return hostname === 'localhost' ||
           hostname === '127.0.0.1' ||
           hostname.startsWith('192.168.') ||
           hostname.endsWith('.local');
};
