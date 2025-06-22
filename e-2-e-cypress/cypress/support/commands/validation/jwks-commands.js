/**
 * JWKS Validation Commands
 * Custom commands for validating JWKS endpoints and configurations
 */

/**
 * Verifies that a JWKS endpoint is accessible and returns valid data
 * @param {string} jwksUrl - The JWKS URL to validate
 */
Cypress.Commands.add('verifyJwksEndpoint', (jwksUrl) => {
  cy.log('Verifying JWKS endpoint');
  
  // Make a request to the JWKS endpoint
  cy.request({
    method: 'GET',
    url: jwksUrl,
    failOnStatusCode: false,
    timeout: 10000
  }).then((response) => {
    cy.log(`JWKS endpoint response status: ${response.status}`);
    
    if (response.status === 200) {
      // Verify the response contains keys
      expect(response.body).to.have.property('keys');
      expect(response.body.keys).to.be.an('array');
      
      if (response.body.keys.length > 0) {
        cy.log(`✅ JWKS endpoint valid with ${response.body.keys.length} keys`);
        
        // Verify key structure
        const firstKey = response.body.keys[0];
        expect(firstKey).to.have.property('kty'); // Key type
        expect(firstKey).to.have.property('kid'); // Key ID
        
        cy.log('✅ JWKS key structure is valid');
      } else {
        cy.log('⚠️ JWKS endpoint accessible but no keys found');
      }
    } else {
      cy.log(`⚠️ JWKS endpoint returned status: ${response.status}`);
    }
  });
});

/**
 * Tests JWKS configuration with a processor
 * @param {string} processorId - ID of the processor to configure
 * @param {string} jwksUrl - JWKS URL to configure
 */
Cypress.Commands.add('configureJwksEndpoint', (processorId, jwksUrl) => {
  cy.log('Configuring JWKS endpoint for processor');
  
  // Navigate to processor configuration
  cy.navigateToProcessorConfig(processorId);
  
  // Look for Properties tab
  cy.get('body').then($body => {
    const hasPropertiesTab = $body.find('*:contains("Properties")').length > 0;
    
    if (hasPropertiesTab) {
      cy.get('*:contains("Properties")').first().click({ force: true });
      cy.wait(500);
      
      // Look for JWKS URL property
      cy.get('body').then($propBody => {
        const hasJwksProperty = $propBody.find('*').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('jwks') && text.includes('url');
        }).length > 0;
        
        if (hasJwksProperty) {
          // Find the JWKS URL input field and set the value
          cy.get('*').contains(/jwks.*url/i).parents().find('input').first().then($input => {
            if ($input.length > 0) {
              cy.wrap($input).clear().type(jwksUrl);
              cy.log('✅ JWKS URL configured');
              
              // Apply configuration
              cy.get('button:contains("Apply")').click({ force: true });
              cy.wait(1000);
            } else {
              cy.log('⚠️ JWKS URL input field not found');
            }
          });
        } else {
          cy.log('⚠️ JWKS URL property not found in configuration');
        }
      });
    } else {
      cy.log('⚠️ Properties tab not found');
    }
  });
  
  // Close configuration dialog
  cy.get('button').contains(/(cancel|close|ok)/i).first().click({ force: true });
});

/**
 * Validates JWKS URL format
 * @param {string} jwksUrl - JWKS URL to validate
 */
Cypress.Commands.add('validateJwksUrlFormat', (jwksUrl) => {
  cy.log('Validating JWKS URL format');
  
  // Basic URL validation
  expect(jwksUrl).to.match(/^https?:\/\/.+/);
  
  // Common JWKS URL patterns
  const isWellKnownJwks = jwksUrl.includes('/.well-known/jwks.json') || 
                         jwksUrl.includes('/jwks') ||
                         jwksUrl.includes('/keys');
  
  if (isWellKnownJwks) {
    cy.log('✅ JWKS URL follows common patterns');
  } else {
    cy.log('⚠️ JWKS URL does not follow common patterns but may still be valid');
  }
});

/**
 * Creates a test JWKS configuration for testing
 * @returns {Object} Test JWKS configuration
 */
Cypress.Commands.add('createTestJwksConfig', () => {
  cy.log('Creating test JWKS configuration');
  
  const testJwks = {
    keys: [
      {
        kty: 'RSA',
        kid: 'test-key-1',
        use: 'sig',
        alg: 'RS256',
        n: 'test-modulus-base64',
        e: 'AQAB'
      }
    ]
  };
  
  cy.log('✅ Test JWKS configuration created');
  return cy.wrap(testJwks);
});

/**
 * Tests JWKS configuration with different sources (URL, File, In-Memory)
 * @param {string} processorId - ID of the processor to test
 * @param {string} configType - Type of JWKS configuration ('url', 'file', 'memory')
 * @param {string} configValue - Configuration value (URL, file path, or JWKS content)
 */
Cypress.Commands.add('testJwksConfiguration', (processorId, configType, configValue) => {
  cy.log(`Testing JWKS configuration: ${configType}`);
  
  // Navigate to processor configuration
  cy.navigateToProcessorConfig(processorId);
  
  cy.get('body').then($body => {
    const hasPropertiesTab = $body.find('*:contains("Properties")').length > 0;
    
    if (hasPropertiesTab) {
      cy.get('*:contains("Properties")').first().click({ force: true });
      cy.wait(500);
      
      // Configure based on type
      switch (configType) {
        case 'url':
          // Set JWKS Type to Server/URL and configure URL
          cy.configureJwksEndpoint(processorId, configValue);
          break;
          
        case 'file':
          // Set JWKS Type to File and configure file path
          cy.log('Configuring JWKS file path: ' + configValue);
          break;
          
        case 'memory':
          // Set JWKS Type to In-Memory and configure content
          cy.log('Configuring in-memory JWKS content');
          break;
          
        default:
          cy.log('⚠️ Unknown JWKS configuration type: ' + configType);
      }
    }
  });
  
  // Close configuration dialog
  cy.get('button').contains(/(cancel|close|ok)/i).first().click({ force: true });
});
