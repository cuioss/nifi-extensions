/**
 * @fileoverview Modern Constants - 2025 Playwright Best Practices
 * Consolidated constants with modern locator patterns and semantic selectors
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The single definition site for the test credentials, shared with
 * docker-compose.yml, the Keycloak realm imports, the docker shell scripts and
 * IntegrationTestSupport.java. Resolved relative to THIS file so the suite can be
 * launched from any working directory.
 */
const CREDENTIALS_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../integration-testing/src/main/docker/test-credentials.env'
);

/**
 * Parses the shared credential file into a key/value map. The file uses the simple
 * `KEY=value` env format, with `#` comments and blank lines ignored — the same shape
 * IntegrationTestSupport.java reads.
 *
 * @returns {Map<string, string>} the parsed credentials
 * @throws {Error} when the file cannot be read
 */
const loadCredentials = () => {
  let contents;
  try {
    contents = readFileSync(CREDENTIALS_FILE, 'utf8');
  } catch (cause) {
    throw new Error(`Unable to read the shared test credentials from ${CREDENTIALS_FILE}`, {
      cause,
    });
  }
  const values = new Map();
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator > 0) {
      values.set(trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim());
    }
  }
  return values;
};

const CREDENTIALS = loadCredentials();

/**
 * Looks up a single credential, failing loudly when it is absent so a missing entry
 * surfaces at startup as a configuration error rather than as an authentication
 * failure against a silently-defaulted user.
 *
 * @param {string} key the credential key in test-credentials.env
 * @param {string|undefined} override an environment-variable value that takes precedence
 * @returns {string} the credential value
 * @throws {Error} when the credential is neither overridden nor defined in the file
 */
const credential = (key, override) => {
  if (override !== undefined && override !== '') {
    return override;
  }
  const value = CREDENTIALS.get(key);
  if (value === undefined || value === '') {
    throw new Error(`Credential '${key}' is not defined in ${CREDENTIALS_FILE}`);
  }
  return value;
};

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
 * ⚠️  WARNING: DO NOT CHANGE THESE CREDENTIALS WITHOUT PRIOR USER CONSULTATION
 * The values come from test-credentials.env — the single definition site the
 * throwaway docker/Keycloak test realm is imported with — so they cannot drift
 * from the realm the suite authenticates against. Still overridable via
 * environment variables, mirroring how the service URLs are handled.
 */
export const AUTH = {
  USERNAME: credential('TEST_USER_NAME', process.env.PLAYWRIGHT_TEST_USERNAME),
  PASSWORD: credential('TEST_USER_PASSWORD', process.env.PLAYWRIGHT_TEST_PASSWORD)
};

/**
 * Keycloak configuration constants
 * These values match the oauth_integration_tests realm configuration
 */
export const KEYCLOAK_CONFIG = {
  REALM: 'oauth_integration_tests',
  CLIENT_ID: 'test_client'
};

/**
 * Keycloak configuration for the limited user (role-based authorization testing)
 * Same realm (oauth_integration_tests) and client, but a user with only the
 * 'user' role — missing the 'read' role required by the processor.
 */
export const LIMITED_USER_CONFIG = {
  USERNAME: credential('LIMITED_USER_NAME', process.env.PLAYWRIGHT_LIMITED_USERNAME),
  PASSWORD: credential('LIMITED_USER_PASSWORD', process.env.PLAYWRIGHT_LIMITED_PASSWORD),
};

/**
 * Keycloak configuration for the other_realm (cross-issuer testing)
 * Separate realm with its own RSA key pair — tokens from this realm
 * should be rejected by a processor configured for oauth_integration_tests
 */
export const OTHER_REALM_CONFIG = {
  REALM: 'other_realm',
  CLIENT_ID: 'other_client',
  CLIENT_SECRET: credential('OTHER_CLIENT_SECRET', process.env.PLAYWRIGHT_OTHER_REALM_CLIENT_SECRET),
  USERNAME: credential('OTHER_USER_NAME', process.env.PLAYWRIGHT_OTHER_REALM_USERNAME),
  PASSWORD: credential('OTHER_USER_PASSWORD', process.env.PLAYWRIGHT_OTHER_REALM_PASSWORD),
  TOKEN_ENDPOINT: (process.env.PLAYWRIGHT_KEYCLOAK_URL || 'https://localhost:9085') + '/realms/other_realm/protocol/openid-connect/token'
};

/**
 * Service URLs
 */
const NIFI_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://localhost:9095/nifi';
// NiFi's REST API is served from the host root (/nifi-api), NOT under the /nifi
// web-context path. Deriving the origin by stripping a trailing /nifi keeps the
// diagnostics probe pointed at the real API instead of /nifi/nifi-api (M23).
const NIFI_ORIGIN = NIFI_BASE_URL.replace(/\/nifi\/?$/, '');

export const SERVICE_URLS = {
  NIFI_BASE: NIFI_BASE_URL,
  NIFI_LOGIN: NIFI_BASE_URL + '#/login',
  NIFI_CANVAS: NIFI_BASE_URL + '#/canvas',
  NIFI_SYSTEM_DIAGNOSTICS: NIFI_ORIGIN + '/nifi-api/system-diagnostics',
  KEYCLOAK_BASE: process.env.PLAYWRIGHT_KEYCLOAK_URL || 'https://localhost:9085',
  // Keycloak's readiness endpoint is HTTPS on the management port with the
  // /health/ready path (see integration-testing start-keycloak.sh) (N63).
  KEYCLOAK_HEALTH: 'https://localhost:9086/health/ready',
  KEYCLOAK_TOKEN: (process.env.PLAYWRIGHT_KEYCLOAK_URL || 'https://localhost:9085') + '/realms/oauth_integration_tests/protocol/openid-connect/token'
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
 * Process group name constants
 */
export const PROCESS_GROUPS = {
  JWT_AUTH_PIPELINE: 'JWT Auth Pipeline',
  REST_API_GATEWAY: 'REST API Gateway'
};

/**
 * Processor type constants
 */
export const PROCESSOR_TYPES = {
  MULTI_ISSUER_JWT_AUTHENTICATOR: 'MultiIssuerJWTTokenAuthenticator',
  JWT_TOKEN_AUTHENTICATOR: 'JWTTokenAuthenticator',
  REST_API_GATEWAY: 'RestApiGatewayProcessor'
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
  LIMITED_USER_CONFIG,
  OTHER_REALM_CONFIG,
  SERVICE_URLS,
  TIMEOUTS,
  SELECTORS,
  PAGE_DEFINITIONS,
  PROCESS_GROUPS,
  PROCESSOR_TYPES,
  ERROR_PATTERNS,
  TEST_TOKENS
};