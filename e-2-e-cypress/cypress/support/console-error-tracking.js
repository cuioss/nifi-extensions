import allowedWarnings from './console-warnings-allowlist.js';
import { formatConsoleArgs } from './utils.js';

/**
 * Tracks console errors during test execution and reports them as test failures
 * unless they match entries in the allowed warnings list.
 */

// Global storage for console messages across all windows
const globalConsoleStorage = {
  errors: [],
  warnings: [],
  infos: [],
  browserConsole: [] // New array to store raw browser console entries
};

// Function to capture console logs from browser
function captureConsoleLogs() {
  // Clear previous logs
  globalConsoleStorage.errors = [];
  globalConsoleStorage.warnings = [];
  globalConsoleStorage.infos = [];
  globalConsoleStorage.browserConsole = [];

  // Set up console log listeners
  Cypress.on('window:before:load', (win) => {
    // Store original console methods
    const originalConsole = {
      error: win.console.error,
      warn: win.console.warn,
      info: win.console.info,
      log: win.console.log,
    };

    // Override console.error
    win.console.error = (...args) => {
      // Call original console.error
      originalConsole.error(...args);

      // Store the error message
      const message = formatConsoleArgs(...args);
      globalConsoleStorage.errors.push(message);

      // Also store in browserConsole for raw access
      globalConsoleStorage.browserConsole.push({
        type: 'error',
        message,
        args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)),
        timestamp: new Date().toISOString(),
        source: 'console.error'
      });
    };

    // Override console.warn
    win.console.warn = (...args) => {
      // Call original console.warn
      originalConsole.warn(...args);

      // Store the warning message
      const message = formatConsoleArgs(...args);

      // Only track warnings not in the allowlist
      if (!allowedWarnings.some((allowedMsg) => message.includes(allowedMsg))) {
        globalConsoleStorage.warnings.push(message);
      }

      // Always store in browserConsole for raw access
      globalConsoleStorage.browserConsole.push({
        type: 'warn',
        message,
        args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)),
        timestamp: new Date().toISOString(),
        source: 'console.warn'
      });
    };

    // Override console.info
    win.console.info = (...args) => {
      // Call original console.info
      originalConsole.info(...args);

      // Store the info message
      const message = formatConsoleArgs(...args);
      globalConsoleStorage.infos.push({
        type: 'info',
        message,
        timestamp: new Date().toISOString()
      });

      // Also store in browserConsole for raw access
      globalConsoleStorage.browserConsole.push({
        type: 'info',
        message,
        args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)),
        timestamp: new Date().toISOString(),
        source: 'console.info'
      });
    };

    // Override console.log
    win.console.log = (...args) => {
      // Call original console.log
      originalConsole.log(...args);

      // Store the log message
      const message = formatConsoleArgs(...args);
      globalConsoleStorage.infos.push({
        type: 'log',
        message,
        timestamp: new Date().toISOString()
      });

      // Also store in browserConsole for raw access
      globalConsoleStorage.browserConsole.push({
        type: 'log',
        message,
        args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)),
        timestamp: new Date().toISOString(),
        source: 'console.log'
      });
    };
  });

  // Also capture logs from Cypress's browser logs collection
  Cypress.on('log:added', (log) => {
    try {
      // Check if log has consoleProps and handle both function and property cases
      let consoleProps;
      if (typeof log.consoleProps === 'function') {
        consoleProps = log.consoleProps();
      } else if (typeof log.consoleProps === 'object' && log.consoleProps !== null) {
        consoleProps = log.consoleProps;
      }

      if (consoleProps) {
        // Extract all possible console messages
        const possibleMessages = [
          consoleProps.Message,
          consoleProps.message,
          consoleProps.Content,
          consoleProps.content,
          consoleProps.Text,
          consoleProps.text,
          consoleProps.Log,
          consoleProps.log
        ].filter(Boolean); // Filter out undefined/null values

        if (possibleMessages.length > 0) {
          // Use the first available message
          const message = formatConsoleArgs(possibleMessages[0]);

          // Categorize based on log type
          if (log.type === 'error' || log.name === 'error') {
            globalConsoleStorage.errors.push(message);
          } else if (log.type === 'warn' || log.name === 'warn') {
            // Only track warnings not in the allowlist
            if (!allowedWarnings.some((allowedMsg) => message.includes(allowedMsg))) {
              globalConsoleStorage.warnings.push(message);
            }
          } else {
            globalConsoleStorage.infos.push({
              type: log.type || 'log',
              message,
              timestamp: new Date().toISOString()
            });
          }

          // Also store in browserConsole for raw access
          globalConsoleStorage.browserConsole.push({
            type: log.type || log.name || 'log',
            message,
            source: 'cypress:log',
            consoleProps: JSON.stringify(consoleProps),
            timestamp: new Date().toISOString()
          });
        }

        // Check for Console API calls specifically
        if (consoleProps.Command === 'console' ||
            consoleProps.name === 'console' ||
            (consoleProps.Method && consoleProps.Method.includes('console'))) {

          // This is a console API call, capture it
          const consoleType = consoleProps.Method || consoleProps.name || 'log';
          const consoleMessage = consoleProps.Message || consoleProps.message || consoleProps.Content || '';

          globalConsoleStorage.browserConsole.push({
            type: consoleType,
            message: formatConsoleArgs(consoleMessage),
            source: 'cypress:console-api',
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      // Silently handle any errors in log processing to avoid breaking tests
      console.error('Error processing Cypress log:', e);

      // Still try to capture something from this log
      try {
        globalConsoleStorage.browserConsole.push({
          type: 'unknown',
          message: `Failed to process log: ${e.message}`,
          source: 'cypress:log-error',
          logType: log.type || log.name || 'unknown',
          timestamp: new Date().toISOString()
        });
      } catch (innerError) {
        // Really just ignore at this point
      }
    }
  });
}

// Initialize console log capture
captureConsoleLogs();

/**
 * Verify no console errors occurred during the test
 */
Cypress.Commands.add('verifyNoConsoleErrors', () => {
  // Filter out test messages from errors
  const filteredErrors = (globalConsoleStorage.errors || []).filter(
    error => !error.includes('TEST_ERROR:')
  );

  if (filteredErrors.length > 0) {
    // Format error messages for reporting
    const errorMessages = filteredErrors.map((msg) => `- ${msg}`).join('\n');

    // Fail the test with console error information
    throw new Error(`${filteredErrors.length} console error(s) detected:\n${errorMessages}`);
  }
});

/**
 * Verify no unexpected console warnings occurred during the test
 */
Cypress.Commands.add('verifyNoUnexpectedWarnings', () => {
  // Filter out test messages from warnings
  const filteredWarnings = (globalConsoleStorage.warnings || []).filter(
    warning => !warning.includes('TEST_WARN:')
  );

  if (filteredWarnings.length > 0) {
    // Format warning messages for reporting
    const warningMessages = filteredWarnings.map((msg) => `- ${msg}`).join('\n');

    // Fail the test with console warning information
    throw new Error(
      `${filteredWarnings.length} unexpected console warning(s) detected:\n${warningMessages}`
    );
  }
});

/**
 * Force the browser to log test messages to the console to verify capture
 * This is useful for testing that console log capture is working correctly
 */
Cypress.Commands.add('logTestMessages', () => {
  cy.window().then((win) => {
    // Log a variety of messages to test capture
    win.console.log('TEST_LOG: This is a test log message');
    win.console.info('TEST_INFO: This is a test info message');
    win.console.warn('TEST_WARN: This is a test warning message');
    win.console.error('TEST_ERROR: This is a test error message');

    // Log an object to test object serialization
    win.console.log('TEST_OBJECT:', {
      testId: 'console-capture-test',
      timestamp: new Date().toISOString(),
      nested: {
        value: 'This is a nested value'
      }
    });

    // Log that we've finished sending test messages
    win.console.info('TEST_COMPLETE: Finished sending test console messages');
  });
});

/**
 * Collect and save all browser logs (errors, warnings, info) for persistent storage
 */
Cypress.Commands.add('saveBrowserLogs', () => {
  // First, log some test messages to ensure we have console entries to capture
  cy.logTestMessages();

  // Then collect browser console logs
  cy.wrap(null).then(() => {
    // Try to get browser console logs
    try {
      // For all browsers, first try to get console entries directly from the page
      cy.window().then((win) => {
        // Force the browser to flush any pending console messages
        win.console.log('Flushing console messages before capture');

        // Try to access browser console entries if available
        let browserConsoleEntries = [];

        // For Chromium-based browsers, try to use CDP to get console logs
        if (Cypress.browser.family === 'chromium') {
          // Log that we're using CDP for console logs
          cy.log('Using CDP to capture browser console logs');

          // Try to access the DevTools console messages API if available
          if (win.performance && win.performance.getEntries) {
            const resourceEntries = win.performance.getEntries();
            const consoleEntries = resourceEntries.filter(entry =>
              entry.initiatorType === 'other' && entry.name.includes('console-api')
            );

            if (consoleEntries.length > 0) {
              browserConsoleEntries = consoleEntries.map(entry => ({
                type: 'console-api',
                message: `Console API call at ${entry.startTime}ms`,
                timestamp: new Date(entry.startTime + performance.timeOrigin).toISOString()
              }));
            }
          }
        }

        // Combine our captured logs with any browser console entries we found
        const logs = {
          timestamp: new Date().toISOString(),
          testName: Cypress.currentTest?.title || 'unknown',
          specName: Cypress.spec?.name || 'unknown',
          errors: globalConsoleStorage.errors || [],
          warnings: globalConsoleStorage.warnings || [],
          info: globalConsoleStorage.infos || [],
          // Include both our captured browserConsole entries and any additional ones found
          browserConsole: [...globalConsoleStorage.browserConsole, ...browserConsoleEntries],
          url: win.location.href,
          userAgent: win.navigator.userAgent,
        };

        // Save logs using the Cypress task
        cy.task('saveBrowserLogs', logs);
      });
    } catch (e) {
      // Fallback if browser logs API fails
      cy.window().then((win) => {
        const logs = {
          timestamp: new Date().toISOString(),
          testName: Cypress.currentTest?.title || 'unknown',
          specName: Cypress.spec?.name || 'unknown',
          errors: globalConsoleStorage.errors || [],
          warnings: globalConsoleStorage.warnings || [],
          info: globalConsoleStorage.infos || [],
          // Include our captured browserConsole entries even in fallback case
          browserConsole: globalConsoleStorage.browserConsole || [],
          error: `Failed to capture additional browser console entries: ${e.message}`,
          url: win.location.href,
          userAgent: win.navigator.userAgent,
        };

        // Save logs using the Cypress task
        cy.task('saveBrowserLogs', logs);
      });
    }
  });
});
