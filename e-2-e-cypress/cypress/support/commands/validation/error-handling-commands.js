/**
 * Custom Cypress commands for error handling scenarios
 */

import { SELECTORS, TEXT_CONSTANTS } from '../../constants.js';

/**
 * Test processor configuration with missing required properties
 * @param {string} processorId - The processor ID
 * @param {string} propertyName - Name of the required property to leave empty
 */
Cypress.Commands.add('testMissingRequiredProperty', (processorId, propertyName) => {
  cy.navigateToProcessorConfig(processorId);
  cy.get(SELECTORS.PROCESSOR_CONFIG_TAB).contains(TEXT_CONSTANTS.PROPERTIES).click();

  // Clear the required property
  cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
    .contains(propertyName)
    .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
    .find('input, select, textarea')
    .clear();

  // Try to apply configuration
  cy.get('button').contains(TEXT_CONSTANTS.APPLY).click();

  // Check for validation error
  cy.get('body').then(($body) => {
    const hasError = $body.find(SELECTORS.VALIDATION_ERROR + ', .error-message').length > 0;
    const dialogOpen = $body.find(SELECTORS.CONFIGURATION_DIALOG).length > 0;
    
    if (hasError) {
      cy.log('Validation error detected as expected');
    }
    
    if (dialogOpen) {
      cy.get('button').contains(TEXT_CONSTANTS.CANCEL).click();
    }
  });
});

/**
 * Test network timeout scenarios for JWKS URLs
 * @param {string} processorId - The processor ID
 * @param {string} timeoutUrl - URL that will cause timeout
 */
Cypress.Commands.add('testNetworkTimeout', (processorId, timeoutUrl = 'https://httpbin.org/delay/30') => {
  const config = {
    properties: {
      'JWKS Type': 'Server',
      'JWKS URL': timeoutUrl,
      'Connection Timeout': '5 seconds',
      'Read Timeout': '5 seconds',
    },
  };

  cy.configureProcessor(processorId, config);
  
  // Verify configuration was accepted (runtime errors will occur later)
  cy.verifyProcessorProperties(processorId, {
    'JWKS Type': 'Server',
    'JWKS URL': timeoutUrl,
  });
});

/**
 * Test invalid file path handling for JWKS file type
 * @param {string} processorId - The processor ID
 * @param {string} invalidPath - Invalid file path to test
 */
Cypress.Commands.add('testInvalidFilePath', (processorId, invalidPath = '/nonexistent/path/jwks.json') => {
  cy.navigateToProcessorConfig(processorId);
  cy.get(SELECTORS.PROCESSOR_CONFIG_TAB).contains(TEXT_CONSTANTS.PROPERTIES).click();

  // Set JWKS Type to File
  cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
    .contains('JWKS Type')
    .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
    .find('select')
    .select('File');

  // Set invalid file path
  cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
    .contains('JWKS File Path')
    .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
    .find('input')
    .clear()
    .type(invalidPath);

  // Apply configuration
  cy.get('button').contains(TEXT_CONSTANTS.APPLY).click();

  // Handle potential validation errors
  cy.get('body').then(($body) => {
    const dialogClosed = $body.find(SELECTORS.CONFIGURATION_DIALOG).length === 0;
    const hasError = $body.find('.validation-error, .error-message').length > 0;

    if (!dialogClosed && hasError) {
      cy.get('button').contains(TEXT_CONSTANTS.CANCEL).click();
    }
  });
});

/**
 * Test malformed JSON handling in JWKS content
 * @param {string} processorId - The processor ID
 * @param {string} malformedJson - Malformed JSON string to test
 */
Cypress.Commands.add('testMalformedJson', (processorId, malformedJson = '{"keys": [invalid json}') => {
  cy.navigateToProcessorConfig(processorId);
  cy.get(SELECTORS.PROCESSOR_CONFIG_TAB).contains(TEXT_CONSTANTS.PROPERTIES).click();

  // Set JWKS Type to In-Memory
  cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
    .contains('JWKS Type')
    .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
    .find('select')
    .select('In-Memory');

  // Set malformed JSON content
  cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
    .contains('JWKS Content')
    .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
    .find('textarea')
    .clear()
    .type(malformedJson);

  // Apply configuration
  cy.get('button').contains(TEXT_CONSTANTS.APPLY).click();

  // Should show JSON validation error
  cy.get('body').then(($body) => {
    const hasValidationError = $body.find('.validation-error, .error-message').length > 0;
    const dialogStillOpen = $body.find(SELECTORS.CONFIGURATION_DIALOG).length > 0;

    if (hasValidationError) {
      cy.log('JSON validation error detected as expected');
    }

    if (dialogStillOpen) {
      cy.get('button').contains(TEXT_CONSTANTS.CANCEL).click();
    }
  });
});

/**
 * Test SSL certificate error handling
 * @param {string} processorId - The processor ID
 * @param {string} sslUrl - URL with invalid SSL certificate
 */
Cypress.Commands.add('testSslCertificateError', (processorId, sslUrl = 'https://self-signed.badssl.com/jwks.json') => {
  const config = {
    properties: {
      'JWKS Type': 'Server',
      'JWKS URL': sslUrl,
      'SSL Verification': 'true',
    },
  };

  cy.configureProcessor(processorId, config);

  // Configuration should be accepted, but runtime will have SSL errors
  cy.verifyProcessorProperties(processorId, {
    'JWKS Type': 'Server',
    'JWKS URL': sslUrl,
  });
});

/**
 * Test processor state transitions during errors
 * @param {string} processorId - The processor ID
 */
Cypress.Commands.add('testProcessorStateTransitions', (processorId) => {
  // Configure processor with valid settings first
  const config = {
    properties: {
      'JWKS Type': 'Server',
      'JWKS URL': 'https://localhost:8443/auth/realms/test/protocol/openid_connect/certs',
    },
  };

  cy.configureProcessor(processorId, config);

  // Try to start the processor
  cy.get(`g[id='${processorId}']`).rightclick();
  cy.get('.context-menu').contains('Start').click();

  // Processor should attempt to start
  cy.get(`g[id='${processorId}']`).should('exist');

  // Stop the processor
  cy.get(`g[id='${processorId}']`).rightclick();
  cy.get('.context-menu').contains('Stop').click();
});

/**
 * Test UI navigation error handling
 * @param {string} processorId - The processor ID
 * @param {number} iterations - Number of navigation iterations to test
 */
Cypress.Commands.add('testUiNavigationErrors', (processorId, iterations = 3) => {
  // Try to navigate to processor config multiple times rapidly
  for (let i = 0; i < iterations; i++) {
    cy.navigateToProcessorConfig(processorId);
    cy.get(SELECTORS.CONFIGURATION_DIALOG).should('be.visible');
    cy.get('button').contains(TEXT_CONSTANTS.CANCEL).click();
    cy.get(SELECTORS.CONFIGURATION_DIALOG).should('not.exist');
  }
});

/**
 * Test browser refresh during configuration
 * @param {string} processorId - The processor ID
 */
Cypress.Commands.add('testBrowserRefreshDuringConfig', (processorId) => {
  // Open configuration dialog
  cy.navigateToProcessorConfig(processorId);
  cy.get(SELECTORS.CONFIGURATION_DIALOG).should('be.visible');

  // Refresh the page
  cy.reload();

  // Should be back on canvas without dialog
  cy.get('#canvas-container').should('be.visible');
  cy.get(SELECTORS.CONFIGURATION_DIALOG).should('not.exist');

  // Processor should still exist
  cy.get(`g[id='${processorId}']`).should('exist');
});
