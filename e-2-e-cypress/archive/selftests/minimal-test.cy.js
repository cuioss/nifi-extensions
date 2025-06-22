/**
 * Minimal test to verify basic NiFi connectivity
 */
describe('Minimal NiFi Connectivity Test', () => {
  const baseUrl = Cypress.env('CYPRESS_BASE_URL') || 'https://localhost:9095/nifi/';

  it('should be able to make HTTP request to NiFi', () => {
    cy.request({
      url: baseUrl,
      timeout: 10000,
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.contain('NiFi');
    });
  });

  it('should be able to visit NiFi homepage', () => {
    cy.visit(baseUrl, { timeout: 30000 });
    cy.get('body', { timeout: 30000 }).should('exist');
  });
});
