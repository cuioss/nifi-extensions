/**
 * @fileoverview Modern authentication fixtures for Playwright tests
 * Implements 2025 best practices with fixture-based architecture
 */

import { test as base, expect } from '@playwright/test';
import { CONSTANTS } from '../utils/constants.js';

/**
 * Authentication fixtures providing authenticated and unauthenticated contexts
 */
export const test = base.extend({
  /**
   * Authenticated page fixture - handles login automatically
   */
  authenticatedPage: async ({ page }, use) => {
    await test.step('Setup authenticated session', async () => {
      // Navigate to login page
      await page.goto('/nifi');
      
      // Wait for page to be ready
      await page.waitForLoadState('networkidle');
      
      // Perform login if not already authenticated
      const isLoggedIn = await page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS).isVisible()
        .catch(() => false);
      
      if (!isLoggedIn) {
        // Click login if available
        const loginBtn = page.getByRole('button', { name: /log in|login/i });
        if (await loginBtn.isVisible()) {
          await loginBtn.click();
        }
        
        // Fill credentials
        await page.getByLabel(/username|email/i).fill(CONSTANTS.AUTH.USERNAME);
        await page.getByLabel(/password/i).fill(CONSTANTS.AUTH.PASSWORD);
        
        // Submit login
        await page.getByRole('button', { name: /sign in|login|submit/i }).click();
        
        // Wait for successful login
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible({ timeout: 30000 });
      }
    });
    
    await use(page);
    
    // Cleanup - logout if needed
    await test.step('Cleanup authenticated session', async () => {
      // Logout is handled by global teardown
    });
  },

  /**
   * Unauthenticated page fixture - ensures no authentication
   */
  unauthenticatedPage: async ({ page }, use) => {
    await test.step('Setup unauthenticated session', async () => {
      // Clear any existing auth
      await page.context().clearCookies();
      await page.goto('/nifi');
      await page.waitForLoadState('networkidle');
    });
    
    await use(page);
  },

  /**
   * Admin authenticated page fixture - uses admin credentials
   */
  adminPage: async ({ page }, use) => {
    await test.step('Setup admin authenticated session', async () => {
      await page.goto('/nifi');
      await page.waitForLoadState('networkidle');
      
      const isLoggedIn = await page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS).isVisible()
        .catch(() => false);
      
      if (!isLoggedIn) {
        const loginBtn = page.getByRole('button', { name: /log in|login/i });
        if (await loginBtn.isVisible()) {
          await loginBtn.click();
        }
        
        await page.getByLabel(/username|email/i).fill(CONSTANTS.AUTH.ADMIN_USERNAME || CONSTANTS.AUTH.USERNAME);
        await page.getByLabel(/password/i).fill(CONSTANTS.AUTH.ADMIN_PASSWORD || CONSTANTS.AUTH.PASSWORD);
        
        await page.getByRole('button', { name: /sign in|login|submit/i }).click();
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible({ timeout: 30000 });
      }
    });
    
    await use(page);
  },

  /**
   * Test data fixture - provides clean test data for each test
   */
  testData: async ({}, use) => {
    const data = {
      // Generate unique test data
      processorName: `test-processor-${Date.now()}`,
      groupName: `test-group-${Date.now()}`,
      timestamp: new Date().toISOString(),
      
      // Invalid credentials for negative testing
      invalidCredentials: {
        username: 'invalid-user',
        password: 'invalid-password'
      },
      
      // Test processor configurations
      processorConfig: {
        name: `TestProcessor-${Math.random().toString(36).substring(7)}`,
        type: 'org.apache.nifi.processors.standard.LogAttribute',
        properties: {
          'Log Level': 'info'
        }
      }
    };
    
    await use(data);
    
    // Cleanup test data if needed
    await test.step('Cleanup test data', async () => {
      // Cleanup is handled by individual tests or global teardown
    });
  },

  /**
   * Page verification fixture - provides common page state assertions
   */
  pageVerifier: async ({ page }, use) => {
    const verifier = {
      async expectMainCanvas() {
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible();
        await expect(page).toHaveTitle(/NiFi/);
      },
      
      async expectLoginPage() {
        await expect(page.getByRole('button', { name: /log in|login/i })).toBeVisible();
      },
      
      async expectAuthenticated() {
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible();
        // Check for user menu or logout option
        const userMenu = page.getByRole('button', { name: /user|account|logout/i });
        if (await userMenu.isVisible()) {
          await expect(userMenu).toBeVisible();
        }
      },
      
      async expectPageType(expectedType) {
        // Use modern approach instead of complex page type detection
        switch (expectedType) {
          case 'MAIN_CANVAS':
            await this.expectMainCanvas();
            break;
          case 'LOGIN':
            await this.expectLoginPage();
            break;
          default:
            throw new Error(`Unknown page type: ${expectedType}`);
        }
      }
    };
    
    await use(verifier);
  }
});

export { expect } from '@playwright/test';