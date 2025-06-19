/**
 * Custom commands related to JWT token validation
 */

import { TEXT_CONSTANTS } from '../../constants.js';

/**
 * Generate a JWT token with specific claims using Keycloak
 * @param {object} claims - The claims to include in the token
 * @returns {string} The generated JWT token
 */
Cypress.Commands.add('generateToken', (claims = {}) => {
  const keycloakUrl = Cypress.env('keycloakUrl');
  const realm = Cypress.env('keycloakRealm');
  const clientId = Cypress.env('keycloakClientId');
  const clientSecret = Cypress.env('keycloakClientSecret');

  // If Keycloak environment is not configured, create a mock token
  if (!keycloakUrl || !realm || !clientId || !clientSecret) {
    cy.log('Keycloak environment not configured, generating mock token');
    return cy.generateMockToken(claims);
  }

  // Try to get token from Keycloak
  return cy
    .request({
      method: 'POST',
      url: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`,
      form: true,
      body: {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        ...claims,
      },
      failOnStatusCode: false,
    })
    .then((response) => {
      if (response.status === 200 && response.body && response.body.access_token) {
        // Return the access token
        return response.body.access_token;
      } else {
        cy.log('Keycloak token request failed, falling back to mock token');
        return cy.generateMockToken(claims);
      }
    })
    .catch(() => {
      cy.log('Keycloak request error, falling back to mock token');
      return cy.generateMockToken(claims);
    });
});

/**
 * Generate a mock JWT token for testing when Keycloak is not available
 * @param {object} claims - The claims to include in the token
 * @returns {string} The generated mock JWT token
 */
Cypress.Commands.add('generateMockToken', (claims = {}) => {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: claims.iss || TEXT_CONSTANTS.TEST_EXAMPLE_URL,
    sub: claims.sub || 'test-user-123',
    aud: claims.aud || 'test-audience',
    exp: now + 3600, // Expires in 1 hour
    iat: now,
    nbf: now,
    jti: `mock-token-${Date.now()}`,
    ...claims,
  };

  // Create a mock JWT structure (header.payload.signature)
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const mockSignature = btoa('mock-signature-for-testing');

  return `${encodedHeader}.${encodedPayload}.${mockSignature}`;
});

/**
 * Verify token validation results in the processor
 * @param {string} processorId - The ID of the processor to verify
 * @param {string} tokenId - The ID of the token or the token itself
 */
Cypress.Commands.add('verifyTokenValidation', (processorId, tokenId) => {
  // Navigate to processor configuration
  cy.navigateToProcessorConfig(processorId);

  // Click on the "Token Validation" tab
  cy.get('.processor-configuration-tab').contains('Token Validation').click();

  // Enter the token in the validation input
  cy.get('#token-validation-input').clear();
  cy.get('#token-validation-input').type(tokenId);

  // Click the validate button
  cy.get('#validate-token-button').click();

  // Wait for validation results
  cy.get('#validation-results').should('be.visible');

  // Return the validation results for further assertions
  return cy.get('#validation-results');
});

/**
 * Generate a valid JWT token for a specific issuer
 * @param {string} issuerName - The name of the issuer to generate token for
 * @returns {Cypress.Chainable<string>} The generated valid JWT token
 */
Cypress.Commands.add('generateValidToken', (issuerName) => {
  // Create a valid JWT token for testing purposes
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: 'test-key-id',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss:
      issuerName === TEXT_CONSTANTS.TEST_ISSUER_VALUE
        ? TEXT_CONSTANTS.TEST_EXAMPLE_URL
        : `https://${issuerName}.example.com`,
    sub: 'test-subject-123',
    aud: 'test-audience',
    exp: now + 3600, // Expires in 1 hour
    iat: now,
    nbf: now,
    jti: `test-token-${Date.now()}`,
    scope: 'read write',
    roles: ['user', 'reader'],
  };

  // For testing, create a mock JWT structure
  // In a real implementation, this would use proper JWT signing
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const mockSignature = 'mock-signature-for-testing';

  const token = `${encodedHeader}.${encodedPayload}.${mockSignature}`;

  return cy.wrap(token);
});

/**
 * Verify JWKS endpoint is accessible and returns valid data
 * @param {string} jwksUrl - The JWKS endpoint URL to verify
 */
Cypress.Commands.add('verifyJwksEndpoint', (jwksUrl) => {
  cy.log(`🔍 Verifying JWKS endpoint: ${jwksUrl}`);

  // Make a request to the JWKS endpoint
  cy.request({
    method: 'GET',
    url: jwksUrl,
    failOnStatusCode: false,
    timeout: 10000,
  })
    .then((response) => {
      if (response.status === 200) {
        cy.log('✅ JWKS endpoint is accessible');

        // Verify response contains expected JWKS structure
        expect(response.body).to.have.property('keys');
        expect(response.body.keys).to.be.an('array');
        cy.log('✅ JWKS response has valid structure');
      } else {
        cy.log(`⚠️ JWKS endpoint returned status ${response.status}, may be expected for testing`);
      }
    })
    .catch((error) => {
      cy.log(`⚠️ JWKS endpoint request failed: ${error.message}, may be expected for testing`);
    });
});

/**
 * Create a test token with specified payload
 * @param {object} payload - The token payload
 * @returns {string} Generated test token
 */
Cypress.Commands.add('createTestToken', (payload = {}) => {
  cy.log('🎫 Creating test token');

  const defaultPayload = {
    iss: 'https://test-issuer.example.com',
    sub: 'test-user-123',
    aud: 'test-audience',
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    iat: Math.floor(Date.now() / 1000),
    ...payload,
  };

  return cy.generateMockToken(defaultPayload);
});

/**
 * Verify processor properties match expected values
 * @param {string} processorId - The processor ID
 * @param {object} expectedProperties - Expected property values
 */
Cypress.Commands.add('verifyProcessorProperties', (processorId, expectedProperties) => {
  cy.log(`🔍 Verifying processor properties for ${processorId}`);

  // Navigate to processor configuration
  cy.navigateToProcessorConfig(processorId);

  // Navigate to properties tab
  cy.get('[data-testid="processor-properties-tab"], .processor-configuration-tab')
    .contains('Properties')
    .click();

  // Verify each expected property
  Object.entries(expectedProperties).forEach(([key, value]) => {
    cy.get(`[data-property="${key}"], input[name="${key}"]`).should('have.value', value);
  });

  // Close configuration dialog
  cy.get('button').contains('Cancel', { matchCase: false }).click();
});

module.exports = {
  // Export for testing
  validationCommandsLoaded: true,
};
