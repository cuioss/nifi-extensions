/**
 * Test data management utility for NiFi E2E tests
 * Provides test data and configuration management following requirements from Requirements.md
 */

/**
 * Processor configuration test data
 */
export const PROCESSOR_TEST_DATA = {
  MULTI_ISSUER: {
    type: 'MultiIssuerJWTTokenAuthenticator',
    displayName: 'Multi-Issuer JWT Token Authenticator',
    testConfigurations: [
      {
        name: 'Basic Multi-Issuer Config',
        issuers: [
          {
            name: 'issuer1',
            jwksUrl: 'https://example.com/.well-known/jwks.json',
            algorithm: 'RS256'
          },
          {
            name: 'issuer2', 
            jwksUrl: 'https://auth.example.com/.well-known/jwks.json',
            algorithm: 'ES256'
          }
        ]
      }
    ]
  },
  SINGLE_ISSUER: {
    type: 'JWTTokenAuthenticator',
    displayName: 'JWT Token Authenticator',
    testConfigurations: [
      {
        name: 'Basic Single-Issuer Config',
        jwksUrl: 'https://example.com/.well-known/jwks.json',
        algorithm: 'RS256',
        issuer: 'https://example.com'
      }
    ]
  }
};

/**
 * JWT token test data for validation testing
 */
export const JWT_TEST_TOKENS = {
  VALID_TOKENS: [
    {
      description: 'Valid RS256 token',
      token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.EkN-DOsnsuRjRO6BxXemmJDm3HbxrbRzXglbN2S4sOkopdU4IsDxTI8jO19W_A4K8ZPJijNLis4EZsHeY559a4DFOd50_OqgHs3UiO1JQB3VH5v3XY7VcE8qVmj2tR7',
      shouldBeValid: true,
      algorithm: 'RS256'
    },
    {
      description: 'Valid ES256 token',
      token: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.tyh-VfuzIxCyGYDlkBA7DfyjrqmSHu6pQ2hoZuFqUSLPNY2N0mpHb3nk5K17HWP_3cYHBw7AhHale5wky6-sVA',
      shouldBeValid: true,
      algorithm: 'ES256'
    }
  ],
  INVALID_TOKENS: [
    {
      description: 'Malformed token',
      token: 'invalid.token.format',
      shouldBeValid: false,
      expectedError: 'Invalid token format'
    },
    {
      description: 'Expired token',
      token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZXhwIjoxNTE2MjM5MDIyfQ.invalid',
      shouldBeValid: false,
      expectedError: 'Token expired'
    },
    {
      description: 'Invalid signature',
      token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.invalid_signature',
      shouldBeValid: false,
      expectedError: 'Invalid signature'
    }
  ]
};

/**
 * JWKS endpoint test data
 */
export const JWKS_TEST_ENDPOINTS = {
  VALID_ENDPOINTS: [
    {
      description: 'Standard JWKS endpoint',
      endpoint: 'https://example.com/.well-known/jwks.json',
      shouldConnect: true,
      expectedKeys: ['key1', 'key2']
    }
  ],
  INVALID_ENDPOINTS: [
    {
      description: 'Non-existent endpoint',
      endpoint: 'https://nonexistent.example.com/.well-known/jwks.json',
      shouldConnect: false,
      expectedError: 'Connection failed'
    },
    {
      description: 'Invalid URL format',
      endpoint: 'not-a-url',
      shouldConnect: false,
      expectedError: 'Invalid URL'
    },
    {
      description: 'Timeout endpoint',
      endpoint: 'https://httpstat.us/200?sleep=30000',
      shouldConnect: false,
      expectedError: 'Timeout'
    }
  ]
};

/**
 * Form validation test data
 */
export const FORM_VALIDATION_TESTS = {
  jwksUrl: [
    { value: 'https://example.com/.well-known/jwks.json', shouldBeValid: true },
    { value: 'http://example.com/jwks', shouldBeValid: true },
    { value: 'not-a-url', shouldBeValid: false, expectedError: 'Invalid URL format' },
    { value: '', shouldBeValid: false, expectedError: 'JWKS URL is required' }
  ],
  issuerName: [
    { value: 'valid-issuer', shouldBeValid: true },
    { value: 'issuer with spaces', shouldBeValid: true },
    { value: '', shouldBeValid: false, expectedError: 'Issuer name is required' },
    { value: 'a'.repeat(256), shouldBeValid: false, expectedError: 'Issuer name too long' }
  ],
  algorithm: [
    { value: 'RS256', shouldBeValid: true },
    { value: 'ES256', shouldBeValid: true },
    { value: 'HS256', shouldBeValid: true },
    { value: 'INVALID', shouldBeValid: false, expectedError: 'Unsupported algorithm' }
  ]
};

/**
 * Error scenario test data
 */
export const ERROR_SCENARIOS = {
  UI_ERRORS: [
    {
      description: 'Invalid JWKS URL input',
      trigger: {
        type: 'invalid_input',
        selector: 'input[name="jwks-uri"]',
        value: 'invalid-url'
      },
      expectedErrorMessage: 'Invalid URL format',
      shouldRecover: true,
      recoveryAction: {
        type: 'input',
        selector: 'input[name="jwks-uri"]',
        value: 'https://example.com/.well-known/jwks.json',
        description: 'Enter valid JWKS URL'
      }
    },
    {
      description: 'Empty required field',
      trigger: {
        type: 'invalid_input',
        selector: 'input[name="issuer-name"]',
        value: ''
      },
      expectedErrorMessage: 'Issuer name is required',
      shouldRecover: true,
      recoveryAction: {
        type: 'input',
        selector: 'input[name="issuer-name"]',
        value: 'test-issuer',
        description: 'Enter issuer name'
      }
    }
  ],
  NETWORK_ERRORS: [
    {
      description: 'JWKS endpoint connection failure',
      trigger: {
        type: 'network_failure',
        method: 'GET',
        url: '**/jwks.json',
        selector: 'button:contains("Test Connection")',
        statusCode: 500,
        errorBody: 'Internal Server Error'
      },
      expectedErrorMessage: 'Failed to connect to JWKS endpoint',
      shouldRecover: false,
      allowedConsoleErrors: ['Failed to fetch', 'Network Error']
    },
    {
      description: 'JWKS endpoint timeout',
      trigger: {
        type: 'network_failure',
        method: 'GET',
        url: '**/jwks.json',
        selector: 'button:contains("Test Connection")',
        statusCode: 408,
        errorBody: 'Request Timeout'
      },
      expectedErrorMessage: 'Connection timeout',
      shouldRecover: false,
      allowedConsoleErrors: ['Timeout', 'Request failed']
    }
  ]
};

/**
 * Performance test configurations
 */
export const PERFORMANCE_TESTS = {
  UI_LOADING: [
    {
      operation: {
        type: 'load_ui',
        url: '/',
        loadedSelector: '#canvas-container'
      },
      maxDuration: 5000,
      description: 'NiFi UI initial load',
      iterations: 3
    },
    {
      operation: {
        type: 'click_sequence',
        steps: [
          { selector: '#toolbar .fa-plus', waitFor: '.processor-dialog' },
          { selector: 'input[placeholder*="search"]', timeout: 2000 },
          { selector: '.close-button' }
        ]
      },
      maxDuration: 3000,
      description: 'Processor dialog open/close',
      iterations: 2
    }
  ],
  PROCESSOR_OPERATIONS: [
    {
      operation: {
        type: 'click_sequence',
        steps: [
          { selector: '.processor-component', waitFor: '.processor-configuration' },
          { selector: '.tab:contains("Properties")', waitFor: '.properties-panel' },
          { selector: '.close-button' }
        ]
      },
      maxDuration: 4000,
      description: 'Processor configuration access',
      iterations: 2
    }
  ]
};

/**
 * Help system test data
 */
export const HELP_SYSTEM_TESTS = [
  {
    element: 'input[name="jwks-uri"]',
    expectedHelpContent: 'URL to the JWKS endpoint',
    helpType: 'tooltip'
  },
  {
    element: '.issuer-configuration',
    expectedHelpContent: 'Configure JWT issuer settings',
    helpType: 'help_button'
  },
  {
    element: 'select[name="algorithm"]',
    expectedHelpContent: 'JWT signing algorithm',
    helpType: 'tooltip'
  }
];

/**
 * Canvas position utilities
 */
export const CANVAS_POSITIONS = {
  TOP_LEFT: { x: 100, y: 100 },
  TOP_RIGHT: { x: 700, y: 100 },
  CENTER: { x: 400, y: 300 },
  BOTTOM_LEFT: { x: 100, y: 500 },
  BOTTOM_RIGHT: { x: 700, y: 500 }
};

/**
 * Test environment configurations
 */
export const TEST_ENVIRONMENTS = {
  LOCAL: {
    nifiUrl: 'http://localhost:8080/nifi',
    apiUrl: 'http://localhost:8080/nifi-api',
    timeouts: {
      pageLoad: 30000,
      elementWait: 15000,
      apiRequest: 10000
    }
  },
  CI: {
    nifiUrl: 'http://nifi:8080/nifi',
    apiUrl: 'http://nifi:8080/nifi-api',
    timeouts: {
      pageLoad: 60000,
      elementWait: 30000,
      apiRequest: 20000
    }
  }
};

/**
 * Get test data for specific processor type
 * @param {string} processorType - Type of processor ('MULTI_ISSUER' or 'SINGLE_ISSUER')
 * @returns {Object} Processor-specific test data
 */
export function getProcessorTestData(processorType) {
  return PROCESSOR_TEST_DATA[processorType] || null;
}

/**
 * Get JWT tokens for testing
 * @param {string} type - Type of tokens ('VALID_TOKENS' or 'INVALID_TOKENS')
 * @returns {Array} Array of token test data
 */
export function getJWTTokens(type) {
  return JWT_TEST_TOKENS[type] || [];
}

/**
 * Get JWKS endpoints for testing
 * @param {string} type - Type of endpoints ('VALID_ENDPOINTS' or 'INVALID_ENDPOINTS')
 * @returns {Array} Array of JWKS endpoint test data
 */
export function getJWKSEndpoints(type) {
  return JWKS_TEST_ENDPOINTS[type] || [];
}

/**
 * Get form validation tests for specific field
 * @param {string} fieldName - Name of the form field
 * @returns {Array} Array of validation test cases
 */
export function getFormValidationTests(fieldName) {
  return FORM_VALIDATION_TESTS[fieldName] || [];
}

/**
 * Get error scenarios for testing
 * @param {string} category - Category of errors ('UI_ERRORS' or 'NETWORK_ERRORS')
 * @returns {Array} Array of error scenario test cases
 */
export function getErrorScenarios(category) {
  return ERROR_SCENARIOS[category] || [];
}

/**
 * Get performance tests for specific category
 * @param {string} category - Category of performance tests
 * @returns {Array} Array of performance test configurations
 */
export function getPerformanceTests(category) {
  return PERFORMANCE_TESTS[category] || [];
}

/**
 * Get current test environment configuration
 * @returns {Object} Current environment configuration
 */
export function getCurrentEnvironment() {
  const isCI = Cypress.env('CI') || Cypress.env('CYPRESS_CI');
  return isCI ? TEST_ENVIRONMENTS.CI : TEST_ENVIRONMENTS.LOCAL;
}
