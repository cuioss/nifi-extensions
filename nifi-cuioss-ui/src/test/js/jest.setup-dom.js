// Import jest-dom extensions for DOM element assertions
import '@testing-library/jest-dom';

// Store original console functions
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

// Clean up after all tests
afterAll(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
});
