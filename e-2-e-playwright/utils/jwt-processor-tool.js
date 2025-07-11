/**
 * @file JWT Processor Tool - NiFi JWT Processor Management
 * Provides reliable functions for adding and removing JWT processors
 * @version 1.0.0
 */

import { expect } from '@playwright/test';
import { PAGE_TYPES, PROCESSOR_TYPES, SELECTORS, TIMEOUTS } from './constants';
import { logMessage } from './login-tool';
import { verifyPageType } from './navigation-tool';
import {
    findProcessor,
    addProcessor,
    removeProcessor
} from './processor-tool';
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
 * Check if a JWT processor exists on the canvas
 * This function includes assertions that will fail the test if the check fails
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} processorType - JWT processor type to check for
 * @param {Object} [options] - Check options
 * @param {boolean} [options.failIfNotFound=false] - Fail if processor not found
 * @returns {Promise<boolean>} True if processor exists, false otherwise
 */
export async function checkJwtProcessorExists(page, processorType, options = {}) {
  const { failIfNotFound = false } = options;

  logMessage('info', `Checking if JWT processor exists: ${processorType}`);

  try {
    // Verify we're on the main canvas
    await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });

    // Take a screenshot before checking
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `before-check-${processorType}.png`) });

    // Check if the processor exists
    const processor = await findProcessor(page, processorType, { failIfNotFound: false });

    // Return true if processor exists, false otherwise
    const exists = !!processor;
    logMessage('info', `JWT processor ${processorType} ${exists ? 'exists' : 'does not exist'}`);

    // If processor not found and failIfNotFound is true, throw an error
    if (!exists && failIfNotFound) {
      throw new Error(`Processor not found: ${processorType}`);
    }

    return exists;
  } catch (error) {
    // Take a screenshot on error
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `check-processor-error-${processorType}.png`) });

    logMessage('error', `Error checking if JWT processor exists: ${error.message}`);

    if (failIfNotFound) {
      throw error;
    }

    return false;
  }
}

/**
 * Add a JWT Token Authenticator processor to the canvas
 * This function includes assertions that will fail the test if the addition fails
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} [options] - Addition options
 * @param {boolean} [options.skipIfExists=true] - Skip if processor already exists
 * @returns {Promise<Object>} Added processor object
 */
export async function addJwtTokenAuthenticator(page, options = {}) {
  const { skipIfExists = true } = options;

  logMessage('info', `Adding JWT Token Authenticator processor`);

  try {
    // Check if processor already exists
    if (skipIfExists) {
      const exists = await checkJwtProcessorExists(page, PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR);
      if (exists) {
        logMessage('info', `JWT Token Authenticator already exists, skipping addition`);
        return await findProcessor(page, PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR);
      }
    }

    // Add the processor
    return await addProcessor(page, PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR, options);
  } catch (error) {
    logMessage('error', `Error adding JWT Token Authenticator: ${error.message}`);
    throw error;
  }
}

/**
 * Add a Multi-Issuer JWT Token Authenticator processor to the canvas
 * This function includes assertions that will fail the test if the addition fails
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} [options] - Addition options
 * @param {boolean} [options.skipIfExists=true] - Skip if processor already exists
 * @returns {Promise<Object>} Added processor object
 */
export async function addMultiIssuerJwtAuthenticator(page, options = {}) {
  const { skipIfExists = true } = options;

  logMessage('info', `Adding Multi-Issuer JWT Token Authenticator processor`);

  try {
    // Check if processor already exists
    if (skipIfExists) {
      const exists = await checkJwtProcessorExists(page, PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR);
      if (exists) {
        logMessage('info', `Multi-Issuer JWT Token Authenticator already exists, skipping addition`);
        return await findProcessor(page, PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR);
      }
    }

    // Add the processor
    return await addProcessor(page, PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR, options);
  } catch (error) {
    logMessage('error', `Error adding Multi-Issuer JWT Token Authenticator: ${error.message}`);
    throw error;
  }
}

/**
 * Remove a JWT Token Authenticator processor from the canvas
 * This function includes assertions that will fail the test if the removal fails
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} [options] - Removal options
 * @param {boolean} [options.failIfNotFound=false] - Fail if processor not found
 * @returns {Promise<boolean>} Success status
 */
export async function removeJwtTokenAuthenticator(page, options = {}) {
  const { failIfNotFound = false } = options;

  logMessage('info', `Removing JWT Token Authenticator processor`);

  try {
    // Check if processor exists
    const exists = await checkJwtProcessorExists(page, PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR, { failIfNotFound });
    if (!exists) {
      logMessage('info', `JWT Token Authenticator does not exist, skipping removal`);
      return true;
    }

    // Remove the processor
    return await removeProcessor(page, PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR, options);
  } catch (error) {
    logMessage('error', `Error removing JWT Token Authenticator: ${error.message}`);
    throw error;
  }
}

/**
 * Remove a Multi-Issuer JWT Token Authenticator processor from the canvas
 * This function includes assertions that will fail the test if the removal fails
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} [options] - Removal options
 * @param {boolean} [options.failIfNotFound=false] - Fail if processor not found
 * @returns {Promise<boolean>} Success status
 */
export async function removeMultiIssuerJwtAuthenticator(page, options = {}) {
  const { failIfNotFound = false } = options;

  logMessage('info', `Removing Multi-Issuer JWT Token Authenticator processor`);

  try {
    // Check if processor exists
    const exists = await checkJwtProcessorExists(page, PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR, { failIfNotFound });
    if (!exists) {
      logMessage('info', `Multi-Issuer JWT Token Authenticator does not exist, skipping removal`);
      return true;
    }

    // Remove the processor
    return await removeProcessor(page, PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR, options);
  } catch (error) {
    logMessage('error', `Error removing Multi-Issuer JWT Token Authenticator: ${error.message}`);
    throw error;
  }
}
