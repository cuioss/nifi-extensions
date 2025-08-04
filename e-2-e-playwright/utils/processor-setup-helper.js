/**
 * @fileoverview Helper utility to integrate ProcessorApiManager into existing tests
 * This provides a simple way to ensure the MultiIssuerJWTTokenAuthenticator is on the canvas
 * before running tests that depend on it.
 */

import { ProcessorApiManager } from './processor-api-manager.js';
import { processorLogger } from './shared-logger.js';

/**
 * Setup helper to ensure MultiIssuerJWTTokenAuthenticator is on canvas
 * This should be called in test beforeEach or beforeAll hooks
 * 
 * @param {Page} page - Playwright page object
 * @param {Object} options - Configuration options
 * @param {boolean} options.removeFirst - Remove existing processor before adding (default: false)
 * @param {Object} options.position - Position for new processor (default: {x: 400, y: 200})
 * @returns {Promise<boolean>} True if processor is ready on canvas
 */
export async function setupMultiIssuerJWTAuthenticator(page, options = {}) {
  const { 
    removeFirst = false, 
    position = { x: 400, y: 200 } 
  } = options;

  processorLogger.info('Setting up MultiIssuerJWTTokenAuthenticator on canvas...');
  
  const manager = new ProcessorApiManager(page);

  try {
    // First check if the processor type is deployed
    const isDeployed = await manager.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();
    
    if (!isDeployed) {
      processorLogger.error('MultiIssuerJWTTokenAuthenticator is not deployed in NiFi');
      processorLogger.error('Please ensure the processor NAR file is properly installed');
      return false;
    }

    // Remove existing processor if requested
    if (removeFirst) {
      processorLogger.info('Removing existing processor from canvas...');
      await manager.removeMultiIssuerJWTTokenAuthenticatorFromCanvas();
    }

    // Ensure processor is on canvas
    const result = await manager.ensureProcessorOnCanvas();
    
    if (result) {
      processorLogger.success('MultiIssuerJWTTokenAuthenticator is ready on canvas');
      
      // Verify it's actually there
      const verification = await manager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
      if (verification.exists) {
        processorLogger.info(`Processor confirmed with ID: ${verification.processor.id}`);
        return true;
      }
    }

    processorLogger.error('Failed to setup MultiIssuerJWTTokenAuthenticator on canvas');
    return false;

  } catch (error) {
    processorLogger.error('Error during processor setup:', error.message);
    return false;
  }
}

/**
 * Cleanup helper to remove processor from canvas after tests
 * This should be called in test afterEach or afterAll hooks if needed
 * 
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} True if processor was removed or wasn't present
 */
export async function cleanupMultiIssuerJWTAuthenticator(page) {
  processorLogger.info('Cleaning up MultiIssuerJWTTokenAuthenticator from canvas...');
  
  const manager = new ProcessorApiManager(page);

  try {
    const removed = await manager.removeMultiIssuerJWTTokenAuthenticatorFromCanvas();
    
    if (removed) {
      processorLogger.success('Processor removed from canvas');
    } else {
      processorLogger.info('Processor was not on canvas or could not be removed');
    }
    
    return removed;

  } catch (error) {
    processorLogger.error('Error during processor cleanup:', error.message);
    return false;
  }
}

/**
 * Verify processor is properly configured and running
 * 
 * @param {Page} page - Playwright page object
 * @returns {Promise<Object>} Status object with details
 */
export async function verifyProcessorStatus(page) {
  const manager = new ProcessorApiManager(page);

  try {
    const { exists, processor } = await manager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
    
    if (!exists) {
      return {
        success: false,
        message: 'Processor not found on canvas',
        processor: null
      };
    }

    // Get detailed processor information
    const details = await manager.getProcessorDetails(processor.id);
    
    return {
      success: true,
      message: 'Processor found and verified',
      processor: processor,
      details: details,
      status: processor.status || details?.status
    };

  } catch (error) {
    return {
      success: false,
      message: `Error verifying processor: ${error.message}`,
      processor: null
    };
  }
}

/**
 * Example usage in tests:
 * 
 * test.beforeEach(async ({ page }) => {
 *   // Ensure processor is on canvas before test
 *   const ready = await setupMultiIssuerJWTAuthenticator(page);
 *   if (!ready) {
 *     test.skip('Processor could not be setup');
 *   }
 * });
 * 
 * test.afterEach(async ({ page }) => {
 *   // Optional: Clean up after test
 *   await cleanupMultiIssuerJWTAuthenticator(page);
 * });
 */