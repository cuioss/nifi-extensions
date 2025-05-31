/**
 * Tests for nf-jwt-validator.js
 */

// Import required dependencies
const $ = require('jquery');

// Mock jQuery's ready function
// $.fn.ready = jest.fn().mockImplementation(callback => { // This is the original mock
//     callback();
//     return $;
// });
// Let's make it more robust by ensuring it's globally available if nf-jwt-validator.js needs it.
global.jQuery = global.$ = $;
global.jQuery.fn.ready = jest.fn(callback => {
    callback();
    return global.jQuery;
});


// Mock console
global.console = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(), // Add warn just in case
    info: jest.fn(), // Add info just in case
    debug: jest.fn() // Add debug just in case
};

// Mock the main module that nf-jwt-validator.js will require
const mockMain = {
    init: jest.fn()
};
jest.mock('js/main', () => mockMain, { virtual: true }); // virtual: true might not be needed if moduleDirectories works

// Mock window
global.window = {
    jwtComponentsRegistered: false
};


describe('nf-jwt-validator.js', () => {
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Reset window.jwtComponentsRegistered
        window.jwtComponentsRegistered = false;

        // Reset $.fn.ready mock calls for each test if nf-jwt-validator is re-evaluated
        // However, nf-jwt-validator.js is an IIFE, it only runs once when imported.
        // To re-run it, we would need to use jest.resetModules() and re-require.
    });

    function loadValidator() {
        // Reset modules to ensure the IIFE in nf-jwt-validator.js runs for the test
        jest.resetModules();
        // Make jQuery globally available before loading the validator
        global.jQuery = global.$ = $;
        global.jQuery.fn.ready = jest.fn(callback => {
            callback();
            return global.jQuery;
        });
        // Mock window for each load, as it might be modified
        global.window = { jwtComponentsRegistered: false };

        // Mock main module again due to jest.resetModules()
        jest.mock('js/main', () => mockMain, { virtual: true });

        require('../../main/webapp/js/nf-jwt-validator.js');
    }

    it('should initialize main module when document is ready and components are not registered', () => {
        loadValidator();

        expect(global.jQuery.fn.ready).toHaveBeenCalled();
        expect(mockMain.init).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Document ready');
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module loaded');
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Initializing main module');
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete');
        expect(console.error).not.toHaveBeenCalled();
    });

    it('should not initialize main module if components are already registered', () => {
        // Set the flag to indicate components are already registered *before* loading the script
        global.window.jwtComponentsRegistered = true;
        // mockMain.init needs to be defined for the check `typeof main.init === 'function'`
        mockMain.init = jest.fn();

        loadValidator();
        // Need to set it again here because loadValidator resets global.window
        global.window.jwtComponentsRegistered = true;
        // Re-trigger ready (simulating a scenario where ready might be called again or state checked after initial load)
        // This part is tricky with an IIFE. The IIFE runs once.
        // The test logic should reflect the state *at the time the IIFE runs*.
        // So, we set jwtComponentsRegistered = true *before* loadValidator for this test.

        // To test this specific branch, global.window.jwtComponentsRegistered must be true
        // *before* nf-jwt-validator.js is loaded and its $(document).ready callback executes.
        jest.resetModules();
        global.jQuery = global.$ = $;
        global.jQuery.fn.ready = jest.fn(callback => callback());
        global.window = { jwtComponentsRegistered: true }; // Set before require
        jest.mock('js/main', () => mockMain, { virtual: true });
        require('../../main/webapp/js/nf-jwt-validator.js');


        expect(global.jQuery.fn.ready).toHaveBeenCalled();
        expect(mockMain.init).not.toHaveBeenCalled(); // This is the key assertion for this case
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Document ready');
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module loaded');
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Components already registered, skipping initialization');
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete');
        expect(console.error).not.toHaveBeenCalled();
    });

    it('should handle case where main module is not available (main is null)', () => {
        jest.resetModules();
        global.jQuery = global.$ = $;
        global.jQuery.fn.ready = jest.fn(callback => callback());
        global.window = { jwtComponentsRegistered: false };
        // Simulate main module not being available (resolves to null or undefined)
        jest.mock('js/main', () => null, { virtual: true });
        require('../../main/webapp/js/nf-jwt-validator.js');

        expect(global.jQuery.fn.ready).toHaveBeenCalled();
        expect(mockMain.init).not.toHaveBeenCalled(); // main.init shouldn't be called
        expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module not available or missing init function');
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Document ready');
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module loaded');
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete');
    });

    it('should handle case where main module is available but init is not a function', () => {
        jest.resetModules();
        global.jQuery = global.$ = $;
        global.jQuery.fn.ready = jest.fn(callback => callback());
        global.window = { jwtComponentsRegistered: false };
        // Simulate main module is an object but doesn't have init function
        jest.mock('js/main', () => ({}), { virtual: true });
        require('../../main/webapp/js/nf-jwt-validator.js');

        expect(global.jQuery.fn.ready).toHaveBeenCalled();
        expect(mockMain.init).not.toHaveBeenCalled(); // main.init shouldn't be called
        expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module not available or missing init function');
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Document ready');
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module loaded');
        expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete');
    });
});
