/**
 * @fileoverview Single-Issuer JWT Validation test implementation for NiFi JWT extension
 * Comprehensive JWT token validation functionality testing for single-issuer scenarios
 * Following requirements from Requirements.md and Specification.adoc
 * 
 * @requirements R-JWT-010, R-JWT-011, R-JWT-012, R-JWT-013, R-JWT-014
 * @author E2E Test Refactoring Initiative  
 * @version 1.0.0
 */

// Import test utilities and helpers
import {
  authenticateUser,
  cleanupSession
} from '../../support/utils/auth-helpers.js';

import {
  validateProcessorAvailability,
  createProcessorInstance,
  configureProcessorProperty,
  validateProcessorConfiguration,
  cleanupProcessors
} from '../../support/utils/processor-helpers.js';

import {
  navigateToNiFiCanvas,
  waitForPageLoad
} from '../../support/utils/ui-helpers.js';

import {
  validateJWTTokenProcessing,
  validateJWKSConfiguration,
  validateNoConsoleErrors,
  validatePerformanceMetrics
} from '../../support/utils/validation-helpers.js';

import {
  logTestStep,
  trackTestFailure,
  captureDebugInfo
} from '../../support/utils/error-tracking.js';

import {
  getTestJWTTokens,
  getTestJWKSEndpoints,
  getSingleIssuerTestData
} from '../../support/utils/test-data.js';

// Test constants
const PROCESSOR_TYPE = 'SingleIssuerJWTTokenAuthenticator';
const TEST_TIMEOUT = 30000;
const PERFORMANCE_THRESHOLD = 2000; // 2 seconds max for single-issuer JWT validation

// Test data
const TEST_ISSUER = {
  name: 'TestSingleIssuer',
  jwksUrl: 'https://test-single-issuer.com/.well-known/jwks.json',
  algorithm: 'RS256',
  audience: 'test-single-audience',
  issuer: 'https://test-single-issuer.com'
};

// Helper function to configure single issuer
function configureSingleIssuer(processorId, issuerConfig = TEST_ISSUER) {
  const configs = [
    { property: 'issuer.name', value: issuerConfig.name },
    { property: 'issuer.jwks-uri', value: issuerConfig.jwksUrl },
    { property: 'issuer.algorithm', value: issuerConfig.algorithm },
    { property: 'issuer.audience', value: issuerConfig.audience },
    { property: 'issuer.issuer', value: issuerConfig.issuer }
  ];

  configs.forEach((config) => {
    cy.wrap(configureProcessorProperty(processorId, config.property, config.value))
      .then(() => {
        logTestStep('09-jwt-single', `Configured ${config.property}: ${config.value}`);
      });
  });
}

function validateCachingPerformance(cacheTests) {
  // Test initial token validation (cache miss)
  const startTime = Date.now();
  return validateJWTTokenProcessing([cacheTests[0]], {
    timeout: TEST_TIMEOUT,
    processorType: PROCESSOR_TYPE
  })
    .then(() => {
      const firstValidationTime = Date.now() - startTime;
      logTestStep('09-jwt-single', `First validation time (cache miss): ${firstValidationTime}ms`);
      
      // Test subsequent token validation (cache hit)
      const cacheStartTime = Date.now();
      return validateJWTTokenProcessing([cacheTests[0]], {
        timeout: TEST_TIMEOUT,
        processorType: PROCESSOR_TYPE
      })
        .then(() => {
          const cacheValidationTime = Date.now() - cacheStartTime;
          logTestStep('09-jwt-single', `Cached validation time (cache hit): ${cacheValidationTime}ms`);
          
          // Cache hit should be significantly faster
          expect(cacheValidationTime).to.be.lessThan(firstValidationTime * 0.5);
        });
    });
}

function validateInvalidConfigurations(processorId, invalidConfigs) {
  invalidConfigs.forEach((config) => {
    cy.wrap(configureProcessorProperty(processorId, config.property, config.value))
      .then((result) => {
        expect(result.success).to.be.false;
        expect(result.error).to.contain(config.expectedError);
        logTestStep('09-jwt-single', `Invalid config rejected: ${config.property} = ${config.value}`);
      });
  });
}

describe('09 - Single-Issuer JWT Validation', () => {
  beforeEach(() => {
    logTestStep('09-jwt-single', 'Starting single-issuer JWT validation test');
    cy.clearCookies();
    cy.clearLocalStorage();
    captureDebugInfo('09-jwt-single');
  });

  afterEach(() => {
    captureDebugInfo('09-jwt-single');
  });

  context('Single-Issuer JWT Token Processing', () => {
    beforeEach(() => {
      authenticateUser('admin', 'password');
      navigateToNiFiCanvas();
      waitForPageLoad();
    });

    afterEach(() => {
      cleanupProcessors();
      cleanupSession();
    });

    it('R-JWT-010: Should validate JWT tokens from single issuer', () => {
      logTestStep('09-jwt-single', 'Testing single-issuer JWT token validation');

      // Verify processor availability
      cy.wrap(validateProcessorAvailability(PROCESSOR_TYPE))
        .then((result) => {
          expect(result.isAvailable).to.be.true;
          logTestStep('09-jwt-single', `${PROCESSOR_TYPE} processor available`);
        });

      // Create processor instance
      cy.wrap(createProcessorInstance(PROCESSOR_TYPE, { x: 300, y: 300 }))
        .then((processorId) => {
          expect(processorId).to.exist;
          logTestStep('09-jwt-single', 'Single-issuer JWT processor created');

          // Configure single issuer using helper function
          configureSingleIssuer(processorId);

          // Validate configuration persistence
          return validateProcessorConfiguration(processorId);
        })
        .then((config) => {
          expect(config).to.exist;
          logTestStep('09-jwt-single', 'Single-issuer configuration validated');
        })
        .catch((error) => {
          trackTestFailure('09-jwt-single', 'single-issuer-setup', error);
          throw error;
        });

      validateNoConsoleErrors('Single-issuer processor configuration');
    });

    it('R-JWT-011: Should process valid JWT tokens correctly', () => {
      logTestStep('09-jwt-single', 'Testing valid token processing');

      const tokenTests = getTestJWTTokens('single-issuer-valid');
      
      cy.wrap(validateJWTTokenProcessing(tokenTests, {
        timeout: TEST_TIMEOUT,
        processorType: PROCESSOR_TYPE
      }))
        .then(() => {
          logTestStep('09-jwt-single', 'Valid single-issuer token processing completed');
        })
        .catch((error) => {
          trackTestFailure('09-jwt-single', 'valid-token-processing', error);
          throw error;
        });

      validateNoConsoleErrors('Valid single-issuer token processing');
    });

    it('R-JWT-012: Should reject invalid JWT tokens properly', () => {
      logTestStep('09-jwt-single', 'Testing invalid token rejection');

      const invalidTokenTests = [
        {
          token: 'invalid.jwt.token',
          shouldBeValid: false,
          description: 'Malformed JWT token',
          expectedResult: 'invalid format'
        },
        {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
          shouldBeValid: false,
          description: 'JWT with invalid signature',
          expectedResult: 'signature verification failed'
        },
        {
          token: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.',
          shouldBeValid: false,
          description: 'JWT with none algorithm',
          expectedResult: 'algorithm not allowed'
        },
        {
          token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMiwiYXVkIjoid3JvbmctYXVkaWVuY2UifQ.wrong-signature',
          shouldBeValid: false,
          description: 'JWT with wrong audience',
          expectedResult: 'audience mismatch'
        },
        {
          token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxNTE2MjM5MDIxfQ.expired-token',
          shouldBeValid: false,
          description: 'Expired JWT token',
          expectedResult: 'token expired'
        }
      ];

      cy.wrap(validateJWTTokenProcessing(invalidTokenTests, {
        timeout: TEST_TIMEOUT,
        processorType: PROCESSOR_TYPE
      }))
        .then(() => {
          logTestStep('09-jwt-single', 'Invalid token rejection validation completed');
        })
        .catch((error) => {
          trackTestFailure('09-jwt-single', 'invalid-token-rejection', error);
          throw error;
        });

      validateNoConsoleErrors('Invalid token rejection testing');
    });

    it('R-JWT-013: Should support algorithm configuration', () => {
      logTestStep('09-jwt-single', 'Testing algorithm configuration');

      const algorithms = ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512', 'PS256', 'PS384', 'PS512'];
      
      algorithms.forEach((algorithm) => {
        cy.log(`🔧 Testing algorithm: ${algorithm}`);
        
        // Configure processor for specific algorithm
        cy.get('.processor-component').first().dblclick({ force: true });
        
        cy.get('input[name="algorithm"], select[name="algorithm"]', { timeout: 10000 })
          .clear()
          .type(algorithm);
        
        // Apply configuration
        cy.get('button:contains("Apply"), .apply-button')
          .click();
        
        // Verify algorithm was set
        cy.get('.processor-component').first().dblclick({ force: true });
        cy.get('input[name="algorithm"], select[name="algorithm"]')
          .should('have.value', algorithm);
        
        cy.get('button:contains("Apply"), .apply-button')
          .click();
        
        logTestStep('09-jwt-single', `Algorithm ${algorithm} configured successfully`);
      });

      validateNoConsoleErrors('Algorithm configuration testing');
    });

    it('R-JWT-014: Should validate JWKS integration', () => {
      logTestStep('09-jwt-single', 'Testing JWKS integration');

      const jwksTests = getTestJWKSEndpoints('single-issuer');
      
      cy.wrap(validateJWKSConfiguration(jwksTests, {
        timeout: TEST_TIMEOUT
      }))
        .then(() => {
          logTestStep('09-jwt-single', 'Single-issuer JWKS validation completed');
        })
        .catch((error) => {
          trackTestFailure('09-jwt-single', 'jwks-integration', error);
          throw error;
        });

      validateNoConsoleErrors('JWKS integration testing');
    });
  });

  context('Performance and Optimization', () => {
    beforeEach(() => {
      authenticateUser('admin', 'password');
      navigateToNiFiCanvas();
      waitForPageLoad();
    });

    afterEach(() => {
      cleanupProcessors();
      cleanupSession();
    });

    it('R-JWT-015: Should meet performance requirements', () => {
      logTestStep('09-jwt-single', 'Testing JWT validation performance');

      const performanceTests = getSingleIssuerTestData('performance');
      
      cy.wrap(validatePerformanceMetrics(performanceTests, {
        maxResponseTime: PERFORMANCE_THRESHOLD,
        concurrent: false,
        iterations: 50
      }))
        .then((metrics) => {
          expect(metrics.averageResponseTime).to.be.lessThan(PERFORMANCE_THRESHOLD);
          expect(metrics.maxResponseTime).to.be.lessThan(PERFORMANCE_THRESHOLD * 1.5);
          expect(metrics.successRate).to.be.at.least(0.98);
          
          logTestStep('09-jwt-single', `Performance validated: avg=${metrics.averageResponseTime}ms, max=${metrics.maxResponseTime}ms, success=${metrics.successRate * 100}%`);
        })
        .catch((error) => {
          trackTestFailure('09-jwt-single', 'performance-validation', error);
          throw error;
        });

      validateNoConsoleErrors('Performance testing');
    });

    it('R-JWT-016: Should optimize single-issuer token caching', () => {
      logTestStep('09-jwt-single', 'Testing single-issuer token caching optimization');

      const cacheTests = getSingleIssuerTestData('caching');
      
      cy.wrap(validateCachingPerformance(cacheTests))
        .catch((error) => {
          trackTestFailure('09-jwt-single', 'caching-optimization', error);
          throw error;
        });

      validateNoConsoleErrors('Caching optimization testing');
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

    it('R-JWT-017: Should handle JWKS endpoint failures gracefully', () => {
      logTestStep('09-jwt-single', 'Testing JWKS endpoint failure handling');

      const failureTests = [
        {
          endpoint: 'https://nonexistent-single-issuer.com/.well-known/jwks.json',
          shouldConnect: false,
          description: 'Non-existent JWKS endpoint',
          expectedError: 'connection failed'
        },
        {
          endpoint: 'https://httpstat.us/503',
          shouldConnect: false,
          description: 'JWKS endpoint returning 503 error',
          expectedError: 'service unavailable'
        },
        {
          endpoint: 'invalid-url-format',
          shouldConnect: false,
          description: 'Invalid JWKS URL format',
          expectedError: 'invalid URL'
        }
      ];

      cy.wrap(validateJWKSConfiguration(failureTests, {
        timeout: TEST_TIMEOUT,
        expectFailure: true
      }))
        .then(() => {
          logTestStep('09-jwt-single', 'JWKS failure handling validated');
        })
        .catch((error) => {
          trackTestFailure('09-jwt-single', 'jwks-failure-handling', error);
          throw error;
        });

      validateNoConsoleErrors('JWKS failure handling', {
        allowedErrors: ['connection failed', 'service unavailable', 'invalid URL']
      });
    });

    it('R-JWT-018: Should handle malformed configuration gracefully', () => {
      logTestStep('09-jwt-single', 'Testing malformed configuration handling');

      // Test with invalid configuration values
      const invalidConfigs = [
        { property: 'issuer.jwks-uri', value: 'not-a-url', expectedError: 'invalid URL format' },
        { property: 'issuer.algorithm', value: 'INVALID_ALG', expectedError: 'unsupported algorithm' },
        { property: 'issuer.audience', value: '', expectedError: 'audience required' },
        { property: 'issuer.issuer', value: '', expectedError: 'issuer required' },
        { property: 'issuer.name', value: '', expectedError: 'name required' }
      ];

      cy.wrap(validateProcessorAvailability(PROCESSOR_TYPE))
        .then((result) => {
          expect(result.isAvailable).to.be.true;
          return createProcessorInstance(PROCESSOR_TYPE, { x: 400, y: 400 });
        })
        .then((processorId) => {
          // Test each invalid configuration using helper function
          validateInvalidConfigurations(processorId, invalidConfigs);
        })
        .catch((error) => {
          trackTestFailure('09-jwt-single', 'malformed-config-handling', error);
          throw error;
        });

      validateNoConsoleErrors('Malformed configuration handling', {
        allowedErrors: ['invalid URL format', 'unsupported algorithm', 'audience required', 'issuer required', 'name required']
      });
    });

    it('R-JWT-019: Should handle token expiration scenarios', () => {
      logTestStep('09-jwt-single', 'Testing token expiration handling');

      const expirationTests = [
        {
          token: getSingleIssuerTestData('expired-token')[0].token,
          shouldBeValid: false,
          description: 'Expired JWT token',
          expectedResult: 'token expired'
        },
        {
          token: getSingleIssuerTestData('not-yet-valid')[0].token,
          shouldBeValid: false,
          description: 'JWT token not yet valid (nbf claim)',
          expectedResult: 'token not yet valid'
        },
        {
          token: getSingleIssuerTestData('valid-token')[0].token,
          shouldBeValid: true,
          description: 'Valid JWT token',
          expectedResult: 'valid'
        }
      ];

      cy.wrap(validateJWTTokenProcessing(expirationTests, {
        timeout: TEST_TIMEOUT,
        processorType: PROCESSOR_TYPE
      }))
        .then(() => {
          logTestStep('09-jwt-single', 'Token expiration handling validated');
        })
        .catch((error) => {
          trackTestFailure('09-jwt-single', 'token-expiration-handling', error);
          throw error;
        });

      validateNoConsoleErrors('Token expiration handling');
    });
  });
});
