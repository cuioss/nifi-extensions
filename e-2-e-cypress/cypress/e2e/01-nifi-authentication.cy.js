/**
 * @file NiFi Authentication Tests
 * Simplified authentication tests focused on reliable login for processor testing
 * Consolidates authentication functionality from multiple previous test files
 */

import { SELECTORS } from '../support/constants.js';
import { testSetup } from '../support/test-helpers.js';

describe('NiFi Authentication', () => {
  it('Should login successfully and maintain session', () => {
    testSetup('Testing reliable NiFi login for processor testing');

    // Navigate to login page using navigation helper
    cy.navigateToPage('LOGIN');

    // Login using auth helper with default credentials
    cy.loginNiFi('testUser', 'drowssap');

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

    // Try invalid credentials using auth helper
    cy.navigateToPage('LOGIN');

    // Manually attempt login with invalid credentials to test rejection
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
    cy.ensureNiFiReady('testUser', 'drowssap');

    // Verify we're authenticated before logout
    cy.getSessionContext().then((session) => {
      expect(session.isLoggedIn).to.be.true;
      expect(session.pageType).to.equal('MAIN_CANVAS');
    });

    // Then logout and verify
    cy.logoutNiFi();

    // Verify logout using session context
    cy.getSessionContext().then((session) => {
      expect(session.isLoggedIn).to.be.false;
      expect(session.pageType).to.equal('LOGIN');
    });
  });
});
