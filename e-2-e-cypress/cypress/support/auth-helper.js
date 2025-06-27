/**
 * @file Authentication Helper - NiFi Session Management
 * Provides stateful login/logout functionality using cy.session()
 * Following Cypress best practices for 2024
 */

/**
 * Login helper using cy.session() for optimal performance
 * This creates a cached session that persists across tests
 * @param {string} [username='admin'] - Username for authentication
 * @param {string} [password='adminadminadmin'] - Password for authentication
 * @example
 * // Login with default credentials
 * cy.loginNiFi();
 *
 * // Login with custom credentials
 * cy.loginNiFi('testuser', 'testpass');
 */
Cypress.Commands.add('loginNiFi', (username = 'admin', password = 'adminadminadmin') => {
  const sessionId = `nifi-session-${username}`;

  cy.session(
    sessionId,
    () => {
      // Setup function - only runs when session doesn't exist or is invalid
      cy.log(`🔑 Creating new session for user: ${username}`);

      // Start by visiting the login page directly
      cy.visit('#/login', {
        timeout: 30000,
        failOnStatusCode: false,
      });

      // Wait for page to be ready
      cy.get('body', { timeout: 10000 }).should('exist');

      // Check if we're actually on the login page or already logged in
      cy.url().then((url) => {
        cy.log(`Current URL after visit: ${url}`);

        if (url.includes('/login') || url.includes('login')) {
          cy.log('On login page - performing authentication...');

          // Perform login with reliable selectors
          cy.get(
            '[data-testid="username"], input[type="text"], input[id*="username"], input[name="username"]',
            {
              timeout: 10000,
            }
          )
            .should('be.visible')
            .clear()
            .type(username);

          cy.get(
            '[data-testid="password"], input[type="password"], input[id*="password"], input[name="password"]'
          )
            .should('be.visible')
            .clear()
            .type(password);

          cy.get(
            '[data-testid="login-button"], input[value="Login"], button[type="submit"], button:contains("Login")'
          ).click();

          // Wait for successful login
          cy.url({ timeout: 15000 }).should('not.contain', '/login');
          cy.log('✅ Login successful - redirected away from login page');
        } else {
          cy.log('Not on login page - checking if already logged in...');

          // Try to navigate to canvas to verify we're logged in
          cy.visit('#/canvas', {
            timeout: 30000,
            failOnStatusCode: false,
          });
        }
      });

      // Final verification - ensure we can access the canvas
      cy.visit('#/canvas', {
        timeout: 30000,
        failOnStatusCode: false,
      });

      // Verify we're on the canvas page (more lenient than checking for specific elements)
      cy.url({ timeout: 5000 }).should('contain', '#/canvas');
      cy.url({ timeout: 5000 }).should('not.contain', '/login');

      cy.log('✅ Session created and validated');
    },
    {
      // Validation function - ensures session is still valid
      validate() {
        cy.log('🔍 Validating existing session...');

        // Visit the main canvas page to check if we're still logged in
        cy.visit('#/canvas', {
          timeout: 30000,
          failOnStatusCode: false,
        });

        // Verify we're not redirected to login page
        cy.url({ timeout: 5000 }).should('not.contain', '/login');

        // More lenient validation - just check that we're on the canvas page
        cy.url({ timeout: 5000 }).should('contain', '#/canvas');

        cy.log('✅ Session validation successful');
      },
      // Cache session across all specs for maximum efficiency
      cacheAcrossSpecs: true,
    }
  );
});

/**
 * Logout helper - clears the current session
 * @example
 * // Logout and clear all session data
 * cy.logoutNiFi();
 */
Cypress.Commands.add('logoutNiFi', () => {
  cy.log('🚪 Performing logout...');

  // Try to find and click logout button
  cy.get('body').then(($body) => {
    const logoutSelectors = [
      'button:contains("Logout")',
      'a:contains("Logout")',
      '[data-testid="logout"]',
      '.logout',
      '#logout',
    ];

    let logoutFound = false;
    logoutSelectors.forEach((selector) => {
      if ($body.find(selector).length > 0) {
        cy.get(selector).first().click();
        logoutFound = true;
        return false; // break
      }
    });

    if (!logoutFound) {
      cy.log('No logout button found - clearing session manually');
    }
  });

  // Clear all session data
  cy.clearCookies();
  cy.clearLocalStorage();
  cy.clearAllSessionStorage();

  // Verify logout - should redirect to login
  cy.visit('/#/canvas', { timeout: 5000, failOnStatusCode: false });
  cy.url({ timeout: 3000 }).should('contain', 'login');

  cy.log('✅ Logout successful - session cleared');
});

/**
 * Get current session context information
 * Useful for debugging and test verification
 * @returns {Object} Session context object
 * @returns {string} returns.url - Current page URL
 * @returns {string} returns.title - Page title
 * @returns {boolean} returns.isLoggedIn - Whether user is logged in
 * @returns {boolean} returns.isNiFiPage - Whether we're on a NiFi page
 * @returns {boolean} returns.hasCanvas - Whether canvas element exists
 * @returns {boolean} returns.hasCanvasContainer - Whether canvas container exists
 * @returns {boolean} returns.isReady - Whether NiFi is ready for testing
 * @returns {string} returns.timestamp - ISO timestamp
 * @example
 * cy.getSessionContext().then((context) => {
 *   expect(context.isReady).to.be.true;
 *   cy.log('Session state:', context);
 * });
 */
Cypress.Commands.add('getSessionContext', () => {
  cy.log('📋 Getting session context...');

  return cy.url().then((currentUrl) => {
    return cy.title().then((pageTitle) => {
      // Use cy.get('body') to ensure the body element is available
      return cy.get('body', { log: false }).then(($body) => {
        // Check for canvas elements in the DOM
        const hasCanvas = $body.find('#canvas, svg').length > 0;
        const hasCanvasContainer =
          $body.find('#canvas-container, [data-testid="canvas-container"]').length > 0;

        // More conservative authentication detection
        // Only consider logged in if we have strong evidence of authentication
        const urlIndicatesNotLogin =
          !currentUrl.includes('/login') &&
          !currentUrl.includes('login') &&
          !currentUrl.includes('#/login');
        const hasCanvasElements = hasCanvas && hasCanvasContainer; // Both must be present

        // Check for authentication-specific indicators (this is a simplified check)
        // In a real scenario, you might check for auth tokens, user info, etc.
        const hasAuthIndicators = urlIndicatesNotLogin && hasCanvasElements;

        // Be more conservative - only consider logged in if we have clear auth indicators
        // AND we're not on a login page AND we have functional canvas elements
        const isLoggedIn =
          hasAuthIndicators && urlIndicatesNotLogin && !currentUrl.includes('about:blank');
        const isNiFiPage =
          pageTitle.includes('NiFi') ||
          pageTitle.includes('nifi') ||
          pageTitle.toLowerCase().includes('apache');

        const sessionContext = {
          url: currentUrl,
          title: pageTitle,
          isLoggedIn: isLoggedIn,
          isNiFiPage: isNiFiPage,
          hasCanvas: hasCanvas,
          hasCanvasContainer: hasCanvasContainer,
          isReady: isLoggedIn && isNiFiPage,
          timestamp: new Date().toISOString(),
          toString() {
            return `SessionContext{url: ${this.url}, isLoggedIn: ${this.isLoggedIn}, isReady: ${this.isReady}, hasCanvas: ${this.hasCanvas}, timestamp: ${this.timestamp}}`;
          }
        };

        // Log the context for debugging (removed console.log to fix linting)

        // Return the context wrapped in cy.wrap to maintain Cypress chain
        return cy.wrap(sessionContext);
      });
    });
  });
});

/**
 * Ensure NiFi is ready for testing
 * Combines login and readiness checks in one command
 * @param {string} [username='admin'] - Username for authentication
 * @param {string} [password='adminadminadmin'] - Password for authentication
 * @param {Object} [options={}] - Additional options
 * @param {boolean} [options.forceLogin=false] - Force new login even if session exists
 * @example
 * // Use in beforeEach for self-sufficient tests
 * beforeEach(() => {
 *   cy.ensureNiFiReady();
 * });
 *
 * // Use with custom credentials
 * cy.ensureNiFiReady('testuser', 'testpass');
 *
 * // Force fresh login
 * cy.ensureNiFiReady('admin', 'adminadminadmin', { forceLogin: true });
 */
Cypress.Commands.add(
  'ensureNiFiReady',
  (username = 'admin', password = 'adminadminadmin', options = {}) => {
    cy.log('🚀 Ensuring NiFi is ready for testing...');

    // Use retrieveSession for intelligent session management
    return cy.retrieveSession(username, password, options).then((context) => {
      // Log the context for debugging first
      cy.log(
        `Session context: URL=${context.url}, isLoggedIn=${context.isLoggedIn}, hasCanvas=${context.hasCanvas}, title=${context.title}`
      );

      // If URL is about:blank, navigate to the main canvas
      if (context.url === 'about:blank') {
        cy.log('⚠️ URL is about:blank - navigating to main canvas');
        cy.visit('#/canvas', {
          timeout: 30000,
          failOnStatusCode: false,
        });

        // Wait for the page to load and verify we're on the canvas
        cy.url({ timeout: 10000 }).should('contain', '#/canvas');
        cy.url({ timeout: 5000 }).should('not.contain', '/login');

        // Get updated context after navigation
        return cy.getSessionContext().then((updatedContext) => {
          cy.log(
            `Updated context: URL=${updatedContext.url}, pageType=${updatedContext.isLoggedIn}`
          );
          return cy.wrap(updatedContext);
        });
      } else {
        // If we have a real URL, make sure it's not the login page
        expect(context.url).to.not.contain('/login');
        cy.log('✅ NiFi is ready for testing');
        return cy.wrap(context);
      }
    });
  }
);

/**
 * Retrieve existing session or create new one if needed
 * This method intelligently checks for existing valid sessions before attempting login
 * @param {string} [username='admin'] - Username for authentication
 * @param {string} [password='adminadminadmin'] - Password for authentication
 * @param {Object} [options={}] - Additional options
 * @param {boolean} [options.forceLogin=false] - Force new login even if session exists
 * @param {boolean} [options.validateSession=true] - Validate existing session before using
 * @returns {Cypress.Chainable<Object>} Session context object
 * @example
 * // Retrieve existing session or login if needed
 * cy.retrieveSession().then((context) => {
 *   expect(context.isLoggedIn).to.be.true;
 * });
 *
 * // Force new login session
 * cy.retrieveSession('admin', 'password', { forceLogin: true });
 *
 * // Retrieve session without validation (faster but less reliable)
 * cy.retrieveSession('admin', 'password', { validateSession: false });
 */
Cypress.Commands.add(
  'retrieveSession',
  (username = 'admin', password = 'adminadminadmin', options = {}) => {
    const { forceLogin = false, validateSession = true } = options;

    cy.log(`🔍 Retrieving session for user: ${username}`, { forceLogin, validateSession });

    if (forceLogin) {
      cy.log('🔄 Force login requested - clearing session and logging in');
      cy.clearSession(username);
      cy.loginNiFi(username, password);
      return cy.getSessionContext();
    }

    // Try to get current session context first
    return cy
      .getSessionContext()
      .then((context) => {
        // Use the improved isLoggedIn property that checks both URL and UI elements
        if (context.isLoggedIn && !validateSession) {
          cy.log('✅ Existing session detected (no validation requested)');
          return context;
        }

        if (context.isLoggedIn && validateSession) {
          cy.log('🔍 Existing session detected - validating...');

          // More thorough validation using the session context
          if (context.hasCanvas && context.isNiFiPage && context.isReady) {
            cy.log('✅ Session validation passed - using existing session');
            return context;
          } else {
            cy.log('⚠️ Session validation failed - performing fresh login');
            // Need to break out of this chain to avoid async/sync mixing
            return null; // Signal that we need to login
          }
        } else {
          cy.log('🚪 No existing session detected - performing login');
          // Need to break out of this chain to avoid async/sync mixing
          return null; // Signal that we need to login
        }
      })
      .then((context) => {
        // If context is null, we need to perform login
        if (context === null) {
          // Chain the login and session context retrieval properly
          return cy.loginNiFi(username, password).then(() => {
            return cy.getSessionContext();
          });
        } else {
          // Return the existing valid context
          return cy.wrap(context);
        }
      });
  }
);

/**
 * Force clear all sessions and authentication state
 * Use this when you need to guarantee a clean, unauthenticated state
 * @param {string} [username='admin'] - Username to clear session for
 * @example
 * // Clear all authentication state
 * cy.clearSession();
 *
 * // Clear specific user session
 * cy.clearSession('testuser');
 */
Cypress.Commands.add('clearSession', (username = 'admin') => {
  cy.log(`🧹 Force clearing session for user: ${username}`);

  // Clear all browser storage
  cy.clearCookies();
  cy.clearLocalStorage();
  cy.clearAllSessionStorage();

  // Visit canvas to clear any in-memory state and force redirect to login
  cy.visit('/#/canvas', {
    timeout: 30000,
    failOnStatusCode: false,
  });

  // Verify we're on the login page
  cy.url({ timeout: 3000 }).then((url) => {
    if (!url.includes('/login') && !url.includes('login')) {
      cy.log('⚠️ Not on login page after clearing session - forcing logout');

      // Try to find and click logout button
      cy.get('body').then(($body) => {
        const logoutSelectors = [
          'button:contains("Logout")',
          'a:contains("Logout")',
          '[data-testid="logout"]',
          '.logout',
          '#logout',
        ];

        let logoutFound = false;
        logoutSelectors.forEach((selector) => {
          if ($body.find(selector).length > 0) {
            cy.get(selector).first().click();
            logoutFound = true;
            return false; // break
          }
        });

        if (!logoutFound) {
          cy.log('No logout button found - trying to force redirect to login');
          // Force redirect to login page using hash routing
          cy.visit('/#/login', { timeout: 30000, failOnStatusCode: false });
        }
      });

      // Verify we're now on the login page
      cy.url({ timeout: 3000 }).should('include', '#/login');
    }
  });

  cy.log('✅ Session cleared completely');
});
