/**
 * Token Verification Interface UI component.
 */
import $ from 'cash-dom';
import * as nfCommon from 'nf.Common';

'use strict';

let isLocalhostOverride = null; // Allows tests to control localhost behavior

// Helper function to determine if running in a localhost-like environment
const getIsLocalhost = () => { // Stays module-scoped
    if (isLocalhostOverride !== null) {
        return isLocalhostOverride;
    }
    // Default behavior: check window.location.href
    return window.location.href.indexOf('localhost') !== -1 || window.location.href.indexOf('127.0.0.1') !== -1;
};

/**
 * Initialize the custom UI.
 *
 * @param {object} element - The DOM element
 * @param {object} _config - The component configuration (unused)
 * @param {string} _type - The component type (not used)
 * @param {Function} callback - The callback function
 */
export const init = function (element, _config, _type, callback) {
    // Get i18n resources from NiFi Common
    const i18n = nfCommon.getI18n() || {};

    // Create UI elements
    const $container = $('<div class="token-verification-container"></div>');

    // Create token input area
    const $inputSection = $('<div class="token-input-section"></div>');
    const $inputLabel = $('<label for="token-input"></label>')
        .text(i18n['processor.jwt.tokenInput'] || 'Enter Token:');
    const $tokenInput = $('<textarea id="token-input" class="token-input" rows="5"></textarea>')
        .attr('placeholder', i18n['processor.jwt.tokenInputPlaceholder'] || 'Paste token here...');
    const $verifyButton = $('<button type="button" class="verify-token-button"></button>')
        .text(i18n['processor.jwt.verifyToken'] || 'Verify Token');

    $inputSection.append($inputLabel).append($tokenInput).append($verifyButton);

    // Create results area
    const $resultsSection = $('<div class="token-results-section"></div>');
    const $resultsHeader = $('<h3></h3>')
        .text(i18n['processor.jwt.verificationResults'] || 'Verification Results');
    const $resultsContent = $('<div class="token-results-content"></div>');

    $resultsSection.append($resultsHeader).append($resultsContent);

    // Add sections to container
    $container.append($inputSection).append($resultsSection);

    // Add container to element
    $(element).append($container); // element is the parent div provided by NiFi

    // Handle verify button click
    $verifyButton.on('click', () => {
        const token = $tokenInput.val().trim();

        if (!token) {
            $resultsContent.html('<div class="token-error">' +
                                  (i18n['processor.jwt.noTokenProvided'] || 'No token provided') + '</div>');
            return;
        }

        _resetUIAndShowLoading($resultsContent, i18n);

        try {
            $.ajax({
                method: 'POST',
                url: '../nifi-api/processors/jwt/verify-token',
                data: JSON.stringify({ token: token }),
                contentType: 'application/json',
                dataType: 'json',
                timeout: 5000
            })
                .then(responseData => _handleTokenVerificationResponse(responseData, $resultsContent, i18n, _displayValidToken, _displayInvalidToken))
                .catch(jqXHR => _handleTokenVerificationAjaxError(jqXHR, $resultsContent, i18n, _displayValidToken));
        } catch (e) {
            _handleTokenVerificationSyncException(e, $resultsContent, i18n, _displayValidToken);
        }
    });

    // Function to display valid token details (now private)
    const _displayValidToken = (response, isSimulated) => {
        let html =
            '<div class="token-valid">' +
                '<span class="fa fa-check-circle"></span> ' +
                (i18n['processor.jwt.tokenValid'] || 'Token is valid');
        if (isSimulated) {
            html += ' <em>(Simulated response)</em>';
        }
        html += '</div>';
        html += '<div class="token-details">';
        html += '<h4>' + (i18n['processor.jwt.tokenDetails'] || 'Token Details') + '</h4>';
        html += '<table class="token-claims-table">';
        html += '<tr><th>' + (i18n['processor.jwt.subject'] || 'Subject') + '</th><td>' + (response.subject || '') + '</td></tr>';
        html += '<tr><th>' + (i18n['processor.jwt.issuer'] || 'Issuer') + '</th><td>' + (response.issuer || '') + '</td></tr>';
        html += '<tr><th>' + (i18n['processor.jwt.audience'] || 'Audience') + '</th><td>' + (response.audience || '') + '</td></tr>';
        html += '<tr><th>' + (i18n['processor.jwt.expiration'] || 'Expiration') + '</th><td>' + (response.expiration || '') + '</td></tr>';
        if (response.roles && response.roles.length > 0) {
            html += '<tr><th>' + (i18n['processor.jwt.roles'] || 'Roles') + '</th><td>' + response.roles.join(', ') + '</td></tr>';
        }
        if (response.scopes && response.scopes.length > 0) {
            html += '<tr><th>' + (i18n['processor.jwt.scopes'] || 'Scopes') + '</th><td>' + response.scopes.join(' ') + '</td></tr>';
        }
        html += '</table>';
        html += '<h4>' + (i18n['processor.jwt.allClaims'] || 'All Claims') + '</h4>';
        html += '<pre class="token-raw-claims">' + JSON.stringify(response.claims, null, 2) + '</pre>';
        html += '</div>';
        $resultsContent.html(html);
    };

    // Function to display invalid token details (now private)
    const _displayInvalidToken = response => {
        let invalidHtml =
            '<div class="token-invalid">' +
                '<span class="fa fa-times-circle"></span> ' +
                (i18n['processor.jwt.tokenInvalid'] || 'Token is invalid') +
            '</div>';
        invalidHtml += '<div class="token-error-details">';
        invalidHtml += '<h4>' + (i18n['processor.jwt.errorDetails'] || 'Error Details') + '</h4>';
        invalidHtml += '<p class="token-error-message">' + (response.message || '') + '</p>';
        if (response.category) {
            invalidHtml += '<p class="token-error-category"><strong>' +
                           (i18n['processor.jwt.errorCategory'] || 'Error Category') + ':</strong> ' +
                           response.category + '</p>';
        }
        invalidHtml += '</div>';
        $resultsContent.html(invalidHtml);
    };

    $resultsContent.html(
        '<div class="token-instructions">' +
            (i18n['processor.jwt.initialInstructions'] ||
                'Enter a JWT token above and click "Verify Token" ' +
                'to validate it.') +
            '</div>'
    );

    if (typeof callback === 'function') {
        callback({
            validate: () => true
        });
    }
};

// --- Refactored Private Helper Functions ---

const _resetUIAndShowLoading = ($resultsContent, i18n) => {
    $resultsContent.html('<div class="token-loading"><span class="fa fa-spinner fa-spin"></span> ' +
                              (i18n['processor.jwt.verifying'] || 'Verifying token...') + '</div>');
};

const _handleTokenVerificationResponse = (responseData, $resultsContent, i18n, displayValidTokenFunc, displayInvalidTokenFunc) => {
    if (responseData.valid) {
        displayValidTokenFunc(responseData, false); // isSimulated is false for actual responses
    } else {
        displayInvalidTokenFunc(responseData);
    }
};

const _handleTokenVerificationAjaxError = (jqXHR, $resultsContent, i18n, displayValidTokenFunc) => {
    let errorMessage = jqXHR.statusText || jqXHR.responseText;
    if (jqXHR.responseText) {
        try {
            const errorJson = JSON.parse(jqXHR.responseText);
            if (errorJson && errorJson.message) {
                errorMessage = errorJson.message;
            }
        } catch (e) {
            errorMessage = jqXHR.responseText || errorMessage;
        }
    }

    let messageToDisplay;
    const isNullOrUndefined = errorMessage == null;
    const trimmedMsg = isNullOrUndefined ? '' : String(errorMessage).trim();
    const lowerCaseMsg = isNullOrUndefined ? '' : String(errorMessage).toLowerCase();

    if (isNullOrUndefined || trimmedMsg === '' || lowerCaseMsg === 'null' || lowerCaseMsg === 'undefined') {
        messageToDisplay = i18n['processor.jwt.unknownError'] || 'Unknown error';
    } else {
        messageToDisplay = errorMessage;
    }
    messageToDisplay = messageToDisplay || (i18n['processor.jwt.unknownError'] || 'Unknown error');

    if (getIsLocalhost()) {
        const sampleResponse = {
            valid: true, subject: 'user123', issuer: 'https://sample-issuer.example.com',
            audience: 'sample-audience', expiration: new Date(Date.now() + 3600000).toISOString(),
            roles: ['admin', 'user'], scopes: ['read', 'write'],
            claims: {
                sub: 'user123', iss: 'https://sample-issuer.example.com',
                aud: 'sample-audience', exp: Math.floor(Date.now() / 1000) + 3600,
                iat: Math.floor(Date.now() / 1000), roles: ['admin', 'user'],
                scope: 'read write', name: 'John Doe', email: 'john.doe@example.com'
            }
        };
        displayValidTokenFunc(sampleResponse, true); // isSimulated is true
    } else {
        const verificationErrorText = i18n['processor.jwt.verificationError'] || 'Verification error';
        const errorHtml =
            '<div class="token-error">' +
            '<span class="fa fa-exclamation-triangle"></span> ' +
            verificationErrorText +
            ': ' +
            messageToDisplay +
            '</div>';
        $resultsContent.html(errorHtml);
    }
};

const _handleTokenVerificationSyncException = (exception, $resultsContent, i18n, displayValidTokenFunc) => {
    const messageIsNullOrUndefined = exception.message == null;
    const trimmedMessage = messageIsNullOrUndefined ? '' : String(exception.message).trim();
    const lowerCaseMessage = messageIsNullOrUndefined ? '' : String(exception.message).toLowerCase();

    const messageIsEmptyString = trimmedMessage === '';
    const messageIsStringNull = lowerCaseMessage === 'null';
    const messageIsStringUndefined = lowerCaseMessage === 'undefined';

    const isProblematicMessage = messageIsNullOrUndefined || messageIsEmptyString || messageIsStringNull || messageIsStringUndefined;

    const exceptionMessage = isProblematicMessage ?
        (i18n['processor.jwt.unknownError'] || 'Exception occurred') :
        exception.message;

    if (getIsLocalhost()) {
        const sampleResponse = {
            valid: true, subject: 'user123', issuer: 'https://sample-issuer.example.com',
            audience: 'sample-audience', expiration: new Date(Date.now() + 3600000).toISOString(),
            roles: ['admin', 'user'], scopes: ['read', 'write'],
            claims: {
                sub: 'user123', iss: 'https://sample-issuer.example.com',
                aud: 'sample-audience', exp: Math.floor(Date.now() / 1000) + 3600,
                iat: Math.floor(Date.now() / 1000), roles: ['admin', 'user'],
                scope: 'read write', name: 'John Doe', email: 'john.doe@example.com'
            }
        };
        displayValidTokenFunc(sampleResponse, true); // isSimulated is true
    } else {
        const verificationErrorText = i18n['processor.jwt.verificationError'] || 'Verification error';
        const errorHtml =
            '<div class="token-error">' +
            '<span class="fa fa-exclamation-triangle"></span> ' +
            verificationErrorText +
            ': ' +
            exceptionMessage +
            '</div>';
        $resultsContent.html(errorHtml);
    }
};


export const __setIsLocalhostForTesting = function (value) {
    isLocalhostOverride = (value === null) ? null : !!value;
};
