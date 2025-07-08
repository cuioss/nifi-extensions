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
 * Login helper with reliable direct form interaction
 * Performs login without session caching for maximum reliability
 * @param {string} [username='testUser'] - Username for authentication
 * @param {string} [password='drowssap'] - Password for authentication
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
    logMessage('info', `🔑 Performing login for user: ${username}`);

    // Navigate to login page using navigation helper
    cy.navigateToPage(PAGE_TYPES.LOGIN);

    // Perform login with reliable selectors
    cy.get('input[type="text"], input[id*="username"], input[name="username"]')
      .should('be.visible')
      .clear()
      .type(username);
    
    cy.get('input[type="password"], input[id*="password"], input[name="password"]')
      .should('be.visible')
      .clear()
      .type(password);
    
    cy.get('button:contains("Login"), input[value="Login"], button[type="submit"]')
      .should('be.visible')
      .click();

    // Wait for redirect and verify we're no longer on login page
    cy.url().should('not.contain', '#/login');
    cy.wait(2000); // Allow time for page to fully load

    logMessage('success', 'Login successful');
  }
);

/**
 * Ensure NiFi is ready for testing
 * Combines login and readiness checks in one command
 * This is the main function used by tests
 * @param {string} [username='testUser'] - Username for authentication
 * @param {string} [password='drowssap'] - Password for authentication
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

    // Check current URL to determine if we need to login
    cy.url().then((url) => {
      if (url.includes('#/login') || url === 'about:blank' || !url.includes('/nifi')) {
        // Need to login
        logMessage('info', 'Authentication required - performing login');
        cy.loginNiFi(username, password);
      } else {
        // Already on a NiFi page, verify we can access the canvas
        logMessage('info', 'Already on NiFi page - verifying canvas access');
        cy.get('body').then(($body) => {
          const hasCanvas = $body.find('mat-sidenav-content, #canvas-container, svg').length > 0;
          if (!hasCanvas) {
            // No canvas elements found, try to login
            logMessage('info', 'No canvas elements found - performing login');
            cy.loginNiFi(username, password);
          } else {
            logMessage('success', 'Canvas elements found - ready for testing');
          }
        });
      }
    });

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
 * Clear all authentication state and return to clean state
 * Use this when you need to guarantee a clean, unauthenticated state
 * @example
 * // Clear all authentication state
 * cy.clearSession();
 */
Cypress.Commands.add('clearSession', () => {
  logMessage('cleanup', 'Clearing all authentication state');

  // Clear all browser storage
  cy.clearAllCookies();
  cy.clearLocalStorage();
  cy.window().then((win) => {
    win.sessionStorage.clear();
  });

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
