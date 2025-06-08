/**
 * Simple API Client - replaces 165 lines of mixed Promise/callback patterns.
 * Standardizes on Promise-based API for consistency.
 */
import $ from 'cash-dom';
import { API } from '../utils/constants.js';
import { createXhrErrorObject, createApiClientCallbackErrorHandler } from '../utils/errorHandler.js';

'use strict';

const BASE_URL = API.BASE_URL;

/**
 * Generic API call helper - eliminates duplicate AJAX setup.
 * @param {string} method - HTTP method
 * @param {string} endpoint - API endpoint 
 * @param {Object} data - Request data
 * @returns {Promise} AJAX promise
 */
const apiCall = (method, endpoint, data = null) => {
    const config = {
        method,
        url: endpoint,
        dataType: 'json',
        timeout: API.TIMEOUTS.DEFAULT
    };
    
    if (data) {
        config.data = JSON.stringify(data);
        config.contentType = 'application/json';
    }
    
    return $.ajax(config);
};

/**
 * Validates a JWKS URL.
 * @param {string} jwksUrl - The JWKS URL to validate
 * @returns {Promise} Promise for the request
 */
export const validateJwksUrl = (jwksUrl) => {
    return apiCall('POST', `${BASE_URL}/validate-jwks-url`, { jwksUrl })
        .catch(error => { throw createXhrErrorObject(error); });
};

/**
 * Validates a JWKS file.
 * @param {string} filePath - The path to the JWKS file
 * @returns {Promise} Promise for the request
 */
export const validateJwksFile = (filePath) => {
    return apiCall('POST', `${BASE_URL}/validate-jwks-file`, { filePath })
        .catch(error => { throw createXhrErrorObject(error); });
};

/**
 * Validates JWKS content - supports both Promise and callback patterns.
 * @param {string} jwksContent - The JWKS content to validate
 * @param {Function} [successCallback] - Success callback (optional)
 * @param {Function} [errorCallback] - Error callback (optional)
 * @returns {Promise} Promise for the request (if no callbacks provided)
 */
export const validateJwksContent = (jwksContent, successCallback, errorCallback) => {
    const promise = apiCall('POST', `${BASE_URL}/validate-jwks-content`, { jwksContent });
    
    if (successCallback || errorCallback) {
        promise
            .then(data => successCallback?.(data))
            .catch(createApiClientCallbackErrorHandler(errorCallback));
        return;
    }
    
    return promise;
};

/**
 * Verifies a JWT token - supports both Promise and callback patterns.
 * @param {string} token - The JWT token to verify
 * @param {Function} [successCallback] - Success callback (optional)
 * @param {Function} [errorCallback] - Error callback (optional)
 * @returns {Promise} Promise for the request (if no callbacks provided)
 */
export const verifyToken = (token, successCallback, errorCallback) => {
    const promise = apiCall('POST', `${BASE_URL}/verify-token`, { token });
    
    if (successCallback || errorCallback) {
        promise
            .then(data => successCallback?.(data))
            .catch(createApiClientCallbackErrorHandler(errorCallback));
        return;
    }
    
    return promise;
};

/**
 * Gets security metrics - supports both Promise and callback patterns.
 * @param {Function} [successCallback] - Success callback (optional)
 * @param {Function} [errorCallback] - Error callback (optional)
 * @returns {Promise} Promise for the request (if no callbacks provided)
 */
export const getSecurityMetrics = (successCallback, errorCallback) => {
    const promise = apiCall('GET', `${BASE_URL}/metrics`);
    
    if (successCallback || errorCallback) {
        promise
            .then(data => successCallback?.(data))
            .catch(createApiClientCallbackErrorHandler(errorCallback));
        return;
    }
    
    return promise;
};

/**
 * Gets processor properties.
 * @param {string} processorId - The ID of the processor
 * @returns {Promise} Promise for the request
 */
export const getProcessorProperties = (processorId) => {
    return apiCall('GET', `../nifi-api/processors/${processorId}`);
};

/**
 * Updates processor properties - simplified error handling.
 * @param {string} processorId - The ID of the processor
 * @param {Object} properties - The properties to update
 * @returns {Promise} Promise for the request
 */
export const updateProcessorProperties = (processorId, properties) => {
    return getProcessorProperties(processorId).then(processor => {
        const updateRequest = {
            revision: processor.revision,
            component: {
                id: processorId,
                properties
            }
        };
        
        return apiCall('PUT', `../nifi-api/processors/${processorId}`, updateRequest);
    });
};