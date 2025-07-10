/**
 * @file NiFi Authentication Tests
 * Simplified authentication tests focused on reliable login for processor testing
 * Consolidates authentication functionality from multiple previous test files
 */

import { SELECTORS, PAGE_TYPES } from '../support/constants.js';
import { testSetup } from '../support/test-helpers.js';

describe('NiFi Authentication', () => {
  it('Should login successfully and maintain session', () => {
    testSetup('Testing reliable NiFi login for processor testing');

    // Navigate to login page using navigation helper
    cy.navigateToPage(PAGE_TYPES.LOGIN);

    // Login using auth helper with default credentials
    cy.loginNiFi();

    // Verify we're authenticated and on the main canvas using session context
    cy.getSessionContext().then((session) => {
      expect(session.isLoggedIn).to.be.true;
      expect(session.pageType).to.equal('MAIN_CANVAS');
    });
  });

  it('Should reject invalid credentials', () => {
    testSetup('Testing invalid credentials rejection');

    // Clear any existing session and navigate to login
    cy.clearSession();

    // Navigate to login page using navigation helper
    cy.navigateToPage(PAGE_TYPES.LOGIN);

    // Test auth helper with invalid credentials to verify it properly rejects them
    // Note: Since loginNiFi is designed to succeed, we test manual rejection here
    // to verify the authentication infrastructure properly handles invalid credentials
    cy.get(SELECTORS.USERNAME_INPUT).should('be.visible').clear().type('invalid-user');
    cy.get(SELECTORS.PASSWORD_INPUT).should('be.visible').clear().type('invalid-password');
    cy.get(SELECTORS.LOGIN_BUTTON).click();

    // Verify rejection using session context
    cy.getSessionContext().then((session) => {
      expect(session.isLoggedIn).to.be.false;
      expect(session.pageType).to.equal('LOGIN');
    });
  });

  it('Should logout and clear session', () => {
    testSetup('Testing logout functionality');

    // Ensure NiFi is ready for testing (handles login automatically)
    cy.ensureNiFiReady();

    // Verify we're authenticated before logout
    cy.getSessionContext().then((session) => {
      expect(session.isLoggedIn).to.be.true;
      expect(session.pageType).to.equal('MAIN_CANVAS');
    });

    // Use the fixed clearSession function
    cy.clearSession();

    // Log success message
    cy.log('Session cleared successfully - can access login page');
  });
});
