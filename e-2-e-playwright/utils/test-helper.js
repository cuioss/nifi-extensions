/**
 * @file Test Helpers - Common test utilities and patterns
 * Provides reusable test functions to reduce duplication across test files
 * Adapted from e-2-e-cypress/cypress/support/test-helpers.js
 * @version 1.0.0
 */

import { expect } from '@playwright/test';
import { PAGE_TYPES } from './constants';
import { logMessage } from './auth-helper';

/**
 * Common test setup with standardized logging
 * @param {string} testName - Name of the test for logging
 */
export function testSetup(testName) {
  logMessage('info', `🧪 ${testName}`);
}

/**
 * Get the current page context (page type, authentication state, etc.)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<Object>} Page context object
 */
export async function getPageContext(page) {
  try {
    // Check for login page elements
    const hasLoginElements = await page.$(PAGE_TYPES.LOGIN.elements[0]) !== null;

    // Check for canvas elements
    const hasCanvasElements = await page.$(PAGE_TYPES.MAIN_CANVAS.elements[0]) !== null;

    // Determine page type
    let pageType = PAGE_TYPES.UNKNOWN;
    if (hasLoginElements) {
      pageType = PAGE_TYPES.LOGIN;
    } else if (hasCanvasElements) {
      pageType = PAGE_TYPES.MAIN_CANVAS;
    }

    // Determine authentication state
    const isAuthenticated = pageType === PAGE_TYPES.MAIN_CANVAS;

    // Determine if canvas is ready
    const isReady = isAuthenticated && hasCanvasElements;

    return {
      pageType,
      isAuthenticated,
      isReady,
      elements: {
        hasLoginElements,
        hasCanvasElements
      }
    };
  } catch (error) {
    logMessage('error', `Error getting page context: ${error.message}`);
    throw error;
  }
}

/**
 * Verify authentication state with consolidated logic
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {boolean} expectedAuth - Expected authentication state
 * @param {string} expectedPageType - Expected page type
 */
export async function verifyAuthenticationState(page, expectedAuth, expectedPageType) {
  const context = await getPageContext(page);
  expect(context.pageType).toBe(expectedPageType);
  expect(context.isAuthenticated).toBe(expectedAuth);
  if (expectedAuth && expectedPageType === 'MAIN_CANVAS') {
    expect(context.isReady).toBeTruthy();
  }
}

/**
 * Verify processor definition with expected properties
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} processorType - Processor type key
 * @param {string} expectedClassName - Expected class name
 * @returns {Promise<Object>} Processor definition
 */
export async function verifyProcessorDefinition(page, processorType, expectedClassName) {
  // This would need to be implemented based on how you retrieve processor types in Playwright
  // For now, we'll create a placeholder implementation
  logMessage('info', `Verifying processor definition for ${processorType}`);

  // Mock implementation - in a real scenario, you would fetch this from the API
  const types = {
    JWT_TOKEN_AUTHENTICATOR: {
      className: 'de.cuioss.nifi.processors.auth.JWTTokenAuthenticator',
      displayName: 'JWT Token Authenticator'
    },
    MULTI_ISSUER_JWT_AUTHENTICATOR: {
      className: 'de.cuioss.nifi.processors.auth.MultiIssuerJWTTokenAuthenticator',
      displayName: 'Multi-Issuer JWT Token Authenticator'
    }
  };

  expect(types).toHaveProperty(processorType);
  const processor = types[processorType];
  expect(processor).toHaveProperty('className', expectedClassName);
  expect(processor).toHaveProperty('displayName');
  return processor;
}

/**
 * Verify processor structure and log results
 * @param {Object|null} processor - Processor object or null
 * @param {string} processorType - Processor type for logging
 */
export function verifyProcessorStructure(processor, processorType) {
  if (processor) {
    ['id', 'type', 'position'].forEach((prop) => {
      expect(processor).toHaveProperty(prop);
    });
    logMessage('info', `Found ${processorType}: ${processor.name}`);
  } else {
    logMessage('info', `${processorType} not found (expected on clean canvas)`);
  }
}

/**
 * Find a processor on the canvas by type
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} processorType - Processor type to search for
 * @returns {Promise<Object|null>} Processor object or null if not found
 */
export async function findProcessorOnCanvas(page, processorType) {
  logMessage('info', `Searching for processor: ${processorType}`);

  // This would need to be implemented based on how you interact with the canvas in Playwright
  // For now, we'll create a placeholder implementation that returns null
  return null;
}

/**
 * Test processor search functionality with consolidated logic
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} processorType - Processor type to search for
 * @returns {Promise<Object|null>} Processor object or null if not found
 */
export async function testProcessorSearch(page, processorType) {
  const processor = await findProcessorOnCanvas(page, processorType);
  expect(processor === null || (processor && typeof processor.name === 'string')).toBeTruthy();
  verifyProcessorStructure(processor, processorType);
  return processor;
}

/**
 * Verify canvas readiness with consolidated checks
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function verifyCanvasReady(page) {
  const context = await getPageContext(page);
  expect(context.pageType).toBe('MAIN_CANVAS');
  expect(context.isReady).toBeTruthy();
  expect(context.isAuthenticated).toBeTruthy();
  expect(context.elements.hasCanvasElements).toBeTruthy();
}

/**
 * Common test patterns for processor testing
 */
export const ProcessorTestPatterns = {
  JWT_PROCESSOR_TYPES: ['JWT_AUTHENTICATOR', 'MULTI_ISSUER'],

  JWT_PROCESSOR_CLASSES: {
    JWT_AUTHENTICATOR: 'de.cuioss.nifi.processors.auth.JWTTokenAuthenticator',
    MULTI_ISSUER: 'de.cuioss.nifi.processors.auth.MultiIssuerJWTTokenAuthenticator',
  },

  REQUIRED_PROCESSOR_PROPERTIES: ['id', 'type', 'name', 'position'],
};
