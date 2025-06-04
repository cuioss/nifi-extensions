/**
 * Mock implementation of tokenVerifier for testing.
 */

module.exports = {
    init: jest.fn().mockImplementation((element, callback) => {
    // Create UI elements
        const $ = global.$; // Use global cash-dom instance
        const nfCommon = global.nfCommon; // Use global nfCommon mock
        const i18n = nfCommon.getI18n();

        // Create container
        const container = $('<div class="token-verification-container"></div>');

        // Create input section
        const inputSection = $('<div class="token-input-section"></div>');
        const inputLabel = $('<label for="token-input">' + i18n['processor.jwt.tokenInput'] + '</label>');
        const tokenInput = $('<textarea id="token-input" class="token-input" rows="5" placeholder="' +
                       i18n['processor.jwt.tokenInputPlaceholder'] + '"></textarea>');
        const verifyButton = $('<button type="button" class="verify-token-button">' +
                         i18n['processor.jwt.verifyToken'] + '</button>');

        inputSection.append(inputLabel).append(tokenInput).append(verifyButton);

        // Create results section
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

            // Make AJAX request
            $.ajax({
                type: 'POST',
                url: '../nifi-api/processors/jwt/verify-token',
                data: JSON.stringify({ token: token }),
                contentType: 'application/json',
                dataType: 'json'
            });
        });

        // Return object with methods
        callback({
            validate: jest.fn().mockReturnValue(true)
        });
    })
};
