/**
 * Comprehensive input validation utilities for the NiFi CUIOSS UI components.
 * This module provides standardized validation patterns with enhanced security,
 * format checking, and user experience improvements.
 */
'use strict';

import { VALIDATION } from './constants.js';

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
    const { httpsOnly = false, maxLength = VALIDATION.LIMITS.URL_MAX } = options;

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
    const pattern = httpsOnly ? VALIDATION.PATTERNS.HTTPS_URL : VALIDATION.PATTERNS.URL;
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
    if (sanitizedToken.length < VALIDATION.LIMITS.TOKEN_MIN) {
        return {
            isValid: false,
            error: `Token is too short (minimum ${VALIDATION.LIMITS.TOKEN_MIN} characters).`,
            sanitizedValue: sanitizedToken
        };
    }

    if (sanitizedToken.length > VALIDATION.LIMITS.TOKEN_MAX) {
        return {
            isValid: false,
            error: `Token is too long (maximum ${VALIDATION.LIMITS.TOKEN_MAX} characters).`,
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
    if (sanitizedName.length < VALIDATION.LIMITS.ISSUER_NAME_MIN) {
        return {
            isValid: false,
            error: 'Issuer name must be at least ' +
               `${VALIDATION.LIMITS.ISSUER_NAME_MIN} characters long.`,
            sanitizedValue: sanitizedName
        };
    }

    if (sanitizedName.length > VALIDATION.LIMITS.ISSUER_NAME_MAX) {
        return {
            isValid: false,
            error: 'Issuer name is too long ' +
               `(maximum ${VALIDATION.LIMITS.ISSUER_NAME_MAX} characters).`,
            sanitizedValue: sanitizedName
        };
    }

    // Character validation (safe characters only)
    if (!VALIDATION.PATTERNS.SAFE_STRING.test(sanitizedName)) {
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
    if (sanitizedAudience.length > VALIDATION.LIMITS.AUDIENCE_MAX) {
        return {
            isValid: false,
            error: `Audience is too long (maximum ${VALIDATION.LIMITS.AUDIENCE_MAX} characters).`,
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
    if (sanitizedClientId.length > VALIDATION.LIMITS.CLIENT_ID_MAX) {
        return {
            isValid: false,
            error: `Client ID is too long (maximum ${VALIDATION.LIMITS.CLIENT_ID_MAX} characters).`,
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

// Environment detection moved to centralized utility in constants.js
// Use getIsLocalhost() from '../utils/constants.js' instead
