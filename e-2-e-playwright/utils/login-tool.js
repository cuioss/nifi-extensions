/**
 * @file Login Tool - NiFi Authentication Management
 * Provides reliable login/logout functionality with assertions
 * @version 1.0.0
 */

import { expect } from '@playwright/test';
import { PAGE_TYPES, DEFAULT_CREDENTIALS, SERVICE_URLS, SELECTORS } from './constants';
import { getPageContext } from './test-helper';
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
 * Logger function for consistent logging
 * @param {string} level - Log level (info, success, warn, error)
 * @param {string} message - Message to log
 */
export function logMessage(level, message) {
  const prefix = {
    info: '🔵 INFO:',
    success: '✅ SUCCESS:',
    warn: '🟠 WARNING:',
    error: '🔴 ERROR:',
  }[level] || '🔵 INFO:';

  console.log(`${prefix} ${message}`);
}

/**
 * Check if NiFi service is accessible
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} [timeout=5000] - Timeout for the check in milliseconds
 * @returns {Promise<boolean>} Promise resolving to accessibility status
 */
export async function checkNiFiAccessibility(page, timeout = 5000) {
  logMessage('info', 'Checking NiFi accessibility...');

  try {
    const response = await page.request.get(SERVICE_URLS.NIFI_SYSTEM_DIAGNOSTICS, {
      timeout: timeout,
      failOnStatusCode: false
    });

    // Consider 401 Unauthorized as a valid indication that NiFi is accessible
    // This is because the endpoint requires authentication, which is expected
    const isAccessible = response &&
      ((response.status() >= 200 && response.status() < 400) || response.status() === 401);

    if (isAccessible) {
      logMessage('success', 'NiFi service is accessible');
    } else {
      logMessage('error', `NiFi service not accessible - Status: ${response ? response.status() : 'unknown'}`);
    }

    return isAccessible;
  } catch (error) {
    logMessage('error', `NiFi service not accessible - Network Error: ${error.message || 'Connection failed'}`);
    return false;
  }
}

/**
 * Login to NiFi with the provided credentials
 * This function includes assertions that will fail the test if login fails
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} [credentials] - Login credentials
 * @param {string} [credentials.username] - Username (defaults to DEFAULT_CREDENTIALS.USERNAME)
 * @param {string} [credentials.password] - Password (defaults to DEFAULT_CREDENTIALS.PASSWORD)
 */
export async function login(page, credentials = {}) {
  const username = credentials.username || DEFAULT_CREDENTIALS.USERNAME;
  const password = credentials.password || DEFAULT_CREDENTIALS.PASSWORD;

  logMessage('info', `🔑 Performing login for user: ${username}`);

  try {
    // Navigate to the login page
    await page.goto(SERVICE_URLS.NIFI_LOGIN);

    // Wait for the login form to be visible
    await page.waitForSelector(SELECTORS.USERNAME_INPUT, { timeout: 10000 });

    // Fill in the login form
    await page.fill(SELECTORS.USERNAME_INPUT, username);
    await page.fill(SELECTORS.PASSWORD_INPUT, password);

    // Take a screenshot before clicking login (for debugging)
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'before-login.png') });

    // Click the login button
    await page.click(SELECTORS.LOGIN_BUTTON);

    // Wait for navigation to complete
    await page.waitForNavigation({ timeout: 10000 });

    // Check if login was successful by looking for canvas elements
    const canvasElement = await page.$(SELECTORS.CANVAS_ELEMENTS);

    // Assert that login was successful
    expect(canvasElement, 'Login failed - Canvas elements not found').toBeTruthy();

    // Verify we're on the main canvas
    const context = await getPageContext(page);
    expect(context.pageType, 'Login failed - Not on main canvas').toBe(PAGE_TYPES.MAIN_CANVAS);
    expect(context.isAuthenticated, 'Login failed - Not authenticated').toBeTruthy();

    logMessage('success', `Successfully logged in as ${username}`);
    return true;
  } catch (error) {
    logMessage('error', `Login error: ${error.message}`);
    throw error;
  }
}

/**
 * Logout from NiFi
 * This function includes assertions that will fail the test if logout fails
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').BrowserContext} context - Playwright browser context
 */
export async function logout(page, context) {
  logMessage('info', 'Performing logout...');

  try {
    // Clear cookies and storage to simulate logout
    await context.clearCookies();
    await page.evaluate(() => window.localStorage.clear());
    await page.evaluate(() => window.sessionStorage.clear());

    // Navigate to login page
    await page.goto(SERVICE_URLS.NIFI_LOGIN);

    // Verify we're on the login page
    const pageContext = await getPageContext(page);
    expect(pageContext.pageType, 'Logout failed - Not on login page').toBe(PAGE_TYPES.LOGIN);
    expect(pageContext.isAuthenticated, 'Logout failed - Still authenticated').toBeFalsy();

    // Verify login form is visible
    const usernameInput = await page.$(SELECTORS.USERNAME_INPUT);
    expect(usernameInput, 'Logout failed - Login form not visible').toBeTruthy();

    logMessage('success', 'Successfully logged out');
  } catch (error) {
    logMessage('error', `Logout error: ${error.message}`);
    throw error;
  }
}

/**
 * Ensure NiFi is ready for testing
 * This function includes assertions that will fail the test if NiFi is not ready
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function ensureNiFiReady(page) {
  logMessage('info', 'Ensuring NiFi is ready for testing...');

  try {
    // Check if NiFi is accessible
    const isAccessible = await checkNiFiAccessibility(page);

    // Assert that NiFi is accessible
    expect(isAccessible, 'NiFi is not accessible').toBeTruthy();

    // Check current URL to determine if we need to login
    const url = page.url();

    if (url.includes('#/login') || url === 'about:blank' || !url.includes('/nifi')) {
      // Need to login
      logMessage('info', 'Authentication required - performing login');
      await login(page);
    } else {
      // Already on a NiFi page, verify we can access the canvas
      const canvasElement = await page.$(SELECTORS.CANVAS_ELEMENTS);

      if (!canvasElement) {
        // No canvas elements found, try to login
        logMessage('info', 'No canvas elements found - performing login');
        await login(page);
      } else {
        logMessage('success', 'Canvas elements found - ready for testing');
      }
    }

    // Final verification that we're on the main canvas and ready
    const context = await getPageContext(page);
    expect(context.pageType, 'NiFi not ready - Not on main canvas').toBe(PAGE_TYPES.MAIN_CANVAS);
    expect(context.isAuthenticated, 'NiFi not ready - Not authenticated').toBeTruthy();
    expect(context.isReady, 'NiFi not ready - Canvas not ready').toBeTruthy();

    logMessage('success', 'NiFi is ready for testing');
  } catch (error) {
    logMessage('error', `Error ensuring NiFi is ready: ${error.message}`);
    throw error;
  }
}
