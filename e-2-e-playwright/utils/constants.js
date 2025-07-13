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
 */
export const AUTH = {
  USERNAME: process.env.NIFI_USERNAME || 'admin',
  PASSWORD: process.env.NIFI_PASSWORD || 'admin123',
  ADMIN_USERNAME: process.env.NIFI_ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.NIFI_ADMIN_PASSWORD || 'admin123'
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
  KEYCLOAK_HEALTH: (process.env.PLAYWRIGHT_KEYCLOAK_URL || 'http://localhost:9080') + '/health'
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
  // Main application elements
  MAIN_CANVAS: 'mat-sidenav-content, #canvas-container, .mat-drawer-content',
  
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
  SERVICE_URLS,
  TIMEOUTS,
  SELECTORS,
  PAGE_DEFINITIONS,
  PROCESSOR_TYPES,
  ERROR_PATTERNS
};
