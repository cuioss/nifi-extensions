/**
 * End-to-End tests for MultiIssuerJWTTokenAuthenticator processor configuration
 */

import { SELECTORS, TEXT_CONSTANTS, COMMON_STRINGS } from '../../support/constants.js';

describe('Processor Configuration E2E Tests', () => {
  beforeEach(() => {
    // Login and navigate to canvas before each test
    cy.nifiLogin('admin', 'adminadminadmin');
    cy.navigateToCanvas();
  });

  it('should add and configure MultiIssuerJWTTokenAuthenticator processor', () => {
    // Add the processor to the canvas
    cy.addProcessor(TEXT_CONSTANTS.MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR).then((processorId) => {
      // Configure basic properties
      const config = {
        name: 'JWT Token Authenticator',
        properties: {
          'JWKS Type': COMMON_STRINGS.SERVER_TYPE,
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
    cy.addProcessor(TEXT_CONSTANTS.MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR).then((processorId) => {
      const config = {
        properties: {
          'JWKS Type': COMMON_STRINGS.SERVER_TYPE,
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
    cy.addProcessor(TEXT_CONSTANTS.MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR).then((processorId) => {
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
      cy.addProcessor(TEXT_CONSTANTS.MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR).then((processorId) => {
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
    cy.addProcessor(TEXT_CONSTANTS.MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR).then((processorId) => {
      // Configure with invalid settings
      cy.navigateToProcessorConfig(processorId);
      cy.get(SELECTORS.PROCESSOR_CONFIG_TAB).contains(TEXT_CONSTANTS.PROPERTIES).click();

      // Set invalid JWKS URL
      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains(TEXT_CONSTANTS.JWKS_URL)
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('input')
        .clear();
      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains(TEXT_CONSTANTS.JWKS_URL)
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('input')
        .type('invalid-url');

      // Apply configuration
      cy.get('button').contains(TEXT_CONSTANTS.APPLY).click();

      // Should show validation error
      cy.get('.validation-error, .error-message').should(TEXT_CONSTANTS.BE_VISIBLE);

      // Cancel the configuration
      cy.get('button').contains('Cancel').click();
    });
  });

  it('should support multiple issuer configurations', () => {
    cy.addProcessor(TEXT_CONSTANTS.MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR).then((processorId) => {
      const config = {
        properties: {
          'JWKS Type': COMMON_STRINGS.SERVER_TYPE,
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
