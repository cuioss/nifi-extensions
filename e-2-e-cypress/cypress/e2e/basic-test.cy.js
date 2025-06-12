// Basic connectivity test
describe('Basic Test', () => {
  it('should connect to NiFi', () => {
    cy.visit('https://localhost:9095/nifi/');
    cy.get('body').should('exist');
  });
});
