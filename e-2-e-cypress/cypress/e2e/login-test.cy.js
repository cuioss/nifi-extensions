// Test the simplified login command
describe('Login Test', () => {
  it('should login to NiFi successfully', () => {
    cy.nifiLogin();
    cy.verifyLoggedIn();
    cy.screenshot('login-success');
  });
});
