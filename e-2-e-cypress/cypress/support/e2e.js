// ***********************************************************
// This file supports/e2e.js is processed and loaded automatically
// before your test files.
//
// This is a great place to put global configuration and behavior
// that modifies Cypress.
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Import console error tracking
import './console-error-tracking';

// Set uncaught exception behavior with fail-fast
Cypress.on('uncaught:exception', (err) => {
  // Log the error for debugging purposes
  // eslint-disable-next-line no-console
  console.error('Uncaught exception:', err.message);

  // For fail-fast behavior, we can be more selective about which errors to ignore
  // Only ignore specific known issues, fail on everything else
  const ignoredErrors = [
    'ResizeObserver loop limit exceeded', // Common browser issue
    'Non-Error promise rejection captured', // Angular/NiFi specific
  ];

  const shouldIgnore = ignoredErrors.some((ignoredError) => err.message.includes(ignoredError));

  // Return false to ignore known issues, true to fail fast on unexpected errors
  return !shouldIgnore;
});

// Global fail-fast configuration
beforeEach(() => {
  // Set shorter timeout for individual commands within tests
  Cypress.config('defaultCommandTimeout', 10000);

  // Fail fast on viewport issues
  cy.viewport(1280, 720);

  // Start test timer for fail-fast behavior
  cy.startTestTimer();
});

// After each test, verify and fail fast on console issues
afterEach(() => {
  // End test timer
  cy.endTestTimer();

  // These verifications will fail fast if issues are detected
  cy.verifyNoConsoleErrors();
  cy.verifyNoUnexpectedWarnings();
});
