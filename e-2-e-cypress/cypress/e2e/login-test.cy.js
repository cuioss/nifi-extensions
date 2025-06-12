// Test the robust login pattern
describe('Login Test', () => {
  it('should use robust login pattern successfully', () => {
    // Test the new robust login approach
    cy.ensureAuthenticatedAndReady();
    
    // Verify login state
    cy.verifyLoggedIn();
    
    // Verify we're ready for processor testing
    cy.verifyCanAccessProcessors();
    
    cy.screenshot('robust-login-success');
  });

  it('should detect existing login state', () => {
    // First login
    cy.ensureAuthenticatedAndReady();
    
    // Second call should detect existing state
    cy.ensureAuthenticatedAndReady(); // Should be fast - no re-login needed
    
    cy.verifyLoggedIn();
  });
});
