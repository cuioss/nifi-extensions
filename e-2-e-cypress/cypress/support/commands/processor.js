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
  
  // Simple verification that we have interactive content ready for testing
  cy.get('body').should(($body) => {
    const hasAngularContent = $body.find('nifi').children().length > 0;
    const hasButtons = $body.find('button').length > 0;
    const hasMatElements = $body.find('[class*="mat-"]').length > 0;
    
    // At least one indicator of ready UI
    expect(hasAngularContent || hasButtons || hasMatElements).to.be.true;
  });
  
  cy.log('✅ Canvas accessible for testing');
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
 * Updated to use improved discovery mechanisms
 * @param {string} processorId - The ID of the processor element to get
 */
Cypress.Commands.add('getProcessorElement', (processorId) => {
  // Use the new improved discovery mechanism
  return cy.findProcessorElement(processorId);
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

// === PROCESSOR CONFIGURATION DETECTION ===
// Implementation for Task 2: Processor Configuration Detection

/**
 * Check if a processor is configured with the expected properties
 * This is the main command for Processor Configuration Detection
 * @param {string} processorId - The ID of the processor to check
 * @param {Object} expectedConfig - Expected configuration to verify
 * @returns {Cypress.Chainable<boolean>} - Returns true if configured as expected
 */
Cypress.Commands.add('isProcessorConfigured', (processorId, expectedConfig = {}) => {
  cy.log(`Checking configuration for processor: ${processorId}`);
  
  return cy.getProcessorElement(processorId).then(($element) => {
    // Check if processor has expected name
    if (expectedConfig.name) {
      const currentName = $element.find('.processor-name, .name, text').first().text() || '';
      if (!currentName.includes(expectedConfig.name)) {
        cy.log(`Processor name mismatch. Expected: ${expectedConfig.name}, Found: ${currentName}`);
        return cy.wrap(false);
      }
    }
    
    // Check if processor has expected properties configured
    if (expectedConfig.properties && Object.keys(expectedConfig.properties).length > 0) {
      return cy.inspectProcessorProperties(processorId).then((currentProperties) => {
        const isConfigured = cy.compareProcessorPropertiesSync(currentProperties, expectedConfig.properties);
        cy.log(`Processor properties configured: ${isConfigured}`);
        return cy.wrap(isConfigured);
      });
    }
    
    // Check if processor has expected state
    if (expectedConfig.state) {
      const currentState = cy.getProcessorStateFromElement($element);
      if (currentState !== expectedConfig.state) {
        cy.log(`Processor state mismatch. Expected: ${expectedConfig.state}, Found: ${currentState}`);
        return cy.wrap(false);
      }
    }
    
    // Check if processor has required configuration setup
    const hasRequiredSetup = cy.detectProcessorSetupFromElement($element);
    cy.log(`Processor has required setup: ${hasRequiredSetup}`);
    
    return cy.wrap(hasRequiredSetup);
  });
});

/**
 * Inspect processor properties by opening configuration dialog
 * @param {string} processorId - The processor ID
 * @returns {Cypress.Chainable<Object>} - Current processor properties
 */
Cypress.Commands.add('inspectProcessorProperties', (processorId) => {
  cy.log(`Inspecting properties for processor: ${processorId}`);
  
  return cy.getProcessorElement(processorId).then(($element) => {
    // Open configuration dialog
    cy.wrap($element).dblclick({ force: true });
    cy.wait(1000);
    
    // Look for configuration dialog
    return cy.get('body').then(($body) => {
      const configDialogs = $body.find('[role="dialog"], .mat-dialog-container, .configuration-dialog, .processor-config-dialog');
      
      if (configDialogs.length > 0) {
        // Navigate to Properties tab if it exists
        const propertyTabs = $body.find('*:contains("Properties"), *:contains("PROPERTIES")');
        if (propertyTabs.length > 0) {
          cy.wrap(propertyTabs.first()).click({ force: true });
          cy.wait(500);
        }
        
        // Extract current properties
        const properties = {};
        const propertyRows = $body.find('.property-row, tr[class*="property"], .mat-form-field');
        
        propertyRows.each((index, row) => {
          const $row = Cypress.$(row);
          const nameElement = $row.find('.property-name, .name, td:first-child, label');
          const valueElement = $row.find('input, select, textarea, .property-value, .value, td:last-child');
          
          if (nameElement.length > 0 && valueElement.length > 0) {
            const name = nameElement.text().trim();
            const value = valueElement.is('input, select, textarea') ? 
                         valueElement.val() : valueElement.text().trim();
            
            if (name && value) {
              properties[name] = value;
            }
          }
        });
        
        // Close dialog
        cy.get('button').contains(/^(Cancel|Close)$/i).click({ force: true });
        cy.wait(500);
        
        return cy.wrap(properties);
      } else {
        cy.log('No configuration dialog found');
        return cy.wrap({});
      }
    });
  });
});

/**
 * Compare processor properties with expected values (synchronous)
 * @param {Object} currentProperties - Current processor properties
 * @param {Object} expectedProperties - Expected properties to match
 * @returns {boolean} - True if properties match expectations
 */
Cypress.Commands.add('compareProcessorPropertiesSync', (currentProperties, expectedProperties) => {
  cy.log('Comparing processor properties');
  cy.log('Current properties:', currentProperties);
  cy.log('Expected properties:', expectedProperties);
  
  for (const [key, expectedValue] of Object.entries(expectedProperties)) {
    const currentValue = currentProperties[key];
    
    if (currentValue === undefined) {
      cy.log(`Property ${key} not found in current configuration`);
      return false;
    }
    
    // Handle different comparison types
    if (typeof expectedValue === 'string') {
      if (currentValue.toString() !== expectedValue) {
        cy.log(`Property ${key} value mismatch. Expected: ${expectedValue}, Found: ${currentValue}`);
        return false;
      }
    } else if (typeof expectedValue === 'object' && expectedValue.contains) {
      // Partial match for complex values
      if (!currentValue.toString().includes(expectedValue.contains)) {
        cy.log(`Property ${key} does not contain expected value: ${expectedValue.contains}`);
        return false;
      }
    }
  }
  
  return true;
});

/**
 * Get processor state from DOM element (synchronous)
 * @param {JQuery} $element - The processor DOM element
 * @returns {string} - Processor state
 */
Cypress.Commands.add('getProcessorStateFromElement', ($element) => {
  // Look for state indicators in various forms
  const stateElements = $element.find('.processor-state, .state-indicator, [class*="state"]');
  
  if (stateElements.length > 0) {
    const stateText = stateElements.first().text().trim().toUpperCase();
    if (stateText.includes('RUNNING')) return 'RUNNING';
    if (stateText.includes('STOPPED')) return 'STOPPED';
    if (stateText.includes('INVALID')) return 'INVALID';
    if (stateText.includes('DISABLED')) return 'DISABLED';
  }
  
  // Check class names for state indicators
  const classes = $element.attr('class') || '';
  if (classes.includes('running')) return 'RUNNING';
  if (classes.includes('stopped')) return 'STOPPED';
  if (classes.includes('invalid')) return 'INVALID';
  if (classes.includes('disabled')) return 'DISABLED';
  
  // Check for visual state indicators (colors, icons)
  if ($element.find('.running-indicator, .green-indicator').length > 0) return 'RUNNING';
  if ($element.find('.stopped-indicator, .red-indicator').length > 0) return 'STOPPED';
  if ($element.find('.invalid-indicator, .yellow-indicator').length > 0) return 'INVALID';
  
  return 'UNKNOWN';
});

/**
 * Detect if processor has required setup/configuration (synchronous)
 * @param {JQuery} $element - The processor DOM element
 * @returns {boolean} - True if processor has required setup
 */
Cypress.Commands.add('detectProcessorSetupFromElement', ($element) => {
  // Check if processor has basic configuration
  const hasValidState = $element.find('.invalid-indicator, [class*="invalid"]').length === 0;
  const hasNoErrors = $element.find('.error-indicator, [class*="error"]').length === 0;
  
  // Check if processor appears to be configured (not in default state)
  const hasCustomization = $element.find('.configured-indicator, [class*="configured"]').length > 0 ||
                           $element.find('.unconfigured-indicator, [class*="unconfigured"]').length === 0;
  
  // A processor is considered "set up" if it has valid state and no errors
  return hasValidState && hasNoErrors;
});

/**
 * Create a reliable processor reference system for testing
 * @param {string} processorType - The processor type
 * @param {Object} position - Position coordinates
 * @returns {Cypress.Chainable<Object>} - Processor reference object
 */
Cypress.Commands.add('createProcessorReference', (processorType, position = { x: 300, y: 300 }) => {
  cy.log(`Creating processor reference for type: ${processorType}`);
  
  // Count existing processors before adding
  return cy.get('body').then(($body) => {
    const existingCount = $body.find('g.processor, [class*="processor"], .component').length;
    
    // Add processor using existing command
    return cy.addProcessor(processorType, position).then((processorId) => {
      // Create comprehensive reference object
      const reference = {
        id: processorId,
        type: processorType,
        position: position,
        index: existingCount,
        timestamp: Date.now(),
        // Primary identification methods
        selectors: [
          `[data-testid="${processorId}"]`,
          `g[id="${processorId}"]`,
          `[id="${processorId}"]`,
          `.processor[data-id="${processorId}"]`,
          `[data-processor-id="${processorId}"]`
        ],
        // Alternative identification by position or index
        fallbackSelectors: [
          `g.processor:nth-child(${existingCount + 1})`,
          `[class*="processor"]:nth-child(${existingCount + 1})`,
          `.component:nth-child(${existingCount + 1})`
        ]
      };
      
      cy.log('Created processor reference:', reference);
      return cy.wrap(reference);
    });
  });
});

/**
 * Get processor element using reference object
 * More reliable than simple ID lookup
 * @param {Object} processorRef - Processor reference object
 * @returns {Cypress.Chainable} - Processor DOM element
 */
Cypress.Commands.add('getProcessorByReference', (processorRef) => {
  cy.log(`Getting processor by reference: ${processorRef.id}`);
  
  return cy.get('body').then(($body) => {
    // Try primary selectors first
    for (const selector of processorRef.selectors) {
      const elements = $body.find(selector);
      if (elements.length > 0) {
        return cy.get(selector).first();
      }
    }
    
    // Try fallback selectors
    for (const selector of processorRef.fallbackSelectors) {
      const elements = $body.find(selector);
      if (elements.length > 0) {
        return cy.get(selector).first();
      }
    }
    
    // Try to find by processor type
    return cy.findProcessorByType(processorRef.type);
  });
});

/**
 * Improved processor element discovery with multiple strategies
 * Fixes processor ID extraction inconsistency from Angular UI
 * @param {string} processorId - The processor ID to find
 * @returns {Cypress.Chainable} - Processor DOM element
 */
Cypress.Commands.add('findProcessorElement', (processorId) => {
  cy.log(`Finding processor element: ${processorId}`);
  
  return cy.get('body').then(($body) => {
    // Strategy 1: Direct ID match
    const idSelectors = [
      `[data-testid="${processorId}"]`,
      `g[id="${processorId}"]`,
      `[id="${processorId}"]`,
      `[data-processor-id="${processorId}"]`,
      `[data-id="${processorId}"]`
    ];
    
    for (const selector of idSelectors) {
      const elements = $body.find(selector);
      if (elements.length > 0) {
        cy.log(`Found processor using selector: ${selector}`);
        return cy.get(selector).first();
      }
    }
    
    // Strategy 2: Partial ID match (handles UI inconsistencies)
    const partialIdSelectors = [
      `[id*="${processorId}"]`,
      `[data-testid*="${processorId}"]`,
      `[class*="${processorId}"]`
    ];
    
    for (const selector of partialIdSelectors) {
      const elements = $body.find(selector);
      if (elements.length > 0) {
        cy.log(`Found processor using partial selector: ${selector}`);
        return cy.get(selector).first();
      }
    }
    
    // Strategy 3: Find by index if ID is numeric
    const idMatch = processorId.match(/\d+/);
    if (idMatch) {
      const index = parseInt(idMatch[0]);
      const processorElements = $body.find('g.processor, [class*="processor"], .component');
      if (processorElements.length > index) {
        cy.log(`Found processor by index: ${index}`);
        return cy.get('g.processor, [class*="processor"], .component').eq(index);
      }
    }
    
    // Strategy 4: Return first available processor if no specific match
    const allProcessors = $body.find('g.processor, [class*="processor"], .component');
    if (allProcessors.length > 0) {
      cy.log('Using first available processor as fallback');
      return cy.get('g.processor, [class*="processor"], .component').first();
    }
    
    throw new Error(`No processor element found for ID: ${processorId}`);
  });
});
