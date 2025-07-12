/**
 * @file Test Fixtures - Custom Playwright Test Fixtures
 * Provides custom test fixtures for enhanced testing capabilities
 * @version 1.0.0
 */

// Use ES modules for test files
import { test as base } from '@playwright/test';
import { saveTestLogs, saveAllLogs, getTestName, getTestFile } from './log-collector';
import path from 'path';

// Using ES modules only for consistency

/**
 * Enhanced test fixture with log collection
 */
// Start with the base test object
export const test = base;

// Add the page fixture to collect logs
test.extend({
  page: async ({ page }, use, testInfo) => {
    // Get test information
    const testName = getTestName(testInfo);
    const testFile = getTestFile(testInfo);

    // Use the page as normal
    await use(page);

    // After the test completes, save the logs
    try {
      const logFilePath = await saveTestLogs(testName, testFile);
      if (logFilePath) {
        console.log(`📝 Logs saved to: ${logFilePath}`);

        // Attach the log file to the test result for easier access in reports
        await testInfo.attach('test-logs', {
          path: logFilePath,
          contentType: 'text/plain',
        });
      }
    } catch (error) {
      console.error(`Error saving logs for test "${testName}": ${error.message}`);
    }
  },
});

/**
 * Save all logs after all tests have completed
 * @returns {Promise<void>}
 */
export async function saveAllTestLogs() {
  try {
    const logFilePath = await saveAllLogs();
    if (logFilePath) {
      console.log(`📝 All logs saved to: ${logFilePath}`);
    }
  } catch (error) {
    console.error(`Error saving all logs: ${error.message}`);
  }
}

/**
 * Get the current test name from the test info
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright test info
 * @returns {string} Test name with suite prefix
 */
export function getCurrentTestName(testInfo) {
  // Extract the suite name from the project name or file path
  let suiteName = '';
  if (testInfo.project.name) {
    suiteName = testInfo.project.name;
  } else if (testInfo.file) {
    suiteName = path.basename(testInfo.file, path.extname(testInfo.file));
  }

  // Combine suite name and test title
  return suiteName ? `${suiteName} - ${testInfo.title}` : testInfo.title;
}

// Export the original test object for cases where the enhanced version is not needed
export { base };
