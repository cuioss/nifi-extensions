# NiFi Integration Test Recipes and How-To Guides

## 🎯 **Core Philosophy: Test Custom Processors, Not NiFi**

**Key Principle**: We use NiFi as a platform to test our custom processor logic. We don't test NiFi itself - we just need simple, robust ways to interact with it.

**Focus Areas**:
- ✅ **Test our JWT validation logic** in our custom processors
- ✅ **Test our multi-issuer configuration** handling
- ✅ **Test our error handling** and edge cases
- ❌ Don't test NiFi's authentication system
- ❌ Don't test NiFi's navigation mechanics  
- ❌ Don't test NiFi's processor framework

## Table of Contents
1. [Getting Started](#getting-started)
2. [Minimal NiFi Interaction](#minimal-nifi-interaction)
3. [Processor Configuration Detection](#processor-configuration-detection)
4. [Custom Processor Testing](#custom-processor-testing)
5. [Debugging Recipes](#debugging-recipes)
6. [Best Practices](#best-practices)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Minimal Viable NiFi Setup Patterns](#minimal-viable-nifi-setup-patterns)

## Getting Started

### Recipe: Focused Test Setup
**Goal**: Minimal setup to test our custom processors, not NiFi functionality

#### Prerequisites
```bash
# Ensure Docker containers are running
docker ps | grep nifi
docker ps | grep keycloak

# Verify our NAR deployment (our custom processors)
ls -la /Users/oliver/git/nifi-extensions/target/nifi-deploy/
```

#### Focused Test Pattern
```javascript
// cypress/e2e/jwt-processor-test.cy.js
describe('JWT Processor Testing', () => {
  beforeEach(() => {
    // Minimal NiFi interaction - just get authenticated and ready
    cy.ensureAuthenticatedAndReady(); // Simple utility command
  });

  it('should validate JWT tokens correctly', () => {
    // Focus: Test our JWT validation logic
    cy.ensureProcessorConfigured('JWTTokenAuthenticator', {
      'jwt-secret': 'test-secret-key',
      'algorithm': 'HS256'
    });
    
    // Test our custom processor logic
    cy.testJWTValidation('valid-jwt-token').should('succeed');
    cy.testJWTValidation('invalid-jwt-token').should('fail');
  });
});
```

#### Running Focused Tests
```bash
# Run custom processor tests only
npx cypress run --spec "cypress/e2e/*processor*.cy.js" --config baseUrl=https://localhost:9095,chromeWebSecurity=false
```

## Minimal NiFi Interaction

### Recipe: Simple Authentication State
**Goal**: Get authenticated without testing authentication mechanics

```javascript
// Minimal login - just achieve authenticated state
cy.ensureAuthenticatedAndReady().then(() => {
  // We're authenticated, now test our processors
  cy.testCustomProcessorLogic();
});

// Check if already authenticated before attempting login
Cypress.Commands.add('ensureAuthenticatedAndReady', () => {
  cy.url().then((url) => {
    if (url.includes('login')) {
      cy.performMinimalLogin();
    }
  });
  cy.verifyCanAccessProcessors(); // Simple check we can see processors
});
```

### Recipe: Direct URL Navigation
**Goal**: Get to processor canvas without testing navigation

```javascript
// Use direct URLs when possible
cy.visit('/nifi/#/canvas'); // Direct to canvas
cy.ensureAuthenticatedAndReady();

// Alternative: Check current location, navigate only if needed
cy.url().then((currentUrl) => {
  if (!currentUrl.includes('canvas')) {
    cy.visit('/nifi/#/canvas');
  }
});
```

### Recipe: State-Based Navigation
**Goal**: Navigate based on current state, not UI testing

```javascript
// Navigate based on where we are, not how navigation works
Cypress.Commands.add('ensureOnProcessorCanvas', () => {
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="processor-canvas"], .canvas-container').length === 0) {
      cy.visit('/nifi/#/canvas');
      cy.wait(2000); // Allow page load
    }
  });
  cy.verifyProcessorCanvasVisible();
});
```

## Processor Configuration Detection

### Recipe: Core Configuration Detection
**Goal**: Reliable way to determine if processor is configured for our testing

```javascript
// Primary command for testing foundation
Cypress.Commands.add('isProcessorConfigured', (processorType, requiredConfig) => {
  cy.get('body').then(($body) => {
    // Find processor by type (our way of identification)
    const processor = $body.find(`[data-processor-type="${processorType}"], .processor:contains("${processorType}")`);
    
    if (processor.length === 0) {
      return cy.wrap({ configured: false, exists: false });
    }
    
    // Check if processor has required configuration
    cy.inspectProcessorConfiguration(processor, requiredConfig)
      .then((configState) => {
        return cy.wrap({
          configured: configState.hasAllRequired,
          exists: true,
          missingProperties: configState.missing
        });
      });
  });
});
```

### Recipe: Simple Configuration Check
**Goal**: Binary check - ready for testing or not?

```javascript
// Simple usage pattern
cy.isProcessorConfigured('JWTTokenAuthenticator', {
  'jwt-secret': { exists: true },  // Just check if property is set
  'algorithm': { value: 'HS256' }  // Check specific value
}).then((state) => {
  if (state.configured) {
    cy.log('✅ Processor ready for testing');
    cy.testJWTValidationLogic();
  } else {
    cy.log('⚙️ Setting up processor for testing');
    cy.configureProcessorForTesting('JWTTokenAuthenticator', testConfig);
  }
});
```

### Recipe: Processor Setup Detection
**Goal**: Know if processor needs initial setup before testing

```javascript
// Detect processor setup state
Cypress.Commands.add('getProcessorTestState', (processorType) => {
  cy.isProcessorConfigured(processorType, MINIMAL_TEST_CONFIG)
    .then((state) => {
      if (!state.exists) {
        return cy.wrap('needs_creation');
      } else if (!state.configured) {
        return cy.wrap('needs_configuration');
      } else {
        return cy.wrap('ready_for_testing');
      }
    });
});

// Usage
cy.getProcessorTestState('JWTTokenAuthenticator').then((testState) => {
  switch(testState) {
    case 'needs_creation':
      cy.createProcessorForTesting('JWTTokenAuthenticator');
      break;
    case 'needs_configuration':
      cy.configureProcessorForTesting('JWTTokenAuthenticator');
      break;
    case 'ready_for_testing':
      cy.testJWTProcessorLogic();
      break;
  }
});
```

## Custom Processor Testing

### Recipe: JWT Validation Testing
**Goal**: Test our JWT processor logic, not NiFi framework

```javascript
// Test our custom JWT validation logic
describe('JWT Token Validation', () => {
  const TEST_CONFIG = {
    'jwt-secret': 'test-secret-key',
    'algorithm': 'HS256',
    'required-claims': 'sub,iat,exp'
  };

  beforeEach(() => {
    cy.ensureProcessorConfigured('JWTTokenAuthenticator', TEST_CONFIG);
  });

  it('should accept valid JWT tokens', () => {
    const validToken = generateTestJWT('test-secret-key', { sub: 'user123' });
    cy.testProcessorWithInput('JWTTokenAuthenticator', validToken)
      .should('result', 'success')
      .should('output', 'authenticated');
  });

  it('should reject invalid JWT tokens', () => {
    const invalidToken = 'invalid.jwt.token';
    cy.testProcessorWithInput('JWTTokenAuthenticator', invalidToken)
      .should('result', 'failure')
      .should('output', 'authentication_failed');
  });
});
```

### Recipe: Multi-Issuer Configuration Testing
**Goal**: Test our multi-issuer processor logic

```javascript
// Test our multi-issuer JWT processor
describe('Multi-Issuer JWT Validation', () => {
  const MULTI_ISSUER_CONFIG = {
    'issuer-1-secret': 'secret-1',
    'issuer-2-secret': 'secret-2',
    'fallback-validation': 'true'
  };

  it('should handle multiple issuers correctly', () => {
    cy.ensureProcessorConfigured('MultiIssuerJWTTokenAuthenticator', MULTI_ISSUER_CONFIG);
    
    // Test token from issuer 1
    const token1 = generateTestJWT('secret-1', { iss: 'issuer-1' });
    cy.testProcessorWithInput('MultiIssuerJWTTokenAuthenticator', token1)
      .should('result', 'success');
    
    // Test token from issuer 2
    const token2 = generateTestJWT('secret-2', { iss: 'issuer-2' });
    cy.testProcessorWithInput('MultiIssuerJWTTokenAuthenticator', token2)
      .should('result', 'success');
  });
});
```

### Recipe: Error Handling Testing
**Goal**: Test our custom error handling logic

```javascript
// Test our processor error handling
describe('Processor Error Handling', () => {
  it('should handle malformed configuration gracefully', () => {
    cy.ensureProcessorConfigured('JWTTokenAuthenticator', {
      'jwt-secret': '', // Empty secret should cause graceful error
      'algorithm': 'INVALID_ALGORITHM'
    });
    
    cy.testProcessorWithInput('JWTTokenAuthenticator', 'any-token')
      .should('result', 'configuration_error')
      .should('errorMessage', 'contain', 'Invalid JWT configuration');
  });
});
```

## Navigation Recipes

### Recipe: Basic Canvas Navigation
```javascript
// Navigate to main canvas
cy.navigateToCanvas();
cy.verifyCanvasAccessible();
```

### Recipe: Controller Services Navigation
```javascript
// Navigate to controller services (with retry for stability)
cy.navigateToControllerServices()
  .catch(() => {
    cy.log('First attempt failed, retrying navigation');
    cy.wait(2000);
    cy.navigateToControllerServices();
  });
```

### Recipe: Safe Navigation Pattern
```javascript
// Navigation with verification
cy.navigateToCanvas();
cy.get('nifi').should('exist');
cy.url().should('contain', 'canvas');
cy.get('body').should('contain', 'expected-content');
```

### Recipe: Cross-Navigation Testing
```javascript
// Test navigation between different sections
cy.navigateToCanvas();
cy.verifyCanvasAccessible();

cy.navigateToControllerServices();
cy.url().should('contain', 'controller-services');

cy.navigateToCanvas();
cy.verifyCanvasAccessible(); // Verify we can return
```

## Debugging Recipes

### Recipe: UI Structure Analysis
```javascript
// Analyze current UI structure
cy.get('body').then(($body) => {
  const allElements = $body.find('*').toArray();
  cy.log(`Total elements found: ${allElements.length}`);
  
  // Log specific element types
  const processors = $body.find('g.processor, [class*="processor"]');
  cy.log(`Processor elements: ${processors.length}`);
  
  // Log Angular components
  const angularComponents = $body.find('[ng-version]');
  cy.log(`Angular components: ${angularComponents.length}`);
});
```

### Recipe: Element Discovery Pattern
```javascript
// Flexible element discovery
function findElementByPatterns(patterns, description) {
  cy.get('body').then(($body) => {
    for (const pattern of patterns) {
      const elements = $body.find(pattern);
      if (elements.length > 0) {
        cy.log(`✅ Found ${description} using pattern: ${pattern}`);
        return cy.wrap(elements.first());
      }
    }
    cy.log(`❌ Could not find ${description} with any pattern`);
    throw new Error(`Element not found: ${description}`);
  });
}

// Usage
const loginButtonPatterns = [
  '[data-testid="login-button"]',
  'button[type="submit"]',
  '.login-button',
  'button:contains("Login")'
];

findElementByPatterns(loginButtonPatterns, 'login button');
```

### Recipe: Screenshot Debugging
```javascript
// Take screenshots at key points
cy.screenshot('before-login');
cy.nifiLogin();
cy.screenshot('after-login');
cy.addProcessor('JWTTokenAuthenticator');
cy.screenshot('after-adding-processor');
```

### Recipe: Console Log Analysis
```javascript
// Capture and analyze console logs
cy.window().then((win) => {
  const logs = [];
  const originalLog = win.console.log;
  win.console.log = (...args) => {
    logs.push(args);
    originalLog.apply(win.console, args);
  };
  
  // Perform actions
  cy.nifiLogin().then(() => {
    cy.log('Console logs captured:', logs);
  });
});
```

### Recipe: Network Request Monitoring
```javascript
// Monitor network requests
cy.intercept('GET', '**/api/**').as('apiRequests');
cy.intercept('POST', '**/api/**').as('apiPosts');

cy.nifiLogin();
cy.wait('@apiRequests');
cy.get('@apiRequests').should('have.length.greaterThan', 0);
```

## Best Practices

### Recipe: Focused Test Structure
**Goal**: Test custom processor logic with minimal NiFi interaction

```javascript
describe('Custom Processor Logic Test', () => {
  beforeEach(() => {
    // Minimal setup - just get ready to test our processors
    cy.ensureAuthenticatedAndReady();
    cy.ensureOnProcessorCanvas();
  });

  afterEach(() => {
    // Simple cleanup - don't test cleanup mechanisms
    cy.resetProcessorState().catch(() => {
      cy.log('Cleanup failed, but continuing - not our focus');
    });
  });

  it('should validate our JWT logic correctly', () => {
    // Focus: Test our business logic, not NiFi interaction
    cy.getProcessorTestState('JWTTokenAuthenticator').then((state) => {
      if (state !== 'ready_for_testing') {
        cy.setupProcessorForTesting('JWTTokenAuthenticator');
      }
      
      // Now test our logic
      cy.testJWTValidation(validToken).should('succeed');
      cy.testJWTValidation(invalidToken).should('fail');
    });
  });
});
```

### Recipe: Minimal Interaction Pattern
**Goal**: Get to testing state with least NiFi complexity

```javascript
// Robust pattern that focuses on outcomes, not mechanisms
function ensureTestingReadiness(processorType, config) {
  return cy.isProcessorConfigured(processorType, config)
    .then((state) => {
      if (state.configured) {
        cy.log('✅ Ready for testing');
        return;
      }
      
      // Set up for testing, but don't test the setup process
      cy.log('⚙️ Setting up for testing...');
      return cy.setupProcessorQuickly(processorType, config);
    });
}

// Usage - focus on what we need, not how we get there
cy.wrap(ensureTestingReadiness('JWTTokenAuthenticator', TEST_CONFIG))
  .then(() => cy.testOurProcessorLogic());
```

### Recipe: Test Data Management for Custom Logic
**Goal**: Consistent test data for our processor validation

```javascript
// Test data focused on our processor logic
const JWT_TEST_DATA = {
  validTokens: {
    hs256: generateJWT('test-secret', { sub: 'user1', exp: futureTimestamp() }),
    rs256: generateJWT('rsa-key', { sub: 'user2', exp: futureTimestamp() }, 'RS256')
  },
  invalidTokens: {
    expired: generateJWT('test-secret', { sub: 'user1', exp: pastTimestamp() }),
    wrongSecret: generateJWT('wrong-secret', { sub: 'user1', exp: futureTimestamp() }),
    malformed: 'not.a.jwt'
  },
  processorConfigs: {
    basic: { 'jwt-secret': 'test-secret', 'algorithm': 'HS256' },
    multiIssuer: { 
      'issuer-1-secret': 'secret-1', 
      'issuer-2-secret': 'secret-2',
      'fallback-validation': 'true' 
    }
  }
};

// Use in tests
cy.testProcessorWithInput('JWTTokenAuthenticator', JWT_TEST_DATA.validTokens.hs256)
  .should('result', 'authenticated');
```

### Recipe: Error Resilience for Custom Testing
**Goal**: Tests that survive minor NiFi changes but validate our logic

```javascript
// Resilient pattern that focuses on our processor outcomes
function testProcessorLogicRobustly(processorType, testCases) {
  return cy.ensureProcessorReadyForTesting(processorType)
    .then(() => {
      testCases.forEach((testCase) => {
        cy.testProcessorWithInput(processorType, testCase.input)
          .should('result', testCase.expectedResult)
          .should('output', testCase.expectedOutput);
      });
    })
    .catch((setupError) => {
      // If NiFi interaction fails, try alternative approach
      cy.log('Primary setup failed, trying alternative...');
      return cy.alternativeProcessorSetup(processorType)
        .then(() => {
          // Re-run our actual tests
          testCases.forEach((testCase) => {
            cy.testProcessorWithInput(processorType, testCase.input)
              .should('result', testCase.expectedResult);
          });
        });
    });
}
```

## Troubleshooting Guide

### Problem: Can't Detect Processor Configuration State
**Symptoms**: `isProcessorConfigured()` returns unclear results
**Root Cause**: Trying to test NiFi internals instead of just checking our processor setup
**Solutions**:
```javascript
// Simple approach - just check if our processor works
cy.testProcessorWithSampleInput('JWTTokenAuthenticator', 'sample-jwt')
  .then((result) => {
    if (result.includes('configuration_error')) {
      cy.log('Processor needs configuration');
      cy.setupProcessorForTesting();
    } else {
      cy.log('Processor appears configured');
    }
  });
```

### Problem: Login Takes Too Long or Fails
**Symptoms**: Authentication timeout or repeated login attempts
**Root Cause**: Trying to test authentication instead of just achieving it
**Solutions**:
```javascript
// Simplified login - just get authenticated
cy.url().then((url) => {
  if (url.includes('login')) {
    cy.get('input[type="text"], input[name="username"]').type('admin');
    cy.get('input[type="password"], input[name="password"]').type('ctsBtRBKHRAx69EqUghvvgEvjnaLjFEB');
    cy.get('button[type="submit"], .login-button').click();
    cy.wait(3000); // Simple wait
  }
});

// Verify we can access what we need for testing
cy.get('body').should('contain', 'canvas').or('contain', 'processor');
```

### Problem: Can't Find Processor for Testing
**Symptoms**: Processor elements not found or inconsistent
**Root Cause**: Trying to test NiFi UI instead of just finding our processor
**Solutions**:
```javascript
// Focus on processor type identification, not UI testing
cy.get('body').then(($body) => {
  // Look for our specific processor types
  const processors = $body.find('[data-processor-type*="JWT"], .processor:contains("JWT"), [title*="JWT"]');
  
  if (processors.length === 0) {
    cy.log('No JWT processors found, creating one for testing');
    cy.createProcessorForTesting('JWTTokenAuthenticator');
  } else {
    cy.log(`Found ${processors.length} JWT processors for testing`);
    cy.wrap(processors.first()).as('testProcessor');
  }
});
```

### Problem: Tests Are Flaky Due to NiFi UI Changes
**Symptoms**: Tests pass/fail inconsistently when NiFi UI updates
**Root Cause**: Testing NiFi mechanics instead of our processor logic
**Solutions**:
```javascript
// Make tests resilient to UI changes
function testProcessorLogicOnly(processorType, testData) {
  // Try multiple ways to set up processor, focus on outcome
  const setupAttempts = [
    () => cy.setupProcessorViaUI(processorType),
    () => cy.setupProcessorViaAPI(processorType),
    () => cy.setupProcessorViaDirect(processorType)
  ];
  
  return cy.trySetupMethods(setupAttempts).then(() => {
    // Now test our logic - this part shouldn't be flaky
    testData.forEach((test) => {
      cy.validateProcessorLogic(processorType, test.input, test.expected);
    });
  });
}
```

### Problem: Tests Take Too Long to Execute
**Symptoms**: Test suite runtime increases, CI/CD timeouts
**Root Cause**: Testing too much NiFi interaction instead of focusing on our code
**Solutions**:
```javascript
// Streamlined test approach
describe('Fast Custom Processor Tests', () => {
  before(() => {
    // One-time setup for all tests
    cy.ensureAuthenticatedAndReady();
    cy.ensureProcessorAvailable('JWTTokenAuthenticator');
  });

  beforeEach(() => {
    // Quick verification, not full setup
    cy.verifyProcessorReady('JWTTokenAuthenticator');
  });

  it('validates JWT quickly', () => {
    // Direct processor logic test - no UI interaction
    cy.testJWTValidation(validToken).should('succeed'); // <1 second
  });
});
```

### Problem: Can't Distinguish Between NiFi Issues and Our Code Issues
**Symptoms**: Test failures could be NiFi problems or our processor problems
**Root Cause**: Mixing NiFi testing with our processor testing
**Solutions**:
```javascript
// Separate NiFi readiness from our processor testing
describe('Environment Readiness Check', () => {
  it('verifies NiFi is ready for our testing', () => {
    cy.ensureAuthenticatedAndReady();
    cy.verifyProcessorCanvasAccessible();
    cy.verifyOurProcessorsAvailable(['JWTTokenAuthenticator', 'MultiIssuerJWTTokenAuthenticator']);
  });
});

describe('Our JWT Processor Logic', () => {
  // These tests assume NiFi readiness and focus only on our code
  it('validates JWT tokens correctly', () => {
    cy.testJWTValidation(token).should('result', expected);
  });
});
```

### Quick Diagnostic Commands
```javascript
// Check if environment is ready for our testing
cy.diagnosticCheck = () => {
  cy.log('🔍 Diagnostic: Checking environment readiness...');
  
  cy.url().then(url => cy.log(`Current URL: ${url}`));
  cy.get('nifi').should('exist').then(() => cy.log('✅ NiFi Angular app loaded'));
  
  cy.get('body').then($body => {
    const processors = $body.find('[data-processor-type*="JWT"], .processor:contains("JWT")');
    cy.log(`Found ${processors.length} JWT processors`);
    
    if (processors.length === 0) {
      cy.log('⚠️ No JWT processors found - may need creation');
    } else {
      cy.log('✅ JWT processors available for testing');
    }
  });
};
```

## Performance Optimization for Custom Processor Testing

### Recipe: Fast Test Execution
```javascript
// Optimize for testing our processor logic, not NiFi interaction
describe('Optimized JWT Processor Tests', () => {
  // Shared processor instance for all tests
  before(() => {
    cy.ensureProcessorConfiguredOnce('JWTTokenAuthenticator', STANDARD_CONFIG);
  });

  // Fast individual tests
  it('validates good token', () => {
    cy.testJWT(goodToken).should('succeed'); // Direct processor test
  });

  it('rejects bad token', () => {
    cy.testJWT(badToken).should('fail'); // Direct processor test
  });
  
  // No UI interaction per test, no cleanup needed
});
```

## Minimal Viable NiFi Setup Patterns

### Recipe: Philosophy-Driven Testing Approach
**Goal**: Use NiFi as a platform to test our custom processor logic, not test NiFi itself

#### What We DON'T Test (NiFi Framework)
```javascript
// ❌ Avoid these - they test NiFi, not our processors
describe('Things to Avoid', () => {
  it('should NOT test how NiFi navigation works', () => {
    // Don't test NiFi's navigation mechanics
    cy.testNavigationSystem(); // ❌ Wrong focus
  });

  it('should NOT test how NiFi dialogs work', () => {
    // Don't test NiFi's dialog framework  
    cy.testDialogFramework(); // ❌ Wrong focus
  });

  it('should NOT test NiFi UI components', () => {
    // Don't test NiFi's UI library
    cy.testUIComponents(); // ❌ Wrong focus
  });
});
```

#### What We DO Test (Custom Processor Logic)
```javascript
// ✅ Focus on these - they test our custom logic
describe('Custom JWT Processor Logic', () => {
  beforeEach(() => {
    // Minimal NiFi setup
    cy.enhancedAuthentication('admin', 'adminadminadmin');
    cy.navigateToCanvas();
  });

  afterEach(() => {
    // Clean up our processors
    cy.robustCleanupProcessors();
  });

  it('should test our JWT validation logic', () => {
    // Focus: Test OUR processor, use NiFi as platform
    cy.robustAddProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      if (processorId) {
        // Test OUR custom logic
        const multiIssuerConfig = {
          'Issuer 1 Name': 'test-issuer',
          'Issuer 1 URL': 'https://issuer.example.com',
          'Issuer 1 JWKS URL': 'https://issuer.example.com/jwks'
        };
        cy.robustConfigureProcessor(processorId, { properties: multiIssuerConfig });
        
        // Verify OUR validation logic
        cy.robustVerifyConfiguration(processorId, multiIssuerConfig);
      }
    });
  });

  it('should test our error handling', () => {
    // Test OUR error handling with invalid configuration
    cy.robustAddProcessor('JWTTokenAuthenticator').then((processorId) => {
      if (processorId) {
        const invalidConfig = { 'JWKS URL': 'invalid-url' };
        cy.robustConfigureProcessor(processorId, { properties: invalidConfig });
        
        // Verify OUR error handling works
        cy.verifyProcessorValidationErrors(processorId);
      }
    });
  });
});
```

### Recipe: Essential Commands Only
**Goal**: Minimal command set for our custom processor testing

#### Essential Commands (Keep These)
```javascript
// Authentication - just get access to the platform
cy.enhancedAuthentication(username, password)
cy.verifyLoggedIn()

// Platform Access - verify platform is ready
cy.navigateToCanvas()
cy.verifyCanvasAccessible()

// Processor Management (for our processors only)
cy.robustAddProcessor(processorType, position)
cy.robustConfigureProcessor(processorId, config)
cy.verifyProcessorProperties(processorId, properties)
cy.robustCleanupProcessors()

// Error Testing (for our error handling)
cy.verifyProcessorValidationErrors(processorId)
```

#### Commands to Avoid (NiFi Framework Testing)
```javascript
// Don't test NiFi's navigation mechanics
cy.clickMenuOption()           // ❌ Tests NiFi navigation
cy.testDialogOpening()         // ❌ Tests NiFi dialog system
cy.testUIResponsiveness()      // ❌ Tests NiFi UI performance

// Don't test NiFi's component library
cy.testAngularComponents()     // ❌ Tests NiFi's Angular framework
cy.testMaterialUIElements()    // ❌ Tests NiFi's UI library
cy.testAccessibilityFeatures() // ❌ Tests NiFi's accessibility

// Don't test NiFi's platform features
cy.testProcessorFramework()    // ❌ Tests NiFi's processor system
cy.testCanvasRendering()       // ❌ Tests NiFi's canvas engine
cy.testRoutingSystem()         // ❌ Tests NiFi's routing logic
```

### Recipe: Test Structure Patterns
**Goal**: Recommended patterns for testing our custom processors

#### ✅ Recommended Test Structure
```javascript
describe('Custom JWT Processor Logic', () => {
  beforeEach(() => {
    // Minimal NiFi setup - just get authenticated and ready
    cy.enhancedAuthentication('admin', 'adminadminadmin');
    cy.navigateToCanvas();
  });

  afterEach(() => {
    // Clean up our processors only
    cy.robustCleanupProcessors();
  });

  it('should test our JWT validation logic', () => {
    // Focus: Test OUR processor, use NiFi as platform
    cy.robustAddProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      if (processorId) {
        // Test OUR custom logic here
        // ... JWT validation testing
        // ... configuration testing  
        // ... error handling testing
      }
    });
  });
});
```

#### ❌ Anti-Pattern (Don't Do This)
```javascript
describe('NiFi Framework Testing', () => {
  it('should test how NiFi navigation works', () => {
    // ❌ Wrong focus - tests NiFi's navigation mechanics
    cy.testNavigationSystem();
  });

  it('should test how NiFi dialogs work', () => {
    // ❌ Wrong focus - tests NiFi's dialog framework
    cy.testDialogFramework();
  });

  it('should test NiFi UI components', () => {
    // ❌ Wrong focus - tests NiFi's UI library
    cy.testUIComponents();
  });
});
```

### Recipe: Performance Guidelines
**Goal**: Focus on custom processor performance, not NiFi platform performance

#### Focus on Custom Processor Setup Speed
```javascript
// Target: Custom processor setup < 15 seconds
it('should setup our processor quickly', () => {
  const startTime = Date.now();
  
  cy.robustAddProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
    if (processorId) {
      const setupTime = Date.now() - startTime;
      cy.log(`✅ Processor setup completed in ${setupTime}ms`);
      
      // Target: < 15 seconds for our processor initialization
      expect(setupTime).to.be.lessThan(15000);
    }
  });
});

// Measure: Time from addProcessor() to configuration ready
it('should configure our processor efficiently', () => {
  cy.robustAddProcessor('JWTTokenAuthenticator').then((processorId) => {
    if (processorId) {
      const configStart = Date.now();
      
      const config = { 'JWKS URL': 'https://test.com/jwks' };
      cy.robustConfigureProcessor(processorId, { properties: config }).then(() => {
        const configTime = Date.now() - configStart;
        cy.log(`✅ Configuration completed in ${configTime}ms`);
        
        // Optimize: Our processor initialization, not NiFi navigation
        expect(configTime).to.be.lessThan(10000);
      });
    }
  });
});
```

#### Avoid NiFi Performance Testing
```javascript
// ❌ Don't measure NiFi navigation speed
cy.measureNavigationSpeed();        // Wrong focus

// ❌ Don't test NiFi canvas rendering performance  
cy.benchmarkCanvasRendering();      // Wrong focus

// ❌ Don't benchmark NiFi UI responsiveness
cy.measureUIResponsiveness();       // Wrong focus
```

### Recipe: Success Metrics
**Goal**: Define what success looks like for our custom processor testing

#### Custom Processor Testing Success
```javascript
describe('Success Metrics for Custom Processors', () => {
  it('should validate JWT tokens correctly', () => {
    // Success: Our JWT validation logic works correctly
    cy.robustAddProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      if (processorId) {
        const validToken = generateTestJWT();
        cy.testProcessorWithInput(processorId, validToken)
          .should('result', 'success');
        cy.log('✅ JWT validation logic success');
      }
    });
  });

  it('should handle multi-issuer configuration properly', () => {
    // Success: Our multi-issuer configuration functions properly
    cy.robustAddProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      if (processorId) {
        const multiIssuerConfig = {
          'Issuer 1 Name': 'issuer1',
          'Issuer 1 URL': 'https://issuer1.com',
          'Issuer 2 Name': 'issuer2', 
          'Issuer 2 URL': 'https://issuer2.com'
        };
        cy.robustConfigureProcessor(processorId, { properties: multiIssuerConfig });
        cy.verifyProcessorProperties(processorId, multiIssuerConfig);
        cy.log('✅ Multi-issuer configuration success');
      }
    });
  });

  it('should handle errors as expected', () => {
    // Success: Our error handling behaves as expected
    cy.robustAddProcessor('JWTTokenAuthenticator').then((processorId) => {
      if (processorId) {
        const invalidConfig = { 'JWKS URL': 'invalid-url' };
        cy.robustConfigureProcessor(processorId, { properties: invalidConfig });
        cy.verifyProcessorValidationErrors(processorId);
        cy.log('✅ Error handling success');
      }
    });
  });

  it('should enforce validation rules correctly', () => {
    // Success: Our validation rules are enforced correctly
    cy.robustAddProcessor('JWTTokenAuthenticator').then((processorId) => {
      if (processorId) {
        // Test our validation logic enforcement
        cy.verifyProcessorProperties(processorId, expectedProperties);
        cy.log('✅ Validation rules success');
      }
    });
  });
});
```

#### Platform Usage Success
```javascript
describe('Platform Usage Success Metrics', () => {
  it('should run tests reliably (90%+ success rate)', () => {
    // Target: Tests run reliably with 90%+ success rate
    let successCount = 0;
    const totalRuns = 10;
    
    for (let i = 0; i < totalRuns; i++) {
      cy.robustAddProcessor('JWTTokenAuthenticator').then((processorId) => {
        if (processorId) {
          successCount++;
          cy.log(`✅ Test run ${i + 1} successful`);
        }
      });
    }
    
    // Verify reliability target met
    cy.then(() => {
      const successRate = (successCount / totalRuns) * 100;
      expect(successRate).to.be.greaterThan(90);
      cy.log(`✅ Success rate: ${successRate}%`);
    });
  });

  it('should complete setup in reasonable time (< 15 seconds)', () => {
    // Target: Setup time is reasonable (< 15 seconds per test)
    const startTime = Date.now();
    
    cy.enhancedAuthentication('admin', 'adminadminadmin');
    cy.navigateToCanvas();
    cy.robustAddProcessor('JWTTokenAuthenticator').then((processorId) => {
      if (processorId) {
        const totalTime = Date.now() - startTime;
        expect(totalTime).to.be.lessThan(15000);
        cy.log(`✅ Setup completed in ${totalTime}ms`);
      }
    });
  });

  it('should cleanup consistently', () => {
    // Target: Cleanup works consistently
    cy.robustAddProcessor('JWTTokenAuthenticator').then((processorId) => {
      if (processorId) {
        cy.robustCleanupProcessors();
        cy.verifyCanvasClean();
        cy.log('✅ Cleanup successful');
      }
    });
  });

  it('should maintain test isolation', () => {
    // Target: Tests are isolated and reproducible
    cy.ensureTestIsolation();
    cy.robustAddProcessor('JWTTokenAuthenticator').then((processorId) => {
      if (processorId) {
        cy.log('✅ Test isolation maintained');
      }
    });
  });
});
```

This minimal viable setup ensures we focus on testing our custom processor logic effectively while using NiFi as a stable platform for that testing.
