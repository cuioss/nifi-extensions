/**
 * Simplified NiFi Login Commands - HTTP Anonymous Access
 * Based on authentication analysis showing anonymous access is enabled
 */

/**
 * Simplified login for HTTP anonymous access mode
 * No authentication required - just ensure NiFi Angular app loads
 */
Cypress.Commands.add('nifiLogin', () => {
  cy.log('🚀 Starting NiFi access...');

  // Use visit with optimized settings for slow-loading NiFi
  cy.visit('/nifi', {
    failOnStatusCode: false,
    timeout: 180000, // 3 minutes for slow startup
  });

  // Use a more patient wait strategy
  cy.log('⏳ Waiting for NiFi Angular app to load...');
  cy.get('nifi', { timeout: 120000 }).should('exist');

  // Verify we have a functional page
  cy.log('✅ NiFi app element found, verifying page functionality...');
  cy.get('body').should('be.visible');

  cy.log('🎉 NiFi access complete!');
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
  loginMethod: 'anonymous-access',
};
