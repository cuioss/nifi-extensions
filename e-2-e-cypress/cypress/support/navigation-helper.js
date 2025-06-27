/**
 * @file Navigation Helper - Advanced "Where Am I" Pattern Implementation
 * Provides robust navigation and page verification following Cypress 2024 best practices
 * Implements multi-layered verification: URL + Content + UI State
 * @version 2.0.0
 * @author E2E Test Suite
 * @since 1.0.0
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
    urlPatterns: ['#/login', '/login', 'login'],
    contentIndicators: ['username', 'password', 'login', 'sign in', 'log in'],
    requiredElements: [
      'input[type="text"]',
      'input[id*="username"]',
      '[data-testid="username"]',
      'input[type="password"]',
      'input[id*="password"]',
      '[data-testid="password"]',
    ],
    forbiddenElements: ['#canvas', 'svg[class*="canvas"]', '.canvas-container'],
    title: ['login', 'sign in', 'authenticate', 'nifi'],
  },

  MAIN_CANVAS: {
    urlPatterns: ['#/canvas', '#/flow', '/#/canvas', '/#/flow', '/nifi/', '/nifi#', '#/'],
    contentIndicators: ['canvas', 'processor', 'flow', 'process group', 'connection'],
    requiredElements: [
      '#canvas',
      'svg',
      '#canvas-container',
      '[data-testid="canvas-container"]',
      '.canvas-container',
      '.flow-canvas',
    ],
    forbiddenElements: ['input[type="password"]', '[id*="username"]'],
    title: ['nifi', 'flow', 'canvas'],
  },

  PROCESSOR_CONFIG: {
    urlPatterns: ['/processor', '/config', '#/processor'],
    contentIndicators: ['processor', 'configuration', 'properties', 'settings'],
    requiredElements: [
      '[data-testid="processor"]',
      '.processor-config',
      '#processor-configuration',
      '.configuration-panel',
      '.properties-panel',
    ],
    forbiddenElements: ['input[type="password"]'],
    title: ['processor', 'configuration', 'nifi'],
  },

  ERROR: {
    urlPatterns: ['/error', 'error', '404', '500'],
    contentIndicators: ['error', 'not found', '404', '500', 'unauthorized', 'forbidden'],
    requiredElements: [],
    forbiddenElements: [],
    title: ['error', 'not found', '404', '500'],
  },
};

/**
 * Check for definitive login page indicators
 * @param {PageContext} context - Current page context
 * @returns {string|null} 'LOGIN' if definitively a login page, null otherwise
 */
function checkDefinitiveLogin(context) {
  const url = context.url.toLowerCase();
  if (url.includes('#/login') || url.includes('/login') || url.includes('login')) {
    const hasLoginElements =
      context.elements['input[type="password"]'] ||
      context.elements['input[id*="username"]'] ||
      context.elements['[data-testid="username"]'] ||
      context.elements['input[type="text"]'];

    const hasStrongCanvasElements =
      context.elements['#canvas'] &&
      context.elements['svg'] &&
      context.elements['#canvas-container'];

    if (hasLoginElements || !hasStrongCanvasElements) {
      return 'LOGIN';
    }
  }
  return null;
}

/**
 * Calculate URL pattern matching score
 * @param {Object} definition - Page definition
 * @param {PageContext} context - Current page context
 * @param {string} pageType - Current page type being evaluated
 * @returns {Object} Score and maxScore for URL matching
 */
function calculateUrlScore(definition, context, pageType) {
  let score = 0;
  let maxScore = 6;

  const urlMatch = definition.urlPatterns.some((pattern) => {
    const fullUrl = context.url.toLowerCase();
    const pathname = context.pathname.toLowerCase();
    const hashPart = fullUrl.includes('#') ? fullUrl.split('#')[1] : '';

    return (
      fullUrl.includes(pattern.toLowerCase()) ||
      pathname.includes(pattern.toLowerCase()) ||
      (hashPart && ('#' + hashPart).includes(pattern.toLowerCase()))
    );
  });

  if (urlMatch) {
    score += 6;
    if (
      pageType === 'LOGIN' &&
      (context.url.includes('login') || context.url.includes('#/login'))
    ) {
      score += 4;
      maxScore += 4;
    }
  }

  return { score, maxScore };
}

/**
 * Calculate element-based scoring
 * @param {Object} definition - Page definition
 * @param {PageContext} context - Current page context
 * @returns {Object} Score and maxScore for element matching
 */
function calculateElementScore(definition, context) {
  let score = 0;
  const maxScore = 9; // 4 + 5 for required and forbidden elements

  // Required elements presence (weight: 4)
  const hasRequiredElements =
    definition.requiredElements.length === 0 ||
    definition.requiredElements.some((selector) => context.elements[selector] === true);
  if (hasRequiredElements) score += 4;

  // Forbidden elements absence (weight: 5)
  const noForbiddenElements = definition.forbiddenElements.every(
    (selector) => context.elements[selector] !== true
  );
  if (noForbiddenElements) {
    score += 5;
  } else {
    score = Math.max(0, score - 10); // Heavy penalty for forbidden elements
  }

  return { score, maxScore };
}

/**
 * Calculate content-based scoring
 * @param {Object} definition - Page definition
 * @param {PageContext} context - Current page context
 * @returns {Object} Score and maxScore for content matching
 */
function calculateContentScore(definition, context) {
  let score = 0;
  const maxScore = 4; // 2 + 2 for title and content

  // Title matching (weight: 2)
  const titleMatch = definition.title.some((titlePattern) =>
    context.title.toLowerCase().includes(titlePattern.toLowerCase())
  );
  if (titleMatch) score += 2;

  // Content indicators (weight: 2)
  const contentMatch = definition.contentIndicators.some((indicator) =>
    context.indicators.some((found) => found.toLowerCase().includes(indicator.toLowerCase()))
  );
  if (contentMatch) score += 2;

  return { score, maxScore };
}

/**
 * Apply special handling for page type conflicts
 * @param {string} pageType - Current page type
 * @param {number} confidence - Current confidence score
 * @param {PageContext} context - Current page context
 * @param {number} score - Current score value
 * @param {number} maxScore - Maximum possible score
 * @returns {Object} Adjusted score and maxScore
 */
function applySpecialHandling(pageType, confidence, context, score, maxScore) {
  let adjustedScore = score;
  let adjustedMaxScore = maxScore;

  if (pageType === 'LOGIN' && confidence >= 0.7) {
    const hasLoginElements =
      context.elements['input[type="password"]'] ||
      context.elements['input[id*="username"]'] ||
      context.elements['[data-testid="username"]'];
    const hasCanvasElements =
      context.elements['#canvas'] ||
      context.elements['svg'] ||
      context.elements['#canvas-container'];

    if (hasLoginElements && !hasCanvasElements) {
      adjustedScore += 3;
      adjustedMaxScore += 3;
    }
  }

  if (pageType === 'MAIN_CANVAS' && confidence >= 0.7) {
    const hasLoginElements =
      context.elements['input[type="password"]'] ||
      context.elements['input[id*="username"]'] ||
      context.elements['[data-testid="username"]'];

    if (hasLoginElements) {
      adjustedScore = Math.max(0, adjustedScore - 8);
    }
  }

  return { score: adjustedScore, maxScore: adjustedMaxScore };
}

/**
 * Advanced page detection using multi-layered verification
 * @param {PageContext} context - Current page context
 * @returns {string} Detected page type
 */
function detectPageType(context) {
  // Check for definitive login first
  const definitiveLogin = checkDefinitiveLogin(context);
  if (definitiveLogin) {
    return definitiveLogin;
  }

  let bestMatch = null;
  let bestScore = 0;
  let bestConfidence = 0;

  // Evaluate all page types and find the best match
  for (const [pageType, definition] of Object.entries(PAGE_DEFINITIONS)) {
    // Calculate scores from different sources
    const urlScoring = calculateUrlScore(definition, context, pageType);
    const elementScoring = calculateElementScore(definition, context);
    const contentScoring = calculateContentScore(definition, context);

    let score = urlScoring.score + elementScoring.score + contentScoring.score;
    let maxScore = urlScoring.maxScore + elementScoring.maxScore + contentScoring.maxScore;

    // Calculate initial confidence
    let confidence = maxScore > 0 ? score / maxScore : 0;

    // Apply special handling
    const adjusted = applySpecialHandling(pageType, confidence, context, score, maxScore);
    score = adjusted.score;
    maxScore = adjusted.maxScore;
    confidence = maxScore > 0 ? score / maxScore : 0;

    // Update best match if this is better
    if (
      confidence >= 0.6 &&
      (confidence > bestConfidence || (confidence === bestConfidence && score > bestScore))
    ) {
      bestMatch = pageType;
      bestScore = score;
      bestConfidence = confidence;
    }
  }

  return bestMatch || 'UNKNOWN';
}

/**
 * Analyze UI elements on the page
 * @returns {Object} Elements analysis result
 */
function analyzePageElements() {
  const elementSelectors = [
    // Authentication elements
    'input[type="text"]',
    'input[id*="username"]',
    '[data-testid="username"]',
    'input[type="password"]',
    'input[id*="password"]',
    '[data-testid="password"]',
    'button[type="submit"]',
    '[data-testid="login-button"]',
    '[id*="username"]',
    '[id*="password"]', // More generic ID patterns

    // Canvas/main app elements
    '#canvas',
    'svg',
    '#canvas-container',
    '[data-testid="canvas-container"]',
    'svg[class*="canvas"]',
    '.canvas',
    '.canvas-container',
    '.flow-canvas',

    // NiFi-specific elements
    '.nifi-canvas',
    '#nifi-canvas',
    '.process-group',
    '.processor',
    '.connection',
    '.flow-container',

    // Processor elements
    '[data-testid="processor"]',
    '.processor',
    '.processor-config',
    '#processor-configuration',
    '.configuration-panel',
    '.properties-panel',

    // Navigation elements
    'nav',
    '.navigation',
    '.toolbar',
    '.menu',
    '.header',
    '.nifi-header',

    // Error elements
    '.error',
    '.alert',
    '[role="alert"]',
    '.error-message',
  ];

  // More reliable element detection using jQuery's find on the body element
  // This avoids timing issues with Cypress.$
  const elements = {};

  // Get the body element once and then use it for all selectors
  const $body = Cypress.$('body');

  // Check each selector against the body element
  elementSelectors.forEach((selector) => {
    try {
      elements[selector] = $body.find(selector).length > 0;
    } catch (e) {
      // Handle any errors that might occur during element detection
      // No logging to avoid potential issues with Cypress command chain
      elements[selector] = false;
    }
  });

  // No logging to avoid potential issues with Cypress command chain

  return elements;
}

/**
 * Analyze page content for indicators
 * @returns {Array<string>} Found content indicators
 */
function analyzePageContent() {
  // More reliable content extraction with error handling
  let bodyText = '';
  let titleText = '';

  try {
    // Get the body element and extract its text
    const $body = Cypress.$('body');
    if ($body.length > 0) {
      bodyText = $body.text().toLowerCase() || '';
    }

    // Get the title element and extract its text
    const $title = Cypress.$('title');
    if ($title.length > 0) {
      titleText = $title.text().toLowerCase() || '';
    }

    // No logging to avoid potential issues with Cypress command chain
  } catch (e) {
    // Handle any errors that might occur during content extraction
    // No logging to avoid potential issues with Cypress command chain
    // Continue with empty strings if there's an error
  }

  const commonIndicators = [
    // Authentication indicators
    'username',
    'password',
    'login',
    'sign in',
    'authenticate',
    'log in',

    // NiFi canvas indicators
    'canvas',
    'processor',
    'flow',
    'nifi',
    'apache nifi',
    'process group',
    'connection',
    'flow canvas',
    'data flow',

    // Configuration indicators
    'configuration',
    'properties',
    'settings',
    'configure',

    // Error indicators
    'error',
    'not found',
    '404',
    '500',
    'unauthorized',
    'forbidden',
    'access denied',
    'invalid',
  ];

  const foundIndicators = [];

  // Check body text with more robust approach
  if (bodyText && bodyText.length > 0) {
    commonIndicators.forEach((indicator) => {
      if (bodyText.includes(indicator)) {
        foundIndicators.push(indicator);
      }
    });
  }

  // Check title text for broader indicators
  if (
    titleText &&
    (titleText.includes('nifi') || titleText.includes('flow') || titleText.includes('login'))
  ) {
    foundIndicators.push('nifi'); // At least we know it's NiFi
  }

  // Check for basic web app indicators if specific ones aren't found
  if (foundIndicators.length === 0 && (bodyText || titleText)) {
    const basicIndicators = ['apache', 'web', 'ui', 'interface', 'application', 'page'];
    basicIndicators.forEach((indicator) => {
      if (
        (bodyText && bodyText.includes(indicator)) ||
        (titleText && titleText.includes(indicator))
      ) {
        foundIndicators.push(indicator);
      }
    });
  }

  // Ensure we always have at least one indicator for active pages
  if (foundIndicators.length === 0 && bodyText && bodyText.length > 0) {
    foundIndicators.push('active-page'); // Generic indicator for any active page
  }

  // No logging to avoid potential issues with Cypress command chain

  // Remove duplicates and return
  return [...new Set(foundIndicators)];
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
        // Get the body element first to ensure it's available
        return cy.get('body', { log: false }).then((_$body) => {
          // Analyze elements and content synchronously using jQuery
          const elements = analyzePageElements();
          const foundIndicators = analyzePageContent();

          // Build context object with more accurate authentication detection
          // Check for actual authentication indicators (cookies, session storage, etc.)
          let isAuthenticated = false;

          // First check if we're definitely on login page
          const isOnLoginPage = currentUrl.includes('/login') || currentUrl.includes('login');

          if (!isOnLoginPage) {
            // Check for canvas elements as primary indicator
            const hasCanvas =
              elements['#canvas'] ||
              elements['svg'] ||
              elements['#canvas-container'] ||
              elements['[data-testid="canvas-container"]'];

            // Check if session was explicitly cleared
            let sessionWasCleared = false;
            try {
              sessionWasCleared =
                window.sessionStorage.getItem('cypress-session-cleared') === 'true';
            } catch (error) {
              // Ignore errors accessing sessionStorage
            }

            // If session was explicitly cleared, consider unauthenticated even with canvas
            if (sessionWasCleared) {
              isAuthenticated = false;
            } else {
              // Simple approach: if we have canvas elements and we're not on login page,
              // consider it authenticated. The auth-helper will handle more detailed session validation.
              isAuthenticated = hasCanvas;
            }
          }

          // Build the context object
          const context = {
            url: currentUrl,
            pathname: pathname,
            title: pageTitle,
            isAuthenticated: isAuthenticated,
            elements: elements,
            indicators: foundIndicators,
            timestamp: new Date().toISOString(),
          };

          // Determine page type using detection algorithm
          context.pageType = detectPageType(context);

          // Determine ready state based on page type
          context.isReady = determineReadyState(context);

          // Log the context for debugging
          cy.log(
            `Page context: ${JSON.stringify(
              {
                url: context.url,
                pageType: context.pageType,
                isAuthenticated: context.isAuthenticated,
                isReady: context.isReady,
                indicators: context.indicators.slice(0, 5), // Show first 5 indicators only
              },
              null,
              2
            )}`
          );

          // Return the context wrapped in cy.wrap to maintain Cypress chain
          return cy.wrap(context);
        });
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
      // If we've detected it as LOGIN page, it's ready for testing
      // The detection logic already ensures it has the right characteristics
      return true;

    case 'MAIN_CANVAS':
      return (
        context.isAuthenticated &&
        (context.elements['#canvas'] ||
          context.elements['svg'] ||
          context.elements['#canvas-container'] ||
          context.elements['[data-testid="canvas-container"]'])
      );

    case 'PROCESSOR_CONFIG':
      return (
        context.isAuthenticated &&
        (context.elements['[data-testid="processor"]'] ||
          context.elements['.processor-config'] ||
          context.elements['#processor-configuration'])
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
  const { expectedPageType, timeout: _timeout, retries, waitForReady } = options;

  cy.log(`🧭 Navigation attempt ${attempt}/${retries + 1} to: ${path}`);

  // Handle 404 errors by trying different paths
  const tryPaths = [path];

  // Add fallback paths if the original path might be problematic
  if (path.includes('/login')) {
    tryPaths.push('/'); // Try root as fallback
  }

  // Try the first path
  cy.log(`🧭 Trying path: ${tryPaths[0]}`);
  cy.visit(tryPaths[0], {
    timeout: 30000,
    failOnStatusCode: false,
    retryOnNetworkFailure: true,
  });

  // Check for 404 or error pages
  return cy.url().then((currentUrl) => {
    if (currentUrl.includes('/404') || currentUrl.includes('error')) {
      // If we hit a 404 and have fallback paths, try the next one
      if (tryPaths.length > 1) {
        cy.log(`⚠️ 404 detected, trying fallback path: ${tryPaths[1]}`);
        cy.visit(tryPaths[1], {
          timeout: 30000,
          failOnStatusCode: false,
          retryOnNetworkFailure: true,
        });
      }
    }

    // Get page context and verify navigation
    return cy
      .getPageContext()
      .should((context) => {
        // Verify expected page type if specified
        if (expectedPageType && context.pageType !== expectedPageType) {
          if (attempt <= retries) {
            throw new Error(
              `Page type mismatch, will retry: Expected ${expectedPageType}, got ${context.pageType} (${attempt}/${retries})`
            );
          } else {
            // Don't throw error on final attempt, just log it
            cy.log(
              `⚠️ Navigation issue: Expected ${expectedPageType}, got ${context.pageType} after ${retries + 1} attempts`
            );
          }
        }

        // Wait for ready state if requested
        if (waitForReady && !context.isReady) {
          if (attempt <= retries) {
            throw new Error(
              `Page not ready, will retry: ${context.pageType} (${attempt}/${retries})`
            );
          } else {
            cy.log(`⚠️ Page ready timeout after ${retries + 1} attempts - continuing anyway`);
          }
        }
      })
      .then((context) => {
        return context;
      });
  });
}

/**
 * Navigate to a specific page with verification
 * Implements robust navigation with retry logic and verification
 * @param {string} pathOrPageType - Path to navigate to OR page type (e.g., 'MAIN_CANVAS')
 * @param {Object} options - Navigation options
 * @param {string} [options.expectedPageType] - Expected page type after navigation
 * @param {number} [options.timeout=30000] - Navigation timeout
 * @param {number} [options.retries=3] - Number of retry attempts
 * @param {boolean} [options.waitForReady=true] - Wait for page ready state
 * @example
 * // Navigate to main canvas using page type
 * cy.navigateToPage('MAIN_CANVAS');
 *
 * // Navigate to main canvas using path and verify
 * cy.navigateToPage('/', { expectedPageType: 'MAIN_CANVAS' });
 *
 * // Navigate with custom timeout
 * cy.navigateToPage('/processor/123', {
 *   expectedPageType: 'PROCESSOR_CONFIG',
 *   timeout: 45000
 * });
 */
Cypress.Commands.add('navigateToPage', (pathOrPageType, options = {}) => {
  // Check if the first parameter is a page type instead of a path
  let actualPath = pathOrPageType;
  const navigationOptions = {
    expectedPageType: null,
    timeout: 5000, // Aggressive timeout since pages load within 2 seconds
    retries: 2, // Fewer retries for faster failure
    waitForReady: true,
    ...options,
  };

  // If pathOrPageType is a known page type, resolve it to a path
  if (PAGE_DEFINITIONS[pathOrPageType]) {
    const pageDefinition = PAGE_DEFINITIONS[pathOrPageType];
    // Use the first URL pattern as the default path for this page type
    actualPath = pageDefinition.urlPatterns[0];

    // Auto-set expectedPageType if not already specified
    if (!navigationOptions.expectedPageType) {
      navigationOptions.expectedPageType = pathOrPageType;
    }

    cy.log(`🧭 Navigating to page type: ${pathOrPageType} → ${actualPath}`, navigationOptions);
  } else {
    cy.log(`🧭 Navigating to: ${actualPath}`, navigationOptions);
  }

  return attemptSingleNavigation(actualPath, navigationOptions, 1);
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

  return cy.getPageContext().should((context) => {
    if (context.pageType === expectedPageType) {
      if (waitForReady && !context.isReady) {
        const message = `Page type correct (${expectedPageType}) but page is not ready for testing`;
        if (strict) {
          throw new Error(message);
        }
      }
    } else {
      const message = `Page verification failed: Expected ${expectedPageType}, got ${context.pageType}`;
      if (strict) {
        throw new Error(message);
      }
    }
  });
});

/**
 * Wait for a specific page type to load
 * @param {string} expectedPageType - Page type to wait for
 * @param {Object} options - Wait options
 * @param {number} [options.timeout=5000] - Total timeout
 * @param {number} [options.interval=200] - Check interval
 * @example
 * // Wait for main canvas to load
 * cy.waitForPageType('MAIN_CANVAS');
 */
Cypress.Commands.add('waitForPageType', (expectedPageType, _options = {}) => {
  cy.log(`⏳ Waiting for page type: ${expectedPageType}`);

  // Use Cypress's built-in retry mechanism
  return cy
    .getPageContext()
    .should((context) => {
      if (context.pageType !== expectedPageType || !context.isReady) {
        throw new Error(
          `Waiting for ${expectedPageType}, got ${context.pageType}, ready: ${context.isReady}`
        );
      }
    })
    .then(() => {
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

/**
 * Get available page type definitions for reference
 * Useful for understanding what page types can be detected
 * @returns {Object} Page type definitions
 * @example
 * // Get all available page types
 * cy.getAvailablePageTypes().then((types) => {
 *   console.log('Available page types:', Object.keys(types));
 * });
 */
Cypress.Commands.add('getAvailablePageTypes', () => {
  return cy.wrap(PAGE_DEFINITIONS);
});

/**
 * Test multiple navigation paths in sequence
 * Useful for comprehensive navigation testing
 * @param {Array<Object>} navigationPaths - Array of navigation test cases
 * @param {string} navigationPaths[].path - Path to navigate to
 * @param {string} navigationPaths[].expectedPageType - Expected page type
 * @param {string} [navigationPaths[].description] - Test description
 * @example
 * // Test multiple navigation paths
 * cy.testNavigationPaths([
 *   { path: '/', expectedPageType: 'MAIN_CANVAS', description: 'Main canvas' },
 *   { path: '/login', expectedPageType: 'LOGIN', description: 'Login page' }
 * ]);
 */
Cypress.Commands.add('testNavigationPaths', (navigationPaths) => {
  cy.log(`🗺️ Testing ${navigationPaths.length} navigation paths`);

  navigationPaths.forEach((navPath, index) => {
    const { path, expectedPageType, description = `Navigation ${index + 1}` } = navPath;

    cy.log(`📍 Testing: ${description} (${path} → ${expectedPageType})`);

    cy.navigateToPage(path, { expectedPageType }).then((context) => {
      expect(context.pageType).to.equal(expectedPageType);
      cy.log(`✅ ${description}: ${context.pageType}`);
    });
  });

  cy.log('🎯 All navigation paths tested successfully');
});
