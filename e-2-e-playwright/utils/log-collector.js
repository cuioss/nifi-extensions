/**
 * @file Log Collector - Client Log Collection and Storage
 * Provides functions for collecting and saving client logs and browser console logs to files
 * @version 1.1.0
 */

// Use ES modules for test files
import path from 'path';
import fs from 'fs';
import { BROWSER_ERROR_PATTERNS } from './constants';
import { processConsoleArgs } from './console-args-processor';
import { isCriticalError, isEnhancedError, extractErrorDetails, createEnhancedErrorMessage } from './error-detector';

// Using ES modules only for consistency

// Define paths for logs (following Maven standard)
const TARGET_DIR = path.join(__dirname, '..', 'target');
const LOGS_DIR = path.join(TARGET_DIR, 'logs');

// Ensure the logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Store logs in memory until they're written to a file
const logBuffer = {
  global: [],
  tests: {},
  browser: {
    global: [],
    tests: {}
  },
  criticalErrors: [] // Track critical errors separately for summary reporting
};

/**
 * Add a log entry to the buffer
 * @param {string} level - Log level (info, success, warn, error)
 * @param {string} message - Message to log
 * @param {string} [testName] - Name of the test (optional)
 * @param {boolean} [isBrowserLog=false] - Whether this is a browser console log
 */
export function addLogEntry(level, message, testName = null, isBrowserLog = false) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    message,
    source: isBrowserLog ? 'browser' : 'app'
  };

  if (isBrowserLog) {
    // Add to browser logs
    logBuffer.browser.global.push(entry);

    // If a test name is provided, add to test-specific browser logs
    if (testName) {
      if (!logBuffer.browser.tests[testName]) {
        logBuffer.browser.tests[testName] = [];
      }
      logBuffer.browser.tests[testName].push(entry);
    }
  } else {
    // Always add to global logs
    logBuffer.global.push(entry);

    // If a test name is provided, add to test-specific logs
    if (testName) {
      if (!logBuffer.tests[testName]) {
        logBuffer.tests[testName] = [];
      }
      logBuffer.tests[testName].push(entry);
    }
  }
}

/**
 * Add a browser console log entry to the buffer
 * @param {string} type - Console log type (log, debug, info, error, warning)
 * @param {string} text - Console log text
 * @param {string} [testName] - Name of the test (optional)
 */
export function addBrowserLogEntry(type, text, testName = null) {
  // Map console log types to our log levels
  const levelMap = {
    log: 'info',
    debug: 'info',
    info: 'info',
    error: 'error',
    warning: 'warn'
  };

  // Determine if this is a critical error that should be highlighted
  let level = levelMap[type] || 'info';
  let message = `[BROWSER] ${text}`;

  // Check if the message matches any of the critical error patterns
  const isMessageCritical = isCriticalError(text);

  // If this is a critical error, add a special prefix to make it stand out
  if (isMessageCritical) {
    level = 'error'; // Force error level for critical errors
    message = `[BROWSER] [CRITICAL] ${text}`;

    // Also log to console for immediate visibility during test runs
    console.error(`🚨 CRITICAL BROWSER ERROR: ${text.substring(0, 150)}${text.length > 150 ? '...' : ''}`);

    // Add to critical errors array for summary reporting
    logBuffer.criticalErrors.push({
      timestamp: new Date().toISOString(),
      message: text,
      testName: testName || 'global'
    });
  }

  // Add to log buffer with isBrowserLog=true
  addLogEntry(level, message, testName, true);
}

/**
 * Format a log entry as a string
 * @param {Object} entry - Log entry object
 * @returns {string} Formatted log entry
 */
function formatLogEntry(entry) {
  const prefix = {
    info: '🔵 INFO:',
    success: '✅ SUCCESS:',
    warn: '🟠 WARNING:',
    error: '🔴 ERROR:',
  }[entry.level] || '🔵 INFO:';

  // If the message already includes [BROWSER], don't add the source prefix
  if (entry.source === 'browser' && !entry.message.includes('[BROWSER]')) {
    return `[${entry.timestamp}] ${prefix} [BROWSER] ${entry.message}`;
  }

  return `[${entry.timestamp}] ${prefix} ${entry.message}`;
}

/**
 * Save logs for a specific test to a file
 * @param {string} testName - Name of the test
 * @param {string} [testFile] - Name of the test file (optional)
 * @returns {Promise<string>} Path to the log file
 */
export async function saveTestLogs(testName, testFile = null) {
  // Skip if no logs for this test
  const hasAppLogs = logBuffer.tests[testName] && logBuffer.tests[testName].length > 0;
  const hasBrowserLogs = logBuffer.browser.tests[testName] && logBuffer.browser.tests[testName].length > 0;

  if (!hasAppLogs && !hasBrowserLogs) {
    return null;
  }

  // Create a safe filename from the test name
  const safeTestName = testName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const testFilePrefix = testFile ?
    path.basename(testFile, path.extname(testFile)).replace(/[^a-z0-9]/gi, '_').toLowerCase() + '-' :
    '';

  const logFileName = `${testFilePrefix}${safeTestName}.log`;
  const logFilePath = path.join(LOGS_DIR, logFileName);

  // Combine app logs and browser logs
  let allLogs = [];

  // Add app logs if they exist
  if (hasAppLogs) {
    allLogs = allLogs.concat(logBuffer.tests[testName]);
  }

  // Add browser logs if they exist
  if (hasBrowserLogs) {
    allLogs = allLogs.concat(logBuffer.browser.tests[testName]);
  }

  // Sort logs by timestamp
  allLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Format all log entries
  const formattedLogs = allLogs.map(formatLogEntry).join('\n');

  // Write logs to file
  await fs.promises.writeFile(logFilePath, formattedLogs, 'utf8');

  return logFilePath;
}

/**
 * Save all logs to a file
 * @param {string} [fileName='all-tests.log'] - Name of the log file
 * @returns {Promise<string>} Path to the log file
 */
export async function saveAllLogs(fileName = 'all-tests.log') {
  // Skip if no logs
  const hasAppLogs = logBuffer.global.length > 0;
  const hasBrowserLogs = logBuffer.browser.global.length > 0;

  if (!hasAppLogs && !hasBrowserLogs) {
    return null;
  }

  const logFilePath = path.join(LOGS_DIR, fileName);

  // Combine app logs and browser logs
  let allLogs = [];

  // Add app logs if they exist
  if (hasAppLogs) {
    allLogs = allLogs.concat(logBuffer.global);
  }

  // Add browser logs if they exist
  if (hasBrowserLogs) {
    allLogs = allLogs.concat(logBuffer.browser.global);
  }

  // Sort logs by timestamp
  allLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Format all log entries
  const formattedLogs = allLogs.map(formatLogEntry).join('\n');

  // Write logs to file
  await fs.promises.writeFile(logFilePath, formattedLogs, 'utf8');

  // Generate critical errors summary if there are any
  if (logBuffer.criticalErrors.length > 0) {
    await saveCriticalErrorsSummary();
  }

  return logFilePath;
}

/**
 * Save a summary of critical browser errors to a file
 * @param {string} [fileName='critical-errors-summary.log'] - Name of the log file
 * @returns {Promise<string>} Path to the log file
 */
export async function saveCriticalErrorsSummary(fileName = 'critical-errors-summary.log') {
  // Skip if no critical errors
  if (logBuffer.criticalErrors.length === 0) {
    return null;
  }

  const logFilePath = path.join(LOGS_DIR, fileName);

  // Group critical errors by test
  const errorsByTest = {};
  logBuffer.criticalErrors.forEach(error => {
    if (!errorsByTest[error.testName]) {
      errorsByTest[error.testName] = [];
    }
    errorsByTest[error.testName].push(error);
  });

  // Format the summary
  let summary = '🚨 CRITICAL BROWSER ERRORS SUMMARY 🚨\n';
  summary += '===========================================\n\n';
  summary += `Total critical errors: ${logBuffer.criticalErrors.length}\n\n`;

  // Add errors grouped by test
  Object.keys(errorsByTest).forEach(testName => {
    const errors = errorsByTest[testName];
    summary += `Test: ${testName}\n`;
    summary += `  Number of critical errors: ${errors.length}\n`;

    // Add each error
    errors.forEach((error, index) => {
      summary += `  ${index + 1}. [${error.timestamp}] ${error.message.substring(0, 150)}${error.message.length > 150 ? '...' : ''}\n`;
    });

    summary += '\n';
  });

  // Add patterns found
  const patternsFound = {};
  BROWSER_ERROR_PATTERNS.forEach(pattern => {
    const count = logBuffer.criticalErrors.filter(error => error.message.includes(pattern)).length;
    if (count > 0) {
      patternsFound[pattern] = count;
    }
  });

  summary += 'Error patterns found:\n';
  Object.keys(patternsFound).forEach(pattern => {
    summary += `  - "${pattern}": ${patternsFound[pattern]} occurrences\n`;
  });

  // Write summary to file
  await fs.promises.writeFile(logFilePath, summary, 'utf8');

  // Also log to console
  console.error('\n' + summary);

  return logFilePath;
}

/**
 * Clear logs for a specific test
 * @param {string} testName - Name of the test
 */
export function clearTestLogs(testName) {
  // Clear app logs
  if (logBuffer.tests[testName]) {
    delete logBuffer.tests[testName];
  }

  // Clear browser logs
  if (logBuffer.browser.tests[testName]) {
    delete logBuffer.browser.tests[testName];
  }
}

/**
 * Clear all logs
 */
export function clearAllLogs() {
  // Clear app logs
  logBuffer.global = [];
  logBuffer.tests = {};

  // Clear browser logs
  logBuffer.browser.global = [];
  logBuffer.browser.tests = {};

  // Clear critical errors
  logBuffer.criticalErrors = [];
}

/**
 * Get the current test name from a Playwright test info object
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright test info object
 * @returns {string} Test name
 */
export function getTestName(testInfo) {
  return testInfo.title;
}

/**
 * Get the current test file from a Playwright test info object
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright test info object
 * @returns {string} Test file name
 */
export function getTestFile(testInfo) {
  return testInfo.file;
}

/**
 * Set up listeners for browser console events with enhanced object handling
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} [testName] - Name of the test (optional)
 */
export function setupBrowserConsoleListener(page, testName = null) {
  if (!page) {
    console.error('Cannot set up browser console listener: page is null or undefined');
    return;
  }

  // Store console messages for batch processing to avoid "Target closed" errors
  const consoleMessages = [];

  // Helper function to extract location information
  function getLocationInfo(msg) {
    try {
      const locationObj = msg.location();
      if (locationObj && locationObj.url) {
        return ` (${locationObj.url}${locationObj.lineNumber ? ':' + locationObj.lineNumber : ''}${locationObj.columnNumber ? ':' + locationObj.columnNumber : ''})`;
      }
    } catch (e) {
      // Ignore location errors
    }
    return '';
  }

  // Listen for console events with enhanced object serialization
  page.on('console', async (msg) => {
    const type = msg.type();
    const text = msg.text();
    
    try {
      // Process console arguments for enhanced text
      const args = msg.args();
      const processedArgs = await processConsoleArgs(args);
      const enhancedText = processedArgs.length > 0 ? processedArgs.join(' ') : text;
      
      // Add location information if available
      const location = getLocationInfo(msg);
      const finalText = location ? `${enhancedText}${location}` : enhancedText;

      // Store message for potential batch processing
      consoleMessages.push({ type, text: finalText, timestamp: new Date() });

      // Add to log buffer immediately for real-time logging
      addBrowserLogEntry(type, finalText, testName);
    } catch (e) {
      // Fallback to original text if processing fails
      console.warn(`Error processing console message: ${e.message}`);
      addBrowserLogEntry(type, text, testName);
    }
  });

  // Listen for page errors
  page.on('pageerror', (error) => {
    // Extract stack trace if available
    let stackTrace = '';
    if (error.stack) {
      stackTrace = `\nStack trace: ${error.stack}`;
    }

    addBrowserLogEntry('error', `Page Error: ${error.message}${stackTrace}`, testName);
  });

  // Listen for request failures
  page.on('requestfailed', (request) => {
    const url = request.url();
    const failure = request.failure();
    const errorText = failure ? failure.errorText : 'Unknown error';

    // Get more details about the request
    const method = request.method();
    const resourceType = request.resourceType();

    addBrowserLogEntry('error', `Request Failed: ${method} ${url} (${resourceType}) - ${errorText}`, testName);
  });

  // Enhanced error and exception handling
  page.on('console', async (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      
      // Handle enhanced error types
      if (isEnhancedError(text)) {
        try {
          const args = msg.args();
          const errorContext = await extractErrorDetails(args);
          const enhancedErrorMsg = createEnhancedErrorMessage(text, errorContext);
          
          addBrowserLogEntry('error', enhancedErrorMsg, testName);
          
          // Also log to console for immediate visibility
          console.error(`🚨 ENHANCED ERROR CAPTURE: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
        } catch (e) {
          // Fallback to basic logging
          addBrowserLogEntry('error', `Critical Error: ${text}`, testName);
        }
      }
    }
  });

  // Enhanced JavaScript error logging in the browser
  page.evaluate(() => {
    // Override console methods to capture more detailed information
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };

    // Enhanced error event listener
    window.addEventListener('error', (event) => {
      const errorInfo = {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error ? {
          name: event.error.name,
          message: event.error.message,
          stack: event.error.stack
        } : null,
        timestamp: new Date().toISOString()
      };
      
      // Log comprehensive error information
      originalConsole.error('🔥 Enhanced JS Error Capture:', JSON.stringify(errorInfo, null, 2));
    });

    // Enhanced unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      const rejectionInfo = {
        reason: event.reason,
        promise: event.promise,
        timestamp: new Date().toISOString(),
        stack: event.reason?.stack || 'No stack trace available'
      };
      
      originalConsole.error('🔥 Enhanced Promise Rejection:', JSON.stringify(rejectionInfo, null, 2));
    });

    // Capture AMD/RequireJS errors (like the "Mismatched anonymous define" error)
    if (window.define && window.define.amd) {
      const originalDefine = window.define;
      window.define = function(...args) {
        try {
          return originalDefine.apply(this, args);
        } catch (error) {
          originalConsole.error('🔥 AMD/RequireJS Error:', {
            error: error.message,
            stack: error.stack,
            args: args.length,
            timestamp: new Date().toISOString()
          });
          throw error;
        }
      };
    }

    // Capture module loading errors
    if (window.require) {
      const originalRequire = window.require;
      window.require = function(...args) {
        try {
          return originalRequire.apply(this, args);
        } catch (error) {
          originalConsole.error('🔥 Module Loading Error:', {
            error: error.message,
            stack: error.stack,
            modules: args,
            timestamp: new Date().toISOString()
          });
          throw error;
        }
      };
    }
  }).catch(e => console.error('Error setting up enhanced browser error listeners:', e));

  // Return a cleanup function
  return () => {
    // Process any remaining console messages
    if (consoleMessages.length > 0) {
      console.log(`📊 Processed ${consoleMessages.length} console messages for test: ${testName || 'global'}`);
    }
  };
}

/**
 * Enhanced console listener specifically for capturing complex JavaScript errors
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} [testName] - Name of the test (optional)
 * @returns {Function} Cleanup function
 */
export function setupEnhancedConsoleListener(page, testName = null) {
  const cleanup = setupBrowserConsoleListener(page, testName);
  
  // Additional listeners for specific error patterns
  page.on('response', (response) => {
    if (!response.ok()) {
      addBrowserLogEntry('error', `HTTP Error: ${response.status()} ${response.statusText()} - ${response.url()}`, testName);
    }
  });

  // Network error detection
  page.on('requestfailed', (request) => {
    const url = request.url();
    const failure = request.failure();
    const method = request.method();
    const resourceType = request.resourceType();
    
    addBrowserLogEntry('error', `Network Request Failed: ${method} ${url} (${resourceType}) - ${failure?.errorText || 'Unknown error'}`, testName);
  });

  return cleanup;
}

// All functions are exported individually using ES modules above
