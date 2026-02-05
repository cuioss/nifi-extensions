/**
 * @fileoverview Modern Constants - 2025 Playwright Best Practices
 * Consolidated constants with modern locator patterns and semantic selectors
 */

/**
 * Page type constants
 */
export const PAGE_TYPES = {
  LOGIN: 'LOGIN',
  MAIN_CANVAS: 'MAIN_CANVAS',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Authentication constants
 * 
 * ⚠️  WARNING: DO NOT CHANGE THESE VALUES WITHOUT PRIOR USER CONSULTATION
 * These credentials must match the NiFi instance configuration
 */
export const AUTH = {
  USERNAME: 'testUser',
  PASSWORD: 'drowssap'
};

/**
 * Keycloak configuration constants
 * These values match the oauth_integration_tests realm configuration
 */
export const KEYCLOAK_CONFIG = {
  REALM: 'oauth_integration_tests',
  CLIENT_ID: 'test_client',
  CLIENT_SECRET: 'yTKslWLtf4giJcWCaoVJ20H8sy6STexM'
};

/**
 * Service URLs
 */
export const SERVICE_URLS = {
  NIFI_BASE: process.env.PLAYWRIGHT_BASE_URL || 'https://localhost:9095/nifi',
  NIFI_LOGIN: (process.env.PLAYWRIGHT_BASE_URL || 'https://localhost:9095/nifi') + '#/login',
  NIFI_CANVAS: (process.env.PLAYWRIGHT_BASE_URL || 'https://localhost:9095/nifi') + '#/canvas',
  NIFI_SYSTEM_DIAGNOSTICS: (process.env.PLAYWRIGHT_BASE_URL || 'https://localhost:9095/nifi') + '/nifi-api/system-diagnostics',
  KEYCLOAK_BASE: process.env.PLAYWRIGHT_KEYCLOAK_URL || 'http://localhost:9080',
  KEYCLOAK_HEALTH: 'http://localhost:9086/health',
  KEYCLOAK_TOKEN: (process.env.PLAYWRIGHT_KEYCLOAK_URL || 'http://localhost:9080') + '/realms/oauth_integration_tests/protocol/openid-connect/token'
};

/**
 * Modern timeouts configuration
 */
export const TIMEOUTS = {
  SHORT: 5000,
  MEDIUM: 10000,
  LONG: 30000,
  PROCESSOR_LOAD: 15000,
  NAVIGATION: 10000,
  DIALOG: 10000
};

/**
 * Modern selectors with 2025 Playwright best practices
 * Prioritizes semantic locators over complex CSS selectors
 */
export const SELECTORS = {
  // Main application elements - use first() to avoid strict mode violation
  MAIN_CANVAS: '#canvas-container',

  // Authentication elements - using semantic selectors
  USERNAME_INPUT: 'input[name="username"], input[placeholder*="username" i], input[type="text"]',
  PASSWORD_INPUT: 'input[name="password"], input[placeholder*="password" i], input[type="password"]',
  LOGIN_BUTTON: 'button[type="submit"], button:has-text("Log In"), button:has-text("Sign In")',

  // Canvas and workspace
  CANVAS_CONTAINER: 'mat-sidenav-content',
  CANVAS_SVG: 'svg.canvas-svg, mat-sidenav-content svg, #canvas-container svg',

  // Processors - simplified selectors
  PROCESSOR_ELEMENT: '.processor, [data-type*="processor"], .component',

  // Dialogs - using role-based selectors (2025 best practice)
  DIALOG_CONTAINER: '[role="dialog"], mat-dialog-container',

  // Forms - semantic approach
  TEXT_INPUT: 'input[type="text"], input[matInput]',
  TEXTAREA: 'textarea, textarea[matInput]',

  // Buttons - semantic approach
  SUBMIT_BUTTON: 'button[type="submit"]',
  CANCEL_BUTTON: 'button:has-text("Cancel")',
  APPLY_BUTTON: 'button:has-text("Apply")',

  // Context menus
  CONTEXT_MENU: '[role="menu"], .context-menu',
  MENU_ITEM: '[role="menuitem"]'
};

/**
 * Page type definitions for navigation
 */
export const PAGE_DEFINITIONS = {
  [PAGE_TYPES.LOGIN]: {
    path: SERVICE_URLS.NIFI_LOGIN,
    description: 'NiFi Login Page',
    elements: [SELECTORS.USERNAME_INPUT, SELECTORS.PASSWORD_INPUT, SELECTORS.LOGIN_BUTTON]
  },
  [PAGE_TYPES.MAIN_CANVAS]: {
    path: SERVICE_URLS.NIFI_CANVAS,
    description: 'NiFi Main Canvas',
    elements: [SELECTORS.MAIN_CANVAS]
  },
  [PAGE_TYPES.UNKNOWN]: {
    path: null,
    description: 'Unknown Page Type',
    elements: []
  }
};

/**
 * Processor type constants
 */
export const PROCESSOR_TYPES = {
  MULTI_ISSUER_JWT_AUTHENTICATOR: 'MultiIssuerJWTTokenAuthenticator',
  JWT_TOKEN_AUTHENTICATOR: 'JWTTokenAuthenticator'
};

/**
 * Test JWT tokens for verification tests
 * These tokens are designed for E2E testing and use basic JWT structure
 * without requiring signature verification (test mode only).
 * 
 * Token payloads decoded:
 * - VALID: Valid token with future expiration
 * - EXPIRED: Token with past expiration date  
 * - INVALID: Malformed token string
 * - MALFORMED: Not a JWT structure at all
 */
export const TEST_TOKENS = {
  // Valid token with exp: 2030-01-01 (far future), iss: test-issuer, sub: test-user
  // Payload: {"sub":"test-user","iss":"test-issuer","exp":1893456000,"iat":1735689600,"scopes":["read","write"],"roles":["user"]}
  VALID: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJpc3MiOiJ0ZXN0LWlzc3VlciIsImV4cCI6MTg5MzQ1NjAwMCwiaWF0IjoxNzM1Njg5NjAwLCJzY29wZXMiOlsicmVhZCIsIndyaXRlIl0sInJvbGVzIjpbInVzZXIiXX0.fake-signature-for-testing',
  
  // Expired token with exp: 2020-01-01 (past), iss: test-issuer, sub: expired-user
  // Payload: {"sub":"expired-user","iss":"test-issuer","exp":1577836800,"iat":1577836800,"scopes":["read"],"roles":["user"]}
  EXPIRED: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJleHBpcmVkLXVzZXIiLCJpc3MiOiJ0ZXN0LWlzc3VlciIsImV4cCI6MTU3NzgzNjgwMCwiaWF0IjoxNTc3ODM2ODAwLCJzY29wZXMiOlsicmVhZCJdLCJyb2xlcyI6WyJ1c2VyIl19.fake-signature-for-testing',
  
  // Invalid token - recognized by service as invalid
  INVALID: 'invalid.jwt.token',
  
  // Malformed token - not JWT structure
  MALFORMED: 'not-even-close-to-jwt'
};

/**
 * Error patterns for console monitoring
 */
export const ERROR_PATTERNS = {
  IGNORED: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured'
  ],
  CRITICAL: [
    'Uncaught Error: Mismatched anonymous define() module',
    'jQuery is not defined',
    'Failed to load resource',
    'Refused to execute script',
    'Refused to apply style'
  ]
};

// Legacy exports for backward compatibility
export const DEFAULT_CREDENTIALS = AUTH;
export const IGNORED_ERROR_PATTERNS = ERROR_PATTERNS.IGNORED;
export const BROWSER_ERROR_PATTERNS = ERROR_PATTERNS.CRITICAL;

// Consolidated export as CONSTANTS for modern usage
export const CONSTANTS = {
  PAGE_TYPES,
  AUTH,
  KEYCLOAK_CONFIG,
  SERVICE_URLS,
  TIMEOUTS,
  SELECTORS,
  PAGE_DEFINITIONS,
  PROCESSOR_TYPES,
  ERROR_PATTERNS,
  TEST_TOKENS
};