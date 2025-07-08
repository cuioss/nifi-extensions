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

### Verification Commands

**Every implementation step must be verified using both of these exact commands**:

```bash
# 1. Full build verification (all modules, lint checks, unit tests)
./mvnw clean verify

# 2. Integration tests with Docker environment
./mvnw clean verify -pl e-2-e-cypress -Pintegration-tests
```

**Both commands must pass before committing any changes.**

### Development Workflow

1. **Make small incremental changes** (add one test, one command, one feature)
2. **Immediately verify** with both Maven commands above
3. **Fix any failures immediately** - never accumulate issues
4. **Commit successful changes** only after both commands pass
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

### 1. Helper-Based Testing Pattern

The foundation of effective testing is using dedicated helper functions:

```javascript
describe('NiFi Authentication Tests', () => {
  it('Should login successfully and maintain session', () => {
    // Navigate to login page using navigation helper
    cy.navigateToPage('LOGIN');

    // Login using auth helper with default credentials
    cy.loginNiFi('testUser', 'drowssap');

    // Verify we're authenticated using session context
    cy.getSessionContext().then((session) => {
      expect(session.isLoggedIn).to.be.true;
      expect(session.pageType).to.equal('MAIN_CANVAS');
    });
  });
});
```

### 2. Navigation Testing Pattern

Navigation tests use the navigation-helper for page transitions:

```javascript
describe('NiFi Navigation Tests', () => {
  beforeEach(() => {
    // Ensure NiFi is ready using auth helper
    cy.ensureNiFiReady('testUser', 'drowssap');
  });

  it('Should navigate from login to main canvas', () => {
    // Verify we're already authenticated (from beforeEach)
    cy.getPageContext().then((context) => {
      expect(context.pageType).to.equal('MAIN_CANVAS');
      expect(context.isAuthenticated).to.be.true;
    });

    // Test navigation helper functionality
    cy.navigateToPage('MAIN_CANVAS');
    cy.verifyPageType('MAIN_CANVAS');
  });
});
```

### 3. Processor Testing Pattern

Processor tests use the processor-helper for lifecycle management:

```javascript
describe('Processor Add/Remove Tests', () => {
  beforeEach(() => {
    // Ensure NiFi is ready using auth helper
    cy.ensureNiFiReady('testUser', 'drowssap');
  });

  it('Should add a processor to canvas', () => {
    // Use processor helper to add processor
    cy.addProcessorToCanvas('GenerateFlowFile')
      .then((processorInfo) => {
        expect(processorInfo).to.have.property('id');
        expect(processorInfo).to.have.property('type', 'GenerateFlowFile');
        cy.log(`✅ Processor added: ${processorInfo.id}`);
      });
  });

  it('Should remove processor from canvas', () => {
    // Add processor then remove it using helper
    cy.addProcessorToCanvas('GenerateFlowFile')
      .then((processorInfo) => {
        cy.removeProcessorFromCanvas(processorInfo.id);
        cy.log(`✅ Processor removed: ${processorInfo.id}`);
      });
  });
});
```

### 4. Cross-Helper Integration Pattern

Tests demonstrate how helpers work together:

```javascript
describe('Helper Integration Tests', () => {
  it('Should demonstrate auth-aware processor operations', () => {
    // Navigation helper detects we need authentication
    cy.navigateToPage('MAIN_CANVAS');
    
    // Auth helper ensures we're authenticated before proceeding
    cy.ensureNiFiReady('testUser', 'drowssap');
    
    // Processor helper uses getSessionContext() for auth verification
    cy.addProcessorToCanvas('GenerateFlowFile')
      .then((processorInfo) => {
        // Processor helper ensures authentication before operations
        expect(processorInfo).to.have.property('id');
        cy.log('✅ Cross-helper integration successful');
      });
  });

  it('Should handle session management across helpers', () => {
    // Clear session using auth helper
    cy.clearSession();
    
    // Navigation helper detects unauthenticated state
    cy.navigateToPage('LOGIN');
    
    // Auth helper handles login
    cy.loginNiFi('testUser', 'drowssap');
    
    // All helpers now recognize authenticated state
    cy.getSessionContext().then((session) => {
      expect(session.isLoggedIn).to.be.true;
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

### Helper Functions Implementation

```javascript
// Auth Helper - Direct login without cy.session
Cypress.Commands.add('loginNiFi', (username = 'testUser', password = 'drowssap') => {
  cy.log(`🔐 Logging into NiFi as ${username}`);
  
  cy.get('input[type="text"], input[id*="username"], input[name="username"]')
    .should('be.visible')
    .clear()
    .type(username);
    
  cy.get('input[type="password"], input[id*="password"], input[name="password"]')
    .should('be.visible')
    .clear()
    .type(password);
    
  cy.get('button[type="submit"], input[type="submit"], button').contains(/log\s*in/i)
    .should('be.visible')
    .click();
    
  cy.wait(3000);
  cy.log('✅ Login completed');
});

// Processor Helper - Authentication-aware operations
Cypress.Commands.add('addProcessorToCanvas', (processorType) => {
  return cy.getSessionContext().then((session) => {
    if (!session.isLoggedIn) {
      throw new Error('Cannot add processor: not authenticated');
    }
    
    // Processor addition logic here
    cy.log(`🔧 Adding processor: ${processorType}`);
    // Implementation continues...
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
