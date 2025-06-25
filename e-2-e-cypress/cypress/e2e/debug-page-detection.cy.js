/**
 * @file Debug Page Detection - Temporary test to analyze actual page content
 */

describe('Debug Page Detection', () => {
  it('Should analyze actual page content for debugging', () => {
    cy.visit('/');
    
    // Wait a bit for page to load
    cy.wait(3000);
    
    // Get comprehensive page context
    cy.getPageContext().then((context) => {
      cy.log('=== COMPLETE PAGE CONTEXT DEBUG ===');
      cy.log('URL:', context.url);
      cy.log('Pathname:', context.pathname);
      cy.log('Title:', context.title);
      cy.log('Page Type Detected:', context.pageType);
      cy.log('Is Authenticated:', context.isAuthenticated);
      cy.log('Is Ready:', context.isReady);
      
      cy.log('=== CONTENT INDICATORS ===');
      cy.log('Found indicators:', context.indicators);
      
      cy.log('=== ELEMENT ANALYSIS ===');
      Object.entries(context.elements).forEach(([selector, found]) => {
        if (found) {
          cy.log(`✅ Found: ${selector}`);
        }
      });
      
      // Log missing elements for login detection
      const loginElements = [
        'input[type="text"]', 'input[id*="username"]', '[data-testid="username"]',
        'input[type="password"]', 'input[id*="password"]', '[data-testid="password"]'
      ];
      
      cy.log('=== LOGIN ELEMENTS CHECK ===');
      loginElements.forEach(selector => {
        if (context.elements[selector]) {
          cy.log(`✅ Login element found: ${selector}`);
        } else {
          cy.log(`❌ Login element missing: ${selector}`);
        }
      });
      
      // Log canvas elements
      const canvasElements = [
        '#canvas', 'svg', '#canvas-container', '[data-testid="canvas-container"]'
      ];
      
      cy.log('=== CANVAS ELEMENTS CHECK ===');
      canvasElements.forEach(selector => {
        if (context.elements[selector]) {
          cy.log(`✅ Canvas element found: ${selector}`);
        } else {
          cy.log(`❌ Canvas element missing: ${selector}`);
        }
      });
      
      // Dump actual page HTML for analysis
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase();
        cy.log('=== BODY TEXT SAMPLE ===');
        cy.log('First 500 chars:', bodyText.substring(0, 500));
        
        // Check for key NiFi indicators
        const nifiIndicators = ['nifi', 'apache nifi', 'canvas', 'processor', 'flow', 'username', 'password', 'login'];
        cy.log('=== NIFI INDICATORS CHECK ===');
        nifiIndicators.forEach(indicator => {
          if (bodyText.includes(indicator)) {
            cy.log(`✅ Found indicator: "${indicator}"`);
          } else {
            cy.log(`❌ Missing indicator: "${indicator}"`);
          }
        });
      });
      
      // Force test to pass so we can see the logs
      expect(true).to.be.true;
    });
  });
});
