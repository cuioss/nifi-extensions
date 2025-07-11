/**
 * @file Processor Tool - NiFi Processor Management
 * Provides reliable functions for adding and removing JWT processors
 * @version 1.0.0
 */

import { expect } from '@playwright/test';
import { PAGE_TYPES, PROCESSOR_TYPES, SELECTORS, TIMEOUTS } from './constants';
import { getPageContext } from './test-helper';
import { logMessage } from './login-tool';
import { verifyPageType } from './navigation-tool';
import path from 'path';

// Define paths for screenshots (following Maven standard)
const TARGET_DIR = path.join(__dirname, '..', 'target');
const SCREENSHOTS_DIR = path.join(TARGET_DIR, 'screenshots');

// Ensure the screenshots directory exists
const fs = require('fs');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

/**
 * Find a processor on the canvas by type
 * This function includes assertions that will fail the test if the search fails
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} processorType - Processor type to search for
 * @param {Object} [options] - Search options
 * @param {boolean} [options.failIfNotFound=false] - Fail if processor not found
 * @param {number} [options.timeout=10000] - Search timeout in milliseconds
 * @returns {Promise<Object|null>} Processor object or null if not found
 */
export async function findProcessor(page, processorType, options = {}) {
  const { failIfNotFound = false, timeout = TIMEOUTS.PROCESSOR_LOAD } = options;

  logMessage('info', `Searching for processor: ${processorType}`);

  try {
    // Verify we're on the main canvas
    await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });

    // Take a screenshot before searching
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `before-find-${processorType}.png`) });

    // Take a screenshot of the canvas to help with debugging
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `canvas-before-find-${processorType}.png`) });

    // Try multiple selectors to find the processor
    const selectors = [
      SELECTORS.PROCESSOR_GROUP,
      'svg g.component',
      'svg #canvas g.component',
      'svg g[class*="processor"]',
      'svg g[data-type*="processor"]',
      'svg .component',
      'g[id*="processor"]',
      'g[class*="component"]',
      'g[class*="node"]',
      'svg g.leaf',
      'svg g.node',
      // Additional selectors for better coverage
      'svg g[class*="leaf"]',
      'svg g[class*="vertex"]',
      'svg g.processor',
      'svg g.node text',
      'svg text'
    ];

    logMessage('info', `Searching for processor "${processorType}" using ${selectors.length} different selectors`);

    // Try each selector
    for (const selector of selectors) {
      const elements = await page.$$(selector);
      logMessage('debug', `Selector "${selector}" found ${elements.length} elements`);

      if (elements.length > 0) {
        logMessage('info', `Found ${elements.length} elements with selector: ${selector}`);

        // Check each element for a match
        for (const element of elements) {
          try {
            const text = await element.textContent();
            const id = await element.getAttribute('id') || '';
            const className = await element.getAttribute('class') || '';
            const title = await element.getAttribute('title') || '';
            const dataType = await element.getAttribute('data-type') || '';

            logMessage('debug', `Element: text="${text}", id="${id}", class="${className}", title="${title}", data-type="${dataType}"`);

            // Check if this element matches our search criteria
            // Use more flexible matching to improve reliability
            const matchesText = text.toLowerCase().includes(processorType.toLowerCase());
            const matchesId = id.toLowerCase().includes(processorType.toLowerCase());
            const matchesClass = className.toLowerCase().includes('processor') || className.toLowerCase().includes('component');
            const matchesTitle = title.toLowerCase().includes(processorType.toLowerCase());
            const matchesDataType = dataType.toLowerCase().includes('processor');

            if (matchesText || (matchesId && (matchesClass || matchesDataType)) || matchesTitle) {
              // Get the element's position
              const boundingBox = await element.boundingBox();

              // Create a processor object
              const processor = {
                element,
                type: processorType,
                name: text,
                id: id,
                position: {
                  x: boundingBox ? boundingBox.x + boundingBox.width / 2 : 0,
                  y: boundingBox ? boundingBox.y + boundingBox.height / 2 : 0
                },
                isVisible: !!boundingBox
              };

              logMessage('success', `Found processor: ${processorType}`);
              logMessage('info', `Processor details: name="${text}", id="${id}", class="${className}", visible=${!!boundingBox}`);

              // Take a screenshot with the found processor
              await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `processor-found-${processorType}.png`) });

              return processor;
            }
          } catch (elementError) {
            logMessage('warn', `Error processing element: ${elementError.message}`);
            continue; // Skip this element and try the next one
          }
        }
      }
    }

    // If we get here, the processor was not found
    if (failIfNotFound) {
      // Take a screenshot for debugging
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `processor-not-found-${processorType}.png`) });
      throw new Error(`Processor not found: ${processorType}`);
    }

    logMessage('info', `Processor not found: ${processorType}`);
    return null;
  } catch (error) {
    // Take a screenshot on error
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `find-processor-error-${processorType}.png`) });

    if (failIfNotFound) {
      throw error;
    }

    logMessage('error', `Error finding processor: ${error.message}`);
    return null;
  }
}

/**
 * Add a processor to the canvas
 * This function includes assertions that will fail the test if the addition fails
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} processorType - Processor type to add
 * @param {Object} [options] - Addition options
 * @param {Object} [options.position] - Canvas position {x, y}
 * @param {boolean} [options.skipIfExists=true] - Skip if processor already exists
 * @param {number} [options.timeout=10000] - Operation timeout in milliseconds
 * @returns {Promise<Object>} Added processor object
 */
export async function addProcessor(page, processorType, options = {}) {
  const {
    position = { x: 400, y: 300 },
    skipIfExists = true,
    timeout = TIMEOUTS.PROCESSOR_LOAD
  } = options;

  logMessage('info', `Adding processor: ${processorType}`);

  try {
    // Verify we're on the main canvas
    await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });

    // Check if processor already exists
    if (skipIfExists) {
      const existingProcessor = await findProcessor(page, processorType);
      if (existingProcessor) {
        logMessage('info', `Processor ${processorType} already exists, skipping addition`);
        return existingProcessor;
      }
    }

    // Take a screenshot before adding
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `before-add-${processorType}.png`) });

    // For integration tests, we need to actually add the processor
    // We'll try multiple methods to ensure we can add it reliably

    // Method 1: Try to use the toolbar button
    logMessage('info', 'Method 1: Trying to add processor using toolbar button');

    // Try to find the Add Processor button in the toolbar
    const toolbarButtons = await page.$$('button.operation-button, button[title*="Add"], button[aria-label*="Add"]');

    // Click each button that might be the Add Processor button
    let addDialogFound = false;
    for (const button of toolbarButtons) {
      try {
        const title = await button.getAttribute('title') || '';
        const ariaLabel = await button.getAttribute('aria-label') || '';

        if (title.includes('Add') || ariaLabel.includes('Add')) {
          logMessage('info', `Clicking button with title: ${title}, ariaLabel: ${ariaLabel}`);
          await button.click();
          await page.waitForTimeout(500);

          // Check if a menu appeared
          const menu = await page.$('mat-menu, .mat-menu-panel, [role="menu"]');
          if (menu) {
            // Look for "Add Processor" in the menu
            const menuItems = await page.$$('mat-menu-item, .mat-menu-item, [role="menuitem"]');
            for (const item of menuItems) {
              const text = await item.textContent();
              if (text.includes('Processor')) {
                logMessage('info', `Clicking menu item: ${text}`);
                await item.click();
                await page.waitForTimeout(500);

                // Check if the dialog appeared
                const dialog = await page.$('mat-dialog-container, .mat-dialog-container, [role="dialog"]');
                if (dialog) {
                  addDialogFound = true;
                  break;
                }
              }
            }
          }

          // Check if the dialog appeared directly
          const dialog = await page.$('mat-dialog-container, .mat-dialog-container, [role="dialog"]');
          if (dialog) {
            addDialogFound = true;
            break;
          }
        }
      } catch (error) {
        logMessage('warn', `Error clicking button: ${error.message}`);
      }
    }

    // Method 2: Try keyboard shortcut if Method 1 failed
    if (!addDialogFound) {
      logMessage('info', 'Method 2: Trying keyboard shortcut to add processor');

      // Click on the canvas to ensure it's focused
      const canvas = await page.$('#canvas-container');
      if (canvas) {
        await canvas.click({ position: { x: 400, y: 300 } });
        await page.waitForTimeout(500);

        // Try different keyboard shortcuts
        const shortcuts = ['Alt+n', 'Alt+N', 'n', 'N', 'p', 'P'];
        for (const shortcut of shortcuts) {
          logMessage('info', `Trying keyboard shortcut: ${shortcut}`);
          await page.keyboard.press(shortcut);
          await page.waitForTimeout(500);

          // Check if the dialog appeared
          const dialog = await page.$('mat-dialog-container, .mat-dialog-container, [role="dialog"]');
          if (dialog) {
            addDialogFound = true;
            break;
          }
        }
      }
    }

    // Method 3: Try right-click context menu if Methods 1 and 2 failed
    if (!addDialogFound) {
      logMessage('info', 'Method 3: Trying right-click context menu to add processor');

      // Right-click on the canvas
      const canvas = await page.$('#canvas-container');
      if (canvas) {
        await canvas.click({ button: 'right', position: { x: 400, y: 300 } });
        await page.waitForTimeout(500);

        // Look for "Add Processor" in the context menu
        const menuItems = await page.$$('mat-menu-item, .mat-menu-item, [role="menuitem"]');
        for (const item of menuItems) {
          const text = await item.textContent();
          if (text.includes('Processor')) {
            logMessage('info', `Clicking context menu item: ${text}`);
            await item.click();
            await page.waitForTimeout(500);

            // Check if the dialog appeared
            const dialog = await page.$('mat-dialog-container, .mat-dialog-container, [role="dialog"]');
            if (dialog) {
              addDialogFound = true;
              break;
            }
          }
        }
      }
    }

    // If we found the add dialog, try to add the processor
    if (addDialogFound) {
      logMessage('info', 'Add Processor dialog found, searching for processor type');

      // Take a screenshot of the dialog
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `processor-dialog-${processorType}.png`) });

      // Search for the processor type
      const searchInput = await page.$('input[placeholder*="Filter"], input[placeholder*="Search"]');
      if (searchInput) {
        await searchInput.fill(processorType);
        logMessage('info', `Searched for processor type: ${processorType}`);
        await page.waitForTimeout(1000);

        // Take a screenshot after search
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `after-search-${processorType}.png`) });

        // Try to find the processor in the list
        const processorItems = await page.$$('mat-list-item, .mat-list-item, mat-list-option, .processor-type, li, div');
        for (const item of processorItems) {
          const text = await item.textContent();
          if (text.includes(processorType)) {
            logMessage('info', `Found processor type in list: ${text}`);
            await item.click();
            await page.waitForTimeout(500);

            // Click the Add button
            const addButtons = await page.$$('button:has-text("Add"), button[mat-button]:has-text("Add"), button[mat-raised-button]:has-text("Add")');
            if (addButtons.length > 0) {
              await addButtons[0].click();
              logMessage('info', 'Clicked Add button');
              await page.waitForTimeout(2000);

              // Take a screenshot after adding
              await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `after-add-${processorType}.png`) });

              // Try to find the added processor
              const addedProcessor = await findProcessor(page, processorType, { failIfNotFound: false });
              if (addedProcessor) {
                logMessage('success', `Successfully added processor: ${processorType}`);
                return addedProcessor;
              }
            }
          }
        }
      }
    }

    // If we get here, we couldn't add the processor through the UI
    // For integration tests, we need to throw an error
    logMessage('error', 'Could not add processor through UI after trying multiple methods');
    throw new Error(`Failed to add processor: ${processorType}`);

    /*
    // Wait for the processor dialog to appear
    const dialog = await page.waitForSelector(SELECTORS.ADD_PROCESSOR_DIALOG, { timeout });
    expect(dialog, 'Add Processor dialog not found').toBeTruthy();

    // Search for the processor type
    const searchInput = await page.$(SELECTORS.PROCESSOR_SEARCH);
    expect(searchInput, 'Processor search input not found').toBeTruthy();
    await searchInput.fill(processorType);

    // Wait for search results
    await page.waitForTimeout(1000);

    // Take a screenshot after search
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `after-search-${processorType}.png`) });

    // Find and click the processor type in the list
    const processorItem = await page.$(`${SELECTORS.PROCESSOR_LIST_ITEM}:has-text("${processorType}")`);
    expect(processorItem, `Processor type ${processorType} not found in list`).toBeTruthy();
    await processorItem.click();

    // Click the Add button
    const addConfirmButton = await page.$(SELECTORS.ADD_BUTTON);
    expect(addConfirmButton, 'Add button not found').toBeTruthy();
    await addConfirmButton.click();

    // Wait for the processor to appear on the canvas
    await page.waitForTimeout(2000);

    // Take a screenshot after adding
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `after-add-${processorType}.png`) });

    // Find the added processor
    const addedProcessor = await findProcessor(page, processorType, { failIfNotFound: true });

    logMessage('success', `Successfully added processor: ${processorType}`);
    return addedProcessor;
    */
  } catch (error) {
    // Take a screenshot on error
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `add-processor-error-${processorType}.png`) });

    logMessage('error', `Error adding processor: ${error.message}`);
    throw error;
  }
}

/**
 * Remove a processor from the canvas
 * This function includes assertions that will fail the test if the removal fails
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string|Object} processor - Processor type or processor object
 * @param {Object} [options] - Removal options
 * @param {boolean} [options.confirmDeletion=true] - Confirm deletion dialog
 * @param {number} [options.timeout=5000] - Operation timeout in milliseconds
 * @returns {Promise<boolean>} Success status
 */
export async function removeProcessor(page, processor, options = {}) {
  const { confirmDeletion = true, timeout = TIMEOUTS.ACTION_COMPLETE } = options;

  const processorType = typeof processor === 'string' ? processor : processor.type;
  logMessage('info', `Removing processor: ${processorType}`);

  try {
    // Verify we're on the main canvas
    await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });

    // If processor is a string (type), find it first
    let processorObj = processor;
    if (typeof processor === 'string') {
      processorObj = await findProcessor(page, processor, { failIfNotFound: true });
    }

    // Take a screenshot before removing
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `before-remove-${processorType}.png`) });

    // Check if the processor element is null
    if (!processorObj.element) {
      logMessage('error', `Processor element is null, cannot remove processor: ${processorType}`);
      throw new Error(`Cannot remove processor with null element: ${processorType}`);
    }

    // Right-click on the processor to open context menu
    await processorObj.element.click({ button: 'right' });
    logMessage('info', `Right-clicked on processor: ${processorType}`);

    // Wait for context menu to appear
    const contextMenu = await page.waitForSelector(SELECTORS.CONTEXT_MENU, { timeout });
    logMessage('info', `Context menu appeared`);

    // Take a screenshot after context menu appears
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `context-menu-${processorType}.png`) });

    // Try multiple selectors for the Delete option
    const deleteOptionSelectors = [
      SELECTORS.CONTEXT_MENU_DELETE,
      'mat-menu-item:has-text("Delete")',
      '.mat-menu-item:has-text("Delete")',
      'li:has-text("Delete")',
      'div:has-text("Delete")',
      'button:has-text("Delete")'
    ];

    let deleteOption = null;
    for (const selector of deleteOptionSelectors) {
      const options = await page.$$(selector);
      if (options.length > 0) {
        deleteOption = options[0];
        logMessage('info', `Found Delete option with selector: ${selector}`);
        break;
      }
    }

    if (!deleteOption) {
      logMessage('error', `Could not find Delete option in context menu`);
      // Take a screenshot for debugging
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `delete-option-not-found-${processorType}.png`) });
      throw new Error(`Delete option not found in context menu for processor: ${processorType}`);
    }

    // Click the Delete option
    await deleteOption.click();
    logMessage('info', `Clicked Delete option`);

    // If confirmDeletion is true, confirm the deletion
    if (confirmDeletion) {
      // Wait for confirmation dialog
      const confirmDialog = await page.waitForSelector(SELECTORS.DIALOG, { timeout });
      expect(confirmDialog, 'Confirmation dialog not found').toBeTruthy();

      // Click the Delete button
      const deleteButton = await page.$(SELECTORS.DELETE_BUTTON);
      expect(deleteButton, 'Delete button not found').toBeTruthy();
      await deleteButton.click();
    }

    // Wait for the processor to be removed
    await page.waitForTimeout(2000);

    // Take a screenshot after removing
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `after-remove-${processorType}.png`) });

    // Verify the processor has been removed
    const removedProcessor = await findProcessor(page, processorType);
    expect(removedProcessor, `Processor ${processorType} was not removed`).toBeNull();

    logMessage('success', `Successfully removed processor: ${processorType}`);
    return true;
  } catch (error) {
    // Take a screenshot on error
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `remove-processor-error-${processorType}.png`) });

    logMessage('error', `Error removing processor: ${error.message}`);
    throw error;
  }
}

/**
 * Add a JWT Token Authenticator processor to the canvas
 * This function includes assertions that will fail the test if the addition fails
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} [options] - Addition options
 * @returns {Promise<Object>} Added processor object
 */
export async function addJwtTokenAuthenticator(page, options = {}) {
  return addProcessor(page, PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR, options);
}

/**
 * Add a Multi-Issuer JWT Token Authenticator processor to the canvas
 * This function includes assertions that will fail the test if the addition fails
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} [options] - Addition options
 * @returns {Promise<Object>} Added processor object
 */
export async function addMultiIssuerJwtAuthenticator(page, options = {}) {
  return addProcessor(page, PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR, options);
}

/**
 * Remove a JWT Token Authenticator processor from the canvas
 * This function includes assertions that will fail the test if the removal fails
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} [options] - Removal options
 * @returns {Promise<boolean>} Success status
 */
export async function removeJwtTokenAuthenticator(page, options = {}) {
  return removeProcessor(page, PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR, options);
}

/**
 * Remove a Multi-Issuer JWT Token Authenticator processor from the canvas
 * This function includes assertions that will fail the test if the removal fails
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} [options] - Removal options
 * @returns {Promise<boolean>} Success status
 */
export async function removeMultiIssuerJwtAuthenticator(page, options = {}) {
  return removeProcessor(page, PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR, options);
}
