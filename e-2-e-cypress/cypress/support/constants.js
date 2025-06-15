/**
 * Shared constants for CUI standards compliance
 * Eliminates duplicate strings across the codebase
 * @typedef {Object} JQuery - jQuery object type for JSDoc compatibility
 * @typedef {Object} Element - DOM Element type for JSDoc
 * @property {string} selector - CSS selector string
 */

// Common UI Selectors
export const SELECTORS = {
  // Dialog selectors
  DIALOG:
    '[role="dialog"], .mat-dialog-container, .dialog, .add-component-dialog, .processor-dialog',
  CONFIGURATION_DIALOG: '.configuration-dialog',
  SETTINGS_DIALOG: '.settings-dialog',
  PROPERTIES_SECTION: '.properties-section',

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

  // Generic login form selectors
  USERNAME_FIELD_SELECTOR:
    'input[type="text"], input[type="email"], input[name*="user"], input[placeholder*="user"], input[id*="user"]',
  USERNAME_ID_SELECTOR: 'input[id$="username"]',
  PASSWORD_FIELD_SELECTOR: 'input[type="password"]',
  PASSWORD_ID_SELECTOR: 'input[id$="password"]',

  // Navigation elements
  MENU_ITEMS: '.menu-item',
  NAVIGATION_LINKS: '.nav-link',

  // Common content areas
  MAIN_CONTENT: '.main-content',
  SIDEBAR: '.sidebar',
  HEADER: '.header',

  // Common test ID selectors
  PROCESSOR_DETAILS_METRICS: '[data-testid="processor-details-metrics"]',
  CONFIG_DIALOG_TABS: '[data-testid="config-dialog-tabs"]',
  METRICS_TAB_CONTENT: '[data-testid="metrics-tab-content"]',
  METRICS_PERCENTAGES: '[data-testid="metrics-percentages"]',
  RESET_METRICS_BUTTON: '[data-testid="reset-metrics-button"]',
  CONFIRM_RESET_DIALOG: '[data-testid="confirm-reset-dialog"]',
  CONFIRM_RESET_BUTTON: '[data-testid="confirm-reset-button"]',
  CONFIG_DIALOG_CLOSE: '[data-testid="config-dialog-close"]',
  PERFORMANCE_METRICS: '[data-testid="performance-metrics"]',
  AVG_RESPONSE_TIME: '[data-testid="avg-response-time"]',
  ISSUER_METRICS: '[data-testid="issuer-metrics"]',
  RECENT_ERRORS: '[data-testid="recent-errors"]',
  ERROR_LIST: '[data-testid="error-list"]',
  ERROR_BREAKDOWN: '[data-testid="error-breakdown"]',

  // Common data-tab selectors
  METRICS_TAB: '[data-tab="metrics"]',
  PROPERTIES_TAB: '[data-tab="properties"]',
  SETTINGS_TAB: '[data-tab="settings"]',

  // Advanced UI selectors for Task 2 implementation
  CUSTOM_TABS: '.custom-tabs',
  CUSTOM_TABS_NAVIGATION: '.custom-tabs-navigation',
  CUSTOM_TAB: '.custom-tab',
  TAB_NAV_ITEM: '.tab-nav-item',
  JWT_VALIDATOR_TABS: '#jwt-validator-tabs',
  ADVANCED_CONFIGURATION_DIALOG: '.advanced-configuration-dialog',

  // Context menu selectors
  CONTEXT_MENU_ADVANCED: '*:contains("Advanced")',
  CONTEXT_MENU_CUSTOM_UI: '*:contains("Custom UI")',

  // Tab content selectors
  VALIDATION_SECTION: '.validation-section',
  TEST_TOKEN_INPUT: '.test-token',
  VERIFY_BUTTON: '.verify-button',
  METRICS_SECTION: '.metrics-section',
  PERFORMANCE_METRICS_SECTION: '.performance-metrics',
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
  JWKS_CONTENT: 'JWKS Content',
  TOKEN_AUDIENCE: 'Token Audience',
  DEFAULT_ISSUER: 'Default Issuer',
  JWKS_SERVER_URL: 'JWKS Server URL',
  CONNECTION_TIMEOUT: 'Connection Timeout',
  JWKS_URL: 'JWKS URL',

  // High-frequency processor names
  MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR: 'MultiIssuerJWTTokenAuthenticator',
  JWT_TOKEN_AUTHENTICATOR: 'JWTTokenAuthenticator',
  GENERATE_FLOW_FILE: 'GenerateFlowFile',
  NIFI: 'nifi',
  ADMIN: 'admin',
  ADMIN_PASSWORD: 'adminadminadmin',

  // Test data
  TEST_ISSUER: 'test-issuer',
  TEST_AUDIENCE: 'test-audience',
  ID_ATTR: 'id',

  // Common test values
  TEST_EXAMPLE_URL: 'https://test.example.com',
  TEST_JWKS_JSON_URL: 'https://test.example.com/jwks.json',
  SERVER_TYPE: 'server',

  // Language codes
  ENGLISH: 'en',
  GERMAN: 'de',

  // JWT validation property names
  JWT_ISSUER: 'issuer',
  JWT_AUDIENCE: 'audience',
  JWT_ALGORITHM: 'algorithm',

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
  PROCESSOR_SELECTOR: 'g.processor, [class*="processor"], .component',
  PROCESSOR_GROUP_SELECTOR: 'g.processor',

  // Common UI selectors
  CONFIGURATION_DIALOG: '.configuration-dialog',
  PROPERTY_EDITOR: '.property-editor',
  CANVAS_SELECTOR: '.canvas',
  TOOLBAR_SELECTOR: '.toolbar',
  CONTEXT_MENU_SELECTOR: '.context-menu, .mat-menu-panel, [role="menu"]',

  // Browser and testing selectors
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
  // NiFi base configuration - uses Cypress baseUrl with fallback
  NIFI_BASE: Cypress.config('baseUrl') || 'http://localhost:9094/nifi',

  // Keycloak configuration - uses environment variables with fallbacks
  // Note: The hardcoded URLs were using port 8443, but current config uses 9085
  // Using environment-configurable approach to support both
  KEYCLOAK_BASE:
    Cypress.env('KEYCLOAK_URL') || Cypress.env('keycloakUrl') || 'https://localhost:9085',
  KEYCLOAK_REALM: `/auth/realms/${Cypress.env('keycloakRealm') || 'oauth_integration_tests'}`,
  KEYCLOAK_JWKS_ENDPOINT: '/protocol/openid-connect/certs',

  // Computed URLs for convenience
  get KEYCLOAK_REALM_URL() {
    return `${this.KEYCLOAK_BASE}${this.KEYCLOAK_REALM}`;
  },

  get KEYCLOAK_JWKS_URL() {
    return `${this.KEYCLOAK_REALM_URL}${this.KEYCLOAK_JWKS_ENDPOINT}`;
  },

  get KEYCLOAK_ISSUER_URL() {
    return this.KEYCLOAK_REALM_URL;
  },

  // Legacy endpoints for backwards compatibility
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
  INVALID_URL_OLD: 'invalid-url',

  // Keycloak test URLs - use centralized URL configuration
  get KEYCLOAK_JWKS_URL() {
    return URLS.KEYCLOAK_JWKS_URL;
  },

  // Processor configuration property keys
  ISSUER_1_NAME: 'issuer-1-name',
  ISSUER_1_ISSUER: 'issuer-1-issuer',
  ISSUER_1_JWKS_TYPE: 'issuer-1-jwks-type',
  ISSUER_1_JWKS_URL: 'issuer-1-jwks-url',

  // Error test data
  INVALID_JWKS_PATH: '/nonexistent/path/to/jwks.json',
  INVALID_URL: 'invalid-url-format',
  MALFORMED_JSON: '{"malformed": json}',

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

// Common strings to reduce duplication warnings
export const COMMON_STRINGS = {
  // Processor dialog strings
  ADD_PROCESSOR: 'Add Processor',
  PROCESSOR_CONFIGURATION: 'Processor Configuration',
  PROPERTIES: 'Properties',
  SETTINGS: 'Settings',

  // Button text
  ADD: 'Add',
  APPLY: 'Apply',
  OK: 'OK',
  CANCEL: 'Cancel',
  DELETE: 'Delete',
  SAVE: 'Save',

  // Status messages
  STARTED: 'Started',
  STOPPED: 'Stopped',
  RUNNING: 'Running',
  INVALID: 'Invalid',

  // Common JWT/Processor strings
  JWT_TOKEN_AUTHENTICATOR: 'JWTTokenAuthenticator',
  MULTI_ISSUER_JWT: 'MultiIssuerJWTTokenAuthenticator',
  BEARER_PREFIX: 'Bearer ',
  AUTHORIZATION_HEADER: 'Authorization',
  THIRTY_SECONDS: '30 seconds',
  SERVER_TYPE: 'Server',

  // Common URLs and paths
  LOCALHOST_8443: 'https://localhost:8443',
  LOCALHOST_8443_OAUTH_JWKS:
    'https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid-connect/certs',
  OPENID_CONNECT_CERTS: '/protocol/openid-connect/certs',
  JWKS_JSON_EXTENSION: '/jwks.json',
  TEST_EXAMPLE_COM: 'https://test.example.com',

  // Common test strings
  INVALID_URL_FORMAT: 'invalid-url',
  MALFORMED_JSON_STRING: '{"malformed": json}',
  TEST_ISSUER_PREFIX: 'test-issuer',

  // Common property names
  JWKS_TYPE_PROP: 'JWKS Type',
  JWKS_URL_PROP: 'JWKS URL',
  TOKEN_HEADER_NAME_PROP: 'Token Header Name',
  CLOCK_SKEW_PROP: 'Clock Skew',
  ISSUER_NAME_PROP: 'Issuer 1 Name',
  ISSUER_URL_PROP: 'Issuer 1 URL',

  // CSS classes
  PROCESSOR_CLASS: 'processor',
  ERROR_CLASS: 'error',
  DIALOG_CLASS: 'dialog',
  CONTEXT_MENU_CLASS: 'context-menu',
  MAT_MENU_PANEL_CLASS: 'mat-menu-panel',

  // Accessibility strings
  ROLE_DIALOG: 'dialog',
  ROLE_BUTTON: 'button',
  ROLE_MENUBAR: 'menubar',
  ROLE_MENU: 'menu',

  // Cypress test helpers
  FORCE_TRUE: { force: true },
  TIMEOUT_5000: { timeout: 5000 },
  TIMEOUT_10000: { timeout: 10000 },

  // NiFi UI element selector
  NIFI_ELEMENT: 'nifi',

  // Common duplicate strings found in tests
  PROCESSOR_PROPERTY_ROW_SELECTOR: '.processor-property-row',
  INVALID_JWKS_PATH_LITERAL: '/nonexistent/path/to/jwks.json',

  // Common duplicate strings from various files
  CANVAS_CONTAINER_SELECTOR: '#canvas-container',
  CONTEXT_MENU_SELECTOR: '.context-menu',
  MAT_MENU_PANEL_SELECTOR: '.mat-menu-panel',

  // Status text constants
  PROCESSED_COLON: 'Processed:',
  VALID_COLON: 'Valid:',
  INVALID_COLON: 'Invalid:',

  // Very common duplicate strings found in linting
  CANVAS_SELECTOR: '.canvas',
  PROCESSOR_LIST_SELECTOR: '.processor-list, .processor-grid',
  PROCESSOR_RESULTS_SELECTOR: '.processor-list, .processor-results',
  NOTIFICATION_SELECTOR: '.notification, .toast, .alert',
  POPUP_MENU_SELECTOR: '.context-menu, .popup-menu',
  ERROR_INVALID_VALIDATION_SELECTOR: '.error, .invalid, .validation-error',
  TOOLBAR_SIDEBAR_SELECTOR: '.toolbar, .sidebar',
  PROCESSOR_CONFIGURATION_DIALOG_SELECTOR: '.processor-configuration-dialog',

  // Common duplication warnings - strings
  VALID_TOKENS_STRING: 'Valid Tokens',
  INVALID_TOKENS_STRING: 'Invalid Tokens',
  ADD_PROCESSOR_STRING: 'Add Processor',
  PROPERTIES_STRING: 'Properties',
  SETTINGS_STRING: 'Settings',

  // Common duplicate strings from validation tests
  TEST_SUBJECT_STRING: 'test-subject',

  // Common selectors causing duplicates
  PROPERTY_EDITOR_SELECTOR: '.property-editor',
  CONFIGURATION_TAB_SELECTOR: '.configuration-tab',

  // Common strings from i18n tests
  BODY_SELECTOR: 'body',

  // Most frequent duplicate strings from linting warnings
  CANVAS_STRING: '.canvas',
  BODY_STRING: 'body',

  // Common accessibility test strings
  HAVE_FOCUS_STRING: 'have.focus',
  BE_FOCUSED_STRING: 'be.focused',

  // Common UI text patterns
  VALID_TOKENS_TEXT: 'Valid Tokens',
  INVALID_TOKENS_TEXT: 'Invalid Tokens',

  // Property row selectors
  PROPERTY_ROW_SELECTOR: '.property-row',

  // Element state classes
  DISABLED_CLASS: 'disabled',
  ENABLED_CLASS: 'enabled',
  VISIBLE_CLASS: 'visible',
  HIDDEN_CLASS: 'hidden',

  // Common CSS selectors found in duplicate string warnings
  PROCESSOR_SELECTOR_ALT: 'g.processor',
  AUTHORIZATION_HEADER_NAME: 'Authorization',
  BEARER_TOKEN_PREFIX: 'Bearer ',
  STANDARD_TIMEOUT: '5000',

  // Common test data URLs
  TEST_ISSUER_EXAMPLE_URL: 'https://issuer1.example.com',
  JWKS_JSON_PATH: '/jwks.json',
  WELL_KNOWN_JWKS_PATH: '/.well-known/jwks.json',

  // Common validation messages
  VALIDATION_ERROR_MESSAGE: 'Validation error',
  REQUIRED_FIELD_MESSAGE: 'This field is required',
  INVALID_URL_MESSAGE: 'Invalid URL format',

  // Common assertion patterns
  SHOULD_BE_VISIBLE: 'should be visible',
  SHOULD_CONTAIN: 'should contain',
  SHOULD_EXIST: 'should exist',

  // Cypress command timeouts
  DEFAULT_COMMAND_TIMEOUT: 4000,
  EXTENDED_COMMAND_TIMEOUT: 8000,
  MAX_COMMAND_TIMEOUT: 15000,
};
