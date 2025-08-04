/**
 * @file Simplified Processor Utilities
 * Consolidated processor operations using Playwright built-ins
 * @version 4.0.0 - Cleaned up unused methods
 */

import {expect} from '@playwright/test';
import {CONSTANTS} from './constants.js';
import { processorLogger } from './shared-logger.js';

/**
 * Find processor on canvas using modern Playwright patterns
 */
export async function findProcessor(page, processorType, options = {}) {
  const { failIfNotFound = true } = options;

  // Note: Processors should already exist on canvas - no longer adding them automatically

  // Use more specific selectors for processors on canvas
  const selectors = [
    // NiFi-specific processor selectors
    `g.processor[data-type*="${processorType}"]`,
    `rect.processor[data-type*="${processorType}"]`,
    `[data-component-type="processor"][data-type*="${processorType}"]`,
    `g.component[data-type*="${processorType}"]`,

    // Text-based selectors - using more specific selectors to avoid matching multiple elements
    `text.processor-name:has-text("${processorType}")`,
    `text.processor-type:has-text("${processorType}")`,
    `[title*="${processorType}"]`,
    `[alt*="${processorType}"]`,

    // General processor selectors on canvas
    `g.processor, rect.processor`,
    `[data-component-type="processor"]`,
    `g.component`,

    // If looking for any processor, use very general selectors
    ...(processorType === "processor" || processorType.includes("Processor") ? [
      `svg g.processor`,
      `svg rect.processor`,
      `g[transform]`,
      `.processor-component`,
      `[class*="processor"]`
    ] : [])
  ];

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ timeout: 2000 });

      if (await locator.isVisible()) {
        return {
          element: selector,
          locator,
          type: processorType,
          isVisible: true
        };
      }
    } catch {
      // Continue to next selector
    }
  }

  if (failIfNotFound) {
    throw new Error(`Processor not found: ${processorType}`);
  }

  return null;
}

/**
 * Find JWT Token Authenticator specifically
 */
export async function findJwtAuthenticator(page, options = {}) {
  const jwtTypes = [
    'MultiIssuerJWTTokenAuthenticator',
    'JWTTokenAuthenticator',
    'JWT'
  ];

  for (const type of jwtTypes) {
    const processor = await findProcessor(page, type, { failIfNotFound: false });
    if (processor) {
      return processor;
    }
  }

  if (options.failIfNotFound !== false) {
    throw new Error('JWT Authenticator not found on canvas (should already be present)');
  }

  return null;
}

/**
 * Interact with processor using modern patterns with force option to handle button interception
 */
export async function interactWithProcessor(page, processor, options = {}) {
  const { action = 'click', timeout = 10000, takeScreenshot = false, testInfo = null } = options;

  const locator = processor.locator || page.locator(processor.element);

  try {
    switch (action) {
      case 'click':
        // First try normal click, then force if intercepted
        try {
          await locator.click({ timeout: timeout / 2 });
        } catch (error) {
          if (error.message.includes('intercepts pointer events')) {
            // Use force click to bypass intercepting elements
            await locator.click({ force: true, timeout: timeout / 2 });
          } else {
            throw error;
          }
        }
        break;
      case 'doubleclick':
        try {
          await locator.dblclick({ timeout: timeout / 2 });
        } catch (error) {
          if (error.message.includes('intercepts pointer events')) {
            await locator.dblclick({ force: true, timeout: timeout / 2 });
          } else {
            throw error;
          }
        }
        break;
      case 'rightclick':
        try {
          await locator.click({ button: 'right', timeout: timeout / 2 });
        } catch (error) {
          if (error.message.includes('intercepts pointer events')) {
            await locator.click({ button: 'right', force: true, timeout: timeout / 2 });
          } else {
            throw error;
          }
        }
        break;
      case 'hover':
        try {
          await locator.hover({ timeout: timeout / 2 });
        } catch (error) {
          if (error.message.includes('intercepts pointer events')) {
            await locator.hover({ force: true, timeout: timeout / 2 });
          } else {
            throw error;
          }
        }
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Take screenshot if requested
    if (takeScreenshot) {
      const screenshotPath = testInfo && testInfo.outputDir
        ? `${testInfo.outputDir}/processor-interaction-${Date.now()}.png`
        : `target/processor-interaction-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });
    }

    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch (error) {
    console.error(`Processor interaction failed (${action}):`, error.message);

    // Take screenshot on failure for debugging
    if (takeScreenshot) {
      const screenshotPath = testInfo && testInfo.outputDir
        ? `${testInfo.outputDir}/processor-interaction-failed-${Date.now()}.png`
        : `target/processor-interaction-failed-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });
    }

    throw error;
  }
}

/**
 * Configure processor using modern patterns with better error handling
 */
export async function configureProcessor(page, processorIdentifier, options = {}) {
  const { timeout = 10000, testInfo = null } = options;

  let processor = processorIdentifier;

  // If processorIdentifier is a string, find the processor first
  if (typeof processorIdentifier === 'string') {
    processor = await findProcessor(page, processorIdentifier);
    if (!processor) {
      throw new Error(`Cannot configure processor: ${processorIdentifier} not found`);
    }
  }

  if (!processor || !processor.element) {
    throw new Error('Cannot configure processor: invalid processor object or missing element');
  }

  try {
    // Right-click to open context menu with force option
    await interactWithProcessor(page, processor, { action: 'rightclick', timeout, testInfo });

    // Wait for context menu and find configure option
    const configureSelectors = [
      'menuitem:has-text("Configure")',
      'button:has-text("Configure")',
      '[role="menuitem"]:has-text("Configure")',
      '.menu-item:has-text("Configure")',
      'li:has-text("Configure")',
      'a:has-text("Configure")'
    ];

    let configureOption = null;
    for (const selector of configureSelectors) {
      try {
        configureOption = page.locator(selector).first();
        await configureOption.waitFor({ timeout: 2000 });
        if (await configureOption.isVisible()) {
          break;
        }
      } catch {
        // Try next selector
      }
    }

    if (!configureOption || !(await configureOption.isVisible())) {
      throw new Error('Configure option not found in context menu');
    }

    await configureOption.click({ force: true });

    // Wait for dialog using NiFi-compatible selectors
    const dialogSelectors = [
      '[role="dialog"]',
      '.dialog',
      '.configuration-dialog',
      '.processor-configuration',
      '.configure-dialog',
      '.mat-dialog-container'
    ];

    let dialog = null;
    for (const selector of dialogSelectors) {
      try {
        dialog = page.locator(selector);
        await dialog.waitFor({ timeout: 3000 });
        if (await dialog.isVisible()) {
          break;
        }
      } catch {
        // Try next selector
      }
    }

    if (!dialog || !(await dialog.isVisible())) {
      throw new Error('Configuration dialog did not open');
    }

    return dialog;
  } catch (error) {
    console.error('Configure processor failed:', error.message);
    throw error;
  }
}

/**
 * Verify processor deployment
 */
export async function verifyProcessorDeployment(page, processorType) {
  const processor = await findProcessor(page, processorType);

  // Modern assertions
  expect(processor, `Processor ${processorType} should be found`).toBeTruthy();
  expect(processor.isVisible, `Processor ${processorType} should be visible`).toBeTruthy();

  // Verify processor is on canvas - use the locator directly instead of recreating it
  // This avoids strict mode violations when the selector matches multiple elements
  if (processor.locator) {
    await expect(processor.locator).toBeVisible({ timeout: 5000 });
  } else {
    // If locator is not available, use the first matching element to avoid strict mode violations
    await expect(page.locator(processor.element).first()).toBeVisible({ timeout: 5000 });
  }

  return processor;
}

/**
 * Simplified ProcessorService class with only used methods
 */
export class ProcessorService {
  constructor(page, testInfo = null) {
    this.page = page;
    this.testInfo = testInfo;
  }

  async find(processorType, options = {}) {
    return findProcessor(this.page, processorType, options);
  }

  async findJwtAuthenticator(options = {}) {
    return findJwtAuthenticator(this.page, options);
  }

  async findMultiIssuerJwtAuthenticator(options = {}) {
    return findProcessor(this.page, 'MultiIssuerJWTTokenAuthenticator', options);
  }

  async interact(processor, options = {}) {
    return interactWithProcessor(this.page, processor, { ...options, testInfo: this.testInfo });
  }

  async configure(processor, options = {}) {
    return configureProcessor(this.page, processor, { ...options, testInfo: this.testInfo });
  }

  async openAdvancedUI(processor) {
    processorLogger.debug("Opening Advanced UI via right-click menu");
    
    // Right-click on processor
    await this.interact(processor, { action: "rightclick" });
    
    // Look for Advanced menu item
    const advancedMenuItem = this.page.getByRole("menuitem", { name: /advanced/i });
    
    if (await advancedMenuItem.isVisible({ timeout: 2000 })) {
      await advancedMenuItem.click();
      processorLogger.debug("Clicked Advanced menu item");
      
      // Wait for navigation
      await this.page.waitForLoadState("networkidle");
      await this.page.waitForTimeout(2000);
      
      // Verify we're on the advanced page
      const url = this.page.url();
      if (url.includes("/advanced")) {
        processorLogger.debug("Successfully navigated to Advanced UI");
        return true;
      }
    }
    
    processorLogger.error("Could not find Advanced menu item");
    return false;
  }

  async getAdvancedUIFrame() {
    // Find the custom UI frame
    const frames = this.page.frames();
    
    // Debug log all frames
    processorLogger.info(`Found ${frames.length} frames on page`);
    frames.forEach((frame, index) => {
      processorLogger.info(`Frame ${index}: ${frame.url()}`);
    });
    
    // Try multiple patterns to find the custom UI frame
    // IMPORTANT: The custom UI is served from nifi-cuioss-ui-1.0-SNAPSHOT
    let customUIFrame = frames.find(f => 
      f.url().includes("nifi-cuioss-ui")
    );
    
    // If not found, try the second frame (first is usually the main page)
    if (!customUIFrame && frames.length > 1) {
      customUIFrame = frames[1];
      processorLogger.info(`Using second frame as fallback: ${customUIFrame.url()}`);
    }
    
    if (!customUIFrame) {
      processorLogger.error("Could not find custom UI iframe");
      return null;
    }
    
    processorLogger.info(`Found custom UI frame: ${customUIFrame.url()}`);
    return customUIFrame;
  }

  /**
   * Click a tab in the custom UI
   * @param {Frame} customUIFrame - The custom UI iframe
   * @param {string} tabName - Name of the tab to click
   */
  async clickTab(customUIFrame, tabName) {
    const tab = customUIFrame.locator(`[role="tab"]:has-text("${tabName}")`);
    await tab.click();
    await this.page.waitForTimeout(1000);
    processorLogger.info(`Clicked ${tabName} tab`);
  }

  /**
   * Find processor by type (used by one test)
   * @param {string} processorType - Type of processor to find
   * @returns {Promise<Object>} Processor object
   */
  async findProcessorByType(processorType) {
    return findProcessor(this.page, processorType);
  }

  /**
   * Navigate to the Advanced UI and return the iframe context
   * @returns {Promise<Frame>} The custom UI frame
   */
  async navigateToAdvancedUI() {
    // Find the MultiIssuerJWTTokenAuthenticator processor on canvas
    const processor = await this.findProcessorByType(
      "MultiIssuerJWTTokenAuthenticator",
    );

    if (!processor) {
      throw new Error(
        "MultiIssuerJWTTokenAuthenticator processor not found on canvas. Please add it manually.",
      );
    }

    // Open Advanced UI via right-click menu
    const advancedOpened = await this.openAdvancedUI(processor);

    if (!advancedOpened) {
      throw new Error("Failed to open Advanced UI via right-click menu");
    }

    // Wait for custom UI to load
    await this.page.waitForTimeout(2000);

    // Get the custom UI frame
    const customUIFrame = await this.getAdvancedUIFrame();

    if (!customUIFrame) {
      throw new Error("Could not find custom UI iframe");
    }

    processorLogger.info("Successfully accessed custom UI iframe");
    return customUIFrame;
  }
}