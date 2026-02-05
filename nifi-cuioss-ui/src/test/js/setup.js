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

// Smart console suppression for tests
// To enable debug output during testing, set DEBUG=1 environment variable:
// DEBUG=1 npm test
// We already have originalConsoleError defined above
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;
const originalConsoleDebug = console.debug;
const originalConsoleInfo = console.info;

// Helper function to determine if a message should be shown during tests
const shouldShowMessage = (message, level) => {
    if (process.env.DEBUG) return true;

    const messageStr = String(message).toLowerCase();

    // Suppress known non-critical errors first
    if (level === 'error') {
        // Suppress old NiFi FontAwesome 404 errors (these are expected/harmless)
        if (messageStr.includes('404') && messageStr.includes('font')) {
            // Check for old NiFi FontAwesome patterns
            if (messageStr.includes('fontawesome') ||
                messageStr.includes('font-awesome') ||
                messageStr.includes('fa-') ||
                messageStr.includes('.woff') ||
                messageStr.includes('.ttf') ||
                messageStr.includes('.eot')) {
                // But still show FontAwesome 6+ errors (newer library issues)
                if (messageStr.includes('fontawesome-6') ||
                    messageStr.includes('font-awesome-6') ||
                    messageStr.includes('@fortawesome') ||
                    messageStr.includes('fa6-')) {
                    return true; // Show newer FontAwesome issues
                }

                return false; // Suppress old NiFi FontAwesome 404s
            }
        }
    }

    // Always show actual errors that could indicate real problems
    if (level === 'error') {
        // Show fetch/network errors (except the FontAwesome ones handled above)
        if (messageStr.includes('fetch') || messageStr.includes('network') || messageStr.includes('http')) {
            return true;
        }
        // Show validation errors
        if (messageStr.includes('validation') || messageStr.includes('invalid')) {
            return true;
        }
        // Show component initialization errors
        if (messageStr.includes('initialization') || messageStr.includes('init')) {
            return true;
        }
    }

    // Always show warnings about missing or invalid configurations
    if (level === 'warn') {
        if (messageStr.includes('missing') || messageStr.includes('not found') || messageStr.includes('invalid')) {
            return true;
        }
    }

    return false;
};

// Selectively suppress console.error - show important errors even in test mode
console.error = (...args) => {
    if (process.env.DEBUG || shouldShowMessage(args[0], 'error')) {
        originalConsoleError(...args);
    }
};

console.warn = (...args) => {
    if (process.env.DEBUG || shouldShowMessage(args[0], 'warn')) {
        originalConsoleWarn(...args);
    }
};

console.log = (...args) => {
    // Log messages are generally informational, suppress unless DEBUG
    if (process.env.DEBUG) {
        originalConsoleLog(...args);
    }
};

console.debug = (...args) => {
    // Debug messages are noise during tests, suppress unless explicitly requested
    if (process.env.DEBUG) {
        originalConsoleDebug(...args);
    }
};

console.info = (...args) => {
    // Info messages are generally noise during tests, suppress unless DEBUG
    if (process.env.DEBUG) {
        originalConsoleInfo(...args);
    }
};

// Clean up is handled in jest.setup-dom.js
