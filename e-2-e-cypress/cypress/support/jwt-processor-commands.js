/**
 * @file JWT Processor Commands - Comprehensive testing framework for JWT processors
 * Provides specialized commands for testing JWT token authentication processors
 * Built on Phase 2 Angular Material framework foundation
 * @version 1.0.0
 */

import {
  JWT_PROCESSORS,
  JWT_TEST_SCENARIOS,
  JWT_CONFIG_TESTS,
  JWT_PERFORMANCE_THRESHOLDS,
  SELECTORS
} from './constants';
import { logMessage } from './utils';

/**
 * Configure a JWT processor with specific properties
 * @param {string} processorType - JWT processor type (JWT_AUTHENTICATOR or MULTI_ISSUER)
 * @param {Object} configuration - Configuration properties
 * @param {Object} options - Configuration options
 */
Cypress.Commands.add('configureJWTProcessor', (processorType, configuration = {}, options = {}) => {
  const {
    useTestValues = true,
    validateConfiguration = true
  } = options;

  logMessage('action', `Configuring JWT processor: ${processorType}`);

  return cy.getJWTProcessorTypes().then((types) => {
    const processorDef = types[processorType];
    if (!processorDef) {
      throw new Error(`Unknown JWT processor type: ${processorType}`);
    }

    // Merge test values with provided configuration
    const finalConfig = {};
    Object.keys(processorDef.properties).forEach(propKey => {
      const propDef = processorDef.properties[propKey];
      if (configuration[propKey] !== undefined) {
        finalConfig[propKey] = configuration[propKey];
      } else if (useTestValues && propDef.testValue) {
        finalConfig[propKey] = propDef.testValue;
      } else {
        finalConfig[propKey] = propDef.defaultValue;
      }
    });

    logMessage('info', `Final configuration: ${JSON.stringify(finalConfig, null, 2)}`);

    // In mocked environment, simulate configuration
    if (validateConfiguration) {
      return cy.validateJWTProcessorConfiguration(processorType, finalConfig).then((isValid) => {
        if (!isValid) {
          throw new Error(`Invalid configuration for ${processorType}`);
        }
        return cy.wrap(finalConfig);
      });
    }

    return cy.wrap(finalConfig);
  });
});

/**
 * Validate JWT processor configuration
 * @param {string} processorType - JWT processor type
 * @param {Object} configuration - Configuration to validate
 */
Cypress.Commands.add('validateJWTProcessorConfiguration', (processorType, configuration) => {
  logMessage('action', `Validating configuration for ${processorType}`);

  return cy.getJWTProcessorTypes().then((types) => {
    const processorDef = types[processorType];
    const errors = [];

    // Validate required properties
    Object.keys(processorDef.properties).forEach(propKey => {
      const propDef = processorDef.properties[propKey];
      const value = configuration[propKey];

      if (propDef.required && (!value || value.trim() === '')) {
        errors.push(`${propDef.name} is required but not provided`);
      }

      // Validate specific property formats
      if (propKey === 'jwksUrl' && value) {
        try {
          new URL(value);
        } catch (e) {
          errors.push(`${propDef.name} must be a valid URL`);
        }
      }

      if (propKey === 'issuerConfigurations' && value) {
        try {
          const configs = JSON.parse(value);
          if (!Array.isArray(configs)) {
            errors.push(`${propDef.name} must be a JSON array`);
          }
        } catch (e) {
          errors.push(`${propDef.name} must be valid JSON`);
        }
      }
    });

    if (errors.length > 0) {
      logMessage('error', `Configuration validation failed: ${errors.join(', ')}`);
      return cy.wrap(false);
    }

    logMessage('success', `Configuration validation passed for ${processorType}`);
    return cy.wrap(true);
  });
});

/**
 * Test JWT processor with specific token scenario
 * @param {string} processorType - JWT processor type
 * @param {string} scenarioKey - Test scenario key from JWT_TEST_SCENARIOS
 * @param {Object} options - Test options
 */
Cypress.Commands.add('testJWTProcessorScenario', (processorType, scenarioKey, options = {}) => {
  const {
    configuration = {},
    expectSuccess = null,
    timeout = 5000
  } = options;

  logMessage('action', `Testing JWT processor scenario: ${processorType} - ${scenarioKey}`);

  const scenario = JWT_TEST_SCENARIOS[scenarioKey];
  if (!scenario) {
    throw new Error(`Unknown test scenario: ${scenarioKey}`);
  }

  // First configure the processor
  return cy.configureJWTProcessor(processorType, configuration).then((config) => {
    // Load test token if needed
    let tokenPromise;
    if (scenario.tokenFixture && scenario.tokenKey) {
      tokenPromise = cy.fixture(scenario.tokenFixture).then((tokens) => tokens[scenario.tokenKey]);
    } else if (scenario.tokenValue !== undefined) {
      tokenPromise = cy.wrap(scenario.tokenValue);
    } else {
      throw new Error(`No token data specified for scenario: ${scenarioKey}`);
    }

    return tokenPromise.then((tokenData) => {
      // Simulate processing the token
      return cy.simulateJWTTokenProcessing(processorType, tokenData, config).then((result) => {
        // Validate expected outcome
        let expectedRelationship;
        if (expectSuccess !== null) {
          expectedRelationship = expectSuccess ? 'success' : 'failure';
        } else if (typeof scenario.expectedRelationship === 'object') {
          // Processor-specific expected relationship
          expectedRelationship = scenario.expectedRelationship[processorType] || scenario.expectedRelationship.default || 'failure';
        } else {
          // Simple string expected relationship
          expectedRelationship = scenario.expectedRelationship;
        }

        // Special handling for custom configurations that might change expected outcomes
        if (Object.keys(configuration).length > 0 && scenarioKey === 'VALID_TOKEN') {
          // Check if custom configuration would cause validation to fail
          if (typeof tokenData === 'object' && tokenData.payload) {
            const payload = tokenData.payload;

            // Check if custom audience would cause failure
            if (configuration.expectedAudience && payload.aud !== configuration.expectedAudience) {
              expectedRelationship = 'failure';
            }

            // Check if custom issuer would cause failure
            if (configuration.expectedIssuer && payload.iss !== configuration.expectedIssuer) {
              expectedRelationship = 'failure';
            }
          }
        }

        if (result.relationship !== expectedRelationship) {
          throw new Error(
            `Expected relationship '${expectedRelationship}' but got '${result.relationship}' for scenario ${scenarioKey}`
          );
        }

        logMessage('success', `Scenario ${scenarioKey} completed successfully: ${result.relationship}`);
        return cy.wrap(result);
      });
    });
  });
});

/**
 * Simulate JWT token processing (mocked implementation)
 * @param {string} processorType - JWT processor type
 * @param {string|Object} tokenData - JWT token data
 * @param {Object} configuration - Processor configuration
 */
Cypress.Commands.add('simulateJWTTokenProcessing', (processorType, tokenData, configuration) => {
  logMessage('action', `Simulating JWT token processing for ${processorType}`);

  // Mock JWT token validation logic
  return cy.wrap(null).then(() => {
    const result = {
      processorType,
      tokenData,
      configuration,
      relationship: 'success',
      processingTime: Math.random() * 50 + 10, // 10-60ms
      attributes: {}
    };

    // Simulate validation logic based on token data
    if (typeof tokenData === 'string') {
      if (tokenData === '' || tokenData === 'invalid.jwt.token') {
        result.relationship = 'failure';
        result.attributes.error = 'Invalid token format';
        return result;
      }
    }

    if (typeof tokenData === 'object' && tokenData.payload) {
      const payload = tokenData.payload;

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        result.relationship = 'expired';
        result.attributes.error = 'Token expired';
        return result;
      }

      // Check issuer for single issuer processor
      if (processorType === 'JWT_AUTHENTICATOR') {
        if (configuration.expectedIssuer && payload.iss !== configuration.expectedIssuer) {
          result.relationship = 'failure';
          result.attributes.error = 'Invalid issuer';
          return result;
        }
      }

      // Check issuer for multi-issuer processor
      if (processorType === 'MULTI_ISSUER') {
        try {
          const issuerConfigs = JSON.parse(configuration.issuerConfigurations || '[]');
          const validIssuer = issuerConfigs.find(config => config.issuer === payload.iss);
          if (!validIssuer) {
            result.relationship = 'unknownIssuer';
            result.attributes.error = 'Unknown issuer';
            return result;
          }
        } catch (e) {
          result.relationship = 'failure';
          result.attributes.error = 'Invalid issuer configuration';
          return result;
        }
      }

      // Check audience if configured
      if (configuration.expectedAudience && payload.aud !== configuration.expectedAudience) {
        result.relationship = 'failure';
        result.attributes.error = 'Invalid audience';
        return result;
      }

      // Success case
      result.attributes.subject = payload.sub;
      result.attributes.issuer = payload.iss;
      result.attributes.audience = payload.aud;
      result.attributes.scope = payload.scope;
    }

    return result;
  });
});

/**
 * Run comprehensive JWT processor test suite
 * @param {string} processorType - JWT processor type
 * @param {Object} options - Test suite options
 */
Cypress.Commands.add('runJWTProcessorTestSuite', (processorType, options = {}) => {
  const {
    includePerformanceTests = false,
    customConfiguration = {},
    scenariosToTest = null
  } = options;

  logMessage('action', `Running comprehensive test suite for ${processorType}`);

  const configTest = Object.values(JWT_CONFIG_TESTS).find(test => test.processor === processorType);
  if (!configTest) {
    throw new Error(`No configuration test found for processor: ${processorType}`);
  }

  const scenarios = scenariosToTest || configTest.scenarios;
  const results = [];

  // Run each scenario sequentially
  function runScenarioSequentially(scenarioList, index = 0) {
    if (index >= scenarioList.length) {
      logMessage('success', `Test suite completed for ${processorType}: ${results.length} scenarios tested`);
      return cy.wrap(results);
    }

    const scenarioKey = scenarioList[index];

    // Use cy.then() with try/catch for proper error handling
    return cy.then(() => {
      return cy.testJWTProcessorScenario(processorType, scenarioKey, {
        configuration: customConfiguration
      });
    }).then((result) => {
      results.push({
        scenario: scenarioKey,
        result: result,
        success: true
      });
      return runScenarioSequentially(scenarioList, index + 1);
    }, (error) => {
      // Handle errors in the second parameter of .then()
      results.push({
        scenario: scenarioKey,
        error: error.message,
        success: false
      });
      logMessage('warn', `Scenario ${scenarioKey} failed: ${error.message}`);
      return runScenarioSequentially(scenarioList, index + 1);
    });
  }

  return runScenarioSequentially(scenarios);
});

/**
 * Test JWT processor performance
 * @param {string} processorType - JWT processor type
 * @param {Object} options - Performance test options
 */
Cypress.Commands.add('testJWTProcessorPerformance', (processorType, options = {}) => {
  const {
    tokenCount = 100,
    configuration = {},
    thresholds = JWT_PERFORMANCE_THRESHOLDS
  } = options;

  logMessage('action', `Running performance test for ${processorType} with ${tokenCount} tokens`);

  const startTime = Date.now();
  const results = [];

  return cy.configureJWTProcessor(processorType, configuration).then((config) => {
    // Get test token once
    return cy.fixture('tokens/test-tokens.json').then((tokens) => {
      const testToken = tokens.validToken;

      // Process tokens sequentially for performance measurement
      function processTokensSequentially(index = 0) {
        if (index >= tokenCount) {
          // All tokens processed, calculate performance metrics
          const totalTime = Date.now() - startTime;
          const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
          const throughput = (tokenCount / totalTime) * 1000; // tokens per second

          const performanceResult = {
            processorType,
            tokenCount,
            totalTime,
            avgProcessingTime,
            throughput,
            results,
            thresholds,
            passed: {
              avgProcessingTime: avgProcessingTime <= thresholds.TOKEN_VALIDATION_TIME,
              throughput: throughput >= thresholds.PROCESSOR_THROUGHPUT
            }
          };

          logMessage('success', `Performance test completed: ${throughput.toFixed(2)} tokens/sec, ${avgProcessingTime.toFixed(2)}ms avg`);
          return cy.wrap(performanceResult);
        }

        // Process single token
        const tokenStartTime = Date.now();
        return cy.simulateJWTTokenProcessing(processorType, testToken, config).then((result) => {
          const processingTime = Date.now() - tokenStartTime;
          results.push({
            tokenIndex: index,
            processingTime,
            relationship: result.relationship
          });
          return processTokensSequentially(index + 1);
        });
      }

      return processTokensSequentially();
    });
  });
});
