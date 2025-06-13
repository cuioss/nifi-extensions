/**
 * Shared constants for CUI standards compliance
 * Eliminates duplicate strings across the codebase
 *
 * @typedef {object} JQuery - jQuery object type for JSDoc
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

  // Error and validation selectors
  VALIDATION_ERROR: '.validation-error, .error-message',

  // Common form elements
  USERNAME_INPUT: '#username',
  PASSWORD_INPUT: '#password',
  LOGIN_BUTTON: '#login-button',

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
  TOKEN_AUDIENCE: 'Token Audience',
  DEFAULT_ISSUER: 'Default Issuer',
  JWKS_SERVER_URL: 'JWKS Server URL',
  CONNECTION_TIMEOUT: 'Connection Timeout',

  // Accessibility labels
  CLOSE_DIALOG: 'Close dialog',
  MENU_TOGGLE: 'Toggle menu',

  // Language codes
  ENGLISH: 'en',
  GERMAN: 'de',
  FRENCH: 'fr',
  SPANISH: 'es',
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

  // Processor states
  RUNNING: 'RUNNING',
  STOPPED: 'STOPPED',

  // Status text patterns
  PROCESSED: 'Processed:',
  VALID: 'Valid:',
  INVALID: 'Invalid:',
  PROCESSED_ZERO: 'Processed: 0',
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
