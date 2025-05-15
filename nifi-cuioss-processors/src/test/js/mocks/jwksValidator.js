/**
 * Mock implementation of jwksValidator for testing.
 */

module.exports = {
    init: jest.fn().mockImplementation((element, propertyValue, jwks_type, callback) => {
    // Create UI elements
        const $ = require('./jquery.js');
        const nfCommon = require('./nf-common.js');
        const i18n = nfCommon.getI18n();

        // Create container
        const container = $('<div class="jwks-verification-container"></div>');

        // Create button
        const verifyButton = $('<button type="button" class="verify-jwks-button">' +
                         i18n['processor.jwt.testConnection'] + '</button>');

        // Create result container
        const resultContainer = $('<div class="verification-result"></div>');

        // Add elements to DOM
        container.append(verifyButton).append(resultContainer);
        $(element).append(container);

        // Store property value for later use
        let currentValue = propertyValue;

        // Handle button click
        verifyButton.on('click', function () {
            // Show loading state
            resultContainer.html('<span class="fa fa-spinner fa-spin"></span> ' +
                          i18n['processor.jwt.testing']);

            // Determine endpoint based on jwks_type
            let validationEndpoint;

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

            // Make AJAX request
            $.ajax({
                type: 'POST',
                url: validationEndpoint,
                data: JSON.stringify({ jwksValue: currentValue }),
                contentType: 'application/json',
                dataType: 'json'
            });
        });

        // Return object with methods
        callback({
            validate: jest.fn().mockReturnValue(true),
            getValue: jest.fn().mockReturnValue(currentValue),
            setValue: jest.fn().mockImplementation(newValue => {
                currentValue = newValue;
                return currentValue;
            }),
            jwks_type: jwks_type
        });
    })
};
