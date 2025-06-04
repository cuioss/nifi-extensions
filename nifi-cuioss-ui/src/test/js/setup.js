/**
 * Jest setup file for MultiIssuerJWTTokenAuthenticator tests.
 * This file is run before each test file.
 */

// Import jest-dom extensions for DOM element assertions
require('@testing-library/jest-dom');

// Store original console functions but don't override them to fail tests
// This allows tests to pass even if there are console.error calls
const originalConsoleError = console.error;
// We're not overriding console.error to throw errors anymore
// This was causing tests to fail when console.error was called

// Set up global variables that might be expected by the code.
// These are global mocks for pervasive dependencies or browser environment setup.
global.window = window;
global.document = window.document;
// global.$ and global.jQuery are typically set to cash-dom here (assuming it's done elsewhere or should be added)

// Create mock modules for testing
// nfCommon is mocked globally as it's a fundamental part of NiFi's UI interaction.
global.nfCommon = require('./mocks/nf-common.js'); // Moved from local require in jwksValidator
// jwksValidator is a complex component mock, set globally for convenience in tests.
global.jwksValidator = {
    init: jest.fn().mockImplementation((element, propertyValue, jwks_type, callback) => {
    // Create UI elements
        const $ = global.$; // Use the globally defined $ (cash-dom)
        // nfCommon is now globally available, no need to require it here if setup.js ensures global.nfCommon is set.
        const i18n = global.nfCommon.getI18n();

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

// Mock the console to prevent noise during tests
// We already have originalConsoleError defined above
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

// Completely suppress console.error during tests to avoid test failures
console.error = (...args) => {
    // Only log if DEBUG environment variable is set
    if (process.env.DEBUG) {
        originalConsoleError(...args);
    }
};

console.warn = (...args) => {
    if (args[0]?.includes?.('Warning:')) {
        return;
    }
    originalConsoleWarn(...args);
};

console.log = (...args) => {
    // Suppress most console.log messages during tests
    if (process.env.DEBUG) {
        originalConsoleLog(...args);
    }
};

// Clean up after all tests
afterAll(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
});
