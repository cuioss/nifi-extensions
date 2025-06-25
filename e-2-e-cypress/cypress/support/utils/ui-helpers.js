/**
 * UI interaction utility functions for NiFi E2E tests
 * Provides comprehensive UI helpers following requirements from Requirements.md
 */

/**
 * Wait for element with enhanced error reporting
 * @param {string} selector - CSS selector for element
 * @param {Object} options - Wait options
 * @param {number} options.timeout - Maximum wait time (default: 15000)
 * @param {boolean} options.visible - Whether element should be visible (default: true)
 * @param {string} options.errorMessage - Custom error message for failures
 * @returns {Cypress.Chainable} Cypress chainable with element
 */
export function waitForElement(selector, options = {}) {
  const { timeout = 15000, visible = true } = options;

  if (visible) {
    return cy.get(selector, { timeout }).should('be.visible').should('exist');
  }

  return cy.get(selector, { timeout }).should('exist');
}

/**
 * Safe click with retry mechanism
 * @param {string} selector - CSS selector for element to click
 * @param {Object} options - Click options
 * @param {number} options.timeout - Timeout for finding element (default: 10000)
 * @param {number} options.retries - Number of retry attempts (default: 3)
 * @param {boolean} options.force - Whether to force click (default: false)
 * @param {string} options.errorContext - Context for error messages
 */
export function safeClick(selector, options = {}) {
  const {
    timeout = 10000,
    retries = 3,
    force = false,
    errorContext = 'Safe click operation',
  } = options;

  cy.log(`🖱️ ${errorContext}: clicking ${selector}`);

  // Wait for element to be available
  waitForElement(selector, { timeout, visible: true });

  // Perform click with retry logic
  let attempt = 0;
  const performClick = () => {
    attempt++;
    cy.get(selector).then(($el) => {
      if ($el.length === 0) {
        if (attempt <= retries) {
          cy.wait(1000);
          performClick();
        } else {
          throw new Error(
            `${errorContext}: Element ${selector} not found after ${retries} retries`
          );
        }
      } else {
        cy.wrap($el).click({ force });
      }
    });
  };

  performClick();
  cy.log(`✅ ${errorContext}: successfully clicked ${selector}`);
}

/**
 * Navigate through tabs with validation
 * @param {string} tabName - Name or text content of tab to click
 * @param {Object} options - Navigation options
 * @param {number} options.timeout - Timeout for operations (default: 10000)
 * @param {boolean} options.validateContent - Whether to validate tab content loads (default: true)
 * @param {string} options.expectedContent - Expected content selector after tab switch
 */
export function navigateToTab(tabName, options = {}) {
  const {
    timeout = 10000,
    validateContent = true,
    expectedContent = '.tab-content, .tab-panel',
  } = options;

  cy.log(`📑 Navigating to tab: ${tabName}`);

  // Find and click tab
  const tabSelectors = [
    `.tab:contains("${tabName}")`,
    `.tab-button:contains("${tabName}")`,
    `.nav-tab:contains("${tabName}")`,
    `[role="tab"]:contains("${tabName}")`,
    `.configuration-tab:contains("${tabName}")`,
  ];

  let tabFound = false;
  tabSelectors.forEach((selector) => {
    cy.get('body').then(($body) => {
      if ($body.find(selector).length > 0 && !tabFound) {
        tabFound = true;
        safeClick(selector, { timeout, errorContext: `Tab navigation to ${tabName}` });
      }
    });
  });

  if (!tabFound) {
    throw new Error(`Tab "${tabName}" not found with any of the expected selectors`);
  }

  // Validate tab content loads
  if (validateContent) {
    waitForElement(expectedContent, { timeout });

    // Wait for any loading spinners to disappear
    cy.get('body').then(($body) => {
      if ($body.find('.loading, .spinner, .loading-spinner').length > 0) {
        cy.get('.loading, .spinner, .loading-spinner', { timeout }).should('not.exist');
      }
    });
  }

  cy.log(`✅ Successfully navigated to tab: ${tabName}`);
}

/**
 * Fill form fields with validation
 * @param {Object} formData - Object with field names as keys and values as values
 * @param {Object} options - Form filling options
 * @param {number} options.timeout - Timeout for field operations (default: 5000)
 * @param {boolean} options.clearFirst - Whether to clear fields before typing (default: true)
 * @param {boolean} options.validateAfterFill - Whether to validate values after filling (default: true)
 */
export function fillForm(formData, options = {}) {
  const { timeout = 5000, clearFirst = true, validateAfterFill = true } = options;

  cy.log('📝 Filling form fields');

  Object.entries(formData).forEach(([fieldName, value]) => {
    const fieldSelectors = [
      `input[name="${fieldName}"]`,
      `#${fieldName}`,
      `[data-field="${fieldName}"]`,
      `input[aria-label*="${fieldName}"]`,
      `textarea[name="${fieldName}"]`,
      `select[name="${fieldName}"]`,
    ];

    let fieldFound = false;
    fieldSelectors.forEach((selector) => {
      cy.get('body').then(($body) => {
        if ($body.find(selector).length > 0 && !fieldFound) {
          fieldFound = true;
          cy.get(selector, { timeout }).should('be.visible');

          if (clearFirst) {
            cy.get(selector).clear();
          }

          if (value !== null && value !== undefined) {
            cy.get(selector).type(String(value));

            if (validateAfterFill) {
              cy.get(selector).should('have.value', String(value));
            }
          }
        }
      });
    });

    if (!fieldFound) {
      cy.log(`⚠️ Field "${fieldName}" not found, skipping`);
    }
  });

  cy.log('✅ Form fields filled successfully');
}

/**
 * Validate UI elements are accessible and interactive
 * @param {Array<string>} selectors - Array of CSS selectors to validate
 * @param {Object} options - Validation options
 * @param {number} options.timeout - Timeout for each validation (default: 5000)
 * @param {boolean} options.checkInteractivity - Whether to test element interactivity (default: false)
 */
export function validateUIAccessibility(selectors, options = {}) {
  const { timeout = 5000, checkInteractivity = false } = options;

  cy.log('♿ Validating UI accessibility');

  selectors.forEach((selector) => {
    cy.get(selector, { timeout }).should('be.visible').should('exist');

    if (checkInteractivity) {
      cy.get(selector).then(($el) => {
        const tagName = $el.prop('tagName').toLowerCase();

        if (['button', 'input', 'select', 'textarea'].includes(tagName)) {
          cy.wrap($el).should('not.be.disabled');
        }

        if (['a', 'button'].includes(tagName)) {
          // Test that element can receive focus
          cy.wrap($el).focus().should('have.focus');
        }
      });
    }
  });

  cy.log('✅ UI accessibility validated');
}

/**
 * Wait for dialog to appear and be interactive
 * @param {Object} options - Dialog options
 * @param {Array<string>} options.selectors - Possible dialog selectors (default: common dialog selectors)
 * @param {number} options.timeout - Timeout to wait for dialog (default: 15000)
 * @param {boolean} options.validateButtons - Whether to validate dialog has interactive buttons (default: true)
 * @returns {Cypress.Chainable} Cypress chainable with dialog element
 */
export function waitForDialog(options = {}) {
  const {
    selectors = [
      '.dialog',
      '.modal',
      '.popup',
      '.overlay-dialog',
      '.configuration-dialog',
      '.processor-dialog',
      '#dialog',
    ],
    timeout = 15000,
    validateButtons = true,
  } = options;

  cy.log('🔲 Waiting for dialog to appear');

  let dialogFound = false;
  let dialogElement = null;

  selectors.forEach((selector) => {
    cy.get('body').then(($body) => {
      if ($body.find(selector).length > 0 && !dialogFound) {
        dialogFound = true;
        dialogElement = selector;
        cy.get(selector, { timeout }).should('be.visible');
      }
    });
  });

  if (!dialogFound) {
    throw new Error(`Dialog not found with any of the expected selectors: ${selectors.join(', ')}`);
  }

  if (validateButtons) {
    cy.get(`${dialogElement} button, ${dialogElement} .button`).should(
      'have.length.greaterThan',
      0
    );
  }

  cy.log('✅ Dialog appeared and validated');
  return cy.get(dialogElement);
}

/**
 * Close dialog or modal with multiple strategies
 * @param {Object} options - Close options
 * @param {Array<string>} options.closeSelectors - Selectors for close buttons (default: common close selectors)
 * @param {boolean} options.useEscape - Whether to try Escape key if buttons don't work (default: true)
 * @param {number} options.timeout - Timeout for close operation (default: 5000)
 */
export function closeDialog(options = {}) {
  const {
    closeSelectors = [
      '.close-button',
      '.cancel-button',
      'button:contains("Close")',
      'button:contains("Cancel")',
      'button:contains("OK")',
      '.dialog-close',
      '.modal-close',
    ],
    useEscape = true,
    timeout = 5000,
  } = options;

  cy.log('❌ Closing dialog');

  let closed = false;
  closeSelectors.forEach((selector) => {
    cy.get('body').then(($body) => {
      if ($body.find(selector).length > 0 && !closed) {
        closed = true;
        safeClick(selector, { timeout, errorContext: 'Dialog close' });
      }
    });
  });

  if (!closed && useEscape) {
    cy.log('⌨️ Trying Escape key to close dialog');
    cy.get('body').type('{esc}');
  }

  // Verify dialog is closed
  cy.get('.dialog, .modal, .popup', { timeout }).should('not.exist');

  cy.log('✅ Dialog closed successfully');
}

/**
 * Scroll element into view with validation
 * @param {string} selector - CSS selector for element to scroll to
 * @param {Object} options - Scroll options
 * @param {string} options.position - Scroll position ('top', 'center', 'bottom') (default: 'center')
 * @param {number} options.timeout - Timeout for operation (default: 5000)
 */
export function scrollIntoView(selector, options = {}) {
  const { position = 'center', timeout = 5000 } = options;

  cy.log(`📜 Scrolling element into view: ${selector}`);

  cy.get(selector, { timeout }).should('exist').scrollIntoView({ position });

  // Verify element is now visible
  cy.get(selector).should('be.visible');

  cy.log(`✅ Element scrolled into view: ${selector}`);
}

/**
 * Handle tooltip interactions and validation
 * @param {string} triggerSelector - CSS selector for element that triggers tooltip
 * @param {Object} options - Tooltip options
 * @param {string} options.expectedText - Expected tooltip text content
 * @param {number} options.timeout - Timeout for tooltip to appear (default: 3000)
 * @param {string} options.tooltipSelector - CSS selector for tooltip element (default: common tooltip selectors)
 */
export function validateTooltip(triggerSelector, options = {}) {
  const {
    expectedText,
    timeout = 3000,
    tooltipSelector = '.tooltip, .help-tooltip, .info-tooltip, [role="tooltip"]',
  } = options;

  cy.log(`💡 Validating tooltip for: ${triggerSelector}`);

  // Hover over trigger element
  cy.get(triggerSelector).should('be.visible').trigger('mouseover');

  // Wait for tooltip to appear
  cy.get(tooltipSelector, { timeout }).should('be.visible');

  // Validate tooltip content if specified
  if (expectedText) {
    cy.get(tooltipSelector).should('contain', expectedText);
  }

  // Move mouse away to hide tooltip
  cy.get('body').trigger('mousemove', { clientX: 0, clientY: 0 });

  cy.log('✅ Tooltip validated successfully');
}

/**
 * Wait for all loading states to complete
 * @param {Object} options - Loading options
 * @param {number} options.timeout - Maximum time to wait for loading to complete (default: 30000)
 * @param {Array<string>} options.loadingSelectors - Selectors for loading indicators (default: common loading selectors)
 */
export function waitForLoadingComplete(options = {}) {
  const {
    timeout = 30000,
    loadingSelectors = [
      '.loading',
      '.spinner',
      '.loading-spinner',
      '.progress',
      '.loading-indicator',
      '[data-loading="true"]',
    ],
  } = options;

  cy.log('⏳ Waiting for all loading states to complete');

  loadingSelectors.forEach((selector) => {
    cy.get('body').then(($body) => {
      if ($body.find(selector).length > 0) {
        cy.get(selector, { timeout }).should('not.exist');
      }
    });
  });

  // Additional check for loading text
  const loadingTexts = [
    'Loading...',
    'Loading JWT Validator UI...',
    'Please wait...',
    'Initializing...',
  ];

  loadingTexts.forEach((text) => {
    cy.get('body').should('not.contain', text);
  });

  cy.log('✅ All loading states completed');
}
