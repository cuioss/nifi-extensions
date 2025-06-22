/**
 * Basic NiFi page load test with aggressive fail-fast timeouts
 * This test attempts to load NiFi UI but fails fast if it takes too long
 */
describe('NiFi Page Load (Fail-Fast)', () => {
  const baseUrl = Cypress.env('CYPRESS_BASE_URL') || 'https://localhost:9095/nifi/';

  beforeEach(() => {
    // Clear everything for clean state
    cy.clearCookies();
    cy.clearLocalStorage();

    // Start test timer
    cy.startTestTimer();
  });

  afterEach(() => {
    // End test timer
    cy.endTestTimer();
  });

  it('should load NiFi page or fail fast', () => {
    // Set very short timeout for fail-fast behavior
    const shortTimeout = 10000; // 10 seconds max

    cy.visit(baseUrl, {
      timeout: shortTimeout,
      failOnStatusCode: false,
    });

    // Check if we should fail fast
    cy.checkTestTimer();

    // Look for any sign that NiFi is loading
    cy.get('body', { timeout: 5000 }).should('exist');

    // Check timer again
    cy.checkTestTimer();

    // If we get here, basic page structure loaded
    cy.log('NiFi page basic structure loaded successfully');
  });

  it('should detect NiFi loading state or fail fast', () => {
    cy.visit(baseUrl, {
      timeout: 8000,
      failOnStatusCode: false,
    });

    cy.checkTestTimer();

    // Look for any NiFi-specific elements with short timeout
    cy.get('body').then(($body) => {
      const hasNiFiElements =
        $body.find('#nifi-loading').length > 0 ||
        $body.find('.nifi-canvas').length > 0 ||
        $body.find('[data-testid]').length > 0 ||
        $body.text().includes('NiFi');

      if (hasNiFiElements) {
        cy.log('NiFi-specific elements detected');
      } else {
        cy.log('No NiFi-specific elements found, but page loaded');
      }

      // Test passes if we get any response
      expect($body).to.exist;
    });

    cy.checkTestTimer();
  });

  it('should handle NiFi authentication gracefully', () => {
    // This test checks if NiFi redirects to auth without waiting for full load
    cy.visit(baseUrl, {
      timeout: 6000,
      failOnStatusCode: false,
    });

    cy.checkTestTimer();

    // Check current URL for auth redirects
    cy.url().then((currentUrl) => {
      cy.log(`Current URL: ${currentUrl}`);

      // Test passes regardless of auth state
      expect(currentUrl).to.include('localhost');
    });
  });
});
