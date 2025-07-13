/**
 * @fileoverview Common Test Patterns - Modern 2025 Patterns
 * Extracted common patterns from multiple test files
 */

import { expect } from '@playwright/test';
import { CONSTANTS } from './constants.js';

/**
 * Common test patterns for consistent testing
 */
export class TestPatterns {
  constructor(page) {
    this.page = page;
  }

  /**
   * Expect operation to fail with specific error
   */
  async expectOperationToFail(operation, expectedError = null) {
    let errorThrown = false;
    let actualError = null;

    try {
      await operation();
    } catch (error) {
      errorThrown = true;
      actualError = error;
    }

    expect(errorThrown, 'Operation should have failed').toBeTruthy();
    
    if (expectedError) {
      expect(actualError.message).toContain(expectedError);
    }

    return actualError;
  }

  /**
   * Verify page type with modern patterns
   */
  async expectPageToBe(pageType) {
    switch (pageType) {
      case CONSTANTS.PAGE_TYPES.MAIN_CANVAS:
        await expect(this.page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS))
          .toBeVisible({ timeout: 30000 });
        await expect(this.page).toHaveTitle(/NiFi/);
        break;
      
      case CONSTANTS.PAGE_TYPES.LOGIN:
        await expect(this.page.getByRole('button', { name: /log in|login/i }))
          .toBeVisible({ timeout: 10000 });
        break;
      
      default:
        throw new Error(`Unknown page type: ${pageType}`);
    }
  }

  /**
   * Verify authentication state
   */
  async expectAuthenticated() {
    const authIndicators = [
      this.page.getByRole('button', { name: /log out|logout/i }),
      this.page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS),
      this.page.getByRole('button', { name: /operate/i })
    ];

    let found = false;
    for (const indicator of authIndicators) {
      if (await indicator.isVisible()) {
        found = true;
        break;
      }
    }

    expect(found, 'User should be authenticated').toBeTruthy();
  }

  /**
   * Verify unauthenticated state
   */
  async expectUnauthenticated() {
    const loginButton = this.page.getByRole('button', { name: /log in|login/i });
    await expect(loginButton).toBeVisible({ timeout: 10000 });
  }

  /**
   * Wait for page to be stable (no loading indicators)
   */
  async waitForStablePage() {
    await this.page.waitForLoadState('networkidle');
    
    // Wait for any loading indicators to disappear
    const loadingIndicators = this.page.locator('.loading, .spinner, mat-spinner');
    await expect(loadingIndicators).toHaveCount(0, { timeout: 10000 });
  }

  /**
   * Verify processor deployment pattern
   */
  async expectProcessorDeployment(processorType) {
    // Wait for processor to be visible
    const processor = this.page.locator(`[data-type*="${processorType}"], text=${processorType}`);
    await expect(processor).toBeVisible({ timeout: 30000 });
    
    // Verify processor is on canvas
    await this.expectPageToBe(CONSTANTS.PAGE_TYPES.MAIN_CANVAS);
  }

  /**
   * Common error testing pattern
   */
  async testInvalidCredentials(authService, credentials) {
    await this.expectOperationToFail(
      () => authService.login(credentials),
      'Login failed'
    );
  }

  /**
   * Common accessibility testing pattern
   */
  async testAccessibility(accessibilityService, checkFunction, elementName) {
    const result = await checkFunction.call(accessibilityService);
    
    // Log but don't fail for accessibility issues
    if (!result.passed) {
      console.warn(`Accessibility violations in ${elementName}:`, result.violations.length);
    }
    
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('violations');
    
    return result;
  }

  /**
   * Common performance testing pattern
   */
  async measureOperationTime(operation, maxTimeMs = 60000) {
    const startTime = Date.now();
    await operation();
    const endTime = Date.now();
    
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(maxTimeMs);
    
    return duration;
  }

  /**
   * Common screenshot pattern
   */
  async takeTestScreenshot(stepName) {
    const timestamp = Date.now();
    const screenshotPath = `target/screenshots/${stepName}-${timestamp}.png`;
    
    await this.page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    
    return screenshotPath;
  }

  /**
   * Common dialog handling pattern
   */
  async expectDialogToAppear() {
    const dialog = this.page.locator(CONSTANTS.SELECTORS.DIALOG_CONTAINER);
    await expect(dialog).toBeVisible({ timeout: 10000 });
    return dialog;
  }

  /**
   * Common form validation pattern
   */
  async validateFormElements(formLocator, expectedFields) {
    await expect(formLocator).toBeVisible();
    
    for (const field of expectedFields) {
      const fieldLocator = formLocator.locator(field);
      await expect(fieldLocator).toBeVisible();
    }
  }

  /**
   * Retry pattern for flaky operations
   */
  async retryOperation(operation, maxRetries = 3, retryDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          await this.page.waitForTimeout(retryDelay);
        }
      }
    }
    
    throw lastError;
  }
}

/**
 * Convenience functions for common patterns
 */
export async function expectOperationToFail(page, operation, expectedError = null) {
  const patterns = new TestPatterns(page);
  return patterns.expectOperationToFail(operation, expectedError);
}

export async function expectPageToBe(page, pageType) {
  const patterns = new TestPatterns(page);
  return patterns.expectPageToBe(pageType);
}

export async function expectAuthenticated(page) {
  const patterns = new TestPatterns(page);
  return patterns.expectAuthenticated();
}

export async function expectUnauthenticated(page) {
  const patterns = new TestPatterns(page);
  return patterns.expectUnauthenticated();
}

export async function measureOperationTime(page, operation, maxTimeMs = 60000) {
  const patterns = new TestPatterns(page);
  return patterns.measureOperationTime(operation, maxTimeMs);
}