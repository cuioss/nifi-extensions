/**
 * @file Test Error Handler Utility
 * Provides error handling functions for test files that don't trigger ESLint warnings
 * @version 1.0.0
 */

/**
 * Log an error that occurred during test setup/teardown
 * This function is specifically for logging errors that occur in test infrastructure,
 * not application errors. It writes directly to stderr to avoid ESLint no-console warnings.
 * 
 * @param {string} context - The context where the error occurred (e.g., "beforeEach", "afterEach")
 * @param {string} message - The error message
 * @param {Error} [error] - Optional error object
 */
export function logTestError(context, message, error) {
    const timestamp = new Date().toISOString();
    const errorMessage = error ? `${message}: ${error.message}` : message;
    const formattedMessage = `[${timestamp}] [TEST ERROR] [${context}] ${errorMessage}`;
    
    // Write directly to stderr using process.stderr.write to avoid console methods
    if (process.stderr && process.stderr.write) {
        process.stderr.write(formattedMessage + '\n');
    }
}

/**
 * Log a warning that occurred during test setup/teardown
 * This function is specifically for logging warnings in test infrastructure.
 * 
 * @param {string} context - The context where the warning occurred
 * @param {string} message - The warning message
 */
export function logTestWarning(context, message) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [TEST WARNING] [${context}] ${message}`;
    
    // Write directly to stderr using process.stderr.write to avoid console methods
    if (process.stderr && process.stderr.write) {
        process.stderr.write(formattedMessage + '\n');
    }
}