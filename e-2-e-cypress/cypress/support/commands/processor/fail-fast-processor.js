/**
 * Processor availability verification with fail-fast approach
 * Focus: Quick verification that processors are available on canvas
 */

/**
 * Verify that a specific processor is available on the canvas
 * If not found, attempt to add it with fail-fast behavior
 * @param {string} processorName - Name of the processor to verify
 */
Cypress.Commands.add('verifyProcessorAvailable', (processorName) => {
  cy.log(`🔍 Verifying processor availability: ${processorName}`);

  cy.startTestTimer(`verify-processor-${processorName}`);

  // First, check if processor already exists on canvas
  cy.get('body', { timeout: 5000 }).then(($body) => {
    const existingProcessor = $body.find(
      `[title*="${processorName}"], *:contains("${processorName}")`
    );

    if (existingProcessor.length > 0) {
      cy.log(`✅ Processor ${processorName} already available on canvas`);
      cy.endTestTimer(`verify-processor-${processorName}`);
      return;
    }

    cy.log(`⚠️ Processor ${processorName} not found on canvas - attempting to add`);

    // Try to add the processor with fail-fast approach
    cy.addProcessorFast(processorName).then((success) => {
      if (success) {
        cy.log(`✅ Processor ${processorName} successfully added to canvas`);
        cy.endTestTimer(`verify-processor-${processorName}`);
      } else {
        cy.forceFailTest(`❌ Failed to add processor ${processorName} to canvas`);
      }
    });
  });
});

/**
 * Fast processor addition with minimal retries
 * @param {string} processorName - Name of the processor to add
 * @returns {Cypress.Chainable<boolean>} - Success status
 */
Cypress.Commands.add('addProcessorFast', (processorName) => {
  cy.log(`🚀 Fast processor addition: ${processorName}`);

  return cy.get('body').then(($body) => {
    // Look for canvas area to double-click
    const canvasElements = $body.find(
      '#canvas, #canvas-container, .canvas-container, .canvas, svg, .flow-canvas'
    );

    if (canvasElements.length === 0) {
      cy.log('❌ No canvas element found for processor addition');
      return cy.wrap(false);
    }

    // Double-click on canvas to open processor dialog
    return cy
      .wrap(canvasElements.first())
      .dblclick({ timeout: 5000, force: true })
      .then(() => {
        // Wait for processor selection dialog with tight timeout
        const dialogSelectors = [
          '[role="dialog"]',
          '.processor-dialog',
          '.add-processor-dialog',
          '*:contains("Add Processor")',
          'mat-dialog-container',
          '.dialog',
        ];

        return cy.get('body', { timeout: 8000 }).then(($checkBody) => {
          const dialog = $checkBody.find(dialogSelectors.join(', '));

          if (dialog.length === 0) {
            cy.log('❌ Processor dialog did not appear');
            return cy.wrap(false);
          }

          cy.log('✅ Processor dialog opened');

          // Search for the specific processor
          return cy.searchAndSelectProcessor(processorName);
        });
      });
  });
});

/**
 * Search and select processor from dialog
 * @param {string} processorName - Name of the processor to select
 * @returns {Cypress.Chainable<boolean>} - Success status
 */
Cypress.Commands.add('searchAndSelectProcessor', (processorName) => {
  cy.log(`🔍 Searching for processor: ${processorName}`);

  // Look for search input
  const searchSelectors = [
    'input[placeholder*="Search"]',
    'input[placeholder*="search"]',
    'input[type="search"]',
    '.search-input',
    '[data-testid="search"]',
  ];

  return cy.get('body').then(($body) => {
    const searchInput = $body.find(searchSelectors.join(', '));

    if (searchInput.length > 0) {
      // Use search functionality
      return cy
        .wrap(searchInput.first())
        .clear({ timeout: 3000 })
        .type(processorName, { timeout: 3000 })
        .then(() => {
          // Look for the processor in results
          return cy.selectProcessorFromResults(processorName);
        });
    } else {
      // Search without input field - look directly for processor
      return cy.selectProcessorFromResults(processorName);
    }
  });
});

/**
 * Select processor from search results or list
 * @param {string} processorName - Name of the processor to select
 * @returns {Cypress.Chainable<boolean>} - Success status
 */
Cypress.Commands.add('selectProcessorFromResults', (processorName) => {
  cy.log(`🎯 Selecting processor from results: ${processorName}`);

  // Look for processor in various possible formats
  const processorSelectors = [
    `*:contains("${processorName}")`,
    `[title*="${processorName}"]`,
    `[data-name*="${processorName}"]`,
    `.processor-type:contains("${processorName}")`,
    `li:contains("${processorName}")`,
    `tr:contains("${processorName}")`,
    `.list-item:contains("${processorName}")`,
  ];

  return cy.get('body', { timeout: 8000 }).then(($body) => {
    const processorElement = $body.find(processorSelectors.join(', '));

    if (processorElement.length === 0) {
      cy.log(`❌ Processor ${processorName} not found in results`);
      return cy.wrap(false);
    }

    // Click on the processor
    return cy
      .wrap(processorElement.first())
      .click({ timeout: 3000, force: true })
      .then(() => {
        // Look for and click Add/OK button
        return cy.clickAddProcessorButton();
      });
  });
});

/**
 * Click the Add/OK button to confirm processor addition
 * @returns {Cypress.Chainable<boolean>} - Success status
 */
Cypress.Commands.add('clickAddProcessorButton', () => {
  const buttonSelectors = [
    'button:contains("Add")',
    'button:contains("OK")',
    'button:contains("Create")',
    '[data-testid="add-button"]',
    '[data-testid="ok-button"]',
    '.add-button',
    '.ok-button',
  ];

  return cy.get('body', { timeout: 5000 }).then(($body) => {
    const addButton = $body.find(buttonSelectors.join(', '));

    if (addButton.length === 0) {
      cy.log('❌ Add button not found');
      return cy.wrap(false);
    }

    return cy
      .wrap(addButton.first())
      .click({ timeout: 3000, force: true })
      .then(() => {
        cy.log('✅ Processor addition confirmed');

        // Wait a moment for processor to appear on canvas
        cy.wait(2000);
        return cy.wrap(true);
      });
  });
});

/**
 * Quick verification that processors are accessible
 * Fast check without heavy canvas interaction
 */
Cypress.Commands.add('verifyProcessorsAccessible', () => {
  cy.log('🔍 Quick verification of processor accessibility');

  cy.startTestTimer('verify-processors-accessible');

  // Check if we can access processor-related UI elements
  cy.get('body', { timeout: 8000 }).then(($body) => {
    const indicators = [
      $body.find('#canvas').length > 0,
      $body.find('#canvas-container').length > 0,
      $body.find('.canvas-container').length > 0,
      $body.find('.canvas').length > 0,
      $body.find('svg').length > 0,
      $body.find('[role="main"]').length > 0,
    ];

    const hasCanvasIndicators = indicators.some((indicator) => indicator);

    if (hasCanvasIndicators) {
      cy.log('✅ Processor canvas is accessible');
      cy.endTestTimer('verify-processors-accessible');
    } else {
      cy.forceFailTest('❌ Processor canvas is not accessible');
    }
  });
});
