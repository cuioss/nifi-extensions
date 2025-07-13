/**
 * @file Simplified Logging Fixture
 * Minimal logging implementation using Playwright's built-in features
 * @version 2.0.0
 */

import { test as base } from '@playwright/test';

// Critical error patterns (minimal set)
const CRITICAL_ERROR_PATTERNS = [
  'Uncaught Error',
  'TypeError',
  'ReferenceError',
  'SyntaxError',
  'Network Error',
  'Failed to load resource',
  'jQuery is not defined'
];

/**
 * Enhanced test fixture with minimal console logging
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const logs = [];
    const criticalErrors = [];
    
    // Capture console messages
    page.on('console', msg => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      };
      
      logs.push(logEntry);
      
      // Check for critical errors
      if (msg.type() === 'error' || isCriticalError(msg.text())) {
        criticalErrors.push(logEntry);
      }
    });
    
    // Capture page errors
    page.on('pageerror', error => {
      const errorEntry = {
        type: 'pageerror',
        text: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
      
      logs.push(errorEntry);
      criticalErrors.push(errorEntry);
    });
    
    // Capture network failures
    page.on('requestfailed', request => {
      const failureEntry = {
        type: 'requestfailed',
        text: `Network Request Failed: ${request.method()} ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
      
      logs.push(failureEntry);
    });
    
    await use(page);
    
    // Attach logs to test results only if there are logs
    if (logs.length > 0) {
      await testInfo.attach('console-logs', {
        body: JSON.stringify(logs, null, 2),
        contentType: 'application/json'
      });
    }
    
    // Attach critical errors separately if any
    if (criticalErrors.length > 0) {
      await testInfo.attach('critical-errors', {
        body: JSON.stringify(criticalErrors, null, 2),
        contentType: 'application/json'
      });
      
      // Log critical errors to console for immediate visibility
      console.log(`🚨 CRITICAL ERRORS DETECTED IN TEST: ${testInfo.title}`);
      criticalErrors.forEach(error => {
        console.log(`🚨 CRITICAL ERROR: ${error.text}`);
      });
    }
  }
});

/**
 * Check if a message contains critical error patterns
 * @param {string} text - Message text to check
 * @returns {boolean} True if critical error detected
 */
function isCriticalError(text) {
  return CRITICAL_ERROR_PATTERNS.some(pattern => 
    text.toLowerCase().includes(pattern.toLowerCase())
  );
}

// Export expect for convenience
export { expect } from '@playwright/test';