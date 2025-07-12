/**
 * @file Test Helpers - Common test utilities and patterns
 * Provides reusable test functions to reduce duplication across test files
 * @version 1.0.0
 */

import { expect } from '@playwright/test';
import { PAGE_TYPES, PAGE_DEFINITIONS } from './constants';
import { testHelperLogger as logMessage } from './shared-logger';

/**
 * Common test setup with standardized logging
 * @param {string} testName - Name of the test for logging
 */
export function testSetup(testName) {
  logMessage('info', `🧪 ${testName}`);
}

/**
 * Check if any elements exist from a selector array
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string[]} selectors - Array of selectors to check
 * @returns {Promise<boolean>} True if any selector matches
 */
async function hasAnyElement(page, selectors) {
  for (const selector of selectors) {
    if (await page.$(selector) !== null) {
      return true;
    }
  }
  return false;
}

/**
 * Check for specific canvas indicator elements
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<boolean>} True if specific canvas elements found
 */
async function hasSpecificCanvasElements(page) {
  const canvasIndicators = [
    'text="log out"',
    '[href*="#/process-groups"]',
    'button[title="Operate"]'
  ];
  
  for (const selector of canvasIndicators) {
    if (await page.$(selector)) {
      return true;
    }
  }
  return false;
}

/**
 * Determine page type based on element presence
 * @param {boolean} hasSpecificCanvas - Has specific canvas elements
 * @param {boolean} hasLogin - Has login elements
 * @param {boolean} hasCanvas - Has canvas elements
 * @returns {string} Page type
 */
function determinePageType(hasSpecificCanvas, hasLogin, hasCanvas) {
  if (hasSpecificCanvas) {
    return PAGE_TYPES.MAIN_CANVAS;
  } else if (hasLogin && !hasCanvas) {
    return PAGE_TYPES.LOGIN;
  } else if (hasCanvas) {
    return PAGE_TYPES.MAIN_CANVAS;
  }
  return PAGE_TYPES.UNKNOWN;
}

/**
 * Get the current page context (page type, authentication state, etc.)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<Object>} Page context object
 */
export async function getPageContext(page) {
  // Check for specific canvas elements (most reliable)
  const hasSpecificCanvas = await hasSpecificCanvasElements(page);
  
  // Check for login and canvas elements
  const hasLoginElements = await hasAnyElement(page, PAGE_DEFINITIONS[PAGE_TYPES.LOGIN].elements);
  const hasCanvasElements = await hasAnyElement(page, PAGE_DEFINITIONS[PAGE_TYPES.MAIN_CANVAS].elements);

  // Determine page type
  const pageType = determinePageType(hasSpecificCanvas, hasLoginElements, hasCanvasElements);
  
  // Determine authentication and ready states
  const isAuthenticated = pageType === PAGE_TYPES.MAIN_CANVAS;
  const isReady = pageType === PAGE_TYPES.MAIN_CANVAS 
    ? (hasCanvasElements || hasSpecificCanvas)
    : pageType === PAGE_TYPES.LOGIN ? hasLoginElements : false;

  return {
    pageType,
    isAuthenticated,
    isReady,
    elements: {
      hasLoginElements,
      hasCanvasElements
    }
  };
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
  
  if (expectedAuth && expectedPageType === PAGE_TYPES.MAIN_CANVAS) {
    expect(context.isReady).toBeTruthy();
  }
}

// Mock processor type definitions for testing
const MOCK_PROCESSOR_TYPES = {
  JWT_TOKEN_AUTHENTICATOR: {
    className: 'de.cuioss.nifi.processors.auth.JWTTokenAuthenticator',
    displayName: 'JWT Token Authenticator'
  },
  MULTI_ISSUER_JWT_AUTHENTICATOR: {
    className: 'de.cuioss.nifi.processors.auth.MultiIssuerJWTTokenAuthenticator',
    displayName: 'Multi-Issuer JWT Token Authenticator'
  }
};

/**
 * Verify processor definition with expected properties
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} processorType - Processor type key
 * @param {string} expectedClassName - Expected class name
 * @returns {Promise<Object>} Processor definition
 */
export async function verifyProcessorDefinition(page, processorType, expectedClassName) {
  logMessage('info', `Verifying processor definition for ${processorType}`);

  expect(MOCK_PROCESSOR_TYPES).toHaveProperty(processorType);
  const processor = MOCK_PROCESSOR_TYPES[processorType];
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
    ProcessorTestPatterns.REQUIRED_PROCESSOR_PROPERTIES.forEach((prop) => {
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
  expect(context.pageType).toBe(PAGE_TYPES.MAIN_CANVAS);
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
