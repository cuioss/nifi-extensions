/**
 * @file NiFi Authentication Tests
 * Simplified authentication tests focused on reliable login for processor testing
 * Consolidates authentication functionality from multiple previous test files
 */

import { SELECTORS } from '../support/constants.js';
import { testSetup, verifyAuthenticationState } from '../support/test-helpers.js';

describe('NiFi Authentication', () => {
  it('Should login successfully and maintain session', () => {
    testSetup('Testing reliable NiFi login for processor testing');

    // Use the auth helper for reliable login
    cy.ensureNiFiReady();

    // Verify we're authenticated and on the main canvas
    verifyAuthenticationState(true, 'MAIN_CANVAS');
  });

  it('Should reject invalid credentials', () => {
    testSetup('Testing invalid credentials rejection');

    // Clear any existing session and navigate to login
    cy.clearSession();
    cy.navigateToPage('LOGIN');

    // Try invalid credentials using consolidated approach
    cy.get(SELECTORS.USERNAME_INPUT).should('be.visible').clear().type('invalid-user');
    cy.get(SELECTORS.PASSWORD_INPUT).should('be.visible').clear().type('invalid-password');
    cy.get(SELECTORS.LOGIN_BUTTON).click();

    // Verify rejection
    verifyAuthenticationState(false, 'LOGIN');
  });

  it('Should logout and clear session', () => {
    testSetup('Testing logout functionality');

    // Ensure logged in, then logout and verify
    cy.ensureNiFiReady();
    cy.logoutNiFi();
    cy.verifyPageType('LOGIN');
  });
});
