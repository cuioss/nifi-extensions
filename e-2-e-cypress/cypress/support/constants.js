// Shared constants for Cypress support files
// Consolidates selectors, timeouts, and configuration to reduce duplication

/**
 * Page type constants
 */
export const PAGE_TYPES = {
  LOGIN: 'LOGIN',
  MAIN_CANVAS: 'MAIN_CANVAS',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Canvas and UI selectors - UPDATED with Angular Material framework-based patterns
 * Based on Phase 0 analysis: NiFi uses Angular Material SPA framework
 */
export const SELECTORS = {
  // ❌ OLD SELECTORS (PROVEN WRONG by Phase 0 analysis) - kept for reference
  CANVAS_OLD: '#canvas',
  CANVAS_CONTAINER_OLD: '#canvas-container',
  CANVAS_SVG_OLD: 'svg',
  CANVAS_ELEMENTS_OLD: '#canvas, svg, .canvas, #canvas-container',

  // ✅ NEW ANGULAR MATERIAL FRAMEWORK-BASED SELECTORS
  // Canvas selectors - based on Angular Material SPA patterns
  CANVAS: 'mat-sidenav-content, .mat-drawer-content, router-outlet + *, main',
  CANVAS_CONTAINER: 'mat-sidenav-content, .mat-drawer-content',
  CANVAS_SVG: 'mat-sidenav-content svg, .mat-drawer-content svg, router-outlet svg, main svg',
  CANVAS_ELEMENTS: 'mat-sidenav-content, .mat-drawer-content, router-outlet, main, svg',

  // Processor selectors - Angular Material + SVG patterns
  PROCESSOR_GROUP: 'svg g[class*="processor"], svg g[data-type*="processor"], svg .component',
  PROCESSOR_ELEMENT: '.processor, [class*="processor"], .component, .flow-component',
  PROCESSOR_TEXT: '.processor-name, .component-name, text[class*="name"], .label',
  PROCESSOR_ICON: '.processor-icon, .component-icon, .icon, image',

  // Dialog selectors - Angular Material dialog patterns
  ADD_PROCESSOR_DIALOG: 'mat-dialog-container, .mat-dialog-container, [role="dialog"]',
  PROCESSOR_TYPE_LIST: 'mat-list, .mat-list, mat-selection-list, .processor-types',
  PROCESSOR_TYPE_ITEM: 'mat-list-item, .mat-list-item, mat-list-option, .processor-type',
  PROCESSOR_SEARCH: 'mat-form-field input, input[matInput], input[placeholder*="Search"], input[type="search"]',
  PROCESSOR_LIST_ITEM: 'mat-list-item, .mat-list-item, mat-list-option, .processor-type',

  // Button selectors - Angular Material button patterns
  ADD_BUTTON: 'button[mat-raised-button], button[mat-button], button:contains("Add"), .mat-raised-button',
  CANCEL_BUTTON: 'button:contains("Cancel"), .mat-button:contains("Cancel")',
  DELETE_BUTTON: 'button:contains("Delete"), .mat-button:contains("Delete")',

  // Context menu selectors - Angular Material menu patterns
  CONTEXT_MENU: 'mat-menu, .mat-menu-panel, [role="menu"]',
  CONTEXT_MENU_DELETE: 'mat-menu-item:contains("Delete"), .mat-menu-item:contains("Delete"), [role="menuitem"]:contains("Delete")',

  // Toolbar selectors - Angular Material toolbar patterns
  TOOLBAR: 'mat-toolbar, .mat-toolbar',
  TOOLBAR_ADD: 'mat-toolbar button[aria-label*="Add"], mat-toolbar button[title*="Add"], .mat-toolbar button',

  // Login selectors
  USERNAME_INPUT:
    '[data-testid="username"], input[type="text"], input[id*="username"], input[name="username"]',
  PASSWORD_INPUT:
    '[data-testid="password"], input[type="password"], input[id*="password"], input[name="password"]',
  LOGIN_BUTTON:
    '[data-testid="login-button"], input[value="Login"], button[type="submit"], button:contains("Login")',

  // Generic selectors
  DIALOG: '[role="dialog"], .dialog, .modal',
  BUTTON: 'button',
  INPUT: 'input',
};

/**
 * Timeout constants - consolidated from multiple files
 */
export const TIMEOUTS = {
  DIALOG_APPEAR: 5000,
  PROCESSOR_LOAD: 10000,
  CANVAS_READY: 8000,
  ELEMENT_VISIBLE: 3000,
  ACTION_COMPLETE: 2000,
  DEFAULT_COMMAND: 10000,
  PAGE_LOAD: 10000,
};

/**
 * JWT Processor definitions with comprehensive configuration and testing support
 */
export const JWT_PROCESSORS = {
  JWT_AUTHENTICATOR: {
    className: 'de.cuioss.nifi.processors.auth.JWTTokenAuthenticator',
    displayName: 'JWTTokenAuthenticator',
    shortName: 'JWT Token Authenticator',
    description: 'Authenticates JWT tokens from a single issuer',
    relationships: {
      success: {
        name: 'success',
        description: 'Successfully authenticated JWT tokens'
      },
      failure: {
        name: 'failure',
        description: 'Failed authentication or invalid JWT tokens'
      },
      expired: {
        name: 'expired',
        description: 'Expired JWT tokens'
      }
    },
    properties: {
      jwksUrl: {
        name: 'JWKS URL',
        description: 'URL to fetch JSON Web Key Set for token verification',
        required: true,
        defaultValue: '',
        testValue: 'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid_connect/certs'
      },
      expectedIssuer: {
        name: 'Expected Issuer',
        description: 'Expected issuer claim in JWT tokens',
        required: true,
        defaultValue: '',
        testValue: 'https://localhost:8443/auth/realms/oauth_integration_tests'
      },
      expectedAudience: {
        name: 'Expected Audience',
        description: 'Expected audience claim in JWT tokens',
        required: false,
        defaultValue: '',
        testValue: 'test_client'
      },
      clockSkewTolerance: {
        name: 'Clock Skew Tolerance',
        description: 'Tolerance for clock skew in seconds',
        required: false,
        defaultValue: '60',
        testValue: '30'
      }
    }
  },
  MULTI_ISSUER: {
    className: 'de.cuioss.nifi.processors.auth.MultiIssuerJWTTokenAuthenticator',
    displayName: 'MultiIssuerJWTTokenAuthenticator',
    shortName: 'Multi-Issuer JWT Token Authenticator',
    description: 'Authenticates JWT tokens from multiple issuers',
    relationships: {
      success: {
        name: 'success',
        description: 'Successfully authenticated JWT tokens'
      },
      failure: {
        name: 'failure',
        description: 'Failed authentication or invalid JWT tokens'
      },
      expired: {
        name: 'expired',
        description: 'Expired JWT tokens'
      },
      unknownIssuer: {
        name: 'unknown-issuer',
        description: 'JWT tokens from unknown or untrusted issuers'
      }
    },
    properties: {
      issuerConfigurations: {
        name: 'Issuer Configurations',
        description: 'JSON configuration for multiple JWT issuers',
        required: true,
        defaultValue: '[]',
        testValue: JSON.stringify([
          {
            issuer: 'https://localhost:8443/auth/realms/oauth_integration_tests',
            jwksUrl: 'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid_connect/certs',
            audience: 'test_client'
          },
          {
            issuer: 'https://secondary-issuer.com',
            jwksUrl: 'https://secondary-issuer.com/.well-known/jwks.json',
            audience: 'secondary_client'
          }
        ])
      },
      clockSkewTolerance: {
        name: 'Clock Skew Tolerance',
        description: 'Tolerance for clock skew in seconds',
        required: false,
        defaultValue: '60',
        testValue: '30'
      },
      cacheExpiration: {
        name: 'JWKS Cache Expiration',
        description: 'Cache expiration time for JWKS in minutes',
        required: false,
        defaultValue: '60',
        testValue: '30'
      }
    }
  },
};

/**
 * Page type definitions for navigation
 */
export const PAGE_DEFINITIONS = {
  [PAGE_TYPES.LOGIN]: {
    path: '/#/login',
    description: 'NiFi Login Page',
    elements: ['input[type="password"]'],
  },
  [PAGE_TYPES.MAIN_CANVAS]: {
    path: '/',
    description: 'NiFi Main Canvas',
    elements: ['mat-sidenav-content', 'router-outlet', 'svg'],
  },
  [PAGE_TYPES.UNKNOWN]: {
    path: null,
    description: 'Unknown Page Type',
    elements: [],
  },
};

/**
 * Default credentials - Updated with correct test container credentials
 */
export const DEFAULT_CREDENTIALS = {
  USERNAME: 'testUser',
  PASSWORD: 'drowssap',
};

/**
 * JWT Test Scenarios and Validation Constants
 */
export const JWT_TEST_SCENARIOS = {
  VALID_TOKEN: {
    name: 'Valid JWT Token',
    description: 'Test with a valid, non-expired JWT token',
    expectedRelationship: 'success',
    tokenFixture: 'tokens/test-tokens.json',
    tokenKey: 'validToken'
  },
  EXPIRED_TOKEN: {
    name: 'Expired JWT Token',
    description: 'Test with an expired JWT token',
    expectedRelationship: 'expired',
    tokenFixture: 'tokens/test-tokens.json',
    tokenKey: 'expiredToken'
  },
  INVALID_ISSUER: {
    name: 'Invalid Issuer Token',
    description: 'Test with JWT token from untrusted issuer',
    expectedRelationship: {
      JWT_AUTHENTICATOR: 'failure',
      MULTI_ISSUER: 'unknownIssuer'
    },
    tokenFixture: 'tokens/test-tokens.json',
    tokenKey: 'invalidIssuerToken'
  },
  MALFORMED_TOKEN: {
    name: 'Malformed JWT Token',
    description: 'Test with malformed or corrupted JWT token',
    expectedRelationship: 'failure',
    tokenValue: 'invalid.jwt.token'
  },
  MISSING_TOKEN: {
    name: 'Missing JWT Token',
    description: 'Test with no JWT token provided',
    expectedRelationship: 'failure',
    tokenValue: ''
  }
};

/**
 * JWT Processor Configuration Test Cases
 */
export const JWT_CONFIG_TESTS = {
  SINGLE_ISSUER: {
    name: 'Single Issuer Configuration',
    processor: 'JWT_AUTHENTICATOR',
    scenarios: ['VALID_TOKEN', 'EXPIRED_TOKEN', 'INVALID_ISSUER', 'MALFORMED_TOKEN']
  },
  MULTI_ISSUER: {
    name: 'Multi-Issuer Configuration',
    processor: 'MULTI_ISSUER',
    scenarios: ['VALID_TOKEN', 'EXPIRED_TOKEN', 'INVALID_ISSUER', 'MALFORMED_TOKEN']
  },
  INVALID_CONFIG: {
    name: 'Invalid Configuration Tests',
    processor: 'JWT_AUTHENTICATOR',
    configOverrides: {
      jwksUrl: 'invalid-url',
      expectedIssuer: ''
    },
    expectedErrors: ['Invalid JWKS URL', 'Expected Issuer is required']
  }
};

/**
 * JWT Performance Test Thresholds
 */
export const JWT_PERFORMANCE_THRESHOLDS = {
  TOKEN_VALIDATION_TIME: 100, // milliseconds
  JWKS_FETCH_TIME: 500, // milliseconds
  PROCESSOR_THROUGHPUT: 1000, // tokens per second
  MEMORY_USAGE_LIMIT: 50 // MB
};

/**
 * Error patterns that should be ignored - only specific NiFi-related errors
 * Generic JavaScript errors have been removed to avoid masking real issues
 */
export const IGNORED_ERROR_PATTERNS = [
  'ResizeObserver loop limit exceeded',        // Browser-specific, safe to ignore
  'Non-Error promise rejection captured',      // NiFi-specific promise handling
];
