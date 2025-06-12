/**
 * Simplified NiFi Login Commands - HTTP Anonymous Access
 * Based on authentication analysis showing anonymous access is enabled
 */

/**
 * Simplified login for HTTP anonymous access mode
 * No authentication required - just ensure NiFi Angular app loads
 */
Cypress.Commands.add('nifiLogin', () => {
  cy.visit('/nifi');
  
  // Wait for Angular app to load - this is the only requirement
  cy.get('nifi', { timeout: 30000 }).should('exist');
  
  // Wait for app initialization
  cy.wait(2000);
  
  // Verify main UI is ready
  cy.get('body').should('be.visible');
});

/**
 * Verify we're in the main NiFi application
 * Simplified to just check for Angular app presence
 */
Cypress.Commands.add('verifyLoggedIn', () => {
  cy.get('nifi').should('exist');
  cy.url().should('include', '/nifi');
});

/**
 * Ensure authenticated and ready - simplified version
 * Since authentication is not required, just verify app accessibility
 */
Cypress.Commands.add('ensureAuthenticatedAndReady', () => {
  // Check if we're already on NiFi, if not, navigate
  cy.url().then((url) => {
    if (!url.includes('/nifi')) {
      cy.nifiLogin();
    } else {
      // Just verify the app is still accessible
      cy.get('nifi').should('exist');
    }
  });
});

/**
 * Alternative minimal login command that just verifies access
 */
Cypress.Commands.add('accessNiFi', () => {
  cy.visit('/nifi');
  cy.get('nifi', { timeout: 30000 }).should('exist');
});

module.exports = {
  // Export for testing
  isAnonymousMode: true,
  authRequired: false,
  loginMethod: 'anonymous-access'
};
