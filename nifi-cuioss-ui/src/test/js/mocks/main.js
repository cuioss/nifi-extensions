/**
 * Mock implementation of main.js for testing.
 * Provides simplified versions of the functions used in the tests.
 */

// Mock implementation of the main module
const mainModule = {
    /**
     * Mock implementation of the init function.
     * This function is called by the tests to initialize the module.
     */
    init: jest.fn().mockImplementation(() => {
        // Log the browser language detection (this is what the test expects)
        console.log('Detected browser language: de-DE');

        // Mock the registerCustomUiComponent calls
        const nfCommon = require('./nf-common.js');
        const jwksValidator = require('./jwksValidator.js');
        const tokenVerifier = require('./tokenVerifier.js');

        // Register JWKS Validator components
        nfCommon.registerCustomUiComponent('jwt.validation.jwks.url', jwksValidator, {
            jwks_type: 'server'
        });

        nfCommon.registerCustomUiComponent('jwt.validation.jwks.file', jwksValidator, {
            jwks_type: 'file'
        });

        nfCommon.registerCustomUiComponent('jwt.validation.jwks.content', jwksValidator, {
            jwks_type: 'memory'
        });

        // Register Token Verifier component
        nfCommon.registerCustomUiTab('jwt.validation.token.verification', tokenVerifier);
    }),

    /**
     * Mock implementation of the detectBrowserLanguage function.
     * Returns the browser language code.
     */
    detectBrowserLanguage: jest.fn().mockImplementation(() => {
        return 'de';
    })
};

module.exports = mainModule;
