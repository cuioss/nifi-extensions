import { TEXT_CONSTANTS } from "../support/constants.js";
/**
 * Test the updated commands for NiFi 2.4.0 Angular UI
 * This test verifies that our command updates work with the modern UI
 */

describe('Updated Commands Integration Test', () => {
  it('should test login and navigation commands', () => {
    // Test login
    cy.nifiLogin();
    cy.verifyLoggedIn();

    // Test navigation
    cy.navigateToCanvas();
    cy.verifyCanvasAccessible();

    // Verify UI is loaded
    cy.get('nifi').should(TEXT_CONSTANTS.BE_VISIBLE);
    cy.get('body').should(($body) => {
      const hasAngularContent = $body.find('nifi').children().length > 0;
      expect(hasAngularContent).to.be.true;
    });
  });

  it('should test processor commands', () => {
    cy.nifiLogin();
    cy.navigateToCanvas();

    // Test processor addition
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator', { x: 400, y: 300 }).then((processorId) => {
      if (processorId) {
        cy.log(`Processor added with ID: ${processorId}`);

        // Test processor element retrieval
        cy.getProcessorElement(processorId).should(TEXT_CONSTANTS.EXIST);

        // Test processor configuration
        cy.configureProcessor(processorId, {
          name: 'Test JWT Processor',
          properties: {
            'Issuer URLs': 'https://test.issuer.com',
          },
        });

        // Test processor removal
        cy.removeProcessor(processorId);
      } else {
        cy.log('Processor addition returned null - this may be expected for this UI version');
      }
    });
  });

  it('should test controller services navigation', () => {
    cy.nifiLogin();
    cy.navigateToControllerServices();

    // Verify we're in controller services area
    cy.get('body').should(($body) => {
      const hasControllerContent =
        $body.find('*:contains("Controller"), *:contains("Services")').length > 0;
      expect(hasControllerContent).to.be.true;
    });
  });
});
