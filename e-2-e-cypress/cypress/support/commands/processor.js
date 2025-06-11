/**
 * Custom commands related to processor operations
 */

/**
 * Add a processor to the canvas
 * @param {string} type - The type of processor to add
 * @param {Object} position - The position coordinates {x, y} where to add the processor
 * @returns {string} The ID of the newly added processor
 */
Cypress.Commands.add('addProcessor', (type, position = { x: 300, y: 300 }) => {
  // Click on the canvas at the specified position
  cy.get('#canvas-container').click(position.x, position.y);

  // Click on the "Add Processor" button in the toolbar
  cy.get('#new-processor-button').click();

  // Wait for the Add Processor dialog to appear
  cy.get('.add-processor-dialog').should('be.visible');

  // Type the processor name in the filter
  cy.get('.processor-search-input').type(type);

  // Select the processor from the filtered list
  cy.get('.processor-results').contains(type).click();

  // Click Add button
  cy.get('.processor-dialog-add-button').click();

  // Get the ID of the newly added processor
  return cy.get('g.processor').last().invoke('attr', 'id');
});

/**
 * Configure a processor with the provided settings
 * @param {string} processorId - The ID of the processor to configure
 * @param {Object} config - Configuration object with settings to apply
 */
Cypress.Commands.add('configureProcessor', (processorId, config) => {
  // Navigate to processor configuration
  cy.navigateToProcessorConfig(processorId);

  // Configure based on the provided settings
  if (config.name) {
    cy.get('input[id$="processor-name"]').clear();
    cy.get('input[id$="processor-name"]').type(config.name);
  }

  // Handle processor properties if provided
  if (config.properties) {
    // Click on the Properties tab if not already active
    cy.get('.processor-configuration-tab').contains('Properties').click();

    // Iterate through each property and set its value
    Object.entries(config.properties).forEach(([key, value]) => {
      // Find the property by name and set its value
      cy.get('.processor-property-name')
        .contains(key)
        .parents('.processor-property-row')
        .find('input, select, textarea')
        .clear();
      cy.get('.processor-property-name')
        .contains(key)
        .parents('.processor-property-row')
        .find('input, select, textarea')
        .type(value);
    });
  }

  // Apply configuration
  cy.get('button').contains('Apply').click();
});

/**
 * Verify processor properties match expected values
 * @param {string} processorId - The ID of the processor to verify
 * @param {Object} expectedProps - Expected property values to verify
 */
Cypress.Commands.add('verifyProcessorProperties', (processorId, expectedProps) => {
  // Navigate to processor configuration
  cy.navigateToProcessorConfig(processorId);

  // Click on the Properties tab if not already active
  cy.get('.processor-configuration-tab').contains('Properties').click();

  // Verify each expected property
  Object.entries(expectedProps).forEach(([key, expectedValue]) => {
    cy.get('.processor-property-name')
      .contains(key)
      .parents('.processor-property-row')
      .find('input, select, textarea')
      .should('have.value', expectedValue);
  });

  // Close the dialog
  cy.get('button').contains('Cancel').click();
});
