/**
 * End-to-End tests for MultiIssuerJWTTokenAuthenticator processor configuration
 */

describe('Processor Configuration E2E Tests', () => {
  beforeEach(() => {
    // Login and navigate to canvas before each test
    cy.nifiLogin('admin', 'adminadminadmin');
    cy.navigateToCanvas();
  });

  it('should add and configure MultiIssuerJWTTokenAuthenticator processor', () => {
    // Add the processor to the canvas
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      // Configure basic properties
      const config = {
        name: 'JWT Token Authenticator',
        properties: {
          'JWKS Type': 'Server',
          'JWKS URL':
            'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid-connect/certs',
          'Token Header Name': 'Authorization',
          'Token Prefix': 'Bearer ',
          'Clock Skew': '30 seconds',
        },
      };

      cy.configureProcessor(processorId, config);

      // Verify the configuration was applied
      cy.verifyProcessorProperties(processorId, config.properties);
    });
  });

  it('should validate JWKS server configuration', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      const config = {
        properties: {
          'JWKS Type': 'Server',
          'JWKS URL':
            'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid-connect/certs',
        },
      };

      cy.configureProcessor(processorId, config);

      // Verify JWKS endpoint is accessible
      cy.verifyJwksEndpoint(config.properties['JWKS URL']);
    });
  });

  it('should handle file-based JWKS configuration', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      const config = {
        properties: {
          'JWKS Type': 'File',
          'JWKS File Path': '/path/to/jwks.json',
        },
      };

      cy.configureProcessor(processorId, config);
      cy.verifyProcessorProperties(processorId, config.properties);
    });
  });

  it('should handle in-memory JWKS configuration', () => {
    cy.fixture('jwks/test-jwks.json').then((jwksData) => {
      cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
        const config = {
          properties: {
            'JWKS Type': 'In-Memory',
            'JWKS Content': JSON.stringify(jwksData),
          },
        };

        cy.configureProcessor(processorId, config);
        cy.verifyProcessorProperties(processorId, config.properties);
      });
    });
  });

  it('should validate processor configuration with validation errors', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      // Configure with invalid settings
      cy.navigateToProcessorConfig(processorId);
      cy.get('.processor-configuration-tab').contains('Properties').click();

      // Set invalid JWKS URL
      cy.get('.processor-property-name')
        .contains('JWKS URL')
        .parents('.processor-property-row')
        .find('input')
        .clear()
        .type('invalid-url');

      // Apply configuration
      cy.get('button').contains('Apply').click();

      // Should show validation error
      cy.get('.validation-error, .error-message').should('be.visible');

      // Cancel the configuration
      cy.get('button').contains('Cancel').click();
    });
  });

  it('should support multiple issuer configurations', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      const config = {
        properties: {
          'JWKS Type': 'Server',
          'JWKS URL':
            'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid-connect/certs',
          'Additional Issuers': 'https://issuer1.example.com,https://issuer2.example.com',
          'Issuer Validation': 'true',
        },
      };

      cy.configureProcessor(processorId, config);
      cy.verifyProcessorProperties(processorId, config.properties);
    });
  });
});
