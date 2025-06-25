/**
 * Authentication utility functions for NiFi E2E tests
 * Provides robust authentication helpers following requirements from Requirements.md
 */

/**
 * Enhanced login helper with comprehensive state validation
 * @param {Object} options - Login configuration options
 * @param {boolean} options.verifyFullWorkflow - Whether to verify complete user workflow (default: true)
 * @param {number} options.timeout - Login timeout in milliseconds (default: 30000)
 * @param {boolean} options.failOnConsoleErrors - Whether to fail on console errors during login (default: true)
 * @returns {Cypress.Chainable} Cypress chainable for further commands
 */
export function performLogin(options = {}) {
  const { verifyFullWorkflow = true, timeout = 30000, failOnConsoleErrors = true } = options;

  cy.log('🔐 Starting enhanced login process');

  // Clear any existing console errors
  if (failOnConsoleErrors) {
    cy.clearConsoleErrors();
  }

  // Perform login using existing command
  cy.nifiLogin({ timeout });

  // Verify login state with deep validation
  if (verifyFullWorkflow) {
    verifyCompleteLoginWorkflow();
  }

  // Check for console errors during login
  if (failOnConsoleErrors) {
    cy.checkConsoleErrors('Login process should not generate console errors');
  }

  return cy.wrap(null);
}

/**
 * Verify complete login workflow beyond just element presence
 * Tests actual functionality to prevent false positives
 */
export function verifyCompleteLoginWorkflow() {
  cy.log('🔍 Verifying complete login workflow functionality');

  // Verify logged-in state
  cy.verifyLoggedIn();

  // Verify canvas accessibility and interaction
  cy.get('#canvas-container', { timeout: 15000 }).should('be.visible').and('be.enabled');

  // Verify toolbar accessibility
  cy.get('#toolbar', { timeout: 10000 })
    .should('be.visible')
    .find('button')
    .should('have.length.greaterThan', 0);

  // Verify right-click context menu functionality (quick canvas interaction test)
  cy.get('#canvas-container').rightclick({ force: true });

  // Verify context menu appears (actual UI interaction)
  cy.get('#context-menu, .context-menu', { timeout: 5000 }).should('be.visible');

  // Close context menu
  cy.get('body').click();

  cy.log('✅ Complete login workflow verified - user has full UI access');
}

/**
 * Verify anonymous access mode functions correctly
 * @param {Object} options - Verification options
 */
export function verifyAnonymousAccess(options = {}) {
  const { expectNoLogin = true } = options;

  cy.log('🔓 Verifying anonymous access mode');

  if (expectNoLogin) {
    // In anonymous mode, should not see login prompts
    cy.get('body').should('not.contain', 'Login');
    cy.get('body').should('not.contain', 'Username');
    cy.get('body').should('not.contain', 'Password');
  }

  // Verify canvas is accessible
  cy.get('#canvas-container', { timeout: 15000 }).should('be.visible');

  cy.log('✅ Anonymous access verified');
}

/**
 * Detect current authentication state
 * @returns {Cypress.Chainable<string>} Authentication state: 'logged-in', 'logged-out', 'anonymous'
 */
export function detectAuthState() {
  return cy.get('body').then(($body) => {
    // Check for login form elements
    if ($body.find('input[name="username"], input[name="password"]').length > 0) {
      return 'logged-out';
    }

    // Check for user menu or logged-in indicators
    if ($body.find('#user-menu, .user-info, .logout-button').length > 0) {
      return 'logged-in';
    }

    // If canvas is visible without login elements, likely anonymous
    if ($body.find('#canvas-container').length > 0) {
      return 'anonymous';
    }

    return 'unknown';
  });
}

/**
 * Verify user has appropriate permissions for processor configuration
 * @param {Object} options - Permission verification options
 */
export function verifyProcessorPermissions(options = {}) {
  const { timeout = 10000 } = options;

  cy.log('🔑 Verifying processor configuration permissions');

  // Test ability to access processor palette
  cy.get('#toolbar .fa-plus, #toolbar button[title*="processor"], .add-processor', { timeout })
    .should('be.visible')
    .and('not.be.disabled');

  // Test ability to interact with canvas
  cy.get('#canvas-container').should('be.visible').should('not.have.class', 'disabled');

  cy.log('✅ Processor configuration permissions verified');
}

/**
 * Handle session persistence across navigation
 * @param {string} targetUrl - URL to navigate to
 * @param {Object} options - Navigation options
 */
export function verifySessionPersistence(targetUrl, options = {}) {
  const { expectMaintainAuth = true, timeout = 15000 } = options;

  cy.log(`🔄 Verifying session persistence during navigation to: ${targetUrl}`);

  // Store current auth state
  detectAuthState().then((initialState) => {
    // Navigate to target URL
    cy.visit(targetUrl);

    // Wait for page load
    cy.get('body', { timeout }).should('be.visible');

    // Verify auth state is maintained
    detectAuthState().then((newState) => {
      if (expectMaintainAuth) {
        expect(newState).to.equal(
          initialState,
          'Authentication state should persist across navigation'
        );
      }
    });
  });

  cy.log('✅ Session persistence verified');
}

/**
 * Test session behavior with browser refresh
 */
export function testSessionRefreshPersistence() {
  cy.log('🔄 Testing session persistence across browser refresh');

  detectAuthState().then((initialState) => {
    // Perform browser refresh
    cy.reload();

    // Wait for page reload
    cy.get('body', { timeout: 20000 }).should('be.visible');

    // Verify auth state is maintained
    detectAuthState().then((newState) => {
      expect(newState).to.equal(
        initialState,
        'Authentication state should persist across browser refresh'
      );
    });
  });

  cy.log('✅ Session refresh persistence verified');
}

/**
 * Clear authentication state and reset for new test
 */
export function clearAuthState() {
  cy.log('🧹 Clearing authentication state');

  // Clear cookies and local storage
  cy.clearCookies();
  cy.clearLocalStorage();

  // Clear any authentication headers
  cy.window().then((win) => {
    if (win.localStorage) {
      win.localStorage.clear();
    }
    if (win.sessionStorage) {
      win.sessionStorage.clear();
    }
  });

  cy.log('✅ Authentication state cleared');
}

/**
 * Simple login with credentials
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Cypress.Chainable} Promise that resolves when login is complete
 */
export function loginWithCredentials(username, password) {
  cy.log(`🔑 Logging in with username: ${username}`);
  
  // Visit the base URL (should redirect to login if not authenticated)
  cy.visit('/');
  
  // Wait for login form to be visible
  cy.get('[data-testid="username"], input[type="text"], input[id*="username"]', {
    timeout: 10000,
  })
    .should('be.visible')
    .clear()
    .type(username);

  cy.get('[data-testid="password"], input[type="password"], input[id*="password"]')
    .should('be.visible')
    .clear()
    .type(password);

  cy.get('[data-testid="login-button"], input[value="Login"], button[type="submit"]').click();

  // Wait for login to complete (either redirect to canvas or error)
  cy.url({ timeout: 15000 }).should('not.contain', '/login');

  return cy.wrap(null);
}

/**
 * Verify current login state
 * @returns {Cypress.Chainable} Promise that resolves with login state object
 */
export function verifyLoginState() {
  return cy.url().then((url) => {
    const isLoggedIn = !url.includes('/login') && !url.includes('/error');
    
    return {
      isLoggedIn,
      authMethod: isLoggedIn ? 'basic' : null,
      url,
    };
  });
}

/**
 * Logout from the application
 * @returns {Cypress.Chainable} Promise that resolves when logout is complete
 */
export function logout() {
  cy.log('🚪 Logging out');
  
  // Look for logout link/button with various selectors
  cy.get('[data-testid="user-menu"], #user-logout-link, .user-menu', { timeout: 10000 })
    .should('be.visible')
    .click();

  // Wait for logout to complete (redirect to login page)
  cy.url({ timeout: 10000 }).should('contain', '/login');

  return cy.wrap(null);
}

/**
 * Clear all authentication data
 */
export function clearAllAuthenticationData() {
  cy.log('🧹 Clearing all authentication data');
  
  // Clear localStorage, sessionStorage, and cookies
  cy.clearLocalStorage();
  cy.clearCookies();
  
  // Clear session storage
  cy.window().then((win) => {
    win.sessionStorage.clear();
  });

  return cy.wrap(null);
}
