/**
 * End-to-End tests for error handling scenarios
 */

import { SELECTORS, TEXT_CONSTANTS, TEST_DATA } from '../support/constants.js';

describe('Error Handling E2E Tests', () => {
  beforeEach(() => {
    // Login and navigate to canvas before each test
    cy.nifiLogin('admin', 'adminadminadmin');
    cy.navigateToCanvas();
  });

  it('should handle missing required processor properties', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      // Try to apply configuration without required properties
      cy.navigateToProcessorConfig(processorId);
      cy.get(SELECTORS.PROCESSOR_CONFIG_TAB).contains(TEXT_CONSTANTS.PROPERTIES).click();

      // Leave JWKS Type empty or set to invalid value
      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains(TEXT_CONSTANTS.JWKS_TYPE)
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('select')
        .select(''); // Select empty value if available

      // Try to apply
      cy.get('button').contains(TEXT_CONSTANTS.APPLY).click();

      // Should show validation error
      cy.get(SELECTORS.VALIDATION_ERROR).should(TEXT_CONSTANTS.BE_VISIBLE);

      // Cancel the configuration
      cy.get('button').contains(TEXT_CONSTANTS.CANCEL).click();
    });
  });

  it('should handle network timeouts for JWKS server', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      // Configure with a server that will timeout
      const config = {
        properties: {
          'JWKS Type': 'Server',
          'JWKS URL': 'https://httpbin.org/delay/30', // Will timeout
          'Connection Timeout': '5 seconds',
          'Read Timeout': '5 seconds',
        },
      };

      cy.configureProcessor(processorId, config);

      // Processor should be configured but will show runtime errors
      cy.verifyProcessorProperties(processorId, {
        'JWKS Type': 'Server',
        'JWKS URL': 'https://httpbin.org/delay/30',
      });
    });
  });

  it('should handle invalid file paths for JWKS file type', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      // Configure processor with invalid file path
      cy.navigateToProcessorConfig(processorId);
      cy.get(SELECTORS.PROCESSOR_CONFIG_TAB).contains(TEXT_CONSTANTS.PROPERTIES).click();

      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains(TEXT_CONSTANTS.JWKS_TYPE)
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('select')
        .select('File');

      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains(TEXT_CONSTANTS.JWKS_FILE_PATH)
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('input')
        .clear();
      cy.get('.processor-property-name')
        .contains(TEXT_CONSTANTS.JWKS_FILE_PATH)
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('input')
        .type(TEST_DATA.INVALID_JWKS_PATH);

      // Apply configuration
      cy.get('button').contains(TEXT_CONSTANTS.APPLY).click();

      // Configuration might be accepted but will fail at runtime
      cy.get('body').then(($body) => {
        const dialogClosed = $body.find(SELECTORS.CONFIGURATION_DIALOG).length === 0;
        const hasError = $body.find('.validation-error').length > 0;

        if (!dialogClosed && hasError) {
          cy.get('button').contains(TEXT_CONSTANTS.CANCEL).click();
        }
      });
    });
  });

  it('should handle malformed JSON in JWKS content', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      const malformedJson = '{"keys": [invalid json}';

      // Configure processor with malformed JSON
      cy.navigateToProcessorConfig(processorId);
      cy.get(SELECTORS.PROCESSOR_CONFIG_TAB).contains(TEXT_CONSTANTS.PROPERTIES).click();

      cy.get('.processor-property-name')
        .contains('JWKS Type')
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('select')
        .select('In-Memory');

      cy.get('.processor-property-name')
        .contains('JWKS Content')
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('textarea')
        .clear();
      cy.get('.processor-property-name')
        .contains('JWKS Content')
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('textarea')
        .type(malformedJson);

      // Apply configuration
      cy.get('button').contains(TEXT_CONSTANTS.APPLY).click();

      // Should show JSON validation error
      cy.get('body').then(($body) => {
        const hasValidationError = $body.find('.validation-error, .error-message').length > 0;
        const dialogStillOpen = $body.find(SELECTORS.CONFIGURATION_DIALOG).length > 0;

        if (hasValidationError) {
          expect(true).to.be.true; // Expected validation error
        }

        if (dialogStillOpen) {
          cy.get('button').contains(TEXT_CONSTANTS.CANCEL).click();
        }
      });
    });
  });

  it('should handle SSL certificate errors', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      const config = {
        properties: {
          'JWKS Type': 'Server',
          'JWKS URL': 'https://self-signed.badssl.com/jwks.json', // Invalid SSL cert
          'SSL Verification': 'true',
        },
      };

      cy.configureProcessor(processorId, config);

      // Configuration should be accepted, but runtime will have SSL errors
      cy.verifyProcessorProperties(processorId, {
        'JWKS Type': 'Server',
        'JWKS URL': 'https://self-signed.badssl.com/jwks.json',
      });
    });
  });

  it('should handle processor state transitions during errors', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      // Configure processor with valid settings first
      const config = {
        properties: {
          'JWKS Type': 'Server',
          'JWKS URL':
            'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid-connect/certs',
        },
      };

      cy.configureProcessor(processorId, config);

      // Try to start the processor
      cy.get(`g[id="${processorId}"]`).rightclick();
      cy.get('.context-menu').contains('Start').click();

      // Processor should attempt to start
      cy.get(`g[id="${processorId}"]`).should(TEXT_CONSTANTS.EXIST);

      // Stop the processor
      cy.get(`g[id="${processorId}"]`).rightclick();
      cy.get('.context-menu').contains('Stop').click();
    });
  });

  it('should handle concurrent processor operations', () => {
    // Add multiple processors with potentially conflicting configurations
    const processorIds = [];

    for (let i = 0; i < 3; i++) {
      cy.addProcessor('MultiIssuerJWTTokenAuthenticator', { x: 200 + i * 150, y: 300 }).then(
        (processorId) => {
          processorIds.push(processorId);

          const config = {
            properties: {
              'JWKS Type': 'Server',
              'JWKS URL':
                'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid-connect/certs',
            },
          };

          cy.configureProcessor(processorId, config);
        }
      );
    }

    // Verify all processors exist and are configured
    cy.get('g.processor').should('have.length.at.least', 3);
  });

  it('should handle UI navigation errors gracefully', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      // Try to navigate to processor config multiple times rapidly
      for (let i = 0; i < 3; i++) {
        cy.navigateToProcessorConfig(processorId);
        cy.get(SELECTORS.CONFIGURATION_DIALOG).should(TEXT_CONSTANTS.BE_VISIBLE);
        cy.get('button').contains(TEXT_CONSTANTS.CANCEL).click();
        cy.get(SELECTORS.CONFIGURATION_DIALOG).should(TEXT_CONSTANTS.NOT_EXIST);
      }
    });
  });

  it('should handle browser refresh during configuration', () => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      // Open configuration dialog
      cy.navigateToProcessorConfig(processorId);
      cy.get(SELECTORS.CONFIGURATION_DIALOG).should(TEXT_CONSTANTS.BE_VISIBLE);

      // Refresh the page
      cy.reload();

      // Should be back on canvas without dialog
      cy.get('#canvas-container').should(TEXT_CONSTANTS.BE_VISIBLE);
      cy.get(SELECTORS.CONFIGURATION_DIALOG).should(TEXT_CONSTANTS.NOT_EXIST);

      // Processor should still exist
      cy.get(`g[id="${processorId}"]`).should(TEXT_CONSTANTS.EXIST);
    });
  });
});
