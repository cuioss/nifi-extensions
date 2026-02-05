/**
 * @file Global Teardown - Playwright Global Teardown
 * Runs after all tests have completed
 * @version 2.0.0
 */

/**
 * Global teardown function that runs after all tests have completed
 */
async function globalTeardown() {
  console.log('🧹 Running global teardown...');
  console.log('✅ Global teardown completed');
}

export default globalTeardown;