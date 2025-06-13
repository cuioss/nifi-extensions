/**
 * Processor Management Utilities
 * CUI Standards Compliant - Core processor operations
 */

import { SELECTORS, TIMEOUTS } from '../constants.js';
import { waitForVisible, waitForDialog } from '../wait-utils.js';

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
  return [
    `[data-processor-type="${safeType}"]`,
    `[title*="${safeType}"]`,
    `[aria-label*="${safeType}"]`,
    `.processor:contains("${safeType}")`,
  ];
}

/**
 * Extract processor ID from element using multiple strategies
 * @param {JQuery} $element - jQuery element
 * @returns {string|null} Extracted processor ID or null
 */
export function extractProcessorId($element) {
  if (!$element || $element.length === 0) {
    return null;
  }

  // Try various ID attributes
  const idAttributes = ['id', 'data-testid', 'data-processor-id', 'data-id'];
  
  for (const attr of idAttributes) {
    const id = $element.attr(attr);
    if (id && id.trim()) {
      return id.trim();
    }
  }

  return null;
}

/**
 * Get processor state from element
 * @param {JQuery} $element - Processor element
 * @returns {string} Processor state (RUNNING, STOPPED, etc.)
 */
export function getProcessorState($element) {
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
        const actualState = getProcessorState($element);
        expect(actualState).to.equal(expectedState);
        return cy.wrap($element);
      }
    }
    throw new Error(`Processor ${processorId} not found for state verification`);
  });
}
