'use strict';

/**
 * Token Verification Interface UI component.
 */
import * as nfCommon from 'nf.Common';
import { displayUiError } from '../utils/uiErrorDisplay.js';
import { confirmClearForm } from '../utils/confirmationDialog.js';
import { CSS } from '../utils/constants.js';
import { FormFieldFactory } from '../utils/formBuilder.js';
import { verifyToken } from '../services/apiClient.js';

/**
 * Initialize the custom UI with standardized error handling and async patterns.
 *
 * @param {object} element - The DOM element
 * @param {object} _config - The component configuration (unused)
 * @param {string} _type - The component type (not used)
 * @param {Function} callback - The callback function
 * @returns {Promise<void>}
 */
export const init = async (element, _config, _type, callback) => {
    try {
        await _initializeTokenVerifier(element, callback);
    } catch (error) {
        // Still call callback to maintain contract, even on error
        if (typeof callback === 'function') {
            callback({
                validate: () => false,
                error: error.message
            });
        }
        throw error; // Re-throw for ComponentManager to handle
    }
};

/**
 * Internal initialization function with proper error boundaries.
 * @param {object} element - The DOM element
 * @param {Function} callback - The callback function
 * @returns {Promise<void>}
 * @private
 */
const _initializeTokenVerifier = async (element, callback) => {
    if (!element) {
        throw new Error('Token verifier element is required');
    }

    // Get i18n resources from NiFi Common
    const i18n = nfCommon.getI18n() || {};

    // Create form factory instance with i18n support
    const formFactory = new FormFieldFactory({ i18n });

    // Create UI elements
    const container = document.createElement('div');
    container.className = CSS.TOKEN_VERIFIER.CONTAINER;

    // Create token input area using factory pattern
    const inputSection = document.createElement('div');
    inputSection.className = CSS.TOKEN_VERIFIER.INPUT_SECTION;

    // Create token input field using the factory
    const tokenField = formFactory.createField({
        name: 'token-input',
        label: i18n['processor.jwt.tokenInput'] || 'Enter Token',
        description: i18n['processor.jwt.tokenInputDescription'] || 'Paste your JWT token for verification',
        placeholder: i18n['processor.jwt.tokenInputPlaceholder'] || 'Paste token here...',
        type: 'textarea',
        required: true,
        cssClass: 'token-verifier-field',
        attributes: { rows: 5 },
        disabled: false  // Explicitly set disabled to false (not string "false")
    });

    // Create verify button using factory
    const verifyButton = formFactory.createButton({
        text: i18n['processor.jwt.verifyToken'] || 'Verify Token',
        variant: 'primary',
        cssClass: CSS.TOKEN_VERIFIER.VERIFY_BUTTON,
        icon: 'fa-check'
        // No onClick handler - will be attached separately for compatibility
    });

    // Create clear button
    const clearButton = formFactory.createButton({
        text: 'Clear',
        variant: 'secondary',
        cssClass: 'clear-token-button',
        icon: 'fa-trash'
    });

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    buttonContainer.appendChild(verifyButton);
    buttonContainer.appendChild(clearButton);

    inputSection.appendChild(tokenField);
    inputSection.appendChild(buttonContainer);

    // Create results area
    const resultsSection = document.createElement('div');
    resultsSection.className = CSS.TOKEN_VERIFIER.RESULTS_SECTION;

    const resultsHeader = document.createElement('h3');
    resultsHeader.textContent = i18n['processor.jwt.verificationResults'] || 'Verification Results';

    const resultsContent = document.createElement('div');
    resultsContent.className = CSS.TOKEN_VERIFIER.RESULTS_CONTENT;

    resultsSection.appendChild(resultsHeader);
    resultsSection.appendChild(resultsContent);

    container.appendChild(inputSection);
    container.appendChild(resultsSection);

    element.appendChild(container);

    // Attach event handlers after adding to DOM
    verifyButton.addEventListener('click', async () => {
        const tokenInput = tokenField.querySelector('#field-token-input');
        const token = tokenInput ? tokenInput.value.trim() : '';

        if (!token) {
            displayUiError(resultsContent, null, i18n, 'processor.jwt.noTokenProvided');
            return;
        }

        // Clear previous results
        resultsContent.innerHTML = `<div class="verifying">${i18n['processor.jwt.verifying'] || 'Verifying token...'}</div>`;

        try {
            const result = await verifyToken(token);
            _displayVerificationResults(result, resultsContent, i18n);
        } catch (error) {
            const jqXHRLike = error.jqXHR || {
                status: error.status || 500,
                statusText: error.statusText || 'Error',
                responseJSON: error.responseJSON || { error: error.message || 'Unknown error' }
            };
            displayUiError(resultsContent, jqXHRLike, i18n);
        }
    });

    clearButton.addEventListener('click', () => {
        confirmClearForm(() => {
            const tokenInput = tokenField.querySelector('#field-token-input');
            if (tokenInput) {
                tokenInput.value = '';
            }
            resultsContent.innerHTML = '';
        });
    });

    // Initialize callback if provided
    if (typeof callback === 'function') {
        callback({
            validate: () => true,
            getValue: () => {
                const tokenInput = tokenField.querySelector('#field-token-input');
                return tokenInput ? tokenInput.value : '';
            },
            setValue: (value) => {
                const tokenInput = tokenField.querySelector('#field-token-input');
                if (tokenInput) {
                    tokenInput.value = value;
                }
            }
        });
    }
};

/**
 * Display verification results in the UI.
 * @param {Object} result - The verification result
 * @param {HTMLElement} container - The container element
 * @param {Object} i18n - Internationalization object
 * @private
 */
const _displayVerificationResults = (result, container, i18n) => {
    // Check if token is expired first
    let isExpired = false;
    if (result.decoded && result.decoded.payload && result.decoded.payload.exp) {
        const expDate = new Date(result.decoded.payload.exp * 1000);
        isExpired = expDate < new Date();
    }

    const statusClass = isExpired ? 'expired' : (result.valid ? 'valid' : 'invalid');
    let statusText;
    let statusIcon;
    if (isExpired) {
        statusText = i18n['processor.jwt.tokenExpired'] || 'Token has expired';
        statusIcon = 'fa-clock';
    } else if (result.valid) {
        statusText = i18n['processor.jwt.tokenValid'] || 'Token is valid';
        statusIcon = 'fa-check-circle';
    } else {
        statusText = i18n['processor.jwt.tokenInvalid'] || 'Token is invalid';
        statusIcon = 'fa-times-circle';
    }

    let html = `
        <div class="verification-status ${statusClass}">
            <i class="fa ${statusIcon}"></i>
            <span>${statusText}</span>
        </div>
    `;

    if (result.decoded) {
        html += '<div class="token-details">';

        // Header
        if (result.decoded.header) {
            html += `
                <div class="token-section">
                    <h4>${i18n['processor.jwt.tokenHeader'] || 'Header'}</h4>
                    <pre>${JSON.stringify(result.decoded.header, null, 2)}</pre>
                </div>
            `;
        }

        // Payload
        if (result.decoded.payload) {
            html += `
                <div class="token-section">
                    <h4>${i18n['processor.jwt.tokenPayload'] || 'Payload'}</h4>
                    <pre>${JSON.stringify(result.decoded.payload, null, 2)}</pre>
                </div>
            `;

            // Extract and display specific claims
            const payload = result.decoded.payload;
            html += '<div class="token-claims">';

            if (payload.exp) {
                const expDate = new Date(payload.exp * 1000);
                const isExpired = expDate < new Date();
                html += `
                    <div class="claim ${isExpired ? 'expired' : ''}">
                        <strong>${i18n['processor.jwt.expiration'] || 'Expiration'}:</strong>
                        ${expDate.toLocaleString()}
                        ${isExpired ? ` <span class="expired-label">(${i18n['processor.jwt.expired'] || 'Expired'})</span>` : ''}
                    </div>
                `;
            }

            if (payload.iss) {
                html += `
                    <div class="claim">
                        <strong>${i18n['processor.jwt.issuer'] || 'Issuer'}:</strong>
                        ${payload.iss}
                    </div>
                `;
            }

            if (payload.sub) {
                html += `
                    <div class="claim">
                        <strong>${i18n['processor.jwt.subject'] || 'Subject'}:</strong>
                        ${payload.sub}
                    </div>
                `;
            }

            html += '</div>';
        }

        html += '</div>';
    }

    if (result.error) {
        html += `
            <div class="verification-error">
                <strong>${i18n['processor.jwt.error'] || 'Error'}:</strong>
                ${result.error}
            </div>
        `;
    }

    container.innerHTML = html;
};

/**
 * Cleanup function for the token verifier component.
 * Removes event listeners and cleans up resources.
 */
export const cleanup = () => {
    // Event listeners are automatically cleaned up when elements are removed
};
