/**
 * Token Verification Interface UI component.
 */
define(['jquery', 'nf.Common'], function ($, nfCommon) {
    return {
        /**
         * Initialize the custom UI.
         */
        init: function (element, callback) {
            // Get i18n resources from NiFi Common
            const i18n = nfCommon.getI18n();

            // Create UI elements
            const container = $('<div class="token-verification-container"></div>');

            // Create token input area
            const inputSection = $('<div class="token-input-section"></div>');
            const inputLabel = $('<label for="token-input">' + i18n['processor.jwt.tokenInput'] + '</label>');
            const tokenInput = $('<textarea id="token-input" class="token-input" rows="5" placeholder="' +
                             i18n['processor.jwt.tokenInputPlaceholder'] + '"></textarea>');
            const verifyButton = $('<button type="button" class="verify-token-button">' +
                               i18n['processor.jwt.verifyToken'] + '</button>');

            inputSection.append(inputLabel).append(tokenInput).append(verifyButton);

            // Create results area
            const resultsSection = $('<div class="token-results-section"></div>');
            const resultsHeader = $('<h3>' + i18n['processor.jwt.verificationResults'] + '</h3>');
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
                                      i18n['processor.jwt.noTokenProvided'] + '</div>');
                    return;
                }

                // Show loading state
                resultsContent.html('<div class="token-loading"><span class="fa fa-spinner fa-spin"></span> ' +
                                  i18n['processor.jwt.verifying'] + '</div>');

                // Make the AJAX request to verify the token
                $.ajax({
                    type: 'POST',
                    url: '../nifi-api/processors/jwt/verify-token',
                    data: JSON.stringify({ token: token }),
                    contentType: 'application/json',
                    dataType: 'json'
                }).done(function (response) {
                    if (response.valid) {
                        // Token is valid, display token information
                        let html = '<div class="token-valid">' +
                                   '<span class="fa fa-check-circle"></span> ' +
                                   i18n['processor.jwt.tokenValid'] +
                                   '</div>';

                        // Add token details
                        html += '<div class="token-details">';
                        html += '<h4>' + i18n['processor.jwt.tokenDetails'] + '</h4>';
                        html += '<table class="token-claims-table">';

                        // Add standard claims
                        html += '<tr><th>' + i18n['processor.jwt.subject'] + '</th><td>' +
                               (response.subject || '') + '</td></tr>';
                        html += '<tr><th>' + i18n['processor.jwt.issuer'] + '</th><td>' +
                               (response.issuer || '') + '</td></tr>';
                        html += '<tr><th>' + i18n['processor.jwt.audience'] + '</th><td>' +
                               (response.audience || '') + '</td></tr>';
                        html += '<tr><th>' + i18n['processor.jwt.expiration'] + '</th><td>' +
                               (response.expiration || '') + '</td></tr>';

                        // Add roles if available
                        if (response.roles && response.roles.length > 0) {
                            html += '<tr><th>' + i18n['processor.jwt.roles'] + '</th><td>' +
                                   response.roles.join(', ') + '</td></tr>';
                        }

                        // Add scopes if available
                        if (response.scopes && response.scopes.length > 0) {
                            html += '<tr><th>' + i18n['processor.jwt.scopes'] + '</th><td>' +
                                   response.scopes.join(' ') + '</td></tr>';
                        }

                        // Add all claims section
                        html += '</table>';

                        // Add raw claims
                        html += '<h4>' + i18n['processor.jwt.allClaims'] + '</h4>';
                        html += '<pre class="token-raw-claims">' +
                               JSON.stringify(response.claims, null, 2) + '</pre>';

                        html += '</div>';

                        resultsContent.html(html);
                    } else {
                        // Token is invalid, display error
                        let invalidHtml = '<div class="token-invalid">' +
                                   '<span class="fa fa-times-circle"></span> ' +
                                   i18n['processor.jwt.tokenInvalid'] +
                                   '</div>';

                        // Add error details
                        invalidHtml += '<div class="token-error-details">';
                        invalidHtml += '<h4>' + i18n['processor.jwt.errorDetails'] + '</h4>';
                        invalidHtml += '<p class="token-error-message">' + response.message + '</p>';

                        if (response.category) {
                            invalidHtml += '<p class="token-error-category"><strong>' +
                                   i18n['processor.jwt.errorCategory'] + ':</strong> ' +
                                   response.category + '</p>';
                        }

                        invalidHtml += '</div>';

                        resultsContent.html(invalidHtml);
                    }
                }).fail(function (xhr) {
                    // Handle AJAX failure
                    resultsContent.html('<div class="token-error">' +
                                      '<span class="fa fa-exclamation-triangle"></span> ' +
                                      i18n['processor.jwt.verificationError'] + ': ' +
                                      xhr.responseText +
                                      '</div>');
                });
            });

            // Initialize callback
            callback({
                validate: function () { return true; }
            });
        }
    };
});
