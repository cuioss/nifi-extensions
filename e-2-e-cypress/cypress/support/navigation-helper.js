/**
 * @file Navigation Helper - Advanced "Where Am I" Pattern Implementation
 * Provides robust navigation and page verification following Cypress 2024 best practices
 * Implements multi-layered verification: URL + Content + UI State
 */

/**
 * @typedef {Object} PageContext
 * @property {string} url - Current page URL
 * @property {string} pathname - URL pathname
 * @property {string} title - Page title  
 * @property {boolean} isAuthenticated - User authentication status
 * @property {string} pageType - Detected page type
 * @property {Object} elements - UI elements found on page
 * @property {boolean} isReady - Page ready state
 * @property {Array<string>} indicators - Content indicators found
 * @property {string} timestamp - Context capture timestamp
 */

/**
 * Page type definitions with their verification criteria
 * Each page type has URL patterns, content indicators, and required elements
 */
const PAGE_DEFINITIONS = {
  LOGIN: {
    urlPatterns: ['/login', 'login'],
    contentIndicators: ['username', 'password', 'login', 'sign in'],
    requiredElements: [
      'input[type="text"], input[id*="username"], [data-testid="username"]',
      'input[type="password"], input[id*="password"], [data-testid="password"]'
    ],
    forbiddenElements: ['#canvas', 'svg[class*="canvas"]'],
    title: ['login', 'sign in', 'authenticate']
  },
  
  MAIN_CANVAS: {
    urlPatterns: ['/', '/nifi'],
    contentIndicators: ['canvas', 'processor', 'flow', 'nifi'],
    requiredElements: [
      '#canvas, svg, #canvas-container, [data-testid="canvas-container"]'
    ],
    forbiddenElements: ['input[type="password"]'],
    title: ['nifi', 'flow']
  },
  
  PROCESSOR_CONFIG: {
    urlPatterns: ['/processor', '/config'],
    contentIndicators: ['processor', 'configuration', 'properties'],
    requiredElements: [
      '[data-testid="processor"], .processor-config, #processor-configuration'
    ],
    forbiddenElements: ['input[type="password"]'],
    title: ['processor', 'configuration']
  },
  
  ERROR: {
    urlPatterns: ['/error', 'error'],
    contentIndicators: ['error', 'not found', '404', '500', 'unauthorized'],
    requiredElements: [],
    forbiddenElements: [],
    title: ['error', 'not found']
  }
};

/**
 * Advanced page detection using multi-layered verification
 * @param {PageContext} context - Current page context
 * @returns {string} Detected page type
 */
function detectPageType(context) {
  // Note: Don't use cy.log here since this is called synchronously
  
  for (const [pageType, definition] of Object.entries(PAGE_DEFINITIONS)) {
    let score = 0;
    let maxScore = 0;
    
    // URL pattern matching (weight: 3)
    maxScore += 3;
    const urlMatch = definition.urlPatterns.some(pattern => 
      context.url.toLowerCase().includes(pattern.toLowerCase()) ||
      context.pathname.toLowerCase().includes(pattern.toLowerCase())
    );
    if (urlMatch) score += 3;
    
    // Title matching (weight: 2)  
    maxScore += 2;
    const titleMatch = definition.title.some(titlePattern =>
      context.title.toLowerCase().includes(titlePattern.toLowerCase())
    );
    if (titleMatch) score += 2;
    
    // Content indicators (weight: 2)
    maxScore += 2;
    const contentMatch = definition.contentIndicators.some(indicator =>
      context.indicators.some(found => found.toLowerCase().includes(indicator.toLowerCase()))
    );
    if (contentMatch) score += 2;
    
    // Required elements presence (weight: 3)
    maxScore += 3;
    const hasRequiredElements = definition.requiredElements.length === 0 || 
      definition.requiredElements.every(selector => 
        context.elements[selector] === true
      );
    if (hasRequiredElements) score += 3;
    
    // Forbidden elements absence (weight: 1)
    maxScore += 1;
    const noForbiddenElements = definition.forbiddenElements.every(selector =>
      context.elements[selector] !== true
    );
    if (noForbiddenElements) score += 1;
    
    // Require at least 70% confidence for detection
    const confidence = score / maxScore;
    
    if (confidence >= 0.7) {
      return pageType;
    }
  }
  
  return 'UNKNOWN';
}

/**
 * Analyze UI elements on the page
 * @returns {Object} Elements analysis result
 */
function analyzePageElements() {
  const elementSelectors = [
    // Authentication elements
    'input[type="text"]', 'input[id*="username"]', '[data-testid="username"]',
    'input[type="password"]', 'input[id*="password"]', '[data-testid="password"]',
    'button[type="submit"]', '[data-testid="login-button"]',
    
    // Canvas/main app elements
    '#canvas', 'svg', '#canvas-container', '[data-testid="canvas-container"]',
    'svg[class*="canvas"]', '.canvas',
    
    // Processor elements
    '[data-testid="processor"]', '.processor', '.processor-config',
    '#processor-configuration',
    
    // Navigation elements
    'nav', '.navigation', '.toolbar', '.menu',
    
    // Error elements
    '.error', '.alert', '[role="alert"]'
  ];
  
  const elements = {};
  elementSelectors.forEach(selector => {
    elements[selector] = Cypress.$(selector).length > 0;
  });
  
  return elements;
}

/**
 * Analyze page content for indicators
 * @returns {Array<string>} Found content indicators
 */
function analyzePageContent() {
  const bodyText = Cypress.$('body').text().toLowerCase();
  const commonIndicators = [
    'username', 'password', 'login', 'sign in', 'authenticate',
    'canvas', 'processor', 'flow', 'nifi', 'configuration', 'properties',
    'error', 'not found', '404', '500', 'unauthorized', 'forbidden'
  ];
  
  return commonIndicators.filter(indicator => bodyText.includes(indicator));
}

/**
 * Get comprehensive page context with deep content analysis
 * This is the core "Where Am I" implementation
 * @returns {Cypress.Chainable<PageContext>} Promise resolving to page context
 */
Cypress.Commands.add('getPageContext', () => {
  cy.log('📋 Getting comprehensive page context...');
  
  return cy.url().then((currentUrl) => {
    return cy.location('pathname').then((pathname) => {
      return cy.title().then((pageTitle) => {
        
        // Analyze elements and content synchronously
        const elements = analyzePageElements();
        const foundIndicators = analyzePageContent();
        
        // Build context object
        const context = {
          url: currentUrl,
          pathname: pathname,
          title: pageTitle,
          isAuthenticated: !currentUrl.includes('/login') && !currentUrl.includes('login'),
          elements: elements,
          indicators: foundIndicators,
          timestamp: new Date().toISOString()
        };
        
        // Determine page type using detection algorithm
        context.pageType = detectPageType(context);
        
        // Determine ready state based on page type
        context.isReady = determineReadyState(context);
        
        // Return the context (don't use cy.log here to avoid async/sync issues)
        return context;
      });
    });
  });
});

/**
 * Determine if page is ready for testing based on page type
 * @param {PageContext} context - Page context
 * @returns {boolean} Ready state
 */
function determineReadyState(context) {
  switch (context.pageType) {
    case 'LOGIN':
      return context.elements['input[type="text"]'] || 
             context.elements['input[id*="username"]'] ||
             context.elements['[data-testid="username"]'];
             
    case 'MAIN_CANVAS':
      return context.isAuthenticated && (
        context.elements['#canvas'] ||
        context.elements['svg'] ||
        context.elements['#canvas-container'] ||
        context.elements['[data-testid="canvas-container"]']
      );
      
    case 'PROCESSOR_CONFIG':
      return context.isAuthenticated && (
        context.elements['[data-testid="processor"]'] ||
        context.elements['.processor-config'] ||
        context.elements['#processor-configuration']
      );
      
    case 'ERROR':
      return true; // Error pages are "ready" by definition
      
    default:
      return context.isAuthenticated;
  }
}

/**
 * Attempt a single navigation with verification
 * @param {string} path - Path to navigate to  
 * @param {Object} options - Navigation options
 * @param {number} attempt - Current attempt number
 * @returns {Cypress.Chainable} Navigation result
 */
function attemptSingleNavigation(path, options, attempt) {
  const { expectedPageType, timeout, retries, waitForReady } = options;
  
  cy.log(`Navigation attempt ${attempt}/${retries + 1}`);
  
  cy.visit(path, {
    timeout: timeout,
    failOnStatusCode: false
  });
  
  // Get page context and verify navigation
  return cy.getPageContext().then((context) => {
    // Verify expected page type if specified
    if (expectedPageType && context.pageType !== expectedPageType) {
      if (attempt <= retries) {
        cy.wait(1000); // Brief wait before retry
        return attemptSingleNavigation(path, options, attempt + 1);
      } else {
        throw new Error(`Navigation failed: Expected ${expectedPageType}, got ${context.pageType} after ${retries + 1} attempts`);
      }
    }
    
    // Wait for ready state if requested
    if (waitForReady && !context.isReady) {
      if (attempt <= retries) {
        cy.wait(2000); // Longer wait for page readiness
        return attemptSingleNavigation(path, options, attempt + 1);
      } else {
        // Continue anyway - don't fail on readiness for now
      }
    }
    
    // Always return the context
    return context;
  });
}

/**
 * Navigate to a specific page with verification
 * Implements robust navigation with retry logic and verification
 * @param {string} path - Path to navigate to
 * @param {Object} options - Navigation options
 * @param {string} [options.expectedPageType] - Expected page type after navigation
 * @param {number} [options.timeout=30000] - Navigation timeout
 * @param {number} [options.retries=3] - Number of retry attempts
 * @param {boolean} [options.waitForReady=true] - Wait for page ready state
 * @example
 * // Navigate to main canvas and verify
 * cy.navigateToPage('/', { expectedPageType: 'MAIN_CANVAS' });
 * 
 * // Navigate with custom timeout
 * cy.navigateToPage('/processor/123', { 
 *   expectedPageType: 'PROCESSOR_CONFIG',
 *   timeout: 45000
 * });
 */
Cypress.Commands.add('navigateToPage', (path, options = {}) => {
  const navigationOptions = {
    expectedPageType: null,
    timeout: 30000,
    retries: 3,
    waitForReady: true,
    ...options
  };
  
  cy.log(`🧭 Navigating to: ${path}`, navigationOptions);
  
  return attemptSingleNavigation(path, navigationOptions, 1);
});

/**
 * Verify you are on the expected page type
 * @param {string} expectedPageType - Expected page type
 * @param {Object} options - Verification options
 * @param {boolean} [options.strict=true] - Strict verification (fail if wrong page)
 * @param {boolean} [options.waitForReady=true] - Ensure page is ready
 * @example
 * // Strict verification - will fail if not on main canvas
 * cy.verifyPageType('MAIN_CANVAS');
 * 
 * // Loose verification - will warn but not fail
 * cy.verifyPageType('PROCESSOR_CONFIG', { strict: false });
 */
Cypress.Commands.add('verifyPageType', (expectedPageType, options = {}) => {
  const { strict = true, waitForReady = true } = options;
  
  cy.log(`🔍 Verifying page type: ${expectedPageType}`);
  
  return cy.getPageContext().then((context) => {
    if (context.pageType === expectedPageType) {
      cy.log(`✅ Page verification successful: ${expectedPageType}`);
      
      if (waitForReady && !context.isReady) {
        const message = `Page type correct (${expectedPageType}) but page is not ready for testing`;
        if (strict) {
          throw new Error(message);
        } else {
          cy.log(`⚠️ ${message} - continuing anyway`);
        }
      }
    } else {
      const message = `Page verification failed: Expected ${expectedPageType}, got ${context.pageType}`;
      if (strict) {
        throw new Error(message);
      } else {
        cy.log(`⚠️ ${message} - continuing anyway`);
      }
    }
    
    return context;
  });
});

/**
 * Wait for a specific page type to load
 * @param {string} expectedPageType - Page type to wait for
 * @param {Object} options - Wait options
 * @param {number} [options.timeout=15000] - Total timeout
 * @param {number} [options.interval=500] - Check interval
 * @example
 * // Wait for main canvas to load
 * cy.waitForPageType('MAIN_CANVAS');
 */
Cypress.Commands.add('waitForPageType', (expectedPageType, options = {}) => {
  cy.log(`⏳ Waiting for page type: ${expectedPageType}`);
  
  // Use Cypress's built-in retry mechanism
  return cy.getPageContext().should((context) => {
    if (context.pageType !== expectedPageType || !context.isReady) {
      throw new Error(`Waiting for ${expectedPageType}, got ${context.pageType}, ready: ${context.isReady}`);
    }
  }).then(() => {
    cy.log(`✅ Page type ready: ${expectedPageType}`);
    return cy.getPageContext(); // Return final context
  });
});

/**
 * Enhanced navigation with authentication check
 * Ensures user is logged in before navigating
 * @param {string} path - Path to navigate to
 * @param {Object} options - Navigation options (same as navigateToPage)
 * @example
 * // Navigate with auth check
 * cy.navigateWithAuth('/processor/config', { expectedPageType: 'PROCESSOR_CONFIG' });
 */
Cypress.Commands.add('navigateWithAuth', (path, options = {}) => {
  cy.log(`🔐 Navigating with auth check to: ${path}`);
  
  // Ensure authentication first
  cy.ensureNiFiReady();
  
  // Then navigate
  return cy.navigateToPage(path, options);
});
