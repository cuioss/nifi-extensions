/**
 * @file Processor Tool - NiFi Processor Discovery and Interaction
 * Provides functions for finding and interacting with deployed NiFi processors
 * @version 2.0.0
 *
 * SCOPE: This tool is designed to work with EXISTING processors on the canvas.
 * It does NOT support adding or removing processors due to technical limitations
 * with NiFi's complex Angular Material UI drag-and-drop interactions.
 */

import { expect } from '@playwright/test';
import { PAGE_TYPES, PROCESSOR_TYPES, SELECTORS, TIMEOUTS } from './constants';
import { getPageContext } from './test-helper';
import { processorLogger as logMessage, logError, logTimed } from './shared-logger';
import { verifyPageType } from './navigation-tool';
import { NIFI_SELECTORS, createProcessorStrategy, createProcessorMatcher } from './selector-strategy';
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
 * Create processor object from element
 * @param {Element} element - DOM element
 * @param {string} processorType - Processor type
 * @param {Object} attributes - Element attributes
 * @returns {Promise<Object>} Processor object
 */
async function createProcessorObject(element, processorType, attributes) {
  const boundingBox = await element.boundingBox();
  
  return {
    element,
    type: processorType,
    name: attributes.text,
    id: attributes.id,
    position: {
      x: boundingBox ? boundingBox.x + boundingBox.width / 2 : 0,
      y: boundingBox ? boundingBox.y + boundingBox.height / 2 : 0
    },
    isVisible: !!boundingBox,
    className: attributes.className,
    title: attributes.title,
    dataType: attributes.dataType
  };
}

/**
 * Extract element attributes for processor matching
 * @param {Element} element - DOM element
 * @returns {Promise<Object>} Element attributes
 */
async function extractElementAttributes(element) {
  return {
    text: await element.textContent(),
    id: await element.getAttribute('id') || '',
    className: await element.getAttribute('class') || '',
    title: await element.getAttribute('title') || '',
    dataType: await element.getAttribute('data-type') || ''
  };
}

/**
 * Find a processor on the canvas by type or name
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} processorType - Processor type or name to search for
 * @param {Object} [options] - Search options
 * @param {boolean} [options.failIfNotFound=false] - Fail if processor not found
 * @param {number} [options.timeout=10000] - Search timeout in milliseconds
 * @returns {Promise<Object|null>} Processor object or null if not found
 */
export async function findProcessor(page, processorType, options = {}) {
  const { failIfNotFound = false, timeout = TIMEOUTS.PROCESSOR_LOAD } = options;

  return await logTimed(
    `Searching for processor: ${processorType}`,
    async () => {
      // Verify we're on the main canvas
      await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });

      // Use processor-specific selector strategy
      const strategy = createProcessorStrategy(processorType);
      const matcher = createProcessorMatcher(processorType);
      
      // Find elements using strategy
      const searchResults = await strategy.findWithDetails(page);
      
      if (!searchResults.found) {
        if (failIfNotFound) {
          throw new Error(`Processor not found: ${processorType}`);
        }
        logMessage('warn', `Processor not found: ${processorType}`);
        return null;
      }

      logMessage('info', `Found ${searchResults.elements.length} potential elements`);

      // Check each element for a match
      for (const element of searchResults.elements) {
        try {
          const attributes = await extractElementAttributes(element);
          
          logMessage('debug', `Element: text="${attributes.text}", id="${attributes.id}", class="${attributes.className}"`);

          // Use the matcher to check if this element matches
          if (matcher(element, attributes.text, attributes)) {
            const processor = await createProcessorObject(element, processorType, attributes);
            
            logMessage('success', `Found processor: ${processorType}`);
            logMessage('info', `Processor details: name="${attributes.text}", id="${attributes.id}", visible=${processor.isVisible}`);
            return processor;
          }
        } catch (elementError) {
          logError('Error processing element', elementError);
          continue; // Skip this element and try the next one
        }
      }

      // If we get here, the processor was not found
      if (failIfNotFound) {
        throw new Error(`Processor not found: ${processorType}`);
      }

      logMessage('warn', `Processor not found: ${processorType}`);
      return null;
    }
  );
}

/**
 * Interact with a processor (double-click to open configuration)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string|Object} processor - Processor type or processor object
 * @param {Object} [options] - Interaction options
 * @param {number} [options.timeout=5000] - Operation timeout in milliseconds
 * @returns {Promise<boolean>} Success status
 */
export async function interactWithProcessor(page, processor, options = {}) {
  const { timeout = TIMEOUTS.ACTION_COMPLETE } = options;

  const processorType = typeof processor === 'string' ? processor : processor.type;
  logMessage('info', `Interacting with processor: ${processorType}`);

  // Verify we're on the main canvas
  await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });

  // If processor is a string (type), find it first
  let processorObj = processor;
  if (typeof processor === 'string') {
    processorObj = await findProcessor(page, processor, { failIfNotFound: true });
  }

  // Check if the processor element is valid
  if (!processorObj.element) {
    logMessage('error', `Processor element is null, cannot interact with processor: ${processorType}`);
    throw new Error(`Cannot interact with processor with null element: ${processorType}`);
  }

  // Right-click on the processor to open context menu
  await processorObj.element.click({ button: 'right' });
  logMessage('info', `Right-clicked on processor: ${processorType}`);

  // Wait for context menu to appear
  try {
    // Wait for any menu item to appear
    await page.waitForSelector(SELECTORS.CONTEXT_MENU_CONFIGURE, {
      timeout: timeout,
      state: 'visible'
    });

    // Get all menu items
    const menuItems = await page.locator(SELECTORS.CONTEXT_MENU_CONFIGURE).all();
    logMessage('info', `Found ${menuItems.length} menu items`);

    // Find the Configure option
    let configureOption = null;
    for (const item of menuItems) {
      const text = await item.textContent();
      if (text && text.trim().includes('Configure')) {
        configureOption = item;
        break;
      }
    }

    if (!configureOption) {
      logMessage('warn', `Configure option did not appear in context menu for processor: ${processorType}`);
      return false;
    }

    // Click on Configure option
    await configureOption.click();
    logMessage('info', 'Clicked on Configure option in context menu');
  } catch (error) {
    logMessage('error', `Error waiting for or clicking Configure option: ${error.message}`);
    return false;
  }

  // Wait for configuration dialog to appear
  await page.waitForTimeout(1000);

  // Check if configuration dialog appeared
  const configDialog = await page.$(SELECTORS.PROPERTIES_DIALOG);
  if (configDialog) {
    logMessage('success', `Configuration dialog opened for processor: ${processorType}`);
    return true;
  } else {
    logMessage('warn', `Configuration dialog did not appear for processor: ${processorType}`);
    return false;
  }
}

/**
 * Verify processor deployment and status
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} processorType - Processor type to verify
 * @param {Object} [options] - Verification options
 * @param {boolean} [options.checkVisibility=true] - Check if processor is visible
 * @param {boolean} [options.checkStatus=true] - Check processor status
 * @returns {Promise<Object>} Verification result
 */
export async function verifyProcessorDeployment(page, processorType, options = {}) {
  const { checkVisibility = true, checkStatus = true } = options;

  logMessage('info', `Verifying processor deployment: ${processorType}`);

  // Find the processor
  const processor = await findProcessor(page, processorType, { failIfNotFound: true });

  const verification = {
    found: !!processor,
    visible: false,
    status: 'unknown',
    details: {}
  };

  if (processor) {
    verification.visible = processor.isVisible;
    verification.details = {
      name: processor.name,
      id: processor.id,
      className: processor.className,
      position: processor.position
    };

    if (checkVisibility) {
      expect(processor.isVisible, `Processor ${processorType} should be visible`).toBeTruthy();
    }

    if (checkStatus) {
      // Extract status information from the processor text/attributes
      const statusInfo = await extractProcessorStatus(processor);
      verification.status = statusInfo.status;
      verification.details.statusInfo = statusInfo;
    }

    logMessage('success', `Processor deployment verified: ${processorType}`);
  }

  return verification;
}

/**
 * Extract processor status information from processor element
 * @param {Object} processor - Processor object
 * @returns {Promise<Object>} Status information
 */
async function extractProcessorStatus(processor) {
  const text = processor.name || '';
  const className = processor.className || '';

  // Basic status detection based on CSS classes and text content
  let status = 'unknown';

  if (className.includes('invalid')) {
    status = 'invalid';
  } else if (className.includes('running')) {
    status = 'running';
  } else if (className.includes('stopped')) {
    status = 'stopped';
  } else if (className.includes('disabled')) {
    status = 'disabled';
  } else if (className.includes('valid')) {
    status = 'valid';
  }

  return {
    status: status,
    hasWarnings: className.includes('warning') || className.includes('caution'),
    hasErrors: className.includes('error') || className.includes('invalid'),
    isPrimary: text.includes('Primary Node'),
    rawText: text,
    rawClassName: className
  };
}

/**
 * Find a JWT Token Authenticator processor on the canvas
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} [options] - Search options
 * @returns {Promise<Object|null>} Processor object or null if not found
 */
export async function findJwtTokenAuthenticator(page, options = {}) {
  return findProcessor(page, PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR, options);
}

/**
 * Find a Multi-Issuer JWT Token Authenticator processor on the canvas
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} [options] - Search options
 * @returns {Promise<Object|null>} Processor object or null if not found
 */
export async function findMultiIssuerJwtAuthenticator(page, options = {}) {
  return findProcessor(page, PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR, options);
}

/**
 * Verify JWT Token Authenticator deployment
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} [options] - Verification options
 * @returns {Promise<Object>} Verification result
 */
export async function verifyJwtTokenAuthenticatorDeployment(page, options = {}) {
  return verifyProcessorDeployment(page, PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR, options);
}

/**
 * Verify Multi-Issuer JWT Token Authenticator deployment
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} [options] - Verification options
 * @returns {Promise<Object>} Verification result
 */
export async function verifyMultiIssuerJwtAuthenticatorDeployment(page, options = {}) {
  return verifyProcessorDeployment(page, PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR, options);
}

/**
 * Open advanced menu for processor
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} processorObj - Processor object
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Menu options result
 */
async function openAdvancedMenu(page, processorObj, timeout) {
  await processorObj.element.click({ button: 'right' });
  logMessage('info', 'Right-clicked on processor to open context menu');

  await page.waitForSelector(SELECTORS.CONTEXT_MENU_CONFIGURE, {
    timeout: timeout,
    state: 'visible'
  });

  const menuItems = await page.locator(SELECTORS.CONTEXT_MENU_CONFIGURE).all();
  logMessage('info', `Found ${menuItems.length} menu items`);

  let advancedOption = null;
  for (const item of menuItems) {
    const text = await item.textContent();
    logMessage('debug', `Menu item text: "${text}"`);

    if (text && text.trim().includes('Advanced')) {
      advancedOption = item;
      logMessage('info', 'Found Advanced option in context menu');
      break;
    }
  }

  if (!advancedOption) {
    throw new Error('Advanced option did not appear in context menu');
  }

  await advancedOption.click();
  logMessage('info', 'Clicked on Advanced option in context menu');

  return { success: true };
}

/**
 * Wait for advanced view to load
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<Object>} Advanced view status
 */
async function waitForAdvancedView(page) {
  await page.waitForTimeout(1000);
  logMessage('info', 'Waiting for advanced view to appear after clicking Advanced option');

  // Check for navigation indicators
  const backLinks = await page.locator('a, button').all();
  let foundBackLink = false;

  for (const link of backLinks) {
    const text = await link.textContent();
    if (text && text.includes('Back to Processor')) {
      foundBackLink = true;
      break;
    }
  }

  if (foundBackLink) {
    logMessage('info', 'Found "Back to Processor" link, indicating navigation to different view');
  }

  return { foundBackLink };
}

/**
 * Extract page information after advanced menu click
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<Object>} Page information
 */
async function extractPageInfo(page) {
  logMessage('info', 'Analyzing page after clicking Advanced option');

  // Count UI elements
  const visibleDialogs = await page.locator('mat-dialog-container, [role="dialog"], .dialog, .modal').count();
  const visibleForms = await page.locator('form, .configuration-panel, .advanced-panel').count();
  const visibleFields = await page.locator('input, textarea, select, .property-field').count();

  logMessage('info', `Found ${visibleDialogs} dialogs, ${visibleForms} forms, ${visibleFields} fields`);

  // Extract text content
  const allText = await page.locator('body').textContent();
  const textElements = await page.locator('div, span, p, a, button').allTextContents();
  const filteredText = textElements
    .map(text => text.trim())
    .filter(text => text.length > 0 && text.length < 50);

  logMessage('info', `Found ${filteredText.length} text elements on the page`);
  if (filteredText.length > 0) {
    logMessage('info', `Text elements: ${filteredText.join(', ')}`);
  }

  return {
    visibleDialogs,
    visibleForms,
    visibleFields,
    allText,
    filteredText
  };
}

/**
 * Validate advanced view and detect loading states
 * @param {Object} pageInfo - Page information object
 * @returns {Object} Validation result
 */
function validateAdvancedView(pageInfo) {
  const { filteredText, allText } = pageInfo;

  // Check for loading screens
  const loadingTexts = ['Loading JWT Validator UI', 'Loading', 'Loading...', 'Please wait', 'JWT Validator'];
  const isLoadingScreen = filteredText.some(text =>
    loadingTexts.some(loadingText =>
      text.toLowerCase().includes(loadingText.toLowerCase())
    )
  );

  const fullTextLower = allText.toLowerCase();
  const hasLoadingInFullText = loadingTexts.some(text =>
    fullTextLower.includes(text.toLowerCase())
  );

  if (isLoadingScreen || hasLoadingInFullText) {
    const detectedText = isLoadingScreen
      ? filteredText.find(text => loadingTexts.some(loadingText => text.toLowerCase().includes(loadingText.toLowerCase())))
      : 'Loading text in page';

    logMessage('error', `Detected loading screen: "${detectedText}"`);
    return {
      success: false,
      propertyLabels: filteredText,
      message: 'Advanced view shows loading screen instead of configuration'
    };
  }

  // Check for configuration elements
  const hasConfigElements = filteredText.some(text =>
    text.includes('Configuration') ||
    text.includes('Properties') ||
    text.includes('Settings')
  );

  if (!hasConfigElements && filteredText.length < 15) {
    logMessage('error', 'No configuration elements found on page, likely still loading');
    return {
      success: false,
      propertyLabels: filteredText,
      message: 'Advanced view does not show expected configuration elements'
    };
  }

  const propertyLabels = filteredText.length > 0 ? filteredText : ['Advanced Configuration'];

  return {
    success: true,
    propertyLabels,
    message: 'Advanced view accessed successfully via Advanced menu option'
  };
}

/**
 * Take screenshot if requested
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {boolean} takeScreenshot - Whether to take screenshot
 * @returns {Promise<void>}
 */
async function captureScreenshot(page, takeScreenshot) {
  if (takeScreenshot) {
    try {
      const screenshotPath = `target/screenshots/Advanced.png`;
      await page.screenshot({ path: screenshotPath });
      logMessage('info', `Screenshot saved to ${screenshotPath}`);
    } catch (screenshotError) {
      logMessage('warn', `Failed to take screenshot: ${screenshotError.message}`);
    }
  }
}

/**
 * Open processor advanced configuration (Properties tab)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string|Object} processor - Processor type or processor object
 * @param {Object} [options] - Configuration options
 * @param {boolean} [options.takeScreenshot=false] - Take a screenshot of the advanced configuration
 * @param {boolean} [options.closeDialog=false] - Close the dialog after opening advanced configuration
 * @param {number} [options.timeout=5000] - Operation timeout in milliseconds
 * @returns {Promise<Object>} Result object with success status and property information
 */
export async function openProcessorAdvancedConfiguration(page, processor, options = {}) {
  const {
    takeScreenshot = false,
    closeDialog = false,
    timeout = TIMEOUTS.ACTION_COMPLETE
  } = options;

  const processorType = typeof processor === 'string' ? processor : processor.type;
  logMessage('info', `Opening advanced configuration for processor: ${processorType}`);

  // Verify we're on the main canvas
  await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });

  // If processor is a string (type), find it first
  let processorObj = processor;
  if (typeof processor === 'string') {
    processorObj = await findProcessor(page, processor, { failIfNotFound: true });
  }

  // Check if the processor element is valid
  if (!processorObj.element) {
    logMessage('error', `Processor element is null, cannot open advanced configuration: ${processorType}`);
    throw new Error(`Cannot open advanced configuration for processor with null element: ${processorType}`);
  }

  try {
    // Open advanced menu
    await openAdvancedMenu(page, processorObj, timeout);

    // Wait for advanced view to load
    await waitForAdvancedView(page);

    // Extract page information
    const pageInfo = await extractPageInfo(page);

    // Take screenshot if requested
    await captureScreenshot(page, takeScreenshot);

    // Validate advanced view
    return validateAdvancedView(pageInfo);
  } catch (error) {
    logMessage('error', `Error accessing advanced view: ${error.message}`);

    // Take screenshot even on error if requested
    await captureScreenshot(page, takeScreenshot);

    return {
      success: false,
      propertyLabels: ['Advanced Configuration'],
      message: `Error accessing advanced view: ${error.message}`
    };
  }
}

/**
 * Open processor configuration dialog (Configure option)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string|Object} processor - Processor type or processor object
 * @param {Object} [options] - Configuration options
 * @param {boolean} [options.takeScreenshot=false] - Take a screenshot of the configuration dialog
 * @param {boolean} [options.closeDialog=false] - Close the dialog after opening configuration
 * @param {boolean} [options.clickPropertiesTab=true] - Click on the Properties tab after opening configuration
 * @param {number} [options.timeout=5000] - Operation timeout in milliseconds
 * @returns {Promise<Object>} Result object with success status and property information
 */
export async function openProcessorConfigureDialog(page, processor, options = {}) {
  const {
    takeScreenshot = false,
    closeDialog = false,
    clickPropertiesTab = true,
    timeout = TIMEOUTS.ACTION_COMPLETE
  } = options;

  const processorType = typeof processor === 'string' ? processor : processor.type;
  logMessage('info', `Opening configuration dialog for processor: ${processorType}`);

  // Verify we're on the main canvas
  await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });

  // If processor is a string (type), find it first
  let processorObj = processor;
  if (typeof processor === 'string') {
    processorObj = await findProcessor(page, processor, { failIfNotFound: true });
  }

  // Check if the processor element is valid
  if (!processorObj.element) {
    logMessage('error', `Processor element is null, cannot open configuration dialog: ${processorType}`);
    throw new Error(`Cannot open configuration dialog for processor with null element: ${processorType}`);
  }

  // Right-click to open context menu
  await processorObj.element.click({ button: 'right' });
  logMessage('info', 'Right-clicked on processor to open context menu');

  // Wait for context menu to appear
  try {
    // Wait for any menu item to appear
    await page.waitForSelector(SELECTORS.CONTEXT_MENU_CONFIGURE, {
      timeout: timeout,
      state: 'visible'
    });

    // Get all menu items
    const menuItems = await page.locator(SELECTORS.CONTEXT_MENU_CONFIGURE).all();
    logMessage('info', `Found ${menuItems.length} menu items`);

    // Find the Configure option
    let configureOption = null;
    for (const item of menuItems) {
      const text = await item.textContent();
      if (text && text.trim().includes('Configure')) {
        configureOption = item;
        logMessage('info', 'Found Configure option in context menu');
        break;
      }
    }

    if (!configureOption) {
      logMessage('error', 'Configure option did not appear in context menu');
      return { success: false, message: 'Configure option did not appear in context menu' };
    }

    // Click on Configure option to open the configuration dialog
    await configureOption.click();
    logMessage('info', 'Clicked on Configure option in context menu');
  } catch (error) {
    logMessage('error', `Error waiting for or clicking Configure option: ${error.message}`);
    return { success: false, message: `Error waiting for or clicking Configure option: ${error.message}` };
  }

  // Wait for configuration dialog to appear
  try {
    const configDialog = await page.waitForSelector(SELECTORS.PROPERTIES_DIALOG, {
      timeout: timeout,
      state: 'visible'
    });

    if (!configDialog) {
      logMessage('error', 'Configuration dialog did not appear');
      return { success: false, message: 'Configuration dialog did not appear' };
    }

    logMessage('success', 'Configuration dialog is visible');

    // Click on the Properties tab if requested
    if (clickPropertiesTab) {
      try {
        // First approach: Try to find tab with exact text
        const tabs = await page.locator('mat-tab-label, .mat-tab-label, [role="tab"]').all();
        let propertiesTabFound = false;

        for (const tab of tabs) {
          const tabText = await tab.textContent();
          if (tabText && tabText.trim() === 'Properties') {
            await tab.click();
            logMessage('info', 'Clicked on Properties tab using exact text match');
            propertiesTabFound = true;
            break;
          }
        }

        // If Properties tab not found, try a more generic approach
        if (!propertiesTabFound) {
          // Try finding any element containing "Properties" text
          const elements = await page.locator('span, div, button').all();

          for (const element of elements) {
            const elementText = await element.textContent();
            if (elementText && elementText.includes('Properties')) {
              await element.click();
              logMessage('info', 'Clicked on Properties tab using partial text match');
              propertiesTabFound = true;
              break;
            }
          }

          // If still not found, try clicking the second tab (Properties is usually the second tab)
          if (!propertiesTabFound) {
            const secondTab = await page.locator('mat-tab-label, .mat-tab-label, [role="tab"]').nth(1);
            if (secondTab) {
              await secondTab.click();
              logMessage('info', 'Clicked on second tab (assuming it is Properties)');
              propertiesTabFound = true;
            }
          }
        }

        if (!propertiesTabFound) {
          logMessage('warn', 'Could not find Properties tab');
        }
      } catch (error) {
        logMessage('error', `Error clicking Properties tab: ${error.message}`);
      }
    }

    // Wait for property table to be visible
    try {
      await page.waitForSelector('table, .property-table, [role="table"], .table', {
        timeout: timeout,
        state: 'visible'
      });
      logMessage('success', 'Properties tab is active and property table is visible');
    } catch (error) {
      // If table not found, try looking for any property-related elements
      try {
        await page.waitForSelector('.property, [class*="property"], [id*="property"], .property-name, .property-value', {
          timeout: timeout / 2,
          state: 'visible'
        });
        logMessage('success', 'Properties tab is active and property elements are visible');
      } catch (secondError) {
        logMessage('warn', `Property elements not immediately visible: ${error.message}, ${secondError.message}`);
        // Continue anyway, as we might still want to take a screenshot
      }
    }

    // Take a screenshot of the configuration dialog if requested
    if (takeScreenshot) {
      const screenshotPath = `target/screenshots/Configure.png`;
      await page.screenshot({ path: screenshotPath });
      logMessage('info', `Screenshot saved to ${screenshotPath}`);
    }

    // Get property information from table cells
    let propertyLabels = [];
    try {
      // Try to get property names from table cells
      propertyLabels = await page.locator('table td:first-child, .property-name, [class*="property-name"], th:first-child').allTextContents();

      // If no property labels found, try a more generic approach
      if (!propertyLabels.length) {
        propertyLabels = await page.locator('.property-label, label, td, th').allTextContents();
      }

      // Filter out empty strings and trim whitespace
      propertyLabels = propertyLabels
        .map(label => label.trim())
        .filter(label => label.length > 0);

      logMessage('info', `Found ${propertyLabels.length} property labels: ${propertyLabels.join(', ')}`);
    } catch (error) {
      logMessage('warn', `Error getting property labels: ${error.message}`);
      propertyLabels = [];
    }

    // Close the dialog if requested
    if (closeDialog) {
      try {
        // First approach: Try to find buttons containing specific text
        const buttons = await page.locator('button').all();
        let closeButtonFound = false;

        for (const button of buttons) {
          const buttonText = await button.textContent();
          if (buttonText && (buttonText.includes('Cancel') || buttonText.includes('Close'))) {
            if (await button.isVisible()) {
              await button.click();
              logMessage('info', `Closed configuration dialog using button with text: ${buttonText}`);
              closeButtonFound = true;
              break;
            }
          }
        }

        // If no button was found and clicked
        if (!closeButtonFound) {
          logMessage('warn', 'Could not find a visible Cancel or Close button');

          // Try clicking the dialog backdrop as a fallback
          const backdrop = await page.locator('.mat-dialog-container, [role="dialog"]').first();
          if (backdrop) {
            // Try to click outside the dialog to close it
            await page.mouse.click(10, 10);
            logMessage('info', 'Attempted to close dialog by clicking outside');
          }
        }
      } catch (error) {
        logMessage('error', `Error closing dialog: ${error.message}`);
        return {
          success: true,
          dialogClosed: false,
          message: `Configuration dialog opened successfully but error closing dialog: ${error.message}`,
          propertyLabels
        };
      }
    }

    return {
      success: true,
      dialogClosed: closeDialog,
      propertyLabels,
      message: 'Configuration dialog opened successfully'
    };
  } catch (error) {
    logMessage('error', `Error accessing configuration dialog: ${error.message}`);

    // Even if there's an error, take a screenshot if requested
    if (takeScreenshot) {
      try {
        const screenshotPath = `target/screenshots/Configure.png`;
        await page.screenshot({ path: screenshotPath });
        logMessage('info', `Screenshot saved to ${screenshotPath} despite error`);
      } catch (screenshotError) {
        logMessage('warn', `Failed to take screenshot: ${screenshotError.message}`);
      }
    }

    // Return failure with error message
    return {
      success: false,
      propertyLabels: [],
      message: `Error accessing configuration dialog: ${error.message}`
    };
  }
}
