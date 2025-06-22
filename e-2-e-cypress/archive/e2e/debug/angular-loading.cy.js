/**
 * Better NiFi loading test that waits for Angular to initialize
 */

describe('NiFi Angular Loading', () => {
  it('should wait for NiFi Angular app to fully initialize', () => {
    cy.log('🚀 Loading NiFi...');

    // Visit the page
    cy.visit('/', {
      failOnStatusCode: false,
      timeout: 60000,
    });

    // Wait for the basic HTML structure
    cy.get('body').should('exist');
    cy.get('nifi').should('exist');

    // Wait for Angular to bootstrap - look for Angular specific elements or classes
    // NiFi typically adds classes or data attributes when Angular is ready
    cy.get('nifi', { timeout: 120000 }).should(($nifi) => {
      // Angular usually adds attributes or child elements when bootstrapped
      const hasAngularContent =
        $nifi.children().length > 0 ||
        $nifi.find('*').length > 0 ||
        $nifi.attr('ng-version') ||
        $nifi.hasClass('ng-') ||
        $nifi.find('[class*="ng-"]').length > 0;

      if (!hasAngularContent) {
        // If no Angular content yet, check for loading indicators
        const hasLoadingContent =
          $nifi.text().includes('Loading') ||
          $nifi.find('.loading, .spinner, [class*="load"]').length > 0;

        if (!hasLoadingContent) {
          throw new Error('NiFi element exists but Angular app may not be initializing');
        }
      }
    });

    // Alternative: wait for any child elements to appear in nifi
    cy.get('nifi').children().should('have.length.gt', 0);

    cy.log('✅ NiFi Angular app appears to be initialized');
  });
});
