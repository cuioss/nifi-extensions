/**
 * @file Navigation Tool - NiFi Page Navigation and Verification
 * Provides reliable navigation and page verification with assertions
 * @version 1.0.0
 */

import { expect } from '@playwright/test';
import { PAGE_TYPES, PAGE_DEFINITIONS, SELECTORS } from './constants';
import { getPageContext } from './test-helper';
import { logMessage } from './login-tool';
import path from 'path';

// Define paths for screenshots (following Maven standard)
const TARGET_DIR = path.join(__dirname, '..', 'target');
const SCREENSHOTS_DIR = path.join(TARGET_DIR, 'screenshots');

// Ensure the screenshots directory exists
const fs = require('fs');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

/**
 * Navigate to a specific page in NiFi
 * This function includes assertions that will fail the test if navigation fails
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} pageType - Page type from PAGE_TYPES
 * @param {Object} [options] - Navigation options
 * @param {number} [options.timeout=10000] - Navigation timeout in milliseconds
 * @param {boolean} [options.waitForReady=true] - Wait for page to be ready
 */
export async function navigateToPage(page, pageType, options = {}) {
  const { timeout = 10000, waitForReady = true } = options;
  const pageDefinition = PAGE_DEFINITIONS[pageType];

  if (!pageDefinition) {
    throw new Error(`Unknown page type: ${pageType}`);
  }

  logMessage('info', `Navigating to ${pageDefinition.description}`);

  // Navigate to the page and wait for load
  await page.goto(pageDefinition.path, { 
    timeout,
    waitUntil: 'domcontentloaded'
  });

  // Verify we're on the expected page
  await verifyPageType(page, pageType, { waitForReady });

  logMessage('success', `Successfully navigated to ${pageDefinition.description}`);
}

/**
 * Verify the current page type
 * This function includes assertions that will fail the test if the page type doesn't match
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} expectedPageType - Expected page type from PAGE_TYPES
 * @param {Object} [options] - Verification options
 * @param {boolean} [options.waitForReady=true] - Wait for page to be ready
 */
export async function verifyPageType(page, expectedPageType, options = {}) {
  const { waitForReady = true } = options;

  logMessage('info', `Verifying page type: ${expectedPageType}`);

  // Special handling for LOGIN page
  if (expectedPageType === PAGE_TYPES.LOGIN) {
    const url = page.url();

    if (url.includes('#/login')) {
      // We're on login page, check if login elements exist
      const usernameInput = await page.$(SELECTORS.USERNAME_INPUT);

      if (!usernameInput) {
        // Wait a bit for elements to appear
        await page.waitForTimeout(2000);
      }

      // Verify login form is visible
      const usernameInputAfterWait = await page.$(SELECTORS.USERNAME_INPUT);
      expect(usernameInputAfterWait, 'Login form not visible').toBeTruthy();
    } else {
      // Already authenticated, redirected away from login page
      logMessage('warn', 'Already authenticated, cannot access login page');
    }
  }

  // Get the current page context
  const context = await getPageContext(page);

  // Verify page type
  expect(context.pageType, `Expected ${expectedPageType}, got ${context.pageType}`).toBe(expectedPageType);

  // Verify page is ready if required
  if (waitForReady) {
    expect(context.isReady, `Page ${expectedPageType} not ready for testing`).toBeTruthy();
  }

  logMessage('success', `Verified page type: ${expectedPageType}`);

  return context;
}

/**
 * Wait for a specific page type to load
 * This function includes assertions that will fail the test if the page doesn't load
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} expectedPageType - Expected page type from PAGE_TYPES
 * @param {Object} [options] - Wait options
 * @param {number} [options.timeout=10000] - Total timeout in milliseconds
 */
export async function waitForPageType(page, expectedPageType, options = {}) {
  const { timeout = 10000 } = options;

  logMessage('info', `Waiting for page type: ${expectedPageType}`);

  // Start time for timeout calculation
  const startTime = Date.now();
  let context;

  // Poll until we get the expected page type or timeout
  while (Date.now() - startTime < timeout) {
    context = await getPageContext(page);

    if (context.pageType === expectedPageType && context.isReady) {
      logMessage('success', `Page type ${expectedPageType} loaded`);
      return context;
    }

    // Wait a bit before checking again
    await page.waitForTimeout(500);
  }

  // If we get here, we timed out
  throw new Error(`Timeout waiting for page type ${expectedPageType}, got ${context ? context.pageType : 'unknown'}`);
}
