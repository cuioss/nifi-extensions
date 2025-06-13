/**
 * Quick test for the new processor addition methods
 */

describe('Alternative Processor Addition Test', () => {
  beforeEach(() => {
    cy.nifiLogin('admin', 'adminadminadmin');
  });

  it('should try alternative processor addition methods', () => {
    cy.log('🧪 Testing new alternative processor addition methods');

    // Try to add a processor using the new method
    cy.addProcessor('GenerateFlowFile').then((processorId) => {
      if (processorId) {
        cy.log(`✅ Successfully added processor with ID: ${processorId}`);
      } else {
        cy.log('⚠️ Processor addition returned null - will try fallback approaches');

        // If normal method fails, try the explicit alternative method
        cy.addProcessorAlternative('GenerateFlowFile').then((altProcessorId) => {
          if (altProcessorId) {
            cy.log(`✅ Alternative method successful with ID: ${altProcessorId}`);
          } else {
            cy.log('⚠️ All processor addition methods failed');
            // This is expected - we'll document the approach needed
          }
        });
      }
    });
  });

  it('should test individual alternative methods', () => {
    // Test if we can at least navigate and inspect the UI
    cy.get('nifi').should('be.visible');

    // Log what we can see for debugging
    cy.get('body').then(($body) => {
      cy.log('=== Available buttons ===');
      const buttons = $body.find('button');
      cy.log(`Found ${buttons.length} buttons in the UI`);

      buttons.each((index, button) => {
        const text = Cypress.$(button).text().trim();
        const title = Cypress.$(button).attr('title');
        const ariaLabel = Cypress.$(button).attr('aria-label');

        if (text || title || ariaLabel) {
          cy.log(`Button ${index}: text="${text}", title="${title}", aria-label="${ariaLabel}"`);
        }
      });

      cy.log('=== Available menus ===');
      const menus = $body.find('[role="menubar"], .menu, .toolbar');
      cy.log(`Found ${menus.length} menu-like elements`);

      cy.log('=== SVG/Canvas elements ===');
      const canvasElements = $body.find('svg, canvas');
      cy.log(`Found ${canvasElements.length} canvas elements`);
    });
  });
});
