/**
 * API Client for JWT Token Validation.
 * Provides methods for interacting with the backend REST API.
 */
import $ from 'cash-dom';
import { API } from '../utils/constants.js';
import { createXhrErrorObject, createApiClientCallbackErrorHandler } from '../utils/errorHandler.js';

'use strict';


/**
     * Base URL for API endpoints.
     */
const BASE_URL = API.BASE_URL;

/**
 * Validates a JWKS URL.
 *
 * @param {string} jwksUrl - The JWKS URL to validate
 * @return {Promise} A Promise object for the request
 */
export const validateJwksUrl = (jwksUrl) => {
    return $.ajax({
        method: 'POST',
        url: `${BASE_URL}/validate-jwks-url`,
        data: JSON.stringify({ jwksUrl }),
        contentType: 'application/json',
        dataType: 'json',
        timeout: API.TIMEOUTS.DEFAULT
    }).catch(error => {
        throw createXhrErrorObject(error);
    });
};

/**
 * Validates a JWKS file.
 *
 * @param {string} filePath - The path to the JWKS file
 * @return {Promise} A Promise object for the request
 */
export const validateJwksFile = (filePath) => {
    return $.ajax({
        method: 'POST',
        url: `${BASE_URL}/validate-jwks-file`,
        data: JSON.stringify({ filePath }),
        contentType: 'application/json',
        dataType: 'json',
        timeout: API.TIMEOUTS.DEFAULT
    }).catch(error => {
        throw createXhrErrorObject(error);
    });
};

/**
 * Validates JWKS content.
 *
 * @param {string} jwksContent - The JWKS content to validate
 * @param {Function} successCallback - The callback to invoke on success
 * @param {Function} errorCallback - The callback to invoke on error
 */
export const validateJwksContent = (jwksContent, successCallback, errorCallback) => {
    $.ajax({
        method: 'POST',
        url: `${BASE_URL}/validate-jwks-content`,
        data: JSON.stringify({ jwksContent }),
        contentType: 'application/json',
        dataType: 'json',
        timeout: API.TIMEOUTS.DEFAULT
    })
        .then(data => successCallback?.(data))
        .catch(createApiClientCallbackErrorHandler(errorCallback));
};

/**
 * Verifies a JWT token.
 *
 * @param {string} token - The JWT token to verify
 * @param {Function} successCallback - The callback to invoke on success
 * @param {Function} errorCallback - The callback to invoke on error
 */
export const verifyToken = (token, successCallback, errorCallback) => {
    $.ajax({
        method: 'POST',
        url: `${BASE_URL}/verify-token`,
        data: JSON.stringify({ token }),
        contentType: 'application/json',
        dataType: 'json',
        timeout: API.TIMEOUTS.DEFAULT
    })
        .then(data => successCallback?.(data))
        .catch(createApiClientCallbackErrorHandler(errorCallback));
};

/**
 * Gets security metrics.
 *
 * @param {Function} successCallback - The callback to invoke on success
 * @param {Function} errorCallback - The callback to invoke on error
 */
export const getSecurityMetrics = (successCallback, errorCallback) => {
    $.ajax({
        method: 'GET',
        url: `${BASE_URL}/metrics`,
        dataType: 'json',
        timeout: API.TIMEOUTS.DEFAULT
    })
        .then(data => successCallback?.(data))
        .catch(createApiClientCallbackErrorHandler(errorCallback));
};

/**
 * Gets processor properties.
 *
 * @param {string} processorId - The ID of the processor
 * @return {Promise} A Promise object for the request
 */
export const getProcessorProperties = (processorId) => {
    return $.ajax({
        method: 'GET',
        url: `../nifi-api/processors/${processorId}`,
        dataType: 'json',
        timeout: API.TIMEOUTS.DEFAULT
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
export const updateProcessorProperties = (processorId, properties) => {
    // First, get the current processor configuration
    return $.ajax({
        method: 'GET',
        url: `../nifi-api/processors/${processorId}`,
        dataType: 'json',
        timeout: API.TIMEOUTS.DEFAULT
    }).then(processor => { // data from GET is the processor object
        // Create the update request using destructuring
        const { revision } = processor;
        const updateRequest = {
            revision,
            component: {
                id: processorId,
                properties
            }
        };

        // Send the update request
        return $.ajax({
            method: 'PUT',
            url: `../nifi-api/processors/${processorId}`,
            data: JSON.stringify(updateRequest),
            contentType: 'application/json',
            dataType: 'json',
            timeout: API.TIMEOUTS.DEFAULT
        });
    });
};
