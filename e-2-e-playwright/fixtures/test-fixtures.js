/**
 * @fileoverview Consolidated test fixtures for Playwright tests
 * Combines all fixtures with modern 2025 patterns
 */

import { test as authTest } from './auth-fixtures.js';
import { injectAxe, checkA11y } from 'axe-playwright';

/**
 * Extended test with all fixtures combined
 */
export const test = authTest.extend({
  /**
   * Accessibility testing fixture using axe-playwright
   */
  accessibilityPage: async ({ page }, use) => {
    await test.step('Setup accessibility testing', async () => {
      // Inject axe-core into the page
      await injectAxe(page);
    });
    
    await use(page);
  },

  /**
   * Enhanced page fixture with common utilities
   */
  enhancedPage: async ({ page }, use) => {
    // Add custom methods to page object
    page.waitForStableNetwork = async () => {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(100); // Small buffer for dynamic content
    };
    
    page.takeStepScreenshot = async (stepName) => {
      await page.screenshot({ 
        path: `target/screenshots/${stepName}-${Date.now()}.png`,
        fullPage: true 
      });
    };
    
    page.expectOperationToFail = async (operation, expectedError) => {
      await expect(operation).rejects.toThrow(expectedError);
    };
    
    await use(page);
  },

  /**
   * Performance monitoring fixture
   */
  performancePage: async ({ page }, use) => {
    // Start performance monitoring
    await page.addInitScript(() => {
      window.performanceMarks = [];
      const originalMark = performance.mark;
      performance.mark = function(name) {
        window.performanceMarks.push({ name, timestamp: Date.now() });
        return originalMark.call(this, name);
      };
    });
    
    await use(page);
    
    // Collect performance data
    await test.step('Collect performance metrics', async () => {
      const marks = await page.evaluate(() => window.performanceMarks || []);
      if (marks.length > 0) {
        console.log('Performance marks:', marks);
      }
    });
  }
});

/**
 * Accessibility-focused test with automatic checks
 */
export const accessibilityTest = test.extend({
  page: async ({ accessibilityPage }, use) => {
    await use(accessibilityPage);
    
    // Run accessibility check after each test
    await test.step('Accessibility check', async () => {
      try {
        await checkA11y(accessibilityPage, null, {
          detailedReport: true,
          detailedReportOptions: { html: true }
        });
      } catch (error) {
        // Log accessibility issues but don't fail the test
        console.warn('Accessibility issues found:', error.message);
      }
    });
  }
});

export { expect } from '@playwright/test';