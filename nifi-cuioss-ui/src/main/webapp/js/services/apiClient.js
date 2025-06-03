/**
 * API Client for JWT Token Validation.
 * Provides methods for interacting with the backend REST API.
 */
import { ajax } from '../utils/ajax';
import * as _nfCommon from 'nf.Common'; // Path might need adjustment

'use strict';

/**
     * Base URL for API endpoints.
     */
const BASE_URL = '../nifi-api/processors/jwt';

/**
     * Handles API errors consistently.
     *
     * @param {Object} xhr - The XHR object from the failed request
     * @param {Function} errorCallback - The callback to invoke with error information
     */
const handleApiError = function (xhr, errorCallback) {
    let errorMessage;

    try {
        // Try to parse error response as JSON
        const response = JSON.parse(xhr.responseText);
        if (response.message) {
            errorMessage = response.message;
        } else if (response.error) {
            errorMessage = response.error;
        } else {
            errorMessage = xhr.statusText;
        }
    } catch (e) {
        // If parsing fails, use the raw response text or status text
        if (xhr.responseText) {
            errorMessage = xhr.responseText;
        } else {
            errorMessage = xhr.statusText;
        }
    }

    // Error would be logged here in development mode
    // console.error('API Error:', errorMessage, xhr);

    // Replace generic "Internal Server Error" with a more user-friendly message
    if (errorMessage === 'Internal Server Error') {
        errorMessage = 'An unexpected error has occurred. Please try again later or contact support if the issue persists.';
    }

    // Call the error callback with the error message
    if (typeof errorCallback === 'function') {
        errorCallback(errorMessage, xhr);
    }
};

/**
 * Validates a JWKS URL.
 *
 * @param {string} jwksUrl - The JWKS URL to validate
 * @param {Function} successCallback - The callback to invoke on success
 * @param {Function} errorCallback - The callback to invoke on error
 */
export const validateJwksUrl = function (jwksUrl, successCallback, errorCallback) {
    ajax({
        method: 'POST',
        url: BASE_URL + '/validate-jwks-url',
        data: JSON.stringify({ jwksUrl: jwksUrl }),
        contentType: 'application/json'
        // dataType: 'json' // Not needed with fetch API, response.json() handles it
    })
    .then(response => {
        if (successCallback) {
            // Original compatAjax success: successCallback(data) which was response directly
            // ajax resolves with: { data, status, statusText }
            successCallback(response.data);
        }
    })
    .catch(error => {
        if (errorCallback) {
            let xhrLike;
            if (error.response) {
                xhrLike = { status: error.response.status, statusText: error.response.statusText, responseText: error.message }; // Simplification
                errorCallback(error.message, xhrLike); // errorCallback(errorMessage, xhr)
            } else {
                xhrLike = { status: 0, statusText: error.message, responseText: error.message };
                errorCallback(error.message, xhrLike);
            }
        } else {
            console.error('AJAX call failed:', error);
            // throw error; // Decide if rethrowing is appropriate or if nfCommon.handleAjaxError handles it
        }
    });
    // Note: jQuery's .done().fail() structure implies separate handling.
    // The original handleApiError was designed for jQuery's xhr.
    // We've simplified error handling here. If more complex xhr-like object is needed for handleApiError,
    // it would need to be constructed more carefully from the fetch error.
};

/**
 * Validates a JWKS file.
 *
 * @param {string} filePath - The path to the JWKS file
 * @param {Function} successCallback - The callback to invoke on success
 * @param {Function} errorCallback - The callback to invoke on error
 */
export const validateJwksFile = function (filePath, successCallback, errorCallback) {
    ajax({
        method: 'POST',
        url: BASE_URL + '/validate-jwks-file',
        data: JSON.stringify({ filePath: filePath }),
        contentType: 'application/json'
    })
    .then(response => {
        if (successCallback) {
            successCallback(response.data);
        }
    })
    .catch(error => {
        if (errorCallback) {
            let xhrLike;
            if (error.response) {
                xhrLike = { status: error.response.status, statusText: error.response.statusText, responseText: error.message };
                errorCallback(error.message, xhrLike);
            } else {
                xhrLike = { status: 0, statusText: error.message, responseText: error.message };
                errorCallback(error.message, xhrLike);
            }
        } else {
            console.error('AJAX call failed:', error);
        }
    });
};

/**
 * Validates JWKS content.
 *
 * @param {string} jwksContent - The JWKS content to validate
 * @param {Function} successCallback - The callback to invoke on success
 * @param {Function} errorCallback - The callback to invoke on error
 */
export const validateJwksContent = function (jwksContent, successCallback, errorCallback) {
    ajax({
        method: 'POST',
        url: BASE_URL + '/validate-jwks-content',
        data: JSON.stringify({ jwksContent: jwksContent }),
        contentType: 'application/json'
    })
    .then(response => {
        if (successCallback) {
            successCallback(response.data);
        }
    })
    .catch(error => {
        if (errorCallback) {
            let xhrLike;
            if (error.response) {
                xhrLike = { status: error.response.status, statusText: error.response.statusText, responseText: error.message };
                errorCallback(error.message, xhrLike);
            } else {
                xhrLike = { status: 0, statusText: error.message, responseText: error.message };
                errorCallback(error.message, xhrLike);
            }
        } else {
            console.error('AJAX call failed:', error);
        }
    });
};

/**
 * Verifies a JWT token.
 *
 * @param {string} token - The JWT token to verify
 * @param {Function} successCallback - The callback to invoke on success
 * @param {Function} errorCallback - The callback to invoke on error
 */
export const verifyToken = function (token, successCallback, errorCallback) {
    ajax({
        method: 'POST',
        url: BASE_URL + '/verify-token',
        data: JSON.stringify({ token: token }),
        contentType: 'application/json'
    })
    .then(response => {
        if (successCallback) {
            successCallback(response.data);
        }
    })
    .catch(error => {
        if (errorCallback) {
            let xhrLike;
            if (error.response) {
                xhrLike = { status: error.response.status, statusText: error.response.statusText, responseText: error.message };
                errorCallback(error.message, xhrLike);
            } else {
                xhrLike = { status: 0, statusText: error.message, responseText: error.message };
                errorCallback(error.message, xhrLike);
            }
        } else {
            console.error('AJAX call failed:', error);
        }
    });
};

/**
 * Gets security metrics.
 *
 * @param {Function} successCallback - The callback to invoke on success
 * @param {Function} errorCallback - The callback to invoke on error
 */
export const getSecurityMetrics = function (successCallback, errorCallback) {
    ajax({
        method: 'GET',
        url: BASE_URL + '/metrics'
        // dataType: 'json' // Not needed
    })
    .then(response => {
        if (successCallback) {
            successCallback(response.data);
        }
    })
    .catch(error => {
        if (errorCallback) {
            let xhrLike;
            if (error.response) {
                xhrLike = { status: error.response.status, statusText: error.response.statusText, responseText: error.message };
                errorCallback(error.message, xhrLike);
            } else {
                xhrLike = { status: 0, statusText: error.message, responseText: error.message };
                errorCallback(error.message, xhrLike);
            }
        } else {
            console.error('AJAX call failed:', error);
        }
    });
};

/**
 * Gets processor properties.
 *
 * @param {string} processorId - The ID of the processor
 * @return {Promise} A Promise object for the request
 */
export const getProcessorProperties = function (processorId) {
    // This function originally returned a jQuery Deferred object.
    // Now it returns a standard Promise from the ajax utility.
    // Callers will need to be updated if they relied on jQuery-specific Deferred methods beyond .then/.catch.
    return ajax({
        method: 'GET',
        url: '../nifi-api/processors/' + processorId
        // dataType: 'json' // Not needed
    });
    // The original function did not have explicit success/error handlers here,
    // it returned the deferred object for the caller to handle.
    // The new `ajax` function already returns a promise that resolves with { data, status, statusText }
    // or rejects with an error object.
};

/**
 * Updates processor properties.
 *
 * @param {string} processorId - The ID of the processor
 * @param {Object} properties - The properties to update
 * @return {Promise} A Promise object for the request
 */
export const updateProcessorProperties = function (processorId, properties) {
    // First, get the current processor configuration
    return ajax({ // Changed from compatAjax
        method: 'GET',
        url: '../nifi-api/processors/' + processorId
        // dataType: 'json' // Not needed
    }).then(response => { // jQuery's .then callback received data directly
        const processor = response.data; // ajax resolves with { data, ... }
        // Create the update request
        const updateRequest = {
            revision: processor.revision,
            component: {
                id: processorId,
                properties: properties
            }
        };

        // Send the update request
        return ajax({ // Changed from compatAjax
            method: 'PUT',
            url: '../nifi-api/processors/' + processorId,
            data: JSON.stringify(updateRequest),
            contentType: 'application/json'
            // dataType: 'json' // Not needed
        });
    });
    // Note: The promise chain naturally handles errors. If the first GET fails,
    // the .catch of the caller will be invoked. If the PUT fails, its error will propagate.
};
