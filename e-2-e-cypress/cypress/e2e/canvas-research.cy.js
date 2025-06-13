/**
 * Canvas interaction research test
 */

describe('Canvas Research', () => {
  beforeEach(() => {
    cy.nifiLogin('admin', 'adminadminadmin');
  });

  it('should document current UI state', () => {
    cy.get('body').then(($body) => {
      // Create summary of what we find
      const summary = {
        svgElements: $body.find('svg').length,
        canvasElements: $body.find('canvas').length,
        buttons: $body.find('button').length,
        matElements: $body.find('[class*="mat-"]').length,
        addButtons: $body.find('button:contains("Add"), button:contains("+")').length,
      };
      
      cy.log('UI Summary:', JSON.stringify(summary));
      
      // Test if double-click works
      if (summary.svgElements > 0) {
        cy.get('svg').first().dblclick({ force: true });
        cy.wait(1000);
        
        cy.get('body').then(($afterClick) => {
          const dialogsAfterClick = $afterClick.find('[role="dialog"], .mat-dialog-container').length;
          cy.log(`Dialogs after double-click: ${dialogsAfterClick}`);
          
          // If no dialog appeared, this confirms the issue
          if (dialogsAfterClick === 0) {
            cy.log('CONFIRMED: Double-click on SVG does not trigger add processor dialog');
          }
        });
      }
    });
  });

  it('should find alternative ways to add processors', () => {
    // Check for toolbar buttons
    cy.get('button').contains('Processor').should('exist').click();
    cy.wait(1000);
    
    cy.get('body').then(($body) => {
      const dialogs = $body.find('[role="dialog"], .mat-dialog-container').length;
      cy.log(`Dialogs after toolbar click: ${dialogs}`);
    });
  });
});
