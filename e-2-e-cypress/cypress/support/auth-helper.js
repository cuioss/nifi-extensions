/**
 * @file Authentication Helper - Simplified NiFi Session Management
 * Provides reliable login functionality using cy.session() and navigation-helper
 * Simplified and optimized for reliable NiFi processor testing
 * @version 1.0.0
 */

import { SELECTORS, PAGE_TYPES, DEFAULT_CREDENTIALS, SERVICE_URLS } from './constants';
import { logMessage, safeElementInteraction } from './utils';

/**
 * Check if NiFi service is accessible
 * @param {number} [timeout=5000] - Timeout for the check
 * @returns {Cypress.Chainable<boolean>} Promise resolving to accessibility status
 */
function checkNiFiAccessibility(timeout = 5000) {
  logMessage('info', 'Checking NiFi accessibility...');

  return cy
    .request({
      method: 'GET',
      url: SERVICE_URLS.NIFI_SYSTEM_DIAGNOSTICS,
      timeout: timeout,
      failOnStatusCode: false,
      retryOnStatusCodeFailure: false,
      retryOnNetworkFailure: false,
    })
    .then(
      (response) => {
        // Consider 401 Unauthorized as a valid indication that NiFi is accessible
        // This is because the endpoint requires authentication, which is expected
        const isAccessible = response && (
          (response.status >= 200 && response.status < 400) ||
          response.status === 401
        );

        if (isAccessible) {
          logMessage('success', 'NiFi service is accessible');
        } else {
          logMessage(
            'error',
            `NiFi service not accessible - Status: ${response ? response.status : 'unknown'}`
          );
        }
        return cy.wrap(isAccessible);
      },
      (error) => {
        logMessage(
          'error',
          `NiFi service not accessible - Network Error: ${error.message || 'Connection failed'}`
        );
        return cy.wrap(false);
      }
    );
}

/**
 * Check if Keycloak service is accessible
 * @param {number} [timeout=5000] - Timeout for the check
 * @returns {Cypress.Chainable<boolean>} Promise resolving to accessibility status
 */
function checkKeycloakAccessibility(timeout = 5000) {
  logMessage('info', 'Checking Keycloak accessibility...');

  // Try to access Keycloak health endpoint or realm info
  return cy
    .request({
      method: 'GET',
      url: SERVICE_URLS.KEYCLOAK_HEALTH,
      timeout: timeout,
      failOnStatusCode: false,
      retryOnStatusCodeFailure: false,
      retryOnNetworkFailure: false,
    })
    .then(
      (response) => {
        const isAccessible = response && response.status >= 200 && response.status < 400;
        if (isAccessible) {
          logMessage('success', 'Keycloak service is accessible');
        } else {
          logMessage(
            'error',
            `Keycloak service not accessible - Status: ${response ? response.status : 'unknown'}`
          );
        }
        return cy.wrap(isAccessible);
      },
      (error) => {
        logMessage(
          'error',
          `Keycloak service not accessible - Network Error: ${error.message || 'Connection failed'}`
        );
        return cy.wrap(false);
      }
    );
}

/**
 * Verify that both NiFi and Keycloak services are accessible
 * Fails fast if either service is not accessible
 * @param {number} [timeout=5000] - Timeout for each service check
 * @returns {Cypress.Chainable} Promise that resolves if both services are accessible
 */
function verifyServicesAccessibility(timeout = 5000) {
  logMessage('info', 'Verifying NiFi and Keycloak services accessibility...');

  return checkNiFiAccessibility(timeout).then((nifiAccessible) => {
    if (!nifiAccessible) {
      throw new Error(
        'NiFi service is not accessible. Please ensure NiFi container is running and healthy.'
      );
    }

    return checkKeycloakAccessibility(timeout).then((keycloakAccessible) => {
      if (!keycloakAccessible) {
        throw new Error(
          'Keycloak service is not accessible. Please ensure Keycloak container is running and healthy.'
        );
      }

      logMessage('success', 'Both NiFi and Keycloak services are accessible');
      return cy.wrap(true);
    });
  });
}

/**
 * Login helper using cy.session() for optimal performance
 * This creates a cached session that persists across tests
 * @param {string} [username='admin'] - Username for authentication
 * @param {string} [password='adminadminadmin'] - Password for authentication
 * @example
 * // Login with default credentials
 * cy.loginNiFi();
 *
 * // Login with custom credentials
 * cy.loginNiFi('testuser', 'testpass');
 */
Cypress.Commands.add(
  'loginNiFi',
  (username = DEFAULT_CREDENTIALS.USERNAME, password = DEFAULT_CREDENTIALS.PASSWORD) => {
    const sessionId = `nifi-session-${username}`;

    cy.session(
      sessionId,
      () => {
        logMessage('info', `🔑 Creating new session for user: ${username}`);

        // Navigate to login page using navigation helper
        cy.navigateToPage(PAGE_TYPES.LOGIN);

        // Verify we're on the login page
        cy.verifyPageType(PAGE_TYPES.LOGIN);

        // Perform login with robust selectors
        safeElementInteraction(SELECTORS.USERNAME_INPUT, 'type', username);
        safeElementInteraction(SELECTORS.PASSWORD_INPUT, 'type', password);
        safeElementInteraction(SELECTORS.LOGIN_BUTTON, 'click');

        // Wait for form submission and page redirect
        cy.wait(1000);

        // Wait for successful login and verify we're on the main canvas
        cy.waitForPageType(PAGE_TYPES.MAIN_CANVAS);
        
        // Additional wait to ensure canvas elements are fully loaded
        cy.wait(1000);
        
        // Final verification that we're in the right state
        cy.url().should('not.contain', '#/login');

        // Clear the session cleared flag since we're now authenticated
        cy.window().then((win) => {
          win.sessionStorage.removeItem('cypress-session-cleared');
        });

        logMessage('success', 'Login successful - session created');
      },
      {
        validate() {
          logMessage('info', 'Validating existing session...');

          // Check current URL first
          cy.url().then((url) => {
            // If we're on login page or about:blank, session is invalid
            if (url.includes('#/login') || url === 'about:blank') {
              throw new Error('Session validation failed - on login page or blank');
            }
            
            // If we're on a valid NiFi page, assume authentication is valid
            if (url.includes('/nifi') && !url.includes('#/login')) {
              logMessage('success', 'Session validation successful - valid NiFi URL');
              return;
            }
            
            // Use navigation helper to check if we're authenticated
            cy.getPageContext().then((context) => {
              if (!context.isAuthenticated || context.pageType === PAGE_TYPES.LOGIN) {
                throw new Error('Session validation failed - not authenticated');
              }
            });
          });

          logMessage('success', 'Session validation successful');
        },
        cacheAcrossSpecs: true,
      }
    );
  }
);

/**
 * Ensure NiFi is ready for testing
 * Combines login and readiness checks in one command
 * This is the main function used by tests
 * Verifies NiFi and Keycloak accessibility first and fails fast if they are not accessible
 * @param {string} [username='admin'] - Username for authentication
 * @param {string} [password='adminadminadmin'] - Password for authentication
 * @example
 * // Use in beforeEach for self-sufficient tests
 * beforeEach(() => {
 *   cy.ensureNiFiReady();
 * });
 */
Cypress.Commands.add(
  'ensureNiFiReady',
  (username = DEFAULT_CREDENTIALS.USERNAME, password = DEFAULT_CREDENTIALS.PASSWORD) => {
    logMessage('info', 'Ensuring NiFi is ready for testing...');

    // First, verify that both NiFi and Keycloak services are accessible - fail fast if not
    verifyServicesAccessibility().then(() => {
      // Services are accessible, proceed with authentication checks
      cy.getPageContext().then((context) => {
        if (
          context.isAuthenticated &&
          context.pageType === PAGE_TYPES.MAIN_CANVAS &&
          context.isReady
        ) {
          logMessage('success', 'Already authenticated and on main canvas - ready for testing');
          return;
        }

        if (context.pageType === PAGE_TYPES.LOGIN) {
          logMessage('info', 'On login page - performing authentication');
          cy.loginNiFi(username, password).then(() => {
            // After login completes, verify we're ready for testing
            cy.verifyPageType(PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });
            logMessage('success', 'NiFi is ready for testing');
          });
          return;
        }

        // If we're authenticated but not on main canvas, navigate there
        if (context.isAuthenticated && context.pageType !== PAGE_TYPES.MAIN_CANVAS) {
          logMessage('info', 'Authenticated but not on main canvas - navigating');
          cy.navigateToPage(PAGE_TYPES.MAIN_CANVAS).then(() => {
            // After navigation completes, verify we're ready for testing
            cy.verifyPageType(PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });
            logMessage('success', 'NiFi is ready for testing');
          });
          return;
        }

        // If page type is unknown (e.g., about:blank), navigate to login page first
        if (context.pageType === PAGE_TYPES.UNKNOWN) {
          logMessage('info', 'Unknown page type - navigating to login page');
          cy.navigateToPage(PAGE_TYPES.LOGIN).then(() => {
            cy.loginNiFi(username, password).then(() => {
              // After login completes, verify we're ready for testing
              cy.verifyPageType(PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });
              logMessage('success', 'NiFi is ready for testing');
            });
          });
          return;
        }

        // If we're not authenticated, perform login
        logMessage('info', 'Not authenticated - performing login');
        cy.loginNiFi(username, password).then(() => {
          // After login completes, verify we're ready for testing
          cy.verifyPageType(PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });
          logMessage('success', 'NiFi is ready for testing');
        });
      });
    });
  }
);

/**
 * Logout helper - clears the current session
 * @example
 * // Logout and clear all session data
 * cy.logoutNiFi();
 */
Cypress.Commands.add('logoutNiFi', () => {
  logMessage('info', 'Performing logout...');

  // Clear all session data
  cy.clearCookies();
  cy.clearLocalStorage();
  cy.clearAllSessionStorage();

  // Navigate to login page to verify logout
  cy.navigateToPage(PAGE_TYPES.LOGIN);
  cy.verifyPageType(PAGE_TYPES.LOGIN);

  logMessage('success', 'Logout successful - session cleared');
});

/**
 * Force clear all sessions and authentication state
 * Use this when you need to guarantee a clean, unauthenticated state
 * @param {string} [username='admin'] - Username to clear session for
 * @example
 * // Clear all authentication state
 * cy.clearSession();
 */
Cypress.Commands.add('clearSession', (username = DEFAULT_CREDENTIALS.USERNAME) => {
  logMessage('cleanup', `Force clearing session for user: ${username}`);

  // Clear all saved Cypress sessions
  cy.wrap(null).then(() => {
    if (Cypress.session && Cypress.session.clearAllSavedSessions) {
      Cypress.session.clearAllSavedSessions();
    }
  });

  // Clear all browser storage
  cy.clearCookies();
  cy.clearLocalStorage();
  cy.clearAllSessionStorage();

  // Set a flag to indicate session was explicitly cleared
  cy.window().then((win) => {
    win.sessionStorage.setItem('cypress-session-cleared', 'true');
  });

  // Navigate to login page to force logout
  cy.navigateToPage(PAGE_TYPES.LOGIN);
  cy.verifyPageType(PAGE_TYPES.LOGIN);

  logMessage('success', 'Session cleared completely');
});

/**
 * Get current session context and authentication state
 * @returns {Object} Session context with authentication information
 * @example
 * // Check current session state
 * cy.getSessionContext().then((session) => {
 *   if (session.isLoggedIn) {
 *     cy.log('User is authenticated');
 *   }
 * });
 */
Cypress.Commands.add('getSessionContext', () => {
  return cy.getPageContext().then((pageContext) => {
    return {
      isLoggedIn: pageContext.isAuthenticated,
      pageType: pageContext.pageType,
      isReady: pageContext.isReady,
      timestamp: new Date().toISOString(),
    };
  });
});
