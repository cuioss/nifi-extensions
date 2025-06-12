/**
 * Custom commands related to NiFi UI navigation
 * Updated for NiFi 2.4.0 Angular UI
 */

/**
 * Navigate to NiFi canvas/main flow
 */
Cypress.Commands.add('navigateToCanvas', () => {
  cy.visit('/');
  cy.get('nifi', { timeout: 30000 }).should('exist');
  
  // Wait for Angular to fully load
  cy.wait(2000);
  
  // Verify we're in the main application
  cy.get('nifi').should(($el) => {
    expect($el.children().length).to.be.greaterThan(0);
  });
});

/**
 * Navigate to processor configuration by ID
 * @param {string} processorId - The ID of the processor to configure
 */
Cypress.Commands.add('navigateToProcessorConfig', (processorId) => {
  // Use the updated getProcessorElement command
  cy.getProcessorElement(processorId).then(($element) => {
    // Double-click to open configuration
    cy.wrap($element).dblclick({ force: true });
    cy.wait(1000);
    
    // Wait for configuration dialog to open
    cy.get('body').then(($body) => {
      const configDialogs = $body.find('[role="dialog"], .mat-dialog-container, .configuration-dialog, .processor-config-dialog');
      if (configDialogs.length > 0) {
        cy.wrap(configDialogs.first()).should('be.visible');
      }
    });
  });
});

/**
 * Navigate to controller services
 */
Cypress.Commands.add('navigateToControllerServices', () => {
  // Look for main menu or settings access in Angular UI
  cy.get('body').then(($body) => {
    // Try to find menu/hamburger buttons
    const menuButtons = $body.find('button[aria-label*="menu"], .menu-button, [mat-icon-button], button:contains("☰")');
    
    if (menuButtons.length > 0) {
      cy.wrap(menuButtons.first()).click({ force: true });
      cy.wait(500);
      
      // Look for controller services or settings option
      cy.get('body').then(($menuBody) => {
        const controllerOptions = $menuBody.find('*:contains("Controller"), *:contains("Services"), *:contains("Settings")');
        if (controllerOptions.length > 0) {
          cy.wrap(controllerOptions.first()).click({ force: true });
        }
      });
    } else {
      // Fallback: try direct URL navigation
      cy.visit('/#/settings');
      cy.wait(2000);
    }
  });
  
  // Verify we're in controller services area
  cy.get('body').should(($body) => {
    const hasControllerElements = $body.find('*:contains("Controller"), *:contains("Services")').length > 0;
    expect(hasControllerElements).to.be.true;
  });
});
