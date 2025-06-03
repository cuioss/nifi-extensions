/**
 * JWKS Validation Button UI component.
 */
import $ from 'cash-dom';
import { ajax } from '../utils/ajax';
import * as nfCommon from 'nf.Common'; // Assuming nfCommon provides a default export or nf.Common.js is adjusted

let isLocalhostOverride = null; // Allows tests to control localhost behavior

// Helper function to determine if running in a localhost-like environment
const getIsLocalhost = () => { // Stays module-scoped
    if (isLocalhostOverride !== null) {
        return isLocalhostOverride;
    }
    return window.location.href.indexOf('localhost') !== -1 || window.location.href.indexOf('127.0.0.1') !== -1;
};

/**
 * Initialize the custom UI.
 *
 * @param {object} element - The DOM element
 * @param {string} propertyValue - The property value
 * @param {string} jwks_type - The JWKS type (server, file, memory)
 * @param {Function} callback - The callback function
 */
export const init = function (element, propertyValue, jwks_type, callback) {
    // Get i18n resources from NiFi Common
    const i18n = nfCommon.getI18n() || {};

    // Create UI elements
    const $container = $('<div class="jwks-verification-container"></div>');

    // Only show the Test Connection button for the 'server' type (URL input)
    if (jwks_type === 'server') {
        // Create the button and result container
        const $verifyButton = $('<button type="button" class="verify-jwks-button"></button>')
            .text(i18n['processor.jwt.testConnection'] || 'Test Connection');
        const $resultContainer = $('<div class="verification-result"></div>');

        // Find the input field (element is the parent div containing the input)
        const $inputField = $(element).find('input');

        // If we can find the input field, insert the button directly after it
        if ($inputField.length) {
            const $buttonWrapper = $('<div class="jwks-button-wrapper"></div>')
                .append($verifyButton)
                .append($resultContainer);
            $inputField.after($buttonWrapper);
        } else {
            // Fallback: Add elements to the container (which is then appended to element)
            $container.append($verifyButton).append($resultContainer);
        }

        // Handle button click
        $verifyButton.on('click', function () {
            // Show loading state
            $resultContainer.html(i18n['processor.jwt.testing'] || 'Testing...');

            // Get the current value
            const jwksValue = propertyValue || 'https://example.com/.well-known/jwks.json';

            try {
                // Make the AJAX request to validate
                ajax({
                    method: 'POST',
                    url: '../nifi-api/processors/jwks/validate-url', // Ensure this URL is correct
                    data: JSON.stringify({ jwksValue: jwksValue }),
                    contentType: 'application/json',
                    timeout: 5000
                })
                    .then(response => { // response here is { data, status, statusText }
                        const responseData = response.data;
                        if (responseData.valid) {
                            $resultContainer.html('<span style="color: var(--success-color); font-weight: bold;">' +
                                                   (i18n['processor.jwt.ok'] || 'OK') + '</span> ' +
                                                   (i18n['processor.jwt.validJwks'] || 'Valid JWKS') +
                                                   ' (' + responseData.keyCount + ' ' +
                                                   (i18n['processor.jwt.keysFound'] || 'keys found') + ')');
                        } else {
                            $resultContainer.html('<span style="color: var(--error-color); font-weight: bold;">' +
                                                   (i18n['processor.jwt.failed'] || 'Failed') + '</span> ' +
                                                   (i18n['processor.jwt.invalidJwks'] || 'Invalid JWKS') + ': ' +
                                                   responseData.message);
                        }
                    })
                    .catch(error => {
                        let errorMessage = error.message;
                        // Attempt to get a more detailed error message if available
                        if (error.response && typeof error.response.text === 'function') {
                            error.response.text().then(text => {
                                errorMessage = text || error.message; // Use text if available, else fallback
                                displayError(errorMessage);
                            }).catch(() => {
                                displayError(errorMessage); // Fallback if .text() fails
                            });
                        } else if (error.response && error.response.statusText) {
                            errorMessage = error.response.statusText;
                            displayError(errorMessage);
                        } else {
                            displayError(errorMessage);
                        }

                        function displayError(msg) {
                            const displayMsg = (msg === null || typeof msg === 'undefined' || String(msg).trim() === '' || String(msg).toLowerCase() === 'null' || String(msg).toLowerCase() === 'undefined')
                                ? (i18n['processor.jwt.unknownError'] || 'Unknown error') // Fallback to i18n key
                                : msg;
                            // In standalone testing mode, show a simulated success response
                            if (getIsLocalhost()) {
                                $resultContainer.html('<span style="color: var(--success-color); font-weight: bold;">' +
                                                       (i18n['processor.jwt.ok'] || 'OK') + '</span> ' +
                                                       (i18n['processor.jwt.validJwks'] || 'Valid JWKS') +
                                                       ' (3 ' + (i18n['processor.jwt.keysFound'] || 'keys found') +
                                                       ') <em>(Simulated response)</em>');
                            } else {
                                $resultContainer.html('<span style="color: var(--error-color); font-weight: bold;">' +
                                                       (i18n['processor.jwt.failed'] || 'Failed') + '</span> ' +
                                                       (i18n['processor.jwt.validationError'] || 'Validation error') + ': ' +
                                                       displayMsg);
                            }
                        }
                    });
            } catch (e) {
                const exceptionMessage = (e.message === null || typeof e.message === 'undefined' || String(e.message).trim() === '' || String(e.message).toLowerCase() === 'null' || String(e.message).toLowerCase() === 'undefined')
                    ? (i18n['processor.jwt.unknownError'] || 'Exception occurred') // Fallback to i18n key for exceptions
                    : e.message;

                // In standalone testing mode, show a simulated success response
                // For exceptions, always show simulated success if getIsLocalhost() is true,
                // otherwise, it will fall through to the generic error message for non-localhost.
                if (getIsLocalhost()) {
                    $resultContainer.html('<span style="color: var(--success-color); font-weight: bold;">' +
                                               (i18n['processor.jwt.ok'] || 'OK') + '</span> ' +
                                               (i18n['processor.jwt.validJwks'] || 'Valid JWKS') +
                                               ' (3 ' + (i18n['processor.jwt.keysFound'] || 'keys found') +
                                               ') <em>(Simulated response)</em>');
                } else {
                    // Display a generic error message for non-localhost exceptions in the UI
                    $resultContainer.html('<span style="color: var(--error-color); font-weight: bold;">' +
                                               (i18n['processor.jwt.failed'] || 'Failed') + '</span> ' +
                                               (i18n['processor.jwt.validationError'] || 'Validation error') + ': ' +
                                               exceptionMessage);
                }
            }
        });

        // Add a default text to the result container for better UX
        $resultContainer.html('<em>' + (i18n['jwksValidator.initialInstructions'] || 'Click the button to validate JWKS') + '</em>');
    }

    $(element).append($container); // element is the parent div provided by NiFi


    // Initialize callback if provided
    if (typeof callback === 'function') {
        callback({
            validate: function () { return true; },
            getValue: function () { return propertyValue; },
            setValue: function (newValue) { propertyValue = newValue; },
            jwks_type: jwks_type
        });
    }
};

// Function for testing purposes only to control the isLocalhost behavior
export const __setIsLocalhostForTesting = function (value) {
    isLocalhostOverride = (value === null) ? null : !!value;
};
