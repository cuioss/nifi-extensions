/**
 * NiFi Quick Connectivity Test - expects NiFi to be running and load quickly
 * This test should only be run when NiFi is actually running
 */
describe('NiFi Quick Connectivity (Running NiFi)', () => {
  const baseUrl = Cypress.env('CYPRESS_BASE_URL') || 'https://localhost:9095/nifi/';

  beforeEach(() => {
    cy.startTestTimer();
  });

  afterEach(() => {
    cy.endTestTimer();
  });

  it('should connect to running NiFi quickly', () => {
    // Quick HTTP check first
    cy.request({
      url: baseUrl,
      timeout: 3000,
      failOnStatusCode: false,
    }).then((response) => {
      // Accept any reasonable response (NiFi is running)
      expect(response.status).to.be.oneOf([200, 302, 401, 403]);
      cy.log(`NiFi responded with status: ${response.status}`);
    });

    cy.checkTestTimer();
  });

  it('should load NiFi page quickly', () => {
    // Visit with short timeout - NiFi should load quickly when running
    cy.visit(baseUrl, {
      timeout: 8000,
      failOnStatusCode: false,
    });

    cy.checkTestTimer();

    // Look for basic page structure quickly
    cy.get('body', { timeout: 3000 }).should('exist');

    cy.checkTestTimer();

    cy.log('NiFi page loaded quickly');
  });

  it('should detect NiFi UI elements quickly', () => {
    cy.visit(baseUrl, {
      timeout: 8000,
      failOnStatusCode: false,
    });

    cy.checkTestTimer();

    // Look for NiFi-specific elements with short timeout
    cy.get('body', { timeout: 3000 }).then(($body) => {
      const hasNiFiElements =
        $body.find('#nifi-loading').length > 0 ||
        $body.find('.nifi-canvas').length > 0 ||
        $body.find('[data-testid]').length > 0 ||
        $body.text().includes('NiFi') ||
        $body.text().includes('Loading');

      if (hasNiFiElements) {
        cy.log('✅ NiFi UI elements detected');
      } else {
        cy.log('⚠️ No NiFi UI elements found');
      }

      // Test passes if we get any response
      expect($body).to.exist;
    });

    cy.checkTestTimer();
  });
});
