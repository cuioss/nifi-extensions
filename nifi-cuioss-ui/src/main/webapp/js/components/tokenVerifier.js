/**
 * Token Verification Interface UI component.
 */
define(['jquery', 'nf.Common'], function ($, nfCommon) {
    let isLocalhostOverride = null; // Allows tests to control localhost behavior

    // Helper function to determine if running in a localhost-like environment
    const getIsLocalhost = () => {
        if (isLocalhostOverride !== null) {
            return isLocalhostOverride;
        }
        // Default behavior: check window.location.href
        return window.location.href.indexOf('localhost') !== -1 || window.location.href.indexOf('127.0.0.1') !== -1;
    };

    return {
        /**
         * Initialize the custom UI.
         *
         * @param {object} element - The DOM element
         * @param {object} config - The component configuration
         * @param {string} type - The component type (not used)
         * @param {Function} callback - The callback function
         */
        init: function (element, config, type, callback) {
            // Get i18n resources from NiFi Common
            const i18n = nfCommon.getI18n() || {};

            console.log('[DEBUG_LOG] tokenVerifier.init called');

            // Create UI elements
            const container = $('<div class="token-verification-container"></div>');

            // Create token input area
            const inputSection = $('<div class="token-input-section"></div>');
            const inputLabel = $('<label for="token-input">' + (i18n['processor.jwt.tokenInput'] || 'Enter Token:') + '</label>');
            const tokenInput = $('<textarea id="token-input" class="token-input" rows="5" placeholder="' +
                             (i18n['processor.jwt.tokenInputPlaceholder'] || 'Paste token here...') + '"></textarea>');
            const verifyButton = $('<button type="button" class="verify-token-button">' +
                               (i18n['processor.jwt.verifyToken'] || 'Verify Token') + '</button>');

            inputSection.append(inputLabel).append(tokenInput).append(verifyButton);

            // Create results area
            const resultsSection = $('<div class="token-results-section"></div>');
            const resultsHeader = $('<h3>' + (i18n['processor.jwt.verificationResults'] || 'Verification Results') + '</h3>');
            const resultsContent = $('<div class="token-results-content"></div>');

            resultsSection.append(resultsHeader).append(resultsContent);

            // Add sections to container
            container.append(inputSection).append(resultsSection);

            // Add container to element
            $(element).append(container);

            // Handle verify button click
            verifyButton.on('click', function () {
                const token = tokenInput.val().trim();

                if (!token) {
                    resultsContent.html('<div class="token-error">' +
                                      (i18n['processor.jwt.noTokenProvided'] || 'No token provided') + '</div>');
                    return;
                }

                // Show loading state
                resultsContent.html('<div class="token-loading"><span class="fa fa-spinner fa-spin"></span> ' +
                                  (i18n['processor.jwt.verifying'] || 'Verifying token...') + '</div>');

                try {
                    // Make the AJAX request to verify the token
                    $.ajax({
                        type: 'POST',
                        url: '../nifi-api/processors/jwt/verify-token',
                        data: JSON.stringify({ token: token }),
                        contentType: 'application/json',
                        dataType: 'json',
                        timeout: 5000 // Add timeout to prevent long waits
                    }).done(function (response) {
                        if (response.valid) {
                            displayValidToken(response);
                        } else {
                            displayInvalidToken(response);
                        }
                    }).fail(function (xhr, status, error) {
                        console.error('[DEBUG_LOG] Token verification error:', status, error);

                        if (getIsLocalhost()) {
                            console.log('[DEBUG_LOG] Using simulated response for standalone testing');
                            const sampleResponse = {
                                valid: true, subject: 'user123', issuer: 'https://sample-issuer.example.com',
                                audience: 'sample-audience', expiration: new Date(Date.now() + 3600000).toISOString(),
                                roles: ['admin', 'user'], scopes: ['read', 'write'],
                                claims: { sub: 'user123', iss: 'https://sample-issuer.example.com', aud: 'sample-audience',
                                          exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000),
                                          roles: ['admin', 'user'], scope: 'read write', name: 'John Doe', email: 'john.doe@example.com' }
                            };
                            displayValidToken(sampleResponse, true);
                        } else {
                            resultsContent.html('<div class="token-error">' +
                                              '<span class="fa fa-exclamation-triangle"></span> ' +
                                              (i18n['processor.jwt.verificationError'] || 'Verification error') + ': ' +
                                              (xhr.responseText || error || i18n['processor.jwt.unknownError'] || 'Unknown error') +
                                              '</div>');
                        }
                    });
                } catch (e) {
                    console.error('[DEBUG_LOG] Exception in token verification:', e);
                    if (getIsLocalhost()) {
                        console.log('[DEBUG_LOG] Using simulated response for standalone testing (exception path)');
                        const sampleResponse = {
                            valid: true, subject: 'user123', issuer: 'https://sample-issuer.example.com',
                            audience: 'sample-audience', expiration: new Date(Date.now() + 3600000).toISOString(),
                            roles: ['admin', 'user'], scopes: ['read', 'write'],
                            claims: { sub: 'user123', iss: 'https://sample-issuer.example.com', aud: 'sample-audience',
                                      exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000),
                                      roles: ['admin', 'user'], scope: 'read write', name: 'John Doe', email: 'john.doe@example.com' }
                        };
                        displayValidToken(sampleResponse, true);
                    } else {
                        resultsContent.html('<div class="token-error">' +
                                          '<span class="fa fa-exclamation-triangle"></span> ' +
                                          (i18n['processor.jwt.verificationError'] || 'Verification error') + ': ' +
                                          (e.message || i18n['processor.jwt.unknownError'] || 'Exception occurred') +
                                          '</div>');
                    }
                }
            });

            // Function to display valid token details
            function displayValidToken(response, isSimulated) {
                let html = '<div class="token-valid">' +
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
                resultsContent.html(html);
            }

            // Function to display invalid token details
            function displayInvalidToken(response) {
                let invalidHtml = '<div class="token-invalid">' +
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
                resultsContent.html(invalidHtml);
            }

            resultsContent.html('<div class="token-instructions">' + (i18n['processor.jwt.initialInstructions'] || 'Enter a JWT token above and click "Verify Token" to validate it.') + '</div>');

            if (typeof callback === 'function') {
                callback({
                    validate: function () { return true; }
                });
            }
        },
        __setIsLocalhostForTesting: function (value) {
            isLocalhostOverride = (value === null) ? null : !!value;
        }
    };
});
