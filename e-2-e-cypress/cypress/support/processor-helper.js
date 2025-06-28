/**
 * @file Processor Helper - JWT Processor Management
 * Provides helper functions for finding, adding, and removing specific JWT processors
 * Follows 2024 Cypress best practices and integrates with navigation helpers
 * @version 1.0.0
 * @author E2E Test Suite
 * @since 1.0.0
 */

import { SELECTORS, TIMEOUTS, JWT_PROCESSORS, PAGE_TYPES } from './constants';

/**
 * Select the processor type from the Add Processor dialog
 * @param {object} processorDef - Processor definition
 * @returns {Cypress.Chainable} Promise
 */
function selectProcessorType(processorDef) {
  cy.log(`🎯 Selecting processor type: ${processorDef.displayName}`);

  // First, try to search for the processor if search field exists
  return cy.get('body').then(($body) => {
    const searchInputs = $body.find(SELECTORS.PROCESSOR_SEARCH);
    if (searchInputs.length > 0) {
      cy.log('🔍 Using search to find processor');
      return cy
        .get(SELECTORS.PROCESSOR_SEARCH)
        .clear()
        .type(processorDef.displayName)
        .then(() => {
          // Wait for search results to filter
          cy.wait(500);
          return cy
            .get(SELECTORS.PROCESSOR_LIST_ITEM)
            .contains(processorDef.displayName)
            .should('be.visible')
            .click();
        });
    } else {
      // Fall back to direct selection from the list
      cy.log('📋 Selecting from processor list directly');
      return cy
        .get(SELECTORS.PROCESSOR_LIST_ITEM)
        .contains(processorDef.displayName)
        .should('be.visible')
        .click();
    }
  });
}

/**
 * NiFi Canvas Navigation Helper
 * @since 1.0.0
 */

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
 * Get all available JWT processor types
 * @returns {Object} JWT processor definitions
 * @example
 * cy.getJWTProcessorTypes().then((types) => {
 *   console.log('Available processors:', types);
 * });
 */
Cypress.Commands.add('getJWTProcessorTypes', () => {
  return cy.wrap(JWT_PROCESSORS);
});

/**
 * Find a processor on the canvas by type or name
 * @param {string} processorType - Processor type (use JWT_PROCESSORS constants)
 * @param {Object} options - Search options
 * @param {boolean} [options.strict=false] - Strict matching vs partial matching
 * @param {number} [options.timeout=5000] - Search timeout
 * @returns {Cypress.Chainable<ProcessorReference|null>} Processor reference or null if not found
 * @example
 * // Find single issuer JWT processor
 * cy.findProcessorOnCanvas('JWT_AUTHENTICATOR').then((processor) => {
 *   if (processor) {
 *     cy.log(`Found processor: ${processor.name} at ${processor.position.x}, ${processor.position.y}`);
 *   }
 * });
 */
Cypress.Commands.add('findProcessorOnCanvas', (processorType, options = {}) => {
  const { strict = false } = options;

  cy.log(`🔍 Searching for processor: ${processorType}`);

  return cy.getJWTProcessorTypes().then((types) => {
    const processorDef = types[processorType];
    if (!processorDef) {
      cy.log(
        `⚠️ Unknown processor type: ${processorType}. Available types: ${Object.keys(types).join(', ')}`
      );
      return cy.wrap(null);
    }

    cy.log(`Looking for: ${processorDef.displayName}`);

    // Ensure we're on the canvas first
    return cy.getPageContext().then((context) => {
      if (context.pageType !== PAGE_TYPES.MAIN_CANVAS) {
        cy.log(`⚠️ Not on main canvas (current: ${context.pageType}), returning null`);
        return cy.wrap(null);
      }

      // Search for processor elements on canvas
      // Try to find canvas first, but don't fail if it doesn't exist
      return cy.get('body').then(($body) => {
        // Check if we have any canvas-like elements
        const canvasElements = $body.find('svg, #canvas, .canvas, #canvas-container');

        if (canvasElements.length === 0) {
          cy.log(`⚠️ No canvas elements found, returning null`);
          return cy.wrap(null);
        }

        cy.log(`✅ Found ${canvasElements.length} canvas elements`);

        // Try different search strategies
        const searchTerms = [
          processorDef.displayName,
          processorDef.shortName,
          processorDef.className.split('.').pop(), // Just the class name
          'JWT', // Fallback to JWT keyword
        ];

        let foundProcessor = null;

        // Search through processor elements
        const processorElements = $body.find(SELECTORS.PROCESSOR_GROUP);

        processorElements.each((index, element) => {
          const $element = Cypress.$(element);
          const elementText = $element.text().toLowerCase();
          const elementTitle = $element.attr('title') || '';
          const elementId = $element.attr('id') || '';

          // Check if this element matches our search criteria
          const matches = searchTerms.some((term) => {
            if (strict) {
              return (
                elementText === term.toLowerCase() || elementTitle === term || elementId === term
              );
            } else {
              return (
                elementText.includes(term.toLowerCase()) ||
                elementTitle.toLowerCase().includes(term.toLowerCase()) ||
                elementId.toLowerCase().includes(term.toLowerCase())
              );
            }
          });

          if (matches && !foundProcessor) {
            // Extract processor information
            const rect = element.getBoundingClientRect();
            foundProcessor = {
              id: elementId || `processor-${index}`,
              type: processorType,
              name: processorDef.displayName,
              element: $element,
              position: {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
              },
              isVisible: rect.width > 0 && rect.height > 0,
              status: 'unknown', // Could be enhanced to detect actual status
            };

            cy.log(`✅ Found processor: ${foundProcessor.name} (ID: ${foundProcessor.id})`);
          }
        });

        return cy.wrap(foundProcessor);
      });
    });
  });
});

/**
 * Add a processor to the canvas
 * @param {string} processorType - Processor type (use JWT_PROCESSORS constants)
 * @param {Object} options - Addition options
 * @param {Object} [options.position] - Canvas position {x, y}
 * @param {boolean} [options.skipIfExists=true] - Skip if processor already exists
 * @param {number} [options.timeout=10000] - Operation timeout
 * @returns {Cypress.Chainable<ProcessorReference>} Added processor reference
 * @example
 * // Add single issuer JWT processor
 * cy.addProcessorToCanvas('JWT_AUTHENTICATOR', {
 *   position: { x: 400, y: 300 },
 *   skipIfExists: false
 * }).then((processor) => {
 *   cy.log(`Added processor: ${processor.name}`);
 * });
 */
Cypress.Commands.add('addProcessorToCanvas', (processorType, options = {}) => {
  const {
    position = { x: 400, y: 300 },
    skipIfExists = true,
    timeout = TIMEOUTS.PROCESSOR_LOAD,
  } = options;

  cy.log(`➕ Adding processor: ${processorType} at position (${position.x}, ${position.y})`);

  return cy.getJWTProcessorTypes().then((types) => {
    const processorDef = types[processorType];
    if (!processorDef) {
      throw new Error(`Unknown processor type: ${processorType}`);
    }

    // Check if processor already exists (if skipIfExists is true)
    if (skipIfExists) {
      return cy.findProcessorOnCanvas(processorType).then((existingProcessor) => {
        if (existingProcessor) {
          cy.log(`⚠️ Processor ${processorType} already exists, skipping addition`);
          return existingProcessor;
        }

        // Processor doesn't exist, proceed with addition
        return performProcessorAddition(processorDef, position, timeout);
      });
    } else {
      // Force addition regardless of existing processors
      return performProcessorAddition(processorDef, position, timeout);
    }
  });
});

/**
 * Remove a processor from the canvas
 * @param {string|ProcessorReference} processor - Processor type or processor reference
 * @param {Object} options - Removal options
 * @param {boolean} [options.confirmDeletion=true] - Confirm deletion dialog
 * @param {number} [options.timeout=5000] - Operation timeout
 * @returns {Cypress.Chainable<boolean>} Success status
 * @example
 * // Remove processor by type
 * cy.removeProcessorFromCanvas('JWT_AUTHENTICATOR');
 *
 * // Remove processor by reference
 * cy.findProcessorOnCanvas('MULTI_ISSUER').then((processor) => {
 *   if (processor) {
 *     cy.removeProcessorFromCanvas(processor);
 *   }
 * });
 */
Cypress.Commands.add('removeProcessorFromCanvas', (processor, options = {}) => {
  const { confirmDeletion = true, timeout = TIMEOUTS.ACTION_COMPLETE } = options;

  cy.log(`🗑️ Removing processor: ${typeof processor === 'string' ? processor : processor.name}`);

  // If processor is a string (type), find it first
  if (typeof processor === 'string') {
    return cy.findProcessorOnCanvas(processor).then((foundProcessor) => {
      if (!foundProcessor) {
        cy.log(`⚠️ Processor ${processor} not found on canvas`);
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
 * Get all JWT processors currently on the canvas
 * @param {Object} options - Search options
 * @param {number} [options.timeout=5000] - Search timeout
 * @returns {Cypress.Chainable<Array<ProcessorReference>>} Array of found processors
 * @example
 * cy.getAllJWTProcessorsOnCanvas().then((processors) => {
 *   cy.log(`Found ${processors.length} JWT processors on canvas`);
 * });
 */
Cypress.Commands.add('getAllJWTProcessorsOnCanvas', (options = {}) => {
  const { timeout = TIMEOUTS.PROCESSOR_LOAD } = options;

  cy.log('🔍 Searching for all JWT processors on canvas');

  // First check if we're on the right page
  return cy.getPageContext().then((context) => {
    if (context.pageType !== PAGE_TYPES.MAIN_CANVAS) {
      cy.log(`⚠️ Not on main canvas (current: ${context.pageType}), returning empty array`);
      return cy.wrap([]);
    }

    return cy.getJWTProcessorTypes().then((_types) => {
      const foundProcessors = [];

      // Search for JWT_AUTHENTICATOR first, then MULTI_ISSUER
      return cy.findProcessorOnCanvas('JWT_AUTHENTICATOR', { timeout }).then((jwtAuthProcessor) => {
        if (jwtAuthProcessor !== null && jwtAuthProcessor !== undefined) {
          foundProcessors.push(jwtAuthProcessor);
        }

        // Then search for MULTI_ISSUER
        return cy
          .findProcessorOnCanvas('MULTI_ISSUER', { timeout })
          .then((multiIssuerProcessor) => {
            if (multiIssuerProcessor !== null && multiIssuerProcessor !== undefined) {
              foundProcessors.push(multiIssuerProcessor);
            }

            cy.log(`✅ Found ${foundProcessors.length} JWT processors on canvas`);
            return cy.wrap(foundProcessors);
          });
      });
    });
  });
});

/**
 * Clean up all JWT processors from the canvas
 * @param {Object} options - Cleanup options
 * @param {boolean} [options.confirmDeletion=true] - Confirm each deletion
 * @param {number} [options.timeout=10000] - Total timeout for cleanup
 * @returns {Cypress.Chainable<number>} Number of processors removed
 * @example
 * cy.cleanupJWTProcessors().then((removedCount) => {
 *   cy.log(`Removed ${removedCount} processors from canvas`);
 * });
 */
Cypress.Commands.add('cleanupJWTProcessors', (options = {}) => {
  const { confirmDeletion = true, timeout = TIMEOUTS.PROCESSOR_LOAD } = options;

  cy.log('🧹 Attempting to clean up JWT processors from canvas');

  // First check if we're on the right page
  return cy.getPageContext().then((context) => {
    if (context.pageType !== PAGE_TYPES.MAIN_CANVAS) {
      cy.log(`⚠️ Not on main canvas (current: ${context.pageType}), skipping cleanup`);
      return 0;
    }

    return cy.getAllJWTProcessorsOnCanvas({ timeout }).then((processors) => {
      if (processors.length === 0) {
        cy.log('✅ No JWT processors found to clean up');
        return 0;
      }

      cy.log(`Found ${processors.length} JWT processors to remove`);

      // Remove each processor sequentially (Cypress-friendly approach)
      let removeCount = 0;

      processors.forEach((processor) => {
        cy.removeProcessorFromCanvas(processor, { confirmDeletion }).then((success) => {
          if (success) {
            removeCount++;
            cy.log(`✅ Removed processor: ${processor.name}`);
          } else {
            cy.log(`⚠️ Failed to remove processor: ${processor.name}`);
          }
          return success;
        });
      });

      cy.log(`✅ Cleanup complete: ${removeCount} processors removed`);
      return cy.wrap(removeCount);
    });
  });
});

// Helper functions (not exported as Cypress commands)

/**
 * Perform the actual processor addition workflow
 * @param {Object} processorDef - Processor definition
 * @param {Object} position - Position {x, y}
 * @param {number} timeout - Timeout
 * @returns {Cypress.Chainable<ProcessorReference>} Added processor
 */
function performProcessorAddition(processorDef, position, timeout) {
  cy.log(`🎯 Adding ${processorDef.displayName} to canvas`);

  // Ensure canvas is ready - try multiple canvas selectors
  const canvasSelectors = [SELECTORS.CANVAS, SELECTORS.CANVAS_CONTAINER, SELECTORS.CANVAS_SVG];

  // Try each canvas selector until we find one that works
  return findWorkingCanvasSelector(canvasSelectors, timeout)
    .then(() => {
      // Try different methods to open the Add Processor dialog
      return tryOpenAddProcessorDialog();
    })
    .then(() => {
      // Search for and select the processor type
      return selectProcessorType(processorDef);
    })
    .then(() => {
      // Confirm addition
      return confirmProcessorAddition(timeout);
    })
    .then(() => {
      // Verify the processor was added and return reference
      return cy
        .findProcessorOnCanvas(processorDef.type || 'JWT_AUTHENTICATOR', { timeout: 2000 })
        .then((addedProcessor) => {
          if (addedProcessor) {
            cy.log(`✅ Successfully added ${processorDef.displayName}`);
            return addedProcessor;
          } else {
            throw new Error(`Failed to verify processor addition: ${processorDef.displayName}`);
          }
        });
    });
}

/**
 * Find a working canvas selector
 * @param {Array<string>} selectors - Canvas selectors to try
 * @param {number} timeout - Timeout
 * @returns {Cypress.Chainable} Promise
 */
function findWorkingCanvasSelector(selectors, timeout) {
  return cy.get('body').then(($body) => {
    for (const selector of selectors) {
      const elements = $body.find(selector);
      if (elements.length > 0) {
        cy.log(`✅ Found canvas using selector: ${selector}`);
        return cy.get(selector, { timeout }).should('be.visible');
      }
    }
    throw new Error(`No canvas found using selectors: ${selectors.join(', ')}`);
  });
}

/**
 * Try different methods to open the Add Processor dialog
 * @returns {Cypress.Chainable} Promise
 */
function tryOpenAddProcessorDialog() {
  cy.log('🚀 Attempting to open Add Processor dialog');

  // Strategy 1: Try toolbar button
  return cy.get('body').then(($body) => {
    const toolbarButtons = $body.find(SELECTORS.TOOLBAR_ADD);
    if (toolbarButtons.length > 0) {
      cy.log('📋 Trying toolbar button approach');
      cy.get(SELECTORS.TOOLBAR_ADD).first().click();
      return cy.get(SELECTORS.ADD_PROCESSOR_DIALOG, { timeout: 2000 });
    }

    // Strategy 2: Try right-click on canvas - use flexible canvas selector
    cy.log('🖱️ Trying right-click on canvas approach');
    const canvasSelectors = ['svg', '#canvas', '#canvas-container'];

    for (const selector of canvasSelectors) {
      const elements = $body.find(selector);
      if (elements.length > 0) {
        return cy
          .get(selector)
          .first() // Only target the first element to avoid multiple element error
          .rightclick(400, 300)
          .then(() => {
            // Look for context menu with "Add Processor" option
            return cy.get('body').then(($contextBody) => {
              const contextMenus = $contextBody.find(SELECTORS.CONTEXT_MENU);
              if (contextMenus.length > 0) {
                cy.get(SELECTORS.CONTEXT_MENU).contains('Add', { matchCase: false }).click();
                return cy.get(SELECTORS.ADD_PROCESSOR_DIALOG, { timeout: 2000 });
              }

              // Strategy 3: Try double-click on canvas
              cy.log('🖱️ Trying double-click on canvas approach');
              return cy
                .get(selector)
                .first() // Only target the first element
                .dblclick(400, 300)
                .then(() => {
                  return cy.get(SELECTORS.ADD_PROCESSOR_DIALOG, { timeout: 2000 });
                });
            });
          });
      }
    }

    throw new Error('Could not find any canvas element to interact with');
  });
}

/**
 * Confirm processor addition
 * @param {number} timeout - Timeout
 * @returns {Cypress.Chainable} Promise
 */
function confirmProcessorAddition(timeout) {
  cy.log('✅ Confirming processor addition');

  return cy
    .get(SELECTORS.ADD_BUTTON, { timeout })
    .click()
    .then(() => {
      // Wait for dialog to close
      cy.get(SELECTORS.ADD_PROCESSOR_DIALOG, { timeout: 2000 }).should('not.exist');
    });
}

/**
 * Perform processor removal workflow
 * @param {ProcessorReference} processor - Processor to remove
 * @param {boolean} confirmDeletion - Whether to confirm deletion
 * @param {number} timeout - Timeout
 * @returns {Cypress.Chainable<boolean>} Success status
 */
function performProcessorRemoval(processor, confirmDeletion, timeout) {
  cy.log(`🗑️ Removing processor: ${processor.name}`);

  // Right-click on processor to open context menu
  return cy.get('body').then(() => {
    if (processor.element && processor.element.length > 0) {
      processor.element[0].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

      // Look for delete option in context menu
      return cy
        .get(SELECTORS.CONTEXT_MENU, { timeout })
        .should('be.visible')
        .then(() => {
          return cy
            .get(SELECTORS.CONTEXT_MENU_DELETE)
            .click()
            .then(() => {
              if (confirmDeletion) {
                // Handle confirmation dialog if it appears
                return cy.get('body').then(($body) => {
                  const deleteButtons = $body.find(SELECTORS.DELETE_BUTTON);
                  if (deleteButtons.length > 0) {
                    cy.get(SELECTORS.DELETE_BUTTON).click();
                  }
                  return true;
                });
              }
              return true;
            });
        });
    } else {
      cy.log('⚠️ Processor element not found for removal');
      return false;
    }
  });
}
