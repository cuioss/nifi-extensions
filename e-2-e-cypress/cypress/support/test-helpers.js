/**
 * @file Test Helpers - Common test utilities and patterns
 * Provides reusable test functions to reduce duplication across test files
 * @version 1.0.0
 */

/**
 * Common test setup with standardized logging
 * @param {string} testName - Name of the test for logging
 */
export const testSetup = (testName) => {
  cy.log(`🧪 ${testName}`);
};

/**
 * Verify authentication state with consolidated logic
 * @param {boolean} expectedAuth - Expected authentication state
 * @param {string} expectedPageType - Expected page type
 */
export const verifyAuthenticationState = (expectedAuth, expectedPageType) => {
  cy.getPageContext().should((context) => {
    expect(context.pageType).to.equal(expectedPageType);
    expect(context.isAuthenticated).to.equal(expectedAuth);
    if (expectedAuth && expectedPageType === 'MAIN_CANVAS') {
      expect(context.isReady).to.be.true;
    }
  });
};

/**
 * Verify processor definition with expected properties
 * @param {string} processorType - Processor type key
 * @param {string} expectedClassName - Expected class name
 * @returns {Cypress.Chainable} Promise resolving to processor definition
 */
export const verifyProcessorDefinition = (processorType, expectedClassName) => {
  return cy.getJWTProcessorTypes().then((types) => {
    expect(types).to.have.property(processorType);
    const processor = types[processorType];
    expect(processor).to.have.property('className', expectedClassName);
    expect(processor).to.have.property('displayName');
    return processor;
  });
};

/**
 * Verify processor structure and log results
 * @param {Object|null} processor - Processor object or null
 * @param {string} processorType - Processor type for logging
 */
export const verifyProcessorStructure = (processor, processorType) => {
  if (processor) {
    ['id', 'type', 'position'].forEach((prop) => {
      expect(processor).to.have.property(prop);
    });
    cy.log(`Found ${processorType}: ${processor.name}`);
  } else {
    cy.log(`${processorType} not found (expected on clean canvas)`);
  }
};

/**
 * Test processor search functionality with consolidated logic
 * @param {string} processorType - Processor type to search for
 * @returns {Cypress.Chainable} Promise resolving to processor or null
 */
export const testProcessorSearch = (processorType) => {
  return cy.findProcessorOnCanvas(processorType).then((processor) => {
    expect(processor).to.satisfy((p) => p === null || (p && typeof p.name === 'string'));
    verifyProcessorStructure(processor, processorType);
    return processor;
  });
};

/**
 * Verify multiple Cypress commands exist
 * @param {string[]} commands - Array of command names to verify
 */
export const verifyCommandsExist = (commands) => {
  commands.forEach((command) => {
    expect(cy[command]).to.be.a('function');
  });
};

/**
 * Verify canvas readiness with consolidated checks
 */
export const verifyCanvasReady = () => {
  cy.getPageContext().should((context) => {
    expect(context.pageType).to.equal('MAIN_CANVAS');
    expect(context.isReady).to.be.true;
    expect(context.isAuthenticated).to.be.true;
    expect(context.elements.hasCanvasElements).to.be.true;
  });
};

/**
 * Common test patterns for processor testing
 */
export const ProcessorTestPatterns = {
  JWT_PROCESSOR_TYPES: ['JWT_AUTHENTICATOR', 'MULTI_ISSUER'],

  JWT_PROCESSOR_CLASSES: {
    JWT_AUTHENTICATOR: 'de.cuioss.nifi.processors.auth.JWTTokenAuthenticator',
    MULTI_ISSUER: 'de.cuioss.nifi.processors.auth.MultiIssuerJWTTokenAuthenticator',
  },

  REQUIRED_COMMANDS: [
    'getJWTProcessorTypes',
    'findProcessorOnCanvas',
    'getAllJWTProcessorsOnCanvas',
  ],

  REQUIRED_PROCESSOR_PROPERTIES: ['id', 'type', 'name', 'position'],
};
