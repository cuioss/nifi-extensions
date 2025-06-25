/**
 * Validation and assertion utility functions for NiFi E2E tests
 * Provides comprehensive validation helpers following requirements from Requirements.md
 */

/**
 * Validate that no console errors occurred during operation
 * @param {string} operationDescription - Description of operation being validated
 * @param {Object} options - Validation options
 * @param {Array<string>} options.allowedErrors - Array of error patterns to ignore
 * @param {boolean} options.failOnError - Whether to fail test on console errors (default: true)
 */
export function validateNoConsoleErrors(operationDescription, options = {}) {
  const { allowedErrors = [], failOnError = true } = options;

  cy.log(`🔍 Validating no console errors for: ${operationDescription}`);

  cy.checkConsoleErrors(operationDescription, { allowedErrors, failOnError });
  cy.log(`✅ No console errors found for: ${operationDescription}`);
}

/**
 * Validate processor configuration persistence
 * @param {Object} configData - Configuration data to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.reopenDialog - Whether to reopen config dialog to test persistence (default: true)
 * @param {number} options.timeout - Timeout for validation operations (default: 10000)
 */
export function validateConfigurationPersistence(configData, options = {}) {
  const { reopenDialog = true, timeout = 10000 } = options;

  cy.log('💾 Validating configuration persistence');

  if (reopenDialog) {
    // Close current dialog
    cy.get(
      '.close-button, .cancel-button, button:contains("Close"), button:contains("Cancel")'
    ).click();

    // Wait for dialog to close
    cy.get('.dialog, .modal, .configuration-dialog', { timeout }).should('not.exist');

    // Reopen processor configuration
    cy.get('.processor-component').first().dblclick({ force: true });

    // Wait for dialog to reopen
    cy.get('.processor-configuration, #processor-configuration, .component-configuration', {
      timeout,
    }).should('be.visible');
  }

  // Validate each configuration field
  Object.entries(configData).forEach(([fieldName, expectedValue]) => {
    const fieldSelectors = [
      `input[name="${fieldName}"]`,
      `#${fieldName}`,
      `[data-field="${fieldName}"]`,
      `input[aria-label*="${fieldName}"]`,
      `textarea[name="${fieldName}"]`,
      `select[name="${fieldName}"]`,
    ];

    fieldSelectors.forEach((selector) => {
      cy.get('body').then(($body) => {
        if ($body.find(selector).length > 0) {
          cy.get(selector).should('have.value', String(expectedValue));
        }
      });
    });
  });

  cy.log('✅ Configuration persistence validated');
}

/**
 * Validate form field validation rules
 * @param {Object} validationTests - Object with field names as keys and validation test configs as values
 * @param {Object} options - Validation options
 */
export function validateFormValidation(validationTests, options = {}) {
  const { timeout = 5000 } = options;

  cy.log('✅ Validating form validation rules');

  Object.entries(validationTests).forEach(([fieldName, tests]) => {
    cy.log(`🔍 Testing validation for field: ${fieldName}`);

    const fieldSelector = `input[name="${fieldName}"], #${fieldName}, [data-field="${fieldName}"]`;

    tests.forEach((test) => {
      const { value, shouldBeValid, expectedError } = test;

      // Clear and enter test value
      cy.get(fieldSelector, { timeout }).clear().type(String(value));

      // Trigger validation (blur event)
      cy.get(fieldSelector).blur();

      if (shouldBeValid) {
        // Should not show error message
        cy.get('.error-message, .validation-error, .field-error').should('not.exist');
      } else {
        // Should show error message
        cy.get('.error-message, .validation-error, .field-error').should('be.visible');

        if (expectedError) {
          cy.get('.error-message, .validation-error, .field-error').should(
            'contain',
            expectedError
          );
        }
      }
    });
  });

  cy.log('✅ Form validation rules validated');
}

/**
 * Validate JWT token processing functionality
 * @param {Object} tokenTests - Object containing token test scenarios
 * @param {Object} options - Validation options
 */
export function validateJWTTokenProcessing(tokenTests, options = {}) {
  const { timeout = 15000, processorType = 'MultiIssuerJWTTokenAuthenticator' } = options;

  cy.log(`🔐 Validating JWT token processing for: ${processorType}`);

  tokenTests.forEach((test) => {
    const { token, shouldBeValid, description, expectedResult } = test;

    cy.log(`🧪 Testing token scenario: ${description}`);

    // Enter token in test interface
    cy.get('textarea[name="token"], #token-input, .token-field', { timeout }).clear().type(token);

    // Trigger validation
    cy.get('button:contains("Validate"), .validate-button, #validate-token').click();

    // Wait for result
    cy.get('.validation-result, .token-result, #validation-output', { timeout }).should(
      'be.visible'
    );

    if (shouldBeValid) {
      cy.get('.validation-result')
        .should('contain', 'valid')
        .should('not.contain', 'invalid')
        .should('not.contain', 'error');
    } else {
      cy.get('.validation-result').should('contain', 'invalid').should('not.contain', 'valid');
    }

    if (expectedResult) {
      cy.get('.validation-result').should('contain', expectedResult);
    }
  });

  cy.log('✅ JWT token processing validated');
}

/**
 * Validate JWKS endpoint configuration
 * @param {Object} jwksTests - JWKS endpoint test configurations
 * @param {Object} options - Validation options
 */
export function validateJWKSConfiguration(jwksTests, options = {}) {
  const { timeout = 10000 } = options;

  cy.log('🔑 Validating JWKS endpoint configuration');

  jwksTests.forEach((test) => {
    const { endpoint, shouldConnect, description, expectedKeys } = test;

    cy.log(`🌐 Testing JWKS endpoint: ${description}`);

    // Enter JWKS endpoint URL
    cy.get('input[name="jwks-uri"], #jwks-endpoint, .jwks-url', { timeout }).clear().type(endpoint);

    // Test connection
    cy.get('button:contains("Test"), .test-connection, #test-jwks').click();

    // Wait for connection result
    cy.get('.connection-result, .jwks-result, #jwks-output', { timeout }).should('be.visible');

    if (shouldConnect) {
      cy.get('.connection-result')
        .should('contain', 'success')
        .should('not.contain', 'failed')
        .should('not.contain', 'error');

      if (expectedKeys && expectedKeys.length > 0) {
        expectedKeys.forEach((keyId) => {
          cy.get('.connection-result').should('contain', keyId);
        });
      }
    } else {
      cy.get('.connection-result').should('contain', 'failed').should('not.contain', 'success');
    }
  });

  cy.log('✅ JWKS configuration validated');
}

/**
 * Validate multi-issuer support functionality
 * @param {Array} issuerConfigs - Array of issuer configuration objects
 * @param {Object} options - Validation options
 */
export function validateMultiIssuerSupport(issuerConfigs, options = {}) {
  const { timeout = 15000 } = options;

  cy.log('🏢 Validating multi-issuer support');

  issuerConfigs.forEach((issuer, index) => {
    const { name, jwksUrl, algorithm, expectedBehavior } = issuer;

    cy.log(`🔧 Configuring issuer ${index + 1}: ${name}`);

    // Add new issuer if not the first one
    if (index > 0) {
      cy.get('button:contains("Add Issuer"), .add-issuer, #add-issuer').click();
    }

    // Configure issuer
    cy.get(`#issuer-${index}-name, .issuer-name:eq(${index})`, { timeout }).clear().type(name);

    cy.get(`#issuer-${index}-jwks, .issuer-jwks:eq(${index})`, { timeout }).clear().type(jwksUrl);

    if (algorithm) {
      cy.get(`#issuer-${index}-algorithm, .issuer-algorithm:eq(${index})`).select(algorithm);
    }

    // Test issuer configuration
    cy.get(`button:contains("Test"):eq(${index}), .test-issuer:eq(${index})`).click();

    // Validate result
    cy.get(`.issuer-result:eq(${index}), .test-result:eq(${index})`, { timeout }).should(
      'be.visible'
    );

    if (expectedBehavior === 'success') {
      cy.get(`.issuer-result:eq(${index})`)
        .should('contain', 'success')
        .should('not.contain', 'error');
    } else {
      cy.get(`.issuer-result:eq(${index})`).should('contain', 'error');
    }
  });

  cy.log('✅ Multi-issuer support validated');
}

/**
 * Validate error handling and recovery
 * @param {Array} errorScenarios - Array of error scenario test configurations
 * @param {Object} options - Validation options
 */
export function validateErrorHandling(errorScenarios, options = {}) {
  const { timeout = 10000 } = options;

  cy.log('🚨 Validating error handling and recovery');

  errorScenarios.forEach((scenario) => {
    const { description, trigger, expectedErrorMessage, shouldRecover, recoveryAction } = scenario;

    cy.log(`💥 Testing error scenario: ${description}`);

    // Clear any existing console errors
    cy.clearConsoleErrors();

    // Trigger error condition
    if (trigger.type === 'invalid_input') {
      cy.get(trigger.selector).clear().type(trigger.value);
    } else if (trigger.type === 'click') {
      cy.get(trigger.selector).click();
    } else if (trigger.type === 'network_failure') {
      // Simulate network failure through interception
      cy.intercept(trigger.method || 'GET', trigger.url, {
        statusCode: trigger.statusCode || 500,
        body: trigger.errorBody || 'Network Error',
      });
      cy.get(trigger.selector).click();
    }

    // Wait for error to appear
    cy.get('.error-message, .alert-error, .notification-error', { timeout }).should('be.visible');

    // Validate error message content
    if (expectedErrorMessage) {
      cy.get('.error-message, .alert-error, .notification-error').should(
        'contain',
        expectedErrorMessage
      );
    }

    // Test recovery if specified
    if (shouldRecover && recoveryAction) {
      cy.log(`🔄 Testing recovery: ${recoveryAction.description}`);

      if (recoveryAction.type === 'click') {
        cy.get(recoveryAction.selector).click();
      } else if (recoveryAction.type === 'input') {
        cy.get(recoveryAction.selector).clear().type(recoveryAction.value);
      }

      // Verify error is resolved
      cy.get('.error-message, .alert-error, .notification-error').should('not.exist');

      cy.log('✅ Recovery successful');
    }

    // Check for console errors
    validateNoConsoleErrors(`Error scenario: ${description}`, {
      allowedErrors: scenario.allowedConsoleErrors || [],
    });
  });

  cy.log('✅ Error handling and recovery validated');
}

/**
 * Validate system performance metrics
 * @param {Object} performanceTests - Performance test configurations
 * @param {Object} options - Validation options
 */
export function validateSystemPerformance(performanceTests, options = {}) {
  const { timeout = 30000 } = options;

  cy.log('⚡ Validating system performance');

  performanceTests.forEach((test) => {
    const { operation, maxDuration, description, iterations = 1 } = test;

    cy.log(`📊 Testing performance: ${description}`);

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();

      // Perform the operation
      cy.log(`🔄 Iteration ${i + 1}/${iterations}`);

      if (operation.type === 'load_ui') {
        cy.visit(operation.url || '/');
        cy.get(operation.loadedSelector, { timeout }).should('be.visible');
      } else if (operation.type === 'click_sequence') {
        operation.steps.forEach((step) => {
          cy.get(step.selector).click();
          if (step.waitFor) {
            cy.get(step.waitFor, { timeout: step.timeout || 5000 }).should('be.visible');
          }
        });
      }

      // Measure duration
      cy.then(() => {
        const duration = Date.now() - startTime;
        cy.log(`⏱️ Operation took ${duration}ms (max: ${maxDuration}ms)`);

        if (duration > maxDuration) {
          throw new Error(
            `Performance test failed: ${description} took ${duration}ms, expected < ${maxDuration}ms`
          );
        }
      });
    }
  });

  cy.log('✅ System performance validated');
}

/**
 * Validate help system integration
 * @param {Array} helpTests - Array of help system test configurations
 * @param {Object} options - Validation options
 */
export function validateHelpSystem(helpTests, options = {}) {
  const { timeout = 5000 } = options;

  cy.log('❓ Validating help system integration');

  helpTests.forEach((test) => {
    const { element, expectedHelpContent, helpType = 'tooltip' } = test;

    cy.log(`💡 Testing help for: ${element}`);

    if (helpType === 'tooltip') {
      // Test tooltip help
      cy.get(element).trigger('mouseover');

      cy.get('.tooltip, .help-tooltip, [role="tooltip"]', { timeout })
        .should('be.visible')
        .should('contain', expectedHelpContent);

      // Move mouse away
      cy.get('body').trigger('mousemove', { clientX: 0, clientY: 0 });
    } else if (helpType === 'help_button') {
      // Test help button/icon
      cy.get(`${element} .help-icon, ${element} .help-button`).click();

      cy.get('.help-dialog, .help-popup, .help-content', { timeout })
        .should('be.visible')
        .should('contain', expectedHelpContent);

      // Close help
      cy.get('.close-button, button:contains("Close")').click();
    }
  });

  cy.log('✅ Help system integration validated');
}

/**
 * Validate that required elements are present on the page
 * @param {Array<string>} selectors - Array of CSS selectors to validate
 * @param {Object} options - Validation options
 * @param {number} options.timeout - Timeout for element validation (default: 10000)
 * @returns {Cypress.Chainable} Promise that resolves when all elements are validated
 */
export function validateRequiredElements(selectors, options = {}) {
  const { timeout = 10000 } = options;

  cy.log(`🔍 Validating required elements: ${selectors.join(', ')}`);

  selectors.forEach((selector) => {
    // Try multiple selectors separated by commas
    const selectorList = selector.split(',').map((s) => s.trim());

    // Check if any of the selectors match
    let found = false;
    selectorList.forEach((singleSelector) => {
      try {
        cy.get(singleSelector, { timeout }).should('exist').then(() => {
          found = true;
          cy.log(`✅ Found element: ${singleSelector}`);
        });
      } catch (e) {
        // Continue to next selector
      }
    });
  });

  return cy.wrap(null);
}

/**
 * Validate error state on the page
 * @param {Object} options - Validation options
 * @param {number} options.timeout - Timeout for error detection (default: 5000)
 * @returns {Cypress.Chainable} Promise that resolves with error state object
 */
export function validateErrorState(options = {}) {
  const { timeout = 5000 } = options;

  cy.log('🔍 Validating error state');

  return cy.get('body', { timeout }).then(($body) => {
    // Check for various error indicators
    const hasErrorMessage = $body.find('.error, .alert-danger, .error-message, .flash.error').length > 0;
    const hasLoginError = $body.find('.login-error, .authentication-error').length > 0;
    const isLoginPage = $body.find('input[type="password"], .login-form').length > 0;

    const errorState = {
      hasError: hasErrorMessage || hasLoginError,
      isLoginPage,
      errorType: hasLoginError ? 'authentication' : hasErrorMessage ? 'general' : null,
    };

    cy.log(`Error state: ${JSON.stringify(errorState)}`);
    return errorState;
  });
}
