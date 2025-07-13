/**
 * @fileoverview Canvas Page Object - Modern 2025 Patterns
 * Represents the main NiFi canvas with modern locator strategies
 */

import { expect } from '@playwright/test';
import { CONSTANTS } from '../utils/constants.js';

/**
 * Modern Canvas Page Object with 2025 best practices
 */
export class CanvasPage {
  constructor(page) {
    this.page = page;
    this.initializeLocators();
  }

  /**
   * Initialize locators using modern Playwright patterns
   */
  initializeLocators() {
    this.canvas = this.page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS);
    this.canvasSvg = this.page.locator(CONSTANTS.SELECTORS.CANVAS_SVG);
    
    // Toolbar elements
    this.toolbar = this.page.locator('mat-toolbar, .toolbar');
    this.operateButton = this.page.getByRole('button', { name: /operate/i });
    this.settingsButton = this.page.getByRole('button', { name: /settings/i });
    
    // Processor elements
    this.processors = this.page.locator(CONSTANTS.SELECTORS.PROCESSOR_ELEMENT);
    
    // Context menu
    this.contextMenu = this.page.locator(CONSTANTS.SELECTORS.CONTEXT_MENU);
  }

  /**
   * Navigate to canvas
   */
  async goto() {
    await this.page.goto('/nifi');
    await this.page.waitForLoadState('networkidle');
    await this.verifyCanvasLoaded();
  }

  /**
   * Verify canvas is loaded and ready
   */
  async verifyCanvasLoaded() {
    await expect(this.canvas).toBeVisible({ timeout: 30000 });
    await expect(this.page).toHaveTitle(/NiFi/);
  }

  /**
   * Find processor by type or name
   */
  async findProcessor(processorType) {
    // Use modern locator strategies
    const processorLocators = [
      this.page.locator(`[data-type*="${processorType}"]`),
      this.page.locator(`text=${processorType}`),
      this.page.locator(`[title*="${processorType}"]`)
    ];

    for (const locator of processorLocators) {
      if (await locator.first().isVisible()) {
        return locator.first();
      }
    }

    return null;
  }

  /**
   * Right-click on processor to open context menu
   */
  async rightClickProcessor(processorType) {
    const processor = await this.findProcessor(processorType);
    expect(processor, `Processor ${processorType} should be found`).toBeTruthy();
    
    await processor.click({ button: 'right' });
    await expect(this.contextMenu).toBeVisible({ timeout: 5000 });
    
    return processor;
  }

  /**
   * Configure processor
   */
  async configureProcessor(processorType) {
    await this.rightClickProcessor(processorType);
    
    const configureOption = this.page.getByRole('menuitem', { name: /configure/i });
    await expect(configureOption).toBeVisible();
    await configureOption.click();
    
    // Wait for configuration dialog
    const dialog = this.page.locator(CONSTANTS.SELECTORS.DIALOG_CONTAINER);
    await expect(dialog).toBeVisible({ timeout: 10000 });
    
    return dialog;
  }

  /**
   * Get all visible processors
   */
  async getAllProcessors() {
    return this.processors.all();
  }

  /**
   * Count visible processors
   */
  async getProcessorCount() {
    return this.processors.count();
  }

  /**
   * Verify processor exists
   */
  async verifyProcessorExists(processorType) {
    const processor = await this.findProcessor(processorType);
    expect(processor, `Processor ${processorType} should exist on canvas`).toBeTruthy();
    await expect(processor).toBeVisible();
  }

  /**
   * Verify processor does not exist
   */
  async verifyProcessorNotExists(processorType) {
    const processor = await this.findProcessor(processorType);
    expect(processor, `Processor ${processorType} should not exist on canvas`).toBeFalsy();
  }

  /**
   * Take screenshot of canvas
   */
  async takeScreenshot(filename = null) {
    const screenshotPath = filename || `target/screenshots/canvas-${Date.now()}.png`;
    await this.page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    return screenshotPath;
  }

  /**
   * Wait for canvas to be stable (no loading indicators)
   */
  async waitForStable() {
    await this.page.waitForLoadState('networkidle');
    
    // Wait for any loading indicators to disappear
    const loadingIndicators = this.page.locator('.loading, .spinner, mat-spinner');
    await expect(loadingIndicators).toHaveCount(0, { timeout: 10000 });
  }

  /**
   * Verify toolbar is visible
   */
  async verifyToolbarVisible() {
    await expect(this.toolbar).toBeVisible();
  }

  /**
   * Get canvas dimensions
   */
  async getCanvasDimensions() {
    const boundingBox = await this.canvas.boundingBox();
    return boundingBox;
  }
}