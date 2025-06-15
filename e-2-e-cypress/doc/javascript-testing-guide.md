# JavaScript Testing Implementation Guide

This guide covers JavaScript testing implementation for the MultiIssuerJWTTokenAuthenticator processor UI components, including practical examples, testing strategies, and integration patterns.

## Requirements and Specifications

### JavaScript Testing Requirements
_Based on Requirement NIFI-AUTH-16: Testing_

This implementation addresses the requirements for JavaScript component testing in the MultiIssuerJWTTokenAuthenticator processor, focusing on interactive UI components that require comprehensive testing coverage.

#### UI Components Requiring Testing

The processor includes JavaScript-based UI components that must be tested:

1. **JWKS Endpoint Test Button** - Validates connectivity to JWKS endpoints
2. **Token Verification Interface** - Tests JWT tokens against processor configuration  
3. **Metrics Display** - Shows security event metrics and statistics in real-time

#### Testing Coverage Requirements

JavaScript testing must provide:

* **Unit Test Coverage** ≥ 90% for all JavaScript components
* **Integration Test Coverage** for component interactions and API flows
* **Security Testing** including XSS prevention and input validation
* **Internationalization Testing** for multi-language UI support
* **Error Handling Testing** for all failure scenarios

#### Code Quality Requirements

JavaScript testing must adhere to:

* **Centralized ESLint Standards** - Following organization coding standards
* **Zero-Warning Policy** - All code must pass linting without warnings
* **Security-First Testing** - Comprehensive security vulnerability testing
* **Performance Standards** - Efficient test execution and minimal resource usage

#### Security Testing Requirements

All JavaScript components must be tested for:

1. **Cross-Site Scripting (XSS) Prevention** - Input sanitization and output encoding
2. **Input Validation** - Proper validation of all user inputs
3. **Token Security** - Secure handling of sensitive JWT token data
4. **Content Security Policy Compliance** - Adherence to CSP restrictions

#### Internationalization Testing Requirements

JavaScript components must be tested for:

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
