/**
 * CUI-compliant waiting utilities
 * Replaces arbitrary cy.wait() calls with proper condition-based waits
 */

import { SELECTORS, TIMEOUTS, TEXT_CONSTANTS } from './constants.js';

/**
 * Wait for element to be visible with proper timeout
 * @param {string} selector - CSS selector for the element
 * @param {number} [timeout=5000] - Maximum time to wait in milliseconds
 * @returns {Cypress.Chainable} Cypress chainable element
 */
export function waitForVisible(selector, timeout = TIMEOUTS.LONG) {
  return cy.get(selector, { timeout }).should(TEXT_CONSTANTS.BE_VISIBLE);
}

/**
 * Wait for element to exist in DOM
 * @param {string} selector - CSS selector for the element
 * @param {number} [timeout=5000] - Maximum time to wait in milliseconds
 * @returns {Cypress.Chainable} Cypress chainable element
 */
export function waitForExists(selector, timeout = TIMEOUTS.LONG) {
  return cy.get(selector, { timeout }).should('exist');
}

/**
 * Wait for element to be clickable (visible and enabled)
 * @param {string} selector - CSS selector for the element
 * @param {number} [timeout=5000] - Maximum time to wait in milliseconds
 * @returns {Cypress.Chainable} Cypress chainable element
 */
export function waitForClickable(selector, timeout = TIMEOUTS.LONG) {
  return cy.get(selector, { timeout }).should('be.visible').should('not.be.disabled');
}

/**
 * Wait for text content to appear
 * @param {string} selector - CSS selector for the element
 * @param {string} text - Expected text content
 * @param {number} [timeout=5000] - Maximum time to wait in milliseconds
 * @returns {Cypress.Chainable} Cypress chainable element
 */
export function waitForText(selector, text, timeout = TIMEOUTS.LONG) {
  return cy.get(selector, { timeout }).should('contain.text', text);
}

/**
 * Wait for page to load completely
 * @param {number} [timeout=10000] - Maximum time to wait in milliseconds
 * @returns {Cypress.Chainable} Cypress chainable
 */
export function waitForPageLoad(timeout = TIMEOUTS.VERY_LONG) {
  return cy.window({ timeout }).should('have.property', 'document');
}

/**
 * Wait for dialog to appear
 * @param {number} [timeout=5000] - Maximum time to wait in milliseconds
 * @returns {Cypress.Chainable} Cypress chainable element
 */
export function waitForDialog(timeout = TIMEOUTS.LONG) {
  return waitForVisible(SELECTORS.DIALOG, timeout);
}

/**
 * Wait for processors to load
 * @param {number} [timeout=5000] - Maximum time to wait in milliseconds
 * @returns {Cypress.Chainable} Cypress chainable element
 */
export function waitForProcessors(timeout = TIMEOUTS.LONG) {
  return waitForVisible(SELECTORS.PROCESSOR, timeout);
}

/**
 * Wait for element count to change
 * @param {string} selector - CSS selector for elements to count
 * @param {number} expectedCount - Expected number of elements
 * @param {number} [timeout=5000] - Maximum time to wait in milliseconds
 * @returns {Cypress.Chainable} Cypress chainable
 */
export function waitForElementCount(selector, expectedCount, timeout = TIMEOUTS.LONG) {
  return cy.get('body', { timeout }).should(($body) => {
    const count = $body.find(selector).length;
    expect(count).to.equal(expectedCount);
  });
}

/**
 * Wait for element count to be greater than specified number
 * @param {string} selector - CSS selector for elements to count
 * @param {number} minCount - Minimum number of elements expected
 * @param {number} [timeout=5000] - Maximum time to wait in milliseconds
 * @returns {Cypress.Chainable} Cypress chainable
 */
export function waitForMinElementCount(selector, minCount, timeout = TIMEOUTS.LONG) {
  return cy.get('body', { timeout }).should(($body) => {
    const count = $body.find(selector).length;
    expect(count).to.be.greaterThan(minCount);
  });
}

/**
 * Wait for network request to complete
 * @param {string} alias - Cypress alias for the intercepted request
 * @param {number} [timeout=10000] - Maximum time to wait in milliseconds
 * @returns {Cypress.Chainable} Cypress chainable
 */
export function waitForRequest(alias, timeout = TIMEOUTS.VERY_LONG) {
  return cy.wait(alias, { timeout });
}

/**
 * Wait for element to have specific attribute value
 * @param {string} selector - CSS selector for the element
 * @param {string} attribute - Attribute name
 * @param {string} value - Expected attribute value
 * @param {number} [timeout=5000] - Maximum time to wait in milliseconds
 * @returns {Cypress.Chainable} Cypress chainable element
 */
export function waitForAttribute(selector, attribute, value, timeout = TIMEOUTS.LONG) {
  return cy.get(selector, { timeout }).should('have.attr', attribute, value);
}

/**
 * Wait for element to have specific class
 * @param {string} selector - CSS selector for the element
 * @param {string} className - Expected class name
 * @param {number} [timeout=5000] - Maximum time to wait in milliseconds
 * @returns {Cypress.Chainable} Cypress chainable element
 */
export function waitForClass(selector, className, timeout = TIMEOUTS.LONG) {
  return cy.get(selector, { timeout }).should('have.class', className);
}

/**
 * Smart wait that tries multiple strategies
 * @param {string} selector - CSS selector for the element
 * @param {Object} [options={}] - Wait options
 * @param {number} [options.timeout=5000] - Maximum time to wait
 * @param {string} [options.text] - Text to wait for
 * @param {string} [options.attribute] - Attribute to check
 * @param {string} [options.value] - Attribute value to check
 * @returns {Cypress.Chainable} Cypress chainable element
 */
export function smartWait(selector, options = {}) {
  const { timeout = TIMEOUTS.LONG, text, attribute, value } = options;

  // Build the chain of assertions without assignment
  return cy
    .get(selector, { timeout })
    .should('be.visible')
    .then(($el) => {
      if (text) {
        cy.wrap($el).should('contain.text', text);
      }

      if (attribute && value) {
        cy.wrap($el).should('have.attr', attribute, value);
      }

      return cy.wrap($el);
    });
}
