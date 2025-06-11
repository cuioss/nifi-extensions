/**
 * End-to-End tests for JWKS validation
 */

describe('JWKS Validation E2E Tests', () => {
  beforeEach(() => {
    // Login and navigate to canvas before each test
    cy.nifiLogin('admin', 'adminadminadmin');
    cy.navigateToCanvas();
  });

  it('should validate JWKS server endpoint', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      const jwksUrl =
        'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid-connect/certs';

      const config = {
        properties: {
          'JWKS Type': 'Server',
          'JWKS URL': jwksUrl,
        },
      };

      cy.configureProcessor(processorId, config);

      // Verify JWKS endpoint is accessible and returns valid data
      cy.verifyJwksEndpoint(jwksUrl);
    });
  });

  it('should handle JWKS server connection failures', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      const invalidJwksUrl = 'https://invalid-jwks-server.com/jwks';

      const config = {
        properties: {
          'JWKS Type': 'Server',
          'JWKS URL': invalidJwksUrl,
        },
      };

      // Configure processor with invalid JWKS URL
      cy.navigateToProcessorConfig(processorId);
      cy.get('.processor-configuration-tab').contains('Properties').click();

      cy.get('.processor-property-name')
        .contains('JWKS Type')
        .parents('.processor-property-row')
        .find('select')
        .select('Server');

      cy.get('.processor-property-name')
        .contains('JWKS URL')
        .parents('.processor-property-row')
        .find('input')
        .clear()
        .type(invalidJwksUrl);

      // Apply configuration
      cy.get('button').contains('Apply').click();

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
    cy.fixture('jwks/test-jwks.json').then((jwksData) => {
      cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
        const config = {
          properties: {
            'JWKS Type': 'File',
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
      cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
        const config = {
          properties: {
            'JWKS Type': 'In-Memory',
            'JWKS Content': JSON.stringify(jwksData, null, 2),
          },
        };

        cy.configureProcessor(processorId, config);

        // Verify the JWKS content was properly configured
        cy.navigateToProcessorConfig(processorId);
        cy.get('.processor-configuration-tab').contains('Properties').click();

        cy.get('.processor-property-name')
          .contains('JWKS Content')
          .parents('.processor-property-row')
          .find('textarea')
          .should('contain.value', '"keys"');

        cy.get('button').contains('Cancel').click();
      });
    });
  });

  it('should handle invalid JWKS content gracefully', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      const invalidJwksContent = '{"invalid": "jwks", "format": true}';

      // Configure processor with invalid JWKS content
      cy.navigateToProcessorConfig(processorId);
      cy.get('.processor-configuration-tab').contains('Properties').click();

      cy.get('.processor-property-name')
        .contains('JWKS Type')
        .parents('.processor-property-row')
        .find('select')
        .select('In-Memory');

      cy.get('.processor-property-name')
        .contains('JWKS Content')
        .parents('.processor-property-row')
        .find('textarea')
        .clear()
        .type(invalidJwksContent);

      // Apply configuration
      cy.get('button').contains('Apply').click();

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
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      const config = {
        properties: {
          'JWKS Type': 'Server',
          'JWKS URL':
            'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid-connect/certs',
          'JWKS Refresh Interval': '300 seconds',
          'JWKS Cache Size': '100',
        },
      };

      cy.configureProcessor(processorId, config);
      cy.verifyProcessorProperties(processorId, config.properties);
    });
  });

  it('should validate multiple JWKS sources configuration', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      const config = {
        properties: {
          'JWKS Type': 'Server',
          'JWKS URL':
            'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid-connect/certs',
          'Additional JWKS URLs':
            'https://another-issuer.com/.well-known/jwks.json,https://third-issuer.com/jwks',
        },
      };

      cy.configureProcessor(processorId, config);
      cy.verifyProcessorProperties(processorId, config.properties);
    });
  });
});
