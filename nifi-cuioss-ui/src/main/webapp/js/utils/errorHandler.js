/**
 * Unified AJAX error handling utilities for the NiFi CUIOSS UI components.
 * This module provides standardized error handling patterns and eliminates
 * duplicate error handling code across different components.
 */
'use strict';

/**
 * Creates a simplified error object from a jqXHR object.
 * This standardizes the error transformation pattern used across API client methods.
 *
 * @param {object} jqXHR - The jQuery XHR object from an AJAX error
 * @param {string} [textStatus] - The status text (optional, cash-dom might not always provide it)
 * @param {string} [errorThrown] - The error thrown (optional, cash-dom might not always provide it)
 * @returns {{responseText: *, status: *, statusText: *}} Standardized error object
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
