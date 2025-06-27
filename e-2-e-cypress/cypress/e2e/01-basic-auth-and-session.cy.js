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

    // Use new clearSession method for guaranteed clean state
    cy.clearSession();

    // Navigate to login page using navigation helper
    cy.navigateToPage('LOGIN', {
      timeout: 30000,
      waitForReady: true,
    });

    // Wait for login form elements to be visible
    cy.get('input[type="text"], input[id*="username"], [data-testid="username"]', {
      timeout: 5000,
    }).should('be.visible');

    // Enter invalid credentials
    cy.get('[data-testid="username"], input[type="text"], input[id*="username"]', {
      timeout: 5000,
    })
      .should('be.visible')
      .clear()
      .type('invalid-user');

    cy.get('[data-testid="password"], input[type="password"], input[id*="password"]')
      .should('be.visible')
      .clear()
      .type('invalid-password');

    // Submit login form
    cy.get('[data-testid="login-button"], input[value="Login"], button[type="submit"]').click();

    // Assert that login fails using navigation helper's page type detection
    cy.getPageContext().should((context) => {
      // Invalid credentials should keep us on the login page
      // (Most secure practice - don't redirect away from login on auth failure)
      expect(context.pageType).to.equal('LOGIN');

      // Ensure we're definitely not on the main canvas (no successful auth)
      expect(context.pageType).to.not.equal('MAIN_CANVAS');
    });

    // Assert we're not authenticated using auth helper
    cy.getSessionContext().should((context) => {
      expect(context.isLoggedIn).to.be.false;
    });

    cy.log('✅ Invalid credentials properly rejected');
  });

  it('R-AUTH-002: Should login successfully using session helper', () => {
    cy.log('🔑 Testing successful login with session caching');

    // Force a fresh login to ensure we're testing the login process
    cy.clearSession();

    // Use the new retrieveSession method for intelligent session management
    cy.retrieveSession('admin', 'adminadminadmin', { forceLogin: true });

    cy.log('✅ Auth helper confirmed login successful');

    // Navigate to main NiFi UI to verify login using navigation helper
    cy.navigateWithAuth('MAIN_CANVAS', { waitForReady: true });

    // Verify we're on the main canvas using navigation helper
    cy.verifyPageType('MAIN_CANVAS');

    cy.log('✅ Login successful with session caching via auth helper');
  });

  it('R-AUTH-002B: Should access main NiFi UI after successful login', () => {
    cy.log('🎯 Testing post-login access to main NiFi UI using auth helper');

    // Use the new retrieveSession method (should reuse existing session from previous test)
    cy.retrieveSession('admin', 'adminadminadmin');

    cy.log('✅ Auth helper confirmed successful login and page access');

    // Navigate to main NiFi canvas using navigation helper
    cy.navigateWithAuth('MAIN_CANVAS', { waitForReady: true });

    // Verify we're on the main canvas using navigation helper
    cy.verifyPageType('MAIN_CANVAS');

    cy.log('✅ Main NiFi UI accessible after login via auth helper');
  });

  it('R-AUTH-003: Should maintain session without additional login', () => {
    cy.log('🔄 Testing session persistence via auth helper');

    // Use retrieveSession to test session persistence (should reuse existing session)
    cy.retrieveSession('admin', 'adminadminadmin', { validateSession: true });

    cy.log('✅ Auth helper confirmed session persisted');

    // Navigate to main canvas to verify session is maintained using navigation helper
    cy.navigateWithAuth('MAIN_CANVAS', { waitForReady: true });

    // Verify we're on the main canvas using navigation helper
    cy.verifyPageType('MAIN_CANVAS');

    cy.log('✅ Session persisted successfully via auth helper - no additional login needed');
  });

  it('R-AUTH-004: Should verify unauthenticated access is blocked', () => {
    cy.log('🚫 Testing that unauthenticated access shows canvas but user is not authenticated');

    // Use new clearSession method for guaranteed clean state
    cy.clearSession();

    // Try to access main NiFi UI without authentication - using navigation helper
    cy.navigateToPage('MAIN_CANVAS', {
      timeout: 30000,
      waitForReady: false, // Don't wait for ready since it requires authentication
    });

    // Verify we can access the canvas page (NiFi allows this)
    cy.getPageContext().should((context) => {
      expect(context.pageType).to.equal('MAIN_CANVAS');
    });

    // But verify we're not authenticated using auth helper
    cy.getSessionContext().should((context) => {
      expect(context.isLoggedIn).to.be.false;
    });

    // Verify the canvas is not fully functional (not ready for authenticated operations)
    cy.getPageContext().should((context) => {
      expect(context.isReady).to.be.false; // Should not be ready without authentication
    });

    cy.log('✅ Unauthenticated access shows canvas but user is properly not authenticated');
  });

  it('R-AUTH-005: Should logout and clear session', () => {
    cy.log('🚪 Testing logout functionality');

    // First ensure we're logged in using retrieveSession
    cy.retrieveSession('admin', 'adminadminadmin');

    // Perform logout using helper
    cy.logoutNiFi();

    // Verify logout state using navigation helper - should be on login page
    cy.waitForPageType('LOGIN');
    cy.verifyPageType('LOGIN');

    cy.log('✅ Logout successful - session cleared');
  });
});
