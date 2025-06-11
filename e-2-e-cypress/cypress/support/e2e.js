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

// Set uncaught exception behavior
Cypress.on('uncaught:exception', (err) => {
  // Log the error for debugging purposes
  // eslint-disable-next-line no-console
  console.error('Uncaught exception:', err.message);

  // Returning false prevents Cypress from failing the test
  // We'll handle errors through our own verification mechanisms
  return false;
});

// After each test, verify no console errors/unexpected warnings
afterEach(() => {
  cy.verifyNoConsoleErrors();
  cy.verifyNoUnexpectedWarnings();
});
