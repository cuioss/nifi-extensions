/**
 * @file Processor Helper - General NiFi Processor Management
 * Provides helper functions for finding, adding, and removing processors in NiFi
 * Updated with Angular Material framework patterns based on UI structure analysis
 * @version 2.0.0
 */

import { SELECTORS, TIMEOUTS } from './constants';
import { findCanvasElements, findWorkingCanvas, ensureMainCanvas, logMessage } from './utils';

/**
 * @typedef {Object} ProcessorReference
 * @property {string} id - Processor element ID
 * @property {string} type - Processor type
 * @property {string} name - Display name
 * @property {Object} element - DOM element reference
 * @property {Object} position - Canvas position {x, y}
 * @property {boolean} isVisible - Visibility state
 * @property {string} status - Processor status (stopped, running, etc.)
 */

/**
 * Find a processor on the canvas by name or type
 * @param {string} processorName - Processor name or type to search for
 * @param {Object} options - Search options
 * @param {boolean} [options.strict=false] - Strict matching vs partial matching
 * @param {number} [options.timeout=5000] - Search timeout
 * @returns {Cypress.Chainable<ProcessorReference|null>} Processor reference or null if not found
 */
Cypress.Commands.add('findProcessorOnCanvas', (processorName, options = {}) => {
  const { strict = false, timeout = TIMEOUTS.PROCESSOR_LOAD } = options;

  logMessage('search', `Searching for processor: ${processorName}`);

  // Ensure we're on the canvas first
  return ensureMainCanvas('processor search').then((isOnCanvas) => {
    if (!isOnCanvas) {
      return cy.wrap(null);
    }

    // Search for processor elements on canvas using Angular Material selectors
    return cy.get('body').then(($body) => {
      const canvasAnalysis = findCanvasElements($body);

      if (!canvasAnalysis.hasCanvas) {
        logMessage('warn', 'No canvas elements found, returning null');
        return cy.wrap(null);
      }

      logMessage('success', `Found ${canvasAnalysis.count} canvas elements`);

      let foundProcessor = null;

      // Search through processor elements using Angular Material patterns
      const processorElements = $body.find(SELECTORS.PROCESSOR_GROUP);

      processorElements.each((index, element) => {
        const $element = Cypress.$(element);
        const elementText = $element.text().toLowerCase();
        const elementTitle = $element.attr('title') || '';
        const elementId = $element.attr('id') || '';

        // Check if this element matches our search criteria
        const matches = strict
          ? elementText === processorName.toLowerCase() ||
            elementTitle === processorName ||
            elementId === processorName
          : elementText.includes(processorName.toLowerCase()) ||
            elementTitle.toLowerCase().includes(processorName.toLowerCase()) ||
            elementId.toLowerCase().includes(processorName.toLowerCase());

        if (matches && !foundProcessor) {
          // Extract processor information
          const rect = element.getBoundingClientRect();
          foundProcessor = {
            id: elementId || `processor-${index}`,
            type: processorName,
            name: elementTitle || elementText || processorName,
            element: $element,
            position: {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            },
            isVisible: rect.width > 0 && rect.height > 0,
            status: 'unknown',
          };

          logMessage('success', `Found processor: ${foundProcessor.name} (ID: ${foundProcessor.id})`);
        }
      });

      return cy.wrap(foundProcessor);
    });
  });
});

/**
 * Add a processor to the canvas using Angular Material dialog patterns
 * @param {string} processorType - Processor type to add
 * @param {Object} options - Addition options
 * @param {Object} [options.position] - Canvas position {x, y}
 * @param {boolean} [options.skipIfExists=true] - Skip if processor already exists
 * @param {number} [options.timeout=10000] - Operation timeout
 * @returns {Cypress.Chainable<ProcessorReference>} Added processor reference
 */
Cypress.Commands.add('addProcessorToCanvas', (processorType, options = {}) => {
  const {
    position = { x: 400, y: 300 },
    skipIfExists = true,
    timeout = TIMEOUTS.PROCESSOR_LOAD,
  } = options;

  logMessage('action', `Adding processor: ${processorType} at position (${position.x}, ${position.y})`);

  // Check if processor already exists (if skipIfExists is true)
  if (skipIfExists) {
    return cy.findProcessorOnCanvas(processorType).then((existingProcessor) => {
      if (existingProcessor) {
        logMessage('warn', `Processor ${processorType} already exists, skipping addition`);
        return existingProcessor;
      }

      // Processor doesn't exist, proceed with addition
      return performProcessorAddition(processorType, position, timeout);
    });
  } else {
    // Force addition regardless of existing processors
    return performProcessorAddition(processorType, position, timeout);
  }
});

/**
 * Remove a processor from the canvas
 * @param {string|ProcessorReference} processor - Processor type or processor reference
 * @param {Object} options - Removal options
 * @param {boolean} [options.confirmDeletion=true] - Confirm deletion dialog
 * @param {number} [options.timeout=5000] - Operation timeout
 * @returns {Cypress.Chainable<boolean>} Success status
 */
Cypress.Commands.add('removeProcessorFromCanvas', (processor, options = {}) => {
  const { confirmDeletion = true, timeout = TIMEOUTS.ACTION_COMPLETE } = options;

  logMessage('action', `Removing processor: ${typeof processor === 'string' ? processor : processor.name}`);

  // If processor is a string (type), find it first
  if (typeof processor === 'string') {
    return cy.findProcessorOnCanvas(processor).then((foundProcessor) => {
      if (!foundProcessor) {
        logMessage('warn', `Processor ${processor} not found on canvas`);
        return false;
      }
      return performProcessorRemoval(foundProcessor, confirmDeletion, timeout);
    });
  } else {
    // Processor is already a reference object
    return performProcessorRemoval(processor, confirmDeletion, timeout);
  }
});

/**
 * Open the Add Processor dialog using Angular Material toolbar patterns
 * @param {Object} options - Dialog options
 * @param {number} [options.timeout=5000] - Dialog timeout
 * @returns {Cypress.Chainable} Promise
 */
Cypress.Commands.add('openAddProcessorDialog', (options = {}) => {
  const { timeout = TIMEOUTS.DIALOG_APPEAR } = options;

  logMessage('action', 'Opening Add Processor dialog');

  // Ensure we're on the main canvas
  return ensureMainCanvas('add processor dialog').then((isOnCanvas) => {
    if (!isOnCanvas) {
      throw new Error('Cannot open Add Processor dialog: not on main canvas');
    }

    // Try to find and click the Add Processor button using Angular Material toolbar patterns
    return cy.get(SELECTORS.TOOLBAR, { timeout }).should('be.visible').then(() => {
      // Look for Add button in toolbar
      return cy.get(SELECTORS.TOOLBAR_ADD, { timeout }).should('be.visible').click();
    }).then(() => {
      // Wait for the Angular Material dialog to appear
      return cy.get(SELECTORS.ADD_PROCESSOR_DIALOG, { timeout }).should('be.visible');
    });
  });
});

/**
 * Select a processor type from the Add Processor dialog
 * @param {string} processorType - Processor type to select
 * @param {Object} options - Selection options
 * @param {number} [options.timeout=5000] - Selection timeout
 * @returns {Cypress.Chainable} Promise
 */
Cypress.Commands.add('selectProcessorType', (processorType, options = {}) => {
  const { timeout = TIMEOUTS.DIALOG_APPEAR } = options;

  logMessage('action', `Selecting processor type: ${processorType}`);

  // First, try to search for the processor if search field exists
  return cy.get('body').then(($body) => {
    const searchInputs = $body.find(SELECTORS.PROCESSOR_SEARCH);
    if (searchInputs.length > 0) {
      logMessage('search', 'Using search to find processor');
      return cy
        .get(SELECTORS.PROCESSOR_SEARCH, { timeout })
        .clear()
        .type(processorType)
        .then(() => {
          // Wait for search results to filter
          cy.wait(500);
          return cy
            .get(SELECTORS.PROCESSOR_LIST_ITEM, { timeout })
            .contains(processorType)
            .should('be.visible')
            .click();
        });
    } else {
      // Fall back to direct selection from the list
      logMessage('info', 'Selecting from processor list directly');
      return cy
        .get(SELECTORS.PROCESSOR_LIST_ITEM, { timeout })
        .contains(processorType)
        .should('be.visible')
        .click();
    }
  });
});

/**
 * Confirm processor addition in the dialog
 * @param {Object} options - Confirmation options
 * @param {number} [options.timeout=5000] - Confirmation timeout
 * @returns {Cypress.Chainable} Promise
 */
Cypress.Commands.add('confirmProcessorAddition', (options = {}) => {
  const { timeout = TIMEOUTS.ACTION_COMPLETE } = options;

  logMessage('action', 'Confirming processor addition');

  // Click the Add button in the Angular Material dialog
  return cy.get(SELECTORS.ADD_BUTTON, { timeout }).should('be.visible').click().then(() => {
    // Wait for dialog to close
    return cy.get(SELECTORS.ADD_PROCESSOR_DIALOG, { timeout: 1000 }).should('not.exist');
  });
});

// Helper functions (internal)

/**
 * Perform the actual processor addition workflow
 * @param {string} processorType - Processor type to add
 * @param {Object} position - Canvas position
 * @param {number} timeout - Operation timeout
 * @returns {Cypress.Chainable<ProcessorReference>} Added processor reference
 */
function performProcessorAddition(processorType, position, timeout) {
  return cy.openAddProcessorDialog({ timeout })
    .then(() => cy.selectProcessorType(processorType, { timeout }))
    .then(() => cy.confirmProcessorAddition({ timeout }))
    .then(() => {
      // Wait a moment for the processor to appear on canvas
      cy.wait(1000);
      // Find and return the newly added processor
      return cy.findProcessorOnCanvas(processorType, { timeout });
    });
}

/**
 * Perform the actual processor removal workflow
 * @param {ProcessorReference} processor - Processor to remove
 * @param {boolean} confirmDeletion - Whether to confirm deletion
 * @param {number} timeout - Operation timeout
 * @returns {Cypress.Chainable<boolean>} Success status
 */
function performProcessorRemoval(processor, confirmDeletion, timeout) {
  // Right-click on the processor to open context menu
  return cy.wrap(processor.element)
    .rightclick()
    .then(() => {
      // Wait for context menu to appear
      return cy.get(SELECTORS.CONTEXT_MENU, { timeout }).should('be.visible');
    })
    .then(() => {
      // Click delete option
      return cy.get(SELECTORS.CONTEXT_MENU_DELETE, { timeout }).should('be.visible').click();
    })
    .then(() => {
      if (confirmDeletion) {
        // Confirm deletion if dialog appears
        return cy.get('body').then(($body) => {
          const deleteButtons = $body.find(SELECTORS.DELETE_BUTTON);
          if (deleteButtons.length > 0) {
            return cy.get(SELECTORS.DELETE_BUTTON, { timeout }).click();
          }
        });
      }
    })
    .then(() => {
      logMessage('success', `Processor ${processor.name} removed successfully`);
      return true;
    })
    .catch((error) => {
      logMessage('error', `Failed to remove processor ${processor.name}: ${error.message}`);
      return false;
    });
}
