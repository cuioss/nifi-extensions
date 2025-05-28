// cypress/support/page-objects/nifi-canvas.js
class NifiCanvasPage {
  visit() {
    cy.visit('/'); // Assuming base URL is set in cypress.config.js and points to NiFi canvas
    this.waitForCanvasToLoad();
    return this;
  }

  waitForCanvasToLoad(timeout = 20000) {
    // Example: Wait for a known element on the canvas to be visible
    cy.get('[data-testid="flow-status-container"]', { timeout }).should('be.visible');
    // Add more checks if needed, e.g., for loading spinners to disappear
    return this;
  }

  addProcessor(processorType, offsetX = 300, offsetY = 300) {
    // This is a simplified example. Actual implementation might involve dragging from toolbar.
    // Or using key commands if available.
    // The example from the spec uses toolbar buttons:
    cy.get('[data-testid="component-toolbar"] [data-testid="add-processor-button"]').click();
    cy.get('[data-testid="processor-type-filter"]').type(processorType);
    cy.get(`[data-testid="processor-type-item"]:contains("${processorType}")`).click();
    // Assuming it adds to a default location, or one needs to click on canvas
    // If it requires clicking on canvas at specific coords:
    // cy.get('#canvas-container').click(offsetX, offsetY); 
    // Then wait for config dialog or processor to appear
    cy.get(`[data-testid="processor-component"][title*="${processorType}"]`, { timeout: 10000 }).should('be.visible');
    return this;
  }

  getProcessor(processorTitleOrId) {
    // Prefer using a more specific selector if available, e.g., data-testid for processor ID
    return cy.get(`[data-testid="processor-component"][title*="${processorTitleOrId}"]`);
  }

  openProcessorConfiguration(processorTitleOrId) {
    this.getProcessor(processorTitleOrId).rightclick();
    cy.get('[data-testid="context-menu-item"]:contains("Configure")').click();
    // Wait for config dialog to appear
    cy.get('[data-testid="processor-configuration-dialog"]', { timeout: 10000 }).should('be.visible');
    return this;
  }

  assertProcessorIsValid(processorTitleOrId) {
    // Example: Check for validation errors icon on the processor
    this.getProcessor(processorTitleOrId)
      .find('[data-testid="processor-validation-status-icon-invalid"]')
      .should('not.exist');
    return this;
  }

  navigateToAdvancedProcessorUi(processorTitleOrId) {
    this.getProcessor(processorTitleOrId).rightclick();
    // The context menu for 'Advanced' might be different based on actual UI
    cy.get('[data-testid="context-menu-item"]:contains("Advanced UI"), [data-testid="context-menu-item"]:contains("Advanced")').first().click();
    // Wait for the advanced UI to load
    // cy.get('[data-testid="advanced-ui-container"]', { timeout: 10000 }).should('be.visible');
    return this;
  }
}

export default new NifiCanvasPage();
