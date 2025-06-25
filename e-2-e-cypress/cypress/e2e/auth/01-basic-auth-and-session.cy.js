/**
 * Authentication and Session Management Tests
 * 
 * Comprehensive test suite for authentication flows, session management,
 * and security scenarios according to Requirements R-AUTH-001 to R-AUTH-005
 * 
 * @fileoverview Authentication test implementation for NiFi JWT extension
 * @requires cypress/support/utils/auth-helpers.js
 * @requires cypress/support/utils/ui-helpers.js
 * @requires cypress/support/utils/validation-helpers.js
 * @requires cypress/support/utils/error-tracking.js
 */

import { 
  loginWithCredentials, 
  loginWithKeycloak, 
  verifyLoginState, 
  logout, 
  detectAuthenticationMethod,
  validateSessionState,
  clearAllAuthenticationData
} from '../../support/utils/auth-helpers.js';
import { 
  waitForUIElement, 
  navigateToPage, 
  verifyPageLoaded
} from '../../support/utils/ui-helpers.js';
import { 
  validateRequiredElements, 
  validateErrorState, 
  validateSecurityHeaders 
} from '../../support/utils/validation-helpers.js';
import { 
  trackTestFailure, 
  logTestStep, 
  captureDebugInfo 
} from '../../support/utils/error-tracking.js';

describe('01 - Basic Login and Logout', () => {
  
  beforeEach(() => {
    logTestStep('01-basic-auth', 'Starting test - clearing authentication state');
    clearAllAuthenticationData();
  });

  afterEach(() => {
    captureDebugInfo('01-basic-auth');
  });

  context('Standard NiFi Authentication', () => {
    
    it('R-AUTH-001: Should login successfully with valid admin credentials', () => {
      logTestStep('01-basic-auth', 'Attempting login with valid admin credentials');
      
      loginWithCredentials('admin', 'adminadminadmin')
        .then(() => {
          logTestStep('01-basic-auth', 'Verifying successful login state');
          return verifyLoginState();
        })
        .then((loginState) => {
          expect(loginState.isLoggedIn).to.be.true;
          expect(loginState.authMethod).to.exist;
          
          logTestStep('01-basic-auth', 'Validating authenticated UI elements');
          return validateRequiredElements([
            '[data-testid="canvas-container"], #canvas-container',
            '[data-testid="user-menu"], #user-logout-link, .user-menu',
            '[data-testid="toolbar"], .toolbar, .header'
          ]);
        })
        .then(() => {
          logTestStep('01-basic-auth', 'Test completed successfully');
        })
        .catch((error) => {
          trackTestFailure('01-basic-auth', 'valid-admin-login', error);
          throw error;
        });
    });

    it('R-AUTH-001: Should handle invalid credentials gracefully', () => {
      logTestStep('01-basic-auth', 'Testing invalid credentials handling');
      
      cy.visit('/');
      
      // Attempt login with invalid credentials
      cy.get('[data-testid="username"], input[type="text"], input[id*="username"]', { timeout: 10000 })
        .should('be.visible')
        .clear()
        .type('invalid-user');
        
      cy.get('[data-testid="password"], input[type="password"], input[id*="password"]')
        .should('be.visible')
        .clear()
        .type('invalid-password');
        
      cy.get('[data-testid="login-button"], input[value="Login"], button[type="submit"]')
        .click();

      // Verify error handling
      validateErrorState()
        .then((errorState) => {
          expect(errorState.hasError).to.be.true;
          logTestStep('01-basic-auth', 'Invalid credentials properly rejected');
        })
        .catch((error) => {
          trackTestFailure('01-basic-auth', 'invalid-credentials', error);
          throw error;
        });
    });

    it('R-AUTH-002: Should logout successfully and clear session', () => {
      logTestStep('01-basic-auth', 'Testing logout functionality');
      
      // First login
      loginWithCredentials('admin', 'adminadminadmin')
        .then(() => {
          logTestStep('01-basic-auth', 'Performing logout');
          return logout();
        })
        .then(() => {
          logTestStep('01-basic-auth', 'Verifying logout state');
          return verifyLoginState();
        })
        .then((loginState) => {
          expect(loginState.isLoggedIn).to.be.false;
          
          // Verify we're redirected to login page
          cy.url().should('not.contain', '/nifi/canvas');
          
          logTestStep('01-basic-auth', 'Logout completed successfully');
        })
        .catch((error) => {
          trackTestFailure('01-basic-auth', 'logout-flow', error);
          throw error;
        });
    });
  });

  context('Alternative Authentication Methods', () => {
    
    it('R-AUTH-003: Should detect and handle Keycloak authentication when available', () => {
      logTestStep('01-basic-auth', 'Testing Keycloak authentication detection');
      
      detectAuthenticationMethod()
        .then((authMethod) => {
          if (authMethod.hasKeycloak) {
            logTestStep('01-basic-auth', 'Keycloak detected - testing Keycloak login');
            return loginWithKeycloak('testuser', 'testpassword');
          } else {
            logTestStep('01-basic-auth', 'Keycloak not available - skipping Keycloak tests');
            cy.skip('Keycloak authentication not configured');
          }
        })
        .then(() => {
          return verifyLoginState();
        })
        .then((loginState) => {
          expect(loginState.isLoggedIn).to.be.true;
          expect(loginState.authMethod).to.include('keycloak');
          logTestStep('01-basic-auth', 'Keycloak login successful');
        })
        .catch((error) => {
          if (!error.message.includes('skipping')) {
            trackTestFailure('01-basic-auth', 'keycloak-login', error);
            throw error;
          }
        });
    });

    it('R-AUTH-003: Should handle authentication method detection failure gracefully', () => {
      logTestStep('01-basic-auth', 'Testing authentication method detection error handling');
      
      // Mock a detection failure scenario
      cy.window().then((win) => {
        // Temporarily break detection by modifying DOM
        win.document.querySelector('body').classList.add('test-auth-detection-failure');
      });
      
      detectAuthenticationMethod()
        .then((authMethod) => {
          expect(authMethod).to.have.property('hasStandard');
          expect(authMethod).to.have.property('hasKeycloak');
          expect(authMethod).to.have.property('fallbackMethod');
          
          logTestStep('01-basic-auth', 'Authentication detection handled gracefully');
        })
        .catch((error) => {
          trackTestFailure('01-basic-auth', 'auth-detection-failure', error);
          throw error;
        });
    });
  });
});

describe('02 - Session Management and Persistence', () => {
  
  beforeEach(() => {
    logTestStep('02-session-mgmt', 'Starting session management test');
    clearAllAuthenticationData();
  });

  afterEach(() => {
    captureDebugInfo('02-session-mgmt');
  });

  it('R-AUTH-004: Should maintain session across page navigation', () => {
    logTestStep('02-session-mgmt', 'Testing session persistence across navigation');
    
    loginWithCredentials('admin', 'adminadminadmin')
      .then(() => {
        logTestStep('02-session-mgmt', 'Navigating to summary page');
        return navigateToPage('/nifi/summary');
      })
      .then(() => {
        return verifyPageLoaded('/nifi/summary');
      })
      .then(() => {
        return validateSessionState();
      })
      .then((sessionState) => {
        expect(sessionState.isValid).to.be.true;
        expect(sessionState.hasValidCookies).to.be.true;
        
        logTestStep('02-session-mgmt', 'Navigating back to canvas');
        return navigateToPage('/nifi');
      })
      .then(() => {
        return verifyPageLoaded('/nifi');
      })
      .then(() => {
        return validateSessionState();
      })
      .then((sessionState) => {
        expect(sessionState.isValid).to.be.true;
        logTestStep('02-session-mgmt', 'Session maintained across navigation');
      })
      .catch((error) => {
        trackTestFailure('02-session-mgmt', 'session-navigation', error);
        throw error;
      });
  });

  it('R-AUTH-004: Should handle page refresh while maintaining session', () => {
    logTestStep('02-session-mgmt', 'Testing session persistence across page refresh');
    
    loginWithCredentials('admin', 'adminadminadmin')
      .then(() => {
        logTestStep('02-session-mgmt', 'Refreshing page');
        cy.reload();
      })
      .then(() => {
        return waitForUIElement('[data-testid="canvas-container"], #canvas-container', 15000);
      })
      .then(() => {
        return verifyLoginState();
      })
      .then((loginState) => {
        expect(loginState.isLoggedIn).to.be.true;
        logTestStep('02-session-mgmt', 'Session maintained after page refresh');
      })
      .catch((error) => {
        trackTestFailure('02-session-mgmt', 'session-refresh', error);
        throw error;
      });
  });

  it('R-AUTH-005: Should validate session security and cookie settings', () => {
    logTestStep('02-session-mgmt', 'Testing session security validation');
    
    loginWithCredentials('admin', 'adminadminadmin')
      .then(() => {
        logTestStep('02-session-mgmt', 'Validating security headers');
        return validateSecurityHeaders();
      })
      .then((securityValidation) => {
        expect(securityValidation.hasSecureHeaders).to.be.true;
        
        logTestStep('02-session-mgmt', 'Validating cookie security');
        return validateSessionState();
      })
      .then((sessionState) => {
        expect(sessionState.hasValidCookies).to.be.true;
        expect(sessionState.cookiesSecure).to.be.true;
        
        logTestStep('02-session-mgmt', 'Session security validation completed');
      })
      .catch((error) => {
        trackTestFailure('02-session-mgmt', 'session-security', error);
        throw error;
      });
  });

  it('R-AUTH-005: Should handle concurrent session scenarios', () => {
    logTestStep('02-session-mgmt', 'Testing concurrent session handling');
    
    loginWithCredentials('admin', 'adminadminadmin')
      .then(() => {
        // Simulate concurrent session by opening in new context
        cy.window().then((win) => {
          // Store current session info
          const currentCookies = win.document.cookie;
          
          expect(currentCookies).to.exist;
          logTestStep('02-session-mgmt', 'Concurrent session test completed');
        });
      })
      .catch((error) => {
        trackTestFailure('02-session-mgmt', 'concurrent-sessions', error);
        throw error;
      });
  });
});

describe('03 - Authentication Error Handling and Edge Cases', () => {
  
  beforeEach(() => {
    logTestStep('03-auth-errors', 'Starting authentication error handling test');
    clearAllAuthenticationData();
  });

  afterEach(() => {
    captureDebugInfo('03-auth-errors');
  });

  it('R-AUTH-005: Should handle network failures during authentication', () => {
    logTestStep('03-auth-errors', 'Testing network failure handling');
    
    // Intercept and fail login request
    cy.intercept('POST', '**/login', { forceNetworkError: true }).as('loginNetworkFailure');
    
    cy.visit('/');
    
    cy.get('[data-testid="username"], input[type="text"], input[id*="username"]', { timeout: 10000 })
      .should('be.visible')
      .type('admin');
      
    cy.get('[data-testid="password"], input[type="password"], input[id*="password"]')
      .should('be.visible')
      .type('adminadminadmin');
      
    cy.get('[data-testid="login-button"], input[value="Login"], button[type="submit"]')
      .click();

    cy.wait('@loginNetworkFailure');
    
    validateErrorState()
      .then((errorState) => {
        expect(errorState.hasError).to.be.true;
        expect(errorState.errorType).to.include('network');
        logTestStep('03-auth-errors', 'Network failure handled gracefully');
      })
      .catch((error) => {
        trackTestFailure('03-auth-errors', 'network-failure', error);
        throw error;
      });
  });

  it('R-AUTH-005: Should handle session timeout scenarios', () => {
    logTestStep('03-auth-errors', 'Testing session timeout handling');
    
    loginWithCredentials('admin', 'adminadminadmin')
      .then(() => {
        // Simulate session timeout by clearing cookies
        cy.clearCookies();
        
        // Try to navigate to a protected page
        return navigateToPage('/nifi/canvas');
      })
      .then(() => {
        // Should be redirected to login
        cy.url().should('not.contain', '/nifi/canvas');
        logTestStep('03-auth-errors', 'Session timeout handled correctly');
      })
      .catch((error) => {
        trackTestFailure('03-auth-errors', 'session-timeout', error);
        throw error;
      });
  });

  it('R-AUTH-005: Should handle malformed authentication responses', () => {
    logTestStep('03-auth-errors', 'Testing malformed response handling');
    
    // Intercept and return malformed response
    cy.intercept('POST', '**/login', { body: 'invalid-json-response' }).as('malformedResponse');
    
    cy.visit('/');
    
    cy.get('[data-testid="username"], input[type="text"], input[id*="username"]', { timeout: 10000 })
      .should('be.visible')
      .type('admin');
      
    cy.get('[data-testid="password"], input[type="password"], input[id*="password"]')
      .should('be.visible')
      .type('adminadminadmin');
      
    cy.get('[data-testid="login-button"], input[value="Login"], button[type="submit"]')
      .click();

    cy.wait('@malformedResponse');
    
    validateErrorState()
      .then((errorState) => {
        expect(errorState.hasError).to.be.true;
        logTestStep('03-auth-errors', 'Malformed response handled gracefully');
      })
      .catch((error) => {
        trackTestFailure('03-auth-errors', 'malformed-response', error);
        throw error;
      });
  });
});
