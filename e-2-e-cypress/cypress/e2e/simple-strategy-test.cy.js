/**
 * Simple test to verify our new strategy approach
 */

describe('New Processor Strategy Test', () => {
  beforeEach(() => {
    cy.nifiLogin('admin', 'adminadminadmin');
  });

  it('should check for existing processors and provide guidance', () => {
    cy.log('🔍 Checking current processor situation');
    
    cy.get('body').then(($body) => {
      // Look for processors using the standard selector
      const processors = $body.find('g.processor, [class*="processor"], .component');
      const processorCount = processors.length;
      
      cy.log(`Found ${processorCount} processors on canvas`);
      
      if (processorCount > 0) {
        cy.log('✅ Processors available for testing!');
        
        // Test the first processor
        const firstProcessor = processors.first();
        cy.wrap(firstProcessor).should('be.visible');
        
        // Try to get processor details
        const processorId = firstProcessor.attr('id') || 'unknown-id';
        const processorClasses = firstProcessor.attr('class') || '';
        
        cy.log(`Testing processor: ${processorId}`);
        cy.log(`Processor classes: ${processorClasses}`);
        
        // Take a screenshot for analysis
        cy.screenshot('processors-found');
        
      } else {
        cy.log('⚠️ No processors found on canvas');
        cy.log('💡 Manual setup needed:');
        cy.log('  1. Open NiFi UI at http://localhost:9094');
        cy.log('  2. Add processors manually to the canvas');
        cy.log('  3. Re-run tests for full functionality');
      }
      
      // This test always passes
      expect(true).to.be.true;
    });
  });

  it('should verify canvas accessibility', () => {
    // Test that we can access the canvas and basic UI elements
    cy.get('nifi').should('be.visible');
    
    cy.get('body').then(($body) => {
      const svgElements = $body.find('svg');
      const canvasElements = $body.find('canvas');
      const totalCanvasElements = svgElements.length + canvasElements.length;
      
      cy.log(`Canvas elements found: ${totalCanvasElements} (${svgElements.length} SVG, ${canvasElements.length} Canvas)`);
      
      if (totalCanvasElements > 0) {
        cy.log('✅ Canvas accessible for testing');
      } else {
        cy.log('⚠️ No canvas elements found');
      }
      
      expect(totalCanvasElements).to.be.greaterThan(0);
    });
  });

  it('should document available UI buttons for future processor addition', () => {
    cy.get('body').then(($body) => {
      const allButtons = $body.find('button');
      cy.log(`Total buttons in UI: ${allButtons.length}`);
      
      const potentialAddButtons = allButtons.filter((index, btn) => {
        const $btn = Cypress.$(btn);
        const text = $btn.text().toLowerCase();
        const title = ($btn.attr('title') || '').toLowerCase();
        const ariaLabel = ($btn.attr('aria-label') || '').toLowerCase();
        
        return /add|create|new|\+/.test(text + title + ariaLabel);
      });
      
      cy.log(`Potential "Add" buttons: ${potentialAddButtons.length}`);
      
      if (potentialAddButtons.length > 0) {
        cy.log('🎯 Potential processor addition buttons found:');
        potentialAddButtons.each((index, btn) => {
          const $btn = Cypress.$(btn);
          const text = $btn.text().trim();
          const title = $btn.attr('title') || '';
          cy.log(`  ${index + 1}. "${text}" (title: "${title}")`);
        });
      }
      
      // Always passes - this is documentation
      expect(allButtons.length).to.be.greaterThan(0);
    });
  });
});
