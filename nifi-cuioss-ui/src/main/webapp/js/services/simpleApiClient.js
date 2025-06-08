/**
 * Simple API Client - replaces 165 lines of mixed Promise/callback patterns.
 * Standardizes on Promise-based API for consistency.
 */
import $ from 'cash-dom';
import { API } from '../utils/constants.js';

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
    return apiCall('POST', `${BASE_URL}/validate-jwks-url`, { jwksUrl });
};

/**
 * Validates a JWKS file.
 * @param {string} filePath - The path to the JWKS file
 * @returns {Promise} Promise for the request
 */
export const validateJwksFile = (filePath) => {
    return apiCall('POST', `${BASE_URL}/validate-jwks-file`, { filePath });
};

/**
 * Validates JWKS content - converted to Promise-based for consistency.
 * @param {string} jwksContent - The JWKS content to validate
 * @returns {Promise} Promise for the request
 */
export const validateJwksContent = (jwksContent) => {
    return apiCall('POST', `${BASE_URL}/validate-jwks-content`, { jwksContent });
};

/**
 * Verifies a JWT token - converted to Promise-based for consistency.
 * @param {string} token - The JWT token to verify
 * @returns {Promise} Promise for the request
 */
export const verifyToken = (token) => {
    return apiCall('POST', `${BASE_URL}/verify-token`, { token });
};

/**
 * Gets security metrics - converted to Promise-based for consistency.
 * @returns {Promise} Promise for the request
 */
export const getSecurityMetrics = () => {
    return apiCall('GET', `${BASE_URL}/metrics`);
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