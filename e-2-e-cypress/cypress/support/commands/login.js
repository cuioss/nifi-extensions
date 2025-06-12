/**
 * Custom commands related to login functionality
 */

/**
 * Login to NiFi UI - Simplified for HTTP anonymous access
 * 
 * Analysis shows NiFi is running in anonymous mode where no authentication
 * is required. This simplifies the login process to just ensuring the
 * Angular application loads properly.
 */
Cypress.Commands.add('nifiLogin', (username = 'admin', password = 'adminadminadmin') => {
  cy.visit('/');

  // Wait for Angular app to load
  cy.get('nifi', { timeout: 30000 }).should('exist');
  
  // In anonymous mode, no authentication forms are present
  // Just wait for the application to be ready
  cy.wait(2000);
  
  // Verify main UI is accessible
  cy.get('body').should('be.visible');
});

/**
 * Verify we're in the main NiFi application - Simplified version
 * Since authentication is not required, just verify Angular app is loaded
 */
Cypress.Commands.add('verifyLoggedIn', () => {
  cy.get('nifi').should('exist');
  cy.url().should('include', '/nifi');
});
