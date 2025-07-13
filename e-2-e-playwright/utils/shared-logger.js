/**
 * @file Shared Logger - Centralized logging functionality
 * Provides consistent logging across all test utilities
 * @version 1.0.0
 */

import { addLogEntry } from './log-collector.js';

/**
 * Log level definitions with emoji indicators
 */
const LOG_LEVELS = {
    info: '🔵 INFO:',
    success: '✅ SUCCESS:',
    warn: '🟠 WARNING:',
    error: '🔴 ERROR:',
};

/**
 * Create a logger function with optional prefix
 * @param {string} [prefix=''] - Optional prefix for all log messages
 * @returns {Function} Logger function
 */
export function createLogger(prefix = '') {
    const finalPrefix = prefix ? `[${prefix}] ` : '';
    
    return (level, message, testName = null) => {
        const logPrefix = LOG_LEVELS[level] || LOG_LEVELS.info;
        const fullMessage = `${logPrefix} ${finalPrefix}${message}`;
        
        // Log to console
        console.log(fullMessage);
        
        // Add to log collector if available
        try {
            addLogEntry(level, `${finalPrefix}${message}`, testName);
        } catch (error) {
            // Silently fail if log collector is not available
        }
    };
}

/**
 * Default logger instance
 */
export const logMessage = createLogger();

/**
 * Specialized loggers for different modules
 */
export const authLogger = createLogger('AUTH');
export const processorLogger = createLogger('PROCESSOR');
export const navigationLogger = createLogger('NAVIGATION');
export const testHelperLogger = createLogger('TEST-HELPER');

/**
 * Log an error with additional context
 * @param {string} message - Error message
 * @param {Error} error - Error object
 * @param {string} [testName] - Test name
 */
export function logError(message, error, testName = null) {
    const errorMessage = `${message}: ${error.message}`;
    logMessage('error', errorMessage, testName);
    
    // Log stack trace if available
    if (error.stack) {
        logMessage('error', `Stack trace: ${error.stack}`, testName);
    }
}

/**
 * Log with timing information
 * @param {string} operation - Operation name
 * @param {Function} fn - Function to execute and time
 * @param {string} [testName] - Test name
 * @returns {Promise<any>} Result of the function
 */
export async function logTimed(operation, fn, testName = null) {
    const startTime = Date.now();
    logMessage('info', `Starting ${operation}...`, testName);
    
    try {
        const result = await fn();
        const duration = Date.now() - startTime;
        logMessage('success', `${operation} completed in ${duration}ms`, testName);
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logError(`${operation} failed after ${duration}ms`, error, testName);
        throw error;
    }
}