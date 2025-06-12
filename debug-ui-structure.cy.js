// Debug script to examine NiFi UI structure
describe('NiFi UI Structure Debug', () => {
  it('should capture UI structure and selectors', () => {
    cy.visit('https://localhost:9095/nifi/');
    
    // Wait for page to load
    cy.wait(5000);
    
    // Log the page title
    cy.title().then((title) => {
      cy.log('Page title:', title);
    });
    
    // Log the page body HTML structure (first 1000 chars)
    cy.get('body').then(($body) => {
      const bodyHtml = $body.html().substring(0, 1000);
      cy.log('Body HTML start:', bodyHtml);
    });
    
    // Look for common NiFi elements and log what we find
    cy.get('body').then(($body) => {
      const elements = [
        '[id*="canvas"]',
        '[class*="canvas"]', 
        '[id*="menu"]',
        '[class*="menu"]',
        '[id*="toolbar"]',
        '[class*="toolbar"]',
        '[id*="button"]',
        '[class*="button"]',
        'button',
        'input[type="text"]',
        'input[type="password"]',
        '[id*="login"]',
        '[class*="login"]',
        'nifi',
        '.fa-user',
        '#global-menu-button',
        '#new-processor-button'
      ];
      
      elements.forEach(selector => {
        const found = $body.find(selector);
        if (found.length > 0) {
          cy.log(`Found ${found.length} elements for selector: ${selector}`);
          // Log first element's attributes
          const firstEl = found.first();
          const attrs = {};
          Array.from(firstEl[0].attributes || []).forEach(attr => {
            attrs[attr.name] = attr.value;
          });
          cy.log(`First element attributes:`, attrs);
        } else {
          cy.log(`No elements found for selector: ${selector}`);
        }
      });
    });
    
    // Take a screenshot for visual inspection
    cy.screenshot('nifi-ui-debug');
  });
});
