/**
 * Console Error Configuration
 * 
 * This file allows you to configure the fail-on-console-error behavior
 * and manage error whitelist patterns across all tests.
 */

/**
 * Global configuration for console error handling
 */
export const CONSOLE_ERROR_CONFIG = {
  // Set to true to enable fail-on-console-error behavior globally
  FAIL_ON_CONSOLE_ERRORS: false,
  
  // Set to true to enable fail-on-console-error only for specific tests
  FAIL_ON_CONSOLE_ERRORS_SELECTIVE: true,
  
  // Console logging configuration
  CONSOLE_LOGGING: {
    // Set to false to exclude debug logs from console output
    INCLUDE_DEBUG_LOGS: true,
    
    // Set to false to exclude info logs from console output
    INCLUDE_INFO_LOGS: true,
    
    // Set to false to exclude log/verbose logs from console output
    INCLUDE_VERBOSE_LOGS: true,
    
    // Always include warnings and errors (cannot be disabled)
    INCLUDE_WARNINGS: true,
    INCLUDE_ERRORS: true,
  },
  
  // Additional error patterns to whitelist (beyond the defaults)
  // These errors will NOT cause test failure even when fail-on-error is enabled
  CUSTOM_ERROR_WHITELIST: [
    // Example: Whitelist specific errors you know are not critical
    // /Some specific error pattern/i,
    // /Another error that should be ignored/i,
    
    // WebGL context errors (common in headless browser environments)
    /WEBGL_.*_ERROR/i,
    /WebGL.*context lost/i,
    
    // Resource loading timeouts (common in test environments)
    /timeout.*resource/i,
    /ERR_NETWORK_CHANGED/i,
    
    // Third-party library warnings that are not critical
    /deprecated.*API/i,
  ],
  
  // Error patterns that should ALWAYS cause test failure (override whitelist)
  CRITICAL_ERROR_PATTERNS: [
    // JavaScript runtime errors that indicate serious problems
    /Uncaught TypeError.*Cannot read propert/i,
    /ReferenceError.*is not defined/i,
    /SyntaxError.*Unexpected token/i,
    
    // Application-specific critical errors
    /CRITICAL.*ERROR/i,
    /FATAL.*ERROR/i,
    /Security.*violation/i,
  ],
  
  // Test name patterns that should use strict error detection
  // If FAIL_ON_CONSOLE_ERRORS_SELECTIVE is true, only these tests will fail on console errors
  STRICT_ERROR_DETECTION_TESTS: [
    /.*jwt.*ui.*test/i,                          // JWT UI related tests
    /^.*console error test.*$/i,                 // Tests specifically named "console error test"
    /^.*strict.*$/i,                             // Tests with "strict" in the name
    /.*should fail when console error occurs/i,  // Demo tests that should fail
    // Add patterns for test names that should use strict error detection
  ],
};

/**
 * Utility function to check if a test should use strict error detection
 * @param {string} testTitle - The test title
 * @param {string} testFile - The test file name
 * @returns {boolean} - True if test should use strict error detection
 */
export function shouldUseStrictErrorDetection(testTitle, testFile) {
  // If global fail-on-error is enabled, all tests use strict detection
  if (CONSOLE_ERROR_CONFIG.FAIL_ON_CONSOLE_ERRORS) {
    return true;
  }
  
  // If selective mode is disabled, no tests use strict detection
  if (!CONSOLE_ERROR_CONFIG.FAIL_ON_CONSOLE_ERRORS_SELECTIVE) {
    return false;
  }
  
  // Check if test matches any strict detection pattern
  const fullTestName = `${testFile} ${testTitle}`.toLowerCase();
  return CONSOLE_ERROR_CONFIG.STRICT_ERROR_DETECTION_TESTS.some(pattern => 
    pattern.test(fullTestName)
  );
}

/**
 * Apply the configuration to the console logger
 * Call this in test setup to apply the configuration
 */
export function applyConsoleErrorConfig(consoleLogger) {
  // Add custom whitelist patterns
  CONSOLE_ERROR_CONFIG.CUSTOM_ERROR_WHITELIST.forEach(pattern => {
    consoleLogger.addErrorWhitelist(pattern);
  });
  
  // Enable global fail-on-error if configured
  if (CONSOLE_ERROR_CONFIG.FAIL_ON_CONSOLE_ERRORS) {
    consoleLogger.setFailOnConsoleErrors(true);
  }
}

/**
 * Example usage in test files:
 * 
 * import { applyConsoleErrorConfig, shouldUseStrictErrorDetection } from '../config/console-error-config.js';
 * import { setupAuthAwareErrorDetection, setupStrictErrorDetection } from '../utils/console-logger.js';
 * 
 * test.beforeEach(async ({ page }, testInfo) => {
 *   if (shouldUseStrictErrorDetection(testInfo.title, testInfo.titlePath?.[0] || '')) {
 *     await setupStrictErrorDetection(page, testInfo, true);
 *   } else {
 *     await setupAuthAwareErrorDetection(page, testInfo);
 *   }
 * });
 * 
 * // Console logging configuration examples:
 * 
 * // To exclude debug logs from console output:
 * // CONSOLE_LOGGING: { INCLUDE_DEBUG_LOGS: false }
 * 
 * // To include only errors and warnings:
 * // CONSOLE_LOGGING: { 
 * //   INCLUDE_DEBUG_LOGS: false,
 * //   INCLUDE_INFO_LOGS: false,
 * //   INCLUDE_VERBOSE_LOGS: false,
 * //   INCLUDE_WARNINGS: true,
 * //   INCLUDE_ERRORS: true
 * // }
 */