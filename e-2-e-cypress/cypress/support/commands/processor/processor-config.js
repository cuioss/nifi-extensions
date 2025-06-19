/**
 * Processor Configuration Management
 * CUI Standards Compliant - Configuration dialog operations
 */

import { SELECTORS, TEXT_CONSTANTS } from '../../constants.js';
import { waitForDialog } from '../../wait-utils.js';
import { safeString, buildProcessorSelectors } from './processor-utils.js';

/**
 * Navigate to processor properties tab
 * @returns {Cypress.Chainable} Cypress chainable
 */
export function navigateToPropertiesTab() {
  return cy
    .get('.processor-configuration-tab, .mat-tab-label')
    .contains(TEXT_CONSTANTS.PROPERTIES)
    .click();
}

/**
 * Extract property values from configuration dialog
 * @returns {Cypress.Chainable<object>} Object with property name-value pairs
 */
export function extractPropertyValues() {
  return cy.get('body').then(($body) => {
    const properties = {};

    // Find property rows and extract name-value pairs
    $body.find('.processor-property-row, .property-row').each((index, row) => {
      const $row = Cypress.$(row);
      const name = $row.find('.processor-property-name, .property-name').text().trim();
      const value =
        $row.find('input, select, textarea').val() || $row.find('.property-value').text().trim();

      if (name) {
        properties[name] = value || '';
      }
    });

    return cy.wrap(properties);
  });
}

/**
 * Set processor property value
 * @param {string} propertyName - Property name
 * @param {string} propertyValue - Property value
 * @returns {Cypress.Chainable} Cypress chainable
 */
export function setProcessorProperty(propertyName, propertyValue) {
  const safeValue = safeString(propertyValue);

  return cy
    .get(SELECTORS.PROCESSOR_PROPERTY_NAME)
    .contains(propertyName)
    .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
    .within(() => {
      // Try different input types
      cy.get('input, select, textarea')
        .first()
        .then(($input) => {
          if ($input.is('select')) {
            cy.wrap($input).select(safeValue);
          } else {
            cy.wrap($input).clear().type(safeValue);
          }
        });
    });
}

/**
 * Validate processor properties match expected values
 * @param {object} currentProps - Current properties
 * @param {object} expectedProps - Expected properties
 * @returns {boolean} True if properties match
 */
export function validatePropertiesMatch(currentProps, expectedProps) {
  for (const [key, expectedValue] of Object.entries(expectedProps)) {
    const currentValue = currentProps[key];
    if (currentValue !== expectedValue) {
      cy.log(`Property mismatch: ${key} = "${currentValue}", expected "${expectedValue}"`);
      return false;
    }
  }
  return true;
}

/**
 * Close configuration dialog safely
 * @returns {Cypress.Chainable} Cypress chainable
 */
export function closeConfigurationDialog() {
  return cy.get('body').then(($body) => {
    // Try different close methods
    if ($body.find('[data-testid="dialog-close"], .mat-dialog-close').length > 0) {
      cy.get('[data-testid="dialog-close"], .mat-dialog-close').first().click();
    } else if ($body.find('button').filter(':contains("Cancel")').length > 0) {
      cy.get('button').contains(TEXT_CONSTANTS.CANCEL).click();
    } else {
      // Fallback: press Escape
      cy.get('body').type('{esc}');
    }

    // Wait for dialog to close
    cy.get(SELECTORS.DIALOG).should('not.exist');
  });
}

/**
 * Open processor configuration dialog
 * @param {string} processorId - Processor ID
 * @returns {Cypress.Chainable} Cypress chainable
 */
export function openProcessorConfigDialog(processorId) {
  const selectors = buildProcessorSelectors(processorId);

  return cy.get('body').then(($body) => {
    for (const selector of selectors) {
      const $element = $body.find(selector);
      if ($element.length > 0) {
        // Try double-click first
        cy.wrap($element).dblclick({ force: true });

        // Wait for dialog to appear
        return waitForDialog();
      }
    }
    throw new Error(`Processor ${processorId} not found for configuration`);
  });
}
