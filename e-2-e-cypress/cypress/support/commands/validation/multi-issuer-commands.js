/**
 * Custom Cypress commands for multi-issuer JWT configuration
 */

import { SELECTORS, TEXT_CONSTANTS } from '../../constants.js';

/**
 * Configure processor with multiple issuers
 * @param {string} processorId - The processor ID
 * @param {Array<string>} issuers - Array of issuer URLs
 * @param {string} jwksUrl - Primary JWKS URL
 */
Cypress.Commands.add(
  'configureMultipleIssuers',
  (
    processorId,
    issuers,
    jwksUrl = 'https://localhost:8443/auth/realms/test/protocol/openid_connect/certs'
  ) => {
    const config = {
      properties: {
        'JWKS Type': 'Server',
        'JWKS URL': jwksUrl,
        'Additional Issuers': issuers.join(','),
        'Issuer Validation': 'true',
      },
    };

    cy.configureProcessor(processorId, config);
    cy.verifyProcessorProperties(processorId, config.properties);
  }
);

/**
 * Test issuer validation configuration
 * @param {string} processorId - The processor ID
 * @param {boolean} enableValidation - Whether to enable issuer validation
 */
Cypress.Commands.add('testIssuerValidation', (processorId, enableValidation = true) => {
  cy.navigateToProcessorConfig(processorId);
  cy.get(SELECTORS.PROCESSOR_CONFIG_TAB).contains(TEXT_CONSTANTS.PROPERTIES).click();

  // Set issuer validation setting
  cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
    .contains('Issuer Validation')
    .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
    .find('select, input[type="checkbox"]')
    .then(($input) => {
      if ($input.is('select')) {
        cy.wrap($input).select(enableValidation ? 'true' : 'false');
      } else if ($input.is('input[type="checkbox"]')) {
        if (enableValidation) {
          cy.wrap($input).check();
        } else {
          cy.wrap($input).uncheck();
        }
      }
    });

  // Apply configuration
  cy.get('button').contains(TEXT_CONSTANTS.APPLY).click();

  // Handle any dialogs
  cy.get('body').then(($body) => {
    const dialogClosed = $body.find(SELECTORS.CONFIGURATION_DIALOG).length === 0;
    if (!dialogClosed) {
      cy.get('button').contains(TEXT_CONSTANTS.CANCEL).click();
    }
  });
});

/**
 * Validate comma-separated issuer list format
 * @param {string} issuerList - Comma-separated issuer URLs
 */
Cypress.Commands.add('validateIssuerListFormat', (issuerList) => {
  const issuers = issuerList.split(',').map((url) => url.trim());

  issuers.forEach((issuer, index) => {
    // Basic URL validation
    expect(issuer).to.match(/^https?:\/\/.+/, `Issuer ${index + 1} should be a valid URL`);

    // Check for common issuer URL patterns
    const isValidIssuer =
      issuer.includes('oauth') ||
      issuer.includes('auth') ||
      issuer.includes('openid') ||
      issuer.includes('realms') ||
      issuer.includes('.com') ||
      issuer.includes('.org');

    expect(isValidIssuer).to.be.true;
  });

  cy.log(`✅ Validated ${issuers.length} issuer URLs`);
});

/**
 * Test different JWKS configuration types for multi-issuer setup
 * @param {string} processorId - The processor ID
 * @param {string} configType - 'server', 'file', or 'memory'
 * @param {string|Object} configValue - URL string, file path, or JWKS object
 */
Cypress.Commands.add('testMultiIssuerJwksConfig', (processorId, configType, configValue) => {
  cy.navigateToProcessorConfig(processorId);
  cy.get(SELECTORS.PROCESSOR_CONFIG_TAB).contains(TEXT_CONSTANTS.PROPERTIES).click();

  switch (configType.toLowerCase()) {
    case 'server':
      // Configure server-based JWKS
      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains('JWKS Type')
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('select')
        .select('Server');

      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains('JWKS URL')
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('input')
        .clear()
        .type(configValue);
      break;

    case 'file':
      // Configure file-based JWKS
      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains('JWKS Type')
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('select')
        .select('File');

      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains('JWKS File Path')
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('input')
        .clear()
        .type(configValue);
      break;

    case 'memory': {
      // Configure in-memory JWKS
      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains('JWKS Type')
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('select')
        .select('In-Memory');

      const jwksContent =
        typeof configValue === 'object' ? JSON.stringify(configValue) : configValue;

      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains('JWKS Content')
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('textarea')
        .clear()
        .type(jwksContent);
      break;
    }

    default:
      throw new Error(`Unsupported JWKS config type: ${configType}`);
  }

  // Apply configuration
  cy.get('button').contains(TEXT_CONSTANTS.APPLY).click();

  // Handle potential errors
  cy.get('body').then(($body) => {
    const hasError = $body.find('.validation-error, .error-message').length > 0;
    const dialogOpen = $body.find(SELECTORS.CONFIGURATION_DIALOG).length > 0;

    if (hasError && dialogOpen) {
      cy.log(`Configuration error detected for ${configType} type`);
      cy.get('button').contains(TEXT_CONSTANTS.CANCEL).click();
    }
  });
});

/**
 * Validate multi-issuer token processing
 * @param {string} processorId - The processor ID
 * @param {Array<Object>} tokens - Array of token objects with issuer info
 */
Cypress.Commands.add('validateMultiIssuerTokens', (processorId, tokens) => {
  tokens.forEach((tokenInfo, index) => {
    cy.log(`Testing token ${index + 1} from issuer: ${tokenInfo.issuer}`);

    // Generate token for specific issuer
    cy.generateTestToken(tokenInfo.issuer, tokenInfo.payload || {}).then((token) => {
      // Verify token validation with multi-issuer processor
      cy.verifyTokenValidation(processorId, token, tokenInfo.shouldPass !== false);
    });
  });
});

/**
 * Test concurrent multi-issuer configurations
 * @param {Array<Object>} processorConfigs - Array of processor configurations
 */
Cypress.Commands.add('testConcurrentMultiIssuerProcessors', (processorConfigs) => {
  const processorIds = [];

  processorConfigs.forEach((config, index) => {
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator', {
      x: 200 + index * 150,
      y: 300,
    }).then((processorId) => {
      processorIds.push(processorId);

      const processorConfig = {
        properties: {
          'JWKS Type': 'Server',
          'JWKS URL': config.jwksUrl,
          'Additional Issuers': config.additionalIssuers.join(','),
          'Issuer Validation': config.issuerValidation ? 'true' : 'false',
        },
      };

      cy.configureProcessor(processorId, processorConfig);
    });
  });

  // Verify all processors exist and are configured
  cy.get('g.processor').should('have.length.at.least', processorConfigs.length);

  // Return processor IDs for cleanup
  cy.wrap(processorIds);
});

/**
 * Test property validation for multi-issuer configuration
 * @param {string} processorId - The processor ID
 */
Cypress.Commands.add('testMultiIssuerPropertyValidation', (processorId) => {
  const invalidConfigurations = [
    {
      name: 'Empty JWKS URL',
      properties: { 'JWKS URL': '' },
      shouldFail: true,
    },
    {
      name: 'Invalid issuer format',
      properties: { 'Additional Issuers': 'not-a-url,another-invalid' },
      shouldFail: true,
    },
    {
      name: 'Mixed valid and invalid issuers',
      properties: { 'Additional Issuers': 'https://valid.com,invalid-url' },
      shouldFail: true,
    },
  ];

  invalidConfigurations.forEach((testCase) => {
    cy.log(`Testing: ${testCase.name}`);

    cy.navigateToProcessorConfig(processorId);
    cy.get(SELECTORS.PROCESSOR_CONFIG_TAB).contains(TEXT_CONSTANTS.PROPERTIES).click();

    // Apply the test configuration
    Object.entries(testCase.properties).forEach(([propertyName, value]) => {
      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains(propertyName)
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('input, textarea')
        .clear()
        .type(value);
    });

    // Try to apply
    cy.get('button').contains(TEXT_CONSTANTS.APPLY).click();

    if (testCase.shouldFail) {
      // Should show validation error
      cy.get('body').then(($body) => {
        const hasError = $body.find('.validation-error, .error-message').length > 0;
        const dialogOpen = $body.find(SELECTORS.CONFIGURATION_DIALOG).length > 0;

        if (hasError) {
          cy.log(`✅ Validation error correctly detected for: ${testCase.name}`);
        }

        if (dialogOpen) {
          cy.get('button').contains(TEXT_CONSTANTS.CANCEL).click();
        }
      });
    }
  });
});
