/**
 * Tests for the actual main.js implementation.
 * This file tests the real implementation, not a mock.
 */

// Import required dependencies
const $ = require('jquery');

// Mock the dependencies that main.js requires
jest.mock('nf.Common', () => ({
    registerCustomUiTab: jest.fn(),
    registerCustomUiComponent: jest.fn(),
    getI18n: jest.fn().mockReturnValue({})
}), { virtual: true });

// Get the mocked nfCommon
const nfCommon = require('nf.Common');
jest.mock('components/tokenVerifier', () => ({
    init: jest.fn()
}), { virtual: true });
jest.mock('components/issuerConfigEditor', () => ({
    init: jest.fn()
}), { virtual: true });
jest.mock('services/apiClient', () => ({
    init: jest.fn()
}), { virtual: true });
jest.mock('js/utils/formatters', () => ({
    formatDate: jest.fn(),
    formatDuration: jest.fn(),
    formatJwtToken: jest.fn(),
    formatNumber: jest.fn(),
    sanitizeHtml: jest.fn()
}), { virtual: true });
jest.mock('js/utils/i18n', () => ({
    getLanguage: jest.fn().mockReturnValue('en'),
    translate: jest.fn().mockImplementation(key => key)
}), { virtual: true });

// Set up document body
document.body.innerHTML = `
  <div id="loading-indicator">Loading...</div>
  <div id="jwt-validator-tabs" style="display: none;"></div>
  <div class="jwt-validator-title">JWT Validator</div>
  <div class="property-label">Token Location</div>
  <div class="property-label">Token Header</div>
`;

// Mock jQuery functions
$.fn.hide = jest.fn().mockReturnThis();
$.fn.show = jest.fn().mockReturnThis();
$.fn.each = jest.fn().mockImplementation(function (callback) {
    Array.from(this).forEach(callback);
    return this;
});
$.fn.append = jest.fn().mockReturnThis();
$.fn.text = jest.fn().mockReturnValue('Token Location');
$.fn.tooltip = jest.fn().mockReturnThis();
$.fn.ready = jest.fn().mockImplementation(function (callback) {
    callback();
    return this;
});

// Mock window and nf objects
global.window = {
    jwtComponentsRegistered: false
};

global.nf = {
    Canvas: {
        initialized: true
    }
};

// Import the main module using babel-plugin-transform-amd-to-commonjs
const mainModule = require('../../main/webapp/js/main');

describe('main.js (real implementation)', () => {
    beforeEach(() => {
    // Reset mocks
        jest.clearAllMocks();

        // Reset window.jwtComponentsRegistered
        window.jwtComponentsRegistered = false;

        // Reset document body
        document.body.innerHTML = `
      <div id="loading-indicator">Loading...</div>
      <div id="jwt-validator-tabs" style="display: none;"></div>
      <div class="jwt-validator-title">JWT Validator</div>
      <div class="property-label">Token Location</div>
      <div class="property-label">Token Header</div>
    `;
    });

    describe('init', () => {
        it('should initialize the UI components', () => {
            // Call the init method
            mainModule.init();

            // Verify that registerCustomUiTab was called
            expect(nfCommon.registerCustomUiTab).toHaveBeenCalledWith(
                'jwt.validation.issuer.configuration',
                expect.anything()
            );

            expect(nfCommon.registerCustomUiTab).toHaveBeenCalledWith(
                'jwt.validation.token.verification',
                expect.anything()
            );

            // Verify that the loading indicator is hidden
            expect($.fn.hide).toHaveBeenCalled();

            // Verify that the JWT validator tabs are shown
            expect($.fn.show).toHaveBeenCalled();

            // Verify that the window.jwtComponentsRegistered flag is set
            expect(window.jwtComponentsRegistered).toBe(true);
        });

        it('should register help tooltips', () => {
            // Call the init method
            mainModule.init();

            // Verify that each property label was processed
            expect($.fn.each).toHaveBeenCalled();

            // Verify that tooltips were initialized
            expect($.fn.tooltip).toHaveBeenCalled();
        });

        it('should update UI translations', () => {
            // Call the init method
            mainModule.init();

            // Verify that text was updated
            expect($.fn.text).toHaveBeenCalled();
        });
    });
});
