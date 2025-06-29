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
 * Canvas and UI selectors - UPDATED with research-based patterns for real NiFi UI
 * Based on test failures: NiFi uses traditional web technologies, not Angular Material
 */
export const SELECTORS = {
  // ❌ ANGULAR MATERIAL SELECTORS (PROVEN WRONG by integration tests) - kept for reference
  CANVAS_ANGULAR_OLD: 'mat-sidenav-content, .mat-drawer-content',
  TOOLBAR_ANGULAR_OLD: 'mat-toolbar, .mat-toolbar',
  DIALOG_ANGULAR_OLD: 'mat-dialog-container, .mat-dialog-container',

  // ✅ RESEARCH-BASED SELECTORS FOR REAL NIFI UI
  // Canvas selectors - traditional NiFi patterns with progressive fallbacks
  CANVAS: '#canvas-container, .canvas-container, [id*="canvas"], main, .main-content',
  CANVAS_CONTAINER: '#canvas-container, .canvas-container, [id*="canvas"], .flow-canvas-container',
  CANVAS_SVG: '#canvas, svg[id*="canvas"], .canvas svg, svg, [role="img"]',
  CANVAS_ELEMENTS: '#canvas, #canvas-container, svg, .canvas, .flow-canvas',

  // Processor selectors - SVG-based patterns for flow elements
  PROCESSOR_GROUP: 'svg g[class*="processor"], svg g[data-type*="processor"], svg .component, svg g.component',
  PROCESSOR_ELEMENT: '.processor, [class*="processor"], .component, .flow-component, g.processor',
  PROCESSOR_TEXT: '.processor-name, .component-name, text[class*="name"], .label, text',
  PROCESSOR_ICON: '.processor-icon, .component-icon, .icon, image, rect',

  // Dialog selectors - traditional web dialog patterns
  ADD_PROCESSOR_DIALOG: '[role="dialog"], .dialog, .modal, .popup, .processor-dialog, [id*="dialog"]',
  PROCESSOR_TYPE_LIST: '.processor-types, .component-list, ul, ol, .list',
  PROCESSOR_TYPE_ITEM: '.processor-type, .component-item, li, .list-item, .option',
  PROCESSOR_SEARCH: 'input[placeholder*="Search"], input[type="search"], input[name*="search"], .search input',
  PROCESSOR_LIST_ITEM: '.processor-type, .component-item, li, .list-item, .option',

  // Button selectors - traditional web button patterns
  ADD_BUTTON: 'button:contains("Add"), input[value*="Add"], .add-button, [title*="Add"], [aria-label*="Add"]',
  CANCEL_BUTTON: 'button:contains("Cancel"), input[value*="Cancel"], .cancel-button',
  DELETE_BUTTON: 'button:contains("Delete"), input[value*="Delete"], .delete-button',

  // Context menu selectors - traditional web menu patterns
  CONTEXT_MENU: '[role="menu"], .context-menu, .menu, .popup-menu, ul.menu',
  CONTEXT_MENU_DELETE: '[role="menuitem"]:contains("Delete"), .menu-item:contains("Delete"), li:contains("Delete")',

  // Toolbar selectors - traditional web toolbar patterns
  TOOLBAR: '#nf-header, .nf-header, .toolbar, [role="toolbar"], .header, .top-bar',
  TOOLBAR_ADD: 'button[title*="Add"], button[aria-label*="Add"], .add-processor, .toolbar button',

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
 * Error patterns that should be ignored - only specific NiFi-related errors
 * Generic JavaScript errors have been removed to avoid masking real issues
 */
export const IGNORED_ERROR_PATTERNS = [
  'ResizeObserver loop limit exceeded',        // Browser-specific, safe to ignore
  'Non-Error promise rejection captured',      // NiFi-specific promise handling
];
