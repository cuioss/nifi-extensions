/**
 * Simplified Authentication utility functions for NiFi E2E tests
 * Optimized for basic login/logout testing only
 */

/**
 * Simple login with credentials - optimized for session reuse
 * @param {string} username - Username
 * @param {string} password - Password
 */
export function loginWithCredentials(username, password) {
  cy.log(`🔑 Logging in with username: ${username}`);
  
  // Visit the base URL (should redirect to login if not authenticated)
  cy.visit('/');
  
  // Wait for login form to be visible and perform login
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

  cy.log('✅ Login completed successfully');
}

/**
 * Verify current login state
 * @returns {Cypress.Chainable} Promise that resolves with login state object
 */
export function verifyLoginState() {
  return cy.url().then((url) => {
    const isLoggedIn = !url.includes('/login') && !url.includes('/error');
    
    const loginState = {
      isLoggedIn,
      authMethod: isLoggedIn ? 'basic' : null,
      url,
    };

    // Don't call cy.log inside .then() - causes async/sync mixing
    return loginState;
  });
}

/**
 * Logout from the application
 */
export function logout() {
  cy.log('🚪 Logging out');
  
  // Look for logout link/button with various selectors
  cy.get('[data-testid="user-menu"], #user-logout-link, .user-menu', { timeout: 10000 })
    .should('be.visible')
    .click();

  // Wait for logout to complete (redirect to login page)
  cy.url({ timeout: 10000 }).should('contain', '/login');

  cy.log('✅ Logout completed successfully');
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

  cy.log('✅ Authentication data cleared');
}
