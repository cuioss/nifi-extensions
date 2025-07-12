/**
 * Tests for nf-jwt-validator.js
 */

// Store original addEventListener
const originalAddEventListener = document.addEventListener;
const originalRemoveEventListener = document.removeEventListener;

// Mock for DOMContentLoaded event callback execution
const mockDOMContentLoadedCallbackExecutor = jest.fn(callback => callback());

// Mock console (remains the same)
global.console = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
};

// Default mock for 'js/main'. (remains the same)
const mockMainDefault = {
    init: jest.fn().mockResolvedValue(true) // Return a resolved Promise
};
jest.mock('js/main', () => mockMainDefault, { virtual: true });


describe('nf-jwt-validator.js', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Reset our specific DOMContentLoaded related mock
        mockDOMContentLoadedCallbackExecutor.mockClear().mockImplementation(callback => callback());

        // Reset window state
        global.window = { jwtComponentsRegistered: false }; // Default state

        // Spy on document.addEventListener
        document.addEventListener = jest.fn((event, handler) => {
            if (event === 'DOMContentLoaded') {
                // Simulate the DOMContentLoaded event by calling our executor
                mockDOMContentLoadedCallbackExecutor(handler);
            }
        });
    });

    afterAll(() => {
        // Restore original event listener
        document.addEventListener = originalAddEventListener;
        document.removeEventListener = originalRemoveEventListener;
    });

    describe('Default behavior (components not registered, main module valid)', () => {
        beforeEach(() => {
            jest.doMock('js/main', () => mockMainDefault, { virtual: true });
            jest.resetModules();
            // At this point, nf-jwt-validator.js will be re-evaluated.
            // Its top-level code (including addEventListener) will run.
            require('../../main/webapp/js/nf-jwt-validator.js');
        });

        it('should initialize main module', () => {
            expect(document.addEventListener).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
            expect(mockDOMContentLoadedCallbackExecutor).toHaveBeenCalledTimes(1);
            expect(mockMainDefault.init).toHaveBeenCalledTimes(1);
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Document ready'); // Logs removed from source
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module imported');
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Initializing main module');
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete');
            expect(console.error).not.toHaveBeenCalled();
        });
    });

    describe('When components are already registered', () => {
        const mockMainWhenRegistered = { init: jest.fn().mockResolvedValue(true) }; // Return a resolved Promise
        beforeEach(() => {
            global.window.jwtComponentsRegistered = true;
            jest.resetModules();
            jest.doMock('js/main', () => mockMainWhenRegistered, { virtual: true });
            require('../../main/webapp/js/nf-jwt-validator.js');
        });

        it('should not initialize main module', () => {
            expect(document.addEventListener).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
            expect(mockDOMContentLoadedCallbackExecutor).toHaveBeenCalledTimes(1);
            expect(mockMainWhenRegistered.init).not.toHaveBeenCalled();
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Document ready'); // Logs removed from source
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module imported');
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Components already registered, skipping initialization');
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete');
            expect(console.error).not.toHaveBeenCalled();
        });
    });

    describe('When main module is problematic', () => {
        it('should handle case where main module is not available (main is null)', () => {
            global.window.jwtComponentsRegistered = false;
            jest.resetModules();
            jest.doMock('js/main', () => null, { virtual: true });
            require('../../main/webapp/js/nf-jwt-validator.js');

            // expect(mockJqueryStatic).toHaveBeenCalledWith(document);
            // expect(mockReady).toHaveBeenCalledTimes(1);
            expect(document.addEventListener).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
            expect(mockDOMContentLoadedCallbackExecutor).toHaveBeenCalledTimes(1);
            expect(mockMainDefault.init).not.toHaveBeenCalled();
            // expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module not available or missing init function'); // Logs removed from source
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Document ready');
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module imported');
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete');
        });

        it('should handle case where main module is available but init is not a function', () => {
            global.window.jwtComponentsRegistered = false;
            jest.resetModules();
            jest.doMock('js/main', () => ({}), { virtual: true });
            require('../../main/webapp/js/nf-jwt-validator.js');

            expect(document.addEventListener).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
            expect(mockDOMContentLoadedCallbackExecutor).toHaveBeenCalledTimes(1);
            expect(mockMainDefault.init).not.toHaveBeenCalled();
            // expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module not available or missing init function'); // Logs removed from source
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Document ready');
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module imported');
            // expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete');
        });
    });

    describe('Branch coverage tests', () => {
        beforeEach(() => {
            jest.resetModules();
            // Clear global state
            delete window.jwtComponentsRegistered;
            delete window.jwtInitializationInProgress;
            delete window.jwtLoadingIndicatorHidden;
        });

        it('should handle main.init returning non-Promise gracefully', () => {
            const mockMainNonPromise = {
                init: jest.fn().mockReturnValue('not a promise')
            };

            jest.doMock('js/main', () => mockMainNonPromise, { virtual: true });

            // Should not throw an error
            expect(() => {
                require('../../main/webapp/js/nf-jwt-validator.js');
            }).not.toThrow();

            expect(mockMainNonPromise.init).toHaveBeenCalled();
        });

        it('should skip initialization when jwtComponentsRegistered is true', () => {
            window.jwtComponentsRegistered = true;

            const freshMockMain = { init: jest.fn().mockResolvedValue(true) };
            jest.doMock('js/main', () => freshMockMain, { virtual: true });

            require('../../main/webapp/js/nf-jwt-validator.js');

            expect(freshMockMain.init).not.toHaveBeenCalled();
        });

        it('should skip initialization when jwtInitializationInProgress is true', () => {
            window.jwtInitializationInProgress = true;

            const freshMockMain = { init: jest.fn().mockResolvedValue(true) };
            jest.doMock('js/main', () => freshMockMain, { virtual: true });

            require('../../main/webapp/js/nf-jwt-validator.js');

            expect(freshMockMain.init).not.toHaveBeenCalled();
        });

        it('should handle strategy execution with no elements to hide', () => {
            // Set up DOM with no loading indicators
            document.body.innerHTML = '<div>Normal content</div>';

            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            require('../../main/webapp/js/nf-jwt-validator.js');

            expect(consoleWarnSpy).toHaveBeenCalledWith('No loading indicators found to hide');

            consoleWarnSpy.mockRestore();
        });
    });
});
