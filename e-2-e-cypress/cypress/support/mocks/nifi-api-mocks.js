/**
 * @file NiFi API Mocks - REST API mocking for fast, reliable tests
 * Provides comprehensive mocking of NiFi REST API endpoints using cy.intercept()
 * @version 1.0.0
 */

import { JWT_PROCESSORS } from '../constants';

/**
 * Mock NiFi API responses and data
 */
export const MOCK_API_RESPONSES = {
  // Mock processor types response
  PROCESSOR_TYPES: {
    processorTypes: [
      {
        type: JWT_PROCESSORS.JWT_AUTHENTICATOR.className,
        bundle: {
          group: 'de.cuioss.nifi',
          artifact: 'nifi-cuioss-processors',
          version: '1.0.0'
        },
        description: JWT_PROCESSORS.JWT_AUTHENTICATOR.description,
        tags: ['jwt', 'authentication', 'security']
      },
      {
        type: JWT_PROCESSORS.MULTI_ISSUER.className,
        bundle: {
          group: 'de.cuioss.nifi',
          artifact: 'nifi-cuioss-processors',
          version: '1.0.0'
        },
        description: JWT_PROCESSORS.MULTI_ISSUER.description,
        tags: ['jwt', 'authentication', 'multi-issuer', 'security']
      }
    ]
  },

  // Mock flow response
  FLOW: {
    processGroupFlow: {
      id: 'root',
      uri: 'https://localhost:9095/nifi-api/flow/process-groups/root',
      breadcrumb: {
        breadcrumb: {
          id: 'root',
          name: 'NiFi Flow'
        }
      },
      flow: {
        processGroups: [],
        processors: [],
        connections: [],
        remoteProcessGroups: [],
        labels: []
      }
    }
  },

  // Mock processor creation response
  CREATE_PROCESSOR: (processorType, position = { x: 400, y: 300 }) => ({
    revision: {
      version: 1,
      clientId: 'cypress-test'
    },
    id: `processor-${Date.now()}`,
    uri: `https://localhost:9095/nifi-api/processors/processor-${Date.now()}`,
    position: position,
    permissions: {
      canRead: true,
      canWrite: true
    },
    bulletins: [],
    component: {
      id: `processor-${Date.now()}`,
      name: processorType === JWT_PROCESSORS.JWT_AUTHENTICATOR.className
        ? JWT_PROCESSORS.JWT_AUTHENTICATOR.displayName
        : JWT_PROCESSORS.MULTI_ISSUER.displayName,
      type: processorType,
      bundle: {
        group: 'de.cuioss.nifi',
        artifact: 'nifi-cuioss-processors',
        version: '1.0.0'
      },
      state: 'STOPPED',
      style: {},
      relationships: [
        {
          name: 'success',
          description: 'Successfully authenticated tokens'
        },
        {
          name: 'failure',
          description: 'Failed authentication tokens'
        }
      ],
      config: {
        properties: {},
        descriptors: {},
        schedulingPeriod: '0 sec',
        schedulingStrategy: 'TIMER_DRIVEN',
        executionNode: 'ALL',
        penaltyDuration: '30 sec',
        yieldDuration: '1 sec',
        bulletinLevel: 'WARN',
        runDurationMillis: 0,
        concurrentlySchedulableTaskCount: 1
      }
    }
  }),

  // Mock authentication response
  AUTH_TOKEN: {
    token: 'mock-jwt-token-for-testing'
  },

  // Mock access status
  ACCESS_STATUS: {
    identity: 'admin',
    status: 'ACTIVE'
  }
};

/**
 * Set up comprehensive NiFi API mocking
 * @param {Object} options - Mocking options
 * @param {boolean} [options.enableAuth=true] - Enable authentication mocking
 * @param {boolean} [options.enableProcessors=true] - Enable processor operation mocking
 * @param {boolean} [options.enableFlow=true] - Enable flow operation mocking
 */
export function setupNiFiAPIMocks(options = {}) {
  const {
    enableAuth = true,
    enableProcessors = true,
    enableFlow = true
  } = options;

  cy.log('🎭 Setting up NiFi API mocks');

  if (enableAuth) {
    setupAuthenticationMocks();
  }

  if (enableFlow) {
    setupFlowMocks();
  }

  if (enableProcessors) {
    setupProcessorMocks();
  }

  cy.log('✅ NiFi API mocks configured successfully');
}

/**
 * Set up authentication-related API mocks
 */
function setupAuthenticationMocks() {
  // Mock login endpoint
  cy.intercept('POST', '**/nifi-api/access/token', {
    statusCode: 200,
    body: MOCK_API_RESPONSES.AUTH_TOKEN
  }).as('mockLogin');

  // Mock access status
  cy.intercept('GET', '**/nifi-api/access', {
    statusCode: 200,
    body: MOCK_API_RESPONSES.ACCESS_STATUS
  }).as('mockAccessStatus');

  // Mock logout
  cy.intercept('DELETE', '**/nifi-api/access/logout', {
    statusCode: 200
  }).as('mockLogout');

  cy.log('🔐 Authentication mocks configured');
}

/**
 * Set up flow-related API mocks
 */
function setupFlowMocks() {
  // Mock flow retrieval
  cy.intercept('GET', '**/nifi-api/flow/process-groups/root', {
    statusCode: 200,
    body: MOCK_API_RESPONSES.FLOW
  }).as('mockGetFlow');

  // Mock processor types
  cy.intercept('GET', '**/nifi-api/flow/processor-types', {
    statusCode: 200,
    body: MOCK_API_RESPONSES.PROCESSOR_TYPES
  }).as('mockGetProcessorTypes');

  cy.log('🌊 Flow mocks configured');
}

/**
 * Set up processor-related API mocks
 */
function setupProcessorMocks() {
  // Mock processor creation
  cy.intercept('POST', '**/nifi-api/process-groups/root/processors', (req) => {
    const processorType = req.body.component.type;
    const position = req.body.component.position || { x: 400, y: 300 };

    req.reply({
      statusCode: 201,
      body: MOCK_API_RESPONSES.CREATE_PROCESSOR(processorType, position)
    });
  }).as('mockCreateProcessor');

  // Mock processor deletion
  cy.intercept('DELETE', '**/nifi-api/processors/**', {
    statusCode: 200,
    body: {
      revision: {
        version: 2
      }
    }
  }).as('mockDeleteProcessor');

  // Mock processor update
  cy.intercept('PUT', '**/nifi-api/processors/**', (req) => {
    req.reply({
      statusCode: 200,
      body: {
        ...req.body,
        revision: {
          version: req.body.revision.version + 1
        }
      }
    });
  }).as('mockUpdateProcessor');

  // Mock processor status
  cy.intercept('GET', '**/nifi-api/processors/**', (req) => {
    const processorId = req.url.split('/').pop();
    req.reply({
      statusCode: 200,
      body: {
        revision: { version: 1 },
        id: processorId,
        component: {
          id: processorId,
          name: 'Mock Processor',
          state: 'STOPPED'
        }
      }
    });
  }).as('mockGetProcessor');

  cy.log('⚙️ Processor mocks configured');
}

/**
 * Create a mock processor on the canvas (for UI testing)
 * @param {string} processorType - Type of processor to mock
 * @param {Object} options - Mock options
 * @returns {Object} Mock processor data
 */
export function createMockProcessor(processorType, options = {}) {
  const {
    position = { x: 400, y: 300 },
    name = null
  } = options;

  const processorDef = processorType === 'JWT_AUTHENTICATOR'
    ? JWT_PROCESSORS.JWT_AUTHENTICATOR
    : JWT_PROCESSORS.MULTI_ISSUER;

  const mockProcessor = {
    id: `mock-processor-${Date.now()}`,
    type: processorType,
    name: name || processorDef.displayName,
    element: null, // Will be set by UI interactions
    position: position,
    isVisible: true,
    status: 'STOPPED',
    className: processorDef.className
  };

  cy.log(`🎭 Created mock processor: ${mockProcessor.name}`);
  return mockProcessor;
}

/**
 * Reset all API mocks
 */
export function resetNiFiAPIMocks() {
  cy.log('🧹 Resetting NiFi API mocks');

  // Clear all intercepts
  cy.intercept('GET', '**/nifi-api/**').as('resetGet');
  cy.intercept('POST', '**/nifi-api/**').as('resetPost');
  cy.intercept('PUT', '**/nifi-api/**').as('resetPut');
  cy.intercept('DELETE', '**/nifi-api/**').as('resetDelete');
}

/**
 * Verify mock API calls were made
 * @param {Array<string>} expectedCalls - Array of expected API call aliases
 */
export function verifyMockAPICalls(expectedCalls) {
  cy.log('🔍 Verifying mock API calls: ' + expectedCalls.join(', '));

  expectedCalls.forEach(callAlias => {
    const aliasName = '@' + callAlias;
    cy.wait(aliasName);
  });

  cy.log('✅ All expected mock API calls verified');
}
