/**
 * @file Simplified Processor Utilities
 * Consolidated processor operations using Playwright built-ins
 * @version 3.0.0
 */

import { expect } from '@playwright/test';
import { CONSTANTS } from './constants.js';

/**
 * Add processor to canvas first
 */
export async function addProcessorToCanvas(page, processorType = 'MultiIssuerJWTTokenAuthenticator') {
  try {
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
        
        // Wait for processor to appear on canvas
        await page.waitForTimeout(3000);
        
        // Check if processor was added by looking for processor elements on canvas
        const processorOnCanvas = page.locator('g.processor, rect.processor, [data-component-type="processor"]');
        const processorExists = await processorOnCanvas.count() > 0;
        
        if (processorExists) {
          console.log('Successfully added processor to canvas');
          return true;
        } else {
          console.log('Processor drag completed but no processor found on canvas');
          return false;
        }
      } else {
        console.log('Could not get canvas bounds for drag target');
      }
    } else {
      console.log('Draggable processor button not visible');
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
  const { failIfNotFound = true, addIfNotFound = false } = options;

  // First, try to add processor to canvas if requested
  if (addIfNotFound) {
    await addProcessorToCanvas(page, processorType);
  }

  // Use more specific selectors for processors on canvas
  const selectors = [
    // NiFi-specific processor selectors
    `g.processor[data-type*="${processorType}"]`,
    `rect.processor[data-type*="${processorType}"]`,
    `[data-component-type="processor"][data-type*="${processorType}"]`,
    `g.component[data-type*="${processorType}"]`,
    
    // Text-based selectors
    `text:has-text("${processorType}")`,
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
    throw new Error('JWT Authenticator not found');
  }

  return null;
}

/**
 * Find MultiIssuer JWT Token Authenticator specifically
 */
export async function findMultiIssuerJwtAuthenticator(page, options = {}) {
  // First try to find existing processor
  let processor = await findProcessor(page, 'MultiIssuerJWTTokenAuthenticator', { failIfNotFound: false });
  
  if (!processor && options.addIfNotFound !== false) {
    // Try to add processor to canvas
    const added = await addProcessorToCanvas(page, 'MultiIssuerJWTTokenAuthenticator');
    if (added) {
      // Try to find again after adding
      processor = await findProcessor(page, 'MultiIssuerJWTTokenAuthenticator', { failIfNotFound: false });
    }
  }
  
  if (!processor && options.failIfNotFound !== false) {
    throw new Error('MultiIssuerJWTTokenAuthenticator not found');
  }
  
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
  const { action = 'click', timeout = 10000, takeScreenshot = false } = options;

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
      await page.screenshot({ path: `processor-interaction-${Date.now()}.png` });
    }

    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch (error) {
    console.error(`Processor interaction failed (${action}):`, error.message);
    
    // Take screenshot on failure for debugging
    if (takeScreenshot) {
      await page.screenshot({ path: `processor-interaction-failed-${Date.now()}.png` });
    }
    
    throw error;
  }
}

/**
 * Configure processor using modern patterns with better error handling
 */
export async function configureProcessor(page, processorIdentifier, options = {}) {
  const { timeout = 10000 } = options;

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
    await interactWithProcessor(page, processor, { action: 'rightclick', timeout });

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

    // Wait for dialog using multiple selectors
    const dialogSelectors = [
      '.mat-dialog-container',
      '.configure-dialog',
      '.processor-configuration',
      '.configuration-dialog',
      '[role="dialog"]',
      '.dialog'
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

  // Verify processor is on canvas
  await expect(page.locator(processor.element)).toBeVisible({ timeout: 5000 });

  return processor;
}

/**
 * Simplified ProcessorService class
 */
export class ProcessorService {
  constructor(page) {
    this.page = page;
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
    return interactWithProcessor(this.page, processor, options);
  }

  async configure(processor, options = {}) {
    return configureProcessor(this.page, processor, options);
  }

  async openConfiguration(processor, options = {}) {
    return configureProcessor(this.page, processor, options);
  }

  async configureMultiIssuerJwtAuthenticator(processor, options = {}) {
    return configureProcessor(this.page, processor, options);
  }

  async verifyDeployment(processorType) {
    return verifyProcessorDeployment(this.page, processorType);
  }
}
