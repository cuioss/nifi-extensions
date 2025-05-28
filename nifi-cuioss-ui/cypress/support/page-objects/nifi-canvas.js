// cypress/support/page-objects/nifi-canvas.js
class NifiCanvasPage {
  visit() {
    // Assumes baseUrl is set in cypress.config.js to Cypress.env('nifiUrl')
    // If not, use cy.visit(Cypress.env('nifiUrl'));
    cy.visit('/'); 
    this.waitForCanvasToLoad();
    return this;
  }

  waitForCanvasToLoad(timeout = 20000) {
    cy.get('[data-testid="flow-status-container"]', { timeout }).should('be.visible');
    // Optional: Check for loading spinners to disappear
    // cy.get('.loading-spinner', { timeout }).should('not.exist');
    return this;
  }

  checkProcessorExists(processorTitleOrId, timeout = 0) {
    // Returns a chainable boolean indicating if the processor exists
    // Uses a short timeout if just checking, longer if expecting it to appear
    let shouldExist = true;
    if (timeout === 0) { // if timeout is 0, we are checking if it exists *now*
        shouldExist = Cypress.$(`[data-testid="processor-component"][title*="${processorTitleOrId}"]`).length > 0;
        return cy.wrap(shouldExist);
    }
    // If timeout > 0, wait for it to exist or not exist based on Cypress's retryability
    return cy.get('body').then($body => {
        if ($body.find(`[data-testid="processor-component"][title*="${processorTitleOrId}"]`).length > 0) {
            return cy.get(`[data-testid="processor-component"][title*="${processorTitleOrId}"]`, {timeout}).should('be.visible').then(() => true);
        }
        return cy.wrap(false);
    });
  }

  addProcessor(processorType, processorTitle = processorType, ensureUnique = false) {
    // processorTitle defaults to processorType if not provided
    // ensureUnique: if true, deletes existing processor with the same title before adding
    const add = () => {
      cy.get('[data-testid="component-toolbar"] [data-testid="add-processor-button"]').click();
      cy.get('[data-testid="processor-type-filter"]').clear().type(processorType);
      cy.get(`[data-testid="processor-type-item"]:contains("${processorType}")`).click();
      // Adding click on canvas to place the processor at a default spot if filter doesn't auto-add
      // This might need adjustment based on actual NiFi behavior.
      // Some NiFis open a config dialog immediately, others place it on canvas.
      // The spec example implies it's added and then configured.
      // cy.get('#canvas-container').click('center'); // Example: click center of canvas
      
      // Wait for the processor to appear on the canvas, identified by its title
      cy.get(`[data-testid="processor-component"][title*="${processorTitle}"]`, { timeout: 15000 })
        .should('be.visible');
      cy.log(`Processor "${processorTitle}" added to canvas.`);
    };

    if (ensureUnique) {
      this.getProcessor(processorTitle, 0).then(exists => { // use 0 timeout for immediate check
        if (exists && Cypress.$(`[data-testid="processor-component"][title*="${processorTitle}"]`).length > 0) { // Check length for safety
          cy.log(`Processor "${processorTitle}" already exists. Deleting it first.`);
          this.deleteProcessor(processorTitle);
          this.waitForProcessorToBeRemoved(processorTitle);
          add();
        } else {
          add();
        }
      });
    } else {
      add();
    }
    return this;
  }
  
  getProcessor(processorTitleOrId, timeout = 7000) {
    // Returns the processor component
    return cy.get(`[data-testid="processor-component"][title*="${processorTitleOrId}"]`, { timeout });
  }

  openProcessorConfiguration(processorTitleOrId) {
    this.getProcessor(processorTitleOrId).rightclick();
    cy.get('[data-testid="context-menu-item"]:contains("Configure")', { timeout: 5000 }).click();
    cy.get('[data-testid="processor-configuration-dialog"]', { timeout: 10000 }).should('be.visible');
    return this;
  }

  deleteProcessor(processorTitleOrId) {
    this.getProcessor(processorTitleOrId).then($processor => {
      if ($processor.length > 0) {
        cy.wrap($processor).rightclick();
        cy.get('[data-testid="context-menu-item"]:contains("Delete")', { timeout: 5000 }).click();
        // Confirm deletion if a dialog appears
        cy.get('body').then(($body) => {
          if ($body.find('[data-testid="confirm-delete-button"]').length > 0) {
            cy.get('[data-testid="confirm-delete-button"]').click();
          }
        });
        cy.log(`Processor "${processorTitleOrId}" delete action initiated.`);
      } else {
        cy.log(`Processor "${processorTitleOrId}" not found for deletion.`);
      }
    });
    return this;
  }

  waitForProcessorToBeRemoved(processorTitleOrId, timeout = 10000) {
    cy.get(`[data-testid="processor-component"][title*="${processorTitleOrId}"]`, { timeout }).should('not.exist');
    cy.log(`Processor "${processorTitleOrId}" confirmed removed from canvas.`);
    return this;
  }

  assertProcessorIsValid(processorTitleOrId) {
    this.getProcessor(processorTitleOrId)
      .find('[data-testid="processor-validation-status-icon-invalid"]')
      .should('not.exist');
    return this;
  }

  navigateToAdvancedProcessorUi(processorTitleOrId) {
    this.getProcessor(processorTitleOrId).rightclick();
    cy.get('[data-testid="context-menu-item"]:contains("Advanced UI"), [data-testid="context-menu-item"]:contains("Advanced")')
      .first().click();
    // Example: cy.get('[data-testid="advanced-ui-container"]', { timeout: 10000 }).should('be.visible');
    return this;
  }
}

export default new NifiCanvasPage();
