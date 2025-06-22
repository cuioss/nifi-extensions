/**
 * Fail-fast plugin for Cypress tests
 * Provides additional mechanisms to prevent tests from hanging or taking too long
 */

/**
 * Plugin to add fail-fast behaviors
 * @param {object} on - Cypress plugin events
 * @param {object} config - Cypress configuration
 * @returns {object} - Modified Cypress configuration
 * @example
 * // In cypress.config.js setupNodeEvents:
 * const failFastPlugin = require('./cypress/plugins/fail-fast');
 * return failFastPlugin(on, config);
 */
function failFastPlugin(on, config) {
  // Track test start times to detect hanging tests
  const testStartTimes = new Map();

  // Maximum test duration (5 minutes) before force-failing
  const MAX_TEST_DURATION = 5 * 60 * 1000;

  on('task', {
    /**
     * Start tracking a test for timeout
     * @param {string} testTitle - The test title
     * @returns {null} - Always returns null as required by Cypress tasks
     * @example
     * cy.task('startTestTimeout', 'My Test Name');
     */
    startTestTimeout(testTitle) {
      testStartTimes.set(testTitle, Date.now());
      return null;
    },

    /**
     * Check if a test has exceeded maximum duration
     * @param {string} testTitle - The test title
     * @returns {boolean} - True if test should be failed
     * @example
     * cy.task('checkTestTimeout', 'My Test Name').then((shouldFail) => {
     *   if (shouldFail) throw new Error('Test timeout exceeded');
     * });
     */
    checkTestTimeout(testTitle) {
      const startTime = testStartTimes.get(testTitle);
      if (!startTime) {
        return false;
      }

      const duration = Date.now() - startTime;
      if (duration > MAX_TEST_DURATION) {
        // Log timeout for debugging - avoiding console.error for linting
        // eslint-disable-next-line no-console
        console.log(
          `🚨 Test "${testTitle}" exceeded maximum duration of ${MAX_TEST_DURATION}ms (actual: ${duration}ms)`
        );
        return true;
      }

      return false;
    },

    /**
     * Clean up test tracking
     * @param {string} testTitle - The test title
     * @returns {null} - Always returns null as required by Cypress tasks
     * @example
     * cy.task('endTestTimeout', 'My Test Name');
     */
    endTestTimeout(testTitle) {
      testStartTimes.delete(testTitle);
      return null;
    },

    /**
     * Force exit if too many failures
     * @param {number} failureCount - Number of failures
     * @returns {null} - Always returns null as required by Cypress tasks
     * @example
     * cy.task('checkFailureThreshold', 3);
     */
    checkFailureThreshold(failureCount) {
      const MAX_FAILURES = 3;
      if (failureCount >= MAX_FAILURES) {
        // Log failure threshold for debugging - avoiding console.error for linting
        // eslint-disable-next-line no-console
        console.log(
          `🚨 Maximum failure threshold reached (${failureCount}/${MAX_FAILURES}). Forcing exit.`
        );
        process.exit(1);
      }
      return null;
    },
  });

  // Set up process-level timeout as ultimate fail-safe
  const GLOBAL_TIMEOUT = 15 * 60 * 1000; // 15 minutes
  const globalTimer = setTimeout(() => {
    // Log global timeout for debugging - avoiding console.error for linting
    // eslint-disable-next-line no-console
    console.log(
      '🚨 Global timeout reached. Cypress tests have been running too long. Forcing exit.'
    );
    process.exit(1);
  }, GLOBAL_TIMEOUT);

  // Clear timeout on normal exit
  on('after:run', () => {
    clearTimeout(globalTimer);
  });

  return config;
}

module.exports = failFastPlugin;
