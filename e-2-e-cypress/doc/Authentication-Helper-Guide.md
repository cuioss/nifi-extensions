# NiFi Cypress Authentication Helper

This document describes the modern authentication system implemented for NiFi Cypress tests, following 2024 best practices.

## Overview

The authentication helper provides stateful login/logout functionality using Cypress's `cy.session()` command. This approach ensures:

- **Test Isolation**: Each test is self-sufficient and independent
- **Performance**: Login happens only once per session, cached across tests and specs
- **Reliability**: Session validation ensures tests start with a known good state
- **Maintainability**: Centralized authentication logic

## Architecture

### Key Components

1. **`auth-helper.js`** - Core authentication commands
2. **`auth-helper.d.ts`** - TypeScript definitions
3. **Updated test files** - Using the new helper functions

### Authentication Flow

```mermaid
graph TD
    A[Test Starts] --> B[cy.ensureNiFiReady()]
    B --> C{Session Exists?}
    C -->|Yes| D[Validate Session]
    C -->|No| E[Create New Session]
    D -->|Valid| F[Use Cached Session]
    D -->|Invalid| E
    E --> G[Perform Login]
    G --> H[Cache Session Data]
    H --> F
    F --> I[Test Execution]
```

## Available Commands

### `cy.loginNiFi(username?, password?)`

Login to NiFi using cached session for optimal performance.

**Parameters:**
- `username` (optional): Username (default: 'admin')
- `password` (optional): Password (default: 'adminadminadmin')

**Example:**
```javascript
cy.loginNiFi('admin', 'password123');
```

### `cy.logoutNiFi()`

Logout from NiFi and clear session data.

**Example:**
```javascript
cy.logoutNiFi();
```

### `cy.getSessionContext()`

Get current session context information for debugging and validation.

**Returns:** Object with session details:
```javascript
{
  url: string;
  title: string;
  isLoggedIn: boolean;
  isNiFiPage: boolean;
  hasCanvas: boolean;
  hasCanvasContainer: boolean;
  isReady: boolean;
  timestamp: string;
}
```

**Example:**
```javascript
cy.getSessionContext().then((context) => {
  expect(context.isReady).to.be.true;
  cy.log('Session state:', context);
});
```

### `cy.ensureNiFiReady(username?, password?)`

One-stop command that handles login and validates NiFi is ready for testing.

**Parameters:**
- `username` (optional): Username (default: 'admin')
- `password` (optional): Password (default: 'adminadminadmin')

**Example:**
```javascript
beforeEach(() => {
  cy.ensureNiFiReady();
});
```

## Test Structure Best Practices

### Self-Sufficient Tests

Each test should be independent and use the authentication helper:

```javascript
describe('My Test Suite', () => {
  beforeEach(() => {
    // Each test is self-sufficient
    cy.ensureNiFiReady();
  });

  it('should test feature X', () => {
    // Test implementation
    // Session is already established and validated
  });
});
```

### Session Management

The system automatically handles:
- **Session Creation**: First time login creates and caches session
- **Session Reuse**: Subsequent tests use cached session
- **Session Validation**: Ensures session is still valid before reuse
- **Session Recovery**: Recreates session if validation fails

### Cross-Spec Caching

Sessions are cached across different test files (specs) using `cacheAcrossSpecs: true`:

```javascript
// In spec file A
cy.loginNiFi(); // Creates session

// In spec file B (run later)
cy.loginNiFi(); // Reuses cached session from spec A
```

## Migration Guide

### From Old Pattern

**Before:**
```javascript
beforeEach(() => {
  cy.visit(baseUrl);
  // Manual authentication logic
  cy.get('[data-testid="username"]').type('admin');
  cy.get('[data-testid="password"]').type('password');
  cy.get('[data-testid="login-button"]').click();
  cy.url().should('not.contain', '/login');
});
```

**After:**
```javascript
beforeEach(() => {
  cy.ensureNiFiReady();
});
```

### Benefits of Migration

1. **Faster Execution**: Login happens once, not in every test
2. **More Reliable**: Built-in session validation and recovery
3. **Cleaner Tests**: Remove authentication boilerplate from test logic
4. **Better Isolation**: Each test is truly independent
5. **Easier Debugging**: Built-in session context information

## Performance Impact

### Before (Traditional Approach)
- Login time per test: ~2-3 seconds
- 100 tests = 3-5 minutes of login overhead
- Frequent test failures due to authentication timing

### After (Session-Based Approach)
- Login time per session: ~2-3 seconds (once)
- 100 tests = 2-3 seconds total login overhead
- Reliable session validation reduces authentication failures

## Debugging

### Session Context

Use `cy.getSessionContext()` to debug session issues:

```javascript
cy.getSessionContext().then((context) => {
  console.log('Session Debug Info:', context);
  if (!context.isReady) {
    console.log('Session not ready:', {
      loggedIn: context.isLoggedIn,
      nifiPage: context.isNiFiPage,
      canvas: context.hasCanvas
    });
  }
});
```

### Session Cache

View cached sessions in Cypress DevTools:
1. Open Cypress Test Runner
2. Open browser DevTools (F12)
3. Check Application -> Local Storage -> Cypress session data

## Troubleshooting

### Common Issues

1. **Session Not Found**: Clear browser data and restart tests
2. **Validation Failures**: Check if NiFi server is running
3. **Canvas Not Loading**: Increase timeouts in validation function

### Reset Sessions

To clear all cached sessions:
```javascript
// In test or support file
Cypress.session.clearAllSavedSessions();
```

## Implementation Details

### Session Identification

Sessions are identified by username:
- `nifi-session-admin` for admin user
- `nifi-session-user1` for user1, etc.

### Validation Logic

Session validation checks:
1. URL doesn't contain '/login'
2. Page title contains 'NiFi'
3. Canvas elements are present and accessible

### Error Handling

The system handles various error conditions:
- Network timeouts during login
- Authentication failures
- Session expiration
- Canvas loading failures

## Future Enhancements

Potential improvements:
1. **Multi-user Support**: Test different user roles
2. **Environment Switching**: Support different NiFi instances
3. **API Authentication**: Token-based authentication for API tests
4. **Session Metrics**: Track session performance and reliability
