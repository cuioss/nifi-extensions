/**
 * Tests for nf-jwt-validator.js
 */

// Define jQuery mock structure first
const mockReady = jest.fn(callback => callback()); // This will be $(document).ready()
const mockJqueryInstance = {
    ready: mockReady
    // Add other jQuery instance methods if needed by the SUT here
};

// This is the mock for the jQuery module itself (e.g., the function you get from `import $ from 'jquery'`)
const mockJqueryStatic = jest.fn(selector => {
    // This function is what gets called when you do $()
    // It should return an object that has methods like .ready()
    return mockJqueryInstance;
});

// Mock the 'jquery' module. All 'import $' will get 'mockJqueryStatic'.
jest.mock('jquery', () => mockJqueryStatic);

// Set up global jQuery and $ to use our static mock.
// This is for any code that might still rely on global jQuery.
global.jQuery = global.$ = mockJqueryStatic;

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
    init: jest.fn()
};
jest.mock('js/main', () => mockMainDefault, { virtual: true });


describe('nf-jwt-validator.js', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Reset our specific jQuery related mocks
        mockReady.mockClear().mockImplementation(callback => callback());
        mockJqueryStatic.mockClear().mockImplementation(selector => mockJqueryInstance); // Ensure it returns the instance

        // Reset window state
        global.window = { jwtComponentsRegistered: false }; // Default state
    });

    describe('Default behavior (components not registered, main module valid)', () => {
        beforeEach(() => {
            jest.doMock('js/main', () => mockMainDefault, { virtual: true });
            jest.resetModules();
            require('../../main/webapp/js/nf-jwt-validator.js');
        });

        it('should initialize main module', () => {
            expect(mockJqueryStatic).toHaveBeenCalledWith(document); // Check that $(document) was called
            expect(mockReady).toHaveBeenCalledTimes(1); // Check that .ready() was called on the instance
            expect(mockMainDefault.init).toHaveBeenCalledTimes(1);
            expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Document ready');
            expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module imported');
            expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Initializing main module');
            expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete');
            expect(console.error).not.toHaveBeenCalled();
        });
    });

    describe('When components are already registered', () => {
        const mockMainWhenRegistered = { init: jest.fn() };
        beforeEach(() => {
            global.window.jwtComponentsRegistered = true;
            jest.resetModules();
            jest.doMock('js/main', () => mockMainWhenRegistered, { virtual: true });
            require('../../main/webapp/js/nf-jwt-validator.js');
        });

        it('should not initialize main module', () => {
            expect(mockJqueryStatic).toHaveBeenCalledWith(document);
            expect(mockReady).toHaveBeenCalledTimes(1);
            expect(mockMainWhenRegistered.init).not.toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Document ready');
            expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module imported');
            expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Components already registered, skipping initialization');
            expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete');
            expect(console.error).not.toHaveBeenCalled();
        });
    });

    describe('When main module is problematic', () => {
        it('should handle case where main module is not available (main is null)', () => {
            global.window.jwtComponentsRegistered = false;
            jest.resetModules();
            jest.doMock('js/main', () => null, { virtual: true });
            require('../../main/webapp/js/nf-jwt-validator.js');

            expect(mockJqueryStatic).toHaveBeenCalledWith(document);
            expect(mockReady).toHaveBeenCalledTimes(1);
            expect(mockMainDefault.init).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module not available or missing init function');
            expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Document ready');
            expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module imported');
            expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete');
        });

        it('should handle case where main module is available but init is not a function', () => {
            global.window.jwtComponentsRegistered = false;
            jest.resetModules();
            jest.doMock('js/main', () => ({}), { virtual: true });
            require('../../main/webapp/js/nf-jwt-validator.js');

            expect(mockJqueryStatic).toHaveBeenCalledWith(document);
            expect(mockReady).toHaveBeenCalledTimes(1);
            expect(mockMainDefault.init).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module not available or missing init function');
            expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Document ready');
            expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Main module imported');
            expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete');
        });
    });
});
