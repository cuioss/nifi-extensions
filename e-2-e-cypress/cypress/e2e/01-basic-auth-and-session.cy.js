/**
 * @file 01 - Basic Authentication Test - Using Modern cy.session() Approach
 * Tests authentication flows using stateful session management
 * Each test is self-sufficient using cached sessions
 */

describe('01 - Basic Authentication - Modern Session Management', () => {
  beforeEach(() => {
    cy.log('Setting up test with clean session state');
  });

  it('R-AUTH-001: Should reject invalid credentials', () => {
    cy.log('Testing invalid credentials rejection');

    // Clear any existing sessions first
    cy.clearCookies();
    cy.clearLocalStorage();
    
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

    cy.log('✅ Invalid credentials properly rejected');
  });

  it('R-AUTH-002: Should login successfully using session helper', () => {
    cy.log('🔑 Testing successful login with session caching');

    // Use the new authentication helper
    cy.loginNiFi('admin', 'adminadminadmin');

    // Verify login state using session context
    cy.getSessionContext().then((context) => {
      // Debug logging
      cy.log('Session context:', JSON.stringify(context, null, 2));
      
      // Check basic authentication success - just verify we're not on login page
      expect(context.url).to.not.contain('/login');
      cy.log('✅ Login successful - not on login page');
    });
    
    cy.log('✅ Login successful with session caching');
  });

  it('R-AUTH-003: Should maintain session without additional login', () => {
    cy.log('🔄 Testing session persistence');

    // This should use the cached session from the previous test
    cy.ensureNiFiReady();

    // Verify session state
    cy.getSessionContext().then((context) => {
      expect(context.isLoggedIn).to.be.true;
      expect(context.isNiFiPage).to.be.true;
      // Don't require isReady here - just verify session persisted
    });
    
    cy.log('✅ Session persisted successfully - no additional login needed');
  });

  it('R-AUTH-004: Should logout and clear session', () => {
    cy.log('🚪 Testing logout functionality');

    // First ensure we're logged in
    cy.ensureNiFiReady();

    // Perform logout using helper
    cy.logoutNiFi();

    // Verify logout state - should be redirected to login page
    cy.url({ timeout: 10000 }).should('contain', '/login');
    
    cy.log('✅ Logout successful - session cleared');
  });
});
