/**
 * Task 3: Enhanced Authentication Commands
 *
 * Robust authentication patterns with reduced complexity and improved reliability
 */

import {
  retryWithBackoff,
  verifyTestEnvironment,
  ensureTestIsolation,
  measureTestPerformance,
  robustElementSelect,
} from '../../utils/test-stability.js';

/**
 * Helper function to check login indicators
 * Task 3: Extracted from main function to reduce nesting
 */
function evaluateLoginIndicators(checks) {
  // Multiple strategies to determine login state
  const strategies = [
    checks.hasNifiApp && checks.hasAngularContent && !checks.hasLoginForm,
    checks.hasCanvas && !checks.hasLoginForm,
    checks.urlIndicatesLogin && !checks.hasLoginForm,
    (checks.hasUserDropdown || checks.hasToolbar) && !checks.hasLoginForm,
  ];

  for (let i = 0; i < strategies.length; i++) {
    if (strategies[i]) {
      return { loggedIn: true, strategy: `strategy-${i + 1}` };
    }
  }

  return { loggedIn: false, strategy: 'none' };
}

/**
 * Helper function to gather login state indicators
 * Task 3: Extracted to reduce complexity
 */
function gatherLoginIndicators($body, thorough = false) {
  const primaryChecks = {
    hasNifiApp: $body.find('nifi').length > 0,
    hasAngularContent: $body.find('nifi').children().length > 0,
    hasLoginForm: $body.find('input[type="password"], input[id$="password"]').length > 0,
    hasCanvas: $body.find('#canvas-container, .canvas, [data-testid*="canvas"]').length > 0,
    urlIndicatesLogin:
      window.location.href.includes('/nifi') && !window.location.href.includes('/login'),
  };

  if (thorough || (!primaryChecks.hasNifiApp && !primaryChecks.hasLoginForm)) {
    primaryChecks.hasUserDropdown =
      $body.find('[data-testid*="user"], .user-menu, #user-menu').length > 0;
    primaryChecks.hasToolbar = $body.find('.toolbar, .header, [data-testid*="toolbar"]').length > 0;
    primaryChecks.hasNavigationElements =
      $body.find('.navigation, .nav, [data-testid*="nav"]').length > 0;
  }

  return primaryChecks;
}

/**
 * Enhanced login state detection with Task 3 robust patterns
 */
Cypress.Commands.add('robustLoginStateCheck', (options = {}) => {
  const { timeout = 10000, thorough = false } = options;

  return measureTestPerformance('login-state-detection', () => {
    return cy.get('body', { timeout }).then(($body) => {
      const checks = gatherLoginIndicators($body, thorough);
      const result = evaluateLoginIndicators(checks);

      cy.log(
        `[RobustLogin] State: ${result.loggedIn ? 'LOGGED_IN' : 'NOT_LOGGED_IN'} (${result.strategy})`
      );
      cy.log(`[RobustLogin] Indicators: ${JSON.stringify(checks, null, 2)}`);

      return cy.wrap(result.loggedIn);
    });
  });
});

/**
 * Execute login strategy with error handling
 * Task 3: Extracted to reduce nesting
 */
function executeLoginStrategy(strategyIndex, strategies, resolve, reject) {
  if (strategyIndex >= strategies.length) {
    reject(new Error('All login strategies exhausted'));
    return;
  }

  strategies[strategyIndex]()
    .then((success) => {
      if (success) {
        cy.log(`[RobustLogin] Strategy ${strategyIndex + 1} succeeded`);
        resolve();
      } else {
        executeLoginStrategy(strategyIndex + 1, strategies, resolve, reject);
      }
    })
    .catch(() => {
      executeLoginStrategy(strategyIndex + 1, strategies, resolve, reject);
    });
}

/**
 * Create login strategies for different UI states
 * Task 3: Extracted to reduce complexity
 */
function createLoginStrategies(username, password) {
  return [
    // Strategy 1: Direct field input
    () => {
      cy.log('[LoginStrategy1] Direct field input...');
      const usernameSelectors = [
        'input[name="username"]',
        'input[id="username"]',
        'input[type="text"]',
        'input:first',
      ];
      const passwordSelectors = [
        'input[name="password"]',
        'input[id="password"]',
        'input[type="password"]',
      ];
      const buttonSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("Login")',
        '.login-button',
      ];

      return robustElementSelect(usernameSelectors, { description: 'username field' }).then(
        ($username) => {
          if (!$username) return false;
          cy.wrap($username).clear().type(username);

          return robustElementSelect(passwordSelectors, { description: 'password field' }).then(
            ($password) => {
              if (!$password) return false;
              cy.wrap($password).clear().type(password);

              return robustElementSelect(buttonSelectors, { description: 'login button' }).then(
                ($button) => {
                  if (!$button) return false;
                  cy.wrap($button).click();
                  return true;
                }
              );
            }
          );
        }
      );
    },

    // Strategy 2: Form-based approach
    () => {
      cy.log('[LoginStrategy2] Form-based approach...');
      return cy.get('body').then(($body) => {
        const $form = $body.find('form');
        if ($form.length === 0) return false;

        cy.wrap($form).within(() => {
          cy.get('input').first().type(username);
          cy.get('input[type="password"]').type(password);
          cy.get('button, input[type="submit"]').first().click();
        });
        return true;
      });
    },

    // Strategy 3: Angular components
    () => {
      cy.log('[LoginStrategy3] Angular component approach...');
      return cy.get('body').then(($body) => {
        if ($body.find('mat-form-field, .mat-form-field').length === 0) return false;

        cy.get('mat-form-field input, .mat-form-field input').first().type(username);
        cy.get(
          'mat-form-field input[type="password"], .mat-form-field input[type="password"]'
        ).type(password);
        cy.get('button[mat-raised-button], .mat-raised-button').click();
        return true;
      });
    },
  ];
}

/**
 * Robust login execution with multiple strategies
 * Task 3: Enhanced with better error handling and reduced nesting
 */
Cypress.Commands.add('executeRobustLogin', (options = {}) => {
  const { username, password, maxRetries = 3 } = options;

  const strategies = createLoginStrategies(username, password);

  return retryWithBackoff(
    () => {
      return cy.wrap(null).then(() => {
        return new Cypress.Promise((resolve, reject) => {
          executeLoginStrategy(0, strategies, resolve, reject);
        });
      });
    },
    {
      maxAttempts: maxRetries,
      initialDelay: 2000,
      description: 'robust login execution',
    }
  );
});

/**
 * Main enhanced authentication command
 * Task 3: Comprehensive authentication with simplified flow
 */
Cypress.Commands.add('enhancedAuthentication', (options = {}) => {
  const defaultOptions = {
    username: 'admin',
    password: 'adminadminadmin',
    maxRetries: 3,
    verifyEnvironment: true,
    isolateTests: true,
  };

  const opts = { ...defaultOptions, ...options };

  return measureTestPerformance('enhanced-authentication-flow', () => {
    cy.log('🔍 [Task3] Starting enhanced authentication...');

    // Step 1: Optional environment verification
    if (opts.verifyEnvironment) {
      cy.then(() => verifyTestEnvironment());
    }

    if (opts.isolateTests) {
      cy.then(() => ensureTestIsolation());
    }

    // Step 2: Check current authentication state
    return cy
      .then(() => cy.robustLoginStateCheck({ thorough: true }))
      .then((isLoggedIn) => {
        if (isLoggedIn) {
          cy.log('✅ [Task3] Already authenticated');
          return cy.verifyCanvasAccessible();
        } else {
          cy.log('🔑 [Task3] Authentication required');
          return cy
            .executeRobustLogin(opts)
            .then(() => cy.robustLoginStateCheck({ thorough: true }))
            .then((authSuccess) => {
              if (!authSuccess) {
                throw new Error('Authentication failed after login attempt');
              }
              return cy.verifyCanvasAccessible();
            });
        }
      })
      .then(() => {
        cy.log('✅ [Task3] Enhanced authentication complete');
        return cy.wrap(true);
      });
  });
});

export { evaluateLoginIndicators, gatherLoginIndicators, createLoginStrategies };
