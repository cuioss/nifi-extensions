/**
 * Tests for bundle.js
 */

// Import required dependencies
const $ = require('jquery');

// Mock the dependencies that bundle.js requires
jest.mock('nf.Common', () => ({
    registerCustomUiTab: jest.fn(),
    registerCustomUiComponent: jest.fn(),
    getI18n: jest.fn().mockReturnValue({})
}), { virtual: true });

// Get the mocked nfCommon
const nfCommon = require('nf.Common');
jest.mock('js/main', () => ({
    init: jest.fn()
}), { virtual: true });

// Mock console
console.log = jest.fn();
console.error = jest.fn();

// Mock window
global.window = {
    jwtComponentsRegistered: false
};

// Import the bundle module using babel-plugin-transform-amd-to-commonjs
const bundleModule = require('../../main/webapp/js/bundle');

describe('bundle.js', () => {
    beforeEach(() => {
    // Reset mocks
        jest.clearAllMocks();

        // Reset window.jwtComponentsRegistered
        window.jwtComponentsRegistered = false;
    });

    it('should initialize the main module when init is called', () => {
    // Call the init method
        bundleModule.init();

        // Verify that main.init was called
        const mainModule = require('js/main');
        expect(mainModule.init).toHaveBeenCalled();

        // Verify that console.log was called with the expected messages
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Bundle init method called');
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Initializing main module from bundle');
    });

    it('should not initialize main module if components are already registered', () => {
    // Set the flag to indicate components are already registered
        window.jwtComponentsRegistered = true;

        // Call the init method
        bundleModule.init();

        // Verify that main.init was not called
        const mainModule = require('js/main');
        expect(mainModule.init).not.toHaveBeenCalled();

        // Verify that console.log was called with the expected messages
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Bundle init method called');
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Components already registered, skipping initialization from bundle');
    });

    it('should handle case where main module is not available', () => {
    // Mock main module to be undefined
        jest.resetModules();
        jest.mock('js/main', () => undefined, { virtual: true });

        // Re-import the bundle module
        const bundleModuleReimported = require('../../main/webapp/js/bundle');

        // Call the init method
        bundleModuleReimported.init();

        // Verify that console.error was called with the expected message
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Bundle init method called');
        expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] Main module not available or missing init function');
    });
});
