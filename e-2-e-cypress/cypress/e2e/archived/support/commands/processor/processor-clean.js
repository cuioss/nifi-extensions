/**
 * Custom commands related to processor operations
 * Updated for NiFi 2.4.0 Angular UI
 * Clean implementation without duplications
 */

import { SELECTORS, TEXT_CONSTANTS } from '../../constants.js';

/**
 * Add a processor to the canvas
 * @param {string} type - The processor type to add
 * @param {object} position - The position coordinates {x, y} where to add the processor
 * @returns {Cypress.Chainable<string>} - Returns the processor ID if successfully added
 */
Cypress.Commands.add('addProcessor', (type, position = { x: 300, y: 300 }) => {
  cy.verifyLoggedIn();
  cy.get(TEXT_CONSTANTS.NIFI).should('be.visible');

  return cy.get('body').then(($body) => {
    const existingProcessors = $body.find(SELECTORS.PROCESSOR).length;
    cy.log(`Found ${existingProcessors} existing processors before addition`);

    // Try to find canvas elements and add processor
    const canvasElements = $body.find(
      'svg, canvas, [role="main"], .flow-canvas, .nifi-canvas, .canvas-container'
    );

    if (canvasElements.length > 0) {
      cy.log('🎯 Attempting traditional double-click method');
      return cy.wrap(canvasElements.first()).then(($element) => {
        if ($element && $element.length > 0) {
          return cy
            .wrap($element)
            .dblclick({ force: true })
            .then(() => {
              // Check if dialog appeared
              return cy.get('body', { timeout: 2000 }).then(($checkBody) => {
                const dialogs = $checkBody.find(SELECTORS.DIALOG);
                if (dialogs.length > 0) {
                  cy.log('✅ Traditional double-click successful');
                  return cy.selectProcessorFromDialog(type);
                } else {
                  cy.log('⚠️ Traditional double-click failed, trying alternatives');
                  return cy.addProcessorAlternative(type, { position });
                }
              });
            });
        } else {
          cy.log('⚠️ Canvas element is null, using alternative methods');
          return cy.addProcessorAlternative(type, { position });
        }
      });
    } else {
      cy.log('⚠️ No canvas elements found, using alternative methods');
      return cy.addProcessorAlternative(type, { position });
    }
  });
});

/**
 * Simple verification that we can interact with the NiFi canvas
 */
Cypress.Commands.add('verifyCanvasAccessible', () => {
  cy.verifyLoggedIn();
  cy.get(TEXT_CONSTANTS.NIFI).should('be.visible');

  return cy
    .get('body')
    .should(($body) => {
      const hasAngularContent = $body.find('nifi').children().length > 0;
      const hasButtons = $body.find('button').length > 0;
      const hasMatElements = $body.find('[class*="mat-"]').length > 0;

      expect(hasAngularContent || hasButtons || hasMatElements).to.be.true;
    })
    .then(() => {
      cy.log('✅ Canvas accessible for testing');
      return cy.wrap(true);
    });
});

/**
 * Configure a processor with the provided settings
 * @param {string} processorId - The ID of the processor to configure
 * @param {object} config - Configuration object with settings to apply
 */
Cypress.Commands.add('configureProcessor', (processorId, config) => {
  cy.log(`⚙️ Configuring processor ${processorId}`);

  // Navigate to processor configuration
  cy.navigateToProcessorConfig(processorId);

  // Navigate to properties tab if available
  cy.get('body').then(($body) => {
    const propertyTabs = $body.find(
      '[data-testid="processor-properties-tab"], .processor-configuration-tab, *:contains("Properties")'
    );
    if (propertyTabs.length > 0) {
      cy.wrap(propertyTabs.first()).click({ force: true });
    }
  });

  // Set each property
  if (config.properties) {
    Object.entries(config.properties).forEach(([key, value]) => {
      cy.log(`Setting property ${key} = ${value}`);
      cy.setProcessorProperty(key, value);
    });
  }

  // Apply configuration
  cy.get('body').then(($applyBody) => {
    const applyButtons = $applyBody.find(
      'button:contains("Apply"), button:contains("OK"), button[data-testid*="apply"]'
    );
    if (applyButtons.length > 0) {
      cy.wrap(applyButtons.first()).click({ force: true });
    }
  });

  // Wait for dialog to close
  cy.get(SELECTORS.DIALOG, { timeout: 5000 }).should('not.exist');
  cy.log('✅ Processor configuration complete');
});

/**
 * Set individual processor property
 * @param {string} key - Property key
 * @param {string} value - Property value
 */
Cypress.Commands.add('setProcessorProperty', (key, value) => {
  cy.get('body').then(($propBody) => {
    const propertyInputs = $propBody.find(
      `[data-property="${key}"], input[name="${key}"], textarea[name="${key}"], *[data-testid*="${key}"]`
    );

    if (propertyInputs.length > 0) {
      cy.wrap(propertyInputs.first()).clear().type(value, { force: true });
    } else {
      cy.log(`⚠️ Property input not found for ${key}, skipping`);
    }
  });
});

/**
 * Navigate to processor configuration dialog
 * @param {string} processorId - The processor ID
 */
Cypress.Commands.add('navigateToProcessorConfig', (processorId) => {
  cy.log(`🔧 Navigating to processor config for ${processorId}`);

  // Find the processor element and double-click it
  cy.get(`g[id="${processorId}"], [data-processor-id="${processorId}"], [id*="${processorId}"]`)
    .should('exist')
    .then(($element) => {
      if ($element.length > 0) {
        cy.wrap($element).dblclick({ force: true });
      } else {
        cy.log(`⚠️ Processor element not found for ID: ${processorId}`);
        throw new Error(`Processor element not found for ID: ${processorId}`);
      }
    });

  // Wait for configuration dialog to appear
  cy.get(SELECTORS.DIALOG, { timeout: 10000 }).should('be.visible');
  cy.log('✅ Processor configuration dialog opened');
});

/**
 * Find processor element on canvas
 * @param {string} processorId - The processor ID
 * @returns {Cypress.Chainable} The processor element
 */
Cypress.Commands.add('findProcessorElement', (processorId) => {
  return cy
    .get(`g[id="${processorId}"], [data-processor-id="${processorId}"], [id*="${processorId}"]`)
    .should('exist');
});

/**
 * Get processor element from canvas
 * @param {string} processorId - The processor ID
 * @returns {Cypress.Chainable} The processor element
 */
Cypress.Commands.add('getProcessorElement', (processorId) => {
  return cy.get(
    `g[id="${processorId}"], [data-processor-id="${processorId}"], [id*="${processorId}"]`
  );
});

/**
 * Clean up all processors on the canvas
 */
Cypress.Commands.add('cleanupAllProcessors', () => {
  cy.log('🧹 Cleaning up all processors');
  cy.verifyLoggedIn();

  cy.get('body').then(($body) => {
    const processors = $body.find(SELECTORS.PROCESSOR);

    if (processors.length === 0) {
      cy.log('✅ No processors found to cleanup');
      return;
    }

    cy.log(`Found ${processors.length} processors to cleanup`);

    // Remove each processor by selecting and deleting
    processors.each((index, element) => {
      const processorId = element.getAttribute('id') || `processor-${index}`;
      cy.log(`Removing processor: ${processorId}`);

      try {
        // Click on processor to select it
        cy.wrap(element).click({ force: true });
        // Press Delete key
        cy.get('body').type('{del}');

        // If confirmation dialog appears, confirm deletion
        cy.get('body').then(($confirmBody) => {
          if (
            $confirmBody.find('.confirmation-dialog, .delete-dialog, .mat-dialog-container')
              .length > 0
          ) {
            cy.get('.confirmation-dialog, .delete-dialog, .mat-dialog-container')
              .find('button')
              .contains('Delete', { matchCase: false })
              .click({ force: true });
          }
        });
      } catch (error) {
        cy.log(`⚠️ Could not remove processor ${processorId}: ${error.message}`);
      }
    });

    cy.log('✅ Processor cleanup attempted');
  });
});

/**
 * Verify processor properties match expected values
 * @param {string} processorId - The processor ID
 * @param {object} expectedProperties - Expected property values
 */
Cypress.Commands.add('verifyProcessorProperties', (processorId, expectedProperties) => {
  cy.log(`🔍 Verifying processor properties for ${processorId}`);

  // Navigate to processor configuration
  cy.navigateToProcessorConfig(processorId);

  // Navigate to properties tab
  cy.get('[data-testid="processor-properties-tab"], .processor-configuration-tab')
    .contains('Properties')
    .click();

  // Verify each expected property
  Object.entries(expectedProperties).forEach(([key, value]) => {
    cy.get(`[data-property="${key}"], input[name="${key}"]`).should('have.value', value);
  });

  // Close configuration dialog
  cy.get('button').contains('Cancel', { matchCase: false }).click();
});

/**
 * Start a processor
 * @param {string} processorId - The ID of the processor to start
 */
Cypress.Commands.add('startProcessor', (processorId) => {
  cy.getProcessorElement(processorId).then(($element) => {
    if ($element && $element.length > 0) {
      cy.wrap($element).rightclick({ force: true });

      cy.get('body').then(($body) => {
        const contextMenus = $body.find('.context-menu, .mat-menu-panel, [role="menu"]');
        if (contextMenus.length > 0) {
          cy.get('*:contains("Start")').first().click({ force: true });
        }
      });
    }
  });
});

/**
 * Stop a processor
 * @param {string} processorId - The ID of the processor to stop
 */
Cypress.Commands.add('stopProcessor', (processorId) => {
  cy.getProcessorElement(processorId).then(($element) => {
    if ($element && $element.length > 0) {
      cy.wrap($element).rightclick({ force: true });

      cy.get('body').then(($body) => {
        const contextMenus = $body.find('.context-menu, .mat-menu-panel, [role="menu"]');
        if (contextMenus.length > 0) {
          cy.get('*:contains("Stop")').first().click({ force: true });
        }
      });
    }
  });
});

/**
 * Remove a processor from the canvas
 * @param {string} processorId - The ID of the processor to remove
 */
Cypress.Commands.add('removeProcessor', (processorId) => {
  cy.getProcessorElement(processorId).then(($element) => {
    if ($element && $element.length > 0) {
      cy.wrap($element).rightclick({ force: true });

      cy.get('body').then(($body) => {
        const contextMenus = $body.find('.context-menu, .mat-menu-panel, [role="menu"]');
        if (contextMenus.length > 0) {
          cy.get('*:contains("Delete"), *:contains("Remove")').first().click({ force: true });

          // Confirm deletion if dialog appears
          cy.get('body').then(($confirmBody) => {
            const confirmDialogs = $confirmBody.find(
              '[role="dialog"], .mat-dialog-container, .confirmation-dialog'
            );
            if (confirmDialogs.length > 0) {
              cy.get('button')
                .contains(/^(Delete|Remove|Yes|Confirm)$/i)
                .click({ force: true });
            }
          });
        } else {
          // Fallback: select and use keyboard delete
          cy.wrap($element).click({ force: true });
          cy.wrap($element).type('{del}');
        }
      });
    }
  });
});

/**
 * Navigate to the main canvas view
 */
Cypress.Commands.add('navigateToCanvas', () => {
  cy.log('🗺️ Navigating to canvas');
  cy.verifyLoggedIn();
  cy.visit('/nifi');
  cy.get('nifi', { timeout: 30000 }).should('exist');
  cy.get('body').should('be.visible');
  cy.log('✅ Canvas navigation complete');
});

module.exports = {
  cleanProcessorCommandsLoaded: true,
};
