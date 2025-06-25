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
      
      cy.visit('/', {
        timeout: 30000,
        failOnStatusCode: false,
      });

      // Wait for page to be ready
      cy.get('body', { timeout: 20000 }).should('exist');

      // Check if we're on login page and perform authentication
      cy.url().then((url) => {
        if (url.includes('/login') || url.includes('login')) {
          cy.log('Login page detected - performing authentication...');
          
          // Perform login
          cy.get('[data-testid="username"], input[type="text"], input[id*="username"]', {
            timeout: 10000,
          })
            .should('be.visible')
            .clear()
            .type(username);

          cy.get('[data-testid="password"], input[type="password"], input[id*="password"]')
            .should('be.visible')
            .clear()
            .type(password);

          cy.get('[data-testid="login-button"], input[value="Login"], button[type="submit"]').click();

          // Wait for successful login
          cy.url({ timeout: 15000 }).should('not.contain', '/login');
          cy.log('✅ Authentication successful');
        } else {
          cy.log('Already logged in - no authentication needed');
        }
      });

      // Ensure we have a working NiFi page
      cy.title({ timeout: 10000 }).should('contain', 'NiFi');
      
      // Wait for canvas to be ready as part of login validation
      cy.get('#canvas-container, [data-testid="canvas-container"], #canvas, svg', {
        timeout: 15000
      }).should('exist');
      
      cy.log('✅ Session created and validated');
    },
    {
      // Validation function - ensures session is still valid
      validate() {
        cy.log('🔍 Validating existing session...');
        
        // Visit the main page to check if we're still logged in
        cy.visit('/', {
          timeout: 30000,
          failOnStatusCode: false,
        });
        
        // Verify we're not redirected to login page
        cy.url({ timeout: 10000 }).should('not.contain', '/login');
        
        // Verify NiFi page is loaded
        cy.title({ timeout: 10000 }).should('contain', 'NiFi');
        
        // Verify canvas is accessible (indicates full NiFi functionality)
        cy.get('#canvas-container, [data-testid="canvas-container"], #canvas, svg', {
          timeout: 15000
        }).should('exist');
        
        cy.log('✅ Session validation successful');
      },
      // Cache session across all specs for maximum efficiency
      cacheAcrossSpecs: true
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
      '#logout'
    ];
    
    let logoutFound = false;
    logoutSelectors.forEach(selector => {
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
  
  // Verify logout
  cy.visit('/', { timeout: 30000, failOnStatusCode: false });
  cy.url({ timeout: 10000 }).should('contain', '/login');
  
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
      const hasCanvas = Cypress.$('#canvas, svg').length > 0;
      const hasCanvasContainer = Cypress.$('#canvas-container, [data-testid="canvas-container"]').length > 0;
      const isLoggedIn = !currentUrl.includes('/login');
      const isNiFiPage = pageTitle.includes('NiFi');
      
      const sessionContext = {
        url: currentUrl,
        title: pageTitle,
        isLoggedIn: isLoggedIn,
        isNiFiPage: isNiFiPage,
        hasCanvas: hasCanvas,
        hasCanvasContainer: hasCanvasContainer,
        isReady: isLoggedIn && isNiFiPage && (hasCanvas || hasCanvasContainer),
        timestamp: new Date().toISOString()
      };
      
      return sessionContext;
    });
  });
});

/**
 * Ensure NiFi is ready for testing
 * Combines login and readiness checks in one command
 * @param {string} [username='admin'] - Username for authentication
 * @param {string} [password='adminadminadmin'] - Password for authentication
 * @example
 * // Use in beforeEach for self-sufficient tests
 * beforeEach(() => {
 *   cy.ensureNiFiReady();
 * });
 * 
 * // Use with custom credentials
 * cy.ensureNiFiReady('testuser', 'testpass');
 */
Cypress.Commands.add('ensureNiFiReady', (username = 'admin', password = 'adminadminadmin') => {
  cy.log('🚀 Ensuring NiFi is ready for testing...');
  
  // Login using session (will use cached session if available)
  cy.loginNiFi(username, password);
  
  // Navigate to the page we want to test
  cy.visit('/', {
    timeout: 30000,
    failOnStatusCode: false,
  });
  
  // Basic validation that login worked
  cy.getSessionContext().then((context) => {
    expect(context.isLoggedIn).to.be.true;
    expect(context.isNiFiPage).to.be.true;
    // Don't require canvas to be ready - just ensure authentication worked
  });
  
  cy.log('✅ NiFi is ready for testing');
});
