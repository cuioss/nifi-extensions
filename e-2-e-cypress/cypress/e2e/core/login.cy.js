// Test the robust login pattern
describe('Login Test', () => {
  it('should use robust login pattern successfully', () => {
    // Use the working login approach
    cy.nifiLogin();

    // Verify login state
    cy.verifyLoggedIn();

    cy.screenshot('robust-login-success');
  });

  it('should detect existing login state', () => {
    // First login
    cy.nifiLogin();

    // Verify we're authenticated
    cy.verifyLoggedIn();
  });
});
