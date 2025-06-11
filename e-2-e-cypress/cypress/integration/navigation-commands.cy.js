/**
 * Self-verification tests for navigation commands
 * These tests verify that the custom navigation commands work correctly
 */

describe('Navigation Commands Self-Verification', () => {
  beforeEach(() => {
    // Login before each test
    cy.nifiLogin('admin', 'adminadminadmin');
  });

  it('should navigate to canvas successfully', () => {
    // Test the navigateToCanvas command
    cy.navigateToCanvas();

    // Verify we're on the canvas
    cy.get('#canvas-container').should('be.visible');
    cy.url().should('include', '/nifi');
  });

  it('should navigate to controller services', () => {
    // Test the navigateToControllerServices command
    cy.navigateToControllerServices();

    // Verify controller services dialog is open
    cy.get('.settings-dialog').should('be.visible');
    cy.get('.controller-services-tab').should('be.visible');

    // Close the dialog for cleanup
    cy.get('.settings-dialog').find('button').contains('Close').click();
  });

  it('should handle navigation to processor configuration', () => {
    // First, we need to add a processor to test navigation to its config
    cy.navigateToCanvas();

    // Add a test processor
    cy.addProcessor('GenerateFlowFile').then((processorId) => {
      // Test navigation to processor configuration
      cy.navigateToProcessorConfig(processorId);

      // Verify configuration dialog is open
      cy.get('.configuration-dialog').should('be.visible');

      // Close the dialog for cleanup
      cy.get('.configuration-dialog').find('button').contains('Cancel').click();
    });
  });

  it('should maintain UI state during navigation', () => {
    // Navigate to canvas
    cy.navigateToCanvas();
    cy.get('#canvas-container').should('be.visible');

    // Open controller services
    cy.navigateToControllerServices();
    cy.get('.settings-dialog').should('be.visible');

    // Close dialog and verify we're back on canvas
    cy.get('.settings-dialog').find('button').contains('Close').click();
    cy.get('#canvas-container').should('be.visible');
  });

  it('should handle browser back/forward navigation', () => {
    // Navigate to canvas
    cy.navigateToCanvas();

    // Navigate to a different part of NiFi
    cy.visit('/nifi/summary');
    cy.get('.summary-container').should('be.visible');

    // Use browser back
    cy.go('back');

    // Should be back on canvas
    cy.get('#canvas-container').should('be.visible');
  });
});
