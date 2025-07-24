/**
 * @fileoverview Page Objects Index - Modern 2025 Patterns
 * Centralized export for all page objects with fixture integration
 */

import {test as base} from '@playwright/test';
import {LoginPage} from './LoginPage.js';
import {CanvasPage} from './CanvasPage.js';

/**
 * Page Object fixtures for modern testing
 */
export const test = base.extend({
  /**
   * Login page fixture
   */
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  /**
   * Canvas page fixture
   */
  canvasPage: async ({ page }, use) => {
    const canvasPage = new CanvasPage(page);
    await use(canvasPage);
  },

  /**
   * Combined pages fixture for full application testing
   */
  appPages: async ({ page }, use) => {
    const pages = {
      login: new LoginPage(page),
      canvas: new CanvasPage(page)
    };
    await use(pages);
  }
});

// Direct exports for non-fixture usage
export { LoginPage } from './LoginPage.js';
export { CanvasPage } from './CanvasPage.js';
export { expect } from '@playwright/test';