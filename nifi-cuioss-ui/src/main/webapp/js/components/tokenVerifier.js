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
import { sanitizeHtml } from '../utils/formatters.js';

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
 * Check if token is expired based on payload
 * @param {Object} result - Verification result
 * @returns {boolean} True if token is expired
 */
const isTokenExpired = (result) => {
    if (!result.decoded?.payload?.exp) {
        return false;
    }
    const expDate = new Date(result.decoded.payload.exp * 1000);
    return expDate < new Date();
};

/**
 * Get status information for token
 * @param {Object} result - Verification result
 * @param {boolean} isExpired - Whether token is expired
 * @param {Object} i18n - Internationalization object
 * @returns {Object} Status class, text, and icon
 */
const getTokenStatus = (result, isExpired, i18n) => {
    if (isExpired) {
        return {
            statusClass: 'expired',
            statusText: i18n['processor.jwt.tokenExpired'] || 'Token has expired',
            statusIcon: 'fa-clock'
        };
    }
    if (result.valid) {
        return {
            statusClass: 'valid',
            statusText: i18n['processor.jwt.tokenValid'] || 'Token is valid',
            statusIcon: 'fa-check-circle'
        };
    }
    return {
        statusClass: 'invalid',
        statusText: i18n['processor.jwt.tokenInvalid'] || 'Token is invalid',
        statusIcon: 'fa-times-circle'
    };
};

/**
 * Build status HTML
 * @param {Object} status - Status information
 * @returns {string} HTML string
 */
const buildStatusHtml = (status) => {
    return `
        <div class="verification-status ${status.statusClass}">
            <i class="fa ${status.statusIcon}"></i>
            <span>${status.statusText}</span>
        </div>
    `;
};

/**
 * Build header section HTML
 * @param {Object} header - Token header
 * @param {Object} i18n - Internationalization object
 * @returns {string} HTML string
 */
const buildHeaderHtml = (header, i18n) => {
    if (!header) return '';
    return `
        <div class="token-section">
            <h4>${i18n['processor.jwt.tokenHeader'] || 'Header'}</h4>
            <pre>${JSON.stringify(header, null, 2)}</pre>
        </div>
    `;
};

/**
 * Build payload section HTML
 * @param {Object} payload - Token payload
 * @param {Object} i18n - Internationalization object
 * @returns {string} HTML string
 */
const buildPayloadHtml = (payload, i18n) => {
    if (!payload) return '';
    return `
        <div class="token-section">
            <h4>${i18n['processor.jwt.tokenPayload'] || 'Payload'}</h4>
            <pre>${JSON.stringify(payload, null, 2)}</pre>
        </div>
    `;
};

/**
 * Build claims HTML
 * @param {Object} payload - Token payload
 * @param {Object} i18n - Internationalization object
 * @returns {string} HTML string
 */
const buildClaimsHtml = (payload, i18n) => {
    if (!payload) return '';

    let html = '<div class="token-claims">';

    if (payload.exp) {
        const expDate = new Date(payload.exp * 1000);
        const expired = expDate < new Date();
        html += `
            <div class="claim ${expired ? 'expired' : ''}">
                <strong>${i18n['processor.jwt.expiration'] || 'Expiration'}:</strong>
                ${expDate.toLocaleString()}
                ${expired ? ` <span class="expired-label">(${i18n['processor.jwt.expired'] || 'Expired'})</span>` : ''}
            </div>
        `;
    }

    if (payload.iss) {
        html += `
            <div class="claim">
                <strong>${i18n['processor.jwt.issuer'] || 'Issuer'}:</strong>
                ${sanitizeHtml(String(payload.iss))}
            </div>
        `;
    }

    if (payload.sub) {
        html += `
            <div class="claim">
                <strong>${i18n['processor.jwt.subject'] || 'Subject'}:</strong>
                ${sanitizeHtml(String(payload.sub))}
            </div>
        `;
    }

    html += '</div>';
    return html;
};

/**
 * Build error HTML
 * @param {string} error - Error message
 * @param {Object} i18n - Internationalization object
 * @returns {string} HTML string
 */
const buildErrorHtml = (error, i18n) => {
    if (!error) return '';
    return `
        <div class="verification-error">
            <strong>${i18n['processor.jwt.error'] || 'Error'}:</strong>
            ${sanitizeHtml(String(error))}
        </div>
    `;
};

/**
 * Display verification results in the UI.
 * @param {Object} result - The verification result
 * @param {HTMLElement} container - The container element
 * @param {Object} i18n - Internationalization object
 * @private
 */
const _displayVerificationResults = (result, container, i18n) => {
    const isExpired = isTokenExpired(result);
    const status = getTokenStatus(result, isExpired, i18n);

    let html = buildStatusHtml(status);

    if (result.decoded) {
        html += '<div class="token-details">';
        html += buildHeaderHtml(result.decoded.header, i18n);
        html += buildPayloadHtml(result.decoded.payload, i18n);
        html += buildClaimsHtml(result.decoded.payload, i18n);
        html += '</div>';
    }

    html += buildErrorHtml(result.error, i18n);

    container.innerHTML = html;
};

/**
 * Cleanup function for the token verifier component.
 * Removes event listeners and cleans up resources.
 */
export const cleanup = () => {
    // Event listeners are automatically cleaned up when elements are removed
};
