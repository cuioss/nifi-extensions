/**
 * @file Simplified Processor Utilities
 * Consolidated processor operations using Playwright built-ins
 * @version 4.0.0 - Cleaned up unused methods
 */

import {expect} from '@playwright/test';
import {CONSTANTS} from './constants.js';
import { testLogger } from './test-logger.js';

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
    testLogger.info('Processor',"Opening Advanced UI via right-click menu");
    
    // Right-click on processor
    await this.interact(processor, { action: "rightclick" });
    
    // Look for Advanced menu item
    const advancedMenuItem = this.page.getByRole("menuitem", { name: /advanced/i });
    
    if (await advancedMenuItem.isVisible({ timeout: 2000 })) {
      await advancedMenuItem.click();
      testLogger.info('Processor',"Clicked Advanced menu item");
      
      // Wait for navigation to advanced page
      try {
        await this.page.waitForURL('**/advanced', { timeout: 10000 });
        testLogger.info('Processor',"Successfully navigated to Advanced UI");
        
        // Wait for iframe to be injected into the page
        await this.page.waitForSelector('iframe', { timeout: 5000 });
        testLogger.info('Processor',"Advanced UI iframe detected in DOM");
        
        // Give iframe time to start loading
        await this.page.waitForTimeout(1000);
        
        return true;
      } catch (error) {
        testLogger.error('Processor',`Failed to navigate to Advanced UI: ${error.message}`);
        return false;
      }
    }
    
    testLogger.error('Processor',"Could not find Advanced menu item");
    return false;
  }

  async getAdvancedUIFrame() {
    // Ensure we're on the advanced page first
    const url = this.page.url();
    if (!url.includes("/advanced")) {
      testLogger.error('Processor',"Not on advanced page, cannot get custom UI frame");
      return null;
    }
    
    // Wait for iframe to exist in DOM
    try {
      await this.page.waitForSelector('iframe', { timeout: 5000 });
    } catch (error) {
      testLogger.error('Processor',"No iframe found in advanced page");
      return null;
    }
    
    // Try to find the custom UI frame with retries
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      const frames = this.page.frames();
      
      // Log frame detection for debugging
      testLogger.info('Processor',`[Processor] Attempt ${attempts + 1}: Found ${frames.length} frames on page`);
      
      if (frames.length > 1) {
        // Log all frame URLs for debugging
        frames.forEach((frame, index) => {
          testLogger.info('Processor',`[Processor] Frame ${index}: ${frame.url()}`);
        });
        
        // Find the custom UI frame (should contain nifi-cuioss-ui in URL)
        const customUIFrame = frames.find(f => 
          f.url().includes("nifi-cuioss-ui")
        );
        
        if (customUIFrame) {
          // Wait for frame to be ready
          try {
            await customUIFrame.waitForLoadState('domcontentloaded', { timeout: 3000 });
            testLogger.info('Processor',`[Processor] Found custom UI frame: ${customUIFrame.url()}`);
            
            // Use the stability check to ensure frame is ready
            const isStable = await this.waitForFrameStability(customUIFrame);
            
            if (isStable) {
              testLogger.info('Processor',"[Processor] Custom UI frame is ready and stable");
              return customUIFrame;
            } else {
              testLogger.warn('Processor',"[Processor] Frame found but not stable yet");
            }
          } catch (e) {
            testLogger.warn('Processor',`[Processor] Frame not ready yet: ${e.message}`);
          }
        }
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        testLogger.info('Processor',`[Processor] Waiting before retry ${attempts}/${maxAttempts}`);
        await this.page.waitForTimeout(1000);
      }
    }
    
    testLogger.error('Processor',`[Processor] Could not find custom UI frame after ${maxAttempts} attempts`);
    return null;
  }

  /**
   * Wait for frame to be stable and ready for interaction
   * @param {Frame} frame - The frame to check
   * @returns {Promise<boolean>} True if frame is stable, false otherwise
   */
  async waitForFrameStability(frame) {
    try {
      // Wait for frame to finish loading
      await frame.waitForLoadState('networkidle', { timeout: 5000 });
      
      // Verify frame has content
      const hasContent = await frame.evaluate(() => {
        return document.body && 
               document.body.children.length > 0 &&
               document.readyState === 'complete';
      });
      
      if (!hasContent) {
        testLogger.warn('Processor',"Frame loaded but has no content or not ready");
        return false;
      }
      
      // Check if the JWT UI is initialized (specific to our custom UI)
      const isUIReady = await frame.evaluate(() => {
        // Check for JWT UI specific elements
        return !!(document.querySelector('#jwt-validator-container') || 
                  document.querySelector('[data-testid="jwt-customizer-container"]'));
      });
      
      if (!isUIReady) {
        testLogger.warn('Processor',"Frame loaded but JWT UI not initialized");
        return false;
      }
      
      testLogger.info('Processor',"Frame is stable and ready");
      return true;
    } catch (error) {
      testLogger.error('Processor',`Frame stability check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Click a tab in the custom UI
   * @param {Frame} customUIFrame - The custom UI iframe
   * @param {string} tabName - Name of the tab to click
   */
  async clickTab(customUIFrame, tabName) {
    // Ensure frame is stable before interaction
    await this.waitForFrameStability(customUIFrame);
    
    const tab = customUIFrame.locator(`[role="tab"]:has-text("${tabName}")`);
    await tab.click();
    await this.page.waitForTimeout(1000);
    testLogger.info('Processor',`Clicked ${tabName} tab`);
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

    testLogger.info('Processor',"Successfully accessed custom UI iframe");
    return customUIFrame;
  }
}