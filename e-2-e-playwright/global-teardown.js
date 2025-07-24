/**
 * @file Global Teardown - Playwright Global Teardown
 * Runs after all tests have completed
 * Saves individual browser console logs for each test
 * @version 3.0.0
 */

import {saveAllBrowserLogs} from './utils/console-logger.js';

/**
 * Global teardown function that runs after all tests have completed
 */
async function globalTeardown() {
  console.log('Running global teardown...');

  try {
    // Save individual test logs
    const results = await saveAllBrowserLogs();

    if (results && results.length > 0) {
      console.log('📝 Saved individual browser console logs:');
      results.forEach(result => {
        console.log(`   🔍 Test: ${result.testId} (${result.totalLogs} logs)`);
        console.log(`      📄 Text: ${result.textLog}`);
        console.log(`      📋 JSON: ${result.jsonLog}`);
      });
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