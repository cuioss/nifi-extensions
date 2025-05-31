/**
 * API Client for JWT Token Validation.
 * Provides methods for interacting with the backend REST API.
 */
define(['jquery', 'nf.Common'], function ($, _nfCommon) {
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

    return {
        /**
         * Validates a JWKS URL.
         *
         * @param {string} jwksUrl - The JWKS URL to validate
         * @param {Function} successCallback - The callback to invoke on success
         * @param {Function} errorCallback - The callback to invoke on error
         */
        validateJwksUrl: function (jwksUrl, successCallback, errorCallback) {
            $.ajax({
                type: 'POST',
                url: BASE_URL + '/validate-jwks-url',
                data: JSON.stringify({ jwksUrl: jwksUrl }),
                contentType: 'application/json',
                dataType: 'json'
            }).done(function (response) {
                successCallback(response);
            }).fail(function (xhr) {
                handleApiError(xhr, errorCallback);
            });
        },

        /**
         * Validates a JWKS file.
         *
         * @param {string} filePath - The path to the JWKS file
         * @param {Function} successCallback - The callback to invoke on success
         * @param {Function} errorCallback - The callback to invoke on error
         */
        validateJwksFile: function (filePath, successCallback, errorCallback) {
            $.ajax({
                type: 'POST',
                url: BASE_URL + '/validate-jwks-file',
                data: JSON.stringify({ filePath: filePath }),
                contentType: 'application/json',
                dataType: 'json'
            }).done(function (response) {
                successCallback(response);
            }).fail(function (xhr) {
                handleApiError(xhr, errorCallback);
            });
        },

        /**
         * Validates JWKS content.
         *
         * @param {string} jwksContent - The JWKS content to validate
         * @param {Function} successCallback - The callback to invoke on success
         * @param {Function} errorCallback - The callback to invoke on error
         */
        validateJwksContent: function (jwksContent, successCallback, errorCallback) {
            $.ajax({
                type: 'POST',
                url: BASE_URL + '/validate-jwks-content',
                data: JSON.stringify({ jwksContent: jwksContent }),
                contentType: 'application/json',
                dataType: 'json'
            }).done(function (response) {
                successCallback(response);
            }).fail(function (xhr) {
                handleApiError(xhr, errorCallback);
            });
        },

        /**
         * Verifies a JWT token.
         *
         * @param {string} token - The JWT token to verify
         * @param {Function} successCallback - The callback to invoke on success
         * @param {Function} errorCallback - The callback to invoke on error
         */
        verifyToken: function (token, successCallback, errorCallback) {
            $.ajax({
                type: 'POST',
                url: BASE_URL + '/verify-token',
                data: JSON.stringify({ token: token }),
                contentType: 'application/json',
                dataType: 'json'
            }).done(function (response) {
                successCallback(response);
            }).fail(function (xhr) {
                handleApiError(xhr, errorCallback);
            });
        },

        /**
         * Gets security metrics.
         *
         * @param {Function} successCallback - The callback to invoke on success
         * @param {Function} errorCallback - The callback to invoke on error
         */
        getSecurityMetrics: function (successCallback, errorCallback) {
            $.ajax({
                type: 'GET',
                url: BASE_URL + '/metrics',
                dataType: 'json'
            }).done(function (response) {
                successCallback(response);
            }).fail(function (xhr) {
                handleApiError(xhr, errorCallback);
            });
        },

        /**
         * Gets processor properties.
         *
         * @param {string} processorId - The ID of the processor
         * @return {jQuery.Deferred} A jQuery Deferred object for the request
         */
        getProcessorProperties: function (processorId) {
            return $.ajax({
                type: 'GET',
                url: '../nifi-api/processors/' + processorId,
                dataType: 'json'
            });
        },

        /**
         * Updates processor properties.
         *
         * @param {string} processorId - The ID of the processor
         * @param {Object} properties - The properties to update
         * @return {jQuery.Deferred} A jQuery Deferred object for the request
         */
        updateProcessorProperties: function (processorId, properties) {
            // First, get the current processor configuration
            return $.ajax({
                type: 'GET',
                url: '../nifi-api/processors/' + processorId,
                dataType: 'json'
            }).then(function (processor) {
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
                    type: 'PUT',
                    url: '../nifi-api/processors/' + processorId,
                    data: JSON.stringify(updateRequest),
                    contentType: 'application/json',
                    dataType: 'json'
                });
            });
        }
    };
});
