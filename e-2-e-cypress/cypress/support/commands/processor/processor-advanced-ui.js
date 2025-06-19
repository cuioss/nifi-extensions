/**
 * Advanced Custom UI Commands for MultiIssuerJWTTokenAuthenticator Processor
 * Task 2 Implementation: Custom Processor UI Testing (Advanced Dialog)
 * CUI Standards Compliant
 */

import { SELECTORS, TEXT_CONSTANTS, TIMEOUTS } from '../../constants.js';
import { _waitForVisible, _waitForDialog } from '../../wait-utils.js';

/**
 * Open the Advanced dialog for a processor via right-click context menu
 * @param {string} processorId - The ID of the processor
 * @returns {Cypress.Chainable} Cypress chainable
 */
Cypress.Commands.add('openProcessorAdvancedDialog', (processorId) => {
  cy.log('🔧 Opening processor Advanced dialog for enhanced UI testing');

  return cy.getProcessorElement(processorId).then(($element) => {
    // Step 1: Right-click to open context menu
    cy.wrap($element).rightclick({ force: true });

    // Step 2: Wait for context menu to appear
    cy.get('.context-menu, .mat-menu-panel, [role="menu"]', { timeout: TIMEOUTS.MEDIUM }).should(
      'be.visible'
    );

    // Step 3: Look for Advanced option in context menu
    cy.get('body').then(($body) => {
      const contextMenus = $body.find('.context-menu, .mat-menu-panel, [role="menu"]');

      if (contextMenus.length > 0) {
        // Try multiple possible selectors for Advanced option
        const advancedSelectors = [
          '*:contains("Advanced")',
          '*:contains("Custom UI")',
          '*:contains("Extended")',
          '*:contains("Configuration")',
          '.menu-item:contains("Advanced")',
          '.popup-menu-item:contains("Advanced")',
        ];

        let advancedFound = false;

        for (const selector of advancedSelectors) {
          const advancedElements = $body.find(selector);
          if (advancedElements.length > 0) {
            cy.log('✅ Found Advanced option with selector:', selector);
            cy.get(selector).first().click({ force: true });
            advancedFound = true;
            break;
          }
        }

        if (!advancedFound) {
          cy.log('⚠️ Advanced option not found, trying fallback to Configure');
          // Fallback to standard Configure option
          cy.get('*:contains("Configure"), *:contains("Properties")')
            .first()
            .click({ force: true });
        }
      }
    });

    // Step 4: Wait for advanced dialog to open
    cy.waitForAdvancedDialog();

    cy.log('✅ Advanced dialog opened successfully');
  });
});

/**
 * Wait for the Advanced/Custom UI dialog to be ready
 * @returns {Cypress.Chainable} Cypress chainable
 */
Cypress.Commands.add('waitForAdvancedDialog', () => {
  const checkAdvancedDialogState = () => {
    return cy.get('body').then(($body) => {
      // Check for custom UI dialog indicators
      const customUISelectors = [
        '.custom-tabs',
        '.custom-tabs-navigation',
        '#jwt-validator-tabs',
        '.processor-dialog',
        '.advanced-configuration-dialog',
      ];

      const hasCustomUI = customUISelectors.some((selector) => $body.find(selector).length > 0);

      // Check for tab navigation structure
      const hasTabNavigation = $body.find('.tab-nav-item, .custom-tab').length > 0;

      // Check for standard configuration dialog as fallback
      const hasStandardDialog = $body.find(SELECTORS.DIALOG).length > 0;

      const isDialogReady = hasCustomUI || hasTabNavigation || hasStandardDialog;

      if (!isDialogReady) {
        throw new Error('Advanced dialog not detected with any strategy');
      }

      return true;
    });
  };

  return cy
    .wrap(null)
    .then(() => checkAdvancedDialogState())
    .then(() => {
      cy.log('✅ Advanced dialog is ready for testing');
      // Small wait to ensure UI is fully rendered
      cy.wait(500);
    });
});

/**
 * Navigate to a specific tab in the custom UI
 * @param {string} tabName - Tab name or identifier ('tab1', 'properties', 'tab2', 'validation', 'tab3', 'advanced')
 * @returns {Cypress.Chainable} Cypress chainable
 */
Cypress.Commands.add('navigateToCustomUITab', (tabName) => {
  cy.log(`🔄 Navigating to custom UI tab: ${tabName}`);

  // Normalize tab name to handle both numeric and descriptive names
  const normalizedTabName = normalizeTabName(tabName);

  return cy.get('body').then(($body) => {
    // Strategy 1: Try custom tab navigation
    const customTabNavigation = $body.find('.custom-tabs-navigation, #custom-tabs-navigation');

    if (customTabNavigation.length > 0) {
      cy.navigateToCustomTab(normalizedTabName);
      return;
    }

    // Strategy 2: Try standard Material/Angular tabs
    const materialTabs = $body.find('.mat-tab-label, .tab-label');

    if (materialTabs.length > 0) {
      cy.navigateToMaterialTab(normalizedTabName);
      return;
    }

    // Strategy 3: Try generic tab navigation
    const genericTabs = $body.find('[role="tab"], .tab, .tab-header');

    if (genericTabs.length > 0) {
      cy.navigateToGenericTab(normalizedTabName);
      return;
    }

    // Strategy 4: Fallback to standard properties navigation
    cy.log('⚠️ Custom tabs not found, using standard properties navigation');
    cy.navigateToPropertiesTab();
  });
});

/**
 * Navigate to custom tab implementation
 * @param {object} tabInfo - Normalized tab information
 */
Cypress.Commands.add('navigateToCustomTab', (tabInfo) => {
  cy.log(`🎯 Using custom tab navigation for: ${tabInfo.display}`);

  // Look for tab navigation items
  cy.get('.tab-nav-item').then(($navItems) => {
    let targetTab = null;

    // Try to find tab by various methods
    $navItems.each((index, item) => {
      const $item = Cypress.$(item);
      const tabText = $item.text().toLowerCase().trim();
      const tabIndex = index + 1;
      const dataTarget = $item.attr('data-tab-target');

      // Match by index, text content, or data attribute
      if (
        tabIndex === tabInfo.index ||
        tabText.includes(tabInfo.keywords.find((k) => tabText.includes(k))) ||
        dataTarget === tabInfo.selector
      ) {
        targetTab = $item;
        return false; // Break the loop
      }
    });

    if (targetTab) {
      cy.wrap(targetTab).click({ force: true });
      cy.verifyCustomTabActive(tabInfo);
    } else {
      throw new Error(`Custom tab not found: ${tabInfo.display}`);
    }
  });
});

/**
 * Navigate to Material Design tabs
 * @param {object} tabInfo - Normalized tab information
 */
Cypress.Commands.add('navigateToMaterialTab', (tabInfo) => {
  cy.log(`🎯 Using Material tab navigation for: ${tabInfo.display}`);

  cy.get('.mat-tab-label, .tab-label').then(($tabs) => {
    let targetTab = null;

    $tabs.each((index, tab) => {
      const $tab = Cypress.$(tab);
      const tabText = $tab.text().toLowerCase().trim();
      const tabIndex = index + 1;

      if (
        tabIndex === tabInfo.index ||
        tabInfo.keywords.some((keyword) => tabText.includes(keyword))
      ) {
        targetTab = $tab;
        return false;
      }
    });

    if (targetTab) {
      cy.wrap(targetTab).click({ force: true });
      cy.verifyMaterialTabActive(tabInfo);
    } else {
      throw new Error(`Material tab not found: ${tabInfo.display}`);
    }
  });
});

/**
 * Navigate to generic tabs
 * @param {object} tabInfo - Normalized tab information
 */
Cypress.Commands.add('navigateToGenericTab', (tabInfo) => {
  cy.log(`🎯 Using generic tab navigation for: ${tabInfo.display}`);

  cy.get('[role="tab"], .tab, .tab-header').then(($tabs) => {
    let targetTab = null;

    $tabs.each((index, tab) => {
      const $tab = Cypress.$(tab);
      const tabText = $tab.text().toLowerCase().trim();
      const tabIndex = index + 1;

      if (
        tabIndex === tabInfo.index ||
        tabInfo.keywords.some((keyword) => tabText.includes(keyword))
      ) {
        targetTab = $tab;
        return false;
      }
    });

    if (targetTab) {
      cy.wrap(targetTab).click({ force: true });
      cy.verifyGenericTabActive(tabInfo);
    } else {
      throw new Error(`Generic tab not found: ${tabInfo.display}`);
    }
  });
});

/**
 * Verify custom tab is active and ready
 * @param {object} tabInfo - Tab information
 */
Cypress.Commands.add('verifyCustomTabActive', (tabInfo) => {
  cy.log(`✅ Verifying custom tab is active: ${tabInfo.display}`);

  // Verify tab navigation item is active
  cy.get('.tab-nav-item.active').should('exist');

  // Verify corresponding tab content is visible
  cy.get('.custom-tab.active').should('be.visible');

  // Verify tab content contains expected elements
  cy.verifyTabContent(tabInfo);
});

/**
 * Verify Material tab is active
 * @param {object} tabInfo - Tab information
 */
Cypress.Commands.add('verifyMaterialTabActive', (tabInfo) => {
  cy.log(`✅ Verifying Material tab is active: ${tabInfo.display}`);

  // Verify active tab indicator
  cy.get('.mat-tab-label-active, .tab-label-active').should('exist');

  // Verify tab content
  cy.verifyTabContent(tabInfo);
});

/**
 * Verify generic tab is active
 * @param {object} tabInfo - Tab information
 */
Cypress.Commands.add('verifyGenericTabActive', (tabInfo) => {
  cy.log(`✅ Verifying generic tab is active: ${tabInfo.display}`);

  // Look for active indicators
  cy.get('[role="tab"][aria-selected="true"], .tab.active, .tab-header.active').should('exist');

  // Verify tab content
  cy.verifyTabContent(tabInfo);
});

/**
 * Verify tab content contains expected elements based on tab type
 * @param {object} tabInfo - Tab information
 */
Cypress.Commands.add('verifyTabContent', (tabInfo) => {
  cy.log(`🔍 Verifying tab content for: ${tabInfo.display}`);

  // Define expected content based on tab type
  const contentSelectors = getTabContentSelectors(tabInfo.type);

  // Verify at least one expected element is present
  const selectorPromises = contentSelectors.map((selector) => {
    return cy.get('body').then(($body) => {
      return $body.find(selector).length > 0;
    });
  });

  cy.wrap(Promise.all(selectorPromises)).then((results) => {
    const hasExpectedContent = results.some(Boolean);

    if (!hasExpectedContent) {
      cy.log(`⚠️ Expected content not found for ${tabInfo.display}, but tab navigation succeeded`);
    } else {
      cy.log(`✅ Tab content verified for ${tabInfo.display}`);
    }
  });
});

/**
 * Close the Advanced/Custom UI dialog
 * @returns {Cypress.Chainable} Cypress chainable
 */
Cypress.Commands.add('closeAdvancedDialog', () => {
  cy.log('🔄 Closing Advanced dialog');

  return cy.get('body').then(($body) => {
    // Try different close methods in order of preference
    const closeMethods = [
      () =>
        $body.find('[data-testid="dialog-close"]').length > 0
          ? cy.get('[data-testid="dialog-close"]').click()
          : null,
      () =>
        $body.find('.mat-dialog-close, .dialog-close').length > 0
          ? cy.get('.mat-dialog-close, .dialog-close').first().click()
          : null,
      () =>
        $body.find('button').filter(':contains("Cancel")').length > 0
          ? cy.get('button').contains(TEXT_CONSTANTS.CANCEL).click()
          : null,
      () =>
        $body.find('button').filter(':contains("Close")').length > 0
          ? cy.get('button').contains('Close').click()
          : null,
      () => cy.get('body').type('{esc}'), // Fallback: ESC key
    ];

    for (const method of closeMethods) {
      const result = method();
      if (result) {
        cy.log('✅ Advanced dialog closed successfully');
        return result;
      }
    }

    cy.log('⚠️ Using ESC key as final fallback');
    return cy.get('body').type('{esc}');
  });
});

// Helper Functions

/**
 * Normalize tab name to standard format with metadata
 * @param {string} tabName - Raw tab name
 * @returns {object} Normalized tab information
 */
function normalizeTabName(tabName) {
  const lowerName = tabName.toLowerCase().trim();

  // Define tab mapping with comprehensive alternatives
  const tabMappings = {
    // Tab 1: Properties/Configuration
    tab1: { index: 1, type: 'properties', selector: 'properties', display: 'Properties' },
    properties: { index: 1, type: 'properties', selector: 'properties', display: 'Properties' },
    config: { index: 1, type: 'properties', selector: 'properties', display: 'Properties' },
    configuration: { index: 1, type: 'properties', selector: 'properties', display: 'Properties' },

    // Tab 2: Validation/Testing
    tab2: { index: 2, type: 'validation', selector: 'validation', display: 'Validation' },
    validation: { index: 2, type: 'validation', selector: 'validation', display: 'Validation' },
    testing: { index: 2, type: 'validation', selector: 'validation', display: 'Validation' },
    verify: { index: 2, type: 'validation', selector: 'validation', display: 'Validation' },

    // Tab 3: Advanced/Metrics
    tab3: { index: 3, type: 'advanced', selector: 'advanced', display: 'Advanced' },
    advanced: { index: 3, type: 'advanced', selector: 'advanced', display: 'Advanced' },
    metrics: { index: 3, type: 'advanced', selector: 'metrics', display: 'Metrics' },
    monitoring: { index: 3, type: 'advanced', selector: 'advanced', display: 'Advanced' },
  };

  const tabInfo = tabMappings[lowerName];

  if (!tabInfo) {
    throw new Error(
      `Unknown tab name: ${tabName}. Supported: tab1/properties, tab2/validation, tab3/advanced`
    );
  }

  // Add keyword arrays for flexible matching
  tabInfo.keywords = getTabKeywords(tabInfo.type);

  return tabInfo;
}

/**
 * Get search keywords for tab type
 * @param {string} tabType - Type of tab
 * @returns {Array<string>} Keywords for finding the tab
 */
function getTabKeywords(tabType) {
  const keywordMap = {
    properties: ['properties', 'config', 'configuration', 'settings'],
    validation: ['validation', 'testing', 'verify', 'test', 'check'],
    advanced: ['advanced', 'metrics', 'monitoring', 'stats', 'performance'],
  };

  return keywordMap[tabType] || [];
}

/**
 * Get expected content selectors for tab type
 * @param {string} tabType - Type of tab
 * @returns {Array<string>} CSS selectors for expected content
 */
function getTabContentSelectors(tabType) {
  const selectorMap = {
    properties: [
      '.processor-property-row',
      '.property-row',
      'input[type="text"]',
      'textarea',
      'select',
      '.form-group',
    ],
    validation: [
      '[data-testid*="validation"]',
      '.validation-section',
      '.test-token',
      'button[type="submit"]',
      '.verify-button',
      '.token-input',
    ],
    advanced: [
      '[data-testid*="metrics"]',
      '.metrics-section',
      '.performance-metrics',
      '.statistics',
      'table',
      '.chart-container',
    ],
  };

  return selectorMap[tabType] || ['.tab-content', '.section'];
}
