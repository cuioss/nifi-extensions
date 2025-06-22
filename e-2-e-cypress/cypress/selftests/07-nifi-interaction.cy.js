/**
 * NiFi Interaction Test - tests basic interactions with aggressive fail-fast timeouts
 * Since NiFi responsiveness is already established, use aggressive timeouts
 */
describe('NiFi Interaction (Fast)', () => {
  const baseUrl = Cypress.env('CYPRESS_BASE_URL') || 'https://localhost:9095/nifi/';

  beforeEach(() => {
    cy.startTestTimer();
  });

  afterEach(() => {
    cy.endTestTimer();
  });

  it('should interact with NiFi quickly', () => {
    cy.visit(baseUrl, {
      timeout: 5000,
      failOnStatusCode: false,
    });

    // Basic interaction - clicking on the page
    cy.get('body', { timeout: 3000 }).should('be.visible').click({ force: true });

    // Page should remain responsive
    cy.get('html', { timeout: 2000 }).should('exist');
  });

  it('should handle keyboard interactions', () => {
    cy.visit(baseUrl, {
      timeout: 5000,
      failOnStatusCode: false,
    });

    // Test keyboard interaction
    cy.get('body', { timeout: 3000 }).should('be.visible').type('{esc}', { force: true }); // ESC key should be safe

    // Page should still be responsive
    cy.get('body', { timeout: 2000 }).should('exist');
  });

  it('should handle window interactions', () => {
    cy.visit(baseUrl, {
      timeout: 5000,
      failOnStatusCode: false,
    });

    // Test window-level interactions
    cy.window({ timeout: 3000 }).then((win) => {
      // Basic window properties should be available
      expect(win).to.have.property('document');
      expect(win).to.have.property('location');
      expect(win.location.toString()).to.include('nifi');
    });

    // Test document interaction
    cy.document({ timeout: 2000 }).then((doc) => {
      expect(doc).to.have.property('readyState');
      expect(doc.title).to.be.a('string');
    });
  });

  it('should complete interactions within time limits', () => {
    const startTime = Date.now();

    cy.visit(baseUrl, {
      timeout: 5000,
      failOnStatusCode: false,
    });

    // Perform multiple quick interactions
    cy.get('body', { timeout: 3000 }).click({ force: true }).type('{esc}', { force: true });

    cy.window({ timeout: 2000 }).then(() => {
      const elapsed = Date.now() - startTime;
      cy.log(`All interactions completed in ${elapsed}ms`);

      // Should complete within aggressive time limit
      expect(elapsed).to.be.lessThan(8000);
    });
  });

  it('should handle conditional interactions gracefully', () => {
    cy.visit(baseUrl, {
      timeout: 5000,
      failOnStatusCode: false,
    });

    // Ensure the body element exists
    cy.get('body', { timeout: 3000 }).should('exist');

    // Test conditional interaction based on page state
    cy.get('body').then(($body) => {
      if ($body.find('#nifi-loading-container').length > 0) {
        cy.log('Interacting with loading state');
        // In loading state - minimal interaction
        cy.get('#nifi-loading-container', { timeout: 2000 }).should('be.visible');
      } else {
        cy.log('Interacting with loaded state');
        // In loaded state - more interaction possible
        cy.get('body').click({ force: true });
      }
    });
  });
});
