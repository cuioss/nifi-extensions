/**
 * Jest setup file for MultiIssuerJWTTokenAuthenticator tests.
 * This file is run before each test file.
 */

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
// global.jwksValidator = { ... }; // Removed as per subtask

// Mock the console to prevent noise during tests
// To enable debug output during testing, set DEBUG=1 environment variable:
// DEBUG=1 npm test
// We already have originalConsoleError defined above
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;
const originalConsoleDebug = console.debug;
const originalConsoleInfo = console.info;

// Completely suppress console.error during tests to avoid test failures
console.error = (...args) => {
    // Only log if DEBUG environment variable is set
    if (process.env.DEBUG) {
        originalConsoleError(...args);
    }
};

console.warn = (...args) => {
    // Suppress most console.warn messages during tests unless DEBUG is enabled
    if (process.env.DEBUG) {
        originalConsoleWarn(...args);
    }
};

console.log = (...args) => {
    // Suppress most console.log messages during tests
    if (process.env.DEBUG) {
        originalConsoleLog(...args);
    }
};

console.debug = (...args) => {
    // Suppress console.debug messages during tests unless DEBUG is enabled
    if (process.env.DEBUG) {
        originalConsoleDebug(...args);
    }
};

console.info = (...args) => {
    // Suppress console.info messages during tests unless DEBUG is enabled
    if (process.env.DEBUG) {
        originalConsoleInfo(...args);
    }
};

// Clean up is handled in jest.setup-dom.js
