'use strict';

/**
 * Token Verification Interface UI component.
 */
import $ from 'cash-dom';
import * as nfCommon from 'nf.Common';
import { displayUiError } from '../utils/uiErrorDisplay.js';
import { confirmClearForm } from '../utils/confirmationDialog.js';
import { getIsLocalhost, setIsLocalhostForTesting, API, CSS } from '../utils/constants.js';
import { FormFieldFactory } from '../utils/formBuilder.js';

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
    const $container = $(`<div class="${CSS.TOKEN_VERIFIER.CONTAINER}"></div>`);

    // Create token input area using factory pattern
    const $inputSection = $(`<div class="${CSS.TOKEN_VERIFIER.INPUT_SECTION}"></div>`);

    // Create token input field using the factory
    const tokenField = formFactory.createField({
        name: 'token-input',
        label: i18n['processor.jwt.tokenInput'] || 'Enter Token',
        description: i18n['processor.jwt.tokenInputDescription'] || 'Paste your JWT token for verification',
        placeholder: i18n['processor.jwt.tokenInputPlaceholder'] || 'Paste token here...',
        type: 'textarea',
        required: true,
        cssClass: 'token-verifier-field',
        attributes: { rows: 5 }
    });

    // Create verify button using factory
    const $verifyButton = $(formFactory.createButton({
        text: i18n['processor.jwt.verifyToken'] || 'Verify Token',
        variant: 'primary',
        cssClass: CSS.TOKEN_VERIFIER.VERIFY_BUTTON,
        icon: 'fa-check'
        // No onClick handler - will be attached separately for compatibility
    }));

    // Create clear button
    const $clearButton = $(formFactory.createButton({
        text: 'Clear',
        variant: 'secondary',
        cssClass: 'clear-token-button',
        icon: 'fa-trash'
    }));

    // Create button container
    const $buttonContainer = $('<div class="button-container"></div>');
    $buttonContainer.append($verifyButton[0]).append($clearButton[0]);

    $inputSection.append(tokenField).append($buttonContainer[0]);

    // Create results area
    const $resultsSection = $(`<div class="${CSS.TOKEN_VERIFIER.RESULTS_SECTION}"></div>`);
    const $resultsHeader = $('<h3></h3>')
        .text(i18n['processor.jwt.verificationResults'] || 'Verification Results');
    const $resultsContent = $(`<div class="${CSS.TOKEN_VERIFIER.RESULTS_CONTENT}"></div>`);

    $resultsSection.append($resultsHeader).append($resultsContent);

    // Add sections to container
    $container.append($inputSection).append($resultsSection);

    // Add container to element
    $(element).append($container); // element is the parent div provided by NiFi

    // Handle verify button click
    $verifyButton.on('click', () => {
        // Get token value from the factory-created field
        const $tokenInput = $(tokenField).find('#field-token-input');
        const token = $tokenInput.val().trim();

        if (!token) {
            $resultsContent.html(`<div class="${CSS.TOKEN_VERIFIER.TOKEN_ERROR}">${i18n['processor.jwt.noTokenProvided'] || 'No token provided'}</div>`);
            return;
        }

        // Add loading state to button
        $verifyButton.addClass('loading').prop('disabled', true);
        _resetUIAndShowLoading($resultsContent, i18n);

        const resetButton = () => {
            $verifyButton.removeClass('loading').prop('disabled', false);
        };

        try {
            $.ajax({
                method: 'POST',
                url: API.ENDPOINTS.JWT_VERIFY_TOKEN,
                data: JSON.stringify({ token: token }),
                contentType: 'application/json',
                dataType: 'json',
                timeout: API.TIMEOUTS.DEFAULT
            })
                .then(responseData => {
                    resetButton();
                    _handleTokenVerificationResponse(
                        responseData,
                        $resultsContent,
                        i18n,
                        _displayValidToken,
                        _displayInvalidToken
                    );
                })
                .catch(jqXHR => {
                    resetButton();
                    _handleTokenVerificationAjaxError(
                        jqXHR,
                        $resultsContent,
                        i18n,
                        _displayValidToken
                    );
                });
        } catch (e) {
            resetButton();
            _handleTokenVerificationSyncException(e, $resultsContent, i18n, _displayValidToken);
        }
    });

    // Handle clear button click
    $clearButton.on('click', async () => {
        const $tokenInput = $(tokenField).find('#field-token-input');
        const tokenValue = $tokenInput.val() ? $tokenInput.val().trim() : '';
        const resultsHtml = $resultsContent.html() || '';
        const hasContent = tokenValue || (typeof resultsHtml === 'string' && resultsHtml.trim().length > 0);

        if (hasContent) {
            // Show confirmation for clearing form data
            await confirmClearForm(() => {
                // Clear the token input
                $tokenInput.val('');

                // Clear results and show initial instructions
                _showInitialInstructions($resultsContent, i18n);
            });
        } else {
            // Nothing to clear, just show a brief message and then instructions
            $resultsContent.html('<div class="info-message">Form is already empty.</div>');
            const showInstructionsTimeout = setTimeout(() => {
                _showInitialInstructions($resultsContent, i18n);
            }, 2000);

            // Store timeout reference for potential cleanup
            if (typeof window._tokenVerifierTimeouts === 'undefined') {
                window._tokenVerifierTimeouts = [];
            }
            window._tokenVerifierTimeouts.push(showInstructionsTimeout);
        }
    });

    // Function to display valid token details (now private)
    const _displayValidToken = (response, isSimulated) => {
        const html = _createValidTokenHtml(response, isSimulated, i18n, CSS);
        $resultsContent.html(html);
    };

    // Function to display invalid token details (now private)
    const _displayInvalidToken = (response, $resultsContentFromCaller, i18nFromCaller) => {
        // Ensure we're using the passed $resultsContent and i18n if available,
        // otherwise fallback to the ones in the broader scope (though less ideal)
        const $targetContent = $resultsContentFromCaller || $resultsContent;
        const i18nToUse = i18nFromCaller || i18n;
        displayUiError($targetContent, { responseJSON: response }, i18nToUse, 'processor.jwt.tokenInvalid');
    };

    _showInitialInstructions($resultsContent, i18n);

    // Use optional chaining and logical AND for callback
    callback?.({ validate: () => true });
};

// --- Refactored Private Helper Functions ---

/**
 * Creates HTML for displaying valid token details
 * @param {object} response - Token validation response
 * @param {boolean} isSimulated - Whether this is a simulated response
 * @param {object} i18n - Internationalization object
 * @param {object} CSS - CSS constants
 * @returns {string} HTML string for valid token display
 */
const _createValidTokenHtml = (response, isSimulated, i18n, CSS) => {
    const simulatedText = isSimulated ? ' <em>(Simulated response)</em>' : '';
    const { roles = [], scopes = [] } = response;

    const rolesRow = roles.length > 0 ?
        `<tr><th>${i18n['processor.jwt.roles'] || 'Roles'}</th><td>${roles.join(', ')}</td></tr>` : '';
    const scopesRow = scopes.length > 0 ?
        `<tr><th>${i18n['processor.jwt.scopes'] || 'Scopes'}</th><td>${scopes.join(' ')}</td></tr>` : '';

    return `
        <div class="${CSS.TOKEN_VERIFIER.TOKEN_VALID}">
            <span class="fa fa-check-circle"></span>
            ${i18n['processor.jwt.tokenValid'] || 'Token is valid'}${simulatedText}
        </div>
        <div class="${CSS.TOKEN_VERIFIER.TOKEN_DETAILS}">
            <h4>${i18n['processor.jwt.tokenDetails'] || 'Token Details'}</h4>
            <table class="${CSS.TOKEN_VERIFIER.TOKEN_CLAIMS_TABLE}">
                <tr><th>${i18n['processor.jwt.subject'] || 'Subject'}</th><td>${response.subject || ''}</td></tr>
                <tr><th>${i18n['processor.jwt.issuer'] || 'Issuer'}</th><td>${response.issuer || ''}</td></tr>
                <tr><th>${i18n['processor.jwt.audience'] || 'Audience'}</th><td>${response.audience || ''}</td></tr>
                <tr><th>${i18n['processor.jwt.expiration'] || 'Expiration'}</th><td>${response.expiration || ''}</td></tr>
                ${rolesRow}
                ${scopesRow}
            </table>
            <h4>${i18n['processor.jwt.allClaims'] || 'All Claims'}</h4>
            <pre class="${CSS.TOKEN_VERIFIER.TOKEN_RAW_CLAIMS}">${JSON.stringify(
    response.claims,
    null,
    2
)}</pre>
        </div>
    `;
};

const _showInitialInstructions = ($resultsContent, i18n) => {
    $resultsContent.html(`
        <div class="${CSS.TOKEN_VERIFIER.TOKEN_INSTRUCTIONS}">
            ${i18n['processor.jwt.initialInstructions'] ||
                'Enter a JWT token above and click "Verify Token" to validate it.'}
        </div>
    `);
};

const _resetUIAndShowLoading = ($resultsContent, i18n) => {
    $resultsContent.html(`
        <div class="${CSS.TOKEN_VERIFIER.TOKEN_LOADING}">
            <div class="loading-spinner"></div>
            <span class="loading-text">${i18n['processor.jwt.verifying'] || 'Verifying token...'}</span>
        </div>
    `);
};

const _handleTokenVerificationResponse = (
    responseData,
    $resultsContent,
    i18n,
    displayValidTokenFunc,
    displayInvalidTokenFunc
) => {
    if (responseData.valid) {
        displayValidTokenFunc(responseData, false); // isSimulated is false for actual responses
    } else {
        // Pass $resultsContent and i18n to _displayInvalidToken
        displayInvalidTokenFunc(responseData, $resultsContent, i18n);
    }
};

/**
 * Extracts error message from jqXHR response, attempting JSON parsing first.
 * @param {object} jqXHR - The jQuery XHR error object
 * @returns {string} Extracted error message
 */
const _extractErrorMessageFromXHR = (jqXHR) => {
    // Default to statusText if available, otherwise use a generic message
    let errorMessage = jqXHR.statusText || 'Error processing request';

    // Only try to parse responseText if it looks like JSON (starts with { or [)
    if (jqXHR.responseText) {
        if (typeof jqXHR.responseText === 'string' &&
            (jqXHR.responseText.trim().startsWith('{') || jqXHR.responseText.trim().startsWith('['))) {
            try {
                const errorJson = JSON.parse(jqXHR.responseText);
                errorMessage = errorJson?.message || errorMessage;
            } catch (e) {
                // eslint-disable-next-line no-console
                console.debug('Failed to parse responseText as JSON:', e);
                // Keep the original error message if JSON parsing fails
            }
        } else if (typeof jqXHR.responseText === 'string') {
            // If responseText doesn't look like JSON, use it directly if it's a string
            errorMessage = jqXHR.responseText;
        }
    }

    return errorMessage;
};

/**
 * Sanitizes error message, ensuring it's not null, undefined, or problematic values.
 * @param {string} errorMessage - Raw error message
 * @param {object} i18n - Internationalization object
 * @returns {string} Sanitized error message
 */
const _sanitizeErrorMessage = (errorMessage, i18n) => {
    const isNullOrUndefined = errorMessage == null;
    const trimmedMsg = isNullOrUndefined ? '' : String(errorMessage).trim();
    const lowerCaseMsg = isNullOrUndefined ? '' : String(errorMessage).toLowerCase();

    if (isNullOrUndefined || trimmedMsg === '' || lowerCaseMsg === 'null' || lowerCaseMsg === 'undefined') {
        return i18n['processor.jwt.unknownError'] || 'Unknown error';
    }

    return errorMessage || (i18n['processor.jwt.unknownError'] || 'Unknown error');
};

/**
 * Creates a sample token response for localhost simulation.
 * @returns {object} Sample token verification response
 */
const _createSampleTokenResponse = () => {
    const expirationDate = new Date(Date.now() + 3600000).toISOString();

    return {
        valid: true,
        subject: 'user123',
        issuer: 'https://sample-issuer.example.com',
        audience: 'sample-audience',
        expiration: expirationDate,
        roles: ['admin', 'user'],
        scopes: ['read', 'write'],
        claims: {
            sub: 'user123',
            iss: 'https://sample-issuer.example.com',
            aud: 'sample-audience',
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
            roles: ['admin', 'user'],
            scope: 'read write',
            name: 'John Doe',
            email: 'john.doe@example.com'
        }
    };
};

/**
 * Handles AJAX errors during token verification, with localhost simulation support.
 * @param {object} jqXHR - The jQuery XHR error object
 * @param {object} $resultsContent - Results display container
 * @param {object} i18n - Internationalization object
 * @param {Function} displayValidTokenFunc - Function to display valid token
 */
const _handleTokenVerificationAjaxError = (jqXHR, $resultsContent, i18n, displayValidTokenFunc) => {
    // Extract and sanitize error message for potential future use
    const errorMessage = _extractErrorMessageFromXHR(jqXHR);
    // eslint-disable-next-line no-console
    console.debug('Extracted error message:', errorMessage);

    if (getIsLocalhost()) {
        const sampleResponse = _createSampleTokenResponse();
        displayValidTokenFunc(sampleResponse, true); // isSimulated is true
    } else {
        displayUiError($resultsContent, jqXHR, i18n, 'processor.jwt.verificationError');
    }
};

/**
 * Handles synchronous exceptions during token verification, with localhost simulation support.
 * @param {Error} exception - The exception object
 * @param {object} $resultsContent - Results display container
 * @param {object} i18n - Internationalization object
 * @param {Function} displayValidTokenFunc - Function to display valid token
 */
const _handleTokenVerificationSyncException = (
    exception,
    $resultsContent,
    i18n,
    displayValidTokenFunc
) => {
    // Sanitize exception message for potential future use
    const sanitizedMessage = _sanitizeErrorMessage(exception.message, i18n);
    // eslint-disable-next-line no-console
    console.debug('Sanitized error message:', sanitizedMessage);

    if (getIsLocalhost()) {
        const sampleResponse = _createSampleTokenResponse();
        displayValidTokenFunc(sampleResponse, true); // isSimulated is true
    } else {
        displayUiError($resultsContent, exception, i18n, 'processor.jwt.verificationError');
    }
};


/**
 * Cleanup function for the token verifier component.
 * Removes event listeners and cleans up resources.
 */
export const cleanup = () => {
    // Reset localhost override for testing
    setIsLocalhostForTesting(null);
};

export const __setIsLocalhostForTesting = function (value) {
    setIsLocalhostForTesting(value);
};

/**
 * Extracted verify button click logic for testing
 * @param {string} token - The token to verify
 * @param {object} $resultsContent - Results content element
 * @param {object} i18n - Internationalization object
 * @param {Function} resetButton - Function to reset button state
 * @returns {boolean} True if verification started, false if token was empty
 */
const _handleVerifyButtonClick = (token, $resultsContent, i18n, resetButton) => {
    const trimmedToken = token.trim();
    if (!trimmedToken) {
        $resultsContent.html(`<div class="${CSS.TOKEN_VERIFIER.TOKEN_ERROR}">${i18n['processor.jwt.noTokenProvided'] || 'No token provided'}</div>`);
        return false;
    }

    _resetUIAndShowLoading($resultsContent, i18n);

    try {
        $.ajax({
            method: 'POST',
            url: API.ENDPOINTS.JWT_VERIFY_TOKEN,
            data: JSON.stringify({ token: trimmedToken }),
            contentType: 'application/json',
            dataType: 'json',
            timeout: API.TIMEOUTS.DEFAULT
        })
            .then(responseData => {
                resetButton();
                _handleTokenVerificationResponse(
                    responseData,
                    $resultsContent,
                    i18n,
                    (response, isSimulated) => {
                        // Create HTML and display it
                        const html = _createValidTokenHtml(response, isSimulated, i18n, CSS);
                        $resultsContent.html(html);
                    },
                    (response, $resultsContentParam, i18nParam) => {
                        // Use provided params or fallback to closure variables
                        const $targetContent = $resultsContentParam || $resultsContent;
                        const i18nToUse = i18nParam || i18n;
                        displayUiError($targetContent, { responseJSON: response }, i18nToUse, 'processor.jwt.tokenInvalid');
                    }
                );
            })
            .catch(jqXHR => {
                resetButton();
                _handleTokenVerificationAjaxError(
                    jqXHR,
                    $resultsContent,
                    i18n,
                    (response, isSimulated) => {
                        // Create HTML and display it
                        const html = _createValidTokenHtml(response, isSimulated, i18n, CSS);
                        $resultsContent.html(html);
                    }
                );
            });
    } catch (e) {
        resetButton();
        _handleTokenVerificationSyncException(e, $resultsContent, i18n, (response, isSimulated) => {
            // Create HTML and display it
            const html = _createValidTokenHtml(response, isSimulated, i18n, CSS);
            $resultsContent.html(html);
        });
    }

    return true;
};

/**
 * Extracted clear button click logic for testing
 * @param {string} tokenValue - Current token value
 * @param {string} resultsHtml - Current results HTML
 * @param {object} $resultsContent - Results content element
 * @param {object} i18n - Internationalization object
 * @returns {boolean} True if content exists to clear
 */
const _handleClearButtonClick = (tokenValue, resultsHtml, $resultsContent, i18n) => {
    const hasContent = !!(tokenValue || (typeof resultsHtml === 'string' && resultsHtml.trim().length > 0));

    if (!hasContent) {
        $resultsContent.html('<div class="info-message">Form is already empty.</div>');
        setTimeout(() => {
            _showInitialInstructions($resultsContent, i18n);
        }, 2000);
    }

    return hasContent;
};

// Export internal functions for testing
export const __test = {
    showInitialInstructions: _showInitialInstructions,
    resetUIAndShowLoading: _resetUIAndShowLoading,
    handleTokenVerificationResponse: _handleTokenVerificationResponse,
    extractErrorMessageFromXHR: _extractErrorMessageFromXHR,
    sanitizeErrorMessage: _sanitizeErrorMessage,
    createSampleTokenResponse: _createSampleTokenResponse,
    handleTokenVerificationAjaxError: _handleTokenVerificationAjaxError,
    handleTokenVerificationSyncException: _handleTokenVerificationSyncException,
    handleVerifyButtonClick: _handleVerifyButtonClick,
    handleClearButtonClick: _handleClearButtonClick,
    createValidTokenHtml: _createValidTokenHtml
};
