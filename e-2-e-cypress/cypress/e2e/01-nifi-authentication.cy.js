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

    // Navigate to login page directly (like the working simple test)
    cy.visit('/#/login', { failOnStatusCode: false });

    // Wait for login form to be visible
    cy.get('input[type="password"], input[type="text"]', { timeout: 15000 }).should('be.visible');

    // Fill in credentials
    cy.get(SELECTORS.USERNAME_INPUT).should('be.visible').clear().type('testUser');
    cy.get(SELECTORS.PASSWORD_INPUT).should('be.visible').clear().type('drowssap');
    cy.get(SELECTORS.LOGIN_BUTTON).should('be.visible').click();

    // Wait for redirect and verify we're on main canvas
    cy.url({ timeout: 15000 }).should('not.include', '/login');

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

    // First login using the working approach
    cy.visit('/#/login', { failOnStatusCode: false });
    cy.get('input[type="password"], input[type="text"]', { timeout: 15000 }).should('be.visible');
    cy.get(SELECTORS.USERNAME_INPUT).should('be.visible').clear().type('testUser');
    cy.get(SELECTORS.PASSWORD_INPUT).should('be.visible').clear().type('drowssap');
    cy.get(SELECTORS.LOGIN_BUTTON).should('be.visible').click();
    cy.url({ timeout: 15000 }).should('not.include', '/login');

    // Then logout and verify
    cy.logoutNiFi();
    cy.verifyPageType('LOGIN');
  });
});
