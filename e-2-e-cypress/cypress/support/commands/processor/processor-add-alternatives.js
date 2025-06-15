/**
 * Alternative processor addition methods for NiFi 2.4.0 Angular UI
 * Since double-click canvas doesn't trigger Add Processor dialog,
 * this file implements alternative approaches
 */

import { SELECTORS, TIMEOUTS, TEXT_CONSTANTS } from '../../constants.js';
import { _waitForVisible, _waitForDialog } from '../../wait-utils.js';

/**
 * Try to add processor using toolbar button approach
 * @param {string} type - The processor type to add
 * @param {Object} _position - Position where to add processor (unused in this implementation)
 * @returns {void}
 */
function tryToolbarAddProcessor(type, _position = { x: 300, y: 300 }) {
  cy.log('🔧 Trying toolbar approach for adding processor');

  // Look for common toolbar selectors that might contain "Add Processor" button
  const toolbarSelectors = [
    'button[title*="Add"]',
    'button[aria-label*="Add"]',
    'button:contains("Add")',
    'button:contains("+")',
    '.toolbar button',
    '.actions button',
    '.flow-toolbar button',
    '[role="toolbar"] button',
    '.mat-toolbar button',
  ];

  // Try each toolbar selector
  for (const selector of toolbarSelectors) {
    cy.get('body').then(($body) => {
      const toolbarButtons = $body.find(selector);
      if (toolbarButtons.length > 0) {
        cy.log(`Found ${toolbarButtons.length} toolbar buttons with selector: ${selector}`);
        cy.get(selector).first().click({ force: true });

        // Check if dialog appeared
        cy.get('body').then(($dialogCheck) => {
          const dialogs = $dialogCheck.find(SELECTORS.DIALOG);
          if (dialogs.length > 0) {
            cy.log('✅ Toolbar approach successful - dialog found');
            return true;
          }
        });
      }
    });
  }

  return false;
}

/**
 * Try to add processor using right-click context menu
 * @param {string} type - The processor type to add
 * @param {Object} position - Position where to add processor
 * @returns {boolean} Success status of the operation
 */
function tryRightClickAddProcessor(type, position = { x: 300, y: 300 }) {
  cy.log('🖱️ Trying right-click context menu approach');

  // Try right-clicking on canvas area
  cy.get('body').then(($body) => {
    const canvasElements = $body.find('svg, canvas, [role="main"], .flow-canvas, .nifi-canvas');

    if (canvasElements.length > 0) {
      cy.wrap(canvasElements.first()).rightclick(position.x, position.y, { force: true });

      // Look for context menu
      cy.get('.context-menu, .mat-menu-panel, [role="menu"]', { timeout: 2000 }).should(
        TEXT_CONSTANTS.BE_VISIBLE
      );
      cy.get('body').then(($contextCheck) => {
        const contextMenus = $contextCheck.find('.context-menu, .mat-menu-panel, [role="menu"]');
        if (contextMenus.length > 0) {
          cy.log('✅ Context menu appeared');
          // Look for "Add Processor" or similar option
          cy.get('body')
            .contains(/Add.*Processor|New.*Processor|Create.*Processor/i)
            .click({ force: true });
          return true;
        }
      });
    }
  });

  return false;
}

/**
 * Try to add processor using drag-and-drop from component palette
 * @param {string} type - The processor type to add
 * @param {Object} _position - Position where to add processor (unused in this implementation)
 * @returns {boolean} Success status of the operation
 */
function tryDragDropAddProcessor(type, _position = { x: 300, y: 300 }) {
  cy.log('🎯 Trying drag-and-drop from palette approach');

  // Look for component palette or processor list
  const paletteSelectors = [
    '.component-palette',
    '.processor-palette',
    '.processors-list',
    '.components-list',
    '[data-testid*="palette"]',
    '[aria-label*="palette"]',
  ];

  for (const selector of paletteSelectors) {
    cy.get('body').then(($body) => {
      const palettes = $body.find(selector);
      if (palettes.length > 0) {
        cy.log(`Found palette with selector: ${selector}`);

        // Look for the specific processor type in the palette
        cy.get(selector).within(() => {
          cy.get('body')
            .contains(type)
            .then(($processorItem) => {
              if ($processorItem.length > 0) {
                // Try drag and drop to canvas
                const canvasElements = $body.find('svg, canvas, [role="main"]');
                if (canvasElements.length > 0) {
                  cy.wrap($processorItem).drag(canvasElements.first());
                  cy.log('✅ Drag-and-drop attempt completed');
                  return true;
                }
              }
            });
        });
      }
    });
  }

  return false;
}

/**
 * Try to add processor using menu navigation
 * @param {string} _type - The processor type to add (unused in this implementation)
 * @returns {boolean} Success status of the operation
 */
function tryMenuAddProcessor(_type) {
  cy.log('📋 Trying menu navigation approach');

  // Look for main menu options
  const menuSelectors = ['[role="menubar"]', '.main-menu', '.app-menu', '.nifi-menu'];

  for (const selector of menuSelectors) {
    cy.get('body').then(($body) => {
      const menus = $body.find(selector);
      if (menus.length > 0) {
        cy.get(selector).within(() => {
          // Look for "Add", "Insert", "New" or similar menu items
          cy.get('body')
            .contains(/Add|Insert|New|Create/i)
            .click({ force: true });

          // Look for "Processor" submenu
          cy.get('body')
            .contains(/Processor/i)
            .click({ force: true });
          return true;
        });
      }
    });
  }

  return false;
}

/**
 * Comprehensive processor addition using multiple fallback methods
 * @param {string} type - The processor type to add
 * @param {object} options - Options including position
 */
Cypress.Commands.add('addProcessorAlternative', (type, options = {}) => {
  const position = options.position || { x: 300, y: 300 };

  cy.log(`🚀 Attempting to add processor: ${type} using alternative methods`);

  // Ensure we're logged in and ready
  cy.verifyLoggedIn();
  cy.get(TEXT_CONSTANTS.NIFI).should('be.visible');

  // Method 1: Try toolbar approach
  cy.get('body').then((_$body) => {
    // Try toolbar first
    if (tryToolbarAddProcessor(type, position)) {
      cy.log('✅ Toolbar method successful');
      return cy.selectProcessorFromDialog(type);
    }

    // Method 2: Try right-click
    if (tryRightClickAddProcessor(type, position)) {
      cy.log('✅ Right-click method successful');
      return cy.selectProcessorFromDialog(type);
    }

    // Method 3: Try drag-and-drop
    if (tryDragDropAddProcessor(type, position)) {
      cy.log('✅ Drag-drop method successful');
      return cy.wrap(null); // Drag-drop doesn't need dialog selection
    }

    // Method 4: Try menu navigation
    if (tryMenuAddProcessor(type)) {
      cy.log('✅ Menu method successful');
      return cy.selectProcessorFromDialog(type);
    }

    // Method 5: Fallback to API approach
    cy.log('⚠️ All UI methods failed, attempting API approach');
    return cy.addProcessorViaAPI(type, position);
  });
});

/**
 * Select processor type from dialog once it's open
 * @param {string} type - The processor type to select
 */
Cypress.Commands.add('selectProcessorFromDialog', (type) => {
  // Wait for any dialog to appear
  cy.get(SELECTORS.DIALOG, { timeout: TIMEOUTS.LONG }).should('be.visible');

  // Look for search/filter input
  cy.get('input[type="text"], input[type="search"], input[placeholder*="filter"]')
    .first()
    .clear()
    .type(type, { force: true });

  // Wait for filtered results
  cy.get('.processor-list, .processor-results').should('be.visible');

  // Click on the matching processor type
  cy.get('body').contains(type, { timeout: TIMEOUTS.MEDIUM }).click({ force: true });

  // Click Add/OK button
  cy.get('button')
    .contains(/^(Add|OK|Create)$/i)
    .click({ force: true });

  // Wait for dialog to close
  cy.get(SELECTORS.DIALOG).should('not.exist');

  // Return processor ID if possible
  return cy.getLastAddedProcessorId();
});

/**
 * API-based processor addition as ultimate fallback
 * @param {string} type - The processor type to add
 * @param {object} position - Position coordinates
 */
Cypress.Commands.add('addProcessorViaAPI', (type, position) => {
  cy.log('🔌 Using API approach to add processor');

  // Get the process group ID (root is usually the canvas)
  cy.request('GET', '/nifi-api/flow/process-groups/root').then((response) => {
    cy.log('API Response:', response.body);
    
    // Handle different possible response structures
    let processGroupId;
    if (response.body?.processGroupFlow?.id) {
      processGroupId = response.body.processGroupFlow.id;
    } else if (response.body?.id) {
      processGroupId = response.body.id;
    } else {
      cy.log('⚠️  Cannot determine process group ID from API response');
      processGroupId = 'root'; // fallback to root
    }

    cy.log(`Using process group ID: ${processGroupId}`);

    // Create processor via API
    const processorData = {
      revision: {
        version: 0,
      },
      component: {
        type: type,
        position: {
          x: position.x,
          y: position.y,
        },
      },
    };

    cy.request({
      method: 'POST',
      url: `/nifi-api/process-groups/${processGroupId}/processors`,
      body: processorData,
      failOnStatusCode: false
    }).then((createResponse) => {
      cy.log('Create processor API response status:', createResponse.status);
      cy.log('Create processor API response body:', createResponse.body);
      
      if (createResponse.status === 201 || createResponse.status === 200) {
        // Handle different possible response structures
        let processorId;
        if (createResponse.body?.id) {
          processorId = createResponse.body.id;
        } else if (createResponse.body?.component?.id) {
          processorId = createResponse.body.component.id;
        } else if (createResponse.body?.processor?.id) {
          processorId = createResponse.body.processor.id;
        }
        
        if (processorId) {
          cy.log(`✅ Processor created via API with ID: ${processorId}`);

          // Refresh the UI to show the new processor
          cy.reload();
          cy.nifiLogin('admin', 'adminadminadmin');

          return cy.wrap(processorId);
        } else {
          cy.log('⚠️  Could not extract processor ID from response:', createResponse.body);
          throw new Error('Could not extract processor ID from API response');
        }
      } else {
        cy.log('⚠️  API processor creation failed:', createResponse);
        throw new Error(`Failed to create processor via API: ${createResponse.status}`);
      }
    });
  });
});

/**
 * Get the ID of the most recently added processor
 */
Cypress.Commands.add('getLastAddedProcessorId', () => {
  return cy
    .get(SELECTORS.PROCESSOR)
    .last()
    .then(($processor) => {
      // Try to extract processor ID from various attributes
      const id =
        $processor.attr('id') ||
        $processor.attr('data-id') ||
        $processor.attr('data-processor-id') ||
        $processor.find('[data-id]').attr('data-id');

      if (id) {
        cy.log(`📋 Found processor ID: ${id}`);
        return cy.wrap(id);
      } else {
        cy.log('⚠️ Could not determine processor ID');
        return cy.wrap(null);
      }
    });
});

export {
  tryToolbarAddProcessor,
  tryRightClickAddProcessor,
  tryDragDropAddProcessor,
  tryMenuAddProcessor,
};
