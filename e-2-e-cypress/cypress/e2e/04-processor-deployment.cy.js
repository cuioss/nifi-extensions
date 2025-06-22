/**
 * Processor Deployment Tests
 * Tests to verify that MultiIssuerJWTTokenAuthenticator and JWTTokenAuthenticator processors
 * are correctly deployed and available in the NiFi instance
 */
describe('Processor Deployment Test', () => {
  const baseUrl = Cypress.env('CYPRESS_BASE_URL') || 'https://localhost:9095/nifi';

  beforeEach(() => {
    // Navigate to NiFi for each test
    cy.visit(baseUrl, {
      timeout: 30000,
      failOnStatusCode: false,
    });

    // Wait for page to be ready
    cy.get('body', { timeout: 20000 }).should('exist');
    cy.title({ timeout: 10000 }).should('contain', 'NiFi');
  });

  it('should verify NAR file is deployed', () => {
    cy.log('Verifying NAR file deployment');

    // First verify that we can access the NiFi instance
    cy.get('body').should('exist');

    // Since this is an integration test to verify deployment,
    // we'll test that the processors are available in the add processor dialog
    cy.verifyProcessorAvailability('MultiIssuerJWTTokenAuthenticator');
    cy.verifyProcessorAvailability('JWTTokenAuthenticator');
  });

  it('should verify MultiIssuerJWTTokenAuthenticator is deployed', () => {
    cy.log('Testing MultiIssuerJWTTokenAuthenticator deployment');

    // Test that the processor can be found and added to canvas
    cy.addProcessorToCanvas('MultiIssuerJWTTokenAuthenticator').then((success) => {
      if (success) {
        cy.log('✅ MultiIssuerJWTTokenAuthenticator is properly deployed');
        // Verify processor configuration can be accessed
        cy.verifyProcessorConfiguration('MultiIssuerJWTTokenAuthenticator');
      } else {
        cy.log('❌ MultiIssuerJWTTokenAuthenticator deployment failed');
        throw new Error('MultiIssuerJWTTokenAuthenticator processor is not available in NiFi');
      }
    });
  });

  it('should verify JWTTokenAuthenticator is deployed', () => {
    cy.log('Testing JWTTokenAuthenticator deployment');

    // Test that the processor can be found and added to canvas
    cy.addProcessorToCanvas('JWTTokenAuthenticator').then((success) => {
      if (success) {
        cy.log('✅ JWTTokenAuthenticator is properly deployed');
        // Verify processor configuration can be accessed
        cy.verifyProcessorConfiguration('JWTTokenAuthenticator');
      } else {
        cy.log('❌ JWTTokenAuthenticator deployment failed');
        throw new Error('JWTTokenAuthenticator processor is not available in NiFi');
      }
    });
  });
  it('should verify processor properties are accessible', () => {
    cy.log('Testing processor properties accessibility');

    // Add both processors and verify their properties
    const processors = ['MultiIssuerJWTTokenAuthenticator', 'JWTTokenAuthenticator'];

    processors.forEach((processorName) => {
      cy.addProcessorToCanvas(processorName).then((success) => {
        if (success) {
          // Test that we can access processor properties
          cy.accessProcessorProperties(processorName).then((propertiesAccessible) => {
            if (propertiesAccessible) {
              cy.log(`✅ ${processorName} properties are accessible`);
            } else {
              cy.log(`❌ ${processorName} properties are not accessible`);
              throw new Error(`${processorName} properties cannot be accessed`);
            }
          });
        }
      });
    });
  });

  it('should verify JWT processor service registration', () => {
    cy.log('Verifying JWT processor service registration in NiFi');

    // This test checks if the processors are properly registered by attempting
    // to find them in the processor registry/type list
    cy.checkProcessorRegistry(['MultiIssuerJWTTokenAuthenticator', 'JWTTokenAuthenticator']).then(
      (registrationResults) => {
        registrationResults.forEach((result) => {
          if (result.registered) {
            cy.log(`✅ ${result.processor} is registered in NiFi`);
          } else {
            cy.log(`❌ ${result.processor} is NOT registered in NiFi`);
            throw new Error(`${result.processor} is not properly registered`);
          }
        });
      }
    );
  });

  it('should test processor instantiation and basic functionality', () => {
    cy.log('Testing processor instantiation and basic functionality');

    // Test that processors can be instantiated and configured
    const testCases = [
      {
        processor: 'MultiIssuerJWTTokenAuthenticator',
        requiredProperties: ['token.location', 'token.header'],
      },
      {
        processor: 'JWTTokenAuthenticator',
        requiredProperties: ['token.location', 'token.header'],
      },
    ];

    testCases.forEach((testCase) => {
      cy.log(`Testing ${testCase.processor} instantiation`);

      cy.addProcessorToCanvas(testCase.processor).then((success) => {
        if (success) {
          // Verify processor can be configured with basic properties
          cy.configureProcessorBasicProperties(
            testCase.processor,
            testCase.requiredProperties
          ).then((configurationSuccess) => {
            if (configurationSuccess) {
              cy.log(`✅ ${testCase.processor} can be configured`);
            } else {
              cy.log(`❌ ${testCase.processor} configuration failed`);
              throw new Error(`${testCase.processor} configuration failed`);
            }
          });
        }
      });
    });
  });
});
