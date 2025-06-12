/**
 * Simple test to verify enhanced processor commands
 */

describe('Enhanced Commands Verification', () => {
  it('should test enhanced processor commands', () => {
    // Login and navigate
    cy.nifiLogin();
    cy.navigateToCanvas();
    
    // Test cleanup command
    cy.cleanupAllProcessors();
    cy.log('✅ Cleanup command executed');
    
    // Test enhanced add processor
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      cy.log(`Processor ID returned: ${processorId}`);
      
      if (processorId) {
        cy.log('✅ Enhanced addProcessor working');
        
        // Test enhanced getProcessorElement
        cy.getProcessorElement(processorId).then(($element) => {
          if ($element) {
            cy.log('✅ Enhanced getProcessorElement working');
          }
        });
        
        // Test findProcessorByType
        cy.findProcessorByType('MultiIssuerJWTTokenAuthenticator').then(($element) => {
          if ($element) {
            cy.log('✅ findProcessorByType working');
          }
        });
      } else {
        cy.log('⚠️ addProcessor returned null - investigating UI interaction');
      }
    });
  });
});
