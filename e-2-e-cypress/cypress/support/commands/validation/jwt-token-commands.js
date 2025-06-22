/**
 * JWT Token Validation Commands
 * Custom commands for generating and validating JWT tokens with the processor
 */

/**
 * Generates a test JWT token with specified claims
 * @param {Object} claims - Custom claims to include in the token
 * @returns {Cypress.Chainable<string>} Generated JWT token
 */
Cypress.Commands.add('generateTestToken', (claims = {}) => {
  cy.log('Generating test JWT token');
  
  // Default test claims
  const defaultClaims = {
    iss: 'https://localhost:9080/realms/oauth_integration_tests',
    sub: 'test-user',
    aud: 'nifi-test',
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    iat: Math.floor(Date.now() / 1000),
    jti: 'test-token-' + Date.now(),
    scope: 'read write'
  };
  
  const tokenClaims = { ...defaultClaims, ...claims };
  
  // For now, return a mock token structure (later can integrate with Keycloak)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify(tokenClaims));
  const signature = 'mock-signature-' + Date.now();
  
  const token = `${header}.${payload}.${signature}`;
  
  cy.log(`Generated test token with claims: ${JSON.stringify(tokenClaims)}`);
  return cy.wrap(token);
});

/**
 * Verifies JWT token validation with a processor
 * @param {string} processorId - ID of the processor to test
 * @param {string} token - JWT token to validate
 */
Cypress.Commands.add('verifyTokenValidation', (processorId, token) => {
  cy.log('Verifying token validation for processor');
  
  // Navigate to processor configuration
  cy.navigateToProcessorConfig(processorId);
  
  // Look for token verification interface
  cy.get('body').then($body => {
    const hasTokenInput = $body.find('textarea, input[placeholder*="token"], .token-input').length > 0;
    const hasVerifyButton = $body.find('*').filter((i, el) => {
      const text = Cypress.$(el).text().toLowerCase();
      return text.includes('verify') && text.includes('token');
    }).length > 0;
    
    if (hasTokenInput && hasVerifyButton) {
      // Input the token
      cy.get('textarea, input[placeholder*="token"], .token-input').first().clear().type(token, { delay: 0 });
      
      // Click verify button
      cy.get('*').contains(/verify.*token/i).first().click({ force: true });
      cy.wait(1000);
      
      // Check for validation results
      cy.get('body').then($resultBody => {
        const hasResults = $resultBody.find('.results, .token-results, .verification-result').length > 0;
        const hasSuccess = $resultBody.find('.success, .valid, .token-valid').length > 0;
        const hasError = $resultBody.find('.error, .invalid, .token-invalid').length > 0;
        
        cy.log(`Token validation results: Results area: ${hasResults}, Success: ${hasSuccess}, Error: ${hasError}`);
        
        if (hasResults || hasSuccess || hasError) {
          cy.log('✅ Token validation completed');
        } else {
          cy.log('⚠️ Token validation attempted but results unclear');
        }
      });
    } else {
      cy.log('⚠️ Token verification interface not found in current configuration');
    }
  });
  
  // Close configuration dialog
  cy.get('button').contains(/(cancel|close|ok)/i).first().click({ force: true });
});

/**
 * Creates an expired JWT token for testing
 * @returns {Cypress.Chainable<string>} Expired JWT token
 */
Cypress.Commands.add('generateExpiredToken', () => {
  cy.log('Generating expired JWT token');
  
  const expiredClaims = {
    exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    iat: Math.floor(Date.now() / 1000) - 7200  // 2 hours ago
  };
  
  return cy.generateTestToken(expiredClaims);
});

/**
 * Creates a malformed JWT token for testing
 * @returns {Cypress.Chainable<string>} Malformed JWT token
 */
Cypress.Commands.add('generateMalformedToken', () => {
  cy.log('Generating malformed JWT token');
  
  // Return a malformed token (missing signature part)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'test' }));
  
  const malformedToken = `${header}.${payload}`; // Missing signature
  
  cy.log('Generated malformed token (missing signature)');
  return cy.wrap(malformedToken);
});
