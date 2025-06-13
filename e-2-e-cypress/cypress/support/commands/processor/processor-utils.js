/**
 * Processor Management Utilities
 * CUI Standards Compliant - Core processor operations
 */

import { SELECTORS, TIMEOUTS } from '../../constants.js';
import { waitForVisible, waitForDialog } from '../../wait-utils.js';

/**
 * Safe string conversion for template literals
 * @param {any} value - Value to convert to string
 * @returns {string} Safe string representation
 */
export function safeString(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Build processor selector array with safe string handling
 * @param {string} processorId - The processor ID
 * @returns {Array<string>} Array of CSS selectors
 */
export function buildProcessorSelectors(processorId) {
  const safeId = safeString(processorId);
  return [
    `[data-testid="${safeId}"]`,
    `g[id="${safeId}"]`,
    `[id="${safeId}"]`,
    `[data-processor-id="${safeId}"]`,
    `[data-id="${safeId}"]`,
    `.processor[data-id="${safeId}"]`,
  ];
}

/**
 * Build type-based selectors for processor discovery
 * @param {string} processorType - The processor type
 * @returns {Array<string>} Array of type-based selectors
 */
export function buildTypeSelectors(processorType) {
  const safeType = safeString(processorType);
  const baseSelectors = [
    `*:contains("${safeType}")`,
    `[title*="${safeType}"]`,
    `[class*="${safeType}"]`,
    `[data-processor-type="${safeType}"]`,
  ];

  // Add JWT-specific selectors
  if (safeType.includes('JWT')) {
    baseSelectors.push('*:contains("JWT")', '*:contains("Token")', '*:contains("Authenticator")');
  }

  return baseSelectors;
}

/**
 * Find element using selector array with early return optimization
 * @param {JQuery} $body - Body element to search within
 * @param {Array<string>} selectors - Array of selectors to try
 * @returns {JQuery|null} Found element or null
 */
export function findElementWithSelectors($body, selectors) {
  for (const selector of selectors) {
    const elements = $body.find(selector);
    if (elements.length > 0) {
      return elements.first();
    }
  }
  return null;
}

/**
 * Extract processor ID from element attributes
 * @param {JQuery} $element - Processor element
 * @param _$element
 * @returns {string} Extracted processor ID
 */
export function extractProcessorId(_$element) {
  return (
    $element.attr('id') ||
    $element.attr('data-testid') ||
    $element.attr('data-processor-id') ||
    $element.attr('data-id') ||
    `functional-processor-${Date.now()}`
  );
}

/**
 * Get processor state from element
 * @param {JQuery} $element - Processor element
 * @param _$element
 * @returns {string} Processor state (RUNNING, STOPPED, etc.)
 */
export function getProcessorState(_$element) {
  if (!$element || $element.length === 0) {
    return 'UNKNOWN';
  }

  // Check for state indicators
  if ($element.find('.fa-play, .running-indicator').length > 0) {
    return 'RUNNING';
  }
  if ($element.find('.fa-stop, .stopped-indicator').length > 0) {
    return 'STOPPED';
  }
  if ($element.find('.fa-warning, .invalid-indicator').length > 0) {
    return 'INVALID';
  }

  return 'STOPPED'; // Default state
}

/**
 * Verify processor is in expected state
 * @param {string} processorId - Processor ID
 * @param {string} expectedState - Expected state
 * @returns {Cypress.Chainable} Cypress chainable
 */
export function verifyProcessorState(processorId, expectedState) {
  const selectors = buildProcessorSelectors(processorId);

  return cy.get('body').then(($body) => {
    for (const selector of selectors) {
      const $element = $body.find(selector);
      if ($element.length > 0) {
        const actualState = getProcessorState(_$element);
        expect(actualState).to.equal(expectedState);
        return cy.wrap(_$element);
      }
    }
    throw new Error(`Processor ${processorId} not found for state verification`);
  });
}
