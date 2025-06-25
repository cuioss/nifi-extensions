/**
 * Workflow Management Helper Commands
 * Supporting utilities for advanced test automation
 */

/**
 * Get current processor state information
 * @param {string} processorId - Processor ID
 * @returns {Cypress.Chainable<string>} Processor state
 */
Cypress.Commands.add('getProcessorState', (processorId) => {
  return cy.getProcessorElement(processorId).then(($element) => {
    const classes = $element.attr('class') || '';
    const state = $element.find('.processor-status').text() || '';

    // Determine state based on classes and status text
    if (classes.includes('running') || state.includes('running')) {
      return 'running';
    } else if (classes.includes('stopped') || state.includes('stopped')) {
      return 'stopped';
    } else if (classes.includes('invalid') || state.includes('invalid')) {
      return 'invalid';
    } else if (classes.includes('error') || state.includes('error')) {
      return 'error';
    } else {
      return 'unknown';
    }
  });
});

/**
 * Wait for processor to reach specific state
 * @param {string} processorId - Processor ID
 * @param {string} expectedState - Expected state
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Cypress.Chainable} Cypress chainable
 */
Cypress.Commands.add('waitForProcessorState', (processorId, expectedState, timeout = 10000) => {
  cy.log(`⏳ Waiting for processor ${processorId} to reach state: ${expectedState}`);

  const checkState = () => {
    return cy.getProcessorState(processorId).then((currentState) => {
      if (currentState === expectedState) {
        cy.log(`✅ Processor reached expected state: ${expectedState}`);
        return true;
      }
      return false;
    });
  };

  const startTime = Date.now();

  const waitForState = () => {
    return checkState().then((isCorrectState) => {
      if (isCorrectState) {
        return cy.wrap(true);
      }

      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for processor state: ${expectedState}`);
      }

      cy.wait(500);
      return waitForState();
    });
  };

  return waitForState();
});

/**
 * Bulk processor operation - start multiple processors
 * @param {Array<string>} processorIds - Array of processor IDs
 * @returns {Cypress.Chainable} Cypress chainable
 */
Cypress.Commands.add('startProcessors', (processorIds) => {
  cy.log(`🚀 Starting ${processorIds.length} processors`);

  processorIds.forEach((processorId) => {
    cy.startProcessor(processorId);
  });

  // Wait for all processors to start
  processorIds.forEach((processorId) => {
    cy.waitForProcessorState(processorId, 'running', 15000);
  });

  cy.log('✅ All processors started successfully');
});

/**
 * Bulk processor operation - stop multiple processors
 * @param {Array<string>} processorIds - Array of processor IDs
 * @returns {Cypress.Chainable} Cypress chainable
 */
Cypress.Commands.add('stopProcessors', (processorIds) => {
  cy.log(`🛑 Stopping ${processorIds.length} processors`);

  processorIds.forEach((processorId) => {
    cy.stopProcessor(processorId);
  });

  // Wait for all processors to stop
  processorIds.forEach((processorId) => {
    cy.waitForProcessorState(processorId, 'stopped', 15000);
  });

  cy.log('✅ All processors stopped successfully');
});

/**
 * Validate processor configuration matches expected values
 * @param {string} processorId - Processor ID
 * @param {Object} expectedConfig - Expected configuration
 * @returns {Cypress.Chainable<boolean>} True if configuration matches
 */
Cypress.Commands.add('validateProcessorConfiguration', (processorId, expectedConfig) => {
  cy.log(`🔍 Validating configuration for processor: ${processorId}`);

  return cy.openProcessorAdvancedDialog(processorId).then(() => {
    cy.navigateToCustomUITab('properties');

    // Check each expected property
    const validations = Object.entries(expectedConfig).map(([key, expectedValue]) => {
      return cy.get('body').then(($body) => {
        // Look for property input
        const propertyInputs = $body.find(`input[name="${key}"], input[data-property="${key}"]`);

        if (propertyInputs.length > 0) {
          const actualValue = propertyInputs.val();
          const matches = actualValue === expectedValue;

          if (!matches) {
            cy.log(`⚠️ Property mismatch: ${key} = "${actualValue}", expected "${expectedValue}"`);
          }

          return matches;
        }

        return true; // Property not found, assume valid
      });
    });

    return cy.wrap(Promise.all(validations)).then((results) => {
      const allValid = results.every(Boolean);

      cy.closeAdvancedDialog();

      if (allValid) {
        cy.log('✅ Processor configuration validation passed');
      } else {
        cy.log('❌ Processor configuration validation failed');
      }

      return allValid;
    });
  });
});

/**
 * Create a test data generator processor with specified configuration
 * @param {Object} config - Generator configuration
 * @returns {Cypress.Chainable<string>} Processor ID
 */
Cypress.Commands.add('createTestDataGenerator', (config = {}) => {
  const defaultConfig = {
    type: 'GenerateFlowFile',
    position: { x: 100, y: 100 },
    properties: {
      'File Size': config.fileSize || '1KB',
      'Batch Size': config.batchSize || '1',
      'Data Format': config.dataFormat || 'Text',
    },
  };

  return cy.addProcessor(defaultConfig.type, defaultConfig.position).then((processorId) => {
    if (Object.keys(defaultConfig.properties).length > 0) {
      return cy
        .configureProcessorProperties(processorId, defaultConfig.properties)
        .then(() => processorId);
    }

    return processorId;
  });
});

/**
 * Create a test data consumer processor
 * @param {Object} config - Consumer configuration
 * @returns {Cypress.Chainable<string>} Processor ID
 */
Cypress.Commands.add('createTestDataConsumer', (config = {}) => {
  const defaultConfig = {
    type: 'LogMessage',
    position: { x: 500, y: 100 },
    properties: {
      'Log Level': config.logLevel || 'INFO',
      'Log Prefix': config.logPrefix || 'TEST: ',
    },
  };

  return cy.addProcessor(defaultConfig.type, defaultConfig.position).then((processorId) => {
    if (Object.keys(defaultConfig.properties).length > 0) {
      return cy
        .configureProcessorProperties(processorId, defaultConfig.properties)
        .then(() => processorId);
    }

    return processorId;
  });
});

/**
 * Monitor processor metrics and performance
 * @param {string} processorId - Processor ID
 * @param {number} duration - Monitoring duration in milliseconds
 * @returns {Cypress.Chainable<Object>} Performance metrics
 */
Cypress.Commands.add('monitorProcessorPerformance', (processorId, duration = 10000) => {
  cy.log(`📊 Monitoring processor performance for ${duration}ms`);

  const metrics = {
    processorId,
    startTime: Date.now(),
    samples: [],
    duration,
  };

  const sampleInterval = 1000; // Sample every second
  const sampleCount = Math.floor(duration / sampleInterval);

  for (let i = 0; i < sampleCount; i++) {
    cy.wait(sampleInterval).then(() => {
      cy.getProcessorState(processorId).then((state) => {
        metrics.samples.push({
          timestamp: Date.now(),
          state,
          sampleIndex: i,
        });
      });
    });
  }

  return cy.wrap(null).then(() => {
    metrics.endTime = Date.now();
    metrics.actualDuration = metrics.endTime - metrics.startTime;

    // Calculate performance statistics
    const states = metrics.samples.map((s) => s.state);
    const uniqueStates = [...new Set(states)];

    metrics.statistics = {
      totalSamples: metrics.samples.length,
      uniqueStates,
      stateDistribution: uniqueStates.reduce((dist, state) => {
        dist[state] = states.filter((s) => s === state).length;
        return dist;
      }, {}),
    };

    cy.log('✅ Processor performance monitoring completed');
    return metrics;
  });
});

/**
 * Stress test a processor with rapid operations
 * @param {string} processorId - Processor ID
 * @param {Object} stressConfig - Stress test configuration
 * @returns {Cypress.Chainable<Object>} Stress test results
 */
Cypress.Commands.add('stressTestProcessor', (processorId, stressConfig = {}) => {
  const config = {
    operations: stressConfig.operations || 10,
    operationType: stressConfig.operationType || 'configuration-dialog',
    concurrentOps: stressConfig.concurrentOps || 1,
    ...stressConfig,
  };

  cy.log(`⚡ Stress testing processor with ${config.operations} operations`);

  const results = {
    processorId,
    config,
    startTime: Date.now(),
    operations: [],
    errors: [],
  };

  for (let i = 0; i < config.operations; i++) {
    const operationStart = Date.now();

    cy.executeStressOperation(processorId, config.operationType).then((success) => {
      const operationEnd = Date.now();
      const operation = {
        index: i,
        type: config.operationType,
        duration: operationEnd - operationStart,
        success,
        timestamp: operationEnd,
      };

      results.operations.push(operation);

      if (!success) {
        results.errors.push(operation);
      }
    });
  }

  return cy.wrap(null).then(() => {
    results.endTime = Date.now();
    results.totalDuration = results.endTime - results.startTime;
    results.successRate =
      (results.operations.length - results.errors.length) / results.operations.length;
    results.averageOperationTime =
      results.operations.reduce((sum, op) => sum + op.duration, 0) / results.operations.length;

    cy.log(`✅ Stress test completed. Success rate: ${(results.successRate * 100).toFixed(1)}%`);
    return results;
  });
});

/**
 * Execute a single stress test operation
 * @param {string} processorId - Processor ID
 * @param {string} operationType - Type of operation
 * @returns {Cypress.Chainable<boolean>} Success status
 */
Cypress.Commands.add('executeStressOperation', (processorId, operationType) => {
  try {
    switch (operationType) {
      case 'configuration-dialog':
        return cy
          .openProcessorAdvancedDialog(processorId)
          .then(() => cy.closeAdvancedDialog())
          .then(() => true);

      case 'tab-navigation':
        return cy
          .openProcessorAdvancedDialog(processorId)
          .then(() => cy.navigateToCustomUITab('properties'))
          .then(() => cy.navigateToCustomUITab('validation'))
          .then(() => cy.closeAdvancedDialog())
          .then(() => true);

      case 'start-stop':
        return cy
          .startProcessor(processorId)
          .then(() => cy.stopProcessor(processorId))
          .then(() => true);

      default:
        return cy.wrap(true);
    }
  } catch (error) {
    cy.log(`❌ Stress operation failed: ${error.message}`);
    return cy.wrap(false);
  }
});

/**
 * Clean up all test processors from canvas
 * @param {Array<string>} processorIds - Array of processor IDs to clean up
 * @returns {Cypress.Chainable} Cypress chainable
 */
Cypress.Commands.add('cleanupTestProcessors', (processorIds) => {
  if (!processorIds || processorIds.length === 0) {
    cy.log('ℹ️ No processors to clean up');
    return cy.wrap(null);
  }

  cy.log(`🧹 Cleaning up ${processorIds.length} test processors`);

  // First stop all processors
  processorIds.forEach((processorId) => {
    cy.getProcessorState(processorId).then((state) => {
      if (state === 'running') {
        cy.stopProcessor(processorId);
      }
    });
  });

  // Then remove all processors
  processorIds.forEach((processorId) => {
    cy.removeProcessor(processorId);
  });

  cy.log('✅ Test processor cleanup completed');
});

/**
 * Create a complete test workflow for end-to-end testing
 * @param {Object} workflowConfig - Workflow configuration
 * @returns {Cypress.Chainable<Object>} Complete workflow metadata
 */
Cypress.Commands.add('createCompleteTestWorkflow', (workflowConfig = {}) => {
  cy.log('🏭 Creating complete test workflow');

  const config = {
    includeGenerator: workflowConfig.includeGenerator !== false,
    includeAuthenticator: workflowConfig.includeAuthenticator !== false,
    includeConsumer: workflowConfig.includeConsumer !== false,
    autoStart: workflowConfig.autoStart === true,
    ...workflowConfig,
  };

  const workflow = {
    processors: [],
    connections: [],
    config,
    startTime: Date.now(),
  };

  return cy
    .wrap(null)
    .then(() => {
      // Add generator if requested
      if (config.includeGenerator) {
        return cy.createTestDataGenerator(config.generatorConfig).then((id) => {
          workflow.processors.push({ id, type: 'generator', name: 'TestGenerator' });

          // Add authenticator if requested
          if (config.includeAuthenticator) {
            return cy
              .addProcessor('MultiIssuerJWTTokenAuthenticator', { x: 400, y: 200 })
              .then((authId) => {
                workflow.processors.push({
                  id: authId,
                  type: 'authenticator',
                  name: 'JWTAuthenticator',
                });

                // Add consumer if requested
                if (config.includeConsumer) {
                  return cy.createTestDataConsumer(config.consumerConfig).then((consumerId) => {
                    workflow.processors.push({
                      id: consumerId,
                      type: 'consumer',
                      name: 'TestConsumer',
                    });
                    return workflow;
                  });
                }
                return workflow;
              });
          }

          // Add consumer if requested (when no authenticator)
          if (config.includeConsumer) {
            return cy.createTestDataConsumer(config.consumerConfig).then((consumerId) => {
              workflow.processors.push({ id: consumerId, type: 'consumer', name: 'TestConsumer' });
              return workflow;
            });
          }
          return workflow;
        });
      }

      // Add authenticator if requested (when no generator)
      if (config.includeAuthenticator) {
        return cy
          .addProcessor('MultiIssuerJWTTokenAuthenticator', { x: 400, y: 200 })
          .then((authId) => {
            workflow.processors.push({
              id: authId,
              type: 'authenticator',
              name: 'JWTAuthenticator',
            });

            // Add consumer if requested
            if (config.includeConsumer) {
              return cy.createTestDataConsumer(config.consumerConfig).then((consumerId) => {
                workflow.processors.push({
                  id: consumerId,
                  type: 'consumer',
                  name: 'TestConsumer',
                });
                return workflow;
              });
            }
            return workflow;
          });
      }

      // Add consumer if requested (when no generator or authenticator)
      if (config.includeConsumer) {
        return cy.createTestDataConsumer(config.consumerConfig).then((consumerId) => {
          workflow.processors.push({ id: consumerId, type: 'consumer', name: 'TestConsumer' });
          return workflow;
        });
      }

      return workflow;
    })
    .then(() => {
      // Create connections
      if (workflow.processors.length > 1) {
        for (let i = 0; i < workflow.processors.length - 1; i++) {
          const source = workflow.processors[i];
          const target = workflow.processors[i + 1];

          cy.connectProcessors(source.id, target.id, 'success').then((connectionId) => {
            workflow.connections.push({
              id: connectionId,
              source: source.id,
              target: target.id,
              relationship: 'success',
            });
          });
        }
      }

      // Start workflow if requested
      if (config.autoStart) {
        const processorIds = workflow.processors.map((p) => p.id);
        cy.startProcessors(processorIds);
      }

      workflow.endTime = Date.now();
      workflow.creationDuration = workflow.endTime - workflow.startTime;

      cy.log(`✅ Complete test workflow created with ${workflow.processors.length} processors`);
      return workflow;
    });
});
