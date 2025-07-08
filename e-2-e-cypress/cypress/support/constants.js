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
 * Canvas and UI selectors - UPDATED with verified Angular Material patterns from NiFi 2.4.0 source code analysis
 * Based on nifi-ui-structure.adoc: NiFi uses Angular 19.2.14 with Angular Material 19.2.14
 */
export const SELECTORS = {
  // ✅ VERIFIED ANGULAR MATERIAL SELECTORS (from NiFi 2.4.0 source code analysis)
  // Canvas selectors - Angular Material patterns with progressive fallbacks
  CANVAS: '#canvas-container',
  CANVAS_CONTAINER: 'mat-sidenav-content',
  CANVAS_SIDENAV_CONTAINER: 'mat-sidenav-container',
  CANVAS_SVG: 'mat-sidenav-content svg, #canvas-container svg',
  CANVAS_ELEMENTS: 'mat-sidenav-content, #canvas-container, .mat-drawer-content, body, nifi',

  // Processor selectors - SVG-based patterns within Angular Material containers
  PROCESSOR_GROUP: 'svg g[class*="processor"], svg g[data-type*="processor"], svg .component',
  PROCESSOR_ELEMENT: '.processor, [class*="processor"], .component, .flow-component',
  PROCESSOR_TEXT: '.processor-name, .component-name, text[class*="name"], .label, text',
  PROCESSOR_ICON: '.processor-icon, .component-icon, .icon, image, rect',

  // Dialog selectors - Angular Material dialog patterns
  ADD_PROCESSOR_DIALOG: 'mat-dialog-container, .mat-dialog-container, [role="dialog"]',
  PROPERTIES_DIALOG: 'mat-dialog-container, .mat-dialog-container, [role="dialog"]',
  PROCESSOR_TYPE_LIST: 'mat-list, .mat-list, mat-selection-list, .processor-types',
  PROCESSOR_TYPE_ITEM: 'mat-list-item, .mat-list-item, mat-list-option, .processor-type',
  PROCESSOR_SEARCH: 'mat-form-field input, input[matInput], input[placeholder*="Search"]',
  PROCESSOR_LIST_ITEM: 'mat-list-item, .mat-list-item, mat-list-option, .processor-type',

  // Tab selectors - Angular Material tab patterns
  PROPERTIES_TAB: 'mat-tab:contains("Properties"), .mat-tab:contains("Properties")',
  SETTINGS_TAB: 'mat-tab:contains("Settings"), .mat-tab:contains("Settings")',
  TAB_GROUP: 'mat-tab-group',

  // Form selectors - Angular Material form patterns
  PROPERTY_INPUT: 'mat-form-field input, input[matInput], .property-input',
  PROPERTY_TEXTAREA: 'mat-form-field textarea, textarea[matInput], .property-textarea',

  // Button selectors - Angular Material button patterns
  ADD_BUTTON: 'button[mat-button], button[mat-raised-button], button:contains("Add")',
  APPLY_BUTTON: 'button:contains("Apply"), .mat-button:contains("Apply")',
  CANCEL_BUTTON: 'button:contains("Cancel"), .mat-button:contains("Cancel")',
  DELETE_BUTTON: 'button:contains("Delete"), .mat-button:contains("Delete")',
  OK_BUTTON: 'button:contains("OK"), .mat-button:contains("OK")',

  // Context menu selectors - Angular Material menu patterns
  CONTEXT_MENU: 'mat-menu, .mat-menu-panel, [role="menu"]',
  CONTEXT_MENU_DELETE: 'mat-menu-item:contains("Delete"), .mat-menu-item:contains("Delete")',

  // Toolbar selectors - Angular Material toolbar patterns
  TOOLBAR: 'mat-toolbar, .mat-toolbar',
  TOOLBAR_ADD: 'mat-toolbar button[aria-label*="Add"], mat-toolbar button[title*="Add"]',

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
 * Service URLs - Centralized URL constants for all services
 */
// Define base URLs first - use environment variables if available
const KEYCLOAK_BASE_URL = Cypress.env('keycloakUrl') || 'https://localhost:9085';
const NIFI_BASE_URL = Cypress.config('baseUrl') || 'https://localhost:9095/nifi';

// Extract the base URL without the /nifi path for API calls
const NIFI_API_URL = NIFI_BASE_URL.replace(/\/nifi$/, '');

export const SERVICE_URLS = {
  // NiFi service URLs
  NIFI_BASE: NIFI_BASE_URL,
  NIFI_API_BASE: '/nifi-api',
  NIFI_LOGIN: '/#/login',
  NIFI_CANVAS: '/',
  // Use absolute URL for API endpoints to avoid baseUrl concatenation issues
  NIFI_SYSTEM_DIAGNOSTICS: `${NIFI_API_URL}/nifi-api/system-diagnostics`,

  // Keycloak service URLs
  KEYCLOAK_BASE: KEYCLOAK_BASE_URL,
  // Health endpoint is on a different port than the main Keycloak server
  KEYCLOAK_HEALTH: `http://localhost:9086/health`,
};

/**
 * Page type definitions for navigation - Updated with verified Angular Material patterns
 */
export const PAGE_DEFINITIONS = {
  [PAGE_TYPES.LOGIN]: {
    path: SERVICE_URLS.NIFI_LOGIN,
    description: 'NiFi Login Page',
    elements: ['input[type="password"]'],
  },
  [PAGE_TYPES.MAIN_CANVAS]: {
    path: SERVICE_URLS.NIFI_CANVAS,
    description: 'NiFi Main Canvas',
    elements: ['mat-sidenav-content', '#canvas-container'],
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
 * Error patterns that should be ignored - only specific NiFi-related errors
 * Generic JavaScript errors have been removed to avoid masking real issues
 */
export const IGNORED_ERROR_PATTERNS = [
  'ResizeObserver loop limit exceeded', // Browser-specific, safe to ignore
  'Non-Error promise rejection captured', // NiFi-specific promise handling
];
