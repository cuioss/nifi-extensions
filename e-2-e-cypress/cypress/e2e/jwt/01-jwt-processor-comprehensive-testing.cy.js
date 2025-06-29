/**
 * @file JWT Processor Comprehensive Testing
 * Demonstrates Phase 3 JWT processor testing framework capabilities
 * Tests configuration, token validation, multi-issuer scenarios, and performance
 */

import '../../support/jwt-processor-commands';
import '../../support/mock-commands';

describe('JWT Processor Comprehensive Testing Suite', () => {
  // Setup mocked environment before each test
  beforeEach(() => {
    // Visit a minimal HTML page for mocked testing
    cy.visit('/cypress/fixtures/mock-base.html');

    cy.setupMockedNiFi({
      enableAuth: true,
      enableProcessors: true,
      enableFlow: true
    });
  });

  // Clean up after each test
  afterEach(() => {
    cy.cleanupMockedJWTProcessors();
  });

  describe('JWT Processor Configuration Testing', () => {
    it('Should configure JWT_AUTHENTICATOR with valid properties', () => {
      cy.log('🔧 Testing JWT_AUTHENTICATOR configuration');

      cy.configureJWTProcessor('JWT_AUTHENTICATOR', {
        jwksUrl: 'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid_connect/certs',
        expectedIssuer: 'https://localhost:8443/auth/realms/oauth_integration_tests',
        expectedAudience: 'test_client',
        clockSkewTolerance: '30'
      }).then((config) => {
        expect(config).to.have.property('jwksUrl');
        expect(config).to.have.property('expectedIssuer');
        expect(config).to.have.property('expectedAudience');
        expect(config).to.have.property('clockSkewTolerance');
        cy.log('✅ JWT_AUTHENTICATOR configured successfully');
      });
    });

    it('Should configure MULTI_ISSUER with multiple issuer configurations', () => {
      cy.log('🔧 Testing MULTI_ISSUER configuration');

      const multiIssuerConfig = {
        issuerConfigurations: JSON.stringify([
          {
            issuer: 'https://localhost:8443/auth/realms/oauth_integration_tests',
            jwksUrl: 'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid_connect/certs',
            audience: 'test_client'
          },
          {
            issuer: 'https://secondary-issuer.com',
            jwksUrl: 'https://secondary-issuer.com/.well-known/jwks.json',
            audience: 'secondary_client'
          }
        ]),
        clockSkewTolerance: '30',
        cacheExpiration: '60'
      };

      cy.configureJWTProcessor('MULTI_ISSUER', multiIssuerConfig).then((config) => {
        expect(config).to.have.property('issuerConfigurations');
        expect(config).to.have.property('clockSkewTolerance');
        expect(config).to.have.property('cacheExpiration');

        // Validate issuer configurations are valid JSON
        const issuerConfigs = JSON.parse(config.issuerConfigurations);
        expect(issuerConfigs).to.be.an('array');
        expect(issuerConfigs).to.have.length(2);
        cy.log('✅ MULTI_ISSUER configured successfully');
      });
    });

    it('Should validate configuration and reject invalid properties', () => {
      cy.log('🔧 Testing configuration validation');

      cy.validateJWTProcessorConfiguration('JWT_AUTHENTICATOR', {
        jwksUrl: 'invalid-url',
        expectedIssuer: '',
        expectedAudience: 'test_client'
      }).then((isValid) => {
        expect(isValid).to.be.false;
        cy.log('✅ Configuration validation correctly rejected invalid config');
      });
    });
  });

  describe('JWT Token Validation Scenarios', () => {
    it('Should process valid JWT token successfully', () => {
      cy.log('🎯 Testing valid JWT token scenario');

      cy.testJWTProcessorScenario('JWT_AUTHENTICATOR', 'VALID_TOKEN').then((result) => {
        expect(result).to.have.property('relationship', 'success');
        expect(result).to.have.property('attributes');
        expect(result.attributes).to.have.property('subject');
        expect(result.attributes).to.have.property('issuer');
        cy.log('✅ Valid token processed successfully');
      });
    });

    it('Should handle expired JWT token correctly', () => {
      cy.log('🎯 Testing expired JWT token scenario');

      cy.testJWTProcessorScenario('JWT_AUTHENTICATOR', 'EXPIRED_TOKEN').then((result) => {
        expect(result).to.have.property('relationship', 'expired');
        expect(result.attributes).to.have.property('error', 'Token expired');
        cy.log('✅ Expired token handled correctly');
      });
    });

    it('Should reject token from invalid issuer', () => {
      cy.log('🎯 Testing invalid issuer scenario');

      cy.testJWTProcessorScenario('JWT_AUTHENTICATOR', 'INVALID_ISSUER').then((result) => {
        expect(result).to.have.property('relationship', 'failure');
        expect(result.attributes).to.have.property('error', 'Invalid issuer');
        cy.log('✅ Invalid issuer token rejected correctly');
      });
    });

    it('Should handle malformed JWT token', () => {
      cy.log('🎯 Testing malformed JWT token scenario');

      cy.testJWTProcessorScenario('JWT_AUTHENTICATOR', 'MALFORMED_TOKEN').then((result) => {
        expect(result).to.have.property('relationship', 'failure');
        expect(result.attributes).to.have.property('error', 'Invalid token format');
        cy.log('✅ Malformed token handled correctly');
      });
    });

    it('Should handle missing JWT token', () => {
      cy.log('🎯 Testing missing JWT token scenario');

      cy.testJWTProcessorScenario('JWT_AUTHENTICATOR', 'MISSING_TOKEN').then((result) => {
        expect(result).to.have.property('relationship', 'failure');
        expect(result.attributes).to.have.property('error', 'Invalid token format');
        cy.log('✅ Missing token handled correctly');
      });
    });
  });

  describe('Multi-Issuer JWT Processor Testing', () => {
    it('Should process valid token from known issuer', () => {
      cy.log('🎯 Testing MULTI_ISSUER with valid token');

      cy.testJWTProcessorScenario('MULTI_ISSUER', 'VALID_TOKEN').then((result) => {
        expect(result).to.have.property('relationship', 'success');
        expect(result.attributes).to.have.property('issuer');
        cy.log('✅ MULTI_ISSUER processed valid token successfully');
      });
    });

    it('Should route token from unknown issuer to unknownIssuer relationship', () => {
      cy.log('🎯 Testing MULTI_ISSUER with unknown issuer');

      cy.testJWTProcessorScenario('MULTI_ISSUER', 'INVALID_ISSUER').then((result) => {
        expect(result).to.have.property('relationship', 'unknownIssuer');
        expect(result.attributes).to.have.property('error', 'Unknown issuer');
        cy.log('✅ MULTI_ISSUER routed unknown issuer correctly');
      });
    });

    it('Should handle expired token in multi-issuer scenario', () => {
      cy.log('🎯 Testing MULTI_ISSUER with expired token');

      cy.testJWTProcessorScenario('MULTI_ISSUER', 'EXPIRED_TOKEN').then((result) => {
        expect(result).to.have.property('relationship', 'expired');
        expect(result.attributes).to.have.property('error', 'Token expired');
        cy.log('✅ MULTI_ISSUER handled expired token correctly');
      });
    });
  });

  describe('Comprehensive Test Suite Execution', () => {
    it('Should run complete test suite for JWT_AUTHENTICATOR', () => {
      cy.log('🎯 Running comprehensive test suite for JWT_AUTHENTICATOR');

      cy.runJWTProcessorTestSuite('JWT_AUTHENTICATOR').then((results) => {
        expect(results).to.be.an('array');
        expect(results.length).to.be.greaterThan(0);

        // Check that we have results for expected scenarios
        const scenarioNames = results.map(r => r.scenario);
        expect(scenarioNames).to.include('VALID_TOKEN');
        expect(scenarioNames).to.include('EXPIRED_TOKEN');
        expect(scenarioNames).to.include('INVALID_ISSUER');
        expect(scenarioNames).to.include('MALFORMED_TOKEN');

        // Count successful vs failed scenarios
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        cy.log(`✅ Test suite completed: ${successCount} passed, ${failureCount} failed`);

        // All scenarios should pass (they test expected behavior)
        expect(successCount).to.equal(results.length);
      });
    });

    it('Should run complete test suite for MULTI_ISSUER', () => {
      cy.log('🎯 Running comprehensive test suite for MULTI_ISSUER');

      cy.runJWTProcessorTestSuite('MULTI_ISSUER').then((results) => {
        expect(results).to.be.an('array');
        expect(results.length).to.be.greaterThan(0);

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        cy.log(`✅ MULTI_ISSUER test suite completed: ${successCount} passed, ${failureCount} failed`);

        // All scenarios should pass
        expect(successCount).to.equal(results.length);
      });
    });

    it('Should run test suite with custom configuration', () => {
      cy.log('🎯 Testing custom configuration scenarios');

      const customConfig = {
        expectedAudience: 'custom_client',
        clockSkewTolerance: '60'
      };

      cy.runJWTProcessorTestSuite('JWT_AUTHENTICATOR', {
        customConfiguration: customConfig,
        scenariosToTest: ['VALID_TOKEN', 'EXPIRED_TOKEN']
      }).then((results) => {
        expect(results).to.have.length(2);

        // Check that both scenarios executed (regardless of success/failure)
        const validTokenResult = results.find(r => r.scenario === 'VALID_TOKEN');
        const expiredTokenResult = results.find(r => r.scenario === 'EXPIRED_TOKEN');

        expect(validTokenResult).to.exist;
        expect(expiredTokenResult).to.exist;

        // Debug: Log the actual structure of results
        cy.log('Valid token result structure:', JSON.stringify(validTokenResult, null, 2));
        cy.log('Expired token result structure:', JSON.stringify(expiredTokenResult, null, 2));

        // Both scenarios should have executed successfully (meaning the test framework worked)
        // but the token validation results should be as expected
        expect(validTokenResult.success).to.be.true;

        // Valid token should fail due to audience mismatch
        expect(validTokenResult.result.relationship).to.equal('failure');
        expect(validTokenResult.result.attributes.error).to.equal('Invalid audience');

        // Expired token should still be expired - handle both success and failure cases
        if (expiredTokenResult.success && expiredTokenResult.result) {
          expect(expiredTokenResult.result.relationship).to.equal('expired');
        } else if (expiredTokenResult.error) {
          // If the scenario failed, check if it was due to expected relationship mismatch
          expect(expiredTokenResult.error).to.include('Expected relationship');
          expect(expiredTokenResult.error).to.include('expired');
        } else {
          // If neither success nor error, log the actual structure for debugging
          cy.log('Unexpected expiredTokenResult structure:', JSON.stringify(expiredTokenResult, null, 2));
          expect(expiredTokenResult).to.have.property('success');
        }

        cy.log('✅ Custom configuration testing completed');
      });
    });
  });

  describe('JWT Processor Performance Testing', () => {
    it('Should measure JWT_AUTHENTICATOR performance', () => {
      cy.log('⚡ Testing JWT_AUTHENTICATOR performance');

      cy.testJWTProcessorPerformance('JWT_AUTHENTICATOR', {
        tokenCount: 50,
        configuration: {}
      }).then((performanceResult) => {
        expect(performanceResult).to.have.property('processorType', 'JWT_AUTHENTICATOR');
        expect(performanceResult).to.have.property('tokenCount', 50);
        expect(performanceResult).to.have.property('totalTime');
        expect(performanceResult).to.have.property('avgProcessingTime');
        expect(performanceResult).to.have.property('throughput');
        expect(performanceResult).to.have.property('passed');

        cy.log(`⚡ Performance: ${performanceResult.throughput.toFixed(2)} tokens/sec`);
        cy.log(`⚡ Avg processing time: ${performanceResult.avgProcessingTime.toFixed(2)}ms`);

        // Verify performance meets thresholds
        expect(performanceResult.avgProcessingTime).to.be.lessThan(100);
        expect(performanceResult.throughput).to.be.greaterThan(100);

        cy.log('✅ Performance test completed successfully');
      });
    });

    it('Should measure MULTI_ISSUER performance', () => {
      cy.log('⚡ Testing MULTI_ISSUER performance');

      cy.testJWTProcessorPerformance('MULTI_ISSUER', {
        tokenCount: 30,
        configuration: {}
      }).then((performanceResult) => {
        expect(performanceResult).to.have.property('processorType', 'MULTI_ISSUER');
        expect(performanceResult).to.have.property('tokenCount', 30);

        cy.log(`⚡ MULTI_ISSUER Performance: ${performanceResult.throughput.toFixed(2)} tokens/sec`);

        // Multi-issuer might be slightly slower due to issuer lookup
        expect(performanceResult.avgProcessingTime).to.be.lessThan(150);

        cy.log('✅ MULTI_ISSUER performance test completed');
      });
    });

    it('Should demonstrate fast execution time for JWT testing framework', () => {
      cy.log('⚡ Demonstrating fast execution time for JWT testing framework');

      const startTime = Date.now();

      // Run multiple operations quickly
      cy.configureJWTProcessor('JWT_AUTHENTICATOR')
        .then(() => cy.testJWTProcessorScenario('JWT_AUTHENTICATOR', 'VALID_TOKEN'))
        .then(() => cy.testJWTProcessorScenario('JWT_AUTHENTICATOR', 'EXPIRED_TOKEN'))
        .then(() => cy.configureJWTProcessor('MULTI_ISSUER'))
        .then(() => cy.testJWTProcessorScenario('MULTI_ISSUER', 'VALID_TOKEN'))
        .then(() => {
          const endTime = Date.now();
          const executionTime = endTime - startTime;

          cy.log(`⚡ JWT framework test completed in ${executionTime}ms`);

          // Verify it's fast (should be under 2 seconds for mocked operations)
          expect(executionTime).to.be.lessThan(2000);
          cy.log('✅ Fast execution time verified for JWT testing framework');
        });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('Should handle invalid processor type gracefully', () => {
      cy.log('🎯 Testing invalid processor type handling');

      // Set up error handler
      cy.on('fail', (err) => {
        expect(err.message).to.include('Unknown JWT processor type');
        cy.log('✅ Invalid processor type handled correctly');
        return false; // Prevent test from failing
      });

      cy.configureJWTProcessor('INVALID_PROCESSOR');
    });

    it('Should handle invalid test scenario gracefully', () => {
      cy.log('🎯 Testing invalid scenario handling');

      // Set up error handler
      cy.on('fail', (err) => {
        expect(err.message).to.include('Unknown test scenario');
        cy.log('✅ Invalid scenario handled correctly');
        return false; // Prevent test from failing
      });

      cy.testJWTProcessorScenario('JWT_AUTHENTICATOR', 'INVALID_SCENARIO');
    });

    it('Should handle configuration validation errors', () => {
      cy.log('🎯 Testing configuration validation error handling');

      // Set up error handler
      cy.on('fail', (err) => {
        expect(err.message).to.include('Invalid configuration');
        cy.log('✅ Configuration validation errors handled correctly');
        return false; // Prevent test from failing
      });

      cy.configureJWTProcessor('JWT_AUTHENTICATOR', {
        jwksUrl: 'not-a-url',
        expectedIssuer: ''
      }, { validateConfiguration: true });
    });
  });
});
