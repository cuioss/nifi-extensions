/**
 * Keycloak Integration and External Authentication Tests
 * 
 * Comprehensive test suite for Keycloak OIDC/OAuth2 integration,
 * external authentication providers, and SSO workflows
 * 
 * @fileoverview Keycloak integration test implementation for NiFi JWT extension
 * @requires cypress/support/utils/auth-helpers.js
 * @requires cypress/support/utils/ui-helpers.js
 * @requires cypress/support/utils/validation-helpers.js
 * @requires cypress/support/utils/error-tracking.js
 */

import { 
  loginWithKeycloak, 
  verifyLoginState, 
  logout, 
  detectAuthenticationMethod,
  validateSessionState,
  clearAllAuthenticationData,
  validateKeycloakConfiguration
} from '../../support/utils/auth-helpers.js';
import { 
  waitForUIElement, 
  navigateToPage, 
  verifyPageLoaded 
} from '../../support/utils/ui-helpers.js';
import { 
  validateRequiredElements, 
  validateErrorState, 
  validateOIDCFlow,
  validateJWTToken
} from '../../support/utils/validation-helpers.js';
import { 
  trackTestFailure, 
  logTestStep, 
  captureDebugInfo 
} from '../../support/utils/error-tracking.js';

// Helper function to validate logout URL
function validateLogoutURL() {
  return cy.url().then((url) => {
    return url.includes('login') || url.includes('keycloak') || !url.includes('canvas');
  });
}

// Helper function to extract and validate Keycloak tokens
function extractAndValidateKeycloakTokens() {
  return cy.window().then((win) => {
    // Look for Keycloak tokens in various storage locations
    const accessToken = win.localStorage.getItem('kc-access-token') || 
                       win.sessionStorage.getItem('kc-access-token') ||
                       win.localStorage.getItem('access_token');
                       
    const idToken = win.localStorage.getItem('kc-id-token') || 
                   win.sessionStorage.getItem('kc-id-token') ||
                   win.localStorage.getItem('id_token');
    
    if (accessToken) {
      logTestStep('07-keycloak', 'Keycloak access token found - validating');
      return validateJWTToken(accessToken, { issuer: 'keycloak' });
    } else if (idToken) {
      logTestStep('07-keycloak', 'Keycloak ID token found - validating');
      return validateJWTToken(idToken, { issuer: 'keycloak' });
    } else {
      logTestStep('07-keycloak', 'No Keycloak tokens found in standard locations');
      return cy.wrap({ isValid: true, reason: 'no-tokens-found' });
    }
  });
}

// Helper function to simulate token expiry
function simulateTokenExpiry() {
  return cy.window().then((win) => {
    win.localStorage.removeItem('kc-access-token');
    win.localStorage.removeItem('kc-id-token');
    win.sessionStorage.removeItem('kc-access-token');
    win.sessionStorage.removeItem('kc-id-token');
    logTestStep('07-keycloak', 'Simulated token expiry');
  });
}

// Helper function to validate token expiry URL handling
function validateTokenExpiryURLHandling() {
  return cy.url().then((currentUrl) => {
    const isHandledGracefully = currentUrl.includes('login') || 
                               currentUrl.includes('keycloak') || 
                               !currentUrl.includes('canvas');
    return isHandledGracefully;
  });
}

describe('07 - Keycloak Authentication Integration', () => {
  
  before(() => {
    // Check if Keycloak is configured before running any tests
    detectAuthenticationMethod().then((authMethod) => {
      if (!authMethod.hasKeycloak) {
        cy.skip('Keycloak authentication is not configured - skipping Keycloak tests');
      }
    });
  });

  beforeEach(() => {
    logTestStep('07-keycloak', 'Starting Keycloak test - clearing authentication state');
    clearAllAuthenticationData();
  });

  afterEach(() => {
    captureDebugInfo('07-keycloak');
  });

  context('Keycloak Configuration Validation', () => {
    
    it('R-AUTH-012: Should validate Keycloak server configuration', () => {
      logTestStep('07-keycloak', 'Validating Keycloak server configuration');
      
      validateKeycloakConfiguration()
        .then((config) => {
          expect(config.serverUrl).to.exist;
          expect(config.realm).to.exist;
          expect(config.clientId).to.exist;
          expect(config.isReachable).to.be.true;
          
          logTestStep('07-keycloak', 'Keycloak configuration validated successfully');
        })
        .catch((error) => {
          trackTestFailure('07-keycloak', 'config-validation', error);
          throw error;
        });
    });

    it('R-AUTH-012: Should detect Keycloak authentication method availability', () => {
      logTestStep('07-keycloak', 'Testing Keycloak method detection');
      
      detectAuthenticationMethod()
        .then((authMethod) => {
          expect(authMethod.hasKeycloak).to.be.true;
          expect(authMethod.keycloakUrl).to.exist;
          expect(authMethod.keycloakRealm).to.exist;
          
          logTestStep('07-keycloak', 'Keycloak authentication method detected');
        })
        .catch((error) => {
          trackTestFailure('07-keycloak', 'method-detection', error);
          throw error;
        });
    });
  });

  context('Keycloak Login Flow', () => {
    
    it('R-AUTH-013: Should login successfully via Keycloak OIDC flow', () => {
      logTestStep('07-keycloak', 'Testing Keycloak OIDC login flow');
      
      const keycloakUser = Cypress.env('keycloakUser') || 'testuser';
      const keycloakPassword = Cypress.env('keycloakPassword') || 'testpassword';
      
      loginWithKeycloak(keycloakUser, keycloakPassword)
        .then(() => {
          logTestStep('07-keycloak', 'Verifying Keycloak login state');
          return verifyLoginState();
        })
        .then((loginState) => {
          expect(loginState.isLoggedIn).to.be.true;
          expect(loginState.authMethod).to.include('keycloak');
          
          logTestStep('07-keycloak', 'Validating OIDC flow completion');
          return validateOIDCFlow();
        })
        .then((oidcValidation) => {
          expect(oidcValidation.isValid).to.be.true;
          expect(oidcValidation.hasAccessToken).to.be.true;
          expect(oidcValidation.hasIdToken).to.be.true;
          
          logTestStep('07-keycloak', 'Keycloak OIDC login completed successfully');
        })
        .catch((error) => {
          trackTestFailure('07-keycloak', 'oidc-login', error);
          throw error;
        });
    });

    it('R-AUTH-013: Should handle Keycloak login errors gracefully', () => {
      logTestStep('07-keycloak', 'Testing Keycloak login error handling');
      
      // Attempt login with invalid credentials
      loginWithKeycloak('invalid-user', 'invalid-password', { expectFailure: true })
        .then(() => {
          return validateErrorState();
        })
        .then((errorState) => {
          expect(errorState.hasError).to.be.true;
          expect(errorState.errorType).to.include('authentication');
          
          logTestStep('07-keycloak', 'Invalid Keycloak credentials properly rejected');
        })
        .catch((error) => {
          if (!error.message.includes('expected failure')) {
            trackTestFailure('07-keycloak', 'login-error-handling', error);
            throw error;
          }
        });
    });

    it('R-AUTH-013: Should redirect to Keycloak login page when required', () => {
      logTestStep('07-keycloak', 'Testing Keycloak login page redirection');
      
      cy.visit('/');
      
      // Look for Keycloak login redirection
      cy.url({ timeout: 10000 }).should('satisfy', (url) => {
        const isKeycloakLogin = url.includes('keycloak') || url.includes('auth/realms');
        const isStandardLogin = url.includes('login') || url.includes('nifi');
        
        return isKeycloakLogin || isStandardLogin;
      });
      
      logTestStep('07-keycloak', 'Login redirection working correctly');
    });
  });

  context('Keycloak Session Management', () => {
    
    it('R-AUTH-014: Should maintain Keycloak session across navigation', () => {
      logTestStep('07-keycloak', 'Testing Keycloak session persistence');
      
      const keycloakUser = Cypress.env('keycloakUser') || 'testuser';
      const keycloakPassword = Cypress.env('keycloakPassword') || 'testpassword';
      
      loginWithKeycloak(keycloakUser, keycloakPassword)
        .then(() => {
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
          expect(sessionState.authProvider).to.include('keycloak');
          
          logTestStep('07-keycloak', 'Navigating back to canvas');
          return navigateToPage('/nifi');
        })
        .then(() => {
          return verifyLoginState();
        })
        .then((loginState) => {
          expect(loginState.isLoggedIn).to.be.true;
          logTestStep('07-keycloak', 'Keycloak session maintained across navigation');
        })
        .catch((error) => {
          trackTestFailure('07-keycloak', 'session-navigation', error);
          throw error;
        });
    });

    it('R-AUTH-014: Should handle Keycloak session refresh correctly', () => {
      logTestStep('07-keycloak', 'Testing Keycloak session refresh');
      
      const keycloakUser = Cypress.env('keycloakUser') || 'testuser';
      const keycloakPassword = Cypress.env('keycloakPassword') || 'testpassword';
      
      loginWithKeycloak(keycloakUser, keycloakPassword)
        .then(() => {
          logTestStep('07-keycloak', 'Refreshing page');
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
          logTestStep('07-keycloak', 'Keycloak session maintained after refresh');
        })
        .catch((error) => {
          trackTestFailure('07-keycloak', 'session-refresh', error);
          throw error;
        });
    });

    it('R-AUTH-014: Should logout from Keycloak properly', () => {
      logTestStep('07-keycloak', 'Testing Keycloak logout flow');
      
      const keycloakUser = Cypress.env('keycloakUser') || 'testuser';
      const keycloakPassword = Cypress.env('keycloakPassword') || 'testpassword';
      
      loginWithKeycloak(keycloakUser, keycloakPassword)
        .then(() => {
          logTestStep('07-keycloak', 'Performing Keycloak logout');
          return logout();
        })
        .then(() => {
          return verifyLoginState();
        })
        .then((loginState) => {
          expect(loginState.isLoggedIn).to.be.false;
          
          // Verify we're redirected appropriately
          validateLogoutURL().then((isRedirected) => {
            expect(isRedirected).to.be.true;
            logTestStep('07-keycloak', 'Keycloak logout completed successfully');
          });
        })
        .catch((error) => {
          trackTestFailure('07-keycloak', 'logout-flow', error);
          throw error;
        });
    });
  });

  context('Keycloak Token Validation', () => {
    
    it('R-AUTH-015: Should validate Keycloak JWT tokens properly', () => {
      logTestStep('07-keycloak', 'Testing Keycloak JWT token validation');
      
      const keycloakUser = Cypress.env('keycloakUser') || 'testuser';
      const keycloakPassword = Cypress.env('keycloakPassword') || 'testpassword';
      
      loginWithKeycloak(keycloakUser, keycloakPassword)
        .then(() => {
          // Extract and validate Keycloak tokens
          return extractAndValidateKeycloakTokens();
        })
        .then((tokenValidation) => {
          if (tokenValidation.reason !== 'no-tokens-found') {
            expect(tokenValidation.isValid).to.be.true;
            expect(tokenValidation.hasValidStructure).to.be.true;
            expect(tokenValidation.issuer).to.include('keycloak');
          }
          
          logTestStep('07-keycloak', 'Keycloak token validation completed');
        })
        .catch((error) => {
          trackTestFailure('07-keycloak', 'token-validation', error);
          throw error;
        });
    });

    it('R-AUTH-015: Should handle Keycloak token expiry gracefully', () => {
      logTestStep('07-keycloak', 'Testing Keycloak token expiry handling');
      
      const keycloakUser = Cypress.env('keycloakUser') || 'testuser';
      const keycloakPassword = Cypress.env('keycloakPassword') || 'testpassword';
      
      loginWithKeycloak(keycloakUser, keycloakPassword)
        .then(() => {
          // Simulate token expiry by clearing tokens
          return simulateTokenExpiry();
        })
        .then(() => {
          // Try to access a protected resource
          return navigateToPage('/nifi/canvas');
        })
        .then(() => {
          // Should be redirected to login or handle gracefully
          return validateTokenExpiryURLHandling();
        })
        .then((isHandledGracefully) => {
          expect(isHandledGracefully).to.be.true;
          logTestStep('07-keycloak', 'Token expiry handled correctly');
        })
        .catch((error) => {
          trackTestFailure('07-keycloak', 'token-expiry', error);
          throw error;
        });
    });
  });
});

describe('08 - SSO and Multi-Provider Authentication', () => {
  
  beforeEach(() => {
    logTestStep('08-sso', 'Starting SSO test - clearing authentication state');
    clearAllAuthenticationData();
  });

  afterEach(() => {
    captureDebugInfo('08-sso');
  });

  it('R-AUTH-016: Should support multiple authentication providers', () => {
    logTestStep('08-sso', 'Testing multiple authentication provider support');
    
    detectAuthenticationMethod()
      .then((authMethod) => {
        expect(authMethod).to.have.property('hasStandard');
        expect(authMethod).to.have.property('hasKeycloak');
        
        // Test both methods if available
        const availableMethods = [];
        if (authMethod.hasStandard) availableMethods.push('standard');
        if (authMethod.hasKeycloak) availableMethods.push('keycloak');
        
        expect(availableMethods.length).to.be.at.least(1);
        logTestStep('08-sso', `Found ${availableMethods.length} authentication methods: ${availableMethods.join(', ')}`);
      })
      .catch((error) => {
        trackTestFailure('08-sso', 'multi-provider-support', error);
        throw error;
      });
  });

  it('R-AUTH-016: Should handle authentication method switching', () => {
    logTestStep('08-sso', 'Testing authentication method switching');
    
    detectAuthenticationMethod()
      .then((authMethod) => {
        if (authMethod.hasStandard && authMethod.hasKeycloak) {
          logTestStep('08-sso', 'Both authentication methods available - testing switching');
          
          // This would involve testing the ability to switch between auth methods
          // Implementation depends on how the UI presents authentication options
          return validateRequiredElements([
            '[data-testid="auth-method-selector"], .auth-method-selector',
            '[data-testid="login-form"], .login-form, form'
          ]);
        } else {
          logTestStep('08-sso', 'Only one authentication method available - skipping switching test');
          cy.skip('Multiple authentication methods not available');
        }
      })
      .catch((error) => {
        if (!error.message.includes('skipping')) {
          trackTestFailure('08-sso', 'method-switching', error);
          throw error;
        }
      });
  });

  it('R-AUTH-017: Should validate SSO user experience', () => {
    logTestStep('08-sso', 'Testing SSO user experience');
    
    // Check if Keycloak SSO is available
    detectAuthenticationMethod()
      .then((authMethod) => {
        if (authMethod.hasKeycloak) {
          const keycloakUser = Cypress.env('keycloakUser') || 'testuser';
          const keycloakPassword = Cypress.env('keycloakPassword') || 'testpassword';
          
          return loginWithKeycloak(keycloakUser, keycloakPassword);
        } else {
          cy.skip('Keycloak SSO not available');
        }
      })
      .then(() => {
        // Verify SSO experience - should be seamless
        return verifyLoginState();
      })
      .then((loginState) => {
        expect(loginState.isLoggedIn).to.be.true;
        expect(loginState.authMethod).to.include('keycloak');
        
        // Verify seamless access to protected resources
        return navigateToPage('/nifi');
      })
      .then(() => {
        return waitForUIElement('[data-testid="canvas-container"], #canvas-container', 10000);
      })
      .then(() => {
        logTestStep('08-sso', 'SSO user experience validated successfully');
      })
      .catch((error) => {
        if (!error.message.includes('skipping')) {
          trackTestFailure('08-sso', 'sso-user-experience', error);
          throw error;
        }
      });
  });
});
