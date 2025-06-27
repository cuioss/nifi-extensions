// ***********************************************
// This file will be imported in support/e2e.js
// which will be processed before the test files
// ***********************************************

// Import authentication helper with cy.session() based login/logout
import './auth-helper';

// Import navigation helper with advanced "Where Am I" patterns
import './navigation-helper';

// Import processor helper for JWT processor management
import './processor-helper';

// Console error tracking commands (saveBrowserLogs, verifyNoConsoleErrors, verifyNoUnexpectedWarnings)
// are defined in console-error-tracking.js and imported via e2e.js
//
// The active test suite now uses stateful authentication helpers:
// - cy.loginNiFi() - Login using cached session
// - cy.logoutNiFi() - Logout and clear session
// - cy.getSessionContext() - Get session information
// - cy.ensureNiFiReady() - One-stop login + validation
//
// And advanced navigation helpers:
// - cy.getPageContext() - Comprehensive "Where Am I" analysis
// - cy.navigateToPage() - Navigate with verification and retry logic
// - cy.verifyPageType() - Verify current page type
// - cy.waitForPageType() - Wait for specific page type
// - cy.navigateWithAuth() - Navigate with authentication check
//
// These commands use cy.session() for optimal performance and follow
// Cypress best practices for 2024 test isolation while avoiding redundant logins.

// All archived custom commands are available in cypress/support/archived/commands/
// and can be restored if needed for future tests.
