/**
 * @file Enhanced Console Logger with Critical Error Detection
 * Captures ALL browser console logs across all tests and saves to accessible file
 * Now includes real-time critical error detection and automatic test failure
 * @version 2.0.0
 */

import fs from 'fs';
import path from 'path';
import { globalCriticalErrorDetector } from './critical-error-detector.js';

class IndividualTestLogger {
  constructor() {
    this.testLogs = new Map(); // Map of testId -> logs array
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
      
      testLogsArray.push(logEntry);
      
      // Check for critical errors in real-time
      this.checkForCriticalErrorsInLog(logEntry, testInfo);
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
      
      testLogsArray.push(logEntry);
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
      
      testLogsArray.push(logEntry);
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
      
      testLogsArray.push(logEntry);
    });
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
      /Script error/i
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
    if (!logs || logs.length === 0) {
      return null;
    }

    // Get the test results directory path from testInfo
    // This follows the same pattern as other test artifacts
    const testResultsDir = testInfo.outputDir;
    
    if (!fs.existsSync(testResultsDir)) {
      fs.mkdirSync(testResultsDir, { recursive: true });
    }

    // Create single console log file in the test results directory
    const logFileName = 'console-logs.log';
    const logFilePath = path.join(testResultsDir, logFileName);

    // Format logs for readability
    const formattedLogs = this.formatLogsForFile(logs, testId);

    // Write only the human-readable log file
    fs.writeFileSync(logFilePath, formattedLogs, 'utf8');

    return {
      textLog: logFilePath,
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

    // Format logs for readability
    const formattedLogs = this.formatLogsForFile(logs, testId);

    // Write to file
    fs.writeFileSync(logFilePath, formattedLogs, 'utf8');

    return {
      textLog: logFilePath,
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