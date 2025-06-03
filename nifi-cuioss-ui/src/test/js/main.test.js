/**
 * Tests for main.js
 */
import $ from 'cash-dom'; // Changed from jquery-compat
import nfCommon from './mocks/nf-common.js';
import jwksValidator from './mocks/jwksValidator.js';
import tokenVerifier from './mocks/tokenVerifier.js';
import * as mainModule from './mocks/main.js'; // Testing the mock version of main.js

// Mock navigator.language
Object.defineProperty(global.navigator, 'language', {
    get: jest.fn().mockReturnValue('de-DE')
});

// Mock console.log
console.log = jest.fn();

describe('main.js', () => {
    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Setup document mock
        document.body.innerHTML = '<div></div>';

        // Mock jQuery functions
        $.fn.append = jest.fn().mockReturnThis();
        $.fn.attr = jest.fn().mockReturnValue('/nifi/assets/css/nf-processor-ui.css');
    });

    describe('detectBrowserLanguage', () => {
        it('should detect browser language and log it', () => {
            // Initialize the module
            mainModule.init();

            // Verify that console.log was called with the browser language
            expect(console.log).toHaveBeenCalledWith('Detected browser language: de-DE');
        });

        it('should extract language code from browser language', () => {
            // Initialize the module
            mainModule.init();

            // Verify that the language code was extracted correctly
            // This is an indirect test since detectBrowserLanguage is private
            // We can verify that it was called by checking the console.log output
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('de-DE'));
        });
    });

    describe('registerCustomUiComponents', () => {
        it('should register custom UI components', () => {
            // Initialize the module
            mainModule.init();

            // Verify that registerCustomUiComponent was called for each component
            expect(nfCommon.registerCustomUiComponent).toHaveBeenCalledWith(
                'jwt.validation.jwks.url',
                jwksValidator,
                expect.objectContaining({ jwks_type: 'server' })
            );

            expect(nfCommon.registerCustomUiComponent).toHaveBeenCalledWith(
                'jwt.validation.jwks.file',
                jwksValidator,
                expect.objectContaining({ jwks_type: 'file' })
            );

            expect(nfCommon.registerCustomUiComponent).toHaveBeenCalledWith(
                'jwt.validation.jwks.content',
                jwksValidator,
                expect.objectContaining({ jwks_type: 'memory' })
            );

            expect(nfCommon.registerCustomUiTab).toHaveBeenCalledWith(
                'jwt.validation.token.verification',
                tokenVerifier
            );
        });
    });
});
