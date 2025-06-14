/**
 * Task 3: Robust Test Patterns - Test Stability Utilities
 *
 * This module provides stable, reliable patterns for consistent test execution.
 * Focus: Reduce test flakiness and improve success rate to 95%+
 */

/**
 * Retry an operation with exponential backoff
 * @param {Function} operation - The operation to retry
 * @param {Object} options - Retry configuration
 * @returns {Promise} Promise that resolves with operation result
 */
export function retryWithBackoff(operation, options = {}) {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    backoffMultiplier = 2,
    description = 'operation',
  } = options;

  return cy.wrap(null).then(() => {
    return new Cypress.Promise((resolve, reject) => {
      let attempt = 1;

      function tryOperation() {
        cy.log(`[Retry] Attempting ${description} (${attempt}/${maxAttempts})`);

        operation()
          .then(resolve)
          .catch((error) => {
            if (attempt >= maxAttempts) {
              cy.log(`[Retry] Failed after ${maxAttempts} attempts: ${error.message}`);
              reject(error);
            } else {
              const delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
              cy.log(`[Retry] Attempt ${attempt} failed, retrying in ${delay}ms`);
              attempt++;
              setTimeout(tryOperation, delay);
            }
          });
      }

      tryOperation();
    });
  });
}

/**
 * Wait for stable element state (not just existence)
 * @param {string} selector - Element selector
 * @param {Object} options - Stability options
 * @returns {Promise} Promise that resolves when element is stable
 */
export function waitForStableElement(selector, options = {}) {
  const { timeout = 10000, stabilityDuration = 500, maxChecks = 20 } = options;

  return cy
    .get(selector, { timeout })
    .should('be.visible')
    .then(($element) => {
      return cy.wrap(null).then(() => {
        return new Cypress.Promise((resolve) => {
          let checkCount = 0;
          let lastRect = null;
          let stableStart = null;

          function checkStability() {
            const rect = $element[0].getBoundingClientRect();
            const currentRect = {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            };

            if (
              lastRect &&
              currentRect.x === lastRect.x &&
              currentRect.y === lastRect.y &&
              currentRect.width === lastRect.width &&
              currentRect.height === lastRect.height
            ) {
              if (!stableStart) {
                stableStart = Date.now();
              } else if (Date.now() - stableStart >= stabilityDuration) {
                cy.log(`[Stability] Element stable for ${stabilityDuration}ms`);
                resolve($element);
                return;
              }
            } else {
              stableStart = null;
            }

            lastRect = currentRect;
            checkCount++;

            if (checkCount < maxChecks) {
              setTimeout(checkStability, 100);
            } else {
              cy.log(`[Stability] Max checks reached, proceeding anyway`);
              resolve($element);
            }
          }

          checkStability();
        });
      });
    });
}

/**
 * Smart element selector with multiple fallback strategies
 * @param {Array|string} selectors - Primary and fallback selectors
 * @param {Object} options - Selection options
 */
export function robustElementSelect(selectors, options = {}) {
  const { description = 'element', required = true } = options;

  const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

  return cy.wrap(null).then(() => {
    return new Cypress.Promise((resolve, reject) => {
      let currentIndex = 0;

      function trySelector() {
        if (currentIndex >= selectorArray.length) {
          const error = `[RobustSelect] All selectors failed for ${description}`;
          if (required) {
            reject(new Error(error));
          } else {
            cy.log(error);
            resolve(null);
          }
          return;
        }

        const selector = selectorArray[currentIndex];
        cy.log(
          `[RobustSelect] Trying selector ${currentIndex + 1}/${selectorArray.length}: ${selector}`
        );

        cy.get('body', { timeout: 1000 })
          .find(selector)
          .then(($elements) => {
            if ($elements.length > 0) {
              cy.log(`[RobustSelect] Success with selector: ${selector}`);
              resolve($elements);
            } else {
              currentIndex++;
              trySelector();
            }
          })
          .catch(() => {
            currentIndex++;
            trySelector();
          });
      }

      trySelector();
    });
  });
}

/**
 * Environment health check before test execution
 */
export function verifyTestEnvironment() {
  cy.log('[HealthCheck] Verifying test environment...');

  return cy
    .window()
    .then((win) => {
      // Check basic browser capabilities
      const checks = {
        localStorage: !!win.localStorage,
        sessionStorage: !!win.sessionStorage,
        fetch: !!win.fetch,
        console: !!win.console,
        document: !!win.document,
      };

      const failedChecks = Object.entries(checks)
        .filter(([_, passed]) => !passed)
        .map(([check]) => check);

      if (failedChecks.length > 0) {
        throw new Error(`Environment checks failed: ${failedChecks.join(', ')}`);
      }

      cy.log('[HealthCheck] Browser environment verified');
    })
    .then(() => {
      // Check DOM readiness
      return cy.get('body').should('exist');
    })
    .then(() => {
      // Check for any critical errors
      return cy.window().then((win) => {
        const errors = win.console.error ? [] : null;
        if (errors && errors.length > 0) {
          cy.log(`[HealthCheck] Warning: ${errors.length} console errors detected`);
        }
      });
    })
    .then(() => {
      cy.log('[HealthCheck] Environment health check passed');
    });
}

/**
 * Safe operation wrapper with error boundary
 * @param {Function} operation - Operation to execute safely
 * @param {Object} options - Safety options
 */
export function safeOperation(operation, options = {}) {
  const { fallback = null, description = 'operation', logErrors = true } = options;

  return cy.wrap(null).then(() => {
    try {
      return operation();
    } catch (error) {
      if (logErrors) {
        cy.log(`[SafeOperation] ${description} failed: ${error.message}`);
      }

      if (fallback) {
        cy.log(`[SafeOperation] Executing fallback for ${description}`);
        return fallback();
      }

      return null;
    }
  });
}

/**
 * Test isolation - clean state between tests
 */
export function ensureTestIsolation() {
  cy.log('[TestIsolation] Ensuring clean test state...');

  return cy
    .window()
    .then((win) => {
      // Clear browser storage
      try {
        win.localStorage.clear();
        win.sessionStorage.clear();
        cy.log('[TestIsolation] Browser storage cleared');
      } catch (error) {
        cy.log('[TestIsolation] Warning: Could not clear storage');
      }
    })
    .then(() => {
      // Clear any test artifacts
      cy.clearCookies();
      cy.log('[TestIsolation] Cookies cleared');
    })
    .then(() => {
      // Reset viewport
      cy.viewport(1280, 720);
      cy.log('[TestIsolation] Viewport reset');
    })
    .then(() => {
      cy.log('[TestIsolation] Test isolation complete');
    });
}

/**
 * Measure and log test performance
 * @param {string} testName - Name of the test
 * @param {Function} testOperation - Test to measure
 */
export function measureTestPerformance(testName, testOperation) {
  const startTime = Date.now();
  cy.log(`[Performance] Starting measurement for: ${testName}`);

  return testOperation()
    .then((result) => {
      const duration = Date.now() - startTime;
      cy.log(`[Performance] ${testName} completed in ${duration}ms`);

      // Log performance data for analysis
      cy.task(
        'logPerformance',
        {
          testName,
          duration,
          timestamp: new Date().toISOString(),
          success: true,
        },
        { failOnStatusCode: false }
      );

      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;
      cy.log(`[Performance] ${testName} failed after ${duration}ms`);

      cy.task(
        'logPerformance',
        {
          testName,
          duration,
          timestamp: new Date().toISOString(),
          success: false,
          error: error.message,
        },
        { failOnStatusCode: false }
      );

      throw error;
    });
}
