// ***********************************************
// This file will be imported in support/e2e.js
// which will be processed before the test files
// ***********************************************

// Current implementation uses direct Cypress commands in tests
// All custom commands have been archived to cypress/support/archived/commands/
// 
// The active test suite (01-basic-auth-and-session.cy.js and 02-processor-availability.cy.js)
// uses only built-in Cypress commands like:
// - cy.visit(), cy.get(), cy.log(), cy.url(), cy.clearCookies(), etc.
//
// Console error tracking commands (saveBrowserLogs, verifyNoConsoleErrors, verifyNoUnexpectedWarnings)
// are defined in console-error-tracking.js and imported via e2e.js
//
// If additional custom commands are needed for future tests, they can be restored from
// the archived directory and imported here.

// No custom command imports needed for current minimal test suite
