/**
 * Custom commands related to login functionality
 *
 * Task 3: Robust Login Pattern Implementation:
 * - Stable authentication with state detection and fallback strategies
 * - Error recovery and retry mechanisms with exponential backoff
 * - Environment health verification before authentication
 * - Performance monitoring and optimization
 * - Graceful degradation for UI changes
 */

import {
  retryWithBackoff,
  verifyTestEnvironment,
  ensureTestIsolation,
  measureTestPerformance,
  robustElementSelect,
} from '../../utils/test-stability.js';

/**
 * Enhanced login state detection with robust patterns
 * Task 3: Multiple detection strategies with fallback mechanisms
 */
Cypress.Commands.add('isLoggedIn', (options = {}) => {
  const { timeout = 10000, thorough = false } = options;

  return cy.wrap(null).then(() => {
    return measureTestPerformance('login-state-detection', () => {
      return cy.get('body', { timeout }).then(($body) => {
        // Primary indicators (fast checks)
        const primaryChecks = {
          hasNifiApp: $body.find('nifi').length > 0,
          hasAngularContent: $body.find('nifi').children().length > 0,
          hasLoginForm: $body.find('input[type="password"], input[id$="password"]').length > 0,
          hasCanvas: $body.find('#canvas-container, .canvas, [data-testid*="canvas"]').length > 0,
        };

        // If thorough check requested or primary indicators are ambiguous
        if (thorough || (!primaryChecks.hasNifiApp && !primaryChecks.hasLoginForm)) {
          const thoroughChecks = {
            hasUserDropdown: $body.find('[data-testid*="user"], .user-menu, #user-menu').length > 0,
            hasToolbar: $body.find('.toolbar, .header, [data-testid*="toolbar"]').length > 0,
            hasNavigationElements: $body.find('.navigation, .nav, [data-testid*="nav"]').length > 0,
            urlIndicatesLogin:
              window.location.href.includes('/nifi') && !window.location.href.includes('/login'),
          };

          Object.assign(primaryChecks, thoroughChecks);
        }

        // Logical determination with multiple fallback strategies
        const loginStrategies = [
          // Strategy 1: Standard Angular app detection
          () =>
            primaryChecks.hasNifiApp &&
            primaryChecks.hasAngularContent &&
            !primaryChecks.hasLoginForm,

          // Strategy 2: Canvas-based detection (fallback for UI changes)
          () => primaryChecks.hasCanvas && !primaryChecks.hasLoginForm,

          // Strategy 3: URL-based detection (fallback for major UI changes)
          () => primaryChecks.urlIndicatesLogin && !primaryChecks.hasLoginForm,

          // Strategy 4: Presence of authenticated UI elements
          () =>
            (primaryChecks.hasUserDropdown || primaryChecks.hasToolbar) &&
            !primaryChecks.hasLoginForm,
        ];

        let loggedIn = false;
        let strategy = 'unknown';

        for (let i = 0; i < loginStrategies.length; i++) {
          if (loginStrategies[i]()) {
            loggedIn = true;
            strategy = `strategy-${i + 1}`;
            break;
          }
        }

        cy.log(`[LoginDetection] State: ${loggedIn ? 'LOGGED_IN' : 'NOT_LOGGED_IN'} (${strategy})`);
        cy.log(`[LoginDetection] Indicators: ${JSON.stringify(primaryChecks, null, 2)}`);

        return cy.wrap(loggedIn);
      });
    });
  });
});

/**
 * Robust authentication command with enhanced stability patterns
 * Task 3: Comprehensive authentication with fallback strategies and error recovery
 */
Cypress.Commands.add('ensureAuthenticatedAndReady', (options = {}) => {
  const defaultOptions = {
    username: 'admin',
    password: 'adminadminadmin',
    maxRetries: 3,
    timeout: 30000,
    verifyEnvironment: true,
    isolateTests: true,
  };

  const opts = { ...defaultOptions, ...options };

  return cy.wrap(null).then(() => {
    return measureTestPerformance('authentication-flow', () => {
      cy.log('🔍 [Task3] Ensuring authenticated and ready for testing...');

      // Step 0: Environment verification (Task 3 enhancement)
      if (opts.verifyEnvironment) {
        cy.then(() => verifyTestEnvironment());
      }

      if (opts.isolateTests) {
        cy.then(() => ensureTestIsolation());
      }

      return cy
        .then(() => {
          // Step 1: Enhanced state detection with retry mechanism
          return retryWithBackoff(() => cy.isLoggedIn({ thorough: true }), {
            maxAttempts: 2,
            initialDelay: 1000,
            description: 'login state detection',
          });
        })
        .then((loggedIn) => {
          if (loggedIn) {
            cy.log('✅ [Task3] Already authenticated, verifying readiness...');
            return cy.verifyCanvasAccessible();
          } else {
            cy.log('🔑 [Task3] Not authenticated, initiating robust login...');
            return cy.performRobustLogin(opts);
          }
        })
        .then(() => {
          // Final verification with enhanced patterns
          return cy.verifyAuthenticationComplete();
        });
    });
  });
});

/**
 * Perform robust login with multiple strategies and error recovery
 * Task 3: Enhanced login process with graceful degradation
 */
Cypress.Commands.add('performRobustLogin', (options = {}) => {
  const { username, password, maxRetries } = options;

  // Multiple login strategies for different UI states
  const loginStrategies = [
    // Strategy 1: Direct field input (most common)
    () => {
      cy.log('[LoginStrategy1] Using direct field input...');
      return robustElementSelect(
        ['input[name="username"]', 'input[id="username"]', 'input[type="text"]', 'input:first'],
        { description: 'username field' }
      ).then(($usernameField) => {
        if ($usernameField) {
          cy.wrap($usernameField).clear().type(username);

          return robustElementSelect(
            ['input[name="password"]', 'input[id="password"]', 'input[type="password"]'],
            { description: 'password field' }
          ).then(($passwordField) => {
            if ($passwordField) {
              cy.wrap($passwordField).clear().type(password);

              return robustElementSelect(
                [
                  'button[type="submit"]',
                  'input[type="submit"]',
                  'button:contains("Login")',
                  'button:contains("Sign")',
                  '.login-button',
                ],
                { description: 'login button' }
              ).then(($loginButton) => {
                if ($loginButton) {
                  cy.wrap($loginButton).click();
                  return true;
                }
                return false;
              });
            }
            return false;
          });
        }
        return false;
      });
    },

    // Strategy 2: Form-based approach (fallback)
    () => {
      cy.log('[LoginStrategy2] Using form-based approach...');
      return cy.get('body').then(($body) => {
        const $form = $body.find('form');
        if ($form.length > 0) {
          cy.wrap($form).within(() => {
            cy.get('input').first().type(username);
            cy.get('input[type="password"]').type(password);
            cy.get('button, input[type="submit"]').first().click();
          });
          return true;
        }
        return false;
      });
    },

    // Strategy 3: Angular component approach (modern UI fallback)
    () => {
      cy.log('[LoginStrategy3] Using Angular component approach...');
      return cy.get('body').then(($body) => {
        if ($body.find('mat-form-field, .mat-form-field').length > 0) {
          cy.get('mat-form-field input, .mat-form-field input').first().type(username);
          cy.get(
            'mat-form-field input[type="password"], .mat-form-field input[type="password"]'
          ).type(password);
          cy.get('button[mat-raised-button], .mat-raised-button').click();
          return true;
        }
        return false;
      });
    },
  ];

  return retryWithBackoff(
    () => {
      // Try each login strategy until one succeeds
      return cy.wrap(null).then(() => {
        return new Cypress.Promise((resolve, reject) => {
          let currentStrategy = 0;

          function tryNextStrategy() {
            if (currentStrategy >= loginStrategies.length) {
              reject(new Error('All login strategies failed'));
              return;
            }

            loginStrategies[currentStrategy]()
              .then((success) => {
                if (success) {
                  cy.log(`[RobustLogin] Strategy ${currentStrategy + 1} succeeded`);
                  resolve();
                } else {
                  currentStrategy++;
                  tryNextStrategy();
                }
              })
              .catch(() => {
                currentStrategy++;
                tryNextStrategy();
              });
          }

          tryNextStrategy();
        });
      });
    },
    {
      maxAttempts: maxRetries,
      initialDelay: 2000,
      description: 'robust login process',
    }
  );
});

/**
 * Verify authentication completion with enhanced checks
 * Task 3: Comprehensive verification with multiple indicators
 */
Cypress.Commands.add('verifyAuthenticationComplete', () => {
  cy.log('[Task3] Verifying authentication completion...');

  // Wait for authentication to complete with multiple indicators
  return cy
    .wrap(null)
    .then(() => {
      // Check for successful login indicators
      return retryWithBackoff(
        () => {
          return cy.isLoggedIn({ thorough: true }).then((loggedIn) => {
            if (!loggedIn) {
              throw new Error('Authentication verification failed');
            }
            return loggedIn;
          });
        },
        {
          maxAttempts: 5,
          initialDelay: 1000,
          description: 'authentication completion verification',
        }
      );
    })
    .then(() => {
      cy.log('✅ [Task3] Authentication verified successfully');
      return cy.wrap(true);
    });
});
