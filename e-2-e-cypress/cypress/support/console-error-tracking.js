import allowedWarnings from './console-warnings-allowlist.js';
import { formatConsoleArgs } from './utils.js';

/**
 * Tracks console errors during test execution and reports them as test failures
 * unless they match entries in the allowed warnings list.
 */
Cypress.on('window:before:load', (win) => {
  // Store original console methods
  const originalConsole = {
    error: win.console.error,
    warn: win.console.warn,
    info: win.console.info,
    log: win.console.log,
  };

  // Collection of console errors/warnings/info
  win.consoleErrors = [];
  win.consoleWarnings = [];
  win.consoleInfos = [];

  // Override console.error
  /**
   *
   * @param {...any} args
   * @example
   */
  win.console.error = (...args) => {
    // Call original console.error
    originalConsole.error(...args);

    // Store the error message
    const message = formatConsoleArgs(...args);

    win.consoleErrors.push(message);
  };

  // Override console.warn
  /**
   *
   * @param {...any} args
   * @example
   */
  win.console.warn = (...args) => {
    // Call original console.warn
    originalConsole.warn(...args);

    // Store the warning message
    const message = formatConsoleArgs(...args);

    // Only track warnings not in the allowlist
    if (!allowedWarnings.some((allowedMsg) => message.includes(allowedMsg))) {
      win.consoleWarnings.push(message);
    }
  };

  // Override console.info and console.log for comprehensive logging
  /**
   *
   * @param {...any} args
   * @example
   */
  win.console.info = (...args) => {
    // Call original console.info
    originalConsole.info(...args);

    // Store the info message
    const message = formatConsoleArgs(...args);

    win.consoleInfos.push({ type: 'info', message, timestamp: new Date().toISOString() });
  };

  /**
   *
   * @param {...any} args
   * @example
   */
  win.console.log = (...args) => {
    // Call original console.log
    originalConsole.log(...args);

    // Store the log message
    const message = formatConsoleArgs(...args);

    win.consoleInfos.push({ type: 'log', message, timestamp: new Date().toISOString() });
  };
});

/**
 * Verify no console errors occurred during the test
 */
Cypress.Commands.add('verifyNoConsoleErrors', () => {
  cy.window().then((win) => {
    const errors = win.consoleErrors || [];

    if (errors.length > 0) {
      // Format error messages for reporting
      const errorMessages = errors.map((msg) => `- ${msg}`).join('\n');

      // Fail the test with console error information
      throw new Error(`${errors.length} console error(s) detected:\n${errorMessages}`);
    }
  });
});

/**
 * Verify no unexpected console warnings occurred during the test
 */
Cypress.Commands.add('verifyNoUnexpectedWarnings', () => {
  cy.window().then((win) => {
    const warnings = win.consoleWarnings || [];

    if (warnings.length > 0) {
      // Format warning messages for reporting
      const warningMessages = warnings.map((msg) => `- ${msg}`).join('\n');

      // Fail the test with console warning information
      throw new Error(
        `${warnings.length} unexpected console warning(s) detected:\n${warningMessages}`
      );
    }
  });
});

/**
 * Collect and save all browser logs (errors, warnings, info) for persistent storage
 */
Cypress.Commands.add('saveBrowserLogs', () => {
  cy.window().then((win) => {
    const logs = {
      timestamp: new Date().toISOString(),
      testName: Cypress.currentTest?.title || 'unknown',
      specName: Cypress.spec?.name || 'unknown',
      errors: win.consoleErrors || [],
      warnings: win.consoleWarnings || [],
      info: win.consoleInfos || [],
      url: win.location.href,
      userAgent: win.navigator.userAgent,
    };

    // Save logs using the Cypress task
    cy.task('saveBrowserLogs', logs);
  });
});
