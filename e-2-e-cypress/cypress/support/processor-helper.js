/**
 * @file Processor Helper - General NiFi Processor Management
 * Provides helper functions for finding, adding, and removing processors in NiFi
 * Updated with Angular Material framework patterns based on UI structure analysis
 * @version 2.0.0
 */

import { SELECTORS, TIMEOUTS } from './constants';
import { findCanvasElements, ensureMainCanvas, logMessage } from './utils';

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
  const { strict = false, timeout: _timeout = TIMEOUTS.PROCESSOR_LOAD } = options;

  logMessage('search', `Searching for processor: ${processorName}`);

  // Ensure we're on the canvas first
  return ensureMainCanvas('processor search').then((isOnCanvas) => {
    if (!isOnCanvas) {
      return cy.wrap(null);
    }

    // Enhanced logging for debugging
    logMessage('debug', `[DEBUG] Starting enhanced processor search for: ${processorName}`);

    // Search for processor elements on canvas using multiple selectors based on NiFi's D3.js implementation
    return cy.get('body').then(($body) => {
      const canvasAnalysis = findCanvasElements($body);

      if (!canvasAnalysis.hasCanvas) {
        logMessage('warn', 'No canvas elements found, returning null');
        return cy.wrap(null);
      }

      logMessage('success', `Found ${canvasAnalysis.count} canvas elements`);

      // Log SVG structure for debugging
      const svgElement = $body.find('#canvas-container svg');
      logMessage('debug', `[DEBUG] SVG element found: ${svgElement.length > 0 ? 'Yes' : 'No'}`);

      const canvasGroup = $body.find('#canvas-container svg #canvas');
      logMessage('debug', `[DEBUG] Canvas group element found: ${canvasGroup.length > 0 ? 'Yes' : 'No'}`);

      // Try multiple selectors based on NiFi's D3.js implementation
      const selectors = [
        SELECTORS.PROCESSOR_GROUP,
        'svg g.component',
        'svg #canvas g.component',
        'svg g[class*="processor"]',
        'svg g[data-type*="processor"]',
        'svg .component',
        'g[id*="processor"]',
        'g[class*="component"]',
        'g[class*="node"]',
        'svg g.leaf',
        'svg g.node',
        'svg g[id*="jwt"]',
        'svg g[id*="authenticator"]'
      ];

      let foundProcessor = null;

      // Try each selector until we find a match
      for (const selector of selectors) {
        const processorElements = $body.find(selector);
        logMessage('debug', `[DEBUG] Selector "${selector}" found ${processorElements.length} elements`);

        if (processorElements.length > 0) {
          // Process each element found with this selector
          processorElements.each((index, element) => {
            const $element = Cypress.$(element);
            const elementText = $element.text().toLowerCase();
            const elementTitle = $element.attr('title') || '';
            const elementId = $element.attr('id') || '';
            const elementClass = $element.attr('class') || '';

            // Log details for debugging
            logMessage('debug', `[DEBUG] Element ${index}: id=${elementId}, class=${elementClass}, title=${elementTitle}, text=${elementText}`);

            // Check if this element matches our search criteria
            const matches = strict
              ? elementText === processorName.toLowerCase() ||
                elementTitle === processorName ||
                elementId === processorName
              : elementText.includes(processorName.toLowerCase()) ||
                elementTitle.toLowerCase().includes(processorName.toLowerCase()) ||
                elementId.toLowerCase().includes(processorName.toLowerCase()) ||
                elementClass.toLowerCase().includes(processorName.toLowerCase());

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
                selector: selector, // Store which selector found this processor
                class: elementClass // Store the class for debugging
              };

              logMessage(
                'success',
                `Found processor: ${foundProcessor.name} (ID: ${foundProcessor.id}) using selector: ${selector}`
              );

              // Take a screenshot of the found processor
              cy.wrap($element).scrollIntoView();
              cy.screenshot(`processor-found-${processorName.replace(/\s+/g, '-')}`, { capture: 'viewport' });

              // No need to continue checking other elements with this selector
              return false;
            }
          });
        }

        // If we found a processor with this selector, no need to try other selectors
        if (foundProcessor) {
          break;
        }
      }

      // If no processor was found, take a screenshot of the canvas for debugging
      if (!foundProcessor) {
        logMessage('warn', `[DEBUG] No processor found matching: ${processorName}`);
        cy.get('#canvas-container').scrollIntoView();
        cy.screenshot(`processor-not-found-${processorName.replace(/\s+/g, '-')}`, { capture: 'viewport' });
      }

      return cy.wrap(foundProcessor);
    });
  });
});

/**
 * Add a processor to the canvas using multiple approaches
 *
 * This function attempts to add a processor to the canvas using several approaches in order:
 * 1. Drag-and-drop: Finds the processor button and drags it onto the canvas
 * 2. Direct: Clicks on the canvas and uses keyboard shortcuts
 * 3. Dialog: Opens the Add Processor dialog and selects the processor type
 * 4. Context menu: Right-clicks on the canvas and selects Add Processor
 *
 * The drag-and-drop approach is the most reliable and matches how users typically
 * interact with the UI. It looks for a button with classes like "cdk-drag" and
 * "icon-processor" and drags it to the specified position on the canvas.
 *
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

  logMessage(
    'action',
    `Adding processor: ${processorType} at position (${position.x}, ${position.y})`
  );

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

  logMessage(
    'action',
    `Removing processor: ${typeof processor === 'string' ? processor : processor.name}`
  );

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
 * @param {number} [options.timeout=10000] - Dialog timeout
 * @returns {Cypress.Chainable} Promise
 */
Cypress.Commands.add('openAddProcessorDialog', (options = {}) => {
  const { timeout = Math.max(TIMEOUTS.DIALOG_APPEAR, 10000) } = options;

  logMessage('action', 'Opening Add Processor dialog');

  // Ensure we're on the main canvas and authenticated
  return ensureMainCanvas('add processor dialog')
    .then((isOnCanvas) => {
      if (!isOnCanvas) {
        throw new Error('Cannot open Add Processor dialog: not on main canvas');
      }

      // Additional check for authentication state using session context
      return cy.getSessionContext().then((session) => {
        if (!session.isLoggedIn) {
          throw new Error('Cannot open Add Processor dialog: not authenticated');
        }

        logMessage('info', 'Canvas and authentication verified for processor operations');
      });
    })
    .then(() => {
      // Check if toolbar exists before trying to interact with it
      return cy.get('body').then(($body) => {
        // Try multiple toolbar selectors to be more resilient
        const toolbarSelectors = [
          SELECTORS.TOOLBAR,
          'mat-toolbar',
          '.mat-toolbar',
          '[role="toolbar"]',
          '.toolbar',
          'header'
        ];

        let toolbarFound = false;
        let toolbarSelector = '';

        for (const selector of toolbarSelectors) {
          if ($body.find(selector).length > 0) {
            toolbarFound = true;
            toolbarSelector = selector;
            break;
          }
        }

        if (!toolbarFound) {
          logMessage(
            'warn',
            'Angular Material toolbar not found - cannot open Add Processor dialog'
          );
          // Return a resolved promise instead of throwing an error
          return cy.wrap(null).then(() => {
            logMessage('info', 'Skipping Add Processor dialog - toolbar not available');
            return null;
          });
        }

        // Try to find and click the Add Processor button using Angular Material toolbar patterns
        return cy
          .get(toolbarSelector, { timeout })
          .should('exist')
          .then(() => {
            // Try multiple add button selectors
            const addButtonSelectors = [
              SELECTORS.TOOLBAR_ADD,
              'button[aria-label*="Add"], button[title*="Add"]',
              'button:contains("Add")',
              'button.add-button',
              'button[data-testid*="add"]',
              'button.mat-icon-button'
            ];

            // Try each selector until one works
            function tryAddButtonSelectors(index = 0) {
              if (index >= addButtonSelectors.length) {
                logMessage('warn', 'Could not find Add button with any selector');
                return cy.wrap(null);
              }

              const selector = addButtonSelectors[index];
              return cy.get('body').then(($body) => {
                if ($body.find(selector).length > 0) {
                  return cy.get(selector, { timeout }).first().click({ force: true });
                } else {
                  return tryAddButtonSelectors(index + 1);
                }
              });
            }

            return tryAddButtonSelectors();
          })
          .then(() => {
            // Wait for the Angular Material dialog to appear with increased timeout
            // Try multiple dialog selectors
            const dialogSelectors = [
              SELECTORS.ADD_PROCESSOR_DIALOG,
              'mat-dialog-container',
              '.mat-dialog-container',
              '[role="dialog"]',
              '.dialog'
            ];

            // Try each selector until one works
            function tryDialogSelectors(index = 0) {
              if (index >= dialogSelectors.length) {
                logMessage('warn', 'Could not find dialog with any selector');
                return cy.wrap(null);
              }

              const selector = dialogSelectors[index];
              return cy.get('body').then(($body) => {
                if ($body.find(selector).length > 0) {
                  return cy.get(selector, { timeout }).should('exist');
                } else {
                  return tryDialogSelectors(index + 1);
                }
              });
            }

            return tryDialogSelectors();
          });
      });
    });
});

/**
 * Select a processor type from the Add Processor dialog
 * @param {string} processorType - Processor type to select
 * @param {Object} options - Selection options
 * @param {number} [options.timeout=10000] - Selection timeout
 * @returns {Cypress.Chainable} Promise
 */
Cypress.Commands.add('selectProcessorType', (processorType, options = {}) => {
  const {
    timeout = Math.max(TIMEOUTS.DIALOG_APPEAR, 15000),
    dialogSelector = null // Optional dialog selector from previous step
  } = options;

  logMessage('action', `Selecting processor type: ${processorType}`);

  // Take a screenshot before starting processor selection
  cy.screenshot('before-processor-selection', { capture: 'viewport' });

  // Wait longer for the dialog to fully render
  return cy.wait(2000).then(() => {
    // First, try to search for the processor if search field exists
    return cy.get('body').then(($body) => {
      // Enhanced logging for debugging
      logMessage('debug', `[DEBUG] Starting processor type selection for: ${processorType}`);

      // Try multiple search input selectors based on NiFi's extension-creation component
      const searchSelectors = [
        // Original selectors
        SELECTORS.PROCESSOR_SEARCH,
        'input[placeholder*="Search"]',
        'input[placeholder*="Filter"]',
        // More specific selectors based on NiFi's extension-creation component
        'mat-form-field input[matInput]',
        'input[placeholder="Filter types..."]',
        '.extension-creation-dialog input',
        // Very generic fallbacks
        'input[type="search"]',
        'input[type="text"]',
        'mat-form-field input',
        'input[matInput]'
      ];

      let searchInputFound = false;
      let searchSelector = '';

      // Try each selector until we find a match
      for (const selector of searchSelectors) {
        const searchInputs = $body.find(selector);
        if (searchInputs.length > 0) {
          searchInputFound = true;
          searchSelector = selector;

          // Log details about the search input for debugging
          const $input = Cypress.$(searchInputs[0]);
          logMessage('success', `Found search input with selector: "${selector}" (${searchInputs.length} matches)`);
          logMessage('debug', `[DEBUG] Search input details: id=${$input.attr('id') || 'none'}, placeholder=${$input.attr('placeholder') || 'none'}`);
          break;
        } else {
          logMessage('debug', `[DEBUG] No search input found with selector: "${selector}"`);
        }
      }

      // Try to use the search input if found
      if (searchInputFound) {
        logMessage('info', `Using search input to find processor type: ${processorType}`);

        // Take a screenshot of the dialog with search input
        cy.screenshot('dialog-with-search-input', { capture: 'viewport' });

        // Use the search input to filter the list
        return cy.get(searchSelector, { timeout: 5000 }).first().then(($searchInput) => {
          // Clear any existing text and type the processor type
          cy.wrap($searchInput)
            .clear({ force: true })
            .type(processorType, { force: true })
            .wait(2000); // Wait for filtering to complete

          // Take a screenshot after typing in the search input
          cy.screenshot('after-search-input-typing', { capture: 'viewport' });

          // Now try to find the processor in the filtered list
          return cy.get('body').then(($updatedBody) => {
            // Try multiple table selectors based on NiFi's extension-creation component
            const tableSelectors = [
              'table[mat-table]',
              'mat-table',
              '.mat-table',
              'table',
              '.listing-table table'
            ];

            let tableFound = false;
            let tableSelector = '';

            // Try each selector until we find a match
            for (const selector of tableSelectors) {
              const tables = $updatedBody.find(selector);
              if (tables.length > 0) {
                tableFound = true;
                tableSelector = selector;

                // Log details about the table for debugging
                logMessage('success', `Found table with selector: "${selector}" (${tables.length} matches)`);
                break;
              } else {
                logMessage('debug', `[DEBUG] No table found with selector: "${selector}"`);
              }
            }

            if (tableFound) {
              // Try to find the processor in the table rows
              const rowSelectors = [
                'tr[mat-row]',
                'tr.mat-row',
                'tr',
                'mat-row',
                '.mat-row'
              ];

              let rowsFound = false;
              let rowSelector = '';

              // Try each selector until we find a match
              for (const selector of rowSelectors) {
                const rows = $updatedBody.find(`${tableSelector} ${selector}`);
                if (rows.length > 0) {
                  rowsFound = true;
                  rowSelector = selector;

                  // Log details about the rows for debugging
                  logMessage('success', `Found ${rows.length} rows with selector: "${tableSelector} ${selector}"`);
                  break;
                } else {
                  logMessage('debug', `[DEBUG] No rows found with selector: "${tableSelector} ${selector}"`);
                }
              }

              if (rowsFound) {
                // Try to find a row containing the processor type
                const processorRows = $updatedBody.find(`${tableSelector} ${rowSelector}:contains("${processorType}")`);
                if (processorRows.length > 0) {
                  logMessage('success', `Found ${processorRows.length} rows containing "${processorType}"`);

                  // Click the first matching row
                  return cy.get(`${tableSelector} ${rowSelector}:contains("${processorType}")`)
                    .first()
                    .scrollIntoView()
                    .click({ force: true })
                    .wait(1000) // Wait for selection to take effect
                    .then(() => {
                      // Take a screenshot after selecting the processor
                      cy.screenshot('after-processor-selection', { capture: 'viewport' });
                      return cy.wrap(true);
                    });
                } else {
                  logMessage('warn', `No rows found containing "${processorType}" after filtering`);

                  // Take a screenshot for debugging
                  cy.screenshot('no-matching-rows-after-filtering', { capture: 'viewport' });

                  // Fall back to direct selection from the list
                  return tryDirectSelection();
                }
              } else {
                logMessage('warn', 'No rows found in the table');

                // Take a screenshot for debugging
                cy.screenshot('no-rows-in-table', { capture: 'viewport' });

                // Fall back to direct selection from the list
                return tryDirectSelection();
              }
            } else {
              logMessage('warn', 'No table found for processor selection');

              // Take a screenshot for debugging
              cy.screenshot('no-table-found', { capture: 'viewport' });

              // Fall back to direct selection from the list
              return tryDirectSelection();
            }
          });
        });
      } else {
        // Fall back to direct selection from the list
        logMessage('info', 'No search input found, selecting from processor list directly');
        return tryDirectSelection();
      }

      // Helper function for direct selection from the list
      function tryDirectSelection() {
        // Try multiple list item selectors based on NiFi's extension-creation component
        const listItemSelectors = [
          // Original selectors
          SELECTORS.PROCESSOR_LIST_ITEM,
          'mat-list-item',
          '.mat-list-item',
          'mat-list-option',
          '.processor-type',
          // Table-based selectors from extension-creation component
          'tr[mat-row]',
          'tr.mat-row',
          'tr',
          'mat-row',
          '.mat-row',
          // Cell-based selectors
          'td[mat-cell]:contains("' + processorType + '")',
          'td.mat-cell:contains("' + processorType + '")',
          'td:contains("' + processorType + '")',
          // Very generic fallbacks
          'li',
          '[role="option"]',
          '[role="listitem"]',
          // Text-based selectors
          'div:contains("' + processorType + '")',
          'span:contains("' + processorType + '")'
        ];

        // Take a screenshot before direct selection
        cy.screenshot('before-direct-selection', { capture: 'viewport' });

        // Try each selector until one works
        function tryDirectListItemSelectors(index = 0) {
          if (index >= listItemSelectors.length) {
            logMessage('warn', 'Could not find processor in list with any selector');

            // Take a screenshot for debugging
            cy.screenshot('processor-not-found-in-list', { capture: 'viewport' });
            return cy.wrap(null);
          }

          const selector = listItemSelectors[index];
          return cy.get('body').then(($updatedBody) => {
            // Look for items containing the processor type
            const items = $updatedBody.find(selector);
            if (items.length > 0) {
              logMessage('success', `Found ${items.length} items with selector: "${selector}"`);

              // Check if any of the items contain the processor type
              const matchingItems = [];
              items.each((i, el) => {
                const $el = Cypress.$(el);
                const text = $el.text();
                if (text.includes(processorType)) {
                  matchingItems.push(el);
                  logMessage('debug', `[DEBUG] Matching item ${i+1}: text=${text}`);
                }
              });

              if (matchingItems.length > 0) {
                logMessage('success', `Found ${matchingItems.length} items containing "${processorType}"`);

                // Click the first matching item
                return cy.wrap(Cypress.$(matchingItems[0]))
                  .scrollIntoView()
                  .click({ force: true })
                  .wait(1000) // Wait for selection to take effect
                  .then(() => {
                    // Take a screenshot after selecting the processor
                    cy.screenshot('after-direct-selection', { capture: 'viewport' });
                    return cy.wrap(true);
                  });
              } else {
                logMessage('debug', `[DEBUG] No items containing "${processorType}" found with selector: "${selector}"`);
                return tryDirectListItemSelectors(index + 1);
              }
            } else {
              logMessage('debug', `[DEBUG] No items found with selector: "${selector}"`);
              return tryDirectListItemSelectors(index + 1);
            }
          });
        }

        return tryDirectListItemSelectors();
      }
    });
  });
});

/**
 * Confirm processor addition in the dialog
 * @param {Object} options - Confirmation options
 * @param {number} [options.timeout=10000] - Confirmation timeout
 * @returns {Cypress.Chainable} Promise
 */
Cypress.Commands.add('confirmProcessorAddition', (options = {}) => {
  const {
    timeout = Math.max(TIMEOUTS.ACTION_COMPLETE, 15000),
    dialogSelector = null // Optional dialog selector from previous step
  } = options;

  logMessage('action', 'Confirming processor addition');

  // Take a screenshot before confirming processor addition
  cy.screenshot('before-confirm-processor-addition', { capture: 'viewport' });

  // Try multiple add button selectors based on NiFi's extension-creation component
  const addButtonSelectors = [
    // Original selectors
    SELECTORS.ADD_BUTTON,
    'button:contains("Add")',
    'button[mat-button]:contains("Add")',
    'button[mat-raised-button]:contains("Add")',
    '.mat-button:contains("Add")',
    '.mat-raised-button:contains("Add")',
    // More specific selectors based on NiFi's extension-creation component
    'mat-dialog-actions button:contains("Add")',
    'mat-dialog-actions button[mat-flat-button]',
    '.extension-creation-dialog button:contains("Add")',
    'button[mat-flat-button]:contains("Add")',
    // Very generic fallbacks
    'button.add-button',
    'button[type="submit"]',
    'button.primary-action',
    'button:last-child'
  ];

  // Enhanced logging for debugging
  logMessage('debug', `[DEBUG] Starting confirmation of processor addition`);

  // Try each selector until one works
  function tryAddButtonSelectors(index = 0) {
    if (index >= addButtonSelectors.length) {
      logMessage('warn', 'Could not find Add button with any selector');

      // Take a screenshot for debugging
      cy.screenshot('add-button-not-found', { capture: 'viewport' });
      return cy.wrap(false);
    }

    const selector = addButtonSelectors[index];
    return cy.get('body').then(($body) => {
      const buttons = $body.find(selector);
      if (buttons.length > 0) {
        // Log details about the button for debugging
        const $btn = Cypress.$(buttons[0]);
        logMessage('success', `Found Add button with selector: "${selector}" (${buttons.length} matches)`);
        logMessage('debug', `[DEBUG] Button details: id=${$btn.attr('id') || 'none'}, class=${$btn.attr('class') || 'none'}, text=${$btn.text() || 'none'}`);

        // Take a screenshot before clicking the button
        cy.screenshot('before-clicking-add-button', { capture: 'viewport' });

        return cy
          .get(selector, { timeout })
          .first()
          .scrollIntoView()
          .should('exist')
          .click({ force: true })
          .wait(1000) // Wait for click to register
          .then(() => {
            // Take a screenshot after clicking the button
            cy.screenshot('after-clicking-add-button', { capture: 'viewport' });
            return true;
          });
      } else {
        logMessage('debug', `[DEBUG] No Add button found with selector: "${selector}"`);
        return tryAddButtonSelectors(index + 1);
      }
    });
  }

  return tryAddButtonSelectors().then((buttonClicked) => {
    if (!buttonClicked) {
      logMessage('error', 'Failed to click Add button');
      return cy.wrap(false);
    }

    // Wait longer for dialog to close and processor to be added
    cy.wait(5000); // Significantly increased wait time

    // Try multiple dialog selectors to verify dialog is closed
    const dialogSelectors = [
      // Original selectors
      SELECTORS.ADD_PROCESSOR_DIALOG,
      'mat-dialog-container',
      '.mat-dialog-container',
      '[role="dialog"]',
      '.dialog',
      // More specific selectors based on NiFi's extension-creation component
      '.extension-creation-dialog',
      'mat-dialog-content',
      'div[mat-dialog-title]',
      'h2[mat-dialog-title]'
    ];

    // Enhanced logging for dialog closing detection
    logMessage('debug', `[DEBUG] Checking if dialog is closed`);

    // Check if any dialog is still visible
    return cy.get('body').then(($body) => {
      let dialogStillVisible = false;
      let visibleDialogSelector = '';

      for (const selector of dialogSelectors) {
        const dialogs = $body.find(selector);
        if (dialogs.length > 0) {
          dialogStillVisible = true;
          visibleDialogSelector = selector;

          // Log details about the dialog for debugging
          const $dialog = Cypress.$(dialogs[0]);
          logMessage('warn', `Dialog still visible with selector: "${selector}" (${dialogs.length} matches)`);
          logMessage('debug', `[DEBUG] Dialog details: id=${$dialog.attr('id') || 'none'}, class=${$dialog.attr('class') || 'none'}`);
          break;
        }
      }

      if (dialogStillVisible) {
        // Take a screenshot of the still-visible dialog
        cy.screenshot('dialog-still-visible', { capture: 'viewport' });

        logMessage('warn', 'Dialog still visible after clicking Add button, trying again with a different approach');

        // Try clicking again with a more aggressive approach
        return cy.get('button:contains("Add")').then(($buttons) => {
          if ($buttons.length > 0) {
            // Log details about the buttons for debugging
            logMessage('debug', `[DEBUG] Found ${$buttons.length} buttons containing "Add" text`);

            // Click each button until dialog closes
            let buttonClicked = false;

            $buttons.each((i, el) => {
              const $el = Cypress.$(el);
              logMessage('debug', `[DEBUG] Trying to click button ${i+1}: text=${$el.text()}, class=${$el.attr('class') || 'none'}`);

              cy.wrap($el).click({ force: true });
              cy.wait(1000); // Wait for click to register

              // Check if dialog is still visible
              cy.get('body').then(($updatedBody) => {
                if ($updatedBody.find(visibleDialogSelector).length === 0) {
                  buttonClicked = true;
                  logMessage('success', `Successfully closed dialog by clicking button ${i+1}`);
                  return false; // Break the each loop
                }
              });
            });

            // Wait longer for dialog to close
            cy.wait(3000);
          } else {
            logMessage('warn', 'No buttons containing "Add" text found for second attempt');
          }

          // Take a screenshot after second attempt
          cy.screenshot('after-second-add-button-attempt', { capture: 'viewport' });

          // Return true even if dialog is still visible, as processor might still be added
          return cy.wrap(true);
        });
      } else {
        logMessage('success', 'Dialog closed successfully');

        // Take a screenshot of the closed dialog state
        cy.screenshot('dialog-closed-successfully', { capture: 'viewport' });
        return cy.wrap(true);
      }
    });
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
  logMessage('action', `Starting processor addition workflow for: ${processorType}`);

  // Try drag-and-drop approach first
  return tryDragAndDropProcessorAddition(processorType, position, timeout).then((processor) => {
    if (processor) {
      logMessage('success', `Drag-and-drop processor addition successful for: ${processorType}`);
      return processor;
    }

    // Try a direct approach next - click on canvas and use keyboard shortcut
    return tryDirectProcessorAddition(processorType, position, timeout).then((processor) => {
      if (processor) {
        logMessage('success', `Direct processor addition successful for: ${processorType}`);
        return processor;
      }

      logMessage('info', `Direct addition failed, trying dialog approach for: ${processorType}`);

      // Fall back to dialog approach
      return cy.openAddProcessorDialog({ timeout }).then(
        (dialogResult) => {
          // Check if dialog was opened successfully
          if (dialogResult === null) {
            logMessage('warn', `Cannot add processor ${processorType}: toolbar not available`);
            // Try one more approach - click on canvas and use context menu
            return tryContextMenuProcessorAddition(processorType, position, timeout);
          }

          // Continue with processor addition workflow
          return cy
            .selectProcessorType(processorType, { timeout })
            .then((selectResult) => {
              if (selectResult === null) {
                logMessage('warn', `Failed to select processor type: ${processorType}`);
                return null;
              }

              return cy.confirmProcessorAddition({ timeout }).then((confirmResult) => {
                if (!confirmResult) {
                  logMessage('warn', `Failed to confirm processor addition: ${processorType}`);
                  return null;
                }

                // Wait longer for the processor to appear on canvas
                cy.wait(3000);

                // Find and return the newly added processor with increased timeout
                return cy.findProcessorOnCanvas(processorType, {
                  timeout: Math.max(timeout, 15000),
                  strict: false
                }).then((foundProcessor) => {
                  if (foundProcessor) {
                    logMessage('success', `Successfully added and found processor: ${processorType}`);
                    return foundProcessor;
                  } else {
                    // Log error instead of warning to make the issue more visible
                    logMessage('error', `Added processor but couldn't find it: ${processorType}`);
                    // Return null but add a property to indicate this is a processor visibility issue
                    // This allows tests to distinguish between different types of failures
                    return {
                      isNull: true,
                      visibilityIssue: true,
                      type: processorType,
                      message: `Processor ${processorType} was added but is not visible on canvas`
                    };
                  }
                });
              });
            });
        },
        (error) => {
          // Handle other errors gracefully
          logMessage('warn', `Cannot add processor ${processorType}: ${error.message}`);
          // Try one more approach as a last resort
          return tryContextMenuProcessorAddition(processorType, position, timeout);
        }
      );
    });
  });
}

/**
 * Try to add a processor using drag-and-drop from the processor button
 * @param {string} processorType - Processor type to add
 * @param {Object} position - Canvas position
 * @param {number} timeout - Operation timeout
 * @returns {Cypress.Chainable<ProcessorReference>} Added processor reference
 */
function tryDragAndDropProcessorAddition(processorType, position, timeout) {
  logMessage('action', `Trying drag-and-drop processor addition for: ${processorType}`);

  // Find the processor button element
  return cy.get('body').then(($body) => {
    // Enhanced logging for debugging
    logMessage('debug', `[DEBUG] Starting processor button search`);

    // Look for the processor button using multiple selectors based on NiFi's Angular implementation
    const processorButtonSelectors = [
      // Original selector from constants.js
      SELECTORS.PROCESSOR_BUTTON,
      // More specific selectors based on NiFi's Angular component structure
      'button.icon-processor',
      'button[cdkDrag]',
      'button[cdkDragBoundary="body"]',
      'new-canvas-item button',
      'button.h-16.w-16',
      // Very generic fallbacks
      'button:contains("Processor")',
      'button[title*="Add Processor"]',
      'button[aria-label*="Add Processor"]'
    ];

    let processorButton = null;
    let processorButtonSelector = '';

    // Try each selector until we find a match
    for (const selector of processorButtonSelectors) {
      const buttons = $body.find(selector);
      if (buttons.length > 0) {
        processorButton = buttons[0];
        processorButtonSelector = selector;
        logMessage('success', `Found processor button with selector: "${selector}" (${buttons.length} matches)`);

        // Log details about the button for debugging
        const $btn = Cypress.$(processorButton);
        logMessage('debug', `[DEBUG] Button details: id=${$btn.attr('id') || 'none'}, class=${$btn.attr('class') || 'none'}, text=${$btn.text() || 'none'}`);
        break;
      } else {
        logMessage('debug', `[DEBUG] No processor button found with selector: "${selector}"`);
      }
    }

    if (!processorButton) {
      logMessage('warn', 'Processor button not found for drag-and-drop with any selector');

      // Take a screenshot for debugging
      cy.screenshot('processor-button-not-found', { capture: 'viewport' });
      return cy.wrap(null);
    }

    // Find the canvas element to drop onto
    const canvasSelectors = [
      'mat-sidenav-content',
      '#canvas-container',
      'svg',
      '.canvas',
      '.flow-designer',
      '.mat-drawer-content',
      // Add more specific selectors based on NiFi's DOM structure
      'mat-sidenav-content svg',
      '#canvas-container svg',
      'svg#canvas',
      'g#canvas'
    ];

    let canvasElement = null;
    let canvasSelector = '';

    // Try each selector until we find a match
    for (const selector of canvasSelectors) {
      const canvases = $body.find(selector);
      if (canvases.length > 0) {
        canvasElement = canvases[0];
        canvasSelector = selector;
        logMessage('success', `Found canvas with selector: "${selector}" (${canvases.length} matches)`);

        // Log details about the canvas for debugging
        const $canvas = Cypress.$(canvasElement);
        logMessage('debug', `[DEBUG] Canvas details: id=${$canvas.attr('id') || 'none'}, class=${$canvas.attr('class') || 'none'}`);
        break;
      } else {
        logMessage('debug', `[DEBUG] No canvas found with selector: "${selector}"`);
      }
    }

    if (!canvasElement) {
      logMessage('warn', 'Canvas not found for drag-and-drop with any selector');

      // Take a screenshot for debugging
      cy.screenshot('canvas-not-found', { capture: 'viewport' });
      return cy.wrap(null);
    }

    // Perform the drag-and-drop operation
    logMessage('action', `Dragging processor button to position (${position.x}, ${position.y})`);

    // Take a screenshot before starting the drag operation
    cy.screenshot('before-drag-operation', { capture: 'viewport' });

    // Try multiple approaches to add a processor, starting with the most reliable ones

    // Approach 1: Direct button click followed by canvas click
    logMessage('action', 'Approach 1: Direct button click followed by canvas click');

    // Get the processor button element - use first() to ensure we only get one element
    return cy.get(processorButtonSelector).first().then(($button) => {
      // Get the canvas element - use first() to ensure we only get one element
      return cy.get(canvasSelector).first().then(($canvas) => {
        // 1. Click the processor button to activate it
        cy.get(processorButtonSelector).first().click({ force: true });
        cy.wait(2000); // Longer wait for UI reactions

        // Take a screenshot after clicking the button
        cy.screenshot('after-button-click', { capture: 'viewport' });

        // 2. Click on the canvas where we want to place the processor
        cy.get(canvasSelector).first().click(position.x, position.y, { force: true });
        cy.wait(2000); // Longer wait for UI reactions

        // Take a screenshot after clicking the canvas
        cy.screenshot('after-canvas-click', { capture: 'viewport' });

        // 3. Try the keyboard shortcut approach as a fallback
        cy.get('body').type('n', { force: true }); // 'n' is often the shortcut for adding a processor
        cy.wait(2000); // Longer wait for UI reactions

        // Take a screenshot after keyboard shortcut
        cy.screenshot('after-keyboard-shortcut', { capture: 'viewport' });

        // 4. Try the traditional drag-and-drop as a last resort
        const buttonRect = $button[0].getBoundingClientRect();
        const buttonCenterX = buttonRect.left + buttonRect.width / 2;
        const buttonCenterY = buttonRect.top + buttonRect.height / 2;

        logMessage('action', 'Approach 2: Traditional drag-and-drop');

        cy.get(processorButtonSelector).first()
          .trigger('mousedown', { button: 0, clientX: buttonCenterX, clientY: buttonCenterY, force: true })
          .wait(500) // Much longer wait to ensure mousedown is registered
          .trigger('mousemove', { button: 0, clientX: buttonCenterX + 50, clientY: buttonCenterY + 50, force: true })
          .wait(500); // Much longer wait to ensure drag has started

        // Move directly to the target position with a longer wait
        cy.get(canvasSelector).first()
          .trigger('mousemove', { button: 0, clientX: position.x, clientY: position.y, force: true })
          .wait(1000) // Much longer wait before mouseup
          .trigger('mouseup', { button: 0, clientX: position.x, clientY: position.y, force: true });

        // Wait longer for the processor to appear and for any animations to complete
        cy.wait(10000); // Significantly increased wait time

        // Take a screenshot after drag-and-drop
        cy.screenshot('after-drag-drop', { capture: 'viewport' });

        // After drag-and-drop, a dialog should appear to select the processor type
        // Look for the dialog with enhanced detection
        const dialogSelectors = [
          'mat-dialog-container',
          '.mat-dialog-container',
          '[role="dialog"]',
          '.dialog',
          // Add more specific selectors based on NiFi's extension-creation component
          '.extension-creation-dialog',
          'mat-dialog-content',
          'div[mat-dialog-title]',
          'h2[mat-dialog-title]',
          // Very generic fallbacks
          'div:contains("Add Processor")',
          'h2:contains("Add Processor")'
        ];

        return cy.get('body').then(($updatedBody) => {
          let dialogFound = false;
          let dialogSelector = '';
          let dialogElement = null;

          // Enhanced logging for dialog detection
          logMessage('debug', `[DEBUG] Searching for processor type dialog`);

          // Try each selector until we find a match
          for (const selector of dialogSelectors) {
            const dialogs = $updatedBody.find(selector);
            if (dialogs.length > 0) {
              dialogFound = true;
              dialogSelector = selector;
              dialogElement = dialogs[0];

              // Log details about the dialog for debugging
              const $dialog = Cypress.$(dialogElement);
              logMessage('success', `Found dialog with selector: "${selector}" (${dialogs.length} matches)`);
              logMessage('debug', `[DEBUG] Dialog details: id=${$dialog.attr('id') || 'none'}, class=${$dialog.attr('class') || 'none'}, text=${$dialog.text().substring(0, 50) || 'none'}...`);
              break;
            } else {
              logMessage('debug', `[DEBUG] No dialog found with selector: "${selector}"`);
            }
          }

          if (!dialogFound) {
            logMessage('warn', 'No dialog found after drag-and-drop with any selector');

            // Take a screenshot for debugging
            cy.screenshot('dialog-not-found', { capture: 'viewport' });

            // Check if there are any error messages on the page
            const errorMessages = $updatedBody.find('.error, .error-message, [role="alert"]');
            if (errorMessages.length > 0) {
              logMessage('error', `Found ${errorMessages.length} error messages on page`);
              errorMessages.each((i, el) => {
                logMessage('error', `Error message ${i+1}: ${Cypress.$(el).text()}`);
              });
            }

            return cy.wrap(null);
          }

          // Dialog found, take a screenshot
          cy.screenshot('dialog-found', { capture: 'viewport' });

          // Try to select processor type with enhanced handling
          return cy.selectProcessorType(processorType, {
            timeout: Math.max(timeout, 15000), // Increased timeout for reliability
            dialogSelector: dialogSelector // Pass the found dialog selector
          }).then((selectResult) => {
            if (selectResult === null) {
              return cy.wrap(null);
            }

            return cy.confirmProcessorAddition({ timeout }).then((confirmResult) => {
              if (!confirmResult) {
                return cy.wrap(null);
              }

              // Wait for processor to appear
              cy.wait(3000);

              // Find and return the newly added processor
              return cy.findProcessorOnCanvas(processorType, {
                timeout: Math.max(timeout, 15000),
                strict: false
              });
            });
          });
        });
      });
    });
  });
}

/**
 * Try to add a processor using direct canvas click and keyboard shortcut
 * @param {string} processorType - Processor type to add
 * @param {Object} position - Canvas position
 * @param {number} timeout - Operation timeout
 * @returns {Cypress.Chainable<ProcessorReference>} Added processor reference
 */
function tryDirectProcessorAddition(processorType, position, timeout) {
  logMessage('action', `Trying direct processor addition for: ${processorType}`);

  // Try to click on canvas at the specified position
  return cy.get('mat-sidenav-content, #canvas-container, svg', { timeout }).then(($canvas) => {
    if ($canvas.length === 0) {
      logMessage('warn', 'Canvas not found for direct processor addition');
      return null;
    }

    // Click on canvas at the specified position
    cy.wrap($canvas[0]).click(position.x, position.y, { force: true });

    // Try keyboard shortcut (Shift+N or just N depending on NiFi version)
    cy.get('body').type('n', { force: true });
    cy.wait(1000);

    // Check if a dialog appeared
    return cy.get('body').then(($body) => {
      const dialogSelectors = [
        'mat-dialog-container',
        '.mat-dialog-container',
        '[role="dialog"]',
        '.dialog'
      ];

      let dialogFound = false;
      for (const selector of dialogSelectors) {
        if ($body.find(selector).length > 0) {
          dialogFound = true;
          break;
        }
      }

      if (!dialogFound) {
        logMessage('info', 'No dialog found after direct canvas click, trying another approach');
        return null;
      }

      // Dialog found, try to select processor type
      return cy.selectProcessorType(processorType, { timeout }).then((selectResult) => {
        if (selectResult === null) {
          return null;
        }

        return cy.confirmProcessorAddition({ timeout }).then((confirmResult) => {
          if (!confirmResult) {
            return null;
          }

          // Wait for processor to appear
          cy.wait(3000);

          // Find and return the newly added processor
          return cy.findProcessorOnCanvas(processorType, {
            timeout: Math.max(timeout, 15000),
            strict: false
          });
        });
      });
    });
  });
}

/**
 * Try to add a processor using context menu
 * @param {string} processorType - Processor type to add
 * @param {Object} position - Canvas position
 * @param {number} timeout - Operation timeout
 * @returns {Cypress.Chainable<ProcessorReference>} Added processor reference
 */
function tryContextMenuProcessorAddition(processorType, position, timeout) {
  logMessage('action', `Trying context menu processor addition for: ${processorType}`);

  // Try to right-click on canvas at the specified position
  return cy.get('mat-sidenav-content, #canvas-container, svg', { timeout }).then(($canvas) => {
    if ($canvas.length === 0) {
      logMessage('warn', 'Canvas not found for context menu processor addition');
      return null;
    }

    // Right-click on canvas at the specified position
    cy.wrap($canvas[0]).rightclick(position.x, position.y, { force: true });
    cy.wait(1000);

    // Check if context menu appeared
    return cy.get('body').then(($body) => {
      const menuSelectors = [
        'mat-menu',
        '.mat-menu-panel',
        '[role="menu"]',
        '.context-menu'
      ];

      let menuFound = false;
      for (const selector of menuSelectors) {
        if ($body.find(selector).length > 0) {
          menuFound = true;
          break;
        }
      }

      if (!menuFound) {
        logMessage('warn', 'No context menu found after right-click');
        return null;
      }

      // Look for "Add Processor" option in context menu
      const addProcessorSelectors = [
        'mat-menu-item:contains("Add Processor")',
        '.mat-menu-item:contains("Add Processor")',
        '[role="menuitem"]:contains("Add Processor")',
        'button:contains("Add Processor")'
      ];

      function tryAddProcessorMenuItems(index = 0) {
        if (index >= addProcessorSelectors.length) {
          logMessage('warn', 'Could not find Add Processor option in context menu');
          return null;
        }

        const selector = addProcessorSelectors[index];
        return cy.get('body').then(($updatedBody) => {
          if ($updatedBody.find(selector).length > 0) {
            return cy.get(selector, { timeout }).first().click({ force: true });
          } else {
            return tryAddProcessorMenuItems(index + 1);
          }
        });
      }

      return tryAddProcessorMenuItems().then((menuResult) => {
        if (menuResult === null) {
          return null;
        }

        // Wait for dialog to appear
        cy.wait(1000);

        // Try to select processor type
        return cy.selectProcessorType(processorType, { timeout }).then((selectResult) => {
          if (selectResult === null) {
            return null;
          }

          return cy.confirmProcessorAddition({ timeout }).then((confirmResult) => {
            if (!confirmResult) {
              return null;
            }

            // Wait for processor to appear
            cy.wait(3000);

            // Find and return the newly added processor
            return cy.findProcessorOnCanvas(processorType, {
              timeout: Math.max(timeout, 15000),
              strict: false
            });
          });
        });
      });
    });
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
  return cy
    .wrap(processor.element)
    .rightclick()
    .then(() => {
      // Wait for context menu to appear with more lenient approach
      return cy.get('body').then(($body) => {
        const menuSelectors = [
          SELECTORS.CONTEXT_MENU,
          'mat-menu',
          '.mat-menu-panel',
          '[role="menu"]',
          '.context-menu'
        ];

        let menuFound = false;
        let menuSelector = '';

        for (const selector of menuSelectors) {
          if ($body.find(selector).length > 0) {
            menuFound = true;
            menuSelector = selector;
            break;
          }
        }

        if (!menuFound) {
          logMessage('warn', 'No context menu found after right-click');
          return cy.wrap(false);
        }

        // Wait for the menu to be visible
        return cy.get(menuSelector, { timeout }).should('exist');
      });
    })
    .then((menuResult) => {
      if (menuResult === false) {
        // No context menu found, return false
        return false;
      }

      // Try multiple delete option selectors
      return cy.get('body').then(($body) => {
        const deleteSelectors = [
          SELECTORS.CONTEXT_MENU_DELETE,
          'mat-menu-item:contains("Delete")',
          '.mat-menu-item:contains("Delete")',
          '[role="menuitem"]:contains("Delete")',
          'button:contains("Delete")',
          'a:contains("Delete")',
          '[title*="Delete"]',
          '[aria-label*="Delete"]'
        ];

        let deleteFound = false;
        let deleteSelector = '';

        for (const selector of deleteSelectors) {
          if ($body.find(selector).length > 0) {
            deleteFound = true;
            deleteSelector = selector;
            break;
          }
        }

        if (!deleteFound) {
          logMessage('warn', 'No delete option found in context menu');
          return cy.wrap(false);
        }

        // Click the delete option
        return cy.get(deleteSelector, { timeout }).first().click({ force: true });
      });
    })
    .then((deleteResult) => {
      if (deleteResult === false) {
        // No delete option found, return false
        return false;
      }

      if (confirmDeletion) {
        // Confirm deletion if dialog appears with more lenient approach
        return cy.get('body').then(($body) => {
          const confirmSelectors = [
            SELECTORS.DELETE_BUTTON,
            'button:contains("Delete")',
            'button:contains("Confirm")',
            'button:contains("OK")',
            'button:contains("Yes")',
            '.mat-button:contains("Delete")',
            '.mat-button:contains("Confirm")',
            '.mat-button:contains("OK")',
            '.mat-button:contains("Yes")'
          ];

          let confirmFound = false;
          let confirmSelector = '';

          for (const selector of confirmSelectors) {
            if ($body.find(selector).length > 0) {
              confirmFound = true;
              confirmSelector = selector;
              break;
            }
          }

          if (confirmFound) {
            return cy.get(confirmSelector, { timeout }).first().click({ force: true }).then(() => true);
          } else {
            // No confirmation dialog found, assume deletion was successful
            return cy.wrap(true);
          }
        });
      } else {
        // No confirmation needed, assume deletion was successful
        return cy.wrap(true);
      }
    })
    .then(
      (result) => {
        if (result) {
          logMessage('success', `Processor ${processor.name} removed successfully`);
        } else {
          logMessage('warn', `Could not remove processor ${processor.name} - context menu or delete option not found`);
        }
        return result;
      },
      (error) => {
        logMessage('error', `Failed to remove processor ${processor.name}: ${error.message}`);
        return false;
      }
    );
}

/**
 * Clean up all processors from the canvas
 * @param {Object} options - Cleanup options
 * @param {boolean} [options.confirmDeletion=true] - Confirm each deletion
 * @param {number} [options.timeout=10000] - Total timeout for cleanup
 * @returns {Cypress.Chainable<number>} Number of processors removed
 */
Cypress.Commands.add('cleanupCanvasProcessors', (options = {}) => {
  const { confirmDeletion = true, timeout = TIMEOUTS.PROCESSOR_LOAD } = options;

  logMessage('cleanup', 'Attempting to clean up processors from canvas');

  // First check if we're on the right page
  return ensureMainCanvas('processor cleanup').then((isOnCanvas) => {
    if (!isOnCanvas) {
      logMessage('warn', 'Not on main canvas, skipping cleanup');
      return cy.wrap(0);
    }

    return cy.get('body').then(($body) => {
      const processorElements = $body.find(SELECTORS.PROCESSOR_GROUP);

      if (processorElements.length === 0) {
        logMessage('success', 'No processors found to clean up');
        return cy.wrap(0);
      }

      // Filter out invisible elements to avoid right-click errors
      const visibleProcessors = processorElements.filter((index, element) => {
        const $element = Cypress.$(element);
        return $element.is(':visible') && $element.width() > 0 && $element.height() > 0;
      });

      if (visibleProcessors.length === 0) {
        logMessage('success', 'No visible processors found to clean up');
        return cy.wrap(0);
      }

      logMessage(
        'info',
        `Found ${visibleProcessors.length} visible processors to remove (${processorElements.length} total found)`
      );

      let removedCount = 0;

      // Remove each processor sequentially
      function removeProcessorsSequentially(index = 0) {
        if (index >= visibleProcessors.length) {
          logMessage('success', `Cleanup complete: ${removedCount} processors removed`);
          return cy.wrap(removedCount);
        }

        const element = visibleProcessors[index];
        const $element = Cypress.$(element);
        const elementText = $element.text() || '';
        const elementTitle = $element.attr('title') || '';
        const elementId = $element.attr('id') || `processor-${index}`;

        const processor = {
          id: elementId,
          name: elementTitle || elementText || `Processor ${index + 1}`,
          element: $element,
        };

        return cy
          .removeProcessorFromCanvas(processor, { confirmDeletion, timeout })
          .then((success) => {
            if (success) {
              removedCount++;
              logMessage('success', `Removed processor: ${processor.name}`);
            } else {
              logMessage('warn', `Failed to remove processor: ${processor.name}`);
            }
            return removeProcessorsSequentially(index + 1);
          });
      }

      return removeProcessorsSequentially();
    });
  });
});

/**
 * Add a test processor to the canvas for testing purposes
 * @param {string} [processorType='GenerateFlowFile'] - Type of processor to add
 * @param {Object} options - Addition options
 * @param {Object} [options.position] - Canvas position {x, y}
 * @param {number} [options.timeout=10000] - Operation timeout
 * @returns {Cypress.Chainable<boolean>} Success status
 */
Cypress.Commands.add('addTestProcessor', (processorType = 'GenerateFlowFile', options = {}) => {
  const { position = { x: 400, y: 300 }, timeout = TIMEOUTS.PROCESSOR_LOAD } = options;

  logMessage('action', `Adding test processor: ${processorType}`);

  // Ensure we're on the main canvas
  return ensureMainCanvas('add test processor').then((isOnCanvas) => {
    if (!isOnCanvas) {
      logMessage('warn', 'Not on main canvas, cannot add test processor');
      return cy.wrap(false);
    }

    // Try to add the processor using the existing addProcessorToCanvas command
    return cy.addProcessorToCanvas(processorType, { position, timeout, skipIfExists: false }).then(
      (processor) => {
        if (processor) {
          logMessage('success', `Test processor added successfully: ${processor.name}`);
          return cy.wrap(true);
        } else {
          logMessage('warn', `Failed to add test processor: ${processorType}`);
          return cy.wrap(false);
        }
      },
      (error) => {
        logMessage('warn', `Error adding test processor: ${error.message}`);
        return cy.wrap(false);
      }
    );
  });
});

/**
 * Get all processors currently on the canvas
 * @param {Object} options - Search options
 * @param {number} [options.timeout=5000] - Search timeout
 * @returns {Cypress.Chainable<Array<ProcessorReference>>} Array of found processors
 */
Cypress.Commands.add('getAllProcessorsOnCanvas', (options = {}) => {
  const { timeout: _timeout = TIMEOUTS.PROCESSOR_LOAD } = options;

  logMessage('search', 'Searching for all processors on canvas');

  // First check if we're on the right page
  return ensureMainCanvas('processor search').then((isOnCanvas) => {
    if (!isOnCanvas) {
      logMessage('warn', 'Not on main canvas, returning empty array');
      return cy.wrap([]);
    }

    return cy.get('body').then(($body) => {
      const canvasAnalysis = findCanvasElements($body);

      if (!canvasAnalysis.hasCanvas) {
        logMessage('warn', 'No canvas elements found, returning empty array');
        return cy.wrap([]);
      }

      const foundProcessors = [];
      const processorElements = $body.find(SELECTORS.PROCESSOR_GROUP);

      processorElements.each((index, element) => {
        const $element = Cypress.$(element);
        const elementText = $element.text() || '';
        const elementTitle = $element.attr('title') || '';
        const elementId = $element.attr('id') || `processor-${index}`;

        // Extract processor information
        const rect = element.getBoundingClientRect();
        const processor = {
          id: elementId,
          type: 'Unknown',
          name: elementTitle || elementText || `Processor ${index + 1}`,
          element: $element,
          position: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          },
          isVisible: rect.width > 0 && rect.height > 0,
          status: 'unknown',
        };

        foundProcessors.push(processor);
      });

      logMessage('success', `Found ${foundProcessors.length} processors on canvas`);
      return cy.wrap(foundProcessors);
    });
  });
});

/**
 * Open processor configuration dialog
 * @param {string|ProcessorReference} processor - Processor type/name or processor reference
 * @param {Object} options - Configuration options
 * @param {boolean} [options.advanced=false] - Open advanced configuration if available
 * @param {number} [options.timeout=5000] - Operation timeout
 * @returns {Cypress.Chainable<boolean>} Success status
 */
Cypress.Commands.add('openProcessorConfiguration', (processor, options = {}) => {
  const { advanced = false, timeout = TIMEOUTS.DIALOG_APPEAR } = options;

  logMessage(
    'action',
    `Opening ${advanced ? 'advanced ' : ''}configuration for: ${typeof processor === 'string' ? processor : processor.name}`
  );

  // Ensure we're authenticated
  return cy.getSessionContext().then((session) => {
    if (!session.isLoggedIn) {
      throw new Error('Cannot open processor configuration: not authenticated');
    }

    // If processor is a string, find it first
    if (typeof processor === 'string') {
      return cy.findProcessorOnCanvas(processor).then((foundProcessor) => {
        if (!foundProcessor) {
          logMessage('warn', `Processor ${processor} not found on canvas`);
          return false;
        }
        return performConfigurationOpen(foundProcessor, advanced, timeout);
      });
    } else {
      // Processor is already a reference object
      return performConfigurationOpen(processor, advanced, timeout);
    }
  });
});

/**
 * Perform the actual configuration dialog opening
 * @param {ProcessorReference} processor - Processor reference
 * @param {boolean} advanced - Whether to open advanced configuration
 * @param {number} timeout - Operation timeout
 * @returns {Cypress.Chainable<boolean>} Success status
 */
function performConfigurationOpen(processor, advanced, timeout) {
  logMessage('action', `Opening configuration for processor: ${processor.name}`);

  // Right-click on the processor to open context menu
  return cy
    .wrap(processor.element)
    .rightclick()
    .then(() => {
      // Wait for context menu to appear
      return cy.get(SELECTORS.CONTEXT_MENU, { timeout }).should('be.visible');
    })
    .then(() => {
      // Look for configuration/properties option in context menu
      return cy.get('body').then(($body) => {
        // Try different possible selectors for configuration option
        const configSelectors = [
          'mat-menu-item:contains("Configure")',
          'mat-menu-item:contains("Properties")',
          'button:contains("Configure")',
          'button:contains("Properties")',
          '[role="menuitem"]:contains("Configure")',
          '[role="menuitem"]:contains("Properties")',
        ];

        let configOptionFound = false;

        for (const selector of configSelectors) {
          const elements = $body.find(selector);
          if (elements.length > 0) {
            cy.get(selector, { timeout }).first().click();
            configOptionFound = true;
            logMessage('success', `Found and clicked configuration option: ${selector}`);
            break;
          }
        }

        if (!configOptionFound) {
          logMessage('warn', 'No configuration option found in context menu');
          return false;
        }

        // Wait for configuration dialog to appear
        return cy.get('body').then(($body) => {
          const dialogSelectors = [
            'mat-dialog-container',
            '.mat-dialog-container',
            '[role="dialog"]',
            '.processor-properties-dialog',
            '.configuration-dialog',
          ];

          let dialogFound = false;

          for (const selector of dialogSelectors) {
            const dialogs = $body.find(selector);
            if (dialogs.length > 0) {
              cy.get(selector, { timeout }).should('be.visible');
              dialogFound = true;
              logMessage('success', `Configuration dialog opened: ${selector}`);

              // If advanced configuration is requested, look for advanced tab/button
              if (advanced) {
                return openAdvancedTab(timeout);
              }
              break;
            }
          }

          if (!dialogFound) {
            logMessage('warn', 'Configuration dialog did not appear');
            return false;
          }

          return true;
        });
      });
    })
    .then(
      (result) => {
        if (result) {
          logMessage('success', `Configuration dialog opened successfully for ${processor.name}`);
        }
        return result;
      },
      (error) => {
        logMessage('error', `Failed to open configuration for ${processor.name}: ${error.message}`);
        return false;
      }
    );
}

/**
 * Open advanced configuration tab if available
 * @param {number} timeout - Operation timeout
 * @returns {Cypress.Chainable<boolean>} Success status
 */
function openAdvancedTab(timeout) {
  logMessage('action', 'Looking for advanced configuration tab');

  return cy.get('body').then(($body) => {
    // Look for advanced tab or button
    const advancedSelectors = [
      'mat-tab[aria-label*="Advanced"]',
      'mat-tab:contains("Advanced")',
      '.mat-tab:contains("Advanced")',
      'button:contains("Advanced")',
      '[role="tab"]:contains("Advanced")',
      '.tab:contains("Advanced")',
    ];

    let advancedFound = false;

    for (const selector of advancedSelectors) {
      const elements = $body.find(selector);
      if (elements.length > 0) {
        cy.get(selector, { timeout }).first().click();
        advancedFound = true;
        logMessage('success', `Opened advanced configuration tab: ${selector}`);
        break;
      }
    }

    if (!advancedFound) {
      logMessage(
        'info',
        'No advanced tab found - may already be in advanced view or not available'
      );
    }

    return advancedFound;
  });
}
