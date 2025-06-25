/**
 * @fileoverview Error Scenarios test implementation for NiFi JWT extension
 * Comprehensive error handling and edge case testing
 * Following requirements from Requirements.md and Specification.adoc
 * 
 * @requirements R-ERR-001, R-ERR-002, R-ERR-003, R-ERR-004, R-ERR-005
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
  cleanupProcessors
} from '../../support/utils/processor-helpers.js';

import {
  navigateToNiFiCanvas,
  waitForPageLoad
} from '../../support/utils/ui-helpers.js';

import {
  validateJWTTokenProcessing,
  validateJWKSConfiguration,
  validateNoConsoleErrors
} from '../../support/utils/validation-helpers.js';

import {
  logTestStep,
  trackTestFailure,
  captureDebugInfo
} from '../../support/utils/error-tracking.js';

import {
  getTestJWTTokens
} from '../../support/utils/test-data.js';

// Test constants
const TEST_TIMEOUT = 30000;
const ERROR_RECOVERY_TIMEOUT = 5000;

// Test data for error scenarios
const MALFORMED_TOKENS = [
  {
    token: '',
    description: 'Empty token',
    expectedError: 'empty token'
  },
  {
    token: 'not-a-jwt',
    description: 'Plain text instead of JWT',
    expectedError: 'invalid format'
  },
  {
    token: 'one.part',
    description: 'JWT with only two parts',
    expectedError: 'invalid format'
  },
  {
    token: 'one.two.three.four',
    description: 'JWT with four parts',
    expectedError: 'invalid format'
  },
  {
    token: 'invalid-base64.invalid-base64.invalid-base64',
    description: 'JWT with invalid base64 encoding',
    expectedError: 'base64 decoding failed'
  }
];

const NETWORK_ERROR_SCENARIOS = [
  {
    endpoint: 'https://nonexistent-domain-12345.com/.well-known/jwks.json',
    description: 'DNS resolution failure',
    expectedError: 'DNS resolution failed'
  },
  {
    endpoint: 'https://httpstat.us/500',
    description: 'Server internal error',
    expectedError: 'server error'
  },
  {
    endpoint: 'https://httpstat.us/404',
    description: 'JWKS endpoint not found',
    expectedError: 'not found'
  },
  {
    endpoint: 'https://httpstat.us/timeout',
    description: 'Connection timeout',
    expectedError: 'timeout'
  },
  {
    endpoint: 'https://httpstat.us/429',
    description: 'Rate limit exceeded',
    expectedError: 'rate limit'
  }
];

// Helper functions for error testing
function testMalformedTokens(processorType) {
  return MALFORMED_TOKENS.map(tokenTest => ({
    token: tokenTest.token,
    shouldBeValid: false,
    description: tokenTest.description,
    expectedResult: tokenTest.expectedError
  }));
}

function testNetworkFailures(scenarios) {
  return scenarios.map(scenario => ({
    endpoint: scenario.endpoint,
    shouldConnect: false,
    description: scenario.description,
    expectedError: scenario.expectedError
  }));
}

function validateInvalidConfigurations(processorId, invalidConfigs) {
  invalidConfigs.forEach((config) => {
    cy.wrap(configureProcessorProperty(processorId, config.property, config.value))
      .then((result) => {
        expect(result.success).to.be.false;
        expect(result.error).to.contain(config.expectedError);
        logTestStep('10-error-scenarios', `Invalid config rejected: ${config.property}`);
      });
  });
}

function validateConfigurationConflicts(processorId, conflictingConfigs) {
  conflictingConfigs.forEach((conflictTest) => {
    // Apply all configurations
    conflictTest.configs.forEach((config) => {
      cy.wrap(configureProcessorProperty(processorId, config.property, config.value));
    });

    // Validate that conflict is detected
    cy.get('.configuration-error, .validation-error, .conflict-error')
      .should('be.visible')
      .should('contain', conflictTest.expectedError);

    logTestStep('10-error-scenarios', `Configuration conflict detected: ${conflictTest.expectedError}`);
  });
}

describe('10 - Error Scenarios and Edge Cases', () => {
  beforeEach(() => {
    logTestStep('10-error-scenarios', 'Starting error scenarios test');
    cy.clearCookies();
    cy.clearLocalStorage();
    captureDebugInfo('10-error-scenarios');
  });

  afterEach(() => {
    captureDebugInfo('10-error-scenarios');
  });

  context('Malformed Token Handling', () => {
    beforeEach(() => {
      authenticateUser('admin', 'password');
      navigateToNiFiCanvas();
      waitForPageLoad();
    });

    afterEach(() => {
      cleanupProcessors();
      cleanupSession();
    });

    it('R-ERR-001: Should handle malformed JWT tokens gracefully', () => {
      logTestStep('10-error-scenarios', 'Testing malformed token handling');

      const malformedTests = testMalformedTokens('MultiIssuerJWTTokenAuthenticator');
      
      cy.wrap(validateJWTTokenProcessing(malformedTests, {
        timeout: TEST_TIMEOUT,
        processorType: 'MultiIssuerJWTTokenAuthenticator',
        expectFailure: true
      }))
        .then(() => {
          logTestStep('10-error-scenarios', 'Malformed token handling validated');
        })
        .catch((error) => {
          trackTestFailure('10-error-scenarios', 'malformed-tokens', error);
          throw error;
        });

      validateNoConsoleErrors('Malformed token handling', {
        allowedErrors: ['empty token', 'invalid format', 'base64 decoding failed']
      });
    });

    it('R-ERR-002: Should handle extremely large tokens', () => {
      logTestStep('10-error-scenarios', 'Testing large token handling');

      const largeTokenTests = [
        {
          token: 'a'.repeat(100000), // 100KB token
          shouldBeValid: false,
          description: 'Extremely large token (100KB)',
          expectedResult: 'token too large'
        },
        {
          token: 'a'.repeat(1000000), // 1MB token  
          shouldBeValid: false,
          description: 'Extremely large token (1MB)',
          expectedResult: 'token too large'
        }
      ];

      cy.wrap(validateJWTTokenProcessing(largeTokenTests, {
        timeout: TEST_TIMEOUT,
        processorType: 'MultiIssuerJWTTokenAuthenticator',
        expectFailure: true
      }))
        .then(() => {
          logTestStep('10-error-scenarios', 'Large token handling validated');
        })
        .catch((error) => {
          trackTestFailure('10-error-scenarios', 'large-tokens', error);
          throw error;
        });

      validateNoConsoleErrors('Large token handling', {
        allowedErrors: ['token too large']
      });
    });

    it('R-ERR-003: Should handle special characters in tokens', () => {
      logTestStep('10-error-scenarios', 'Testing special character handling');

      const specialCharacterTests = [
        {
          token: 'token.with.🚀.emoji',
          shouldBeValid: false,
          description: 'Token with emoji characters',
          expectedResult: 'invalid characters'
        },
        {
          token: 'token.with.\u0000null\u0001control.chars',
          shouldBeValid: false,
          description: 'Token with null and control characters',
          expectedResult: 'invalid characters'
        },
        {
          token: 'token.with.\\..backslashes',
          shouldBeValid: false,
          description: 'Token with backslashes',
          expectedResult: 'invalid format'
        }
      ];

      cy.wrap(validateJWTTokenProcessing(specialCharacterTests, {
        timeout: TEST_TIMEOUT,
        processorType: 'MultiIssuerJWTTokenAuthenticator',
        expectFailure: true
      }))
        .then(() => {
          logTestStep('10-error-scenarios', 'Special character handling validated');
        })
        .catch((error) => {
          trackTestFailure('10-error-scenarios', 'special-characters', error);
          throw error;
        });

      validateNoConsoleErrors('Special character handling', {
        allowedErrors: ['invalid characters', 'invalid format']
      });
    });
  });

  context('Network Failure Scenarios', () => {
    beforeEach(() => {
      authenticateUser('admin', 'password');
      navigateToNiFiCanvas();
      waitForPageLoad();
    });

    afterEach(() => {
      cleanupProcessors();
      cleanupSession();
    });

    it('R-ERR-004: Should handle JWKS endpoint network failures', () => {
      logTestStep('10-error-scenarios', 'Testing JWKS network failure handling');

      const networkFailureTests = testNetworkFailures(NETWORK_ERROR_SCENARIOS);
      
      cy.wrap(validateJWKSConfiguration(networkFailureTests, {
        timeout: TEST_TIMEOUT,
        expectFailure: true
      }))
        .then(() => {
          logTestStep('10-error-scenarios', 'JWKS network failure handling validated');
        })
        .catch((error) => {
          trackTestFailure('10-error-scenarios', 'network-failures', error);
          throw error;
        });

      validateNoConsoleErrors('JWKS network failure handling', {
        allowedErrors: ['DNS resolution failed', 'server error', 'not found', 'timeout', 'rate limit']
      });
    });

    it('R-ERR-005: Should handle JWKS response format errors', () => {
      logTestStep('10-error-scenarios', 'Testing JWKS response format error handling');

      const formatErrorTests = [
        {
          endpoint: 'https://httpbin.org/json', // Returns valid JSON but not JWKS format
          shouldConnect: false,
          description: 'Valid JSON but invalid JWKS format',
          expectedError: 'invalid JWKS format'
        },
        {
          endpoint: 'https://httpbin.org/html', // Returns HTML instead of JSON
          shouldConnect: false,
          description: 'HTML response instead of JSON',
          expectedError: 'invalid JSON'
        },
        {
          endpoint: 'https://httpbin.org/xml', // Returns XML instead of JSON
          shouldConnect: false,
          description: 'XML response instead of JSON',
          expectedError: 'invalid JSON'
        }
      ];

      cy.wrap(validateJWKSConfiguration(formatErrorTests, {
        timeout: TEST_TIMEOUT,
        expectFailure: true
      }))
        .then(() => {
          logTestStep('10-error-scenarios', 'JWKS format error handling validated');
        })
        .catch((error) => {
          trackTestFailure('10-error-scenarios', 'format-errors', error);
          throw error;
        });

      validateNoConsoleErrors('JWKS format error handling', {
        allowedErrors: ['invalid JWKS format', 'invalid JSON']
      });
    });

    it('R-ERR-006: Should handle connection recovery scenarios', () => {
      logTestStep('10-error-scenarios', 'Testing connection recovery');

      // Test initial failure followed by recovery
      const recoveryTest = {
        endpoint: 'https://httpstat.us/503', // Initially fails
        recoveryEndpoint: 'https://httpstat.us/200', // Then succeeds
        description: 'Connection recovery after failure'
      };

      // First test failure
      cy.wrap(validateJWKSConfiguration([{
        endpoint: recoveryTest.endpoint,
        shouldConnect: false,
        description: 'Initial connection failure',
        expectedError: 'service unavailable'
      }], {
        timeout: TEST_TIMEOUT,
        expectFailure: true
      }))
        .then(() => {
          logTestStep('10-error-scenarios', 'Initial failure confirmed');
          
          // Wait for recovery period
          cy.wait(ERROR_RECOVERY_TIMEOUT);
          
          // Test recovery (mock by using successful endpoint)
          return validateJWKSConfiguration([{
            endpoint: recoveryTest.recoveryEndpoint,
            shouldConnect: true,
            description: 'Connection recovery test',
            expectedKeys: []
          }], {
            timeout: TEST_TIMEOUT
          });
        })
        .then(() => {
          logTestStep('10-error-scenarios', 'Connection recovery validated');
        })
        .catch((error) => {
          trackTestFailure('10-error-scenarios', 'connection-recovery', error);
          throw error;
        });

      validateNoConsoleErrors('Connection recovery testing', {
        allowedErrors: ['service unavailable']
      });
    });
  });

  context('Configuration Error Scenarios', () => {
    beforeEach(() => {
      authenticateUser('admin', 'password');
      navigateToNiFiCanvas();
      waitForPageLoad();
    });

    afterEach(() => {
      cleanupProcessors();
      cleanupSession();
    });

    it('R-ERR-007: Should handle invalid configuration values', () => {
      logTestStep('10-error-scenarios', 'Testing invalid configuration handling');

      const processorType = 'MultiIssuerJWTTokenAuthenticator';
      
      cy.wrap(validateProcessorAvailability(processorType))
        .then((result) => {
          expect(result.isAvailable).to.be.true;
          return createProcessorInstance(processorType, { x: 300, y: 300 });
        })
        .then((processorId) => {
          const invalidConfigs = [
            { property: 'issuer.1.jwks-uri', value: 'invalid-url', expectedError: 'invalid URL' },
            { property: 'issuer.1.algorithm', value: 'INVALID', expectedError: 'unsupported algorithm' },
            { property: 'issuer.1.audience', value: '', expectedError: 'required field' },
            { property: 'issuer.1.cache-duration', value: '-1', expectedError: 'invalid duration' },
            { property: 'issuer.1.timeout', value: 'not-a-number', expectedError: 'invalid number' }
          ];

          // Test each invalid configuration using helper function
          validateInvalidConfigurations(processorId, invalidConfigs);
        })
        .catch((error) => {
          trackTestFailure('10-error-scenarios', 'invalid-configuration', error);
          throw error;
        });

      validateNoConsoleErrors('Invalid configuration handling', {
        allowedErrors: ['invalid URL', 'unsupported algorithm', 'required field', 'invalid duration', 'invalid number']
      });
    });

    it('R-ERR-008: Should handle configuration conflicts', () => {
      logTestStep('10-error-scenarios', 'Testing configuration conflict handling');

      const processorType = 'MultiIssuerJWTTokenAuthenticator';
      
      cy.wrap(validateProcessorAvailability(processorType))
        .then((result) => {
          expect(result.isAvailable).to.be.true;
          return createProcessorInstance(processorType, { x: 400, y: 400 });
        })
        .then((processorId) => {
          const conflictingConfigs = [
            {
              configs: [
                { property: 'issuer.1.name', value: 'duplicate-name' },
                { property: 'issuer.2.name', value: 'duplicate-name' }
              ],
              expectedError: 'duplicate issuer names'
            },
            {
              configs: [
                { property: 'issuer.1.jwks-uri', value: 'https://same-endpoint.com/.well-known/jwks.json' },
                { property: 'issuer.2.jwks-uri', value: 'https://same-endpoint.com/.well-known/jwks.json' }
              ],
              expectedError: 'duplicate JWKS endpoints'
            }
          ];

          conflictingConfigs.forEach((conflictTest) => {
            // Apply all configurations
            conflictTest.configs.forEach((config) => {
              cy.wrap(configureProcessorProperty(processorId, config.property, config.value));
            });

            // Validate that conflict is detected
            cy.get('.configuration-error, .validation-error, .conflict-error')
              .should('be.visible')
              .should('contain', conflictTest.expectedError);

            logTestStep('10-error-scenarios', `Configuration conflict detected: ${conflictTest.expectedError}`);
          });
        })
        .catch((error) => {
          trackTestFailure('10-error-scenarios', 'configuration-conflicts', error);
          throw error;
        });

      validateNoConsoleErrors('Configuration conflict handling', {
        allowedErrors: ['duplicate issuer names', 'duplicate JWKS endpoints']
      });
    });
  });

  context('Resource Exhaustion Scenarios', () => {
    beforeEach(() => {
      authenticateUser('admin', 'password');
      navigateToNiFiCanvas();
      waitForPageLoad();
    });

    afterEach(() => {
      cleanupProcessors();
      cleanupSession();
    });

    it('R-ERR-009: Should handle memory pressure gracefully', () => {
      logTestStep('10-error-scenarios', 'Testing memory pressure handling');

      // Simulate memory pressure by processing many large tokens simultaneously
      const largeTokens = [];
      for (let i = 0; i < 50; i++) {
        largeTokens.push({
          token: 'x'.repeat(10000), // 10KB each
          shouldBeValid: false,
          description: `Large token ${i + 1}`,
          expectedResult: 'processed'
        });
      }

      cy.wrap(validateJWTTokenProcessing(largeTokens, {
        timeout: TEST_TIMEOUT * 2,
        processorType: 'MultiIssuerJWTTokenAuthenticator',
        concurrent: true,
        expectFailure: false // Should handle gracefully, not fail
      }))
        .then(() => {
          logTestStep('10-error-scenarios', 'Memory pressure handling validated');
        })
        .catch((error) => {
          trackTestFailure('10-error-scenarios', 'memory-pressure', error);
          throw error;
        });

      validateNoConsoleErrors('Memory pressure handling', {
        allowedErrors: ['memory warning', 'garbage collection']
      });
    });

    it('R-ERR-010: Should handle high concurrency gracefully', () => {
      logTestStep('10-error-scenarios', 'Testing high concurrency handling');

      // Create many concurrent token validation requests
      const concurrentTests = [];
      for (let i = 0; i < 100; i++) {
        concurrentTests.push({
          token: getTestJWTTokens('valid')[0].token,
          shouldBeValid: true,
          description: `Concurrent validation ${i + 1}`,
          expectedResult: 'valid'
        });
      }

      const startTime = Date.now();
      
      cy.wrap(Promise.all(concurrentTests.map(test => 
        validateJWTTokenProcessing([test], {
          timeout: TEST_TIMEOUT,
          processorType: 'MultiIssuerJWTTokenAuthenticator'
        })
      )))
        .then(() => {
          const endTime = Date.now();
          const totalTime = endTime - startTime;
          
          logTestStep('10-error-scenarios', `High concurrency handled in ${totalTime}ms`);
          
          // Should complete in reasonable time despite high concurrency
          expect(totalTime).to.be.lessThan(60000); // 60 seconds max
        })
        .catch((error) => {
          trackTestFailure('10-error-scenarios', 'high-concurrency', error);
          throw error;
        });

      validateNoConsoleErrors('High concurrency handling', {
        allowedErrors: ['thread pool warning', 'queue full']
      });
    });
  });

  context('Graceful Degradation', () => {
    beforeEach(() => {
      authenticateUser('admin', 'password');
      navigateToNiFiCanvas();
      waitForPageLoad();
    });

    afterEach(() => {
      cleanupProcessors();
      cleanupSession();
    });

    it('R-ERR-011: Should degrade gracefully when JWKS is unavailable', () => {
      logTestStep('10-error-scenarios', 'Testing graceful degradation when JWKS unavailable');

      const degradationTest = {
        endpoint: 'https://httpstat.us/503', // Unavailable JWKS endpoint
        description: 'JWKS endpoint unavailable - should use cached keys or fail gracefully'
      };

      cy.wrap(validateJWKSConfiguration([{
        endpoint: degradationTest.endpoint,
        shouldConnect: false,
        description: degradationTest.description,
        expectedError: 'service unavailable'
      }], {
        timeout: TEST_TIMEOUT,
        expectFailure: true,
        gracefulDegradation: true
      }))
        .then(() => {
          logTestStep('10-error-scenarios', 'Graceful degradation validated');
          
          // System should still be responsive for other operations
          return navigateToNiFiCanvas();
        })
        .then(() => {
          logTestStep('10-error-scenarios', 'System remains responsive after degradation');
        })
        .catch((error) => {
          trackTestFailure('10-error-scenarios', 'graceful-degradation', error);
          throw error;
        });

      validateNoConsoleErrors('Graceful degradation', {
        allowedErrors: ['service unavailable', 'degraded mode']
      });
    });
  });
});
