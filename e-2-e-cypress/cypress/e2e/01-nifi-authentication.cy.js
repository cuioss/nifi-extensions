/**
 * @file NiFi Authentication Tests
 * Simplified authentication tests focused on reliable login for processor testing
 * Consolidates authentication functionality from multiple previous test files
 */

import { SELECTORS } from '../support/constants.js';

describe('NiFi Authentication', () => {
  beforeEach(() => {
    cy.log('Setting up authentication test');
  });

  it('Should login successfully and maintain session', () => {
    cy.log('🔑 Testing reliable NiFi login for processor testing');

    // Use the auth helper for reliable login
    cy.ensureNiFiReady();

    // Verify we're authenticated and on the main canvas
    cy.getPageContext().then((context) => {
      expect(context.pageType).to.equal('MAIN_CANVAS');
      expect(context.isAuthenticated).to.be.true;
      expect(context.isReady).to.be.true;
    });

    cy.log('✅ NiFi login successful and ready for processor testing');
  });

  it('Should reject invalid credentials', () => {
    cy.log('🚫 Testing invalid credentials rejection');

    // Clear any existing session
    cy.clearSession();

    // Navigate to login page
    cy.navigateToPage('LOGIN');

    // Try invalid credentials
    cy.get(SELECTORS.USERNAME_INPUT).should('be.visible').clear().type('invalid-user');

    cy.get(SELECTORS.PASSWORD_INPUT).should('be.visible').clear().type('invalid-password');

    cy.get(SELECTORS.LOGIN_BUTTON).click();

    // Should remain on login page
    cy.getPageContext().should((context) => {
      expect(context.pageType).to.equal('LOGIN');
      expect(context.isAuthenticated).to.be.false;
    });

    cy.log('✅ Invalid credentials properly rejected');
  });

  it('Should logout and clear session', () => {
    cy.log('🚪 Testing logout functionality');

    // First ensure we're logged in
    cy.ensureNiFiReady();

    // Perform logout
    cy.logoutNiFi();

    // Verify we're on login page
    cy.verifyPageType('LOGIN');

    cy.log('✅ Logout successful');
  });
});
