/**
 * Token Verification Interface UI component.
 */
import $ from 'cash-dom';
import * as nfCommon from 'nf.Common';
import { displayUiError } from '../utils/uiErrorDisplay.js';
import { getIsLocalhost, setIsLocalhostForTesting, API, CSS } from '../utils/constants.js';

'use strict';

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
        console.error('Error initializing token verifier:', error);
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

    // Create UI elements
    const $container = $(`<div class="${CSS.TOKEN_VERIFIER.CONTAINER}"></div>`);

    // Create token input area
    const $inputSection = $(`<div class="${CSS.TOKEN_VERIFIER.INPUT_SECTION}"></div>`);
    const $inputLabel = $('<label for="token-input"></label>')
        .text(i18n['processor.jwt.tokenInput'] || 'Enter Token:');
    const $tokenInput = $(`<textarea id="token-input" class="${CSS.TOKEN_VERIFIER.TOKEN_INPUT}" rows="5"></textarea>`)
        .attr('placeholder', i18n['processor.jwt.tokenInputPlaceholder'] || 'Paste token here...');
    const $verifyButton = $(`<button type="button" class="${CSS.TOKEN_VERIFIER.VERIFY_BUTTON}"></button>`)
        .text(i18n['processor.jwt.verifyToken'] || 'Verify Token');

    $inputSection.append($inputLabel).append($tokenInput).append($verifyButton);

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
        const token = $tokenInput.val().trim();

        if (!token) {
            $resultsContent.html(`<div class="${CSS.TOKEN_VERIFIER.TOKEN_ERROR}">${i18n['processor.jwt.noTokenProvided'] || 'No token provided'}</div>`);
            return;
        }

        _resetUIAndShowLoading($resultsContent, i18n);

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
                    _handleTokenVerificationResponse(
                        responseData,
                        $resultsContent,
                        i18n,
                        _displayValidToken,
                        _displayInvalidToken
                    );
                })
                .catch(jqXHR => {
                    _handleTokenVerificationAjaxError(
                        jqXHR,
                        $resultsContent,
                        i18n,
                        _displayValidToken
                    );
                });
        } catch (e) {
            _handleTokenVerificationSyncException(e, $resultsContent, i18n, _displayValidToken);
        }
    });

    // Function to display valid token details (now private)
    const _displayValidToken = (response, isSimulated) => {
        const simulatedText = isSimulated ? ' <em>(Simulated response)</em>' : '';
        const { roles = [], scopes = [] } = response;

        const rolesRow = roles.length > 0 ?
            `<tr><th>${i18n['processor.jwt.roles'] || 'Roles'}</th><td>${roles.join(', ')}</td></tr>` : '';
        const scopesRow = scopes.length > 0 ?
            `<tr><th>${i18n['processor.jwt.scopes'] || 'Scopes'}</th><td>${scopes.join(' ')}</td></tr>` : '';

        const html = `
            <div class="${CSS.TOKEN_VERIFIER.TOKEN_VALID}">
                <span class="fa fa-check-circle"></span> 
                ${i18n['processor.jwt.tokenValid'] || 'Token is valid'}${simulatedText}
            </div>
            <div class="${CSS.TOKEN_VERIFIER.TOKEN_DETAILS}">
                <h4>${i18n['processor.jwt.tokenDetails'] || 'Token Details'}</h4>
                <table class="token-claims-table">
                    <tr><th>${i18n['processor.jwt.subject'] || 'Subject'}</th><td>${response.subject || ''}</td></tr>
                    <tr><th>${i18n['processor.jwt.issuer'] || 'Issuer'}</th><td>${response.issuer || ''}</td></tr>
                    <tr><th>${i18n['processor.jwt.audience'] || 'Audience'}</th><td>${response.audience || ''}</td></tr>
                    <tr><th>${i18n['processor.jwt.expiration'] || 'Expiration'}</th><td>${response.expiration || ''}</td></tr>
                    ${rolesRow}
                    ${scopesRow}
                </table>
                <h4>${i18n['processor.jwt.allClaims'] || 'All Claims'}</h4>
                <pre class="token-raw-claims">${JSON.stringify(response.claims, null, 2)}</pre>
            </div>
        `;
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

    $resultsContent.html(`
        <div class="token-instructions">
            ${i18n['processor.jwt.initialInstructions'] ||
                'Enter a JWT token above and click "Verify Token" to validate it.'}
        </div>
    `);

    // Use optional chaining and logical AND for callback
    callback?.({ validate: () => true });
};

// --- Refactored Private Helper Functions ---

const _resetUIAndShowLoading = ($resultsContent, i18n) => {
    $resultsContent.html(`
        <div class="${CSS.TOKEN_VERIFIER.TOKEN_LOADING}">
            <span class="fa fa-spinner fa-spin"></span> 
            ${i18n['processor.jwt.verifying'] || 'Verifying token...'}
        </div>
    `);
};

const _handleTokenVerificationResponse = (responseData, $resultsContent, i18n, displayValidTokenFunc, displayInvalidTokenFunc) => {
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
    let errorMessage = jqXHR.statusText || jqXHR.responseText;

    if (jqXHR.responseText) {
        try {
            const errorJson = JSON.parse(jqXHR.responseText);
            errorMessage = errorJson?.message || errorMessage;
        } catch (e) {
            errorMessage = jqXHR.responseText || errorMessage;
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
    _extractErrorMessageFromXHR(jqXHR);

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
const _handleTokenVerificationSyncException = (exception, $resultsContent, i18n, displayValidTokenFunc) => {
    // Sanitize exception message for potential future use
    _sanitizeErrorMessage(exception.message, i18n);

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
    console.debug('Token verifier cleanup completed');
};

export const __setIsLocalhostForTesting = function (value) {
    setIsLocalhostForTesting(value);
};
