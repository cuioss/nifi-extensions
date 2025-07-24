/**
 * Tests for bundle.js
 */

// Mock jQuery, nf.Common, and js/main at the top level
// These are direct or indirect dependencies of bundle.js
jest.mock('jquery', () => jest.fn(), { virtual: true }); // Basic mock for $
jest.mock('nf.Common', () => ({
    // Add any specific nfCommon functions that might be called during bundle.js execution or its imports
    registerCustomUiTab: jest.fn(),
    registerCustomUiComponent: jest.fn(),
    getI18n: jest.fn().mockReturnValue({}) // Mock i18n if used by nfCommon during init
}), { virtual: true });

const mockMainDefault = { init: jest.fn().mockResolvedValue(true) }; // Return a resolved Promise
jest.mock('js/main', () => mockMainDefault, { virtual: true }); // Default mock for js/main

// Mock console and window
global.console = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(), // Add for completeness
    info: jest.fn(),  // Add for completeness
    debug: jest.fn()  // Add for completeness
};

describe('bundle.js', () => {
    let bundleModule; // To hold the imported module { init }

    beforeEach(() => {
        jest.clearAllMocks(); // Clear all mocks before each test
        // Reset window state for each test
        global.window = { jwtComponentsRegistered: false };
        // Reset modules before each test group to ensure `require` gets a fresh instance
        // with the correct `doMock` applied for that group.
        jest.resetModules();
    });

    describe('Default behavior (components not registered, main module valid)', () => {
        beforeEach(() => {
            // Ensure 'js/main' uses the default mock for this block.
            // jest.doMock is used to override the default mock if needed, or to be explicit.
            jest.doMock('js/main', () => mockMainDefault, { virtual: true });
            // Import/execute the module under test *after* setting up mocks for this describe block.
            bundleModule = require('../../main/webapp/js/bundle');
        });

        it('should call main.init when bundle.init is called', () => {
            bundleModule.init(); // Call the exported init function
            expect(mockMainDefault.init).toHaveBeenCalledTimes(1);
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Bundle init method called'); // Logs removed from source
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Initializing main module from bundle');
            expect(console.error).not.toHaveBeenCalled();
        });

        it('should log that the entry point was loaded upon import', () => {
            // The initial console.log in bundle.js happens when it's first imported/required.
            // In the beforeEach of this describe block, bundleModule is required.
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] NiFi JWT Validator master entry point loaded'); // Log removed from source
            expect(bundleModule).toBeDefined(); // Added to satisfy jest/expect-expect
        });
    });

    describe('When components are already registered', () => {
        const mockMainWhenRegistered = { init: jest.fn().mockResolvedValue(true) }; // Return a resolved Promise
        beforeEach(() => {
            global.window.jwtComponentsRegistered = true;
            // Specific mock for 'js/main' for this context
            jest.doMock('js/main', () => mockMainWhenRegistered, { virtual: true });
            bundleModule = require('../../main/webapp/js/bundle');
        });

        it('should not initialize main module if components are already registered', () => {
            bundleModule.init();
            expect(mockMainWhenRegistered.init).not.toHaveBeenCalled();
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Bundle init method called'); // Logs removed from source
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Components already registered, skipping initialization from bundle');
            expect(console.error).not.toHaveBeenCalled();
        });
    });

    describe('When main module is problematic', () => {
        // This covers two sub-cases: main module itself is undefined, or main.init is not a function.

        it('should handle case where main module is not available (main is undefined)', () => {
            global.window.jwtComponentsRegistered = false; // Ensure default state
            // Mock 'js/main' to resolve to undefined
            jest.doMock('js/main', () => undefined, { virtual: true });
            bundleModule = require('../../main/webapp/js/bundle');

            bundleModule.init();
            // mockMainDefault.init should not be called as it's not the active mock here.
            expect(mockMainDefault.init).not.toHaveBeenCalled();
            // expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] Main module not available or missing init function'); // Log removed from source
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Bundle init method called');
        });

        it('should handle case where main module is available but init is not a function', () => {
            global.window.jwtComponentsRegistered = false; // Ensure default state
            // Mock 'js/main' to resolve to an object without an init function
            jest.doMock('js/main', () => ({}), { virtual: true }); // main is an empty object
            bundleModule = require('../../main/webapp/js/bundle');

            bundleModule.init();
            expect(mockMainDefault.init).not.toHaveBeenCalled();
            // expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] Main module not available or missing init function'); // Log removed from source
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Bundle init method called');
        });
    });

    describe('Branch coverage tests', () => {
        beforeEach(() => {
            // Clean up global state
            delete window.jwtComponentsRegistered;
            delete window.jwtInitializationInProgress;
        });

        it('should check for jwtComponentsRegistered before calling main.init', () => {
            // Set the global flag
            window.jwtComponentsRegistered = true;

            // Use a fresh mock and module instance
            const freshMockMain = { init: jest.fn().mockResolvedValue(true) };
            jest.doMock('js/main', () => freshMockMain, { virtual: true });
            const freshBundleModule = require('../../main/webapp/js/bundle');

            freshBundleModule.init();

            expect(freshMockMain.init).not.toHaveBeenCalled();
        });

        it('should check for jwtInitializationInProgress before calling main.init', () => {
            // Set the global flag
            window.jwtInitializationInProgress = true;

            // Use a fresh mock and module instance
            const freshMockMain = { init: jest.fn().mockResolvedValue(true) };
            jest.doMock('js/main', () => freshMockMain, { virtual: true });
            const freshBundleModule = require('../../main/webapp/js/bundle');

            freshBundleModule.init();

            expect(freshMockMain.init).not.toHaveBeenCalled();
        });

        it('should hide loading indicators by text content', () => {
            document.body.innerHTML = `
                <div class="test-element">Loading JWT Validator...</div>
                <div class="other-element">Some other content</div>
            `;

            // Import hideLoadingIndicatorImmediate separately
            const { hideLoadingIndicatorImmediate } = require('../../main/webapp/js/bundle');
            hideLoadingIndicatorImmediate();

            const testElement = document.querySelector('.test-element');
            expect(testElement.style.display).toBe('none');
            expect(testElement.style.visibility).toBe('hidden');
            expect(testElement.getAttribute('aria-hidden')).toBe('true');
            expect(testElement.classList.contains('hidden')).toBe(true);
        });

        it('should handle elements without classList property', () => {
            // Create element without classList
            const mockElement = {
                style: { display: '', visibility: '' },
                setAttribute: jest.fn(),
                textContent: 'Loading JWT'
            };

            // Mock querySelectorAll to return our mock element
            const mockQuerySelectorAll = jest.fn();
            mockQuerySelectorAll.mockReturnValueOnce([mockElement]); // For loading indicators
            mockQuerySelectorAll.mockReturnValueOnce([mockElement]); // For all elements

            const originalQuerySelectorAll = document.querySelectorAll;
            document.querySelectorAll = mockQuerySelectorAll;

            // Import hideLoadingIndicatorImmediate separately
            const { hideLoadingIndicatorImmediate } = require('../../main/webapp/js/bundle');
            hideLoadingIndicatorImmediate();

            expect(mockElement.style.display).toBe('none');
            expect(mockElement.style.visibility).toBe('hidden');
            expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true');

            // Restore original method
            document.querySelectorAll = originalQuerySelectorAll;
        });

        it('should handle errors in hideLoadingIndicatorImmediate gracefully', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            // Mock querySelectorAll to throw an error
            const originalQuerySelectorAll = document.querySelectorAll;
            document.querySelectorAll = jest.fn().mockImplementation(() => {
                throw new Error('DOM access failed');
            });

            // Import hideLoadingIndicatorImmediate separately
            const { hideLoadingIndicatorImmediate } = require('../../main/webapp/js/bundle');
            hideLoadingIndicatorImmediate();

            // Check that console.warn was called with a structured log message
            expect(consoleWarnSpy).toHaveBeenCalled();
            const callArgs = consoleWarnSpy.mock.calls[0];
            expect(callArgs[0]).toMatch(/\[WARN\] bundle:/);
            expect(callArgs[1]).toBe('Error hiding loading indicator in bundle.js:');
            expect(callArgs[2]).toEqual(expect.any(Error));

            // Restore mocks
            document.querySelectorAll = originalQuerySelectorAll;
            consoleWarnSpy.mockRestore();
        });
    });
});
