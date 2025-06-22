/**
 * Ultra-minimal self-test - no NiFi dependencies
 * This test ensures Cypress itself is working
 */
describe('Cypress Basic Functionality', () => {
  it('should run basic Cypress assertions', () => {
    expect(true).to.be.true;
    expect(1 + 1).to.equal(2);
    expect('hello').to.include('hell');
  });

  it('should handle basic DOM operations', () => {
    // Test with a simple page that we know will work
    cy.visit('about:blank');

    // Verify we can interact with the document
    cy.document().should('exist');
    cy.title().should('exist');
  });

  it('should handle basic wait operations', () => {
    cy.wait(100); // Very short wait
    cy.wrap(Promise.resolve('success')).should('equal', 'success');
  });
});
