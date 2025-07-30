/**
 * Unified AJAX error handling utilities for the NiFi CUIOSS UI components.
 *
 * This module provides standardized error handling patterns and eliminates
 * duplicate error handling code across different components. It offers
 * consistent error object creation and Promise/callback error handlers.
 *
 * @fileoverview AJAX error handling utilities for consistent error management
 * @author CUIOSS Team
 * @since 1.0.0
 */
'use strict';

/**
 * Standardized error object structure for consistent error handling.
 *
 * @typedef {Object} StandardizedError
 * @property {number} status - HTTP status code (0 for network errors)
 * @property {string} statusText - Human-readable status description
 * @property {string} responseText - Response body content (may be empty)
 */

/**
 * Creates a simplified, standardized error object from a jqXHR/XHR object.
 *
 * This function standardizes error object creation across the application,
 * handling inconsistencies between jQuery, cash-dom, and native XHR objects.
 * It ensures all error handlers receive a consistent error object structure.
 *
 * @param {Object|null} jqXHR - The XHR object from an AJAX error (jQuery/cash-dom)
 * @param {string} [textStatus] - The status text (optional, may not be provided by cash-dom)
 * @param {string} [errorThrown] - The error thrown (optional, may not be provided by cash-dom)
 * @returns {StandardizedError} Standardized error object with consistent structure
 *
 * @example
 * // In fetch error handler
 * fetch(url).catch((error) => {
 *   const errorObj = createXhrErrorObject(error);
 *   console.error(`Error ${errorObj.status}: ${errorObj.statusText}`);
 * });
 *
 * @example
 * // Handling null/undefined jqXHR
 * const error = createXhrErrorObject(null);
 * // Returns: {status: 0, statusText: 'Unknown error', responseText: ''}
 */
export const createXhrErrorObject = function (jqXHR, textStatus, errorThrown) {
    // Note: cash-dom's jqXHR object in .catch() might be simpler than jQuery's.
    // It directly provides status, statusText, and responseText.
    // textStatus and errorThrown might not be consistently provided by cash-dom's AJAX fail handler,
    // so we primarily rely on properties of the jqXHR object itself.
    // Handle null/undefined jqXHR objects
    if (!jqXHR) {
        return {
            status: 0,
            statusText: errorThrown || textStatus || 'Unknown error',
            responseText: ''
        };
    }

    return {
        status: jqXHR.status,
        statusText: jqXHR.statusText || errorThrown || textStatus || 'Unknown error', // Prioritize jqXHR.statusText
        responseText: jqXHR.responseText
    };
};

/**
 * Creates a standardized Promise rejection handler for API client methods.
 * This eliminates the duplicate .catch() patterns in apiClient.js.
 *
 * @param {Function} reject - The Promise reject function
 * @returns {Function} Error handler function that creates standardized error objects
 */
export const createApiClientErrorHandler = (reject) => {
    return (error) => {
        // Create a simplified error object from jqXHR for consistent error handling upstream
        reject(createXhrErrorObject(error));
    };
};

/**
 * Creates a standardized callback-based error handler for API client methods.
 * This eliminates the duplicate error handling patterns in callback-based API methods.
 *
 * @param {Function} errorCallback - The error callback function
 * @returns {Function} Error handler function
 */
export const createApiClientCallbackErrorHandler = (errorCallback) => {
    return (error) => {
        if (errorCallback) {
            // Create a simplified error object from jqXHR for consistent error handling upstream
            const errorObj = createXhrErrorObject(error);
            // For callback handlers, prioritize responseText for error messages as it typically contains more detail
            const errorMessage = errorObj.responseText || errorObj.statusText || 'Unknown error';
            errorCallback(errorMessage, errorObj);
        }
    };
};
