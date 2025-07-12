/**
 * @file Global Teardown - Playwright Global Teardown
 * Runs after all tests have completed
 * @version 1.0.0
 */

const { saveAllLogs } = require('./utils/log-collector');

/**
 * Global teardown function that runs after all tests have completed
 */
async function globalTeardown() {
  console.log('Running global teardown...');

  try {
    // Save all logs to a file
    const logFilePath = await saveAllLogs();
    if (logFilePath) {
      console.log(`📝 All logs saved to: ${logFilePath}`);
    } else {
      console.log('No logs to save');
    }
  } catch (error) {
    console.error(`Error saving logs: ${error.message}`);
  }
}

module.exports = globalTeardown;