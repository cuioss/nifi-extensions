import { TEXT_CONSTANTS } from "../support/constants.js";
// Test to examine the NiFi UI structure after successful login
describe('NiFi UI Structure Analysis', () => {
  it('should examine UI elements after login', () => {
    cy.nifiLogin();
    cy.verifyLoggedIn();

    // Wait for full UI to load
    cy.get('body').should(TEXT_CONSTANTS.BE_VISIBLE);
    cy.get('button', { timeout: 10000 }).should('have.length.at.least', 1);

    // Look for buttons and clickable elements
    cy.get('body').then(($body) => {
      cy.log('\n=== POST-LOGIN UI ANALYSIS ===');

      // Find all buttons
      const buttons = $body.find('button');
      cy.log(`Found ${buttons.length} buttons after login`);

      buttons.each((index, button) => {
        const $btn = Cypress.$(button);
        const text = $btn.text().trim();
        const classes = $btn.attr('class') || '';
        const id = $btn.attr('id') || '';
        const ariaLabel = $btn.attr('aria-label') || '';
        const visible = $btn.is(':visible');

        if (visible && (text || ariaLabel || id)) {
          cy.log(`Button ${index}:`, {
            text: text,
            id: id,
            classes: classes,
            ariaLabel: ariaLabel,
            visible: visible,
          });
        }
      });

      // Look for elements that might be the canvas or main workspace
      cy.log('\n=== CANVAS/WORKSPACE ANALYSIS ===');
      const workspaceElements = $body.find('*').filter((i, el) => {
        const $el = Cypress.$(el);
        const id = $el.attr('id') || '';
        const classes = $el.attr('class') || '';
        const text = id + ' ' + classes;

        return (
          text.toLowerCase().includes('canvas') ||
          text.toLowerCase().includes('workspace') ||
          text.toLowerCase().includes('flow') ||
          text.toLowerCase().includes('graph') ||
          text.toLowerCase().includes('svg')
        );
      });

      cy.log(`Found ${workspaceElements.length} workspace-like elements`);
      workspaceElements.each((index, el) => {
        const $el = Cypress.$(el);
        cy.log(`Workspace element ${index}:`, {
          tagName: el.tagName,
          id: $el.attr('id'),
          classes: $el.attr('class'),
          visible: $el.is(':visible'),
        });
      });

      // Look for menu or toolbar elements
      cy.log('\n=== MENU/TOOLBAR ANALYSIS ===');
      const menuElements = $body.find('*').filter((i, el) => {
        const $el = Cypress.$(el);
        const id = $el.attr('id') || '';
        const classes = $el.attr('class') || '';
        const text = id + ' ' + classes;

        return (
          text.toLowerCase().includes('menu') ||
          text.toLowerCase().includes('toolbar') ||
          text.toLowerCase().includes('nav') ||
          text.toLowerCase().includes('header')
        );
      });

      cy.log(`Found ${menuElements.length} menu/toolbar elements`);
      menuElements.each((index, el) => {
        const $el = Cypress.$(el);
        if ($el.is(':visible')) {
          cy.log(`Menu element ${index}:`, {
            tagName: el.tagName,
            id: $el.attr('id'),
            classes: $el.attr('class'),
            text: $el.text().trim().substring(0, 50),
          });
        }
      });
    });

    // Take a screenshot for visual analysis
    cy.screenshot('ui-structure-analysis');
  });
});
