/**
 * @file Global Teardown - Playwright Global Teardown
 * Runs after all tests have completed and saves ALL browser console logs
 * @version 2.0.0
 */

import {saveAllBrowserLogs} from '../utils/console-logger.js';

/**
 * Global teardown function that runs after all tests have completed
 */
async function globalTeardown() {
  console.log('🧹 Running global teardown...');

  try {
    // Save all browser console logs to accessible files
    const result = await saveAllBrowserLogs();
    if (result) {
      console.log(`📝 All browser console logs saved:`);
      console.log(`   📄 Text log: ${result.textLog}`);
      console.log(`   📋 JSON log: ${result.jsonLog}`);
      console.log(`   📊 Total entries: ${result.totalLogs}`);
    } else {
      console.log('📭 No browser console logs to save');
    }
  } catch (error) {
    console.error(`❌ Error saving browser console logs: ${error.message}`);
  }

  console.log('✅ Global teardown completed');
}

export default globalTeardown;