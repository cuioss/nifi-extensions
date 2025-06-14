/**
 * Self-verification tests for login commands
 * These tests verify that the custom login commands work correctly
 */

import { TEXT_CONSTANTS, COMMON_STRINGS, SELECTORS } from '../../support/constants.js';

describe('Login Commands Self-Verification', () => {
  beforeEach(() => {
    // Clear any existing sessions before each test
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it('should login to NiFi UI successfully with valid credentials', () => {
    // Test the nifiLogin command with valid credentials
    cy.nifiLogin(TEXT_CONSTANTS.ADMIN, TEXT_CONSTANTS.ADMIN_PASSWORD);

    // Verify login was successful
    cy.verifyLoggedIn();

    // Verify we can see the canvas
    cy.get(COMMON_STRINGS.CANVAS_CONTAINER_SELECTOR).should('be.visible');
  });

  it('should handle invalid login credentials gracefully', () => {
    // Visit the login page manually to test error handling
    cy.visit('/');

    // Wait for login form
    cy.get(SELECTORS.USERNAME_ID_SELECTOR).should('be.visible');

    // Try to login with invalid credentials
    cy.get(SELECTORS.USERNAME_ID_SELECTOR).clear();
    cy.get(SELECTORS.USERNAME_ID_SELECTOR).type('invalid');
    cy.get(SELECTORS.PASSWORD_ID_SELECTOR).clear();
    cy.get(SELECTORS.PASSWORD_ID_SELECTOR).type('invalid');
    cy.get('input[value="Login"]').click();

    // Should remain on login page or show error
    cy.get('body').then(($body) => {
      // Either we see an error message or we're still on the login page
      const hasError = $body.find('.login-error, .error-message').length > 0;
      const hasLoginForm = $body.find(SELECTORS.USERNAME_ID_SELECTOR).length > 0;

      expect(hasError || hasLoginForm).to.be.true;
    });
  });

  it('should verify login state correctly', () => {
    // Login first
    cy.nifiLogin(TEXT_CONSTANTS.ADMIN, TEXT_CONSTANTS.ADMIN_PASSWORD);

    // Test the verifyLoggedIn command
    cy.verifyLoggedIn();

    // Additional verification that specific elements exist
    cy.get(COMMON_STRINGS.CANVAS_CONTAINER_SELECTOR).should('exist');
    cy.get('#user-logout-link').should('exist');
  });

  it('should handle Keycloak login flow', () => {
    // Skip this test if Keycloak is not configured
    const keycloakUrl = Cypress.env('keycloakUrl');
    if (!keycloakUrl) {
      cy.skip('Keycloak URL not configured');
    }

    // Test Keycloak login command
    cy.keycloakLogin('testUser', 'drowssap');

    // Verify we're logged into Keycloak
    cy.get('.kc-dropdown, .account-welcome').should('be.visible');
  });

  it('should maintain session state across navigation', () => {
    // Login to NiFi
    cy.nifiLogin(TEXT_CONSTANTS.ADMIN, TEXT_CONSTANTS.ADMIN_PASSWORD);
    cy.verifyLoggedIn();

    // Navigate to different parts of the UI
    cy.visit('/nifi/summary');
    cy.verifyLoggedIn();

    // Navigate back to canvas
    cy.navigateToCanvas();
    cy.verifyLoggedIn();
  });
});
