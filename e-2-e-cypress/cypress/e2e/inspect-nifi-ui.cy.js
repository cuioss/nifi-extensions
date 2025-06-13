import { TEXT_CONSTANTS } from '../support/constants.js';
// Debug script to examine NiFi UI and identify actual login elements
describe('NiFi UI Inspection', () => {
  it('should identify login elements and canvas structure', () => {
    // Use centralized URL configuration instead of hardcoded URL
    cy.visit('/');

    // Wait for Angular to load
    cy.get('body', { timeout: 30000 }).should(TEXT_CONSTANTS.EXIST);

    // Check if we're on a login page or directly on canvas
    cy.get('body').then(($body) => {
      // First, let's see what type of page we're on
      const bodyText = $body.text();
      const hasLoginText =
        bodyText.toLowerCase().includes('login') ||
        bodyText.toLowerCase().includes('username') ||
        bodyText.toLowerCase().includes('password');

      cy.log(`Page has login-related text: ${hasLoginText}`);

      // Look for any input fields
      const inputs = $body.find('input');
      cy.log(`Found ${inputs.length} input fields`);

      if (inputs.length > 0) {
        inputs.each((index, input) => {
          const $input = Cypress.$(input);
          cy.log(
            `Input ${index}: type=${input.type}, placeholder="${$input.attr('placeholder')}", name="${$input.attr('name')}", id="${$input.attr('id')}"`
          );
        });
      }

      // Look for buttons
      const buttons = $body.find('button');
      cy.log(`Found ${buttons.length} buttons`);

      if (buttons.length > 0) {
        buttons.each((index, button) => {
          const $btn = Cypress.$(button);
          const text = $btn.text().trim();
          cy.log(
            `Button ${index}: text="${text}", type="${$btn.attr('type')}", class="${$btn.attr('class')}"`
          );
        });
      }

      // Look for canvas or main UI elements
      const canvasElements = $body.find('*').filter((i, el) => {
        const $el = Cypress.$(el);
        const id = ($el.attr('id') || '').toLowerCase();
        const className = ($el.attr('class') || '').toLowerCase();
        return (
          id.includes('canvas') ||
          className.includes('canvas') ||
          id.includes('toolbar') ||
          className.includes('toolbar') ||
          id.includes('flow') ||
          className.includes('flow')
        );
      });

      cy.log(`Found ${canvasElements.length} canvas/flow/toolbar elements`);

      // Check for Angular app element
      const nifiElement = $body.find('nifi');
      cy.log(`Found ${nifiElement.length} <nifi> elements`);

      // Take a screenshot
      cy.screenshot('nifi-ui-inspection');
    });
  });
});
