/**
 * @file Global Teardown - Playwright Global Teardown
 * Runs after all tests have completed
 * Browser logs are now handled automatically by Playwright's trace viewer
 * @version 2.0.0
 */

/**
 * Global teardown function that runs after all tests have completed
 */
async function globalTeardown() {
  console.log('Running global teardown...');
  console.log('📝 Browser logs and traces are automatically captured by Playwright');
  console.log('📋 View traces with: npx playwright show-trace <trace-file>');
  console.log('📊 View HTML report with: npx playwright show-report');
}

module.exports = globalTeardown;