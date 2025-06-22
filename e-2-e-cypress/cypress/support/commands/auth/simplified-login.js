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
  cy.visit('/', {
    failOnStatusCode: false,
    timeout: 60000,
  });

  // Wait for the basic elements to load
  cy.log('⏳ Waiting for NiFi element...');
  cy.get('nifi', { timeout: 30000 }).should('exist');

  // Wait for Angular app to initialize by checking for child elements
  cy.log('⏳ Waiting for NiFi Angular app to initialize...');
  cy.get('nifi').children().should('have.length.gt', 0);

  // Verify we have a functional page
  cy.log('✅ NiFi app loaded successfully');
  cy.get('body').should('be.visible');

  cy.log('🎉 NiFi access complete!');
});

/**
 * Verify we're in the main NiFi application
 * Simplified to just check for Angular app presence
 */
Cypress.Commands.add('verifyLoggedIn', () => {
  cy.get('nifi').should('exist');
  cy.get('nifi').children().should('have.length.gt', 0);
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
      cy.get('nifi').children().should('have.length.gt', 0);
    }
  });
});

/**
 * Alternative minimal login command that just verifies access
 */
Cypress.Commands.add('accessNiFi', () => {
  cy.visit('/');
  cy.get('nifi', { timeout: 30000 }).should('exist');
  cy.get('nifi').children().should('have.length.gt', 0);
});

/**
 * Quick login check - optimized version for anonymous access
 */
Cypress.Commands.add('quickLoginCheck', () => {
  cy.log('🔍 Quick login check for anonymous access...');

  // Just check if we're already on NiFi and the app element exists
  cy.url().then((url) => {
    if (!url.includes('/nifi')) {
      cy.nifiLogin();
    } else {
      // Quick verification that NiFi is still accessible
      cy.get('nifi', { timeout: 10000 }).should('exist');
      cy.get('nifi').children().should('have.length.gt', 0);
      cy.log('✅ Quick login check passed - NiFi accessible');
    }
  });
});

/**
 * Verify anonymous access is working
 */
Cypress.Commands.add('verifyAnonymousAccess', () => {
  cy.log('🔓 Verifying anonymous access...');

  // Navigate to NiFi and verify no login prompt appears
  cy.visit('/', {
    failOnStatusCode: false,
    timeout: 60000,
  });

  // Should be able to access NiFi directly without authentication
  cy.get('nifi', { timeout: 30000 }).should('exist');
  cy.get('nifi').children().should('have.length.gt', 0);

  // Verify we're not redirected to a login page
  cy.url().should('include', '/nifi');
  cy.url().should('not.include', 'login');

  cy.log('✅ Anonymous access verified');
});

module.exports = {
  // Export for testing
  isAnonymousMode: true,
  authRequired: false,
  loginMethod: 'anonymous-access',
};
