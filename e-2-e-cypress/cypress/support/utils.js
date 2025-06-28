/**
 * @file Utility Functions - Common patterns and helper functions
 * Consolidates repeated logic across support files to reduce duplication
 * @version 1.0.0
 */

import { SELECTORS, PAGE_TYPES, TIMEOUTS } from './constants';

/**
 * Find canvas elements using consolidated selector logic
 * @param {Object} $body - jQuery body element
 * @returns {Object} Canvas analysis result
 */
export function findCanvasElements($body) {
  const canvasElements = $body.find(SELECTORS.CANVAS_ELEMENTS);
  return {
    elements: canvasElements,
    count: canvasElements.length,
    hasCanvas: canvasElements.length > 0,
  };
}

/**
 * Find a working canvas selector from the available options
 * @param {number} timeout - Timeout for finding canvas
 * @returns {Cypress.Chainable} Promise resolving to canvas element
 */
export function findWorkingCanvas(timeout = TIMEOUTS.CANVAS_READY) {
  const selectors = [SELECTORS.CANVAS, SELECTORS.CANVAS_CONTAINER, SELECTORS.CANVAS_SVG];

  return cy.get('body').then(($body) => {
    for (const selector of selectors) {
      const elements = $body.find(selector);
      if (elements.length > 0) {
        logMessage('success', `Found canvas using selector: ${selector}`);
        return cy.get(selector, { timeout }).should('be.visible');
      }
    }
    throw new Error(`No canvas found using selectors: ${selectors.join(', ')}`);
  });
}

/**
 * Ensure we're on the main canvas page
 * @param {string} operation - Operation name for logging
 * @returns {Cypress.Chainable<boolean>} True if on main canvas, false otherwise
 */
export function ensureMainCanvas(operation = 'operation') {
  return cy.getPageContext().then((context) => {
    if (context.pageType !== PAGE_TYPES.MAIN_CANVAS) {
      logMessage('warn', `Not on main canvas for ${operation} (current: ${context.pageType})`);
      return false;
    }
    return true;
  });
}

/**
 * Standardized logging with emoji and consistent format
 * @param {string} level - Log level (info, warn, error, success)
 * @param {string} message - Log message
 */
export function logMessage(level, message) {
  const emojis = {
    info: '📍',
    warn: '⚠️',
    error: '❌',
    success: '✅',
    search: '🔍',
    action: '🎯',
    cleanup: '🧹',
  };

  const emoji = emojis[level] || '📝';
  cy.log(`${emoji} ${message}`);
}

/**
 * Retry an operation with exponential backoff
 * @param {Function} operation - Operation to retry
 * @param {Object} options - Retry options
 * @param {number} [options.maxRetries=3] - Maximum number of retries
 * @param {number} [options.baseDelay=500] - Base delay in milliseconds
 * @returns {Cypress.Chainable} Promise resolving to operation result
 */
export function retryOperation(operation, options = {}) {
  const { maxRetries = 3, baseDelay = 500 } = options;

  function attempt(retryCount = 0) {
    return operation().catch((error) => {
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount);
        logMessage(
          'info',
          `Retry ${retryCount + 1}/${maxRetries} after ${delay}ms: ${error.message}`
        );
        return cy.wait(delay).then(() => attempt(retryCount + 1));
      }
      throw error;
    });
  }

  return attempt();
}

/**
 * Format console arguments for logging
 * @param {...any} args - Console arguments
 * @returns {string} Formatted message
 */
export function formatConsoleArgs(...args) {
  return args
    .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
    .join(' ');
}

/**
 * Safe element interaction with existence check
 * @param {string} selector - Element selector
 * @param {string} action - Action to perform (click, type, etc.)
 * @param {*} value - Value for the action (if applicable)
 * @param {Object} options - Options
 * @returns {Cypress.Chainable} Promise
 */
export function safeElementInteraction(selector, action, value = null, options = {}) {
  const { timeout = TIMEOUTS.ELEMENT_VISIBLE, required = true } = options;

  return cy.get('body').then(($body) => {
    const elements = $body.find(selector);

    if (elements.length === 0) {
      if (required) {
        throw new Error(`Required element not found: ${selector}`);
      }
      logMessage('warn', `Optional element not found: ${selector}`);
      return cy.wrap(null);
    }

    switch (action) {
      case 'click':
        return cy.get(selector, { timeout }).should('be.visible').click();
      case 'type':
        return cy.get(selector, { timeout }).should('be.visible').clear().type(value);
      case 'select':
        return cy.get(selector, { timeout }).should('be.visible').select(value);
      default:
        return cy.get(selector, { timeout }).should('be.visible');
    }
  });
}
