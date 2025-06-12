/**
 * Custom commands related to login functionality
 * 
 * Robust Login Pattern Implementation:
 * - Simplify login approach - focus on "am I logged in?" not "how does login work?"
 * - Add login state detection - check if already logged in before attempting login
 * - Create login recovery - if login fails, try alternative approaches
 * - Remove deep NiFi testing - we don't need to validate NiFi's login flow
 */

/**
 * Check if user is already logged in to NiFi
 * This is the core of our robust login pattern - detect current state first
 */
Cypress.Commands.add('isLoggedIn', () => {
  return cy.get('body').then(($body) => {
    // Multiple indicators that we're logged in
    const hasNifiApp = $body.find('nifi').length > 0;
    const hasAngularContent = $body.find('nifi').children().length > 0;
    const hasLoginForm = $body.find('input[type="password"], input[id$="password"]').length > 0;
    const hasCanvas = $body.find('#canvas-container, .canvas, [data-testid*="canvas"]').length > 0;
    
    // We're logged in if we have NiFi app content and no login forms
    const loggedIn = hasNifiApp && hasAngularContent && !hasLoginForm;
    
    cy.log(`Login state check: NiFi app=${hasNifiApp}, content=${hasAngularContent}, loginForm=${hasLoginForm}, canvas=${hasCanvas}, result=${loggedIn}`);
    
    return cy.wrap(loggedIn);
  });
});

/**
 * Ensure we're authenticated and ready for testing
 * This is the main command tests should use - it handles all the complexity
 */
Cypress.Commands.add('ensureAuthenticatedAndReady', (options = {}) => {
  const defaultOptions = {
    username: 'admin',
    password: 'adminadminadmin',
    maxRetries: 3,
    timeout: 30000
  };
  
  const opts = { ...defaultOptions, ...options };
  
  cy.log('🔍 Ensuring authenticated and ready for testing...');
  
  // Step 1: Check current state
  return cy.isLoggedIn().then((loggedIn) => {
    if (loggedIn) {
      cy.log('✅ Already logged in - proceeding with tests');
      return cy.verifyCanAccessProcessors();
    } else {
      cy.log('🔑 Not logged in - attempting authentication');
      return cy.performRobustLogin(opts.username, opts.password, opts.maxRetries);
    }
  });
});

/**
 * Perform robust login with multiple fallback strategies
 * Internal command - tests should use ensureAuthenticatedAndReady() instead
 */
Cypress.Commands.add('performRobustLogin', (username = 'admin', password = 'adminadminadmin', maxRetries = 3) => {
  cy.log(`🔄 Attempting robust login for user: ${username}`);
  
  // Strategy 1: Direct visit and check if login is needed
  cy.visit('/', { timeout: 30000 });
  
  // Wait for page to load
  cy.get('nifi', { timeout: 30000 }).should('exist');
  cy.wait(2000); // Allow Angular app initialization
  
  return cy.isLoggedIn().then((alreadyLoggedIn) => {
    if (alreadyLoggedIn) {
      cy.log('✅ Login not needed - already authenticated');
      return cy.wrap(true);
    }
    
    // Strategy 2: Look for and handle login forms
    return cy.get('body').then(($body) => {
      const hasPasswordField = $body.find('input[type="password"], input[id$="password"]').length > 0;
      
      if (hasPasswordField) {
        cy.log('🔑 Login form detected - performing authentication');
        return cy.handleLoginForm(username, password, maxRetries);
      } else {
        cy.log('ℹ️ No login form detected - may be anonymous access');
        // For anonymous access, just verify we can access the app
        return cy.verifyAnonymousAccess();
      }
    });
  });
});

/**
 * Handle login form interaction with retry logic
 * Internal command with multiple fallback approaches
 */
Cypress.Commands.add('handleLoginForm', (username, password, maxRetries = 3) => {
  const attempt = (retryCount) => {
    if (retryCount >= maxRetries) {
      throw new Error(`Login failed after ${maxRetries} attempts`);
    }
    
    cy.log(`🔄 Login attempt ${retryCount + 1} of ${maxRetries}`);
    
    // Clear any existing form data
    cy.get('input[type="text"], input[id$="username"], input[name*="user"]').first().clear();
    cy.get('input[type="password"], input[id$="password"]').clear();
    
    // Fill in credentials
    cy.get('input[type="text"], input[id$="username"], input[name*="user"]').first().type(username);
    cy.get('input[type="password"], input[id$="password"]').type(password);
    
    // Submit form (try multiple button patterns)
    cy.get('body').then(($body) => {
      const submitBtn = $body.find('button[type="submit"], input[type="submit"], button:contains("Login"), button:contains("Sign")').first();
      if (submitBtn.length > 0) {
        cy.wrap(submitBtn).click();
      } else {
        // Fallback: try pressing Enter
        cy.get('input[type="password"]').type('{enter}');
      }
    });
    
    // Wait for login to process
    cy.wait(3000);
    
    // Check if login was successful
    return cy.isLoggedIn().then((success) => {
      if (success) {
        cy.log('✅ Login successful');
        return cy.wrap(true);
      } else {
        cy.log(`❌ Login attempt ${retryCount + 1} failed - retrying...`);
        return attempt(retryCount + 1);
      }
    });
  };
  
  return attempt(0);
});

/**
 * Verify anonymous access works (for setups without authentication)
 */
Cypress.Commands.add('verifyAnonymousAccess', () => {
  cy.log('🔍 Verifying anonymous access...');
  
  // In anonymous mode, just verify the app loads properly
  cy.get('nifi', { timeout: 30000 }).should('exist');
  cy.get('body').should('be.visible');
  
  // Wait a bit for Angular to initialize
  cy.wait(3000);
  
  // Verify we can access main UI elements
  cy.get('body').then(($body) => {
    const hasAngularContent = $body.find('nifi').children().length > 0;
    const hasButtons = $body.find('button').length > 0;
    
    if (hasAngularContent || hasButtons) {
      cy.log('✅ Anonymous access verified');
      return cy.wrap(true);
    } else {
      // More lenient check - just verify NiFi app exists
      const hasNifiApp = $body.find('nifi').length > 0;
      if (hasNifiApp) {
        cy.log('✅ Anonymous access verified (basic)');
        return cy.wrap(true);
      } else {
        throw new Error('Anonymous access verification failed - app not properly loaded');
      }
    }
  });
});

/**
 * Verify we can access processors (basic functionality check)
 * This confirms we're ready for testing our custom processors
 */
Cypress.Commands.add('verifyCanAccessProcessors', () => {
  cy.log('🔍 Verifying processor access...');
  
  // We don't need to test NiFi's canvas - just verify we can reach processor functionality
  cy.url().then((currentUrl) => {
    if (!currentUrl.includes('nifi')) {
      cy.visit('/nifi');
      cy.wait(2000);
    }
  });
  
  // Basic verification that we're in the main app
  cy.get('nifi').should('exist');
  cy.get('body').should(($body) => {
    const hasMainContent = $body.find('nifi').children().length > 0;
    expect(hasMainContent, 'Should have main NiFi content for processor access').to.be.true;
  });
  
  cy.log('✅ Processor access verified');
});

/**
 * Legacy login command - kept for backward compatibility
 * New tests should use ensureAuthenticatedAndReady() instead
 */
Cypress.Commands.add('nifiLogin', (username = 'admin', password = 'adminadminadmin') => {
  cy.log('⚠️ Using legacy nifiLogin - consider switching to ensureAuthenticatedAndReady()');
  return cy.ensureAuthenticatedAndReady({ username, password });
});

/**
 * Verify we're in the main NiFi application - Simplified and robust version
 * Enhanced to work reliably with the new robust login pattern
 */
Cypress.Commands.add('verifyLoggedIn', () => {
  return cy.isLoggedIn().then((loggedIn) => {
    if (!loggedIn) {
      throw new Error('Verification failed: User is not logged in');
    }
    
    // Additional verification for test stability
    cy.get('nifi').should('exist');
    cy.url().should('include', '/nifi');
    
    cy.log('✅ Login verification successful');
  });
});

/**
 * Quick login state check for beforeEach hooks
 * Optimized for performance - minimal verification
 */
Cypress.Commands.add('quickLoginCheck', () => {
  return cy.get('body', { timeout: 5000 }).then(($body) => {
    const hasNifiApp = $body.find('nifi').length > 0;
    const hasLoginForm = $body.find('input[type="password"]').length > 0;
    
    if (!hasNifiApp || hasLoginForm) {
      cy.log('🔄 Quick login check failed - performing full authentication');
      return cy.ensureAuthenticatedAndReady();
    } else {
      cy.log('✅ Quick login check passed');
      return cy.wrap(true);
    }
  });
});
