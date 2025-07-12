/**
 * @file Authentication Helper - Simplified NiFi Session Management
 * Provides reliable login functionality for Playwright tests
 * @version 1.0.0
 */

import { test, expect } from '@playwright/test';
import { PAGE_TYPES, DEFAULT_CREDENTIALS, SERVICE_URLS, SELECTORS } from './constants';
import { authLogger as logMessage } from './shared-logger';
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
 * Check if NiFi service is accessible
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} [timeout=5000] - Timeout for the check in milliseconds
 * @returns {Promise<boolean>} Promise resolving to accessibility status
 */
export async function checkNiFiAccessibility(page, timeout = 5000) {
  logMessage('info', 'Checking NiFi accessibility...');

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
}

/**
 * Check if Keycloak service is accessible
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} [timeout=5000] - Timeout for the check in milliseconds
 * @returns {Promise<boolean>} Promise resolving to accessibility status
 */
export async function checkKeycloakAccessibility(page, timeout = 5000) {
  logMessage('info', 'Checking Keycloak accessibility...');

  const response = await page.request.get(SERVICE_URLS.KEYCLOAK_HEALTH, {
    timeout: timeout,
    failOnStatusCode: false
  });

  const isAccessible = response && response.status() >= 200 && response.status() < 400;

  if (isAccessible) {
    logMessage('success', 'Keycloak service is accessible');
  } else {
    logMessage('error', `Keycloak service not accessible - Status: ${response ? response.status() : 'unknown'}`);
  }

  return isAccessible;
}

/**
 * Login to NiFi with the provided credentials
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} [credentials] - Login credentials
 * @param {string} [credentials.username] - Username (defaults to DEFAULT_CREDENTIALS.USERNAME)
 * @param {string} [credentials.password] - Password (defaults to DEFAULT_CREDENTIALS.PASSWORD)
 * @returns {Promise<boolean>} Promise resolving to login success status
 */
export async function loginNiFi(page, credentials = {}) {
  const username = credentials.username || DEFAULT_CREDENTIALS.USERNAME;
  const password = credentials.password || DEFAULT_CREDENTIALS.PASSWORD;

  logMessage('info', `🔑 Performing login for user: ${username}`);

  // Navigate to the login page
  await page.goto(SERVICE_URLS.NIFI_LOGIN);

  // Wait for the login form to be visible
  await page.waitForSelector(SELECTORS.USERNAME_INPUT, { timeout: 10000 });

  // Fill in the login form
  await page.fill(SELECTORS.USERNAME_INPUT, username);
  await page.fill(SELECTORS.PASSWORD_INPUT, password);

  // Click the login button
  await page.click(SELECTORS.LOGIN_BUTTON);

  // Wait for navigation to complete
  await page.waitForTimeout(2000); // Give time for navigation

  // Check if login was successful by looking for canvas elements
  const canvasElement = await page.$(SELECTORS.CANVAS_ELEMENTS);
  const loginSuccess = !!canvasElement;

  if (loginSuccess) {
    logMessage('success', `Successfully logged in as ${username}`);
  } else {
    logMessage('error', `Failed to log in as ${username}`);
  }

  return loginSuccess;
}

/**
 * Navigate to a specific page in NiFi
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} pageType - Page type from PAGE_TYPES
 * @returns {Promise<boolean>} Promise resolving to navigation success status
 */
export async function navigateToPage(page, pageType) {
  const pageDefinition = PAGE_TYPES[pageType];

  if (!pageDefinition) {
    logMessage('error', `Unknown page type: ${pageType}`);
    return false;
  }

  logMessage('info', `Navigating to ${pageDefinition.description}`);

  // Navigate to the page
  await page.goto(pageDefinition.path);

  // Wait for navigation to complete
  await page.waitForTimeout(2000); // Give time for navigation

  // Check if navigation was successful by looking for page elements
  const pageElements = pageDefinition.elements;
  let navigationSuccess = false;

  if (pageElements && pageElements.length > 0) {
    for (const selector of pageElements) {
      const element = await page.$(selector);
      if (element) {
        navigationSuccess = true;
        break;
      }
    }
  }

  if (navigationSuccess) {
    logMessage('success', `Successfully navigated to ${pageDefinition.description}`);
  } else {
    logMessage('error', `Failed to navigate to ${pageDefinition.description}`);
  }

  return navigationSuccess;
}
