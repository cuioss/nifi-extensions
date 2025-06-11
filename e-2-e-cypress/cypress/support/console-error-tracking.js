const allowedWarnings = require('./console-warnings-allowlist');

/**
 * Tracks console errors during test execution and reports them as test failures
 * unless they match entries in the allowed warnings list.
 */
Cypress.on('window:before:load', (win) => {
  // Store original console methods
  const originalConsole = {
    error: win.console.error,
    warn: win.console.warn,
  };

  // Collection of console errors/warnings
  win.consoleErrors = [];
  win.consoleWarnings = [];

  // Override console.error
  win.console.error = (...args) => {
    // Call original console.error
    originalConsole.error(...args);

    // Store the error message
    const message = args
      .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
      .join(' ');

    win.consoleErrors.push(message);
  };

  // Override console.warn
  win.console.warn = (...args) => {
    // Call original console.warn
    originalConsole.warn(...args);

    // Store the warning message
    const message = args
      .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
      .join(' ');

    // Only track warnings not in the allowlist
    if (!allowedWarnings.some((allowedMsg) => message.includes(allowedMsg))) {
      win.consoleWarnings.push(message);
    }
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
