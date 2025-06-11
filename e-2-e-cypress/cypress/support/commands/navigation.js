/**
 * Custom commands related to NiFi UI navigation
 */

/**
 * Navigate to NiFi canvas
 */
Cypress.Commands.add('navigateToCanvas', () => {
  cy.visit('/');
  cy.get('#canvas-container').should('exist');
});

/**
 * Navigate to processor configuration by ID
 * @param {string} processorId - The ID of the processor to configure
 */
Cypress.Commands.add('navigateToProcessorConfig', (processorId) => {
  // Find the processor by ID and right-click to open context menu
  cy.get(`g[id="${processorId}"]`).rightclick();

  // Click on "Configure" in the context menu
  cy.get('.context-menu').contains('Configure').click();

  // Wait for configuration dialog to open
  cy.get('.configuration-dialog').should('be.visible');
});

/**
 * Navigate to controller services
 */
Cypress.Commands.add('navigateToControllerServices', () => {
  // Click on the hamburger menu
  cy.get('#global-menu-button').click();

  // Click on "Controller Settings" in the menu
  cy.get('.menu-panel').contains('Controller Settings').click();

  // Wait for controller settings dialog
  cy.get('.settings-dialog').should('be.visible');

  // Click on the "Controller Services" tab
  cy.get('.settings-dialog').contains('Controller Services').click();

  // Wait for controller services tab to be active
  cy.get('.controller-services-tab').should('be.visible');
});
