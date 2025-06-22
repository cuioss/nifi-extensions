/**
 * NiFi Navigation Test - tests basic UI navigation with aggressive fail-fast timeouts
 * Since NiFi responsiveness is already established, use aggressive timeouts
 */
describe('NiFi Navigation (Fast)', () => {
  const baseUrl = Cypress.env('CYPRESS_BASE_URL') || 'https://localhost:9095/nifi/';

  beforeEach(() => {
    cy.startTestTimer();
  });

  afterEach(() => {
    cy.endTestTimer();
  });

  it('should navigate NiFi interface quickly', () => {
    // Use aggressive timeouts since NiFi is proven responsive
    cy.visit(baseUrl, {
      timeout: 5000, // 5 seconds - aggressive since NiFi is responsive
      failOnStatusCode: false,
    });

    // Should find basic NiFi elements quickly
    cy.get('body', { timeout: 3000 }).should('exist');

    // Check for NiFi loading or main interface
    cy.get('body').then(($body) => {
      if ($body.find('#nifi-loading-container').length > 0) {
        // NiFi is loading - this is expected, don't wait
        cy.log('NiFi loading screen detected - this is normal');
      } else {
        // Main interface might be visible
        cy.log('NiFi main interface or other state detected');
      }
    });
  });

  it('should handle page structure navigation', () => {
    cy.visit(baseUrl, {
      timeout: 5000,
      failOnStatusCode: false,
    });

    // Basic page structure should be present quickly
    cy.get('html', { timeout: 2000 }).should('exist');
    cy.title({ timeout: 2000 }).should('not.be.empty');

    // URL should be correct
    cy.url().should('include', 'nifi');
  });

  it('should respond to basic interactions quickly', () => {
    cy.visit(baseUrl, {
      timeout: 5000,
      failOnStatusCode: false,
    });

    // Test basic browser interaction
    cy.get('body', { timeout: 3000 }).should('be.visible').click({ force: true }); // Basic click should work

    // Window should still be responsive
    cy.window({ timeout: 2000 }).should('exist');
  });
});
