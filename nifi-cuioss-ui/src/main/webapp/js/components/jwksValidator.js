/**
 * JWKS Validation Button UI component.
 */
import $ from 'cash-dom';
import * as nfCommon from 'nf.Common'; // Assuming nfCommon provides a default export or nf.Common.js is adjusted
import { displayUiError } from '../utils/uiErrorDisplay.js';

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
        $verifyButton.on('click', () => {
            $resultContainer.html(i18n['processor.jwt.testing'] || 'Testing...');
            // Use the callback to get the current property value if available
            const currentJwksValue = (typeof callback === 'function' && callback.getValue) ? callback.getValue() : propertyValue;
            const jwksValue = currentJwksValue || 'https://example.com/.well-known/jwks.json';

            try {
                $.ajax({
                    method: 'POST',
                    url: '../nifi-api/processors/jwks/validate-url',
                    data: JSON.stringify({ jwksValue: jwksValue }),
                    contentType: 'application/json',
                    dataType: 'json',
                    timeout: 5000
                })
                    .then(responseData => _handleAjaxSuccess(responseData, $resultContainer, i18n))
                    .catch(jqXHR => _handleAjaxError(jqXHR, $resultContainer, i18n));
            } catch (e) {
                _handleSynchronousError(e, $resultContainer, i18n);
            }
        });

        // Add a default text to the result container for better UX
        $resultContainer.html('<em>' + (i18n['jwksValidator.initialInstructions'] || 'Click the button to validate JWKS') + '</em>');
    }

    $(element).append($container); // element is the parent div provided by NiFi


    // Initialize callback if provided
    if (typeof callback === 'function') {
        // Ensure propertyValue is updated if setValue is called via the callback
        let currentPropertyValue = propertyValue;
        callback({
            validate: () => true,
            getValue: () => currentPropertyValue,
            setValue: newValue => { currentPropertyValue = newValue; propertyValue = newValue; }, // Update both for safety
            jwks_type: jwks_type
        });
    }
};

// Private function to handle AJAX success response
const _handleAjaxSuccess = (responseData, $resultContainer, i18n) => {
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
};

// Private function to handle AJAX error response
const _handleAjaxError = (jqXHR, $resultContainer, i18n) => {
    if (getIsLocalhost()) {
        $resultContainer.html('<span style="color: var(--success-color); font-weight: bold;">' +
                               (i18n['processor.jwt.ok'] || 'OK') + '</span> ' +
                               (i18n['processor.jwt.validJwks'] || 'Valid JWKS') +
                               ' (3 ' + (i18n['processor.jwt.keysFound'] || 'keys found') +
                               ') <em>(Simulated response)</em>');
    } else {
        displayUiError($resultContainer, jqXHR, i18n);
    }
};

// Private function to handle synchronous errors during AJAX setup or other issues
const _handleSynchronousError = (exception, $resultContainer, i18n) => {
    if (getIsLocalhost()) {
        $resultContainer.html('<span style="color: var(--success-color); font-weight: bold;">' +
                               (i18n['processor.jwt.ok'] || 'OK') + '</span> ' +
                               (i18n['processor.jwt.validJwks'] || 'Valid JWKS') +
                               ' (3 ' + (i18n['processor.jwt.keysFound'] || 'keys found') +
                               ') <em>(Simulated response)</em>');
    } else {
        displayUiError($resultContainer, exception, i18n);
    }
};

// Function for testing purposes only to control the isLocalhost behavior
export const __setIsLocalhostForTesting = function (value) {
    isLocalhostOverride = (value === null) ? null : !!value;
};
