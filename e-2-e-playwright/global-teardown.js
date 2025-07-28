/**
 * @file Global Teardown - Playwright Global Teardown
 * Runs after all tests have completed
 * Saves individual browser console logs for each test
 * @version 3.0.0
 */

import {globalConsoleLogger} from './utils/console-logger.js';

/**
 * Global teardown function that runs after all tests have completed
 */
async function globalTeardown() {
  console.log('Running global teardown...');

  try {
    // Save individual test logs
    const filepath = await globalConsoleLogger.saveAllLogs();

    if (filepath) {
      console.log(`📝 Saved all browser console logs to: ${filepath}`);
    } else {
      console.log('📝 No browser console logs captured during test run');
    }

  } catch (error) {
    console.error('❌ Error saving browser console logs:', error.message);
  }

  console.log('📋 View traces with: npx playwright show-trace <trace-file>');
  console.log('📊 View HTML report with: npx playwright show-report');
}

module.exports = globalTeardown;