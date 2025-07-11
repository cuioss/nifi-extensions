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

  logMessage('info', `Searching for processor: ${processorType}`);

  // Verify we're on the main canvas
  await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });

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
          // Use flexible matching to improve reliability
          const matchesText = text && text.toLowerCase().includes(processorType.toLowerCase());
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
              isVisible: !!boundingBox,
              className: className,
              title: title,
              dataType: dataType
            };

            logMessage('success', `Found processor: ${processorType}`);
            logMessage('info', `Processor details: name="${text}", id="${id}", class="${className}", visible=${!!boundingBox}`);
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
    throw new Error(`Processor not found: ${processorType}`);
  }

  logMessage('info', `Processor not found: ${processorType}`);
  return null;
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

  // Double-click on the processor to open configuration
  await processorObj.element.dblclick();
  logMessage('info', `Double-clicked on processor: ${processorType}`);

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