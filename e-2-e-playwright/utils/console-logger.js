/**
 * @file Enhanced Console Logger with Critical Error Detection
 * Captures ALL browser console logs across all tests and saves to accessible file
 * Now includes real-time critical error detection and automatic test failure
 * @version 2.0.0
 */

import fs from 'fs';
import path from 'path';
import { globalCriticalErrorDetector } from './critical-error-detector.js';
import { CONSOLE_ERROR_CONFIG } from '../config/console-error-config.js';

class IndividualTestLogger {
  constructor() {
    this.testLogs = new Map(); // Map of testId -> logs array
    this.errorWhitelist = new Set(); // Set of whitelisted error patterns
    this.failOnConsoleErrors = false; // Flag to enable/disable fail-on-error behavior
    this.testErrors = new Map(); // Map of testId -> error objects that caused failure

    // Default whitelist of known non-critical errors
    this.initializeDefaultWhitelist();
  }

  /**
   * Initialize default whitelist of errors that should not cause test failure
   */
  initializeDefaultWhitelist() {
    const defaultWhitelistPatterns = [
      // Authentication-related errors during setup (expected during login flow)
      /Failed to load resource: the server responded with a status of 401/i,
      /HTTP 401.*nifi-api\/flow\/current-user/i,
      /401.*authentication/i,
      /login.*failed/i,
      /unauthorized/i,

      // Development-only verbose logs
      /\[DOM\] Input elements should have autocomplete attributes/i,
      /More info: https:\/\/goo\.gl\/9p2vKq/i,

      // Network timeouts that are expected in test environment
      /net::ERR_ABORTED/i,
      /net::ERR_NETWORK_CHANGED/i,
    ];

    defaultWhitelistPatterns.forEach(pattern => this.errorWhitelist.add(pattern));
  }

  /**
   * Enable fail-on-console-error behavior
   * @param {boolean} enabled - Whether to fail tests on console errors
   */
  setFailOnConsoleErrors(enabled = true) {
    this.failOnConsoleErrors = enabled;
  }

  /**
   * Add error pattern to whitelist (errors matching these patterns won't fail tests)
   * @param {RegExp|string} pattern - Pattern to whitelist
   */
  addErrorWhitelist(pattern) {
    if (typeof pattern === 'string') {
      pattern = new RegExp(pattern, 'i');
    }
    this.errorWhitelist.add(pattern);
  }

  /**
   * Remove error pattern from whitelist
   * @param {RegExp|string} pattern - Pattern to remove from whitelist
   */
  removeErrorWhitelist(pattern) {
    if (typeof pattern === 'string') {
      pattern = new RegExp(pattern, 'i');
    }
    this.errorWhitelist.delete(pattern);
  }

  /**
   * Clear all whitelist patterns
   */
  clearErrorWhitelist() {
    this.errorWhitelist.clear();
  }

  /**
   * Get current whitelist patterns
   */
  getErrorWhitelist() {
    return Array.from(this.errorWhitelist);
  }

  /**
   * Check if an error message matches any whitelist pattern
   * @param {string} message - Error message to check
   * @returns {boolean} - True if error is whitelisted
   */
  isErrorWhitelisted(message) {
    return Array.from(this.errorWhitelist).some(pattern => pattern.test(message));
  }

  /**
   * Set up enhanced console logging with critical error detection for a specific test
   */
  setupLogging(page, testInfo) {
    if (!page || !testInfo) return;

    const testId = this.getTestId(testInfo);

    // Initialize logs array for this test
    if (!this.testLogs.has(testId)) {
      this.testLogs.set(testId, []);
    }

    const testLogsArray = this.testLogs.get(testId);

    // Start critical error detection for this test
    globalCriticalErrorDetector.startMonitoring(page, testInfo);

    // Capture all console messages for this specific test
    page.on('console', (msg) => {
      const logEntry = {
        test: testInfo.title,
        testFile: testInfo.titlePath?.[0] || 'Unknown File',
        timestamp: new Date().toISOString(),
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        args: msg.args()?.map(arg => arg.toString()) || []
      };

      // Filter out irrelevant setup-related logs
      if (this.shouldIncludeLogEntry(logEntry)) {
        testLogsArray.push(logEntry);

        // Check for critical errors in real-time
        this.checkForCriticalErrorsInLog(logEntry, testInfo);

        // Check if we should fail test on console errors
        if (this.failOnConsoleErrors) {
          this.checkForFailureConditions(logEntry, testInfo);
        }
      }
    });

    // Capture page errors for this specific test
    page.on('pageerror', (error) => {
      const logEntry = {
        test: testInfo.title,
        testFile: testInfo.titlePath?.[0] || 'Unknown File',
        timestamp: new Date().toISOString(),
        type: 'pageerror',
        text: error.message,
        stack: error.stack,
        location: null,
        args: []
      };

      if (this.shouldIncludeLogEntry(logEntry)) {
        testLogsArray.push(logEntry);

        // Auto-save logs when critical page errors occur
        setTimeout(() => {
          this.saveTestLogs(testId, testLogsArray, testInfo).catch(err => {
            console.warn('Failed to auto-save logs on page error:', err.message);
          });
        }, 100); // Small delay to allow other logs to be captured
      }
    });

    // Capture page crashes for this specific test
    page.on('crash', () => {
      const logEntry = {
        test: testInfo.title,
        testFile: testInfo.titlePath?.[0] || 'Unknown File',
        timestamp: new Date().toISOString(),
        type: 'crash',
        text: 'Page crashed',
        location: null,
        args: []
      };

      // Page crashes are always relevant
      testLogsArray.push(logEntry);

      // Auto-save logs when page crashes
      setTimeout(() => {
        this.saveTestLogs(testId, testLogsArray, testInfo).catch(err => {
          console.warn('Failed to auto-save logs on page crash:', err.message);
        });
      }, 100); // Small delay to allow other logs to be captured
    });

    // Capture request failures for this specific test
    page.on('requestfailed', (request) => {
      const logEntry = {
        test: testInfo.title,
        testFile: testInfo.titlePath?.[0] || 'Unknown File',
        timestamp: new Date().toISOString(),
        type: 'requestfailed',
        text: `Request failed: ${request.method()} ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`,
        location: null,
        args: [request.url(), request.method()]
      };

      if (this.shouldIncludeLogEntry(logEntry)) {
        testLogsArray.push(logEntry);
      }
    });

    // Capture network responses with error status codes (like 404s for fonts)
    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();

      // Capture 4xx and 5xx responses (but filter out irrelevant ones)
      if (status >= 400) {
        const logEntry = {
          test: testInfo.title,
          testFile: testInfo.titlePath?.[0] || 'Unknown File',
          timestamp: new Date().toISOString(),
          type: 'networkerror',
          text: `HTTP ${status}: ${response.request().method()} ${url}`,
          location: null,
          args: [url, response.request().method(), status.toString()]
        };

        if (this.shouldIncludeLogEntry(logEntry)) {
          testLogsArray.push(logEntry);
        }
      }
    });
  }

  /**
   * Filter out irrelevant setup-related logs and apply console logging configuration
   */
  shouldIncludeLogEntry(logEntry) {
    const message = logEntry.text;
    const url = logEntry.args?.[0] || '';
    const logType = logEntry.type;

    // Apply console logging configuration based on log type
    const loggingConfig = CONSOLE_ERROR_CONFIG.CONSOLE_LOGGING;
    
    // Filter by log type based on configuration
    switch (logType) {
      case 'debug':
        if (!loggingConfig.INCLUDE_DEBUG_LOGS) {
          return false;
        }
        break;
      case 'info':
        if (!loggingConfig.INCLUDE_INFO_LOGS) {
          return false;
        }
        break;
      case 'log':
      case 'verbose':
        if (!loggingConfig.INCLUDE_VERBOSE_LOGS) {
          return false;
        }
        break;
      case 'warn':
      case 'warning':
        if (!loggingConfig.INCLUDE_WARNINGS) {
          return false;
        }
        break;
      case 'error':
        if (!loggingConfig.INCLUDE_ERRORS) {
          return false;
        }
        break;
      // Network errors, page errors, and crashes are always included
      case 'networkerror':
      case 'requestfailed':
      case 'pageerror':
      case 'crash':
        break;
      default:
        // For unknown types, include if verbose logging is enabled
        if (!loggingConfig.INCLUDE_VERBOSE_LOGS) {
          return false;
        }
    }

    // Filter out irrelevant setup-related logs
    const irrelevantPatterns = [
      // 401 errors during initial login/setup
      /Failed to load resource: the server responded with a status of 401/i,
      /HTTP 401.*nifi-api\/flow\/current-user/i,

      // Expected authentication-related errors during setup
      /401.*authentication/i,
      /login.*failed/i,
      /unauthorized/i,

      // Development-only verbose logs
      /\[DOM\] Input elements should have autocomplete attributes/i,
      /More info: https:\/\/goo\.gl\/9p2vKq/i
    ];

    // Check if this is an irrelevant setup log
    const isIrrelevant = irrelevantPatterns.some(pattern => pattern.test(message));

    if (isIrrelevant) {
      return false;
    }

    // Always include relevant resource loading errors (like FontAwesome 404s)
    if (logEntry.type === 'networkerror' || logEntry.type === 'requestfailed') {
      const relevantResourcePatterns = [
        /\.(woff|woff2|ttf|eot|otf)(\?.*)?$/i,  // Font files
        /\.(css|js|png|jpg|jpeg|gif|svg)(\?.*)?$/i,  // Other UI resources
        /nifi-cuioss-ui.*\.(woff|woff2|css|js)/i,  // Our UI resources specifically
        /fontawesome/i,  // FontAwesome resources
        /media\//i  // Media directory resources
      ];

      const isRelevantResource = relevantResourcePatterns.some(pattern => pattern.test(url));
      if (isRelevantResource) {
        return true;
      }
    }

    return true;
  }

  /**
   * Generate unique test identifier
   */
  getTestId(testInfo) {
    const sanitizedTitle = testInfo.title.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedFile = (testInfo.titlePath?.[0] || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
    return `${sanitizedFile}-${sanitizedTitle}`;
  }

  /**
   * Check if console error should cause test failure
   * @param {Object} logEntry - Console log entry
   * @param {Object} testInfo - Playwright test info
   */
  checkForFailureConditions(logEntry, testInfo) {
    const message = logEntry.text;
    const type = logEntry.type;

    // Only fail on actual console errors, not warnings or other types
    if (type !== 'error') {
      return;
    }

    // Check if this error is whitelisted
    if (this.isErrorWhitelisted(message)) {
      console.log(`[CONSOLE ERROR FILTER] Whitelisted error ignored: ${message.substring(0, 100)}...`);
      return;
    }

    // This is a non-whitelisted console error - fail the test
    const testId = this.getTestId(testInfo);
    const errorInfo = {
      message,
      type,
      timestamp: logEntry.timestamp,
      location: logEntry.location,
      test: testInfo.title,
      testFile: testInfo.titlePath?.[0] || 'Unknown File'
    };

    // Store the error for potential later retrieval
    if (!this.testErrors.has(testId)) {
      this.testErrors.set(testId, []);
    }
    this.testErrors.get(testId).push(errorInfo);

    console.error(`🚨 CONSOLE ERROR DETECTED - Test will fail:`);
    console.error(`Message: ${message}`);
    console.error(`Test: ${testInfo.title}`);
    console.error(`File: ${testInfo.titlePath?.[0] || 'Unknown'}`);
    console.error(`Location: ${JSON.stringify(logEntry.location)}`);

    // Auto-save logs when errors are detected
    const testLogsArray = this.testLogs.get(testId) || [];
    setTimeout(() => {
      this.saveTestLogs(testId, testLogsArray, testInfo).catch(err => {
        console.warn('Failed to auto-save logs on console error:', err.message);
      });
    }, 100);

    // Throw error to fail the test immediately
    throw new Error(
      `🚨 CONSOLE ERROR DETECTED:\n` +
      `Message: ${message}\n` +
      `Test: ${testInfo.title}\n` +
      `Location: ${JSON.stringify(logEntry.location)}\n` +
      `\nThis test failed because console errors are configured to cause test failure.\n` +
      `To whitelist this error, use: globalConsoleLogger.addErrorWhitelist('${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}')`
    );
  }

  /**
   * Check for critical errors in real-time during logging
   */
  checkForCriticalErrorsInLog(logEntry, testInfo) {
    const message = logEntry.text;
    const type = logEntry.type;

    // Critical JavaScript error patterns
    const criticalPatterns = [
      /Uncaught Error/i,
      /Uncaught TypeError/i,
      /Uncaught ReferenceError/i,
      /Uncaught SyntaxError/i,
      /Mismatched anonymous define\(\)/i,
      /Module name .* has not been loaded/i,
      /RequireJS/i,
      /Script error/i,
      /downloadable font.*download failed.*FontAwesome/i,  // FontAwesome download failures
      /fontawesome.*404|fontawesome.*failed|fontawesome.*error/i  // Other FontAwesome errors
    ];

    // UI Loading stall patterns (only match actual stalls, not success messages)
    const uiLoadingStallPatterns = [
      /Loading JWT Validator UI\.\.\.$/, // Only match if it ends with "..." (actual stall)
      /UI loading timeout/i,
      /Loading indicator still visible/i,
      /UI failed to initialize/i
    ];

    // Skip debug messages that contain success indicators
    const isSuccessMessage = /Loading indicator hidden|successfully hidden|initialization completed/i.test(message);

    if (isSuccessMessage) {
      return; // Skip success messages from critical error detection
    }

    // Check if this is a critical error
    const isCritical = criticalPatterns.some(pattern => pattern.test(message)) ||
                      uiLoadingStallPatterns.some(pattern => pattern.test(message));

    if (isCritical && type === 'error') {
      console.error(`🚨 CRITICAL ERROR DETECTED IN REAL-TIME: ${message}`);

      // Mark this in the log entry
      logEntry.isCriticalError = true;
      logEntry.criticalErrorType = this.getCriticalErrorType(message);

      // Auto-save logs when critical errors are detected
      const testId = this.getTestId(testInfo);
      const testLogsArray = this.testLogs.get(testId) || [];
      setTimeout(() => {
        this.saveTestLogs(testId, testLogsArray, testInfo).catch(err => {
          console.warn('Failed to auto-save logs on critical error:', err.message);
        });
      }, 100); // Small delay to allow other logs to be captured

      // Optionally fail immediately (can be controlled by test configuration)
      if (this.shouldFailImmediately(logEntry)) {
        throw new Error(
          `🚨 CRITICAL ERROR DETECTED - Test failed immediately:\n` +
          `Type: ${logEntry.criticalErrorType}\n` +
          `Message: ${message}\n` +
          `Test: ${testInfo.title}\n` +
          `This test is designed to fail when critical JavaScript errors are detected.`
        );
      }
    }
  }

  /**
   * Determine the type of critical error
   */
  getCriticalErrorType(message) {
    if (/Uncaught Error|Uncaught TypeError|Uncaught ReferenceError|Uncaught SyntaxError/i.test(message)) {
      return 'JAVASCRIPT_ERROR';
    }
    if (/Mismatched anonymous define\(\)|RequireJS|Module name .* has not been loaded/i.test(message)) {
      return 'MODULE_LOADING_ERROR';
    }
    if (/downloadable font.*download failed.*FontAwesome/i.test(message)) {
      return 'FONTAWESOME_DOWNLOAD_FAILED';
    }
    if (/fontawesome.*404|fontawesome.*failed|fontawesome.*error/i.test(message)) {
      return 'FONTAWESOME_RESOURCE_ERROR';
    }
    if (uiLoadingStallPatterns.some(pattern => pattern.test(message))) {
      return 'UI_LOADING_STALL';
    }
    return 'UNKNOWN_CRITICAL_ERROR';
  }

  /**
   * Determine if test should fail immediately on this error
   */
  shouldFailImmediately(logEntry) {
    // For now, always fail immediately on critical errors
    // This can be made configurable later
    return true;
  }

  /**
   * Save logs for a specific test in the test results directory
   */
  async saveTestLogs(testId, logs, testInfo) {
    // Get the test results directory path from testInfo
    const testResultsDir = testInfo.outputDir;

    if (!fs.existsSync(testResultsDir)) {
      fs.mkdirSync(testResultsDir, { recursive: true });
    }

    if (!logs || logs.length === 0) {
      // Create a notice file indicating no browser logs were captured
      const noticeFileName = 'console-logs-notice.txt';
      const noticeFilePath = path.join(testResultsDir, noticeFileName);
      const noticeContent = `No browser console logs captured for test: ${testId}
Test was likely skipped due to service unavailability or completed without browser interactions.
Timestamp: ${new Date().toISOString()}

To generate browser console logs:
1. Ensure NiFi is running on https://localhost:9095
2. Re-run the tests with the integration-tests profile
3. Check for any test setup issues that might prevent browser interactions
`;
      
      fs.writeFileSync(noticeFilePath, noticeContent, 'utf8');
      return noticeFilePath;
    }

    // Create single console log file in the test results directory
    const logFileName = 'console-logs.log';
    const logFilePath = path.join(testResultsDir, logFileName);
    
    // Also create JSON log file
    const jsonFileName = 'console-logs.json';
    const jsonFilePath = path.join(testResultsDir, jsonFileName);

    // Format logs for readability
    const formattedLogs = this.formatLogsForFile(logs, testId);

    // Write human-readable log file
    fs.writeFileSync(logFilePath, formattedLogs, 'utf8');
    
    // Write JSON log file
    fs.writeFileSync(jsonFilePath, JSON.stringify(logs, null, 2), 'utf8');

    return {
      textLog: logFilePath,
      jsonLog: jsonFilePath,
      totalLogs: logs.length,
      testId
    };
  }

  /**
   * Save all captured logs for all tests
   */
  async saveAllLogs() {
    const results = [];

    for (const [testId, logs] of this.testLogs) {
      // For global teardown, we don't have testInfo, so save to old location
      const result = await this.saveTestLogsLegacy(testId, logs);
      if (result) {
        results.push(result);
      }
    }

    return results.length > 0 ? results : null;
  }

  /**
   * Legacy save method for global teardown when testInfo is not available
   */
  async saveTestLogsLegacy(testId, logs) {
    if (!logs || logs.length === 0) {
      return null;
    }

    // Create target/logs directory for legacy global teardown
    const targetDir = path.join(process.cwd(), 'target');
    const logsDir = path.join(targetDir, 'logs');

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create individual test log files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFileName = `${testId}-console-logs-${timestamp}.log`;
    const logFilePath = path.join(logsDir, logFileName);
    
    // Also create JSON log file
    const jsonFileName = `${testId}-console-logs-${timestamp}.json`;
    const jsonFilePath = path.join(logsDir, jsonFileName);

    // Format logs for readability
    const formattedLogs = this.formatLogsForFile(logs, testId);

    // Write to files
    fs.writeFileSync(logFilePath, formattedLogs, 'utf8');
    fs.writeFileSync(jsonFilePath, JSON.stringify(logs, null, 2), 'utf8');

    return {
      textLog: logFilePath,
      jsonLog: jsonFilePath,
      totalLogs: logs.length,
      testId
    };
  }

  /**
   * Format logs for human-readable file
   */
  formatLogsForFile(logs, testId = 'ALL_TESTS') {
    const header = `
===============================================
      BROWSER CONSOLE LOGS - ${testId}
===============================================
Generated: ${new Date().toISOString()}
Total Log Entries: ${logs.length}
===============================================

`;

    const formattedEntries = logs.map((log, index) => {
      const separator = '---';
      return `
${separator} Entry ${index + 1} ${separator}
Test: ${log.test}
File: ${log.testFile}
Time: ${log.timestamp}
Type: ${log.type.toUpperCase()}
Message: ${log.text}
${log.location ? `Location: ${JSON.stringify(log.location)}` : ''}
${log.stack ? `Stack: ${log.stack}` : ''}
${log.args.length > 0 ? `Args: ${log.args.join(', ')}` : ''}
`;
    }).join('\n');

    return header + formattedEntries + '\n\n===============================================\n';
  }

  /**
   * Get current log count for a specific test
   */
  getLogCount(testId) {
    if (testId) {
      return this.testLogs.get(testId)?.length || 0;
    }
    // Return total count across all tests
    let total = 0;
    for (const logs of this.testLogs.values()) {
      total += logs.length;
    }
    return total;
  }

  /**
   * Clear logs for a specific test or all logs
   */
  clearLogs(testId) {
    if (testId) {
      this.testLogs.delete(testId);
    } else {
      this.testLogs.clear();
    }
  }

  /**
   * Get logs for a specific test
   */
  getTestLogs(testId) {
    return this.testLogs.get(testId) || [];
  }
}

// Export global instance
export const globalConsoleLogger = new IndividualTestLogger();

/**
 * Convenience function to setup logging on a page
 */
export function setupBrowserConsoleLogging(page, testInfo) {
  globalConsoleLogger.setupLogging(page, testInfo);
}

/**
 * Save all logs to file
 */
export async function saveAllBrowserLogs() {
  return globalConsoleLogger.saveAllLogs();
}

/**
 * Save logs for a specific test
 */
export async function saveTestBrowserLogs(testInfo) {
  const testId = globalConsoleLogger.getTestId(testInfo);
  const logs = globalConsoleLogger.getTestLogs(testId);
  return globalConsoleLogger.saveTestLogs(testId, logs, testInfo);
}

/**
 * Setup comprehensive error detection and logging
 * This is the recommended function to use in test files for strict error detection
 * @param {import('@playwright/test').Page} page - The Playwright page object
 * @param {import('@playwright/test').TestInfo} testInfo - The test information object
 * @param {boolean} skipInitialChecks - Skip initial canvas/UI checks (for pre-auth setup)
 */
export async function setupComprehensiveErrorDetection(page, testInfo, skipInitialChecks = false) {
  // Setup enhanced console logging with critical error detection
  globalConsoleLogger.setupLogging(page, testInfo);

  // Only perform initial critical error checks if not skipping them
  // This allows setup before authentication without false failures
  if (!skipInitialChecks) {
    await globalCriticalErrorDetector.checkForEmptyCanvas(page, testInfo);
    await globalCriticalErrorDetector.checkForUILoadingStalls(page, testInfo);

    // Fail immediately if any critical errors detected during setup
    globalCriticalErrorDetector.failTestOnCriticalErrors();
  }

  return {
    checkCriticalErrors: async () => {
      await globalCriticalErrorDetector.checkForEmptyCanvas(page, testInfo);
      await globalCriticalErrorDetector.checkForUILoadingStalls(page, testInfo);
      globalCriticalErrorDetector.failTestOnCriticalErrors();
    },

    getCriticalErrors: () => globalCriticalErrorDetector.getDetectedErrors(),

    cleanup: () => {
      globalCriticalErrorDetector.stopMonitoring();
      globalCriticalErrorDetector.clearErrors();
    }
  };
}

/**
 * Setup error detection with authentication awareness
 * Recommended for tests that need to authenticate before checking canvas
 */
export async function setupAuthAwareErrorDetection(page, testInfo) {
  return setupComprehensiveErrorDetection(page, testInfo, true);
}

/**
 * Quick check for critical errors during test execution
 */
export async function checkForCriticalErrors(page, testInfo) {
  await globalCriticalErrorDetector.checkForEmptyCanvas(page, testInfo);
  await globalCriticalErrorDetector.checkForUILoadingStalls(page, testInfo);
  globalCriticalErrorDetector.failTestOnCriticalErrors();
}

/**
 * Enable fail-on-console-error behavior globally
 * @param {boolean} enabled - Whether to fail tests on console errors
 */
export function setFailOnConsoleErrors(enabled = true) {
  globalConsoleLogger.setFailOnConsoleErrors(enabled);
}

/**
 * Add error pattern to global whitelist
 * @param {RegExp|string} pattern - Pattern to whitelist
 */
export function addErrorWhitelist(pattern) {
  globalConsoleLogger.addErrorWhitelist(pattern);
}

/**
 * Remove error pattern from global whitelist
 * @param {RegExp|string} pattern - Pattern to remove from whitelist
 */
export function removeErrorWhitelist(pattern) {
  globalConsoleLogger.removeErrorWhitelist(pattern);
}

/**
 * Clear all whitelist patterns
 */
export function clearErrorWhitelist() {
  globalConsoleLogger.clearErrorWhitelist();
}

/**
 * Get current whitelist patterns
 */
export function getErrorWhitelist() {
  return globalConsoleLogger.getErrorWhitelist();
}

/**
 * Check if an error message matches any whitelist pattern
 * @param {string} message - Error message to check
 * @returns {boolean} - True if error is whitelisted
 */
export function isErrorWhitelisted(message) {
  return globalConsoleLogger.isErrorWhitelisted(message);
}

/**
 * Setup console logging with fail-on-error behavior enabled
 * @param {import('@playwright/test').Page} page - The Playwright page object
 * @param {import('@playwright/test').TestInfo} testInfo - The test information object
 * @param {boolean} skipInitialChecks - Skip initial canvas/UI checks (for pre-auth setup)
 */
export async function setupStrictErrorDetection(page, testInfo, skipInitialChecks = false) {
  // Enable fail-on-console-error behavior
  globalConsoleLogger.setFailOnConsoleErrors(true);

  // Setup comprehensive error detection
  return setupComprehensiveErrorDetection(page, testInfo, skipInitialChecks);
}