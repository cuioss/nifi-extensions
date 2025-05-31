/**
 * Tests for bundle.js
 */

// Import required dependencies
import $ from 'jquery';

// Mock the dependencies that bundle.js requires
// First jest.mock for nf.Common (this one will be kept)
jest.mock('nf.Common', () => ({
    registerCustomUiTab: jest.fn(),
    registerCustomUiComponent: jest.fn(),
    getI18n: jest.fn().mockReturnValue({})
}), { virtual: true });

// First jest.mock for js/main (this one will be kept)
jest.mock('js/main', () => ({
    init: jest.fn()
}), { virtual: true });

// bundleModule will be dynamically imported where needed to handle jest.resetModules correctly

// Mock console
console.log = jest.fn();
console.error = jest.fn();

// Mock window
global.window = {
    jwtComponentsRegistered: false
};

// Import the bundle module
import * as bundleModule from '../../main/webapp/js/bundle';

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
        const mainModule = require('js/main'); // Reverted to require as import causes issues with Jest mocks
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
        const mainModule = require('js/main'); // Reverted to require
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
        // Reset modules to ensure re-import works as expected for this test case
        jest.resetModules();
        // Re-mock dependencies that might have been reset
        jest.mock('nf.Common', () => ({
            registerCustomUiTab: jest.fn(),
            registerCustomUiComponent: jest.fn(),
            getI18n: jest.fn().mockReturnValue({})
        }), { virtual: true });
        jest.mock('js/main', () => undefined, { virtual: true }); // Mock main as undefined for this specific test

        const bundleModuleReimported = require('../../main/webapp/js/bundle'); // require for re-evaluation

        // Call the init method
        bundleModuleReimported.init();

        // It's good practice to restore mocks if they are specific to a test,
        // though in this case, the top-level mock for 'js/main' will apply to subsequent tests.
        // For clarity, explicitly re-mock 'js/main' to its default mock state if needed by other tests,
        // or ensure the top-level mock is sufficient.
        // The jest.mock at the top of the file will re-apply for other tests.

        // Verify that console.error was called with the expected message
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Bundle init method called');
        expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] Main module not available or missing init function');
    });
});
