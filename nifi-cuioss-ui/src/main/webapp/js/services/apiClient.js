/**
 * API Client for JWT Token Validation.
 * Provides methods for interacting with the backend REST API.
 */
import $ from 'cash-dom';
import { API } from '../utils/constants.js';
import { createApiClientErrorHandler, createApiClientCallbackErrorHandler } from '../utils/errorHandler.js';

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
export const validateJwksUrl = function (jwksUrl) {
    return new Promise((resolve, reject) => {
        $.ajax({
            method: 'POST',
            url: BASE_URL + '/validate-jwks-url',
            data: JSON.stringify({ jwksUrl: jwksUrl }),
            contentType: 'application/json',
            dataType: 'json',
            timeout: API.TIMEOUTS.DEFAULT
        })
            .then(data => { // $.ajax().then() provides data directly
                resolve(data);
            })
            .catch(createApiClientErrorHandler(reject));
    });
};

/**
 * Validates a JWKS file.
 *
 * @param {string} filePath - The path to the JWKS file
 * @return {Promise} A Promise object for the request
 */
export const validateJwksFile = function (filePath) {
    return new Promise((resolve, reject) => {
        $.ajax({
            method: 'POST',
            url: BASE_URL + '/validate-jwks-file',
            data: JSON.stringify({ filePath: filePath }),
            contentType: 'application/json',
            dataType: 'json',
            timeout: API.TIMEOUTS.DEFAULT
        })
            .then(data => {
                resolve(data);
            })
            .catch(createApiClientErrorHandler(reject));
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
        timeout: API.TIMEOUTS.DEFAULT
    })
        .then(data => {
            if (successCallback) {
                successCallback(data);
            }
        })
        .catch(createApiClientCallbackErrorHandler(errorCallback));
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
        timeout: API.TIMEOUTS.DEFAULT
    })
        .then(data => {
            if (successCallback) {
                successCallback(data);
            }
        })
        .catch(createApiClientCallbackErrorHandler(errorCallback));
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
        timeout: API.TIMEOUTS.DEFAULT
    })
        .then(data => {
            if (successCallback) {
                successCallback(data);
            }
        })
        .catch(createApiClientCallbackErrorHandler(errorCallback));
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
export const updateProcessorProperties = function (processorId, properties) {
    // First, get the current processor configuration
    return $.ajax({
        method: 'GET',
        url: '../nifi-api/processors/' + processorId,
        dataType: 'json',
        timeout: API.TIMEOUTS.DEFAULT
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
            timeout: API.TIMEOUTS.DEFAULT
        });
    });
};
