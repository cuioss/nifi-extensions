// ***********************************************************
// This file supports/e2e.js is processed and loaded automatically
// before your test files.
//
// This is a great place to put global configuration and behavior
// that modifies Cypress.
// ***********************************************************

// Import shared constants
import { IGNORED_ERROR_PATTERNS } from './constants';

// Import commands.js using ES2015 syntax:
import './commands';

// Import mock commands for mocked testing (commented out for Phase 0 analysis)
// import '../todo/mock-commands';

// Console error tracking provides saveBrowserLogs, verifyNoConsoleErrors, verifyNoUnexpectedWarnings
import './console-error-tracking';

// Set uncaught exception behavior with fail-fast
Cypress.on('uncaught:exception', (err) => {
  // Log the error for debugging purposes
  // eslint-disable-next-line no-console
  console.error('Uncaught exception:', err.message);

  // For fail-fast behavior, we can be more selective about which errors to ignore
  // Only ignore specific known issues, fail on everything else
  const shouldIgnore = IGNORED_ERROR_PATTERNS.some((ignoredError) =>
    err.message.includes(ignoredError)
  );

  // Return false to ignore known issues, true to fail fast on unexpected errors
  return !shouldIgnore;
});

// Global fail-fast configuration is handled by cypress.config.js
// Timeouts, retries, and exit behavior are set there

beforeEach(() => {
  // Set shorter timeout for individual commands within tests
  Cypress.config('defaultCommandTimeout', 10000);

  // Fail fast on viewport issues
  cy.viewport(1280, 720);
});

// After each test, save logs and verify no console issues
afterEach(() => {
  // Save browser logs for persistent storage (always, regardless of test outcome)
  cy.saveBrowserLogs();

  // These verifications will fail fast if issues are detected
  cy.verifyNoConsoleErrors();
  cy.verifyNoUnexpectedWarnings();
});
