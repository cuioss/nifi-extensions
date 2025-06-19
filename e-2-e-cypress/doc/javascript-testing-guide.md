# JavaScript Testing Implementation

This guide covers JavaScript testing implementation for UI components of the MultiIssuerJWTTokenAuthenticator processor, including security patterns and best practices.

## Requirements Overview

### Testing Requirements
Based on [Testing Core Standards](https://github.com/cuioss/cui-llm-rules/tree/main/standards/testing), this implementation provides:

- **Unit Test Coverage**: ≥90% for all JavaScript components
- **Security Testing**: XSS prevention and input validation
- **Integration Testing**: Component interactions and API flows
- **Internationalization**: Multi-language UI support
- **Performance Standards**: Efficient test execution

### UI Components Under Test

1. **JWKS Endpoint Test Button** - Validates connectivity to JWKS endpoints
2. **Token Verification Interface** - Tests JWT tokens against processor configuration
3. **Metrics Display** - Real-time security event metrics and statistics

## Testing Framework Setup

### Core Dependencies
```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "@testing-library/dom": "^9.3.3",
    "@testing-library/user-event": "^14.5.1",
    "msw": "^2.0.0",
    "jsdom": "^23.0.0",
    "eslint": "^8.54.0"
  }
}
```

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.js'],
  collectCoverageFrom: [
    'src/main/javascript/**/*.js',
    '!src/main/javascript/vendor/**',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  testMatch: [
    '<rootDir>/src/test/javascript/**/*.test.js'
  ]
};
```

### Test Setup
```javascript
// src/test/setup.js
import { configure } from '@testing-library/dom';
import { server } from './mocks/server';

// Configure Testing Library
configure({ testIdAttribute: 'data-testid' });

// Mock Service Worker setup
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Global test utilities
global.createMockElement = (tag, attributes = {}) => {
  const element = document.createElement(tag);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
};
```

## Component Testing Patterns

### 1. JWKS Validator Component

```javascript
// src/test/javascript/jwks-validator.test.js
import { JWKSValidator } from '../../main/javascript/components/jwks-validator';
import { screen, fireEvent, waitFor } from '@testing-library/dom';

describe('JWKSValidator Component', () => {
  let container;
  let validator;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = `
      <div data-testid="jwks-validator">
        <input data-testid="jwks-url" type="url" />
        <button data-testid="test-jwks" type="button">Test JWKS</button>
        <div data-testid="validation-result"></div>
      </div>
    `;
    document.body.appendChild(container);
    
    validator = new JWKSValidator({
      container: container.querySelector('[data-testid="jwks-validator"]')
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('URL Validation', () => {
    it('should validate HTTPS URLs', async () => {
      const urlInput = screen.getByTestId('jwks-url');
      const testButton = screen.getByTestId('test-jwks');

      fireEvent.change(urlInput, {
        target: { value: 'https://example.com/.well-known/jwks.json' }
      });
      fireEvent.click(testButton);

      await waitFor(() => {
        const result = screen.getByTestId('validation-result');
        expect(result).toHaveTextContent('Valid JWKS endpoint');
      });
    });

    it('should reject HTTP URLs in production', async () => {
      // Set production environment
      process.env.NODE_ENV = 'production';
      
      const urlInput = screen.getByTestId('jwks-url');
      fireEvent.change(urlInput, {
        target: { value: 'http://insecure.example.com/jwks.json' }
      });

      await waitFor(() => {
        const result = screen.getByTestId('validation-result');
        expect(result).toHaveTextContent('HTTPS required in production');
      });
    });
  });

  describe('Security Testing', () => {
    it('should prevent XSS in URL display', async () => {
      const maliciousUrl = 'https://example.com/jwks.json<script>alert("xss")</script>';
      const urlInput = screen.getByTestId('jwks-url');
      
      fireEvent.change(urlInput, { target: { value: maliciousUrl } });
      
      // Verify XSS prevention
      const displayedValue = urlInput.value;
      expect(displayedValue).not.toContain('<script>');
      expect(displayedValue).toContain('&lt;script&gt;');
    });

    it('should sanitize error messages', async () => {
      const maliciousInput = '<img src=x onerror=alert("xss")>';
      
      validator.displayError(maliciousInput);
      
      const result = screen.getByTestId('validation-result');
      expect(result.innerHTML).not.toContain('<img');
      expect(result.textContent).toContain('&lt;img');
    });
  });
});
```

### 2. Token Verification Component

```javascript
// src/test/javascript/token-verifier.test.js
import { TokenVerifier } from '../../main/javascript/components/token-verifier';
import { server } from '../mocks/server';
import { rest } from 'msw';

describe('TokenVerifier Component', () => {
  let verifier;
  let container;

  beforeEach(() => {
    container = createMockElement('div', { 'data-testid': 'token-verifier' });
    container.innerHTML = `
      <textarea data-testid="token-input" placeholder="Enter JWT token"></textarea>
      <button data-testid="verify-token">Verify Token</button>
      <div data-testid="verification-result"></div>
    `;
    document.body.appendChild(container);
    
    verifier = new TokenVerifier({
      container,
      apiEndpoint: '/nifi-api/processors/jwt-validator/verify'
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Token Validation', () => {
    it('should verify valid JWT tokens', async () => {
      const validToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...';
      
      // Mock successful verification
      server.use(
        rest.post('/nifi-api/processors/jwt-validator/verify', (req, res, ctx) => {
          return res(ctx.json({
            valid: true,
            issuer: 'https://example.com',
            subject: 'user123',
            claims: { exp: Date.now() / 1000 + 3600 }
          }));
        })
      );

      const tokenInput = screen.getByTestId('token-input');
      const verifyButton = screen.getByTestId('verify-token');

      fireEvent.change(tokenInput, { target: { value: validToken } });
      fireEvent.click(verifyButton);

      await waitFor(() => {
        const result = screen.getByTestId('verification-result');
        expect(result).toHaveTextContent('Token is valid');
        expect(result).toHaveTextContent('Issuer: https://example.com');
      });
    });

    it('should handle invalid tokens gracefully', async () => {
      const invalidToken = 'invalid.token.here';
      
      server.use(
        rest.post('/nifi-api/processors/jwt-validator/verify', (req, res, ctx) => {
          return res(ctx.status(400), ctx.json({
            valid: false,
            errorCode: 'MALFORMED_TOKEN',
            errorMessage: 'Token format is invalid'
          }));
        })
      );

      const tokenInput = screen.getByTestId('token-input');
      const verifyButton = screen.getByTestId('verify-token');

      fireEvent.change(tokenInput, { target: { value: invalidToken } });
      fireEvent.click(verifyButton);

      await waitFor(() => {
        const result = screen.getByTestId('verification-result');
        expect(result).toHaveTextContent('Token is invalid');
        expect(result).toHaveTextContent('MALFORMED_TOKEN');
      });
    });
  });

  describe('Security Testing', () => {
    it('should not log sensitive token data', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const sensitiveToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.sensitive.data';

      const tokenInput = screen.getByTestId('token-input');
      fireEvent.change(tokenInput, { target: { value: sensitiveToken } });

      // Verify no sensitive data in console
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(sensitiveToken)
      );

      consoleSpy.mockRestore();
    });

    it('should sanitize token display', () => {
      const tokenWithHtml = 'token<script>alert("xss")</script>data';
      
      verifier.displayToken(tokenWithHtml);
      
      const result = screen.getByTestId('verification-result');
      expect(result.innerHTML).not.toContain('<script>');
    });
  });
});
```

### 3. Metrics Display Component

```javascript
// src/test/javascript/metrics-display.test.js
import { MetricsDisplay } from '../../main/javascript/components/metrics-display';

describe('MetricsDisplay Component', () => {
  let metricsDisplay;
  let container;

  beforeEach(() => {
    container = createMockElement('div', { 'data-testid': 'metrics-display' });
    document.body.appendChild(container);
    
    metricsDisplay = new MetricsDisplay({
      container,
      refreshInterval: 1000
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
    metricsDisplay.destroy();
  });

  describe('Metrics Rendering', () => {
    it('should display security metrics correctly', () => {
      const mockMetrics = {
        totalProcessed: 1000,
        validTokens: 950,
        invalidTokens: 50,
        errorBreakdown: {
          malformed: 20,
          expired: 15,
          invalidSignature: 10,
          missingClaims: 5
        }
      };

      metricsDisplay.updateMetrics(mockMetrics);

      expect(container).toHaveTextContent('Total Processed: 1,000');
      expect(container).toHaveTextContent('Valid: 950 (95.0%)');
      expect(container).toHaveTextContent('Invalid: 50 (5.0%)');
    });

    it('should handle zero metrics gracefully', () => {
      const emptyMetrics = {
        totalProcessed: 0,
        validTokens: 0,
        invalidTokens: 0,
        errorBreakdown: {}
      };

      metricsDisplay.updateMetrics(emptyMetrics);

      expect(container).toHaveTextContent('No data available');
    });
  });

  describe('Real-time Updates', () => {
    it('should refresh metrics automatically', async () => {
      const fetchSpy = jest.spyOn(metricsDisplay, 'fetchMetrics');
      
      metricsDisplay.startAutoRefresh();
      
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      
      metricsDisplay.stopAutoRefresh();
    });
  });
});
```

## Security Testing Patterns

### XSS Prevention Testing
```javascript
describe('XSS Prevention', () => {
  const xssPayloads = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert("xss")>',
    'javascript:alert("xss")',
    '<svg onload=alert("xss")>',
    '"><script>alert("xss")</script>'
  ];

  xssPayloads.forEach(payload => {
    it(`should sanitize XSS payload: ${payload.substring(0, 20)}`, () => {
      const sanitized = sanitizeInput(payload);
      expect(sanitized).not.toMatch(/<script/i);
      expect(sanitized).not.toMatch(/javascript:/i);
      expect(sanitized).not.toMatch(/on\w+=/i);
    });
  });
});
```

### Input Validation Testing
```javascript
describe('Input Validation', () => {
  it('should validate JWT token format', () => {
    const validTokens = [
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.signature',
    ];
    
    const invalidTokens = [
      'invalid-token',
      'too.few.parts',
      'too.many.parts.here.invalid',
      '',
      null,
      undefined
    ];

    validTokens.forEach(token => {
      expect(isValidJWTFormat(token)).toBe(true);
    });

    invalidTokens.forEach(token => {
      expect(isValidJWTFormat(token)).toBe(false);
    });
  });

  it('should validate JWKS URL format', () => {
    const validUrls = [
      'https://example.com/.well-known/jwks.json',
      'https://auth.example.com/jwks',
      'https://keycloak.example.com/realms/test/protocol/openid_connect/certs'
    ];

    const invalidUrls = [
      'http://insecure.example.com/jwks.json', // HTTP in production
      'ftp://example.com/jwks.json',
      'javascript:alert("xss")',
      'data:text/html,<script>alert("xss")</script>',
      ''
    ];

    validUrls.forEach(url => {
      expect(isValidJWKSUrl(url)).toBe(true);
    });

    invalidUrls.forEach(url => {
      expect(isValidJWKSUrl(url)).toBe(false);
    });
  });
});
```

## Internationalization Testing

### Resource Bundle Testing
```javascript
// src/test/javascript/i18n.test.js
import { I18n } from '../../main/javascript/utils/i18n';

describe('Internationalization', () => {
  let i18n;

  beforeEach(() => {
    i18n = new I18n();
  });

  describe('Resource Loading', () => {
    it('should load English resources by default', async () => {
      await i18n.loadResources('en');
      
      expect(i18n.t('jwks.test.button')).toBe('Test JWKS');
      expect(i18n.t('token.verify.button')).toBe('Verify Token');
    });

    it('should load German resources', async () => {
      await i18n.loadResources('de');
      
      expect(i18n.t('jwks.test.button')).toBe('JWKS Testen');
      expect(i18n.t('token.verify.button')).toBe('Token Überprüfen');
    });

    it('should fallback to English for missing translations', async () => {
      await i18n.loadResources('de');
      
      // Assume this key only exists in English
      expect(i18n.t('error.unknown')).toBe('Unknown error');
    });
  });

  describe('Pluralization', () => {
    it('should handle English pluralization', async () => {
      await i18n.loadResources('en');
      
      expect(i18n.t('tokens.processed', { count: 0 })).toBe('0 tokens processed');
      expect(i18n.t('tokens.processed', { count: 1 })).toBe('1 token processed');
      expect(i18n.t('tokens.processed', { count: 5 })).toBe('5 tokens processed');
    });

    it('should handle German pluralization', async () => {
      await i18n.loadResources('de');
      
      expect(i18n.t('tokens.processed', { count: 0 })).toBe('0 Token verarbeitet');
      expect(i18n.t('tokens.processed', { count: 1 })).toBe('1 Token verarbeitet');
      expect(i18n.t('tokens.processed', { count: 5 })).toBe('5 Token verarbeitet');
    });
  });
});
```

## API Integration Testing

### Mock Service Worker Setup
```javascript
// src/test/mocks/handlers.js
import { rest } from 'msw';

export const handlers = [
  // JWKS endpoint testing
  rest.get('https://example.com/.well-known/jwks.json', (req, res, ctx) => {
    return res(ctx.json({
      keys: [{
        kty: 'RSA',
        use: 'sig',
        kid: 'test-key-id',
        n: 'mock-modulus',
        e: 'AQAB'
      }]
    }));
  }),

  // Token verification endpoint
  rest.post('/nifi-api/processors/*/verify-token', (req, res, ctx) => {
    const { token } = req.body;
    
    if (token === 'valid-token') {
      return res(ctx.json({
        valid: true,
        claims: {
          sub: 'user123',
          iss: 'https://example.com',
          exp: Date.now() / 1000 + 3600
        }
      }));
    }
    
    return res(ctx.status(400), ctx.json({
      valid: false,
      errorCode: 'INVALID_TOKEN'
    }));
  }),

  // Metrics endpoint
  rest.get('/nifi-api/processors/*/metrics', (req, res, ctx) => {
    return res(ctx.json({
      totalProcessed: 1000,
      validTokens: 950,
      invalidTokens: 50,
      errorBreakdown: {
        malformed: 20,
        expired: 15,
        invalidSignature: 10,
        missingClaims: 5
      }
    }));
  })
];
```

## Performance Testing

### Component Performance
```javascript
describe('Performance Testing', () => {
  it('should render metrics within performance budget', async () => {
    const startTime = performance.now();
    
    const metricsDisplay = new MetricsDisplay({ container });
    await metricsDisplay.updateMetrics(largeMockDataset);
    
    const renderTime = performance.now() - startTime;
    
    // Should render within 100ms
    expect(renderTime).toBeLessThan(100);
  });

  it('should handle large token verification efficiently', async () => {
    const largeToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.' + 
                     'very'.repeat(1000) + 'large'.repeat(1000) + 'payload.' +
                     'signature'.repeat(100);
    
    const startTime = performance.now();
    const result = await tokenVerifier.verifyToken(largeToken);
    const processingTime = performance.now() - startTime;
    
    // Should process within 500ms
    expect(processingTime).toBeLessThan(500);
  });
});
```

## Quality Standards Compliance

### ESLint Configuration
Following [CUI JavaScript Standards](https://github.com/cuioss/cui-llm-rules/tree/main/standards/javascript):

```javascript
// .eslintrc.test.js
module.exports = {
  extends: ['../../../.eslintrc.js'],
  env: {
    jest: true,
    node: true
  },
  rules: {
    'max-lines-per-function': ['error', 100], // Tests can be longer
    'no-magic-numbers': 'off', // Test data can use magic numbers
  }
};
```

### Coverage Reports
```bash
# Generate coverage report
npm run test:coverage

# Coverage thresholds (jest.config.js)
coverageThreshold: {
  global: {
    branches: 90,
    functions: 90,
    lines: 90,
    statements: 90
  },
  './src/main/javascript/components/': {
    branches: 95,
    functions: 95,
    lines: 95,
    statements: 95
  }
}
```

## CI/CD Integration

### Maven Integration
```xml
<!-- Execute JavaScript tests in Maven lifecycle -->
<plugin>
  <groupId>com.github.eirslett</groupId>
  <artifactId>frontend-maven-plugin</artifactId>
  <executions>
    <execution>
      <id>javascript-tests</id>
      <goals><goal>npm</goal></goals>
      <phase>test</phase>
      <configuration>
        <arguments>run test:ci</arguments>
      </configuration>
    </execution>
  </executions>
</plugin>
```

### Package.json Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --coverage --watchAll=false --reporters=default --reporters=jest-junit"
  }
}
```

---

*For setup instructions, see [Setup Guide](./setup-guide.md). For testing patterns, see [Testing Patterns](./testing-patterns.md).*

* **Multi-Language Support** - All UI strings externalized and translatable
* **Locale-Specific Rendering** - Proper display across different languages
* **RTL Language Support** - Right-to-left language compatibility where applicable
* **Format Localization** - Dates, numbers, and currencies formatted per locale

## Overview

The JavaScript testing infrastructure supports comprehensive testing of UI components like the JWKS Endpoint Test Button and Token Verification Interface, ensuring robust functionality and security compliance.

## Testing Tools and Framework

### Core Technologies

The JavaScript testing infrastructure uses modern, industry-standard tools:

* **Jest** - JavaScript testing framework for running tests and providing assertions
* **Testing Library** - DOM testing utilities for simulating user interactions
* **Mock Service Worker (MSW)** - API mocking for simulating backend responses
* **ESLint** - JavaScript linting tool with security-focused rules (see centralized standards)
* **Istanbul** - Code coverage reporting tool integrated with Jest

### Maven Integration

JavaScript testing is fully integrated into the Maven build process using the `frontend-maven-plugin`:

```xml
<plugin>
    <groupId>com.github.eirslett</groupId>
    <artifactId>frontend-maven-plugin</artifactId>
    <version>${version.frontend-maven-plugin}</version>
    <configuration>
        <nodeVersion>${version.nodejs}</nodeVersion>
        <installDirectory>target</installDirectory>
    </configuration>
    <executions>
        <execution>
            <id>install-node-and-npm</id>
            <goals>
                <goal>install-node-and-npm</goal>
            </goals>
        </execution>
        <execution>
            <id>npm-install</id>
            <goals>
                <goal>npm</goal>
            </goals>
            <configuration>
                <arguments>install</arguments>
            </configuration>
        </execution>
        <execution>
            <id>npm-test</id>
            <goals>
                <goal>npm</goal>
            </goals>
            <phase>test</phase>
            <configuration>
                <arguments>test</arguments>
            </configuration>
        </execution>
    </executions>
</plugin>
```

The Maven integration ensures JavaScript tests are executed as part of regular build cycles and gated CI/CD pipelines.

## Test Structure and Organization

### Directory Organization

JavaScript tests follow a structured organization pattern:

```
src/main/webapp/js/
├── components/
│   ├── jwksValidator.js
│   └── tokenVerifier.js
├── services/
│   ├── apiClient.js
│   └── tokenParser.js
└── utils/
    └── formatters.js

src/test/js/
├── components/
│   ├── jwksValidator.test.js
│   └── tokenVerifier.test.js
├── services/
│   ├── apiClient.test.js
│   └── tokenParser.test.js
└── utils/
    └── formatters.test.js
```

This organization ensures tests are positioned logically beside their corresponding implementation files.

### Test Types

#### Unit Tests

Unit tests focus on isolating JavaScript functions and components:

* Test component rendering with various props
* Verify state changes and event handling
* Mock external dependencies (API calls, DOM API)
* Test UI feedback for different scenarios

#### Integration Tests

Integration tests verify component interactions and API integrations:

* Test interactions between components
* Test API request/response flows with mock server
* Verify handling of various response statuses and payloads

#### End-to-End Tests

Limited end-to-end tests verify critical user flows:

* Token verification flow from input to displayed results
* JWKS verification flow from URL input to connectivity verification
* Error handling and recovery paths

### Code Coverage Standards

Rigorous code coverage standards ensure thorough testing:

```javascript
// jest.config.js
module.exports = {
  collectCoverage: true,
  coverageDirectory: 'target/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
```

Coverage reports are generated in multiple formats for integration with CI tools and dashboards.

## Component-Specific Testing

### JWKS Endpoint Test Button

#### Testing Strategy

The JWKS Test Button component is tested for:

1. Initial rendering with proper button text and state
2. Loading state display during endpoint verification
3. Success state display with confirmation message
4. Error state display with detailed error messages
5. Edge cases like network failures, timeouts, and CORS issues

#### Key Test Cases

```javascript
/**
 * JWKS Endpoint Test Button test suite
 */
describe('JwksEndpointTestButton', () => {
  let container, button, resultContainer;
  
  // Set up DOM and mocks
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Initialize component
    const jwksUrl = 'https://auth.example.com/.well-known/jwks.json';
    JwksEndpointTestButton.init(container, jwksUrl, () => {});
    
    button = container.querySelector('.verify-jwks-button');
    resultContainer = container.querySelector('.verification-result');
  });
  
  afterEach(() => {
    document.body.removeChild(container);
    jest.restoreAllMocks();
  });
  
  test('should show loading state when verifying endpoint', async () => {
    // Mock fetch to return a promise that doesn't resolve immediately
    global.fetch = jest.fn(() => new Promise(resolve => {
      setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ keys: [] })
      }), 100);
    }));
    
    // Click the verify button
    fireEvent.click(button);
    
    // Assert loading state is displayed
    expect(resultContainer.innerHTML).toContain('fa-spinner');
  });
  
  test('should show success message when endpoint is valid', async () => {
    // Mock successful response
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ keys: [] })
    });
    
    // Click the verify button
    fireEvent.click(button);
    await waitFor(() => {
      expect(resultContainer.innerHTML).toContain('fa-check');
      expect(resultContainer.innerHTML).toContain('Connection successful');
    });
  });
  
  test('should show error message when endpoint returns error', async () => {
    // Mock error response
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });
    
    // Click the verify button
    fireEvent.click(button);
    await waitFor(() => {
      expect(resultContainer.innerHTML).toContain('fa-times');
      expect(resultContainer.innerHTML).toContain('Not Found');
    });
  });
});
```

#### API Mocking

API responses are mocked for different scenarios:

```javascript
// Mock successful JWKS response
const mockSuccessResponse = {
  keys: [
    {
      kty: "RSA",
      kid: "key1",
      use: "sig",
      alg: "RS256",
      n: "base64-encoded-modulus",
      e: "AQAB"
    }
  ]
};

// Mock error response
const mockErrorResponse = {
  error: "invalid_request",
  error_description: "Invalid JWKS endpoint"
};
```

### Token Verification Interface

#### Testing Strategy

The Token Verification Interface is tested for:

1. Token input handling and validation
2. Visual feedback during verification process
3. Proper display of token contents and claims
4. Error handling for invalid, expired, and malformed tokens
5. Handling of various token formats and structures

#### Key Test Cases

```javascript
/**
 * Token Verification Interface test suite
 */
describe('TokenVerificationInterface', () => {
  let container, tokenInput, verifyButton, resultContainer;
  
  // Set up DOM and mocks
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Initialize component with processor ID
    TokenVerificationInterface.init(container, 'processor123', () => {});
    
    tokenInput = container.querySelector('.token-input');
    verifyButton = container.querySelector('.verify-token-button');
    resultContainer = container.querySelector('.verification-result');
  });
  
  afterEach(() => {
    document.body.removeChild(container);
    jest.restoreAllMocks();
  });
  
  test('should validate token and display claims for valid token', async () => {
    // Mock API success response
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        valid: true,
        issuer: "https://auth.example.com",
        subject: "user123",
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        claims: {
          sub: "user123",
          iss: "https://auth.example.com",
          exp: Math.floor(Date.now() / 1000) + 3600,
          aud: "api-gateway",
          roles: ["admin", "user"]
        }
      })
    });
    
    // Set token input value
    fireEvent.change(tokenInput, { target: { value: 'eyJhbGciOiJIUzI1NiJ9...' } });
    
    // Click verify button
    fireEvent.click(verifyButton);
    
    // Verify UI updates
    await waitFor(() => {
      expect(resultContainer.innerHTML).toContain('Token is valid');
      expect(resultContainer.innerHTML).toContain('https://auth.example.com');
      expect(resultContainer.innerHTML).toContain('user123');
      expect(resultContainer.innerHTML).toContain('admin');
    });
  });
  
  test('should show error for expired token', async () => {
    // Mock API error response for expired token
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        valid: false,
        reason: "Token has expired",
        errorCode: "TOKEN_EXPIRED",
        suggestion: "Request a new token from the authorization server"
      })
    });
    
    // Set token input value
    fireEvent.change(tokenInput, { target: { value: 'eyJhbGciOiJIUzI1NiJ9...' } });
    
    // Click verify button
    fireEvent.click(verifyButton);
    
    // Verify UI updates
    await waitFor(() => {
      expect(resultContainer.innerHTML).toContain('Token is invalid');
      expect(resultContainer.innerHTML).toContain('Token has expired');
      expect(resultContainer.innerHTML).toContain('TOKEN_EXPIRED');
      expect(resultContainer.innerHTML).toContain('Request a new token');
    });
  });
  
  test('should reject empty token input', () => {
    // Click verify button without entering a token
    fireEvent.click(verifyButton);
    
    // Verify validation message
    expect(resultContainer.innerHTML).toContain('Please enter a token');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
```

#### Test Data

Test data includes a variety of token formats:

* Valid tokens with different claims
* Expired tokens
* Tokens with invalid signatures
* Tokens with missing required claims
* Malformed tokens with syntax errors

## Internationalization Testing

### I18n Test Strategy

JavaScript components are tested for proper internationalization support:

1. Verify all UI strings come from the i18n resources
2. Test UI rendering with different languages
3. Verify proper handling of right-to-left languages
4. Test formatting of dates, numbers, and currencies

```javascript
/**
 * Internationalization test suite
 */
describe('Internationalization', () => {
  test('should render UI with English strings by default', () => {
    // Mock i18n resources with English strings
    const mockI18n = {
      'processor.jwt.verifyButton': 'Verify Token',
      'processor.jwt.tokenPlaceholder': 'Paste JWT token here'
    };
    global.nfCommon = { getI18n: () => mockI18n };
    
    // Initialize component
    const container = document.createElement('div');
    TokenVerificationInterface.init(container, 'processor123', () => {});
    
    // Verify English strings are used
    expect(container.querySelector('.verify-token-button').textContent).toBe('Verify Token');
    expect(container.querySelector('.token-input').getAttribute('placeholder')).toBe('Paste JWT token here');
  });
  
  test('should render UI with German strings when German locale is active', () => {
    // Mock i18n resources with German strings
    const mockI18n = {
      'processor.jwt.verifyButton': 'Token überprüfen',
      'processor.jwt.tokenPlaceholder': 'JWT-Token hier einfügen'
    };
    global.nfCommon = { getI18n: () => mockI18n };
    
    // Initialize component
    const container = document.createElement('div');
    TokenVerificationInterface.init(container, 'processor123', () => {});
    
    // Verify German strings are used
    expect(container.querySelector('.verify-token-button').textContent).toBe('Token überprüfen');
    expect(container.querySelector('.token-input').getAttribute('placeholder')).toBe('JWT-Token hier einfügen');
  });
});
```

## Security Testing

### Security-Focused Tests

JavaScript components undergo specific security-focused testing:

1. **XSS Prevention**: Test protection against cross-site scripting
2. **Input Validation**: Verify proper validation of all user inputs
3. **Token Handling**: Test secure handling of sensitive token data
4. **Content Security Policy**: Verify compliance with CSP restrictions

#### XSS Prevention Test Examples

```javascript
/**
 * Security testing suite
 */
describe('Security Tests', () => {
  test('should sanitize potentially malicious token claims before rendering', async () => {
    // Mock API response with token containing XSS attempt in claims
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        valid: true,
        issuer: "https://auth.example.com",
        subject: "user123",
        claims: {
          malicious: '<script>alert("XSS")</script>',
          evil: 'javascript:alert("XSS")',
          harmless: 'normal text'
        }
      })
    });
    
    // Initialize component, submit token
    const container = document.createElement('div');
    document.body.appendChild(container);
    TokenVerificationInterface.init(container, 'processor123', () => {});
    
    fireEvent.change(container.querySelector('.token-input'), 
                   { target: { value: 'eyJhbGciOiJIUzI1NiJ9...' } });
    fireEvent.click(container.querySelector('.verify-token-button'));
    
    // Verify XSS content is properly escaped/sanitized
    await waitFor(() => {
      const resultHtml = container.querySelector('.verification-result').innerHTML;
      expect(resultHtml).not.toContain('<script>');
      expect(resultHtml).not.toContain('javascript:');
      expect(resultHtml).toContain('&lt;script&gt;');
      expect(resultHtml).toContain('harmless');
    });
  });
});
```

## Code Quality Standards

This project implements the centralized JavaScript testing and ESLint standards defined in the organization's coding standards repository.

### Standards References

For complete configuration details and guidelines:

* **Cypress E2E Standards**: `/standards/javascript/cypress-e2e-testing-standards.adoc`
* **JavaScript Linting Standards**: `/standards/javascript/linting-standards.adoc`

### Implementation Summary

The testing framework successfully implements centralized standards with:

* **Zero-Warning Achievement**: Complete elimination of linting issues
* **Production-Ready Setup**: Robust `.eslintrc.js` configuration
* **Constants Architecture**: Centralized string and selector management
* **Maven Integration**: Build validation with zero-warning enforcement
* **Security Focus**: Comprehensive security testing patterns

### Best Practices

**1. Prefer Assertions Over Waits**:
```javascript
// Avoid: Arbitrary waiting
cy.wait(1000);

// Prefer: Element-based assertions  
cy.get(SELECTORS.PROCESSOR).should(TEXT_CONSTANTS.BE_VISIBLE);
```

**2. Use Constants for Repeated Elements**:
```javascript
// Centralize commonly used selectors and text
import { SELECTORS, TEXT_CONSTANTS } from '../support/constants';
```

**3. Document Support Functions**:
```javascript
/**
 * Custom Cypress command for processor operations
 * @param {string} processorType - The type of processor to add
 * @returns {Cypress.Chainable<string>} The processor ID
 */
Cypress.Commands.add('addProcessor', (processorType) => {
  // Implementation
});
```

**4. Handle Complex Test Logic**:
- Break large tests into focused functions
- Use helper functions in support files
- Leverage data fixtures for test data
- Consider page object patterns for UI interactions

## Integration with CI/CD

JavaScript tests are fully integrated into the Maven build process, ensuring execution as part of regular build cycles and CI/CD pipelines without requiring separate GitHub Actions for JavaScript testing.

The Maven integration provides:
- Automated dependency installation
- Test execution in validate phase
- Coverage reporting
- Build failure on test failures
- Integration with existing Java build processes

## Compliance and Verification

### Quality Assurance

JavaScript testing implementation must demonstrate:

* ✅ **Coverage Standards Met** - Minimum coverage thresholds achieved (≥90%)
* ✅ **Security Tests Pass** - All security tests pass without exceptions
* ✅ **Standards Compliance** - Zero-warning ESLint compliance
* ✅ **CI/CD Integration** - Seamless build pipeline integration
* ✅ **Documentation Complete** - All required documentation provided

### Verification Methods

Compliance verification through:
* Automated coverage reporting via Jest and Istanbul
* Security vulnerability scanning with ESLint security plugins
* Code quality gate enforcement in Maven builds
* Build pipeline validation in CI/CD
* Documentation review and approval processes

### Technology Requirements Compliance

Implementation uses the required technology stack:

* ✅ **Jest Framework** - For test execution and assertions
* ✅ **Testing Library** - For DOM interaction simulation
* ✅ **Mock Service Worker** - For API response mocking
* ✅ **ESLint Integration** - Following centralized coding standards
* ✅ **Coverage Tools** - Integrated coverage reporting

### Build Integration Compliance

Testing integrates with required build systems:

* ✅ **Maven Frontend Plugin** - Automated Node.js and NPM management
* ✅ **Build Lifecycle** - Test execution in appropriate Maven phases
* ✅ **Failure Handling** - Build failure on test failures or quality gate violations
* ✅ **Artifact Generation** - Test reports and coverage artifacts for CI/CD

## See Also

### Related Documentation
* [Overview](overview.md) - Project overview and context
* [Implementation Guide](implementation-guide.md) - General implementation patterns
* [CI/CD Integration](ci-cd-integration.md) - Build pipeline integration
* [Recipes and How-To](recipes-and-howto.md) - Practical examples and patterns

### External References
* Testing Specification (Requirements NIFI-AUTH-16)
* Security Specification (Requirements NIFI-AUTH-8) 
* Internationalization Requirements (NIFI-AUTH-17)
* Centralized Standards Repository: `/standards/javascript/`

---

*This guide focuses on JavaScript testing implementation. For high-level testing requirements and specifications, see the main project specification documents.*
