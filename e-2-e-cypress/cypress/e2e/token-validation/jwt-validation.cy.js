/**
 * End-to-End tests for JWT token validation
 */

describe('Token Validation E2E Tests', () => {
  beforeEach(() => {
    // Login and navigate to canvas before each test
    cy.nifiLogin('admin', 'adminadminadmin');
    cy.navigateToCanvas();
  });

  it('should validate a valid JWT token', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      // Configure processor for token validation
      const config = {
        properties: {
          'JWKS Type': 'Server',
          'JWKS URL':
            'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid-connect/certs',
        },
      };

      cy.configureProcessor(processorId, config);

      // Generate a valid token from Keycloak
      cy.generateToken().then((token) => {
        // Verify token validation
        cy.verifyTokenValidation(processorId, token);
      });
    });
  });

  it('should reject an expired token', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      // Configure processor
      const config = {
        properties: {
          'JWKS Type': 'Server',
          'JWKS URL':
            'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid-connect/certs',
        },
      };

      cy.configureProcessor(processorId, config);

      // Use fixture data to create expired token payload
      cy.fixture('tokens/test-tokens.json').then((tokenData) => {
        cy.createTestToken(tokenData.expiredToken.payload).then((expiredToken) => {
          cy.verifyTokenValidation(processorId, expiredToken);
        });
      });
    });
  });

  it('should reject token with invalid issuer', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      // Configure processor with issuer validation
      const config = {
        properties: {
          'JWKS Type': 'Server',
          'JWKS URL':
            'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid-connect/certs',
          'Issuer Validation': 'true',
          'Expected Issuer': 'https://localhost:8443/auth/realms/oauth_integration_tests',
        },
      };

      cy.configureProcessor(processorId, config);

      // Use fixture data to create invalid issuer token
      cy.fixture('tokens/test-tokens.json').then((tokenData) => {
        cy.createTestToken(tokenData.invalidIssuerToken.payload).then((invalidToken) => {
          cy.verifyTokenValidation(processorId, invalidToken);
        });
      });
    });
  });

  it('should handle malformed tokens gracefully', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      // Configure processor
      const config = {
        properties: {
          'JWKS Type': 'Server',
          'JWKS URL':
            'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid-connect/certs',
        },
      };

      cy.configureProcessor(processorId, config);

      // Test with malformed tokens
      const malformedTokens = [
        'not.a.jwt',
        'invalid-jwt-format',
        'header.payload', // Missing signature
        '', // Empty token
        null, // Null token
      ];

      malformedTokens.forEach((malformedToken) => {
        if (malformedToken !== null) {
          // Verify malformed token validation fails gracefully
          cy.verifyTokenValidation(processorId, malformedToken);
        }
      });
    });
  });

  it('should validate token with custom claims', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      // Configure processor
      const config = {
        properties: {
          'JWKS Type': 'Server',
          'JWKS URL':
            'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid-connect/certs',
          'Required Claims': 'scope,role',
          'Claim Validation': 'true',
        },
      };

      cy.configureProcessor(processorId, config);

      // Generate token with custom claims
      const customClaims = {
        scope: 'read write',
        role: 'admin',
        customClaim: 'custom_value',
      };

      cy.generateToken(customClaims).then((token) => {
        // Verify token with custom claims validates
        cy.verifyTokenValidation(processorId, token);
      });
    });
  });
});
