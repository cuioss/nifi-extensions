# Testing Patterns and Best Practices

Practical code examples and patterns for testing custom processor logic using NiFi as a platform.

## Core Testing Philosophy

**We use NiFi as a platform to test our custom processor logic. We don't test NiFi itself.**

### Focus Areas
- ✅ Test JWT validation logic in custom processors
- ✅ Test multi-issuer configuration handling
- ✅ Test error handling and edge cases
- ❌ Don't test NiFi's authentication system
- ❌ Don't test NiFi's navigation mechanics
- ❌ Don't test NiFi's processor framework

## Stepwise Development Approach

**Critical Rule**: All development follows a fail-fast, stepwise verification approach.

### Verification Command

**Every implementation step must be verified using this exact command**:
```bash
./mvnw clean verify -pl e-2-e-cypress -Pintegration-tests
```

### Development Workflow

1. **Make small incremental changes** (add one test, one command, one feature)
2. **Immediately verify** with the Maven command above
3. **Fix any failures immediately** - never accumulate issues
4. **Commit successful changes** with descriptive messages
5. **Repeat** for the next small change

### Implementation Steps Completed

- ✅ **Step 1**: JWT Token Validation (15 tests passing)
- ✅ **Step 2**: JWKS Endpoint Validation (16 tests passing)  
- ✅ **Step 3**: Error Handling Scenarios (20 tests passing)
- ✅ **Step 4**: Multi-issuer Configuration (23 tests passing)
- ✅ **Step 5**: Advanced UI Navigation (25 tests passing)

### Why This Approach Works

- **Immediate feedback**: Know exactly what broke and when
- **Smaller debug scope**: Issues are isolated to recent changes
- **Reliable builds**: Never merge broken code
- **Team confidence**: Everyone knows the current state is working
- **CI/CD ready**: Tests are always in a deployable state

## Testing Patterns

### 1. Minimal NiFi Interaction Pattern

The foundation of effective testing is minimal interaction with NiFi mechanics:

```javascript
describe('JWT Processor Testing', () => {
  beforeEach(() => {
    // Minimal setup - just get authenticated and ready
    cy.ensureAuthenticatedAndReady();
  });

  it('should validate JWT tokens correctly', () => {
    // Focus: Test our JWT validation logic
    cy.ensureProcessorConfigured('JWTTokenAuthenticator', {
      'jwks-url': 'http://keycloak:9080/realms/nifi/protocol/openid_connect/certs',
      'issuer': 'http://keycloak:9080/realms/nifi'
    })
    .then((processorId) => {
      // Test our custom logic, not NiFi mechanics
      cy.testJWTValidation(processorId, {
        validToken: 'eyJ0eXAiOiJKV1Q...',
        invalidToken: 'invalid.token.here',
        expiredToken: 'expired.token.here'
      });
    });
  });
});
```

### 2. Processor Configuration Detection

Reliable detection of processor state is crucial for testing:

```javascript
// Custom command for robust processor detection
Cypress.Commands.add('detectProcessorConfiguration', (processorId) => {
  return cy.get(`[data-testid="processor-${processorId}"]`)
    .should('exist')
    .then(($processor) => {
      // Extract configuration state
      const config = {
        name: $processor.find('[data-testid="processor-name"]').text(),
        state: $processor.attr('data-state'),
        properties: {}
      };
      
      // Focus on our custom properties, not NiFi internals
      $processor.find('[data-testid^="property-"]').each((index, el) => {
        const $el = Cypress.$(el);
        const key = $el.attr('data-property-name');
        const value = $el.attr('data-property-value');
        if (key && key.startsWith('jwt-')) {
          config.properties[key] = value;
        }
      });
      
      return config;
    });
});
```

### 3. Custom Processor Testing

Focus testing on business logic, not NiFi framework:

```javascript
describe('MultiIssuer JWT Validation', () => {
  it('should handle multiple issuers correctly', () => {
    const multiIssuerConfig = {
      'issuer-1-jwks-url': 'http://issuer1.example.com/.well-known/jwks.json',
      'issuer-1-name': 'Primary Issuer',
      'issuer-2-jwks-url': 'http://issuer2.example.com/.well-known/jwks.json', 
      'issuer-2-name': 'Secondary Issuer'
    };
    
    cy.ensureProcessorConfigured('MultiIssuerJWTTokenAuthenticator', multiIssuerConfig)
      .then((processorId) => {
        // Test our multi-issuer logic
        cy.testMultiIssuerValidation(processorId, [
          { issuer: 'issuer1', token: 'valid.issuer1.token' },
          { issuer: 'issuer2', token: 'valid.issuer2.token' },
          { issuer: 'unknown', token: 'invalid.unknown.token', expectFailure: true }
        ]);
      });
  });
});
```

### 4. Error Handling Patterns

Test edge cases and error scenarios in custom logic:

```javascript
describe('JWT Error Handling', () => {
  const errorScenarios = [
    {
      name: 'malformed token',
      token: 'not.a.valid.jwt',
      expectedError: 'MALFORMED_TOKEN'
    },
    {
      name: 'expired token', 
      token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...', // Expired token
      expectedError: 'EXPIRED_TOKEN'
    },
    {
      name: 'invalid signature',
      token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...', // Invalid signature
      expectedError: 'INVALID_SIGNATURE'
    }
  ];

  errorScenarios.forEach((scenario) => {
    it(`should handle ${scenario.name}`, () => {
      cy.ensureProcessorConfigured('JWTTokenAuthenticator')
        .then((processorId) => {
          cy.testTokenValidation(processorId, scenario.token)
            .should('have.property', 'errorCode', scenario.expectedError);
        });
    });
  });
});
```

### 5. Performance Testing Pattern

Test custom processor performance characteristics:

```javascript
describe('JWT Performance', () => {
  it('should validate tokens within performance thresholds', () => {
    const performanceTest = {
      tokenCount: 100,
      maxDurationMs: 5000,
      expectedThroughput: 20 // tokens per second
    };
    
    cy.ensureProcessorConfigured('JWTTokenAuthenticator')
      .then((processorId) => {
        cy.performanceTest(processorId, performanceTest)
          .then((results) => {
            expect(results.totalDuration).to.be.lessThan(performanceTest.maxDurationMs);
            expect(results.throughput).to.be.greaterThan(performanceTest.expectedThroughput);
          });
      });
  });
});
```

## Utility Commands

### Authentication and Setup

```javascript
// Minimal authentication - focus on getting ready to test
Cypress.Commands.add('ensureAuthenticatedAndReady', () => {
  cy.session('nifi-auth', () => {
    cy.visit('/nifi');
    cy.get('[data-testid="username"]').type('admin');
    cy.get('[data-testid="password"]').type('ctsBtRBKHRAx69EqUghvvgEvjnaLjFEB');
    cy.get('[data-testid="login-button"]').click();
    cy.url().should('include', '/nifi/');
  });
});

// Processor configuration with focus on custom properties
Cypress.Commands.add('ensureProcessorConfigured', (processorType, config = {}) => {
  return cy.get('[data-testid="add-processor"]')
    .click()
    .then(() => {
      cy.get(`[data-testid="processor-${processorType}"]`).click();
    })
    .then(() => {
      // Configure only our custom properties
      Object.entries(config).forEach(([key, value]) => {
        if (key.startsWith('jwt-') || key.startsWith('issuer-')) {
          cy.get(`[data-testid="property-${key}"]`).clear().type(value);
        }
      });
      cy.get('[data-testid="apply-button"]').click();
    })
    .then(() => {
      // Return processor ID for further testing
      return cy.get('[data-testid^="processor-"]')
        .last()
        .invoke('attr', 'data-testid')
        .then(id => id.replace('processor-', ''));
    });
});
```

### JWT Testing Utilities

```javascript
// Test JWT validation logic
Cypress.Commands.add('testJWTValidation', (processorId, tokens) => {
  const results = [];
  
  Object.entries(tokens).forEach(([tokenType, token]) => {
    cy.processFlowFile(processorId, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then((result) => {
      results.push({
        tokenType,
        success: result.relationship === 'success',
        errorCode: result.attributes['jwt.error.code'],
        processingTime: result.processingTimeMs
      });
    });
  });
  
  return cy.wrap(results);
});

// Test multi-issuer scenarios
Cypress.Commands.add('testMultiIssuerValidation', (processorId, scenarios) => {
  return cy.wrap(scenarios).each((scenario) => {
    cy.processFlowFile(processorId, {
      headers: { 'Authorization': `Bearer ${scenario.token}` }
    }).then((result) => {
      if (scenario.expectFailure) {
        expect(result.relationship).to.equal('authentication-failed');
      } else {
        expect(result.relationship).to.equal('success');
        expect(result.attributes['jwt.issuer']).to.equal(scenario.issuer);
      }
    });
  });
});
```

## Best Practices

### 1. Test Organization
```javascript
// Group tests by functionality, not by UI navigation
describe('JWT Token Validation', () => {
  describe('Valid Tokens', () => {
    // Tests for valid token scenarios
  });
  
  describe('Invalid Tokens', () => {
    // Tests for invalid token scenarios  
  });
  
  describe('Multi-Issuer Support', () => {
    // Tests for multi-issuer functionality
  });
});
```

### 2. Data-Driven Testing
```javascript
// Use fixtures for test data
const tokenTestCases = require('../fixtures/jwt-test-cases.json');

tokenTestCases.forEach((testCase) => {
  it(`should handle ${testCase.description}`, () => {
    cy.testTokenValidation(testCase.processorId, testCase.token)
      .should('match', testCase.expectedResult);
  });
});
```

### 3. Isolation and Cleanup
```javascript
describe('Processor Tests', () => {
  let processorId;
  
  beforeEach(() => {
    // Clean state for each test
    cy.ensureCleanCanvas();
    cy.ensureAuthenticatedAndReady();
  });
  
  afterEach(() => {
    // Cleanup after each test
    if (processorId) {
      cy.removeProcessor(processorId);
    }
  });
});
```

### 4. Error Assertions
```javascript
// Specific error checking
cy.testTokenValidation(processorId, invalidToken)
  .should('have.property', 'relationship', 'authentication-failed')
  .and('have.property', 'errorCode', 'INVALID_SIGNATURE')
  .and('have.property', 'errorMessage')
  .and('match', /signature verification failed/i);
```

## Troubleshooting Guide

### Common Issues

#### 1. Processor Not Found
```javascript
// Problem: Can't locate processor on canvas
// Solution: Use robust selectors with retries
cy.get('[data-testid^="processor-"]', { timeout: 10000 })
  .should('exist')
  .and('be.visible');
```

#### 2. Configuration State Detection
```javascript
// Problem: Can't detect if processor is configured
// Solution: Check multiple state indicators
cy.get(`[data-testid="processor-${processorId}"]`)
  .should('have.attr', 'data-state', 'configured')
  .and('not.have.class', 'invalid-state');
```

#### 3. Timing Issues
```javascript
// Problem: Tests fail due to timing
// Solution: Wait for specific conditions, not fixed delays
cy.get('[data-testid="processor-status"]')
  .should('contain.text', 'Running')
  .then(() => {
    // Proceed with testing
  });
```

#### 4. Authentication Failures
```javascript
// Problem: Authentication state not preserved
// Solution: Use cy.session for authentication state
cy.session('auth', () => {
  // Authentication logic
}, {
  validate: () => {
    cy.request('/nifi-api/system-diagnostics').then((response) => {
      expect(response.status).to.eq(200);
    });
  }
});
```

### Debugging Techniques

#### 1. Console Logging
```javascript
// Add debugging information
cy.get('[data-testid="processor-status"]')
  .then(($el) => {
    console.log('Processor status:', $el.text());
    console.log('Processor classes:', $el.attr('class'));
  });
```

#### 2. Screenshot on Failure
```javascript
// Take screenshots for debugging
afterEach(function() {
  if (this.currentTest.state === 'failed') {
    cy.screenshot(`failed-${this.currentTest.title}`);
  }
});
```

#### 3. Network Request Monitoring
```javascript
// Monitor API calls
cy.intercept('POST', '/nifi-api/processors/*/run-status').as('startProcessor');
cy.get('[data-testid="start-processor"]').click();
cy.wait('@startProcessor').its('response.statusCode').should('eq', 200);
```

## Advanced Patterns

### 1. Custom Command Chaining
```javascript
cy.ensureAuthenticatedAndReady()
  .ensureProcessorConfigured('JWTTokenAuthenticator', config)
  .testJWTValidation(tokens)
  .validateResults(expectedResults);
```

### 2. Parallel Test Execution
```javascript
// Structure tests for parallel execution
describe('JWT Validation Suite', () => {
  const testGroups = ['valid-tokens', 'invalid-tokens', 'edge-cases'];
  
  testGroups.forEach((group) => {
    describe(group, () => {
      // Independent test group
    });
  });
});
```

### 3. Cross-Environment Testing
```javascript
// Environment-specific configurations
const configs = {
  local: { baseUrl: 'https://localhost:9095' },
  staging: { baseUrl: 'https://staging-nifi.example.com' },
  production: { baseUrl: 'https://nifi.example.com' }
};

const env = Cypress.env('ENVIRONMENT') || 'local';
const config = configs[env];
```

## Standards Compliance

This testing framework follows [CUI Testing Standards](https://github.com/cuioss/cui-llm-rules/tree/main/standards/testing):

- **Zero ESLint Warnings**: All code passes linting without warnings
- **Modular Architecture**: Reusable commands and utilities
- **Error Resilience**: Graceful handling of failures and retries
- **Performance Focus**: Efficient selectors and minimal delays

---

*For setup instructions, see [Setup Guide](./setup-guide.md). For technical details, see [Technical Architecture](./architecture.md).*
