/**
 * API Client for JWT Token Validation.
 * Provides methods for interacting with the backend REST API.
 */
import $ from 'cash-dom';

'use strict';

/**
     * Base URL for API endpoints.
     */
const BASE_URL = '../nifi-api/processors/jwt';

/**
 * Validates a JWKS URL.
 *
 * @param {string} jwksUrl - The JWKS URL to validate
 * @param {Function} successCallback - The callback to invoke on success
 * @param {Function} errorCallback - The callback to invoke on error
 */
export const validateJwksUrl = function (jwksUrl, successCallback, errorCallback) {
    $.ajax({
        method: 'POST',
        url: BASE_URL + '/validate-jwks-url',
        data: JSON.stringify({ jwksUrl: jwksUrl }),
        contentType: 'application/json',
        dataType: 'json',
        timeout: 5000
    })
        .then(data => { // $.ajax().then() provides data directly
            if (successCallback) {
                successCallback(data);
            }
        })
        .catch(error => { // cash-dom's ajax().catch() provides the jqXHR object
            if (errorCallback) {
                const xhrLike = {
                    status: error.status,
                    statusText: error.statusText,
                    responseText: error.responseText
                };
                // errorThrown is not directly available in cash's catch, derive from statusText or responseText
                const errorMessage = error.statusText || error.responseText || 'Unknown error';
                errorCallback(errorMessage, xhrLike);
            }
        });
};

/**
 * Validates a JWKS file.
 *
 * @param {string} filePath - The path to the JWKS file
 * @param {Function} successCallback - The callback to invoke on success
 * @param {Function} errorCallback - The callback to invoke on error
 */
export const validateJwksFile = function (filePath, successCallback, errorCallback) {
    $.ajax({
        method: 'POST',
        url: BASE_URL + '/validate-jwks-file',
        data: JSON.stringify({ filePath: filePath }),
        contentType: 'application/json',
        dataType: 'json',
        timeout: 5000
    })
        .then(data => {
            if (successCallback) {
                successCallback(data);
            }
        })
        .catch(error => {
            if (errorCallback) {
                const xhrLike = {
                    status: error.status,
                    statusText: error.statusText,
                    responseText: error.responseText
                };
                const errorMessage = error.statusText || error.responseText || 'Unknown error';
                errorCallback(errorMessage, xhrLike);
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
    $.ajax({
        method: 'POST',
        url: BASE_URL + '/validate-jwks-content',
        data: JSON.stringify({ jwksContent: jwksContent }),
        contentType: 'application/json',
        dataType: 'json',
        timeout: 5000
    })
        .then(data => {
            if (successCallback) {
                successCallback(data);
            }
        })
        .catch(error => {
            if (errorCallback) {
                const xhrLike = {
                    status: error.status,
                    statusText: error.statusText,
                    responseText: error.responseText
                };
                const errorMessage = error.statusText || error.responseText || 'Unknown error';
                errorCallback(errorMessage, xhrLike);
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
    $.ajax({
        method: 'POST',
        url: BASE_URL + '/verify-token',
        data: JSON.stringify({ token: token }),
        contentType: 'application/json',
        dataType: 'json',
        timeout: 5000
    })
        .then(data => {
            if (successCallback) {
                successCallback(data);
            }
        })
        .catch(error => {
            if (errorCallback) {
                const xhrLike = {
                    status: error.status,
                    statusText: error.statusText,
                    responseText: error.responseText
                };
                const errorMessage = error.statusText || error.responseText || 'Unknown error';
                errorCallback(errorMessage, xhrLike);
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
    $.ajax({
        method: 'GET',
        url: BASE_URL + '/metrics',
        dataType: 'json',
        timeout: 5000
    })
        .then(data => {
            if (successCallback) {
                successCallback(data);
            }
        })
        .catch(error => {
            if (errorCallback) {
                const xhrLike = {
                    status: error.status,
                    statusText: error.statusText,
                    responseText: error.responseText
                };
                const errorMessage = error.statusText || error.responseText || 'Unknown error';
                errorCallback(errorMessage, xhrLike);
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
    return $.ajax({
        method: 'GET',
        url: '../nifi-api/processors/' + processorId,
        dataType: 'json',
        timeout: 5000
    });
    // $.ajax returns a promise-like object.
    // The .then callback will receive the parsed JSON data directly.
    // The .catch callback will receive the jqXHR object.
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
    return $.ajax({
        method: 'GET',
        url: '../nifi-api/processors/' + processorId,
        dataType: 'json',
        timeout: 5000
    }).then(processor => { // data from GET is the processor object
        // Create the update request
        const updateRequest = {
            revision: processor.revision,
            component: {
                id: processorId,
                properties: properties
            }
        };

        // Send the update request
        return $.ajax({
            method: 'PUT',
            url: '../nifi-api/processors/' + processorId,
            data: JSON.stringify(updateRequest),
            contentType: 'application/json',
            dataType: 'json',
            timeout: 5000
        });
    });
};
