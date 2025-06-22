/**
 * Simple test using just the basic login command
 */

describe('Simple Basic Test', () => {
  it('should connect to NiFi using just nifiLogin', () => {
    // Use the basic login command directly
    cy.nifiLogin();

    // Basic verification that we're ready for testing
    cy.get('body').should('exist');
    cy.get('nifi').should('exist');

    cy.log('✅ Basic connectivity test passed!');
  });
});
