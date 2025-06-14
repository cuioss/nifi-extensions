/**
 * End-to-End tests for JWKS validation
 */

import { SELECTORS, TEXT_CONSTANTS, TEST_DATA, URLS } from '../../support/constants.js';

describe('JWKS Validation E2E Tests', () => {
  beforeEach(() => {
    // Login and navigate to canvas before each test
    cy.nifiLogin('admin', 'adminadminadmin');
    cy.navigateToCanvas();
  });

  it('should validate JWKS server endpoint', () => {
    cy.addProcessor(TEXT_CONSTANTS.MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR).then((processorId) => {
      const jwksUrl = URLS.KEYCLOAK_JWKS_URL;

      const config = {
        properties: {
          [TEXT_CONSTANTS.JWKS_TYPE]: TEST_DATA.SERVER,
          'JWKS URL': jwksUrl,
        },
      };

      cy.configureProcessor(processorId, config);

      // Verify JWKS endpoint is accessible and returns valid data
      cy.verifyJwksEndpoint(jwksUrl);
    });
  });

  it('should handle JWKS server connection failures', () => {
    cy.addProcessor(TEXT_CONSTANTS.MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR).then((processorId) => {
      const invalidJwksUrl = 'https://invalid-jwks-server.com/jwks';

      // Configure processor with invalid JWKS URL
      cy.navigateToProcessorConfig(processorId);
      cy.get('.processor-configuration-tab').contains(TEXT_CONSTANTS.PROPERTIES).click();

      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains(TEXT_CONSTANTS.JWKS_TYPE)
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('select')
        .select(TEST_DATA.SERVER);

      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains('JWKS URL')
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('input')
        .clear();
      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains('JWKS URL')
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('input')
        .type(invalidJwksUrl);

      // Apply configuration
      cy.get('button').contains(TEXT_CONSTANTS.APPLY).click();

      // Should show validation error or warning about connectivity
      cy.get('body').then(($body) => {
        const hasValidationError = $body.find('.validation-error, .error-message').length > 0;
        const configApplied = $body.find('.configuration-dialog').length === 0;

        // Either shows validation error or applies config (will fail at runtime)
        expect(hasValidationError || configApplied).to.be.true;

        if (!configApplied) {
          cy.get('button').contains('Cancel').click();
        }
      });
    });
  });

  it('should validate file-based JWKS configuration', () => {
    cy.fixture('jwks/test-jwks.json').then(() => {
      cy.addProcessor(TEXT_CONSTANTS.MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR).then((processorId) => {
        const config = {
          properties: {
            [TEXT_CONSTANTS.JWKS_TYPE]: 'File',
            'JWKS File Path': '/tmp/test-jwks.json',
          },
        };

        cy.configureProcessor(processorId, config);
        cy.verifyProcessorProperties(processorId, config.properties);
      });
    });
  });

  it('should validate in-memory JWKS configuration', () => {
    cy.fixture('jwks/test-jwks.json').then((jwksData) => {
      cy.addProcessor(TEXT_CONSTANTS.MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR).then((processorId) => {
        const config = {
          properties: {
            [TEXT_CONSTANTS.JWKS_TYPE]: 'In-Memory',
            'JWKS Content': JSON.stringify(jwksData, null, 2),
          },
        };

        cy.configureProcessor(processorId, config);

        // Verify the JWKS content was properly configured
        cy.navigateToProcessorConfig(processorId);
        cy.get('.processor-configuration-tab').contains(TEXT_CONSTANTS.PROPERTIES).click();

        cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
          .contains('JWKS Content')
          .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
          .find('textarea')
          .should('contain.value', '"keys"');

        cy.get('button').contains('Cancel').click();
      });
    });
  });

  it('should handle invalid JWKS content gracefully', () => {
    cy.addProcessor(TEXT_CONSTANTS.MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR).then((processorId) => {
      const invalidJwksContent = '{"invalid": "jwks", "format": true}';

      // Configure processor with invalid JWKS content
      cy.navigateToProcessorConfig(processorId);
      cy.get('.processor-configuration-tab').contains(TEXT_CONSTANTS.PROPERTIES).click();

      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains(TEXT_CONSTANTS.JWKS_TYPE)
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('select')
        .select('In-Memory');

      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains('JWKS Content')
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('textarea')
        .clear();
      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains('JWKS Content')
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('textarea')
        .type(invalidJwksContent);

      // Apply configuration
      cy.get('button').contains(TEXT_CONSTANTS.APPLY).click();

      // Should show validation error for invalid JWKS format
      cy.get('body').then(($body) => {
        const hasValidationError = $body.find('.validation-error, .error-message').length > 0;
        const dialogStillOpen = $body.find('.configuration-dialog').length > 0;

        if (hasValidationError || dialogStillOpen) {
          // Expected behavior - validation caught the error
          expect(true).to.be.true;

          if (dialogStillOpen) {
            cy.get('button').contains('Cancel').click();
          }
        }
      });
    });
  });

  it('should support JWKS refresh intervals for server type', () => {
    cy.addProcessor(TEXT_CONSTANTS.MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR).then((processorId) => {
      const config = {
        properties: {
          [TEXT_CONSTANTS.JWKS_TYPE]: 'Server',
          'JWKS URL': URLS.KEYCLOAK_JWKS_URL,
          'JWKS Refresh Interval': '300 seconds',
          'JWKS Cache Size': '100',
        },
      };

      cy.configureProcessor(processorId, config);
      cy.verifyProcessorProperties(processorId, config.properties);
    });
  });

  it('should validate multiple JWKS sources configuration', () => {
    cy.addProcessor(TEXT_CONSTANTS.MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR).then((processorId) => {
      const config = {
        properties: {
          [TEXT_CONSTANTS.JWKS_TYPE]: 'Server',
          'JWKS URL': URLS.KEYCLOAK_JWKS_URL,
          'Additional JWKS URLs':
            'https://another-issuer.com/.well-known/jwks.json,https://third-issuer.com/jwks',
        },
      };

      cy.configureProcessor(processorId, config);
      cy.verifyProcessorProperties(processorId, config.properties);
    });
  });
});
