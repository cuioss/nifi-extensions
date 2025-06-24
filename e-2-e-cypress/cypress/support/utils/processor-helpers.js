/**
 * Processor management utility functions for NiFi E2E tests
 * Provides comprehensive processor interaction helpers following requirements from Requirements.md
 */

/**
 * Processor type constants
 */
export const PROCESSOR_TYPES = {
  MULTI_ISSUER: 'MultiIssuerJWTTokenAuthenticator',
  SINGLE_ISSUER: 'JWTTokenAuthenticator'
};

/**
 * Add processor to canvas with enhanced error handling and validation
 * @param {string} processorType - Type of processor to add
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Timeout for operations (default: 30000)
 * @param {boolean} options.validateAfterAdd - Whether to validate processor after adding (default: true)
 * @param {Object} options.position - Canvas position {x, y} (default: center)
 * @returns {Cypress.Chainable} Cypress chainable with processor element
 */
export function addProcessorToCanvas(processorType, options = {}) {
  const {
    timeout = 30000,
    validateAfterAdd = true,
    position = { x: 400, y: 300 }
  } = options;

  cy.log(`🔧 Adding processor: ${processorType}`);

  // Clear any existing console errors
  cy.clearConsoleErrors();

  // Open processor palette/dialog
  openProcessorDialog(timeout);

  // Search for and select processor
  searchAndSelectProcessor(processorType, timeout);

  // Position processor on canvas
  positionProcessorOnCanvas(position);

  // Validate processor was added successfully
  if (validateAfterAdd) {
    validateProcessorOnCanvas(processorType, timeout);
  }

  // Check for console errors during processor addition
  cy.checkConsoleErrors(`Adding ${processorType} processor should not generate console errors`);

  cy.log(`✅ Successfully added processor: ${processorType}`);

  return cy.get(`[data-processor-type*="${processorType}"], .processor-component:contains("${processorType}")`)
    .first();
}

/**
 * Open processor dialog/palette
 * @param {number} timeout - Timeout for operation
 */
function openProcessorDialog(timeout) {
  // Try multiple selectors for add processor button
  const addProcessorSelectors = [
    '#toolbar .fa-plus',
    '#toolbar button[title*="processor"]',
    '.add-processor',
    'button[aria-label*="processor"]',
    '.toolbar-action[title*="Processor"]'
  ];

  cy.log('🔍 Looking for add processor button');

  let found = false;
  for (const selector of addProcessorSelectors) {
    cy.get('body').then($body => {
      if ($body.find(selector).length > 0 && !found) {
        found = true;
        cy.get(selector, { timeout })
          .should('be.visible')
          .and('not.be.disabled')
          .click();
      }
    });
  }

  // Alternative: right-click on canvas to open context menu
  if (!found) {
    cy.log('🔄 Trying canvas right-click approach');
    cy.get('#canvas-container')
      .rightclick({ force: true });

    cy.get('#context-menu, .context-menu')
      .should('be.visible')
      .contains('processor', { matchCase: false })
      .click();
  }

  // Wait for processor dialog to appear
  cy.get('.processor-dialog, #processor-dialog, .add-processor-dialog', { timeout })
    .should('be.visible');
}

/**
 * Search for and select processor in the dialog
 * @param {string} processorType - Type of processor to search for
 * @param {number} timeout - Timeout for operation
 */
function searchAndSelectProcessor(processorType, timeout) {
  cy.log(`🔍 Searching for processor: ${processorType}`);

  // Find search input
  const searchSelectors = [
    'input[placeholder*="search"], input[placeholder*="filter"]',
    '.processor-search input',
    '#processor-search',
    'input[type="search"]'
  ];

  searchSelectors.forEach(selector => {
    cy.get('body').then($body => {
      if ($body.find(selector).length > 0) {
        cy.get(selector)
          .clear()
          .type(processorType);
      }
    });
  });

  // Select processor from list
  cy.get('.processor-list, .processor-item, .component-item', { timeout })
    .contains(processorType)
    .should('be.visible')
    .click();

  // Confirm selection if needed
  cy.get('body').then($body => {
    if ($body.find('button:contains("Add"), .confirm-button, .ok-button').length > 0) {
      cy.get('button:contains("Add"), .confirm-button, .ok-button')
        .click();
    }
  });
}

/**
 * Position processor on canvas
 * @param {Object} position - Canvas position {x, y}
 */
function positionProcessorOnCanvas(position) {
  cy.log(`📍 Positioning processor at: ${position.x}, ${position.y}`);

  // Click on canvas at specified position
  cy.get('#canvas-container')
    .click(position.x, position.y);
}

/**
 * Validate processor was successfully added to canvas
 * @param {string} processorType - Type of processor to validate
 * @param {number} timeout - Timeout for validation
 */
function validateProcessorOnCanvas(processorType, timeout) {
  cy.log(`✅ Validating processor on canvas: ${processorType}`);

  // Look for processor on canvas
  cy.get(`[data-processor-type*="${processorType}"], .processor-component:contains("${processorType}")`, { timeout })
    .should('be.visible')
    .and('have.length.greaterThan', 0);

  cy.log(`✅ Processor ${processorType} successfully validated on canvas`);
}

/**
 * Open processor configuration dialog
 * @param {string} processorType - Type of processor to configure
 * @param {Object} options - Configuration options
 * @returns {Cypress.Chainable} Cypress chainable for configuration dialog
 */
export function openProcessorConfiguration(processorType, options = {}) {
  const { timeout = 20000, expectAdvancedSettings = true } = options;

  cy.log(`⚙️ Opening configuration for processor: ${processorType}`);

  // Find processor on canvas and double-click or right-click to configure
  cy.get(`[data-processor-type*="${processorType}"], .processor-component:contains("${processorType}")`)
    .first()
    .should('be.visible')
    .dblclick({ force: true });

  // Wait for configuration dialog
  cy.get('.processor-configuration, #processor-configuration, .component-configuration', { timeout })
    .should('be.visible');

  // Verify configuration tabs are present
  cy.get('.tab, .tab-button, .configuration-tab')
    .should('have.length.greaterThan', 0);

  if (expectAdvancedSettings) {
    // Check for advanced/properties tab
    cy.get('.tab:contains("Properties"), .tab:contains("Advanced"), .tab-button:contains("Properties")')
      .should('be.visible');
  }

  cy.log(`✅ Configuration dialog opened for: ${processorType}`);

  return cy.get('.processor-configuration, #processor-configuration, .component-configuration');
}

/**
 * Navigate to advanced settings in processor configuration
 * @param {Object} options - Navigation options
 */
export function navigateToAdvancedSettings(options = {}) {
  const { timeout = 15000, expectCustomUI = false } = options;

  cy.log('🔧 Navigating to advanced settings');

  // Look for Properties or Advanced tab
  const advancedTabSelectors = [
    '.tab:contains("Properties")',
    '.tab:contains("Advanced")',
    '.tab-button:contains("Properties")',
    '.configuration-tab:contains("Properties")'
  ];

  let tabClicked = false;
  advancedTabSelectors.forEach(selector => {
    cy.get('body').then($body => {
      if ($body.find(selector).length > 0 && !tabClicked) {
        tabClicked = true;
        cy.get(selector)
          .should('be.visible')
          .click();
      }
    });
  });

  // Wait for advanced settings to load
  cy.get('.properties-panel, .advanced-panel, .configuration-properties', { timeout })
    .should('be.visible');

  if (expectCustomUI) {
    // Wait for custom UI to load (specific to JWT processors)
    cy.get('.jwt-configuration, .custom-ui, iframe', { timeout })
      .should('be.visible');

    // Check that loading message is not stuck
    cy.get('body').should('not.contain', 'Loading JWT Validator UI...');
  }

  cy.log('✅ Advanced settings loaded successfully');
}

/**
 * Verify processor is available in processor catalog
 * @param {string} processorType - Type of processor to verify
 * @param {Object} options - Verification options
 */
export function verifyProcessorInCatalog(processorType, options = {}) {
  const { timeout = 30000, openCatalog = true } = options;

  cy.log(`📋 Verifying processor in catalog: ${processorType}`);

  if (openCatalog) {
    openProcessorDialog(timeout);
  }

  // Search for processor
  cy.get('input[placeholder*="search"], input[placeholder*="filter"]')
    .clear()
    .type(processorType);

  // Verify processor appears in results
  cy.get('.processor-list, .processor-item, .component-item', { timeout })
    .should('contain', processorType);

  cy.log(`✅ Processor ${processorType} found in catalog`);

  // Close dialog
  cy.get('.close-button, .cancel-button, button:contains("Cancel")')
    .click();
}

/**
 * Verify processor deployment and registration
 * @param {string} processorType - Type of processor to verify
 */
export function verifyProcessorDeployment(processorType) {
  cy.log(`🚀 Verifying processor deployment: ${processorType}`);

  // Verify processor appears in catalog
  verifyProcessorInCatalog(processorType);

  // Verify processor can be instantiated
  const testPosition = { x: 100, y: 100 };
  addProcessorToCanvas(processorType, { position: testPosition });

  // Verify processor configuration is accessible
  openProcessorConfiguration(processorType);

  // Close configuration dialog
  cy.get('.close-button, .cancel-button, button:contains("Cancel")')
    .click();

  // Clean up test processor
  cleanupTestProcessor(processorType);

  cy.log(`✅ Processor deployment verified: ${processorType}`);
}

/**
 * Clean up test processor from canvas
 * @param {string} processorType - Type of processor to clean up
 */
function cleanupTestProcessor(processorType) {
  cy.log(`🧹 Cleaning up test processor: ${processorType}`);

  cy.get(`[data-processor-type*="${processorType}"], .processor-component:contains("${processorType}")`)
    .first()
    .rightclick({ force: true });

  cy.get('#context-menu, .context-menu')
    .should('be.visible')
    .contains('delete', { matchCase: false })
    .click();

  // Confirm deletion if needed
  cy.get('body').then($body => {
    if ($body.find('button:contains("Delete"), .confirm-button').length > 0) {
      cy.get('button:contains("Delete"), .confirm-button')
        .click();
    }
  });

  cy.log(`✅ Test processor cleaned up: ${processorType}`);
}

/**
 * Verify processor custom UI loads without errors
 * @param {string} processorType - Type of processor to test
 * @param {Object} options - Test options
 */
export function verifyProcessorCustomUI(processorType, options = {}) {
  const { timeout = 30000, expectIframe = false } = options;

  cy.log(`🎨 Verifying custom UI for processor: ${processorType}`);

  // Clear console errors before testing
  cy.clearConsoleErrors();

  // Open processor configuration
  openProcessorConfiguration(processorType);

  // Navigate to advanced settings
  navigateToAdvancedSettings({ timeout, expectCustomUI: true });

  if (expectIframe) {
    // For iframe-based custom UI
    cy.get('iframe', { timeout })
      .should('be.visible')
      .and('have.attr', 'src');
  } else {
    // For embedded custom UI
    cy.get('.jwt-configuration, .custom-ui', { timeout })
      .should('be.visible');
  }

  // Verify no loading hang
  cy.get('body').should('not.contain', 'Loading JWT Validator UI...');

  // Check for console errors during UI loading
  cy.checkConsoleErrors(`Custom UI for ${processorType} should load without console errors`);

  cy.log(`✅ Custom UI verified for processor: ${processorType}`);
}
