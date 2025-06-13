/**
 * Debug test to understand canvas interaction and dialog triggers
 */

describe('Canvas Interaction Debug', () => {
  beforeEach(() => {
    cy.nifiLogin('admin', 'adminadminadmin');
  });

  it('should inspect canvas elements', () => {
    cy.get('body').then(($body) => {
      cy.log('=== Canvas-like elements ===');
      const canvasElements = $body.find('svg, canvas, [role="main"], .flow-canvas, .nifi-canvas, .canvas-container');
      cy.log(`Canvas elements found: ${canvasElements.length}`);
      
      cy.log('=== SVG elements ===');
      const svgElements = $body.find('svg');
      cy.log(`SVG elements found: ${svgElements.length}`);
      
      cy.log('=== Button elements ===');
      const buttons = $body.find('button');
      cy.log(`Buttons found: ${buttons.length}`);
    });
  });

  it('should test canvas double-click', () => {
    cy.get('svg').first().should('exist').then(($svg) => {
      cy.log(`Testing double-click on SVG: ${$svg.attr('class')}`);
      cy.wrap($svg).dblclick({ force: true });
      
      cy.wait(2000);
      
      cy.get('body').then(($body) => {
        const dialogs = $body.find('[role="dialog"], .mat-dialog-container, .dialog');
        cy.log(`Dialogs found: ${dialogs.length}`);
      });
    });
  });

  it('should look for add buttons', () => {
    cy.get('body').then(($body) => {
      const addButtons = $body.find('button:contains("Add"), button:contains("+")');
      cy.log(`Add buttons found: ${addButtons.length}`);
    });
  });
});
