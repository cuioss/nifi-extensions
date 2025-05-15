/**
 * JWKS Validation Button UI component.
 */
define(['jquery', 'nf.Common'], function ($, nfCommon) {
    return {
        /**
         * Initialize the custom UI.
         */
        init: function (element, propertyValue, jwks_type, callback) {
            // Get i18n resources from NiFi Common
            const i18n = nfCommon.getI18n();

            // Create UI elements
            const container = $('<div class="jwks-verification-container"></div>');
            const verifyButton = $('<button type="button" class="verify-jwks-button">' +
                               i18n['processor.jwt.testConnection'] + '</button>');
            const resultContainer = $('<div class="verification-result"></div>');

            // Add elements to the DOM
            container.append(verifyButton).append(resultContainer);
            $(element).append(container);

            // Handle button click
            verifyButton.on('click', function () {
                // Show loading state
                resultContainer.html('<span class="fa fa-spinner fa-spin"></span> ' +
                                    i18n['processor.jwt.testing']);

                // Get the current value
                const jwksValue = propertyValue;

                // Determine the validation approach based on jwks_type
                let validationEndpoint;
                const requestData = {
                    jwksValue: jwksValue
                };

                switch (jwks_type) {
                    case 'server':
                        validationEndpoint = '../nifi-api/processors/jwks/validate-url';
                        break;
                    case 'file':
                        validationEndpoint = '../nifi-api/processors/jwks/validate-file';
                        break;
                    case 'memory':
                        validationEndpoint = '../nifi-api/processors/jwks/validate-content';
                        break;
                    default:
                        resultContainer.html('<span class="fa fa-times"></span> ' +
                                           i18n['processor.jwt.invalidType']);
                        return;
                }

                // Make the AJAX request to validate
                $.ajax({
                    type: 'POST',
                    url: validationEndpoint,
                    data: JSON.stringify(requestData),
                    contentType: 'application/json',
                    dataType: 'json'
                }).done(function (response) {
                    if (response.valid) {
                        resultContainer.html('<span class="fa fa-check"></span> ' +
                                           i18n['processor.jwt.validJwks'] +
                                           ' (' + response.keyCount + ' ' +
                                           i18n['processor.jwt.keysFound'] + ')');
                    } else {
                        resultContainer.html('<span class="fa fa-times"></span> ' +
                                           i18n['processor.jwt.invalidJwks'] + ': ' +
                                           response.message);
                    }
                }).fail(function (xhr) {
                    resultContainer.html('<span class="fa fa-times"></span> ' +
                                       i18n['processor.jwt.validationError'] + ': ' +
                                       xhr.responseText);
                });
            });

            // Initialize callback
            callback({
                validate: function () { return true; },
                getValue: function () { return propertyValue; },
                setValue: function (newValue) { propertyValue = newValue; },
                jwks_type: jwks_type
            });
        }
    };
});
