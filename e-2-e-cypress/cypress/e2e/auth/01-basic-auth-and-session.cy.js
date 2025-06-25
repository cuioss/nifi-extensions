/**
 * @file Basic Authentication test - SINGLE login with session reuse
 * Optimized to avoid redundant logins
 */

import {
  loginWithCredentials,
  verifyLoginState,
  logout,
  clearAllAuthenticationData,
} from '../../support/utils/auth-helpers.js';
import {
  logTestStep,
  captureDebugInfo,
} from '../../support/utils/error-tracking.js';

describe('01 - Basic Authentication - Single Login Flow', () => {
  before(() => {
    logTestStep('01-basic-auth', 'Starting optimized authentication test suite');
    clearAllAuthenticationData();
  });

  afterEach(() => {
    captureDebugInfo('01-basic-auth');
  });

  it('R-AUTH-001: Should reject invalid credentials', () => {
    logTestStep('01-basic-auth', 'Testing invalid credentials rejection');

    cy.visit('/');

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

    // Verify we stay on login page
    cy.url().should('satisfy', (url) => url.includes('/login') || url.includes('/error'));
    
    logTestStep('01-basic-auth', 'Invalid credentials properly rejected');
  });

  it('R-AUTH-002: Should login successfully (SINGLE LOGIN)', () => {
    logTestStep('01-basic-auth', '🔑 Performing THE SINGLE LOGIN for entire test suite');

    // This is the ONLY login we will perform in the entire test suite
    loginWithCredentials('admin', 'adminadminadmin');
    
    logTestStep('01-basic-auth', 'Verifying successful login state');
    verifyLoginState().then((loginState) => {
      expect(loginState.isLoggedIn).to.be.true;
      logTestStep('01-basic-auth', '✅ SINGLE LOGIN successful - session established');
    });

    // Verify we can see authenticated UI elements
    cy.get('#canvas-container, [data-testid="canvas-container"]', { timeout: 15000 })
      .should('be.visible');
    
    cy.log('✅ Authentication test completed - ONE login for entire suite');
  });

  it('R-AUTH-003: Should maintain session without additional login', () => {
    logTestStep('01-basic-auth', '🔄 Testing session persistence (NO additional login)');

    // Navigate to different page - session should persist
    cy.visit('/');
    
    // Verify we're still logged in without doing another login
    verifyLoginState().then((loginState) => {
      expect(loginState.isLoggedIn).to.be.true;
      logTestStep('01-basic-auth', '✅ Session persisted - no additional login needed');
    });

    // Verify we can access authenticated areas
    cy.url().should('not.contain', '/login');
    cy.get('#canvas-container, [data-testid="canvas-container"]', { timeout: 10000 })
      .should('be.visible');
    
    logTestStep('01-basic-auth', 'Session persistence verified successfully');
  });

  it('R-AUTH-004: Should logout and clear session', () => {
    logTestStep('01-basic-auth', '🚪 Testing logout functionality');
    
    // Perform logout
    logout();
    
    // Verify logout state
    verifyLoginState().then((loginState) => {
      expect(loginState.isLoggedIn).to.be.false;
      logTestStep('01-basic-auth', '✅ Logout successful - session cleared');
    });

    // Verify we're redirected to login page
    cy.url().should('contain', '/login');

    logTestStep('01-basic-auth', 'Complete auth flow tested with SINGLE login');
  });
});
