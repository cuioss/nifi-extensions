/**
 * @file Multi-Issuer JWT Validation test implementation for NiFi JWT extension
 * Comprehensive JWT token validation functionality testing for multi-issuer scenarios
 * Following requirements from Requirements.md and Specification.adoc
 * @author E2E Test Refactoring Initiative
 * @version 1.0.0
 */

// Import test utilities and helpers
import { authenticateUser, cleanupSession } from '../../support/utils/auth-helpers.js';

import {
  validateProcessorAvailability,
  createProcessorInstance,
  configureProcessorProperty,
  validateProcessorConfiguration,
  cleanupProcessors,
} from '../../support/utils/processor-helpers.js';

import { navigateToNiFiCanvas, waitForPageLoad } from '../../support/utils/ui-helpers.js';

import {
  validateJWTTokenProcessing,
  validateJWKSConfiguration,
  validateNoConsoleErrors,
  validatePerformanceMetrics,
} from '../../support/utils/validation-helpers.js';

import {
  logTestStep,
  trackTestFailure,
  captureDebugInfo,
} from '../../support/utils/error-tracking.js';

import {
  getTestJWTTokens,
  getTestJWKSEndpoints,
  getTestAlgorithms,
  getMultiIssuerTestData,
} from '../../support/utils/test-data.js';

// Test constants
const PROCESSOR_TYPE = 'MultiIssuerJWTTokenAuthenticator';
const TEST_TIMEOUT = 30000;
const PERFORMANCE_THRESHOLD = 5000; // 5 seconds max for JWT validation

// Test data
const TEST_ISSUERS = [
  {
    name: 'TestIssuer1',
    jwksUrl: 'https://test-issuer1.com/.well-known/jwks.json',
    algorithm: 'RS256',
    audience: 'test-audience-1',
  },
  {
    name: 'TestIssuer2',
    jwksUrl: 'https://test-issuer2.com/.well-known/jwks.json',
    algorithm: 'ES256',
    audience: 'test-audience-2',
  },
  {
    name: 'TestIssuer3',
    jwksUrl: 'https://test-issuer3.com/.well-known/jwks.json',
    algorithm: 'PS256',
    audience: 'test-audience-3',
  },
];

// Helper functions to reduce nesting
function configureMultipleIssuers(processorId) {
  TEST_ISSUERS.forEach((issuer, index) => {
    cy.wrap(configureProcessorProperty(processorId, `issuer.${index + 1}.name`, issuer.name)).then(
      () => {
        logTestStep('08-jwt-multi', `Configured issuer ${index + 1}: ${issuer.name}`);
      }
    );

    cy.wrap(
      configureProcessorProperty(processorId, `issuer.${index + 1}.jwks-uri`, issuer.jwksUrl)
    ).then(() => {
      logTestStep('08-jwt-multi', `Configured JWKS URL for issuer ${index + 1}`);
    });

    cy.wrap(
      configureProcessorProperty(processorId, `issuer.${index + 1}.algorithm`, issuer.algorithm)
    ).then(() => {
      logTestStep(
        '08-jwt-multi',
        `Configured algorithm ${issuer.algorithm} for issuer ${index + 1}`
      );
    });

    cy.wrap(
      configureProcessorProperty(processorId, `issuer.${index + 1}.audience`, issuer.audience)
    ).then(() => {
      logTestStep('08-jwt-multi', `Configured audience for issuer ${index + 1}`);
    });
  });
}

function validateInvalidConfigs(processorId, invalidConfigs) {
  invalidConfigs.forEach((config) => {
    cy.wrap(configureProcessorProperty(processorId, config.property, config.value)).then(
      (result) => {
        expect(result.success).to.be.false;
        expect(result.error).to.contain(config.expectedError);
        logTestStep(
          '08-jwt-multi',
          `Invalid config rejected: ${config.property} = ${config.value}`
        );
      }
    );
  });
}

function testAlgorithmValidation(algorithm) {
  cy.log(`🔧 Testing algorithm: ${algorithm.name}`);

  // Configure processor for specific algorithm
  cy.get('.processor-component').first().dblclick({ force: true });

  cy.get('input[name="algorithm"], select[name="algorithm"]', { timeout: 10000 })
    .clear()
    .type(algorithm.name);

  // Apply configuration
  cy.get('button:contains("Apply"), .apply-button').click();

  // Test token validation with this algorithm
  const algorithmTokenTests = algorithm.testTokens.map((token) => ({
    token: token.value,
    shouldBeValid: token.valid,
    description: `${algorithm.name} ${token.description}`,
    expectedResult: token.expectedResult,
  }));

  return validateJWTTokenProcessing(algorithmTokenTests, {
    timeout: TEST_TIMEOUT,
    processorType: PROCESSOR_TYPE,
  });
}

describe('08 - Multi-Issuer JWT Validation', () => {
  beforeEach(() => {
    logTestStep('08-jwt-multi', 'Starting multi-issuer JWT validation test');
    cy.clearCookies();
    cy.clearLocalStorage();
    captureDebugInfo('08-jwt-multi');
  });

  afterEach(() => {
    captureDebugInfo('08-jwt-multi');
  });

  context('Multi-Issuer JWT Token Processing', () => {
    beforeEach(() => {
      authenticateUser('admin', 'password');
      navigateToNiFiCanvas();
      waitForPageLoad();
    });

    afterEach(() => {
      cleanupProcessors();
      cleanupSession();
    });

    it('R-JWT-001: Should validate JWT tokens from multiple issuers', () => {
      logTestStep('08-jwt-multi', 'Testing multi-issuer JWT token validation');

      // Verify processor availability
      cy.wrap(validateProcessorAvailability(PROCESSOR_TYPE)).then((result) => {
        expect(result.isAvailable).to.be.true;
        logTestStep('08-jwt-multi', `${PROCESSOR_TYPE} processor available`);
      });

      // Create processor instance
      cy.wrap(createProcessorInstance(PROCESSOR_TYPE, { x: 300, y: 300 }))
        .then((processorId) => {
          expect(processorId).to.exist;
          logTestStep('08-jwt-multi', 'Multi-issuer JWT processor created');

          // Configure multiple issuers using helper function
          configureMultipleIssuers(processorId);

          // Validate configuration persistence
          return validateProcessorConfiguration(processorId);
        })
        .then((config) => {
          expect(config).to.exist;
          logTestStep('08-jwt-multi', 'Multi-issuer configuration validated');
        })
        .catch((error) => {
          trackTestFailure('08-jwt-multi', 'multi-issuer-setup', error);
          throw error;
        });

      validateNoConsoleErrors('Multi-issuer processor configuration');
    });

    it('R-JWT-002: Should process valid JWT tokens from different issuers', () => {
      logTestStep('08-jwt-multi', 'Testing valid token processing from multiple issuers');

      const tokenTests = getTestJWTTokens('multi-issuer-valid');

      cy.wrap(
        validateJWTTokenProcessing(tokenTests, {
          timeout: TEST_TIMEOUT,
          processorType: PROCESSOR_TYPE,
        })
      )
        .then(() => {
          logTestStep('08-jwt-multi', 'Valid multi-issuer token processing completed');
        })
        .catch((error) => {
          trackTestFailure('08-jwt-multi', 'valid-token-processing', error);
          throw error;
        });

      validateNoConsoleErrors('Valid multi-issuer token processing');
    });

    it('R-JWT-003: Should reject invalid JWT tokens properly', () => {
      logTestStep('08-jwt-multi', 'Testing invalid token rejection');

      const invalidTokenTests = [
        {
          token: 'invalid.jwt.token',
          shouldBeValid: false,
          description: 'Malformed JWT token',
          expectedResult: 'invalid format',
        },
        {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
          shouldBeValid: false,
          description: 'JWT with invalid signature',
          expectedResult: 'signature verification failed',
        },
        {
          token:
            'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.',
          shouldBeValid: false,
          description: 'JWT with none algorithm',
          expectedResult: 'algorithm not allowed',
        },
      ];

      cy.wrap(
        validateJWTTokenProcessing(invalidTokenTests, {
          timeout: TEST_TIMEOUT,
          processorType: PROCESSOR_TYPE,
        })
      )
        .then(() => {
          logTestStep('08-jwt-multi', 'Invalid token rejection validation completed');
        })
        .catch((error) => {
          trackTestFailure('08-jwt-multi', 'invalid-token-rejection', error);
          throw error;
        });

      validateNoConsoleErrors('Invalid token rejection testing');
    });

    it('R-JWT-004: Should support multiple JWT algorithms', () => {
      logTestStep('08-jwt-multi', 'Testing multiple algorithm support');

      const algorithmTests = getTestAlgorithms('multi-issuer');

      algorithmTests.forEach((algorithm) => {
        cy.wrap(testAlgorithmValidation(algorithm)).then(() => {
          logTestStep('08-jwt-multi', `Algorithm ${algorithm.name} validation completed`);
        });
      });

      validateNoConsoleErrors('Multiple algorithm support testing');
    });

    it('R-JWT-005: Should validate JWKS integration for multiple issuers', () => {
      logTestStep('08-jwt-multi', 'Testing JWKS integration for multiple issuers');

      const jwksTests = getTestJWKSEndpoints('multi-issuer');

      cy.wrap(
        validateJWKSConfiguration(jwksTests, {
          timeout: TEST_TIMEOUT,
        })
      )
        .then(() => {
          logTestStep('08-jwt-multi', 'Multi-issuer JWKS validation completed');
        })
        .catch((error) => {
          trackTestFailure('08-jwt-multi', 'jwks-integration', error);
          throw error;
        });

      validateNoConsoleErrors('JWKS integration testing');
    });
  });

  context('Performance and Load Testing', () => {
    beforeEach(() => {
      authenticateUser('admin', 'password');
      navigateToNiFiCanvas();
      waitForPageLoad();
    });

    afterEach(() => {
      cleanupProcessors();
      cleanupSession();
    });

    it('R-JWT-006: Should meet performance requirements for JWT validation', () => {
      logTestStep('08-jwt-multi', 'Testing JWT validation performance');

      const performanceTests = getMultiIssuerTestData('performance');

      cy.wrap(
        validatePerformanceMetrics(performanceTests, {
          maxResponseTime: PERFORMANCE_THRESHOLD,
          concurrent: true,
          iterations: 100,
        })
      )
        .then((metrics) => {
          expect(metrics.averageResponseTime).to.be.lessThan(PERFORMANCE_THRESHOLD);
          expect(metrics.maxResponseTime).to.be.lessThan(PERFORMANCE_THRESHOLD * 2);
          expect(metrics.successRate).to.be.at.least(0.95);

          logTestStep(
            '08-jwt-multi',
            `Performance validated: avg=${metrics.averageResponseTime}ms, max=${metrics.maxResponseTime}ms, success=${metrics.successRate * 100}%`
          );
        })
        .catch((error) => {
          trackTestFailure('08-jwt-multi', 'performance-validation', error);
          throw error;
        });

      validateNoConsoleErrors('Performance testing');
    });

    it('R-JWT-007: Should handle concurrent token validations', () => {
      logTestStep('08-jwt-multi', 'Testing concurrent token validations');

      const concurrentTests = [];
      for (let i = 0; i < 10; i++) {
        concurrentTests.push({
          token: getTestJWTTokens('valid')[i % getTestJWTTokens('valid').length].token,
          shouldBeValid: true,
          description: `Concurrent validation ${i + 1}`,
          expectedResult: 'valid',
        });
      }

      // Execute concurrent validations
      const startTime = Date.now();

      cy.wrap(
        Promise.all(
          concurrentTests.map((test) =>
            validateJWTTokenProcessing([test], {
              timeout: TEST_TIMEOUT,
              processorType: PROCESSOR_TYPE,
            })
          )
        )
      )
        .then(() => {
          const endTime = Date.now();
          const totalTime = endTime - startTime;

          expect(totalTime).to.be.lessThan(PERFORMANCE_THRESHOLD * 2);
          logTestStep('08-jwt-multi', `Concurrent validations completed in ${totalTime}ms`);
        })
        .catch((error) => {
          trackTestFailure('08-jwt-multi', 'concurrent-validation', error);
          throw error;
        });

      validateNoConsoleErrors('Concurrent validation testing');
    });
  });

  context('Error Handling and Edge Cases', () => {
    beforeEach(() => {
      authenticateUser('admin', 'password');
      navigateToNiFiCanvas();
      waitForPageLoad();
    });

    afterEach(() => {
      cleanupProcessors();
      cleanupSession();
    });

    it('R-JWT-008: Should handle JWKS endpoint failures gracefully', () => {
      logTestStep('08-jwt-multi', 'Testing JWKS endpoint failure handling');

      const failureTests = [
        {
          endpoint: 'https://nonexistent-endpoint.com/.well-known/jwks.json',
          shouldConnect: false,
          description: 'Non-existent JWKS endpoint',
          expectedError: 'connection failed',
        },
        {
          endpoint: 'https://httpstat.us/500',
          shouldConnect: false,
          description: 'JWKS endpoint returning 500 error',
          expectedError: 'server error',
        },
        {
          endpoint: 'https://httpstat.us/timeout',
          shouldConnect: false,
          description: 'JWKS endpoint timeout',
          expectedError: 'timeout',
        },
      ];

      cy.wrap(
        validateJWKSConfiguration(failureTests, {
          timeout: TEST_TIMEOUT,
          expectFailure: true,
        })
      )
        .then(() => {
          logTestStep('08-jwt-multi', 'JWKS failure handling validated');
        })
        .catch((error) => {
          trackTestFailure('08-jwt-multi', 'jwks-failure-handling', error);
          throw error;
        });

      validateNoConsoleErrors('JWKS failure handling', {
        allowedErrors: ['connection failed', 'server error', 'timeout'],
      });
    });

    it('R-JWT-009: Should handle malformed configuration gracefully', () => {
      logTestStep('08-jwt-multi', 'Testing malformed configuration handling');

      // Test with invalid configuration values
      const invalidConfigs = [
        { property: 'issuer.1.jwks-uri', value: 'not-a-url', expectedError: 'invalid URL format' },
        {
          property: 'issuer.1.algorithm',
          value: 'INVALID_ALG',
          expectedError: 'unsupported algorithm',
        },
        { property: 'issuer.1.audience', value: '', expectedError: 'audience required' },
      ];

      cy.wrap(validateProcessorAvailability(PROCESSOR_TYPE))
        .then((result) => {
          expect(result.isAvailable).to.be.true;
          return createProcessorInstance(PROCESSOR_TYPE, { x: 400, y: 400 });
        })
        .then((processorId) => {
          // Test each invalid configuration using helper function
          validateInvalidConfigs(processorId, invalidConfigs);
        })
        .catch((error) => {
          trackTestFailure('08-jwt-multi', 'malformed-config-handling', error);
          throw error;
        });

      validateNoConsoleErrors('Malformed configuration handling', {
        allowedErrors: ['invalid URL format', 'unsupported algorithm', 'audience required'],
      });
    });
  });
});
