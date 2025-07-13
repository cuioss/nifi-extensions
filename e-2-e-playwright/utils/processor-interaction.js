/**
 * @fileoverview Processor Interaction Service - Modern 2025 Patterns
 * Focused module for interacting with processors (click, configure, etc.)
 */

import { expect } from '@playwright/test';
import { CONSTANTS } from './constants.js';
import { processorLogger as logMessage, logTimed } from './shared-logger.js';

/**
 * Modern processor interaction service
 */
export class ProcessorInteraction {
  constructor(page) {
    this.page = page;
  }

  /**
   * Extract processor status using modern patterns
   */
  async extractStatus(processor) {
    const locator = this.page.locator(processor.element);
    
    // Look for status indicators using modern selectors
    const statusIndicators = [
      { selector: '.fa-play', status: 'running' },
      { selector: '.fa-stop', status: 'stopped' },
      { selector: '.fa-warning', status: 'warning' },
      { selector: '.fa-exclamation', status: 'error' }
    ];

    for (const { selector, status } of statusIndicators) {
      if (await locator.locator(selector).isVisible()) {
        return status;
      }
    }

    return 'unknown';
  }

  /**
   * Modern processor interaction with proper waiting
   */
  async interact(processor, options = {}) {
    const { 
      action = 'click', 
      takeScreenshot = false, 
      timeout = 10000 
    } = options;

    return await logTimed(`${action} on processor: ${processor.type}`, async () => {
      const locator = this.page.locator(processor.element);
      
      // Ensure processor is visible and ready
      await expect(locator).toBeVisible({ timeout });
      
      // Take screenshot if requested
      if (takeScreenshot) {
        await this.page.screenshot({ 
          path: `target/screenshots/processor-${action}-${Date.now()}.png`,
          fullPage: true 
        });
      }

      // Perform the action using modern patterns
      switch (action.toLowerCase()) {
        case 'click':
          await locator.click();
          break;
        case 'doubleclick':
          await locator.dblclick();
          break;
        case 'rightclick':
          await locator.click({ button: 'right' });
          break;
        case 'hover':
          await locator.hover();
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // Wait for any resulting changes
      await this.page.waitForLoadState('networkidle');
      
      logMessage('success', `${action} completed on processor: ${processor.type}`);
    });
  }

  /**
   * Open processor configuration dialog with modern patterns
   */
  async openConfigureDialog(processor, options = {}) {
    const { timeout = 10000, takeScreenshot = false } = options;

    return await logTimed(`Opening configure dialog for: ${processor.type}`, async () => {
      // Right-click to open context menu
      await this.interact(processor, { action: 'rightclick', takeScreenshot });
      
      // Look for configure option using modern selectors
      const configureOption = this.page.getByRole('menuitem', { name: /configure/i });
      await expect(configureOption).toBeVisible({ timeout: 5000 });
      await configureOption.click();

      // Wait for dialog to appear
      const dialog = this.page.locator('.mat-dialog-container, .configure-dialog');
      await expect(dialog).toBeVisible({ timeout });

      logMessage('success', `Opened configure dialog for: ${processor.type}`);
      return dialog;
    });
  }

  /**
   * Open advanced configuration with modern patterns
   */
  async openAdvancedConfiguration(processor, options = {}) {
    const { timeout = 10000, takeScreenshot = false } = options;

    return await logTimed(`Opening advanced config for: ${processor.type}`, async () => {
      // First open the configure dialog
      await this.openConfigureDialog(processor, { takeScreenshot });

      // Look for advanced/properties tab
      const advancedTab = this.page.getByRole('tab', { name: /properties|advanced/i });
      if (await advancedTab.isVisible()) {
        await advancedTab.click();
      }

      // Wait for advanced view to load
      const advancedContent = this.page.locator('.mat-tab-body-active, .properties-content');
      await expect(advancedContent).toBeVisible({ timeout });

      // Verify we're in advanced view
      const hasPropertyFields = await this.page.locator('input[type="text"], textarea, select')
        .count() > 0;
      
      expect(hasPropertyFields, 'Advanced configuration view should have property fields')
        .toBeTruthy();

      logMessage('success', `Opened advanced configuration for: ${processor.type}`);
      return advancedContent;
    });
  }

  /**
   * Navigate to processor details with modern patterns
   */
  async navigateToDetails(processor, options = {}) {
    const { timeout = 10000 } = options;

    return await logTimed(`Navigating to details for: ${processor.type}`, async () => {
      // Double-click to open details
      await this.interact(processor, { action: 'doubleclick' });

      // Wait for navigation or modal
      await this.page.waitForLoadState('networkidle');

      // Verify we're in details view
      const detailsIndicators = [
        this.page.locator('.processor-details'),
        this.page.getByText('Processor Details'),
        this.page.locator('h1, h2, h3').filter({ hasText: processor.type })
      ];

      let found = false;
      for (const indicator of detailsIndicators) {
        if (await indicator.isVisible()) {
          found = true;
          break;
        }
      }

      expect(found, `Should navigate to details for processor: ${processor.type}`)
        .toBeTruthy();

      logMessage('success', `Navigated to details for: ${processor.type}`);
    });
  }
}

/**
 * Convenience functions for backward compatibility
 */
export async function interactWithProcessor(page, processor, options = {}) {
  const interaction = new ProcessorInteraction(page);
  return interaction.interact(processor, options);
}

export async function openProcessorConfigureDialog(page, processor, options = {}) {
  const interaction = new ProcessorInteraction(page);
  return interaction.openConfigureDialog(processor, options);
}

export async function openProcessorAdvancedConfiguration(page, processor, options = {}) {
  const interaction = new ProcessorInteraction(page);
  return interaction.openAdvancedConfiguration(processor, options);
}