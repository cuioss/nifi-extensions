/**
 * JWKS Validation Button UI component.
 */
import * as nfCommon from 'nf.Common';
import { displayUiError } from '../utils/uiErrorDisplay.js';
import { validateJwksUrl, validateJwksFile } from '../services/apiClient.js';

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
            // Display loading indicator with proper CSS class
            resultContainer.innerHTML = `<span class="loading">${i18n['processor.jwt.testing'] || 'Testing...'}</span>`;
            // Use the callback to get the current property value if available
            const currentJwksValue = callbackObj?.getValue ? callbackObj.getValue() : propertyValue;
            // Also check for value from input field
            const inputValue = inputField ? inputField.value : null;
            const jwksValue = inputValue || currentJwksValue || 'https://example.com/.well-known/jwks.json';

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
        });

        // Add a default text to the result container for better UX
        resultContainer.innerHTML = `<em>${i18n['jwksValidator.initialInstructions'] || 'Click the button to validate JWKS'}</em>`;
    }

    // Add UI for file type JWKS
    if (jwks_type === 'file') {
        const fileContainer = document.createElement('div');
        fileContainer.className = 'jwks-file-container';
        const filePathDisplay = document.createElement('div');
        filePathDisplay.className = 'file-path-display';
        const fileDesc = i18n['processor.jwt.filePathDescription'] || 'Enter file path to JWKS file';
        filePathDisplay.innerHTML = `<em>${fileDesc}</em>`;
        const validateButton = document.createElement('button');
        validateButton.type = 'button';
        validateButton.className = 'validate-file-button';
        validateButton.textContent = i18n['processor.jwt.validateFile'] || 'Validate File';
        const resultContainer = document.createElement('div');
        resultContainer.className = 'file-validation-result';
        fileContainer.appendChild(filePathDisplay);
        fileContainer.appendChild(validateButton);
        fileContainer.appendChild(resultContainer);
        container.appendChild(fileContainer);
        // Handle file validation button click
        validateButton.addEventListener('click', () => {
            const inputField = element.querySelector('input');
            const filePath = inputField ? inputField.value : propertyValue;
            if (!filePath) {
                resultContainer.innerHTML = `<span class="error-message">${i18n['processor.jwt.noFilePathProvided'] || 'No file path provided'}</span>`;
                return;
            }

            const validatingMsg = i18n['processor.jwt.validatingFile'] || 'Validating file...';
            resultContainer.innerHTML = `<span class="loading">${validatingMsg}</span>`;
            // Call the file validation API
            validateJwksFile(filePath)
                .then(responseData => {
                    if (responseData.valid) {
                        const okText = i18n['processor.jwt.ok'] || 'OK';
                        const validText = i18n['processor.jwt.validJwksFile'] || 'Valid JWKS file';
                        const keysText = i18n['processor.jwt.keysFound'] || 'keys found';
                        const successStyle = 'color: var(--success-color); font-weight: bold;';
                        resultContainer.innerHTML = `
                            <span class="success-message valid" style="${successStyle}">
                                ${okText}
                            </span>
                            ${validText}
                            (${responseData.keyCount} ${keysText})
                        `;
                    } else {
                        const errMsg = responseData.error ||
                            i18n['processor.jwt.invalidJwksFile'] || 'Invalid JWKS file';
                        resultContainer.innerHTML = `<span class="error-message">${errMsg}</span>`;
                    }
                })
                .catch(error => {
                    // Handle API error
                    const errorMessage = error.responseJSON?.error || error.statusText ||
                        i18n['processor.jwt.fileValidationError'] || 'File validation error';
                    const errorSpan = `<span class="error-message">${errorMessage}</span>`;
                    resultContainer.innerHTML = errorSpan;
                });
        });
    }
    // Add UI for memory type JWKS (manual content entry)
    if (jwks_type === 'memory') {
        const memoryContainer = document.createElement('div');
        memoryContainer.className = 'jwks-memory-container';
        const contentDescription = document.createElement('div');
        contentDescription.className = 'content-description';
        const contentDesc = i18n['processor.jwt.memoryContentDescription'] || 'Enter JWKS JSON content directly';
        contentDescription.innerHTML = `<em>${contentDesc}</em>`;
        const validateButton = document.createElement('button');
        validateButton.type = 'button';
        validateButton.className = 'validate-content-button';
        validateButton.textContent = i18n['processor.jwt.validateContent'] || 'Validate JSON';
        const resultContainer = document.createElement('div');
        resultContainer.className = 'content-validation-result';
        memoryContainer.appendChild(contentDescription);
        memoryContainer.appendChild(validateButton);
        memoryContainer.appendChild(resultContainer);
        container.appendChild(memoryContainer);
        // Handle content validation button click
        validateButton.addEventListener('click', () => {
            const inputField = element.querySelector('textarea') || element.querySelector('input');
            const content = inputField ? inputField.value : propertyValue;
            if (!content) {
                resultContainer.innerHTML = `<span class="error-message">${i18n['processor.jwt.noContentProvided'] || 'No JWKS content provided'}</span>`;
                return;
            }

            const validatingMsg = i18n['processor.jwt.validatingContent'] || 'Validating content...';
            resultContainer.innerHTML = `<span class="loading">${validatingMsg}</span>`;
            // Perform client-side JSON validation
            try {
                const jwksData = JSON.parse(content);
                // Basic JWKS structure validation
                if (!jwksData.keys || !Array.isArray(jwksData.keys)) {
                    const errMsg = i18n['processor.jwt.invalidJwksStructure'] ||
                        'Invalid JWKS structure: missing "keys" array';
                    throw new Error(errMsg);
                }

                if (jwksData.keys.length === 0) {
                    throw new Error(i18n['processor.jwt.noKeysInJwks'] || 'No keys found in JWKS');
                }

                // Validate each key has required fields
                let index = 0;
                for (const key of jwksData.keys) {
                    if (!key.kty) {
                        throw new Error(`${i18n['processor.jwt.missingKeyType'] || 'Missing key type (kty)'} at index ${index}`);
                    }
                    if (!key.use && !key.key_ops) {
                        const errMsg = i18n['processor.jwt.missingKeyUsage'] ||
                            'Missing key usage (use or key_ops)';
                        throw new Error(`${errMsg} at index ${index}`);
                    }
                    index++;
                }
                const okText = i18n['processor.jwt.ok'] || 'OK';
                const validText = i18n['processor.jwt.validJwks'] || 'Valid JWKS';
                const keysText = i18n['processor.jwt.keysFound'] || 'keys found';
                const successStyle = 'color: var(--success-color); font-weight: bold;';
                resultContainer.innerHTML = `
                    <span class="success-message valid" style="${successStyle}">
                        ${okText}
                    </span>
                    ${validText}
                    (${jwksData.keys.length} ${keysText})
                `;
            } catch (error) {
                const errMsg = i18n['processor.jwt.invalidJson'] || 'Invalid JSON';
                const errorSpan = `<span class="error-message">${errMsg}: ${error.message}</span>`;
                resultContainer.innerHTML = errorSpan;
            }
        });
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
        const okText = i18n['processor.jwt.ok'] || 'OK';
        const validText = i18n['processor.jwt.validJwks'] || 'Valid JWKS';
        const keysText = i18n['processor.jwt.keysFound'] || 'keys found';
        const successStyle = 'color: var(--success-color); font-weight: bold;';
        resultContainer.innerHTML = `
            <span class="success-message valid" style="${successStyle}">
                ${okText}
            </span>
            ${validText}
            (${responseData.keyCount} ${keysText})
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

