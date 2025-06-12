/**
 * Custom commands related to processor operations
 * Updated for NiFi 2.4.0 Angular UI
 */

/**
 * Add a processor to the canvas - simplified version for modern NiFi Angular UI
 * @param {string} type - The type of processor to add
 * @param {Object} position - The position coordinates {x, y} where to add the processor
 * @returns {Cypress.Chainable<string>} - Returns the processor ID if successfully added
 */
Cypress.Commands.add('addProcessor', (type, position = { x: 300, y: 300 }) => {
  // First, ensure we're logged in and in the main UI
  cy.verifyLoggedIn();
  
  // Wait for UI to be ready
  cy.wait(2000);
  
  // Look for the main canvas/flow area in the Angular app
  cy.get('nifi').should('be.visible');
  
  // Count existing processors before adding new one
  return cy.get('body').then(($body) => {
    const existingProcessors = $body.find('g.processor, [class*="processor"], .component').length;
    cy.log(`Found ${existingProcessors} existing processors before addition`);
    
    // Look for any canvas, svg, or flow area within the nifi component
    const canvasElements = $body.find('svg, canvas, [role="main"], .flow-canvas, .nifi-canvas, .canvas-container');
    
    if (canvasElements.length > 0) {
      // Double-click on canvas area to trigger add processor dialog
      cy.wrap(canvasElements.first()).dblclick({ force: true });
      cy.wait(1000);
    } else {
      // Fallback: try double-clicking within the nifi component
      cy.get('nifi').dblclick(position.x, position.y, { force: true });
      cy.wait(1000);
    }
    
    // Look for processor selection dialog or add component dialog
    return cy.get('body').then(($dialogBody) => {
      // Try to find any dialog that might contain processor types
      const dialogs = $dialogBody.find('[role="dialog"], .mat-dialog-container, .dialog, .add-component-dialog, .processor-dialog');
      
      if (dialogs.length > 0) {
        // Look for search/filter input
        cy.get('input[type="text"], input[type="search"], input[placeholder*="filter"], input[placeholder*="search"]').first().type(type, { force: true });
        cy.wait(500);
        
        // Try to find and click the processor type
        cy.get('body').contains(type, { timeout: 5000 }).click({ force: true });
        cy.wait(500);
        
        // Look for Add/OK button to confirm
        cy.get('button').contains(/^(Add|OK|Create)$/i).click({ force: true });
        cy.wait(2000); // Give time for processor to be added
        
        // Try to extract the actual processor ID from the newly added processor
        return cy.get('body').then(($newBody) => {
          const newProcessors = $newBody.find('g.processor, [class*="processor"], .component');
          cy.log(`Found ${newProcessors.length} processors after addition`);
          
          if (newProcessors.length > existingProcessors) {
            // Find the newest processor (likely the last one)
            const newestProcessor = newProcessors.last();
            
            // Try to extract ID from various attributes
            let processorId = newestProcessor.attr('id') || 
                            newestProcessor.attr('data-testid') || 
                            newestProcessor.attr('data-processor-id') ||
                            newestProcessor.attr('data-id');
                            
            if (!processorId) {
              // Generate a unique ID based on processor count and timestamp
              processorId = `processor-${newProcessors.length}-${Date.now()}`;
              cy.log(`Generated processor ID: ${processorId}`);
            } else {
              cy.log(`Extracted processor ID: ${processorId}`);
            }
            
            return cy.wrap(processorId);
          } else {
            cy.log('No new processor detected after addition attempt');
            return cy.wrap(null);
          }
        });
      } else {
        cy.log('No processor dialog found, processor addition may have failed');
        return cy.wrap(null);
      }
    });
  });
});

/**
 * Simple verification that we can interact with the NiFi canvas
 */
Cypress.Commands.add('verifyCanvasAccessible', () => {
  cy.verifyLoggedIn();
  cy.get('nifi').should('be.visible');
  
  // Wait for any Angular Material elements that indicate the UI is ready
  cy.get('body').should(($body) => {
    const hasButtons = $body.find('button').length > 0;
    const hasMatElements = $body.find('[class*="mat-"]').length > 0;
    expect(hasButtons || hasMatElements).to.be.true;
  });
});

/**
 * Configure a processor with the provided settings
 * @param {string} processorId - The ID of the processor to configure
 * @param {Object} config - Configuration object with settings to apply
 */
Cypress.Commands.add('configureProcessor', (processorId, config) => {
  // Try to find and open processor configuration
  cy.get('body').then(($body) => {
    // Look for processor elements using various selectors
    const processorSelectors = [
      `[data-testid="${processorId}"]`,
      `g[id="${processorId}"]`,
      `[id="${processorId}"]`,
      `.processor[data-id="${processorId}"]`
    ];
    
    let processorElement = null;
    for (const selector of processorSelectors) {
      const elements = $body.find(selector);
      if (elements.length > 0) {
        processorElement = elements.first();
        break;
      }
    }
    
    if (processorElement) {
      // Double-click to open configuration
      cy.wrap(processorElement).dblclick({ force: true });
      cy.wait(1000);
      
      // Look for configuration dialog
      cy.get('body').then(($dialogBody) => {
        const configDialogs = $dialogBody.find('[role="dialog"], .mat-dialog-container, .configuration-dialog, .processor-config-dialog');
        
        if (configDialogs.length > 0) {
          // Configure based on the provided settings
          if (config.name) {
            cy.get('input[id*="name"], input[placeholder*="name"], input[label*="Name"]').first().clear().type(config.name);
          }

          // Handle processor properties if provided
          if (config.properties) {
            // Click on Properties tab if available
            cy.get('body').then(($tabBody) => {
              const propertyTabs = $tabBody.find('*:contains("Properties"), *:contains("PROPERTIES")');
              if (propertyTabs.length > 0) {
                cy.wrap(propertyTabs.first()).click({ force: true });
                cy.wait(500);
              }
            });

            // Iterate through each property and set its value
            Object.entries(config.properties).forEach(([key, value]) => {
              cy.get('body').then(($propBody) => {
                // Look for property rows/fields
                const propertyElements = $propBody.find(`*:contains("${key}")`);
                if (propertyElements.length > 0) {
                  const propertyRow = propertyElements.closest('tr, .property-row, .mat-form-field, .form-group').first();
                  const inputs = propertyRow.find('input, select, textarea');
                  if (inputs.length > 0) {
                    cy.wrap(inputs.first()).clear().type(value);
                  }
                }
              });
            });
          }

          // Apply configuration - look for Apply/Save button
          cy.get('button').contains(/^(Apply|Save|OK)$/i).click({ force: true });
        }
      });
    }
  });
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
  cy.getProcessorElement(processorId).then(($element) => {
    // Try right-click context menu approach
    cy.wrap($element).rightclick({ force: true });
    cy.wait(500);
    
    // Look for context menu and Start option
    cy.get('body').then(($body) => {
      const contextMenus = $body.find('.context-menu, .mat-menu-panel, [role="menu"]');
      if (contextMenus.length > 0) {
        cy.get('*:contains("Start")').first().click({ force: true });
      } else {
        // Fallback: try double-click and look for start button in dialog
        cy.wrap($element).dblclick({ force: true });
        cy.wait(500);
        cy.get('button').contains(/^Start$/i).click({ force: true });
      }
    });
  });
  cy.wait(1000); // Give time for processor to start
});

/**
 * Stop a processor
 * @param {string} processorId - The ID of the processor to stop
 */
Cypress.Commands.add('stopProcessor', (processorId) => {
  cy.getProcessorElement(processorId).then(($element) => {
    // Try right-click context menu approach
    cy.wrap($element).rightclick({ force: true });
    cy.wait(500);
    
    // Look for context menu and Stop option
    cy.get('body').then(($body) => {
      const contextMenus = $body.find('.context-menu, .mat-menu-panel, [role="menu"]');
      if (contextMenus.length > 0) {
        cy.get('*:contains("Stop")').first().click({ force: true });
      } else {
        // Fallback: try double-click and look for stop button in dialog
        cy.wrap($element).dblclick({ force: true });
        cy.wait(500);
        cy.get('button').contains(/^Stop$/i).click({ force: true });
      }
    });
  });
  cy.wait(1000); // Give time for processor to stop
});

/**
 * Remove a processor from the canvas
 * @param {string} processorId - The ID of the processor to remove
 */
Cypress.Commands.add('removeProcessor', (processorId) => {
  cy.getProcessorElement(processorId).then(($element) => {
    // Try right-click context menu approach
    cy.wrap($element).rightclick({ force: true });
    cy.wait(500);
    
    // Look for context menu and Delete option
    cy.get('body').then(($body) => {
      const contextMenus = $body.find('.context-menu, .mat-menu-panel, [role="menu"]');
      if (contextMenus.length > 0) {
        cy.get('*:contains("Delete"), *:contains("Remove")').first().click({ force: true });
        
        // Confirm deletion if dialog appears
        cy.wait(500);
        cy.get('body').then(($confirmBody) => {
          const confirmDialogs = $confirmBody.find('[role="dialog"], .mat-dialog-container, .confirmation-dialog');
          if (confirmDialogs.length > 0) {
            cy.get('button').contains(/^(Delete|Remove|Yes|Confirm)$/i).click({ force: true });
          }
        });
      } else {
        // Fallback: select and use keyboard delete
        cy.wrap($element).click({ force: true });
        cy.wait(500);
        cy.wrap($element).type('{del}');
      }
    });
  });
});

/**
 * Get the DOM element for a processor
 * @param {string} processorId - The ID of the processor element to get
 */
Cypress.Commands.add('getProcessorElement', (processorId) => {
  // Try multiple selector patterns for finding processors in Angular UI
  const selectors = [
    `[data-testid="${processorId}"]`,
    `g[id="${processorId}"]`,
    `[id="${processorId}"]`,
    `.processor[data-id="${processorId}"]`,
    `[data-processor-id="${processorId}"]`
  ];
  
  // Try each selector and return the first match
  return cy.get('body').then(($body) => {
    for (const selector of selectors) {
      const elements = $body.find(selector);
      if (elements.length > 0) {
        return cy.get(selector).first();
      }
    }
    
    // Fallback: return any processor-like element if specific ID not found
    const fallbackElements = $body.find('[class*="processor"], g.processor, .component');
    if (fallbackElements.length > 0) {
      return cy.get('[class*="processor"], g.processor, .component').first();
    }
    
    // If no processor elements found, fail with helpful message
    throw new Error(`No processor element found for ID: ${processorId}. Available elements: ${$body.find('*[class*="processor"], *[id*="processor"]').length}`);
  });
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

/**
 * Clean up all processors from the canvas
 * Useful for test cleanup
 */
Cypress.Commands.add('cleanupAllProcessors', () => {
  cy.get('body').then(($body) => {
    const processors = $body.find('g.processor, [class*="processor"], .component');
    cy.log(`Found ${processors.length} processors to clean up`);
    
    if (processors.length > 0) {
      // Try to select all and delete
      processors.each((index, element) => {
        cy.wrap(element).click({ force: true });
        cy.wait(100);
      });
      
      // Try keyboard delete
      cy.get('body').type('{del}');
      cy.wait(500);
      
      // If keyboard delete doesn't work, try individual removal
      cy.get('body').then(($afterBody) => {
        const remainingProcessors = $afterBody.find('g.processor, [class*="processor"], .component');
        if (remainingProcessors.length > 0) {
          remainingProcessors.each((index, element) => {
            cy.wrap(element).rightclick({ force: true });
            cy.wait(200);
            
            // Look for delete option in context menu
            cy.get('body').then(($menuBody) => {
              const deleteOptions = $menuBody.find('*:contains("Delete"), *:contains("Remove")');
              if (deleteOptions.length > 0) {
                cy.wrap(deleteOptions.first()).click({ force: true });
                cy.wait(200);
                
                // Confirm if dialog appears
                cy.get('body').then(($confirmBody) => {
                  const confirmButtons = $confirmBody.find('button:contains("Delete"), button:contains("Yes"), button:contains("Confirm")');
                  if (confirmButtons.length > 0) {
                    cy.wrap(confirmButtons.first()).click({ force: true });
                    cy.wait(200);
                  }
                });
              }
            });
          });
        }
      });
    }
  });
});

/**
 * Find processor by type name on canvas
 * @param {string} processorType - The type name to search for
 * @returns {Cypress.Chainable} - Element if found
 */
Cypress.Commands.add('findProcessorByType', (processorType) => {
  return cy.get('body').then(($body) => {
    // Look for text content that matches the processor type
    const elements = $body.find(`*:contains("${processorType}")`);
    if (elements.length > 0) {
      // Find the closest processor-like element
      const processorElement = elements.closest('g.processor, [class*="processor"], .component').first();
      if (processorElement.length > 0) {
        return cy.wrap(processorElement);
      }
    }
    
    cy.log(`No processor found with type: ${processorType}`);
    return cy.wrap(null);
  });
});

/**
 * Wait for processor to be in specific state
 * @param {string} processorId - The processor ID
 * @param {string} expectedState - Expected state (RUNNING, STOPPED, etc.)
 * @param {number} timeout - Timeout in milliseconds
 */
Cypress.Commands.add('waitForProcessorState', (processorId, expectedState, timeout = 10000) => {
  const startTime = Date.now();
  
  const checkState = () => {
    return cy.getProcessorElement(processorId).then(($element) => {
      // Look for state indicators in the processor element
      const stateIndicators = $element.find('.processor-state, .state-indicator, [class*="state"]');
      
      if (stateIndicators.length > 0) {
        const currentState = stateIndicators.first().attr('class') || stateIndicators.first().text();
        if (currentState.toLowerCase().includes(expectedState.toLowerCase())) {
          return true;
        }
      }
      
      // Check if timeout reached
      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for processor ${processorId} to reach state ${expectedState}`);
      }
      
      // Wait and check again
      cy.wait(500);
      return checkState();
    });
  };
  
  return checkState();
});
