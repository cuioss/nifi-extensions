/**
 * Custom commands related to JWT token validation
 */

import { TEXT_CONSTANTS } from '../../constants.js';

/**
 * Generate a JWT token with specific claims using Keycloak
 * @param {object} claims - The claims to include in the token
 * @returns {string} The generated JWT token
 */
Cypress.Commands.add('generateToken', (claims) => {
  const keycloakUrl = Cypress.env('keycloakUrl');
  const realm = Cypress.env('keycloakRealm');
  const clientId = Cypress.env('keycloakClientId');
  const clientSecret = Cypress.env('keycloakClientSecret');

  // Get token from Keycloak
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
    })
    .then((response) => {
      // Return the access token
      return response.body.access_token;
    });
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
