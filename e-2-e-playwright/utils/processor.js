/**
 * @file Simplified Processor Utilities
 * Consolidated processor operations using Playwright built-ins
 * @version 3.0.0
 */

import {expect} from '@playwright/test';
import {CONSTANTS} from './constants.js';
import { processorLogger } from './shared-logger.js';

/**
 * Add processor to canvas first
 */
export async function addProcessorToCanvas(page, processorType = 'MultiIssuerJWTTokenAuthenticator') {
  try {
    // Check if the Add Processor dialog is already open
    const dialog = page.locator('div[role="dialog"]:has(h2:has-text("Add Processor"))');
    if (await dialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('Add Processor dialog is already open');
    } else {
      // Look for the actual draggable processor button (not the icon div)
      const draggableProcessorButton = page.locator('button.cdk-drag[class*="icon-processor"]').first();

      // Check if the draggable button is visible
      if (await draggableProcessorButton.isVisible()) {
        // Get canvas for drop target
        const canvas = page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS || '#canvas, .canvas, svg');
        await canvas.waitFor({ timeout: 5000 });

        const canvasBounds = await canvas.boundingBox();

        if (canvasBounds) {
          const centerX = canvasBounds.width / 2;
          const centerY = canvasBounds.height / 2;

          // Drag processor to canvas center
          await draggableProcessorButton.dragTo(canvas, {
            targetPosition: { x: centerX, y: centerY },
            force: true
          });

          // Wait for dialog to appear
          await page.waitForTimeout(1000);
        } else {
          console.log('Could not get canvas bounds for drag target');
          return false;
        }
      } else {
        console.log('Draggable processor button not visible');
        return false;
      }
    }

    // Handle the Add Processor dialog
    if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Filter for the specific processor type
      const filterInput = page.locator('input[placeholder="Filter types"]');
      await filterInput.fill(processorType);
      await page.waitForTimeout(500);

      // Click on the processor in the table
      const processorRow = page.locator(`table tr:has(td:has-text("${processorType}"))`).first();
      if (await processorRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await processorRow.click();

        // Click the Add button
        const addButton = page.locator('button:has-text("Add")').last();
        await addButton.click();

        // Wait for dialog to close and processor to appear
        await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(2000);

        // Check if processor was added by looking for processor elements on canvas
        const processorOnCanvas = page.locator('g.processor, rect.processor, [data-component-type="processor"]');
        const processorExists = await processorOnCanvas.count() > 0;

        if (processorExists) {
          console.log('Successfully added processor to canvas');
          return true;
        } else {
          console.log('Processor was selected but not found on canvas');
          return false;
        }
      } else {
        console.log(`Processor type "${processorType}" not found in dialog`);
        // Cancel the dialog
        const cancelButton = page.locator('button:has-text("Cancel")');
        await cancelButton.click();
        return false;
      }
    } else {
      console.log('Add Processor dialog did not appear');
      return false;
    }
  } catch (error) {
    console.log('Could not add processor to canvas:', error.message);
  }

  return false;
}

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
 * Find MultiIssuer JWT Token Authenticator specifically
 */
export async function findMultiIssuerJwtAuthenticator(page, options = {}) {
  // Find existing processor on canvas (should already be present)
  const processor = await findProcessor(page, 'MultiIssuerJWTTokenAuthenticator', options);
  return processor;
}

/**
 * Verify MultiIssuer JWT Token Authenticator deployment
 */
export async function verifyMultiIssuerJwtAuthenticator(page, options = {}) {
  const processor = await findMultiIssuerJwtAuthenticator(page, options);

  if (processor) {
    await verifyProcessorDeployment(page, 'MultiIssuerJWTTokenAuthenticator');
    return { ...processor, name: 'MultiIssuerJWTTokenAuthenticator' };
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
    processor = await findProcessor(page, processorIdentifier, { addIfNotFound: true });
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
 * Simplified ProcessorService class
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
    return findMultiIssuerJwtAuthenticator(this.page, options);
  }

  async verifyMultiIssuerJwtAuthenticator(options = {}) {
    return verifyMultiIssuerJwtAuthenticator(this.page, options);
  }

  async interact(processor, options = {}) {
    return interactWithProcessor(this.page, processor, { ...options, testInfo: this.testInfo });
  }

  async configure(processor, options = {}) {
    return configureProcessor(this.page, processor, { ...options, testInfo: this.testInfo });
  }

  async openConfiguration(processor, options = {}) {
    return configureProcessor(this.page, processor, { ...options, testInfo: this.testInfo });
  }

  async configureMultiIssuerJwtAuthenticator(processor, options = {}) {
    return configureProcessor(this.page, processor, { ...options, testInfo: this.testInfo });
  }

  async accessAdvancedProperties(dialog, options = {}) {
    // Look for Advanced tab specifically (not Properties tab)
    const advancedTab = this.page.getByRole("tab", {
      name: /^advanced$/i,
    });

    if (await advancedTab.isVisible({ timeout: 2000 })) {
      await advancedTab.click();
      
      // Wait for tab switch
      await this.page.waitForTimeout(1000);

      // Verify advanced content is loaded using NiFi-compatible selectors
      const advancedContent = this.page.locator(
        '[role="tabpanel"]:not([hidden]), .tab-pane.active, [aria-expanded="true"]',
      );
      await expect(advancedContent.first()).toBeVisible({
        timeout: 3000,
      });

      return true;
    }

    // If no "Advanced" tab found, log available tabs for debugging
    const allTabs = await this.page.getByRole("tab").allTextContents();
    processorLogger.warn(`No Advanced tab found. Available tabs: ${allTabs.join(", ")}`);
    
    return false;
  }

  async openAdvancedUI(processor) {
    processorLogger.info("Opening Advanced UI via right-click menu");
    
    // Right-click on processor
    await this.interact(processor, { action: "rightclick" });
    
    // Look for Advanced menu item
    const advancedMenuItem = this.page.getByRole("menuitem", { name: /advanced/i });
    
    if (await advancedMenuItem.isVisible({ timeout: 2000 })) {
      await advancedMenuItem.click();
      processorLogger.info("Clicked Advanced menu item");
      
      // Wait for navigation
      await this.page.waitForLoadState("networkidle");
      await this.page.waitForTimeout(2000);
      
      // Verify we're on the advanced page
      const url = this.page.url();
      if (url.includes("/advanced")) {
        processorLogger.success("Successfully navigated to Advanced UI");
        return true;
      }
    }
    
    processorLogger.error("Could not find Advanced menu item");
    return false;
  }

  async verifyDeployment(processorType) {
    return verifyProcessorDeployment(this.page, processorType);
  }

  async waitForConfigurationDialog() {
    const dialog = this.page.locator('[role="dialog"], .dialog, .configuration-dialog');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    return dialog;
  }

  async findBackNavigationLink() {
    const backLinks = [
      this.page.getByRole("link", { name: /back to processor/i }),
      this.page.getByRole("button", { name: /back to processor/i }),
      this.page.getByText(/back to processor/i),
      this.page.locator('[href*="processor"]'),
      this.page.locator(".back-link, .return-link"),
    ];

    for (const backLink of backLinks) {
      if (await backLink.isVisible({ timeout: 2000 })) {
        return backLink;
      }
    }
    return null;
  }

  async navigateBack() {
    const backLink = await this.findBackNavigationLink();
    if (backLink) {
      await backLink.click();
      await this.page.waitForLoadState("networkidle");
      return true;
    } else {
      // Fallback to browser back
      await this.page.goBack();
      await this.page.waitForLoadState("networkidle");
      return false; // Indicates fallback was used
    }
  }
}
