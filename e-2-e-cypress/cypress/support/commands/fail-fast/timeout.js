/**
 * Fail-fast timeout commands for Cypress tests
 * These commands help prevent tests from hanging by implementing aggressive timeout behaviors
 */

/**
 * Start tracking test timeout
 * @param {string} testTitle - The test title for tracking
 */
Cypress.Commands.add('startTestTimer', (testTitle) => {
  cy.task('startTestTimeout', testTitle || Cypress.currentTest.title);
});

/**
 * Check if current test has exceeded timeout
 * @param {string} testTitle - The test title for tracking
 */
Cypress.Commands.add('checkTestTimer', (testTitle) => {
  cy.task('checkTestTimeout', testTitle || Cypress.currentTest.title).then((shouldFail) => {
    if (shouldFail) {
      throw new Error(`Test exceeded maximum duration and was terminated for fail-fast behavior`);
    }
  });
});

/**
 * End test timeout tracking
 * @param {string} testTitle - The test title for tracking
 */
Cypress.Commands.add('endTestTimer', (testTitle) => {
  cy.task('endTestTimeout', testTitle || Cypress.currentTest.title);
});

/**
 * Enhanced wait with timeout protection
 * Wraps cy.wait with automatic timeout checking
 * @param {number|string} aliasOrTime - Time to wait or alias to wait for
 * @param {object} options - Additional options
 */
Cypress.Commands.add('waitWithTimeout', (aliasOrTime, options = {}) => {
  const maxWait = options.timeout || 10000; // 10 second default

  // Set a reasonable timeout
  const timeoutOptions = {
    timeout: maxWait,
    ...options,
  };

  cy.wait(aliasOrTime, timeoutOptions);

  // Check if we should fail fast
  cy.checkTestTimer();
});

/**
 * Enhanced get with fail-fast behavior
 * @param {string} selector - CSS selector
 * @param {object} options - Additional options
 */
Cypress.Commands.add('getWithTimeout', (selector, options = {}) => {
  const maxTimeout = options.timeout || 8000; // 8 second default

  cy.get(selector, { timeout: maxTimeout, ...options });
  cy.checkTestTimer();
});

/**
 * Wait for element to be visible with fail-fast
 * @param {string} selector - CSS selector
 * @param {number} timeout - Maximum timeout in ms
 */
Cypress.Commands.add('waitForVisible', (selector, timeout = 5000) => {
  cy.get(selector, { timeout }).should('be.visible');
  cy.checkTestTimer();
});

/**
 * Wait for element to exist with fail-fast
 * @param {string} selector - CSS selector
 * @param {number} timeout - Maximum timeout in ms
 */
Cypress.Commands.add('waitForExist', (selector, timeout = 5000) => {
  cy.get(selector, { timeout }).should('exist');
  cy.checkTestTimer();
});

/**
 * Force fail a test if it takes too long
 * @param {string} reason - Reason for forced failure
 */
Cypress.Commands.add('forceFailTest', (reason = 'Test forced to fail for fail-fast behavior') => {
  throw new Error(reason);
});

/**
 * Conditional wait with maximum timeout
 * @param {Function} condition - Function that returns true when condition is met
 * @param {number} maxTimeout - Maximum time to wait in ms
 * @param {number} interval - Check interval in ms
 */
Cypress.Commands.add('waitUntilWithTimeout', (condition, maxTimeout = 10000, interval = 500) => {
  const startTime = Date.now();

  function checkCondition() {
    if (Date.now() - startTime > maxTimeout) {
      throw new Error(`Condition not met within ${maxTimeout}ms - failing fast`);
    }

    try {
      const result = condition();
      if (result) {
        return;
      }
    } catch {
      // Condition check failed, continue waiting
      // This is expected behavior when condition is not yet met
    }

    cy.wait(interval);
    cy.then(checkCondition);
  }

  cy.then(checkCondition);
  cy.checkTestTimer();
});
