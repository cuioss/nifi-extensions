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
 * Canvas and UI selectors - consolidated from multiple files
 */
export const SELECTORS = {
  // Canvas selectors
  CANVAS: '#canvas',
  CANVAS_CONTAINER: '#canvas-container',
  CANVAS_SVG: 'svg',
  CANVAS_ELEMENTS: '#canvas, svg, .canvas, #canvas-container',

  // Processor selectors
  PROCESSOR_GROUP: 'g.processor',
  PROCESSOR_ELEMENT: '.processor',
  PROCESSOR_TEXT: '.processor-name',
  PROCESSOR_ICON: '.processor-icon',

  // Dialog selectors
  ADD_PROCESSOR_DIALOG: '.add-processor-dialog, [role="dialog"]',
  PROCESSOR_TYPE_LIST: '.processor-type-list, .processor-types',
  PROCESSOR_TYPE_ITEM: '.processor-type-item, .processor-type',
  PROCESSOR_SEARCH: 'input[placeholder*="Search"], input[type="search"]',
  PROCESSOR_LIST_ITEM: '.processor-type-item, .processor-type',

  // Button selectors
  ADD_BUTTON: 'button:contains("Add"), .add-button',
  CANCEL_BUTTON: 'button:contains("Cancel"), .cancel-button',
  DELETE_BUTTON: 'button:contains("Delete"), .delete-button',

  // Context menu selectors
  CONTEXT_MENU: '.context-menu, [role="menu"]',
  CONTEXT_MENU_DELETE: '.context-menu .delete, [role="menuitem"]:contains("Delete")',

  // Toolbar selectors
  TOOLBAR_ADD: 'button[title*="Add"], .toolbar .add-processor',

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
 * JWT Processor definitions
 */
export const JWT_PROCESSORS = {
  JWT_AUTHENTICATOR: {
    className: 'de.cuioss.nifi.processors.auth.JWTTokenAuthenticator',
    displayName: 'JWTTokenAuthenticator',
    shortName: 'JWT Token Authenticator',
    description: 'Authenticates JWT tokens from a single issuer',
  },
  MULTI_ISSUER: {
    className: 'de.cuioss.nifi.processors.auth.MultiIssuerJWTTokenAuthenticator',
    displayName: 'MultiIssuerJWTTokenAuthenticator',
    shortName: 'Multi-Issuer JWT Token Authenticator',
    description: 'Authenticates JWT tokens from multiple issuers',
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
    elements: ['#canvas', 'svg'],
  },
  [PAGE_TYPES.UNKNOWN]: {
    path: null,
    description: 'Unknown Page Type',
    elements: [],
  },
};

/**
 * Default credentials
 */
export const DEFAULT_CREDENTIALS = {
  USERNAME: 'admin',
  PASSWORD: 'adminadminadmin',
};

/**
 * Error patterns that should be ignored - moved from e2e.js
 */
export const IGNORED_ERROR_PATTERNS = [
  'ResizeObserver loop limit exceeded',
  'Non-Error promise rejection captured',
  'Cannot read properties of undefined',
  'is not a function',
  'is not defined',
  'Cannot set properties of undefined',
];
