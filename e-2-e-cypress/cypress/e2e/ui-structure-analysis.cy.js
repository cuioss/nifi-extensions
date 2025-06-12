// Test to examine the NiFi UI structure after successful login
describe('NiFi UI Structure Analysis', () => {
  it('should examine UI elements after login', () => {
    cy.nifiLogin();
    cy.verifyLoggedIn();
    
    // Wait for full UI to load
    cy.wait(5000);
    
    // Look for buttons and clickable elements
    cy.get('body').then(($body) => {
      console.log('\n=== POST-LOGIN UI ANALYSIS ===');
      
      // Find all buttons
      const buttons = $body.find('button');
      console.log(`Found ${buttons.length} buttons after login`);
      
      buttons.each((index, button) => {
        const $btn = Cypress.$(button);
        const text = $btn.text().trim();
        const classes = $btn.attr('class') || '';
        const id = $btn.attr('id') || '';
        const ariaLabel = $btn.attr('aria-label') || '';
        const visible = $btn.is(':visible');
        
        if (visible && (text || ariaLabel || id)) {
          console.log(`Button ${index}:`, {
            text: text,
            id: id,
            classes: classes,
            ariaLabel: ariaLabel,
            visible: visible
          });
        }
      });
      
      // Look for elements that might be the canvas or main workspace
      console.log('\n=== CANVAS/WORKSPACE ANALYSIS ===');
      const workspaceElements = $body.find('*').filter((i, el) => {
        const $el = Cypress.$(el);
        const id = $el.attr('id') || '';
        const classes = $el.attr('class') || '';
        const text = id + ' ' + classes;
        
        return text.toLowerCase().includes('canvas') || 
               text.toLowerCase().includes('workspace') || 
               text.toLowerCase().includes('flow') ||
               text.toLowerCase().includes('graph') ||
               text.toLowerCase().includes('svg');
      });
      
      console.log(`Found ${workspaceElements.length} workspace-like elements`);
      workspaceElements.each((index, el) => {
        const $el = Cypress.$(el);
        console.log(`Workspace element ${index}:`, {
          tagName: el.tagName,
          id: $el.attr('id'),
          classes: $el.attr('class'),
          visible: $el.is(':visible')
        });
      });
      
      // Look for menu or toolbar elements
      console.log('\n=== MENU/TOOLBAR ANALYSIS ===');
      const menuElements = $body.find('*').filter((i, el) => {
        const $el = Cypress.$(el);
        const id = $el.attr('id') || '';
        const classes = $el.attr('class') || '';
        const text = id + ' ' + classes;
        
        return text.toLowerCase().includes('menu') || 
               text.toLowerCase().includes('toolbar') || 
               text.toLowerCase().includes('nav') ||
               text.toLowerCase().includes('header');
      });
      
      console.log(`Found ${menuElements.length} menu/toolbar elements`);
      menuElements.each((index, el) => {
        const $el = Cypress.$(el);
        if ($el.is(':visible')) {
          console.log(`Menu element ${index}:`, {
            tagName: el.tagName,
            id: $el.attr('id'),
            classes: $el.attr('class'),
            text: $el.text().trim().substring(0, 50)
          });
        }
      });
    });
    
    // Take a screenshot for visual analysis
    cy.screenshot('ui-structure-analysis');
  });
});
