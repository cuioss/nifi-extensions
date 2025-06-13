/**
 * Shared constants for CUI standards compliance
 * Eliminates duplicate strings across the codebase
 * @typedef {object} JQuery - jQuery object type for JSDoc
 * @property
 */

// Common UI Selectors
export const SELECTORS = {
  // Dialog selectors
  DIALOG:
    '[role="dialog"], .mat-dialog-container, .dialog, .add-component-dialog, .processor-dialog',
  CONFIGURATION_DIALOG: '.configuration-dialog',

  // Processor selectors
  PROCESSOR: 'g.processor, [class*="processor"], .component',
  PROCESSOR_ELEMENT: 'g.processor, [class*="processor"], .component',
  PROCESSOR_CONFIG_TAB: '.processor-configuration-tab',
  PROCESSOR_PROPERTY_NAME: '.processor-property-name',
  PROCESSOR_PROPERTY_ROW: '.processor-property-row',
  PROCESSOR_STATUS: '.processor-status',

  // Error and validation selectors
  VALIDATION_ERROR: '.validation-error, .error-message',

  // Common form elements
  USERNAME_INPUT: '#username',
  PASSWORD_INPUT: '#password',
  LOGIN_BUTTON: '#login-button',
  BUTTON: 'button',
  BODY: 'body',

  // Navigation elements
  MENU_ITEMS: '.menu-item',
  NAVIGATION_LINKS: '.nav-link',

  // Common content areas
  MAIN_CONTENT: '.main-content',
  SIDEBAR: '.sidebar',
  HEADER: '.header',
};

// Common text constants
export const TEXT_CONSTANTS = {
  // Button text
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  SAVE: 'Save',
  CANCEL: 'Cancel',
  DELETE: 'Delete',
  APPLY: 'Apply',
  OK: 'OK',

  // Tab names
  PROPERTIES: 'Properties',
  SETTINGS: 'Settings',
  SCHEDULING: 'Scheduling',

  // Status messages
  LOADING: 'Loading...',
  SUCCESS: 'Success',
  ERROR: 'Error',

  // Common property names for JWT processors
  JWKS_TYPE: 'JWKS Type',
  JWKS_SOURCE_TYPE: 'JWKS Source Type',
  JWKS_FILE_PATH: 'JWKS File Path',
  TOKEN_AUDIENCE: 'Token Audience',
  DEFAULT_ISSUER: 'Default Issuer',
  JWKS_SERVER_URL: 'JWKS Server URL',
  CONNECTION_TIMEOUT: 'Connection Timeout',
  JWKS_URL: 'JWKS URL',

  // High-frequency processor names
  MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR: 'MultiIssuerJWTTokenAuthenticator',
  GENERATE_FLOW_FILE: 'GenerateFlowFile',
  NIFI: 'nifi',
  ADMIN: 'admin',
  ADMIN_PASSWORD: 'adminadminadmin',

  // Test data
  TEST_ISSUER: 'test-issuer',
  ID_ATTR: 'id',

  // Language codes
  ENGLISH: 'en',
  GERMAN: 'de',

  // Common element states and assertions
  BE_VISIBLE: 'be.visible',
  BE_ENABLED: 'be.enabled',
  BE_DISABLED: 'be.disabled',
  EXIST: 'exist',
  NOT_EXIST: 'not.exist',
  CONTAIN: 'contain',
  CONTAIN_TEXT: 'contain.text',
  HAVE_TEXT: 'have.text',
  HAVE_VALUE: 'have.value',
  HAVE_CLASS: 'have.class',
  HAVE_ATTR: 'have.attr',

  // Common processor selectors for duplicate strings
  PROCESSOR_DETAILS_PANE: '[data-testid="processor-details-pane"]',
  CONFIRM_RESET_DIALOG: '[data-testid="confirm-reset-dialog"]',
  CANVAS_CONTAINER: '#canvas-container',
  CONTEXT_MENU: '.context-menu, .popup-menu',

  // Common CSS classes
  VALIDATION_ERROR_CLASS: '.validation-error',
  ERROR_MESSAGE_CLASS: '.error-message',
  SUCCESS_MESSAGE_CLASS: '.success-message',
  WARNING_MESSAGE_CLASS: '.warning-message',
  LOADING_SPINNER_CLASS: '.loading-spinner',

  // Common attribute names
  DATA_TESTID: 'data-testid',
  ARIA_LABEL: 'aria-label',
  ROLE: 'role',
  ID: 'id',
  CLASS: 'class',

  // Common HTTP status codes
  HTTP_200: 200,
  HTTP_401: 401,
  HTTP_403: 403,
  HTTP_404: 404,
  HTTP_500: 500,

  // Accessibility labels
  CLOSE_DIALOG: 'Close dialog',
  MENU_TOGGLE: 'Toggle menu',
};

// Common timeouts (in milliseconds)
export const TIMEOUTS = {
  SHORT: 1000,
  MEDIUM: 2000,
  LONG: 5000,
  VERY_LONG: 10000,
};

// Common URLs and endpoints
export const URLS = {
  BASE_URL: 'http://localhost:8080',
  LOGIN_PAGE: '/login',
  DASHBOARD: '/dashboard',
  PROCESSORS: '/processors',
};

// Test data constants
export const TEST_DATA = {
  VALID_USERNAME: 'testuser',
  VALID_PASSWORD: 'password123',
  INVALID_USERNAME: 'invalid',
  INVALID_PASSWORD: 'wrong',

  // Common test values for processor configuration
  TEST_ISSUER_NAME: 'test-issuer',
  TEST_ISSUER_URL: 'https://test.example.com',
  TEST_JWKS_URL: 'https://test.example.com/jwks.json',
  TEST_JWKS_TYPE: 'server',
  SERVER: 'SERVER',
  INVALID_URL: 'invalid-url',

  // Processor configuration property keys
  ISSUER_1_NAME: 'issuer-1-name',
  ISSUER_1_ISSUER: 'issuer-1-issuer',
  ISSUER_1_JWKS_TYPE: 'issuer-1-jwks-type',
  ISSUER_1_JWKS_URL: 'issuer-1-jwks-url',

  // Processor states
  RUNNING: 'RUNNING',
  STOPPED: 'STOPPED',

  // Status text patterns
  PROCESSED: 'Processed:',
  VALID: 'Valid:',
  INVALID: 'Invalid:',
  PROCESSED_ZERO: 'Processed: 0',

  // Metrics text patterns
  VALID_TOKENS: 'Valid Tokens',
  INVALID_TOKENS: 'Invalid Tokens',
  TOKENS_PROCESSED: 'Tokens Processed',
  TOTAL_PROCESSED_TOKENS: 'Total Processed Tokens',
  SECURITY_EVENT_METRICS: 'Security Event Metrics',
  RESET_METRICS: 'Reset Metrics',
  MALFORMED: 'Malformed',
  EXPIRED: 'Expired',
  INVALID_SIGNATURE: 'Invalid Signature',
  PERCENTAGE_SYMBOL: '%',

  // Common test result values
  VALID_ZERO: 'Valid: 0',
  INVALID_ZERO: 'Invalid: 0',
  PROCESSED_ONE: 'Processed: 1',
  VALID_ONE: 'Valid: 1',
};

// Accessibility constants
export const A11Y = {
  ROLES: {
    BUTTON: 'button',
    DIALOG: 'dialog',
    MENU: 'menu',
    MENUITEM: 'menuitem',
    NAVIGATION: 'navigation',
  },

  ARIA_LABELS: {
    CLOSE: 'Close',
    OPEN: 'Open',
    EXPAND: 'Expand',
    COLLAPSE: 'Collapse',
  },
};

// Regular expressions for validation
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  USERNAME: /^[a-zA-Z0-9_-]{3,20}$/,
};
