/**
 * Enhanced error detection and tracking utility for NiFi E2E tests
 * Provides comprehensive error monitoring following requirements from Requirements.md
 */

/**
 * Error tracking state
 */
let errorTracker = {
  errors: [],
  warnings: [],
  startTime: null,
  isTracking: false,
};

/**
 * Start error tracking session
 * @param {Object} options - Tracking options
 * @param {boolean} options.includeWarnings - Whether to track warnings (default: true)
 * @param {Array<string>} options.ignoredErrors - Array of error patterns to ignore
 * @param {Array<string>} options.ignoredWarnings - Array of warning patterns to ignore
 */
export function startErrorTracking(options = {}) {
  const { includeWarnings = true, ignoredErrors = [], ignoredWarnings = [] } = options;

  cy.log('🔍 Starting error tracking session');

  errorTracker = {
    errors: [],
    warnings: [],
    startTime: Date.now(),
    isTracking: true,
    includeWarnings,
    ignoredErrors,
    ignoredWarnings,
  };

  // Set up console error capture
  cy.window().then((win) => {
    // Capture console.error
    const originalError = win.console.error;
    win.console.error = (...args) => {
      const errorMessage = args.join(' ');

      if (!shouldIgnoreError(errorMessage, ignoredErrors)) {
        errorTracker.errors.push({
          message: errorMessage,
          timestamp: Date.now(),
          type: 'console.error',
          stack: new Error().stack,
        });
      }

      originalError.apply(win.console, args);
    };

    // Capture console.warn if requested
    if (includeWarnings) {
      const originalWarn = win.console.warn;
      win.console.warn = (...args) => {
        const warningMessage = args.join(' ');

        if (!shouldIgnoreError(warningMessage, ignoredWarnings)) {
          errorTracker.warnings.push({
            message: warningMessage,
            timestamp: Date.now(),
            type: 'console.warn',
            stack: new Error().stack,
          });
        }

        originalWarn.apply(win.console, args);
      };
    }

    // Capture window errors
    win.addEventListener('error', (event) => {
      const errorMessage = `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;

      if (!shouldIgnoreError(errorMessage, ignoredErrors)) {
        errorTracker.errors.push({
          message: errorMessage,
          timestamp: Date.now(),
          type: 'window.error',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error ? event.error.stack : null,
        });
      }
    });

    // Capture unhandled promise rejections
    win.addEventListener('unhandledrejection', (event) => {
      const errorMessage = `Unhandled Promise Rejection: ${event.reason}`;

      if (!shouldIgnoreError(errorMessage, ignoredErrors)) {
        errorTracker.errors.push({
          message: errorMessage,
          timestamp: Date.now(),
          type: 'unhandled.rejection',
          reason: event.reason,
          stack: event.reason && event.reason.stack ? event.reason.stack : null,
        });
      }
    });
  });

  cy.log('✅ Error tracking session started');
}

/**
 * Stop error tracking and return collected errors
 * @returns {Object} Collected errors and warnings
 */
export function stopErrorTracking() {
  cy.log('🛑 Stopping error tracking session');

  errorTracker.isTracking = false;
  const endTime = Date.now();

  const results = {
    errors: [...errorTracker.errors],
    warnings: [...errorTracker.warnings],
    duration: endTime - errorTracker.startTime,
    totalErrors: errorTracker.errors.length,
    totalWarnings: errorTracker.warnings.length,
  };

  // Reset tracker
  errorTracker = {
    errors: [],
    warnings: [],
    startTime: null,
    isTracking: false,
  };

  cy.log(
    `📊 Error tracking complete: ${results.totalErrors} errors, ${results.totalWarnings} warnings`
  );
  return results;
}

/**
 * Get current error tracking status and results
 * @returns {Object} Current tracking status and collected errors
 */
export function getErrorTrackingResults() {
  return {
    isTracking: errorTracker.isTracking,
    errors: [...errorTracker.errors],
    warnings: [...errorTracker.warnings],
    totalErrors: errorTracker.errors.length,
    totalWarnings: errorTracker.warnings.length,
    duration: errorTracker.startTime ? Date.now() - errorTracker.startTime : 0,
  };
}

/**
 * Clear accumulated errors and warnings
 */
export function clearErrorTracking() {
  cy.log('🧹 Clearing error tracking data');

  errorTracker.errors = [];
  errorTracker.warnings = [];

  cy.log('✅ Error tracking data cleared');
}

/**
 * Assert no errors occurred during tracking
 * @param {string} operationDescription - Description of operation being validated
 * @param {Object} options - Assertion options
 * @param {boolean} options.allowWarnings - Whether warnings are acceptable (default: true)
 * @param {Array<string>} options.allowedErrors - Additional error patterns to ignore
 * @param {boolean} options.stopTracking - Whether to stop tracking after assertion (default: false)
 */
export function assertNoErrors(operationDescription, options = {}) {
  const { allowWarnings = true, allowedErrors = [], stopTracking = false } = options;

  cy.log(`🔍 Asserting no errors for: ${operationDescription}`);

  cy.then(() => {
    const results = getErrorTrackingResults();

    // Filter out allowed errors
    const significantErrors = results.errors.filter(
      (error) => !shouldIgnoreError(error.message, allowedErrors)
    );

    if (significantErrors.length > 0) {
      const errorReport = significantErrors
        .map((error) => `[${error.type}] ${error.message}`)
        .join('\n');

      throw new Error(`Console errors detected during ${operationDescription}:\n${errorReport}`);
    }

    if (!allowWarnings && results.warnings.length > 0) {
      const warningReport = results.warnings
        .map((warning) => `[${warning.type}] ${warning.message}`)
        .join('\n');

      throw new Error(
        `Console warnings detected during ${operationDescription}:\n${warningReport}`
      );
    }

    if (stopTracking) {
      stopErrorTracking();
    }

    cy.log(`✅ No significant errors found for: ${operationDescription}`);
  });
}

/**
 * Check if error should be ignored based on patterns
 * @param {string} errorMessage - Error message to check
 * @param {Array<string>} ignorePatterns - Array of patterns to ignore
 * @returns {boolean} True if error should be ignored
 */
function shouldIgnoreError(errorMessage, ignorePatterns = []) {
  return ignorePatterns.some((pattern) => {
    if (pattern instanceof RegExp) {
      return pattern.test(errorMessage);
    }
    return errorMessage.includes(pattern);
  });
}

/**
 * Generate detailed error report
 * @param {Object} options - Report options
 * @param {boolean} options.includeStackTraces - Whether to include stack traces (default: false)
 * @param {string} options.format - Report format ('text' or 'json') (default: 'text')
 * @returns {string} Formatted error report
 */
export function generateErrorReport(options = {}) {
  const { includeStackTraces = false, format = 'text' } = options;

  const results = getErrorTrackingResults();

  if (format === 'json') {
    return JSON.stringify(
      {
        summary: {
          totalErrors: results.totalErrors,
          totalWarnings: results.totalWarnings,
          duration: results.duration,
          isTracking: results.isTracking,
        },
        errors: includeStackTraces
          ? results.errors
          : results.errors.map((e) => ({
              message: e.message,
              timestamp: e.timestamp,
              type: e.type,
            })),
        warnings: includeStackTraces
          ? results.warnings
          : results.warnings.map((w) => ({
              message: w.message,
              timestamp: w.timestamp,
              type: w.type,
            })),
      },
      null,
      2
    );
  }

  // Text format
  let report = `Error Tracking Report\n`;
  report += `=====================\n`;
  report += `Duration: ${results.duration}ms\n`;
  report += `Total Errors: ${results.totalErrors}\n`;
  report += `Total Warnings: ${results.totalWarnings}\n`;
  report += `Status: ${results.isTracking ? 'Active' : 'Stopped'}\n\n`;

  if (results.errors.length > 0) {
    report += `ERRORS:\n`;
    report += `-------\n`;
    results.errors.forEach((error, index) => {
      report += `${index + 1}. [${error.type}] ${error.message}\n`;
      if (includeStackTraces && error.stack) {
        report += `   Stack: ${error.stack}\n`;
      }
      report += `   Time: ${new Date(error.timestamp).toISOString()}\n\n`;
    });
  }

  if (results.warnings.length > 0) {
    report += `WARNINGS:\n`;
    report += `---------\n`;
    results.warnings.forEach((warning, index) => {
      report += `${index + 1}. [${warning.type}] ${warning.message}\n`;
      if (includeStackTraces && warning.stack) {
        report += `   Stack: ${warning.stack}\n`;
      }
      report += `   Time: ${new Date(warning.timestamp).toISOString()}\n\n`;
    });
  }

  return report;
}

/**
 * Save error report to file
 * @param {string} filename - Filename for the report
 * @param {Object} options - Save options
 */
export function saveErrorReport(filename, options = {}) {
  const report = generateErrorReport(options);

  cy.writeFile(`cypress/reports/error-reports/${filename}`, report);
  cy.log(`📄 Error report saved to: cypress/reports/error-reports/${filename}`);
}

/**
 * Monitor specific UI operation for errors
 * @param {Function} operation - Function containing the operation to monitor
 * @param {string} operationName - Name of the operation for reporting
 * @param {Object} options - Monitoring options
 */
export function monitorOperation(operation, operationName, options = {}) {
  const {
    allowWarnings = true,
    allowedErrors = [],
    saveReport = false,
    reportFilename = `${operationName}-${Date.now()}.txt`,
  } = options;

  cy.log(`🔍 Monitoring operation: ${operationName}`);

  // Start tracking
  startErrorTracking(options);

  // Execute operation
  operation();

  // Assert no errors and optionally save report
  cy.then(() => {
    assertNoErrors(operationName, { allowWarnings, allowedErrors });

    if (saveReport) {
      saveErrorReport(reportFilename, options);
    }

    const results = stopErrorTracking();
    cy.log(
      `✅ Operation monitoring complete: ${operationName} - ${results.totalErrors} errors, ${results.totalWarnings} warnings`
    );
  });
}

/**
 * Set up global error monitoring for entire test
 * @param {Object} options - Global monitoring options
 */
export function setupGlobalErrorMonitoring(options = {}) {
  const {
    ignoredErrors = [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      // Add more common framework errors to ignore
    ],
    ignoredWarnings = [
      'Deprecated',
      // Add more common warnings to ignore
    ],
  } = options;

  before(() => {
    startErrorTracking({
      ignoredErrors,
      ignoredWarnings,
      includeWarnings: true,
    });
  });

  after(() => {
    const results = stopErrorTracking();

    if (results.totalErrors > 0) {
      cy.log(`⚠️ Test completed with ${results.totalErrors} console errors`);
      saveErrorReport(`test-suite-errors-${Date.now()}.txt`, {
        includeStackTraces: true,
        format: 'text',
      });
    }
  });

  beforeEach(() => {
    clearErrorTracking();
  });
}

/**
 * Log a test step for debugging purposes
 * @param {string} testName - Name of the test
 * @param {string} stepDescription - Description of the step
 */
export function logTestStep(testName, stepDescription) {
  const timestamp = new Date().toISOString();
  cy.log(`📝 [${testName}] ${timestamp}: ${stepDescription}`);

  // Also log to console for debugging
  cy.task('log', `[${testName}] ${timestamp}: ${stepDescription}`);
}

/**
 * Capture debug information for a test
 * @param {string} testName - Name of the test
 */
export function captureDebugInfo(testName) {
  cy.log(`🔍 Capturing debug info for: ${testName}`);

  // Capture console logs
  cy.window().then((_win) => {
    // Get any console errors from browser
    cy.task('log', `Debug info captured for ${testName} at ${new Date().toISOString()}`);
  });
}

/**
 * Track a test failure
 * @param {string} testName - Name of the test
 * @param {string} errorMessage - Error message
 * @param {Object} options - Additional tracking options
 */
export function trackTestFailure(testName, errorMessage, options = {}) {
  const timestamp = new Date().toISOString();
  const failureInfo = {
    testName,
    errorMessage,
    timestamp,
    url: options.url || '',
    screenshot: options.screenshot || false,
  };

  cy.log(`❌ Test failure tracked: ${testName} - ${errorMessage}`);
  cy.task('log', `FAILURE: ${JSON.stringify(failureInfo, null, 2)}`);

  // Optionally take screenshot
  if (options.screenshot !== false) {
    cy.screenshot(`failure-${testName}-${Date.now()}`);
  }
}
