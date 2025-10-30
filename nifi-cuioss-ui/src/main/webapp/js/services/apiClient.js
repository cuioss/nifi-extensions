/**
 * Simple API Client for NiFi CUIOSS JWT validation operations.
 *
 * This module provides a Promise-based API for consistency and eliminates
 * legacy callback patterns. It offers standardized error handling and
 * consistent AJAX configuration across all API operations.
 *
 * @fileoverview API client for JWT validation and processor management
 * @author CUIOSS Team
 * @since 1.0.0
 */
'use strict';
import { API } from '../utils/constants.js';
import { createXhrErrorObject } from '../utils/errorHandler.js';

const BASE_URL = API.BASE_URL;

/**
 * Gets authentication configuration from URL parameters or stored config.
 * This retrieves the processor ID needed for authentication.
 *
 * @returns {Object} Authentication configuration
 * @returns {string} returns.processorId - The processor ID
 */
const getAuthConfig = () => {
    // First check if we have stored auth config
    if (globalThis.jwtAuthConfig?.processorId) {
        return globalThis.jwtAuthConfig;
    }

    // Get processor ID from URL parameters (this is safe - it's just an identifier)
    const urlParams = new URLSearchParams(globalThis.location.search);
    const processorId = urlParams.get('id') || urlParams.get('processorId');  // NiFi uses 'id' parameter

    if (processorId) {
        globalThis.jwtAuthConfig = { processorId };
        return globalThis.jwtAuthConfig;
    }

    // Return default config if not available (for standalone testing)
    return { processorId: '' };
};

/**
 * Generic API call helper that eliminates duplicate AJAX setup across methods.
 *
 * This function provides standardized AJAX configuration including timeout,
 * content type, and data serialization. It serves as the foundation for all
 * API operations in the application.
 *
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {string} endpoint - API endpoint URL (relative or absolute)
 * @param {Object|null} [data=null] - Request data to be JSON serialized
 * @param {boolean} [includeAuth=true] - Whether to include authentication headers
 * @returns {Promise<Object>} Promise that resolves to the API response data
 *
 * @example
 * // GET request
 * const response = await apiCall('GET', '/api/data');
 *
 * @example
 * // POST request with data
 * const result = await apiCall('POST', '/api/submit', {name: 'test'});
 */
const apiCall = (method, endpoint, data = null, includeAuth = true) => {
    const config = {
        method,
        url: endpoint,
        dataType: 'json',
        timeout: API.TIMEOUTS.DEFAULT
    };

    // Add authentication headers for JWT API endpoints
    if (includeAuth && endpoint.includes('/jwt/')) {
        const authConfig = getAuthConfig();
        config.headers = {
            'X-Processor-Id': authConfig.processorId
        };

        // Also add processorId to the data if it's a JWT endpoint
        if (data && authConfig.processorId) {
            data.processorId = authConfig.processorId;
        }
    }

    if (data) {
        config.data = JSON.stringify(data);
        config.contentType = 'application/json';
    }

    // Cash-DOM doesn't have ajax, use fetch API instead
    const fetchOptions = {
        method: config.method || 'GET',
        headers: config.headers || {},
        credentials: 'same-origin'
    };

    if (config.data) {
        fetchOptions.body = config.data;
        if (config.contentType) {
            fetchOptions.headers['Content-Type'] = config.contentType;
        }
    }

    return fetch(config.url, fetchOptions)
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw createXhrErrorObject({
                        status: response.status,
                        statusText: response.statusText,
                        responseText: text
                    });
                });
            }
            return response.json();
        });
};

/**
 * Validates a JWKS (JSON Web Key Set) URL for accessibility and format.
 *
 * This function verifies that the provided JWKS URL is reachable and
 * returns a valid JWKS document. It's used during issuer configuration
 * to ensure the JWKS endpoint is properly configured.
 *
 * @param {string} jwksUrl - The JWKS URL to validate (must be a valid HTTP/HTTPS URL)
 * @returns {Promise<Object>} Promise that resolves to validation result
 * @returns {boolean} returns.valid - Whether the JWKS URL is valid and accessible
 * @returns {string} [returns.error] - Error message if validation failed
 * @returns {Object} [returns.jwks] - The JWKS document if successfully retrieved
 *
 * @throws {StandardizedError} When the API request fails or URL is invalid
 *
 * @example
 * // Validate a JWKS URL
 * try {
 *   const result = await validateJwksUrl('https://auth.example.com/.well-known/jwks.json');
 *   if (result.valid) {
 *     console.log('JWKS URL is valid');
 *   }
 * } catch (error) {
 *   console.error('Validation failed:', error.statusText);
 * }
 */
export const validateJwksUrl = (jwksUrl) => {
    return apiCall('POST', `${BASE_URL}/validate-jwks-url`, { jwksUrl })
        .catch(error => { throw createXhrErrorObject(error); });
};

/**
 * Validates a local JWKS file for format and content correctness.
 *
 * This function verifies that a local JWKS file contains valid JSON Web Keys
 * and can be used for token verification. It's used when JWKS are stored
 * locally rather than fetched from a remote URL.
 *
 * @param {string} filePath - The local file system path to the JWKS file
 * @returns {Promise<Object>} Promise that resolves to validation result
 * @returns {boolean} returns.valid - Whether the JWKS file is valid
 * @returns {string} [returns.error] - Error message if validation failed
 * @returns {Object} [returns.jwks] - The parsed JWKS document if valid
 *
 * @throws {StandardizedError} When the API request fails or file is invalid
 *
 * @example
 * // Validate a local JWKS file
 * try {
 *   const result = await validateJwksFile('/path/to/jwks.json');
 *   if (result.valid) {
 *     console.log('JWKS file is valid');
 *   }
 * } catch (error) {
 *   console.error('File validation failed:', error.statusText);
 * }
 */
export const validateJwksFile = (filePath) => {
    return apiCall('POST', `${BASE_URL}/validate-jwks-file`, { filePath })
        .catch(error => { throw createXhrErrorObject(error); });
};

/**
 * Validates raw JWKS content for JSON format and key structure correctness.
 *
 * This function verifies that the provided JWKS content is valid JSON and
 * contains properly formatted JSON Web Keys. It's used for inline JWKS
 * validation or when JWKS content is pasted directly into the UI.
 *
 * @param {string} jwksContent - The raw JWKS JSON content to validate
 * @returns {Promise<Object>} Promise that resolves to validation result
 * @returns {boolean} returns.valid - Whether the JWKS content is valid
 * @returns {string} [returns.error] - Error message if validation failed
 * @returns {Object} [returns.jwks] - The parsed JWKS object if valid
 * @returns {number} [returns.keyCount] - Number of keys found in the JWKS
 *
 * @throws {StandardizedError} When the API request fails or content is invalid
 *
 * @example
 * // Validate JWKS content
 * const jwksJson = '{"keys": [{"kty": "RSA", ...}]}';
 * try {
 *   const result = await validateJwksContent(jwksJson);
 *   if (result.valid) {
 *     console.log(`Found ${result.keyCount} keys`);
 *   }
 * } catch (error) {
 *   console.error('Content validation failed:', error.statusText);
 * }
 */
export const validateJwksContent = (jwksContent) => {
    return apiCall('POST', `${BASE_URL}/validate-jwks-content`, { jwksContent })
        .catch(error => { throw createXhrErrorObject(error); });
};

/**
 * Verifies a JWT token against configured issuers and their JWKS.
 *
 * This function validates a JWT token's signature, expiration, and claims
 * against the currently configured issuers. It returns detailed information
 * about the token's validity and extracted claims.
 *
 * @param {string} token - The JWT token to verify (should include header, payload, and signature)
 * @returns {Promise<Object>} Promise that resolves to verification result
 * @returns {boolean} returns.valid - Whether the token is valid
 * @returns {string} [returns.error] - Error message if verification failed
 * @returns {Object} [returns.claims] - Extracted JWT claims if valid
 * @returns {string} [returns.issuer] - The issuer that validated the token
 * @returns {number} [returns.exp] - Token expiration timestamp
 * @returns {string} [returns.sub] - Token subject
 * @returns {Array<string>} [returns.aud] - Token audience(s)
 *
 * @throws {StandardizedError} When the API request fails or token is malformed
 *
 * @example
 * // Verify a JWT token
 * const token = 'eyJhbGciOiJSUzI1NiIs...';
 * try {
 *   const result = await verifyToken(token);
 *   if (result.valid) {
 *     console.log('Token verified by:', result.issuer);
 *     console.log('Subject:', result.claims.sub);
 *   } else {
 *     console.error('Token invalid:', result.error);
 *   }
 * } catch (error) {
 *   console.error('Verification failed:', error.statusText);
 * }
 */
export const verifyToken = (token) => {
    // Normal production path - make actual API call
    // Note: localhost simulation is handled by the tokenVerifier component
    return apiCall('POST', `${BASE_URL}/verify-token`, { token })
        .catch(error => { throw createXhrErrorObject(error); });
};

/**
 * Retrieves security metrics for JWT validation operations.
 *
 * This function fetches comprehensive security metrics including token
 * validation counts, error rates, issuer performance, and security events.
 * Used for monitoring and debugging JWT validation performance.
 *
 * @returns {Promise<Object>} Promise that resolves to security metrics
 * @returns {number} returns.totalValidations - Total number of token validations
 * @returns {number} returns.successfulValidations - Number of successful validations
 * @returns {number} returns.failedValidations - Number of failed validations
 * @returns {Object} returns.issuerMetrics - Per-issuer validation statistics
 * @returns {Array<Object>} returns.recentErrors - Recent validation errors
 * @returns {number} returns.averageResponseTime - Average validation response time (ms)
 *
 * @throws {StandardizedError} When the API request fails
 *
 * @example
 * // Get security metrics
 * try {
 *   const metrics = await getSecurityMetrics();
 *   console.log(`Success rate: ${metrics.successfulValidations / metrics.totalValidations * 100}%`);
 *   console.log(`Average response time: ${metrics.averageResponseTime}ms`);
 * } catch (error) {
 *   console.error('Failed to get metrics:', error.statusText);
 * }
 */
export const getSecurityMetrics = () => {
    return apiCall('GET', `${BASE_URL}/metrics`)
        .catch(error => { throw createXhrErrorObject(error); });
};

/**
 * Retrieves the current properties and configuration of a NiFi processor.
 *
 * This function fetches the complete processor configuration including
 * properties, revision information, and current state. It's used to read
 * the current configuration before making updates.
 *
 * @param {string} processorId - The UUID of the NiFi processor
 * @returns {Promise<Object>} Promise that resolves to processor configuration
 * @returns {Object} returns.revision - Processor revision information for updates
 * @returns {Object} returns.component - Processor component configuration
 * @returns {Object} returns.component.properties - Current processor properties
 * @returns {string} returns.component.id - Processor ID
 * @returns {string} returns.component.type - Processor type
 * @returns {string} returns.component.state - Current processor state
 *
 * @throws {StandardizedError} When the API request fails or processor not found
 *
 * @example
 * // Get processor configuration
 * try {
 *   const processor = await getProcessorProperties('12345678-1234-1234-1234-123456789abc');
 *   console.log('Current properties:', processor.component.properties);
 *   console.log('Processor state:', processor.component.state);
 * } catch (error) {
 *   console.error('Failed to get processor:', error.statusText);
 * }
 */
export const getProcessorProperties = (processorId) => {
    return apiCall('GET', `nifi-api/processors/${processorId}`);
};

/**
 * Updates NiFi processor properties with automatic revision handling.
 *
 * This function updates processor properties by first fetching the current
 * configuration to get the revision, then submitting the update. It ensures
 * proper revision handling to prevent conflicts with concurrent updates.
 *
 * @param {string} processorId - The UUID of the NiFi processor to update
 * @param {Object} properties - The properties to update (key-value pairs)
 * @returns {Promise<Object>} Promise that resolves to updated processor configuration
 * @returns {Object} returns.revision - Updated revision information
 * @returns {Object} returns.component - Updated processor component
 *
 * @throws {StandardizedError} When the API request fails, processor not found, or revision conflict
 *
 * @example
 * // Update processor properties
 * const newProperties = {
 *   'issuer-config': JSON.stringify({
 *     'sample-issuer': {
 *       issuer: 'https://auth.example.com',
 *       jwksUrl: 'https://auth.example.com/.well-known/jwks.json'
 *     }
 *   })
 * };
 *
 * try {
 *   const updated = await updateProcessorProperties('12345678-1234-1234-1234-123456789abc', newProperties);
 *   console.log('Processor updated successfully');
 * } catch (error) {
 *   console.error('Update failed:', error.statusText);
 * }
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

        return apiCall('PUT', `nifi-api/processors/${processorId}`, updateRequest);
    });
};
