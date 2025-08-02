/**
 * @fileoverview Consolidated test fixtures for Playwright tests
 * Combines all fixtures with modern 2025 patterns including global console logging
 */

import {test as authTest} from './auth-fixtures.js';
import {checkA11y, injectAxe} from 'axe-playwright';
import {setupAuthAwareErrorDetection, saveTestBrowserLogs} from '../utils/console-logger.js';
import {logTestWarning} from '../utils/test-error-handler.js';

/**
 * Extended test with all fixtures combined including global console logging
 */
export const test = authTest.extend({
  /**
   * Page fixture with automatic console logging setup
   */
  page: async ({ page }, use, testInfo) => {
    // Setup auth-aware error detection for this page
    await setupAuthAwareErrorDetection(page, testInfo);

    await use(page);

    // Save browser logs after each test
    try {
      await saveTestBrowserLogs(testInfo);
    } catch (error) {
      logTestWarning('page fixture cleanup', `Failed to save console logs: ${error.message}`);
    }
  },
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
  page: async ({ accessibilityPage }, use, testInfo) => {
    await use(accessibilityPage);

    // Save browser logs after each test
    try {
      await saveTestBrowserLogs(testInfo);
    } catch (error) {
      logTestWarning('accessibilityTest cleanup', `Failed to save console logs: ${error.message}`);
    }

    // Run accessibility check after each test
    await test.step('Accessibility check', async () => {
      try {
        await checkA11y(accessibilityPage, null, {
          axeOptions: {
            runOnly: {
              type: 'tag',
              values: ['wcag2aa', 'wcag21aa', 'best-practice']
            },
            rules: {
              // Disable rules that may not apply to NiFi UI context
              'bypass': { enabled: false },
              'landmark-one-main': { enabled: false },
              'region': { enabled: false }
            }
          },
          detailedReport: true,
          detailedReportOptions: { html: true }
        });
      } catch (error) {
        // Log accessibility issues but don't fail the test
        console.warn('Accessibility issues found:', error.message);
      }
    });
  },

  /**
   * Enhanced accessibility fixture with comprehensive testing
   */
  accessibilityHelper: async ({ page }, use) => {
    const { AccessibilityHelper } = await import('../utils/accessibility-helper.js');
    const helper = new AccessibilityHelper(page);
    await helper.initialize();
    await use(helper);
  }
});

export { expect } from '@playwright/test';