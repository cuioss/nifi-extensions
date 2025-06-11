/**
 * Custom commands related to JWT token validation
 */

/**
 * Generate a JWT token with specific claims using Keycloak
 * @param {Object} claims - The claims to include in the token
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
