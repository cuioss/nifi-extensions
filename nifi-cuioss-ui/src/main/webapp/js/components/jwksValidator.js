/**
 * JWKS Validation Button UI component.
 */
import * as nfCommon from 'nf.Common';
import { displayUiError } from '../utils/uiErrorDisplay.js';
import { validateJwksUrl } from '../services/apiClient.js';

/**
 * Initialize the custom UI with standardized error handling and async patterns.
 *
 * @param {object} element - The DOM element
 * @param {string} propertyValue - The property value
 * @param {string} jwks_type - The JWKS type (server, file, memory)
 * @param {Function} callback - The callback function
 * @returns {Promise<void>}
 */
export const init = async (element, propertyValue, jwks_type, callback) => {
    try {
        await _initializeJwksValidator(element, propertyValue, jwks_type, callback);
    } catch (error) {
        // Still call callback to maintain contract, even on error
        callback?.({
            validate: () => false,
            error: error.message
        });
        throw error; // Re-throw for ComponentManager to handle
    }
};

/**
 * Internal initialization function with proper error boundaries.
 * @param {object} element - The DOM element
 * @param {string} propertyValue - The property value
 * @param {string} jwks_type - The JWKS type (server, file, memory)
 * @param {Function} callback - The callback function
 * @returns {Promise<void>}
 * @private
 */
const _initializeJwksValidator = async (element, propertyValue, jwks_type, callback) => {
    if (!element) {
        throw new Error('JWKS validator element is required');
    }
    // Get i18n resources from NiFi Common
    const i18n = nfCommon.getI18n() || {};

    // Create UI elements
    const container = document.createElement('div');
    container.className = 'jwks-verification-container';

    // Store callback object reference in closure
    let callbackObj = null;

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
            const buttonWrapper = document.createElement('div');
            buttonWrapper.className = 'jwks-button-wrapper';
            buttonWrapper.appendChild(verifyButton);
            buttonWrapper.appendChild(resultContainer);
            inputField.parentNode.insertBefore(buttonWrapper, inputField.nextSibling);
        } else {
            // Fallback: Add elements to the container (which is then appended to element)
            container.appendChild(verifyButton);
            container.appendChild(resultContainer);
        }

        // Handle button click
        verifyButton.addEventListener('click', () => {
            resultContainer.innerHTML = i18n['processor.jwt.testing'] || 'Testing...';
            // Use the callback to get the current property value if available
            const currentJwksValue = callbackObj?.getValue ? callbackObj.getValue() : propertyValue;
            // Also check for value from input field
            const inputValue = inputField ? inputField.value : null;
            const jwksValue = inputValue || currentJwksValue || 'https://example.com/.well-known/jwks.json';

            try {
                validateJwksUrl(jwksValue)
                    .then(responseData => _handleAjaxSuccess(responseData, resultContainer, i18n))
                    .catch(error => {
                        // Convert error to jqXHR-like object for compatibility
                        const jqXHRLike = error.jqXHR || {
                            status: error.status || 500,
                            statusText: error.statusText || 'Error',
                            responseJSON: error.responseJSON || { error: error.message || 'Unknown error' }
                        };
                        _handleAjaxError(jqXHRLike, resultContainer, i18n);
                    });
            } catch (e) {
                _handleSynchronousError(e, resultContainer, i18n);
            }
        });

        // Add a default text to the result container for better UX
        resultContainer.innerHTML = `<em>${i18n['jwksValidator.initialInstructions'] || 'Click the button to validate JWKS'}</em>`;
    }

    element.appendChild(container);

    // Initialize callback if provided
    // Use optional chaining for callback
    if (callback) {
        let currentPropertyValue = propertyValue;
        callbackObj = {
            validate: () => true,
            getValue: () => currentPropertyValue,
            setValue: newValue => {
                currentPropertyValue = newValue;
            },
            jwks_type
        };
        callback(callbackObj);
    }
};

// Private function to handle AJAX success response
const _handleAjaxSuccess = (responseData, resultContainer, i18n) => {
    if (responseData.valid) {
        resultContainer.innerHTML = `
            <span style="color: var(--success-color); font-weight: bold;">
                ${i18n['processor.jwt.ok'] || 'OK'}
            </span>
            ${i18n['processor.jwt.validJwks'] || 'Valid JWKS'}
            (${responseData.keyCount} ${i18n['processor.jwt.keysFound'] || 'keys found'})
        `;
    } else {
        displayUiError(resultContainer, { responseJSON: responseData }, i18n, 'processor.jwt.invalidJwks');
    }
};

// Private function to handle AJAX error response
const _handleAjaxError = (jqXHR, resultContainer, i18n) => {
    // Always display the actual error (no localhost simulation)
    displayUiError(resultContainer, jqXHR, i18n);
};

// Private function to handle synchronous errors during AJAX setup or other issues
const _handleSynchronousError = (exception, resultContainer, i18n) => {
    // Always display the actual error (no localhost simulation)
    displayUiError(resultContainer, exception, i18n);
};

/**
 * Cleanup function for the JWKS validator component.
 * Removes event listeners and cleans up resources.
 */
export const cleanup = () => {
    // Cleanup any event listeners or resources
};

