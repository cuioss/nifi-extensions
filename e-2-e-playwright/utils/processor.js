/**
 * @file Simplified Processor Utilities
 * Consolidated processor operations using Playwright built-ins
 * @version 3.0.0
 */

import { expect } from '@playwright/test';
import { CONSTANTS } from './constants.js';

/**
 * Find processor on canvas using modern Playwright patterns
 */
export async function findProcessor(page, processorType, options = {}) {
  const { failIfNotFound = true } = options;
  
  // Use Playwright's built-in locator strategies
  const selectors = [
    `[data-type*="${processorType}"]`,
    `text=${processorType}`,
    `[class*="${processorType}"]`,
    `[title*="${processorType}"]`
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
  return findProcessor(page, 'MultiIssuerJWTTokenAuthenticator', options);
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
 * Interact with processor using modern patterns
 */
export async function interactWithProcessor(page, processor, options = {}) {
  const { action = 'click', timeout = 10000 } = options;
  
  const locator = processor.locator || page.locator(processor.element);
  
  switch (action) {
    case 'click':
      await locator.click({ timeout });
      break;
    case 'doubleclick':
      await locator.dblclick({ timeout });
      break;
    case 'rightclick':
      await locator.click({ button: 'right', timeout });
      break;
    case 'hover':
      await locator.hover({ timeout });
      break;
    default:
      throw new Error(`Unknown action: ${action}`);
  }

  await page.waitForLoadState('networkidle');
}

/**
 * Configure processor using modern patterns
 */
export async function configureProcessor(page, processor, options = {}) {
  const { timeout = 10000 } = options;
  
  // Right-click to open context menu
  await interactWithProcessor(page, processor, { action: 'rightclick' });
  
  // Use modern selector to find configure option
  const configureOption = page.getByRole('menuitem', { name: /configure/i });
  await expect(configureOption).toBeVisible({ timeout: 5000 });
  await configureOption.click();

  // Wait for dialog using modern selectors
  const dialog = page.locator('.mat-dialog-container, .configure-dialog');
  await expect(dialog).toBeVisible({ timeout });
  
  return dialog;
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