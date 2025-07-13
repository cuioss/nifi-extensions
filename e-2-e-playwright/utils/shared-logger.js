/**
 * @file Simplified Shared Logger
 * Minimal logging utility for test-specific logging only
 * Browser console logs are now handled by Playwright's built-in trace viewer
 * @version 2.0.0
 */

/**
 * Simple logger for test output
 * @param {string} level - Log level (info, success, warn, error)
 * @param {string} message - Message to log
 */
export function logMessage(level, message) {
  const timestamp = new Date().toISOString();
  const prefix = getLogPrefix(level);
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

/**
 * Create a logger with a specific prefix
 * @param {string} prefix - Prefix for log messages
 * @returns {Function} Logger function
 */
export function createLogger(prefix = '') {
  return (level, message) => {
    const fullMessage = prefix ? `[${prefix}] ${message}` : message;
    logMessage(level, fullMessage);
  };
}

/**
 * Get log prefix based on level
 * @param {string} level - Log level
 * @returns {string} Prefix string
 */
function getLogPrefix(level) {
  const prefixes = {
    info: '🔵 INFO:',
    success: '✅ SUCCESS:',
    warn: '⚠️ WARN:',
    error: '🔴 ERROR:',
    debug: '🔍 DEBUG:'
  };
  return prefixes[level] || prefixes.info;
}

/**
 * Specialized loggers for different modules
 */
export const authLogger = createLogger('AUTH');
export const processorLogger = createLogger('PROCESSOR');
export const navigationLogger = createLogger('NAVIGATION');
export const testHelperLogger = createLogger('TEST-HELPER');

/**
 * Timed operation logger
 * @param {string} operation - Operation description
 * @param {Function} fn - Function to execute
 * @returns {Promise<any>} Result of the function
 */
export async function logTimed(operation, fn) {
  const start = Date.now();
  logMessage('info', `Starting ${operation}...`);
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    logMessage('success', `${operation} completed in ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logMessage('error', `${operation} failed after ${duration}ms: ${error.message}`);
    throw error;
  }
}

/**
 * Log an error with stack trace
 * @param {string} message - Error message
 * @param {Error} error - Error object
 */
export function logError(message, error) {
  logMessage('error', message);
  if (error?.stack) {
    logMessage('error', `Stack trace: ${error.stack}`);
  }
}