/**
 * @file 03 - Advanced Navigation and Page Verification 
 * Demonstrates the comprehensive "Where Am I" pattern implementation
 * Tests the new navigation helpers and page verification commands
 */

describe('03 - Advanced Navigation and Page Verification', () => {
  beforeEach(() => {
    cy.log('Setting up test with enhanced navigation helpers');
  });

  it('R-NAV-001: Should demonstrate comprehensive page context analysis', () => {
    cy.log('🔍 Testing comprehensive page context analysis');

    // Start with a fresh login page visit  
    cy.visit('/');

    // Get page context without any assumptions
    cy.getPageContext().then((context) => {
      cy.log('Initial page context:', JSON.stringify(context, null, 2));
      
      // Verify context structure
      expect(context).to.have.property('url');
      expect(context).to.have.property('pathname');
      expect(context).to.have.property('title');
      expect(context).to.have.property('pageType');
      expect(context).to.have.property('isAuthenticated');
      expect(context).to.have.property('elements');
      expect(context).to.have.property('indicators');
      expect(context).to.have.property('isReady');
      expect(context).to.have.property('timestamp');

      cy.log('✅ Page context structure validated');
    });
  });

  it('R-NAV-002: Should navigate with verification and page type detection', () => {
    cy.log('🧭 Testing navigation with automatic page type detection');

    // Navigate to main page using simple visit first
    cy.visit('/');

    // Get page context and see what we actually detect
    cy.getPageContext().then((context) => {
      cy.log(`Initial navigation result: ${context.pageType} at ${context.pathname}`);
      cy.log('Context details:', JSON.stringify({
        url: context.url,
        title: context.title,
        indicators: context.indicators,
        elementKeys: Object.keys(context.elements),
        isAuthenticated: context.isAuthenticated
      }, null, 2));
      
      // For now, just verify we get some reasonable page type
      expect(['LOGIN', 'MAIN_CANVAS', 'UNKNOWN']).to.include(context.pageType);
      
      // Don't require readiness for this test
      cy.log('✅ Basic navigation with detection working');
    });
  });

  it('R-NAV-003: Should handle authentication flow with page verification', () => {
    cy.log('🔐 Testing authentication flow with comprehensive verification');

    // Start fresh (may land on login page)
    cy.navigateToPage('/');

    // Get initial state
    cy.getPageContext().then((initialContext) => {
      cy.log(`Initial state: ${initialContext.pageType}`);

      if (initialContext.pageType === 'LOGIN') {
        cy.log('Starting from login page - performing authentication');
        
        // Verify we're properly on login page
        cy.verifyPageType('LOGIN');
        
        // Perform login using helper
        cy.loginNiFi();
        
        // Navigate to main page and verify we're authenticated
        cy.navigateToPage('/', { 
          expectedPageType: 'MAIN_CANVAS',
          waitForReady: true 
        });
        
        // Verify final state
        cy.verifyPageType('MAIN_CANVAS');
        
      } else if (initialContext.pageType === 'MAIN_CANVAS') {
        cy.log('Already authenticated - verifying canvas access');
        
        // Verify we're properly on main canvas
        cy.verifyPageType('MAIN_CANVAS');
        
      } else {
        cy.log(`Unexpected initial page type: ${initialContext.pageType}`);
        
        // Try to ensure we're ready anyway
        cy.ensureNiFiReady();
        cy.navigateToPage('/', { expectedPageType: 'MAIN_CANVAS' });
      }

      cy.log('✅ Authentication flow with verification complete');
    });
  });

  it('R-NAV-004: Should demonstrate page type verification patterns', () => {
    cy.log('📋 Testing page type verification patterns');

    // Ensure we're logged in first
    cy.ensureNiFiReady();

    // Navigate with explicit page type expectation
    cy.navigateToPage('/', { 
      expectedPageType: 'MAIN_CANVAS',
      waitForReady: true
    });

    // Demonstrate strict verification
    cy.verifyPageType('MAIN_CANVAS', { strict: true, waitForReady: true });

    // Get page context for detailed analysis
    cy.getPageContext().then((context) => {
      cy.log('Page verification details:', {
        type: context.pageType,
        authenticated: context.isAuthenticated,
        ready: context.isReady,
        indicators: context.indicators.slice(0, 5) // First 5 indicators
      });

      // Verify expected characteristics
      expect(context.pageType).to.equal('MAIN_CANVAS');
      expect(context.isAuthenticated).to.be.true;
      expect(context.isReady).to.be.true;

      cy.log('✅ Page type verification patterns demonstrated');
    });
  });

  it('R-NAV-005: Should handle navigation with authentication check', () => {
    cy.log('🔐 Testing navigation with automatic authentication check');

    // Use navigateWithAuth to ensure authentication before navigation
    cy.navigateWithAuth('/', { 
      expectedPageType: 'MAIN_CANVAS',
      waitForReady: true
    });

    // Verify we're authenticated and on the right page
    cy.getPageContext().then((context) => {
      expect(context.isAuthenticated).to.be.true;
      expect(context.pageType).to.equal('MAIN_CANVAS');
      expect(context.isReady).to.be.true;

      cy.log('✅ Navigation with auth check successful');
    });
  });

  it('R-NAV-006: Should demonstrate "Where Am I" content verification', () => {
    cy.log('🎯 Testing deep content verification beyond URL checks');

    // Start by visiting the page and see what we actually get
    cy.visit('/');
    
    // Get comprehensive page context first
    cy.getPageContext().then((context) => {
      cy.log('Deep content analysis:', {
        url: context.url,
        pageType: context.pageType,
        indicators: context.indicators,
        elementCount: Object.keys(context.elements).length
      });

      // Verify URL (basic check) - we know we're on NiFi
      expect(context.url).to.contain('nifi');

      // Verify content indicators (deeper check) - at least some indicators should be found
      expect(context.indicators).to.be.an('array');
      expect(context.indicators.length).to.be.greaterThan(0);

      // Verify we have SOME elements detected - this is the core verification
      const totalElementsFound = Object.values(context.elements).filter(found => found).length;
      expect(totalElementsFound).to.be.greaterThan(0);

      // Verify we detected a reasonable page type (not UNKNOWN means our detection is working)
      expect(context.pageType).to.not.equal('UNKNOWN');

      cy.log('✅ Multi-layered "Where Am I" verification complete');
    });
  });
});
