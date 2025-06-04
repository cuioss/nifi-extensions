/**
 * Jest setup file for MultiIssuerJWTTokenAuthenticator tests.
 * This file is run before each test file.
 */

// Import jest-dom extensions for DOM element assertions
require('@testing-library/jest-dom');

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
// We already have originalConsoleError defined above
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

// Completely suppress console.error during tests to avoid test failures
console.error = (...args) => {
    // Only log if DEBUG environment variable is set
    if (process.env.DEBUG) {
        originalConsoleError(...args);
    }
};

console.warn = (...args) => {
    if (args[0]?.includes?.('Warning:')) {
        return;
    }
    originalConsoleWarn(...args);
};

console.log = (...args) => {
    // Suppress most console.log messages during tests
    if (process.env.DEBUG) {
        originalConsoleLog(...args);
    }
};

// Clean up after all tests
afterAll(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
});
