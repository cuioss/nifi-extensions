// Test processor functionality with simplified commands
describe('Processor Functionality Test', () => {
  it('should verify canvas access and attempt to add processor', () => {
    cy.nifiLogin();
    cy.verifyCanvasAccessible();
    
    // Take a screenshot to see the current state
    cy.screenshot('canvas-accessible');
    
    // Try to add our custom processor
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator');
    
    // Take another screenshot to see what happened
    cy.screenshot('after-add-processor-attempt');
  });
});
