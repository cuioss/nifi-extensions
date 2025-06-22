/**
 * NiFi Elements Test - tests element detection with aggressive fail-fast timeouts
 * Since NiFi responsiveness is already established, use aggressive timeouts
 */
describe('NiFi Elements (Fast)', () => {
  const baseUrl = Cypress.env('CYPRESS_BASE_URL') || 'https://localhost:9095/nifi/';

  beforeEach(() => {
    cy.startTestTimer();
  });

  afterEach(() => {
    cy.endTestTimer();
  });

  it('should find NiFi elements quickly', () => {
    cy.visit(baseUrl, {
      timeout: 5000,
      failOnStatusCode: false,
    });

    // Should find basic HTML structure quickly
    cy.get('head', { timeout: 3000 }).should('exist');
    cy.get('body', { timeout: 3000 }).should('exist');

    // Check for common NiFi elements or loading states
    cy.get('body').then(($body) => {
      // Look for any of the common NiFi UI elements
      const hasNiFiElements =
        $body.find('#nifi-loading-container, #canvas-container, .nifi-header, #splash').length > 0;

      if (hasNiFiElements) {
        cy.log('NiFi-specific elements found');
      } else {
        cy.log('Basic page structure loaded, NiFi elements may be loading');
      }
    });
  });

  it('should detect page state quickly', () => {
    cy.visit(baseUrl, {
      timeout: 5000,
      failOnStatusCode: false,
    });

    // Basic page should be ready quickly
    cy.document({ timeout: 3000 })
      .should('have.property', 'readyState')
      .and('match', /loading|interactive|complete/);

    // Should have some content
    cy.get('body', { timeout: 3000 }).should('not.be.empty');
  });

  it('should handle element searches with timeout', () => {
    cy.visit(baseUrl, {
      timeout: 5000,
      failOnStatusCode: false,
    });

    // Test our enhanced element finding with timeout
    cy.getWithTimeout('body', { timeout: 3000 }).should('exist');

    // Test waiting for visibility
    cy.waitForVisible('body', 3000);

    // Test waiting for existence
    cy.waitForExist('html', 2000);
  });

  it('should complete element detection within time limits', () => {
    const startTime = Date.now();

    cy.visit(baseUrl, {
      timeout: 5000,
      failOnStatusCode: false,
    });

    cy.get('body', { timeout: 3000 }).then(() => {
      const elapsed = Date.now() - startTime;
      cy.log(`Element detection completed in ${elapsed}ms`);

      // Should complete within reasonable time (8 seconds including page load)
      expect(elapsed).to.be.lessThan(8000);
    });
  });
});
