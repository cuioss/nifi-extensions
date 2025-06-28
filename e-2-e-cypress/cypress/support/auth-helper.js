/**
 * @file Authentication Helper - Simplified NiFi Session Management
 * Provides reliable login functionality using cy.session() and navigation-helper
 * Simplified and optimized for reliable NiFi processor testing
 * @version 1.0.0
 */

import { SELECTORS, PAGE_TYPES, DEFAULT_CREDENTIALS } from './constants';
import { logMessage, safeElementInteraction } from './utils';

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

        // Clear the session cleared flag since we're now authenticated
        cy.window().then((win) => {
          win.sessionStorage.removeItem('cypress-session-cleared');
        });

        logMessage('success', 'Login successful - session created');
      },
      {
        validate() {
          logMessage('info', 'Validating existing session...');

          // Use navigation helper to check if we're authenticated
          cy.getPageContext().then((context) => {
            if (!context.isAuthenticated || context.pageType === PAGE_TYPES.LOGIN) {
              throw new Error('Session validation failed - not authenticated');
            }
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

    // First, try to get current page context
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
        cy.loginNiFi(username, password);
        return;
      }

      // If we're authenticated but not on main canvas, navigate there
      if (context.isAuthenticated && context.pageType !== PAGE_TYPES.MAIN_CANVAS) {
        logMessage('info', 'Authenticated but not on main canvas - navigating');
        cy.navigateToPage(PAGE_TYPES.MAIN_CANVAS);
        return;
      }

      // If we're not authenticated, perform login
      logMessage('info', 'Not authenticated - performing login');
      cy.loginNiFi(username, password);
    });

    // Final verification - ensure we're ready for testing
    cy.verifyPageType(PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });
    logMessage('success', 'NiFi is ready for testing');
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

/**
 * Intelligent session retrieval with options for session management
 * @param {string} [username='admin'] - Username for authentication
 * @param {string} [password='adminadminadmin'] - Password for authentication
 * @param {Object} [options={}] - Session management options
 * @param {boolean} [options.forceLogin=false] - Force a fresh login even if session exists
 * @param {boolean} [options.validateSession=false] - Validate existing session before proceeding
 * @example
 * // Force a fresh login
 * cy.retrieveSession('admin', 'adminadminadmin', { forceLogin: true });
 *
 * // Reuse existing session if available
 * cy.retrieveSession('admin', 'adminadminadmin');
 *
 * // Validate session persistence
 * cy.retrieveSession('admin', 'adminadminadmin', { validateSession: true });
 */
Cypress.Commands.add(
  'retrieveSession',
  (
    username = DEFAULT_CREDENTIALS.USERNAME,
    password = DEFAULT_CREDENTIALS.PASSWORD,
    options = {}
  ) => {
    const { forceLogin = false, validateSession = false } = options;

    logMessage('info', `Retrieving session for user: ${username}`);
    logMessage('info', `Options: forceLogin=${forceLogin}, validateSession=${validateSession}`);

    if (forceLogin) {
      logMessage('info', 'Force login requested - clearing existing session');
      cy.clearSession(username);
      cy.loginNiFi(username, password);
      cy.ensureNiFiReady(username, password);
      return;
    }

    if (validateSession) {
      logMessage('info', 'Validating existing session...');
      cy.getSessionContext().then((session) => {
        if (session.isLoggedIn && session.pageType === PAGE_TYPES.MAIN_CANVAS && session.isReady) {
          logMessage('success', 'Session validation successful - session is active and ready');
        } else {
          logMessage('warn', 'Session validation failed - performing fresh login');
          cy.loginNiFi(username, password);
        }
      });
      cy.ensureNiFiReady(username, password);
      return;
    }

    // Default behavior: use existing session if available, otherwise login
    logMessage('info', 'Using intelligent session management');
    cy.ensureNiFiReady(username, password);
  }
);
