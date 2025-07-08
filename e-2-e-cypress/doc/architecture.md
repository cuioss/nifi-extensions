# Technical Architecture

This document covers the technical architecture, infrastructure, and implementation details of the NiFi integration testing framework.

## System Architecture

### Infrastructure Overview
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Cypress       │────│   Docker Host    │────│   Test Data     │
│   Test Runner   │    │                  │    │   Fixtures      │
└─────────────────┘    │  ┌─────────────┐ │    └─────────────────┘
                       │  │    NiFi     │ │
                       │  │   2.4.0     │ │
                       │  └─────────────┘ │
                       │  ┌─────────────┐ │
                       │  │  Keycloak   │ │
                       │  │   OIDC      │ │
                       │  └─────────────┘ │
                       └──────────────────┘
```

### Component Stack
- **Test Framework**: Cypress 14.4.1 with custom commands
- **Target Application**: NiFi 2.4.0 with Angular UI
- **Authentication**: Keycloak OIDC
- **Infrastructure**: Docker with docker-compose
- **Build System**: Maven with Node.js integration
- **CI/CD**: GitHub Actions with automated testing

## Infrastructure Details

### Docker Environment
The testing environment uses containerized infrastructure for consistency:

```yaml
# docker-compose.yml structure
services:
  nifi:
    image: apache/nifi:2.4.0
    ports:
      - "9094:8080"  # NiFi UI
      - "9085:8085"  # NiFi API
    volumes:
      - ./target/nifi-deploy:/opt/nifi/nifi-current/lib/nifi-deploy
    environment:
      - NIFI_WEB_HTTPS_PORT=
      - NIFI_WEB_HTTP_PORT=8080
      - NIFI_SECURITY_USER_OIDC_DISCOVERY_URL=http://keycloak:8080/realms/nifi
      
  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    ports:
      - "9080:8080"
    environment:
      - KEYCLOAK_ADMIN=admin
      - KC_HTTP_ENABLED=true
```

### Network Configuration
- **NiFi UI**: `https://localhost:9095/nifi/`
- **NiFi API**: `http://localhost:9085/nifi-api/`
- **Keycloak**: `http://localhost:9080/`
- **Health Check**: `https://localhost:9095/nifi-api/system-diagnostics`

### Authentication Flow
```
User → Cypress → Direct Form Login → NiFi Session → NiFi Access
(Note: Removed cy.session for improved reliability)
```

## Testing Framework Architecture

### Core Components

#### 1. Helper-Based Architecture
```
cypress/support/
├── auth-helper.js               # Authentication management
├── navigation-helper.js         # Page navigation and detection
├── processor-helper.js          # Processor lifecycle operations
├── constants.js                 # Shared selectors and constants
├── test-helpers.js              # Common test utilities
└── utils.js                     # Utility functions
```

#### 2. Constants and Configuration
```javascript
// cypress/support/constants.js - Current Implementation
export const SELECTORS = {
  USERNAME_INPUT: 'input[type="text"], input[id*="username"], input[name="username"]',
  PASSWORD_INPUT: 'input[type="password"], input[id*="password"], input[name="password"]',
  LOGIN_BUTTON: 'button[type="submit"], input[type="submit"], button:contains("Log")',
  ADD_PROCESSOR_BUTTON: '.icon-drop',
  CANVAS_AREA: 'g.canvas-background'
};

export const TIMEOUTS = {
  DEFAULT: 10000,
  LONG: 30000,
  AUTHENTICATION: 15000,
  PROCESSOR_LOAD: 20000
};
```

### Element Discovery Strategy

The framework implements a multi-strategy approach for robust element discovery:

```javascript
// Multi-strategy element discovery
const discoveryStrategies = [
  // Strategy 1: Data attributes (preferred)
  `[data-testid="${targetId}"]`,
  
  // Strategy 2: Semantic selectors
  `[aria-label*="${targetLabel}"]`,
  
  // Strategy 3: Content-based
  `:contains("${targetText}")`,
  
  // Strategy 4: Angular-specific
  `mat-${componentType}[id*="${targetId}"]`
];

function findElementRobustly(selectors, options = {}) {
  return cy.get('body').then(($body) => {
    for (const selector of selectors) {
      const $element = $body.find(selector);
      if ($element.length > 0) {
        return cy.wrap($element);
      }
    }
    throw new Error(`Element not found with any strategy`);
  });
}
```

### Error Handling Architecture

#### Retry Strategy
```javascript
// Smart retry with exponential backoff
Cypress.Commands.add('robustAction', (action, options = {}) => {
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 1000;
  
  function attemptAction(attempt = 0) {
    return cy.wrap(null).then(() => {
      try {
        return action();
      } catch (error) {
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          cy.wait(delay);
          return attemptAction(attempt + 1);
        }
        throw error;
      }
    });
  }
  
  return attemptAction();
});
```

#### Graceful Degradation
```javascript
// Fallback strategies for UI changes
function navigateWithFallback(primarySelector, fallbackSelectors) {
  return cy.get('body').then(($body) => {
    if ($body.find(primarySelector).length > 0) {
      return cy.get(primarySelector);
    }
    
    for (const fallback of fallbackSelectors) {
      if ($body.find(fallback).length > 0) {
        cy.log(`Using fallback selector: ${fallback}`);
        return cy.get(fallback);
      }
    }
    
    throw new Error('No working selector found');
  });
}
```

## Performance Optimizations

### Selector Optimization
- **Data Attributes**: Preferred for stability
- **Caching**: Element references cached when possible
- **Batch Operations**: Multiple actions combined
- **Smart Waiting**: Condition-based waits instead of fixed delays

### Resource Management
```javascript
// Memory-efficient test execution
beforeEach(() => {
  // Clear previous state
  cy.clearCookies();
  cy.clearLocalStorage();
  
  // Optimize Cypress resources
  cy.window().then((win) => {
    win.sessionStorage.clear();
  });
});

afterEach(() => {
  // Cleanup after each test
  cy.task('cleanupProcessors');
  cy.task('resetNiFiState');
});
```

### Network Optimization
```javascript
// Intercept and optimize API calls
beforeEach(() => {
  // Cache static resources
  cy.intercept('GET', '/nifi-api/system-diagnostics', { fixture: 'system-diagnostics.json' });
  
  // Monitor critical API calls
  cy.intercept('POST', '/nifi-api/processors').as('createProcessor');
  cy.intercept('PUT', '/nifi-api/processors/*').as('updateProcessor');
});
```

## Build Integration

### Maven Integration
```xml
<!-- pom.xml configuration -->
<plugin>
  <groupId>com.github.eirslett</groupId>
  <artifactId>frontend-maven-plugin</artifactId>
  <configuration>
    <nodeVersion>v20.x.x</nodeVersion>
    <npmVersion>10.x.x</npmVersion>
  </configuration>
  <executions>
    <execution>
      <id>install-node-and-npm</id>
      <goals><goal>install-node-and-npm</goal></goals>
    </execution>
    <execution>
      <id>npm-install</id>
      <goals><goal>npm</goal></goals>
      <configuration>
        <arguments>install</arguments>
      </configuration>
    </execution>
    <execution>
      <id>cypress-tests</id>
      <goals><goal>npm</goal></goals>
      <configuration>
        <arguments>test</arguments>
      </configuration>
    </execution>
  </executions>
</plugin>
```

### Profile Configuration
```xml
<!-- Test execution profiles -->
<profiles>
  <profile>
    <id>selftests</id>
    <properties>
      <cypress.spec>cypress/e2e/selftests/**/*.cy.js</cypress.spec>
    </properties>
  </profile>
  <profile>
    <id>ui-tests</id>
    <properties>
      <cypress.spec>cypress/e2e/**/*.cy.js</cypress.spec>
      <docker.autostart>true</docker.autostart>
    </properties>
  </profile>
</profiles>
```

## Code Quality Framework

### ESLint Configuration
Following [CUI JavaScript Standards](https://github.com/cuioss/cui-llm-rules/tree/main/standards/javascript):

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:cypress/recommended'
  ],
  rules: {
    'cypress/no-unnecessary-waiting': 'error',
    'cypress/assertion-before-screenshot': 'warn',
    'no-console': 'warn',
    'complexity': ['error', 10],
    'max-depth': ['error', 3],
    'max-lines-per-function': ['error', 50]
  },
  overrides: [
    {
      files: ['cypress/support/commands/**/*.js'],
      rules: {
        'max-lines-per-function': ['error', 100] // Commands can be longer
      }
    }
  ]
};
```

### Quality Metrics
- **ESLint Warnings**: 0 (Zero-warning policy)
- **Cognitive Complexity**: <10 per function
- **Max Function Length**: 50 lines (100 for commands)
- **Max Nesting Depth**: 3 levels

## Security Considerations

### Test Environment Security
- **Isolated Environment**: Docker containers with no production data
- **Test Credentials**: Dedicated test accounts with minimal privileges
- **Network Isolation**: Local Docker network with no external access
- **Data Protection**: No sensitive data in test fixtures

### Authentication Security
```javascript
// Current implementation - Direct form login
Cypress.Commands.add('loginNiFi', (username = 'testUser', password = 'drowssap') => {
  cy.log(`🔐 Logging into NiFi as ${username}`);
  
  cy.get('input[type="text"], input[id*="username"], input[name="username"]')
    .should('be.visible')
    .clear()
    .type(username);
    
  cy.get('input[type="password"], input[id*="password"], input[name="password"]')
    .should('be.visible')
    .clear()
    .type(password, { log: false });
    
  cy.get('button[type="submit"], input[type="submit"], button').contains(/log\s*in/i)
    .click();
});
```

## Monitoring and Observability

### Test Metrics Collection
```javascript
// Performance monitoring
Cypress.Commands.add('measurePerformance', (operation) => {
  const startTime = performance.now();
  
  return cy.wrap(operation()).then((result) => {
    const duration = performance.now() - startTime;
    
    cy.task('logMetric', {
      operation: operation.name,
      duration,
      timestamp: new Date().toISOString()
    });
    
    return result;
  });
});
```

### Error Tracking
```javascript
// Comprehensive error logging
Cypress.on('fail', (error) => {
  cy.task('logError', {
    message: error.message,
    stack: error.stack,
    test: Cypress.currentTest.title,
    timestamp: new Date().toISOString()
  });
});
```

### Health Checks
```javascript
// Infrastructure health monitoring
before(() => {
  cy.request('GET', '/nifi-api/system-diagnostics')
    .then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.systemDiagnostics.aggregateSnapshot.totalFlowFiles).to.be.a('number');
    });
});
```

## Scalability Considerations

### Parallel Execution
- **Test Isolation**: Each test can run independently
- **Resource Sharing**: Shared Docker environment
- **Data Management**: Unique test data per thread
- **Result Aggregation**: Combined reporting across parallel runs

### Container Scaling
```bash
# Scale containers for load testing
docker-compose up --scale nifi=2 --scale keycloak=1

# Load balancer configuration for multiple NiFi instances
```

### CI/CD Optimization
- **Container Caching**: Docker layer caching
- **Dependency Caching**: npm and Maven caching
- **Selective Testing**: Run only affected tests
- **Fast Feedback**: Critical path tests first

---

*For setup instructions, see [Setup Guide](./setup-guide.md). For testing patterns, see [Testing Patterns](./testing-patterns.md).*
