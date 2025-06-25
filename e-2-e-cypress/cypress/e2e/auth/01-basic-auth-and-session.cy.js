/**
 * @file Basic Authentication test implementation for NiFi JWT extension
 * Simple login, logout, and basic session validation
 * Following requirements from Requirements.md
 * @author E2E Test Refactoring Initiative
 * @version 1.0.0
 */

import {
  loginWithCredentials,
  verifyLoginState,
  logout,
  clearAllAuthenticationData,
} from '../../support/utils/auth-helpers.js';
import {
  validateRequiredElements,
  validateErrorState,
} from '../../support/utils/validation-helpers.js';
import {
  logTestStep,
  captureDebugInfo,
} from '../../support/utils/error-tracking.js';

describe('01 - Basic Authentication', () => {
  before(() => {
    logTestStep('01-basic-auth', 'Starting authentication test suite');
    clearAllAuthenticationData();
  });

  afterEach(() => {
    captureDebugInfo('01-basic-auth');
  });

  it('R-AUTH-001: Should handle invalid credentials gracefully', () => {
    logTestStep('01-basic-auth', 'Testing invalid credentials handling');

    cy.visit('/');

    // Attempt login with invalid credentials
    cy.get('[data-testid="username"], input[type="text"], input[id*="username"]', {
      timeout: 10000,
    })
      .should('be.visible')
      .clear()
      .type('invalid-user');

    cy.get('[data-testid="password"], input[type="password"], input[id*="password"]')
      .should('be.visible')
      .clear()
      .type('invalid-password');

    cy.get('[data-testid="login-button"], input[value="Login"], button[type="submit"]').click();

    // Verify error handling
    validateErrorState().then((errorState) => {
      expect(errorState.hasError).to.be.true;
      logTestStep('01-basic-auth', 'Invalid credentials properly rejected');
    });
  });

  it('R-AUTH-002: Should login successfully with valid admin credentials', () => {
    logTestStep('01-basic-auth', 'Attempting login with valid admin credentials');

    loginWithCredentials('admin', 'adminadminadmin');
    
    logTestStep('01-basic-auth', 'Verifying successful login state');
    verifyLoginState().then((loginState) => {
      expect(loginState.isLoggedIn).to.be.true;
      expect(loginState.authMethod).to.exist;
    });

    logTestStep('01-basic-auth', 'Validating authenticated UI elements');
    validateRequiredElements([
      '[data-testid="canvas-container"], #canvas-container',
      '[data-testid="user-menu"], #user-logout-link, .user-menu',
      '[data-testid="toolbar"], .toolbar, .header',
    ]);
    
    logTestStep('01-basic-auth', 'Valid login test completed successfully');
  });

  it('R-AUTH-003: Should access authenticated areas after login', () => {
    logTestStep('01-basic-auth', 'Testing authenticated area access');

    // Verify we can navigate to different NiFi areas while authenticated
    cy.visit('/');
    
    logTestStep('01-basic-auth', 'Verifying authenticated state is maintained');
    verifyLoginState().then((loginState) => {
      expect(loginState.isLoggedIn).to.be.true;
    });

    // Verify we can access the main canvas
    cy.url().should('not.contain', '/login');
    
    logTestStep('01-basic-auth', 'Authenticated navigation test completed');
  });

  it('R-AUTH-004: Should logout successfully and clear session', () => {
    logTestStep('01-basic-auth', 'Testing logout functionality');
    
    logTestStep('01-basic-auth', 'Performing logout');
    logout();
    
    logTestStep('01-basic-auth', 'Verifying logout state');
    verifyLoginState().then((loginState) => {
      expect(loginState.isLoggedIn).to.be.false;
    });

    // Verify we're redirected to login page
    cy.url().should('not.contain', '/nifi/canvas');

    logTestStep('01-basic-auth', 'Logout completed successfully');
  });
});
