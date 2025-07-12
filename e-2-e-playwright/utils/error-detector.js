/**
 * @file Error Detector - Enhanced error detection and processing
 * Handles detection and processing of various JavaScript error types
 * @version 1.0.0
 */

import { BROWSER_ERROR_PATTERNS } from './constants.js';

/**
 * Check if a console message represents a critical error
 * @param {string} text - Console message text
 * @returns {boolean} True if critical error
 */
export function isCriticalError(text) {
  return BROWSER_ERROR_PATTERNS.some(pattern => text.includes(pattern));
}

/**
 * Check if a console message represents an enhanced error type
 * @param {string} text - Console message text
 * @returns {boolean} True if enhanced error
 */
export function isEnhancedError(text) {
  const enhancedErrorTypes = [
    'Uncaught', 'ReferenceError', 'TypeError', 'SyntaxError', 'Mismatched anonymous define'
  ];
  
  return enhancedErrorTypes.some(type => text.includes(type));
}

/**
 * Extract detailed error information from console message arguments
 * @param {Array} args - Console message arguments
 * @returns {Promise<Object>} Error details
 */
export async function extractErrorDetails(args) {
  let stackTrace = '';
  let errorDetails = '';
  
  if (!args || args.length === 0) {
    return { stackTrace, errorDetails };
  }

  for (const arg of args) {
    try {
      // Try to extract detailed error information
      const errorInfo = await arg.evaluate(extractErrorInfoInBrowser).catch(() => null);
      
      if (errorInfo) {
        errorDetails = `\nError Details: ${JSON.stringify(errorInfo, null, 2)}`;
        if (errorInfo.stack) {
          stackTrace = `\nStack trace: ${errorInfo.stack}`;
        }
        break;
      }
    } catch (e) {
      // Continue to next argument
    }
  }

  return { stackTrace, errorDetails };
}

/**
 * Function to run in browser context to extract error information
 * @param {any} obj - Object to analyze for error information
 * @returns {Object|null} Error information or null
 */
function extractErrorInfoInBrowser(obj) {
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stack: obj.stack,
      fileName: obj.fileName,
      lineNumber: obj.lineNumber,
      columnNumber: obj.columnNumber
    };
  }
  return null;
}

/**
 * Create enhanced error message with context
 * @param {string} originalText - Original error text
 * @param {Object} errorContext - Error context details
 * @returns {string} Enhanced error message
 */
export function createEnhancedErrorMessage(originalText, { stackTrace = '', errorDetails = '' } = {}) {
  return `Critical Error: ${originalText}${errorDetails}${stackTrace}`;
}