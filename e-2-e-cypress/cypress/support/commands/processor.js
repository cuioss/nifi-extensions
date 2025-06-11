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

/**
 * Start a processor
 * @param {string} processorId - The ID of the processor to start
 */
Cypress.Commands.add('startProcessor', (processorId) => {
  cy.getProcessorElement(processorId).rightclick();
  cy.get('.context-menu').contains('Start').click();
  cy.wait(1000); // Give time for processor to start
});

/**
 * Stop a processor
 * @param {string} processorId - The ID of the processor to stop
 */
Cypress.Commands.add('stopProcessor', (processorId) => {
  cy.getProcessorElement(processorId).rightclick();
  cy.get('.context-menu').contains('Stop').click();
  cy.wait(1000); // Give time for processor to stop
});

/**
 * Remove a processor from the canvas
 * @param {string} processorId - The ID of the processor to remove
 */
Cypress.Commands.add('removeProcessor', (processorId) => {
  cy.getProcessorElement(processorId).rightclick();
  cy.get('.context-menu').contains('Delete').click();
  // Confirm deletion if dialog appears
  cy.get('body').then(($body) => {
    if ($body.find('.confirmation-dialog').length > 0) {
      cy.get('.confirmation-dialog').find('button').contains('Delete').click();
    }
  });
});

/**
 * Get the DOM element for a processor
 * @param {string} processorId - The ID of the processor element to get
 */
Cypress.Commands.add('getProcessorElement', (processorId) => {
  return cy.get(`g.processor[id="${processorId}"]`);
});

/**
 * Verify processor state
 * @param {string} processorId - The ID of the processor to check
 * @param {string} expectedState - Expected state (RUNNING, STOPPED, etc.)
 */
Cypress.Commands.add('verifyProcessorState', (processorId, expectedState) => {
  cy.getProcessorElement(processorId)
    .find('.processor-state-indicator')
    .should('have.class', expectedState.toLowerCase());
});

/**
 * Open processor configuration dialog
 * @param {string} processorId - The ID of the processor to configure
 */
Cypress.Commands.add('openProcessorConfigDialog', (processorId) => {
  cy.getProcessorElement(processorId).dblclick();
  cy.get('.processor-configuration-dialog').should('be.visible');
});

/**
 * Send a token to a processor for validation testing
 * @param {string} processorId - The ID of the processor to send token to
 * @param {string} token - The JWT token to send
 */
Cypress.Commands.add('sendTokenToProcessor', (processorId, token) => {
  // Create a flow file with the token in the Authorization header
  cy.request({
    method: 'POST',
    url: `/nifi-api/processors/${processorId}/test-token`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: {
      token: token,
    },
    failOnStatusCode: false, // Allow both success and failure responses
  });
});

/**
 * Send an expired token to processor for testing
 * @param {string} processorId - The ID of the processor
 */
Cypress.Commands.add('sendExpiredToken', (processorId) => {
  const expiredToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.expired-signature';
  cy.sendTokenToProcessor(processorId, expiredToken);
});

/**
 * Send a token with invalid signature to processor for testing
 * @param {string} processorId - The ID of the processor
 */
Cypress.Commands.add('sendTokenWithInvalidSignature', (processorId) => {
  const invalidToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid-signature-here';
  cy.sendTokenToProcessor(processorId, invalidToken);
});

/**
 * Send a token with missing required claims to processor for testing
 * @param {string} processorId - The ID of the processor
 */
Cypress.Commands.add('sendTokenWithMissingClaims', (processorId) => {
  const tokenWithMissingClaims =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiSm9obiBEb2UifQ.missing-claims-signature';
  cy.sendTokenToProcessor(processorId, tokenWithMissingClaims);
});
