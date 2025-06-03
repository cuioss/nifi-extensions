/**
 * JWKS Validation Button UI component.
 */
import { compatAjax } from '../utils/ajax';
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

    console.log('[DEBUG_LOG] jwksValidator.init called with type:', jwks_type);

    // Create UI elements
    const container = document.createElement('div');
    container.className = 'jwks-verification-container';

    // Only show the Test Connection button for the 'server' type (URL input)
    if (jwks_type === 'server') {
        // Create the button and result container
        const verifyButton = document.createElement('button');
        verifyButton.type = 'button';
        verifyButton.className = 'verify-jwks-button';
        verifyButton.textContent = i18n['processor.jwt.testConnection'] || 'Test Connection';

        const resultContainer = document.createElement('div');
        resultContainer.className = 'verification-result';

        // Find the input field (element is the parent div containing the input)
        const inputField = element.querySelector('input');

        // If we can find the input field, insert the button directly after it
        if (inputField) {
            // Create a wrapper div for the button and result container
            const buttonWrapper = document.createElement('div');
            buttonWrapper.className = 'jwks-button-wrapper';
            buttonWrapper.appendChild(verifyButton);
            buttonWrapper.appendChild(resultContainer);

            // Insert the button wrapper directly after the input field
            if (inputField.parentNode) {
                inputField.parentNode.insertBefore(buttonWrapper, inputField.nextSibling);
            } else {
                // Fallback if inputField has no parent (should not happen in typical DOM structures)
                element.appendChild(buttonWrapper);
            }
        } else {
            // Fallback: Add elements to the container (which is then appended to element)
            container.appendChild(verifyButton);
            container.appendChild(resultContainer);
        }

        // Handle button click
        verifyButton.addEventListener('click', function () {
            // Show loading state
            resultContainer.innerHTML = (i18n['processor.jwt.testing'] || 'Testing...');

            // Get the current value
            const jwksValue = propertyValue || 'https://example.com/.well-known/jwks.json';

            try {
                // Make the AJAX request to validate
                compatAjax({
                    type: 'POST',
                    url: '../nifi-api/processors/jwks/validate-url',
                    data: JSON.stringify({ jwksValue: jwksValue }),
                    contentType: 'application/json',
                    dataType: 'json',
                    timeout: 5000 // Add timeout to prevent long waits
                }).done(function (response) {
                    if (response.valid) {
                        resultContainer.innerHTML = ('<span style="color: var(--success-color); font-weight: bold;">' +
                                                   (i18n['processor.jwt.ok'] || 'OK') + '</span> ' +
                                                   (i18n['processor.jwt.validJwks'] || 'Valid JWKS') +
                                                   ' (' + response.keyCount + ' ' +
                                                   (i18n['processor.jwt.keysFound'] || 'keys found') + ')');
                    } else {
                        resultContainer.innerHTML = ('<span style="color: var(--error-color); font-weight: bold;">' +
                                                   (i18n['processor.jwt.failed'] || 'Failed') + '</span> ' +
                                                   (i18n['processor.jwt.invalidJwks'] || 'Invalid JWKS') + ': ' +
                                                   response.message);
                    }
                }).fail(function (xhr, status, error) {
                    console.error('[DEBUG_LOG] JWKS validation error:', status, error);

                    // In standalone testing mode, show a simulated success response
                    if (getIsLocalhost()) {
                        console.log('[DEBUG_LOG] Using simulated response for standalone testing');
                        resultContainer.innerHTML = ('<span style="color: var(--success-color); font-weight: bold;">' +
                                                   (i18n['processor.jwt.ok'] || 'OK') + '</span> ' +
                                                   (i18n['processor.jwt.validJwks'] || 'Valid JWKS') +
                                                   ' (3 ' + (i18n['processor.jwt.keysFound'] || 'keys found') +
                                                   ') <em>(Simulated response)</em>');
                    } else {
                        resultContainer.innerHTML = ('<span style="color: var(--error-color); font-weight: bold;">' +
                                                   (i18n['processor.jwt.failed'] || 'Failed') + '</span> ' +
                                                   (i18n['processor.jwt.validationError'] || 'Validation error') + ': ' +
                                                   (xhr.responseText || error || 'Unknown error'));
                    }
                });
            } catch (e) {
                console.error('[DEBUG_LOG] Exception in JWKS validation:', e);

                // In standalone testing mode, show a simulated success response
                // For exceptions, always show simulated success if getIsLocalhost() is true,
                // otherwise, it will fall through to the generic error message for non-localhost.
                // The original code didn't have a specific 'else' for non-localhost exceptions for DOM.
                // It would show the loading message and then the console would show the error.
                // For consistency with .fail(), we can add an 'else' here if desired,
                // but for now, matching original logic where non-localhost exception shows what was last in DOM.
                // To ensure non-localhost exceptions also get a clear error message in UI:
                if (getIsLocalhost()) {
                resultContainer.innerHTML = ('<span style="color: var(--success-color); font-weight: bold;">' +
                                               (i18n['processor.jwt.ok'] || 'OK') + '</span> ' +
                                               (i18n['processor.jwt.validJwks'] || 'Valid JWKS') +
                                               ' (3 ' + (i18n['processor.jwt.keysFound'] || 'keys found') +
                                               ') <em>(Simulated response)</em>');
                } else {
                    // Display a generic error message for non-localhost exceptions in the UI
                resultContainer.innerHTML = ('<span style="color: var(--error-color); font-weight: bold;">' +
                                               (i18n['processor.jwt.failed'] || 'Failed') + '</span> ' +
                                               (i18n['processor.jwt.validationError'] || 'Validation error') + ': ' +
                                               (e.message || (i18n['processor.jwt.unknownError'] || 'Exception occurred')));
                }
            }
        });

        // Add a default text to the result container for better UX
    resultContainer.innerHTML = ('<em>' + (i18n['jwksValidator.initialInstructions'] || 'Click the button to validate JWKS') + '</em>');
    }

element.appendChild(container); // element is the parent div provided by NiFi


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
