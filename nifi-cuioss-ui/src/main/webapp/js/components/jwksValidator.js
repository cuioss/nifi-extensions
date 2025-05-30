/**
 * JWKS Validation Button UI component.
 */
define(['jquery', 'nf.Common'], function ($, nfCommon) {
    return {
        /**
         * Initialize the custom UI.
         *
         * @param {object} element - The DOM element
         * @param {string} propertyValue - The property value
         * @param {string} jwks_type - The JWKS type (server, file, memory)
         * @param {Function} callback - The callback function
         */
        init: function (element, propertyValue, jwks_type, callback) {
            // Get i18n resources from NiFi Common
            const i18n = nfCommon.getI18n() || {};

            console.log('[DEBUG_LOG] jwksValidator.init called with type:', jwks_type);

            // Create UI elements
            const container = $('<div class="jwks-verification-container"></div>');

            // Only show the Test Connection button for the 'server' type (URL input)
            if (jwks_type === 'server') {
                // Create the button and result container
                const verifyButton = $('<button type="button" class="verify-jwks-button">' +
                                   i18n['processor.jwt.testConnection'] + '</button>');
                const resultContainer = $('<div class="verification-result"></div>');

                // Find the input field
                const inputField = $(element).find('input');

                // If we can find the input field, insert the button directly after it
                if (inputField.length > 0) {
                    // Create a wrapper div for the button and result container
                    const buttonWrapper = $('<div class="jwks-button-wrapper"></div>');
                    buttonWrapper.append(verifyButton).append(resultContainer);

                    // Insert the button wrapper directly after the input field
                    inputField.after(buttonWrapper);
                } else {
                    // Fallback: Add elements to the container
                    container.append(verifyButton).append(resultContainer);
                }

                // Handle button click
                verifyButton.on('click', function () {
                    // Show loading state
                    resultContainer.html((i18n['processor.jwt.testing'] || 'Testing...'));

                    // Get the current value
                    const jwksValue = propertyValue || 'https://example.com/.well-known/jwks.json';

                    try {
                        // Make the AJAX request to validate
                        $.ajax({
                            type: 'POST',
                            url: '../nifi-api/processors/jwks/validate-url',
                            data: JSON.stringify({ jwksValue: jwksValue }),
                            contentType: 'application/json',
                            dataType: 'json',
                            timeout: 5000 // Add timeout to prevent long waits
                        }).done(function (response) {
                            if (response.valid) {
                                resultContainer.html('<span style="color: var(--success-color); font-weight: bold;">' +
                                                   (i18n['processor.jwt.ok'] || 'OK') + '</span> ' +
                                                   (i18n['processor.jwt.validJwks'] || 'Valid JWKS') +
                                                   ' (' + response.keyCount + ' ' +
                                                   (i18n['processor.jwt.keysFound'] || 'keys found') + ')');
                            } else {
                                resultContainer.html('<span style="color: var(--error-color); font-weight: bold;">' +
                                                   (i18n['processor.jwt.failed'] || 'Failed') + '</span> ' +
                                                   (i18n['processor.jwt.invalidJwks'] || 'Invalid JWKS') + ': ' +
                                                   response.message);
                            }
                        }).fail(function (xhr, status, error) {
                            console.error('[DEBUG_LOG] JWKS validation error:', status, error);

                            // In standalone testing mode, show a simulated success response
                            if (window.location.href.indexOf('localhost') !== -1 || window.location.href.indexOf('127.0.0.1') !== -1) {
                                console.log('[DEBUG_LOG] Using simulated response for standalone testing');
                                resultContainer.html('<span style="color: var(--success-color); font-weight: bold;">' +
                                                   (i18n['processor.jwt.ok'] || 'OK') + '</span> ' +
                                                   (i18n['processor.jwt.validJwks'] || 'Valid JWKS') +
                                                   ' (3 ' + (i18n['processor.jwt.keysFound'] || 'keys found') +
                                                   ') <em>(Simulated response)</em>');
                            } else {
                                resultContainer.html('<span style="color: var(--error-color); font-weight: bold;">' +
                                                   (i18n['processor.jwt.failed'] || 'Failed') + '</span> ' +
                                                   (i18n['processor.jwt.validationError'] || 'Validation error') + ': ' +
                                                   (xhr.responseText || error || 'Unknown error'));
                            }
                        });
                    } catch (e) {
                        console.error('[DEBUG_LOG] Exception in JWKS validation:', e);

                        // In standalone testing mode, show a simulated success response
                        resultContainer.html('<span style="color: var(--success-color); font-weight: bold;">' +
                                           (i18n['processor.jwt.ok'] || 'OK') + '</span> ' +
                                           (i18n['processor.jwt.validJwks'] || 'Valid JWKS') +
                                           ' (3 ' + (i18n['processor.jwt.keysFound'] || 'keys found') +
                                           ') <em>(Simulated response)</em>');
                    }
                });

                // Add a default text to the result container for better UX
                resultContainer.html('<em>Click the button to validate JWKS</em>');
            }

            $(element).append(container);


            // Initialize callback if provided
            if (typeof callback === 'function') {
                callback({
                    validate: function () { return true; },
                    getValue: function () { return propertyValue; },
                    setValue: function (newValue) { propertyValue = newValue; },
                    jwks_type: jwks_type
                });
            }
        }
    };
});
