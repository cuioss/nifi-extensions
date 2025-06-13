// Debug script to examine NiFi UI structure

import { TEXT_CONSTANTS } from '../support/constants.js';

describe('NiFi UI Structure Debug', () => {
  it('should capture UI structure and selectors', () => {
    cy.visit('https://localhost:9095/nifi/');

    // Wait for page to load properly instead of arbitrary time
    cy.get('body').should(TEXT_CONSTANTS.BE_VISIBLE);
    cy.get('nifi', { timeout: 10000 }).should('exist');

    // Log the page title
    cy.title().then((title) => {
      console.log('=== PAGE TITLE ===');
      console.log(title);
    });

    // Look for all buttons and their attributes
    cy.get('body').then(($body) => {
      console.log('\n=== BUTTON ANALYSIS ===');
      const buttons = $body.find('button');
      console.log(`Found ${buttons.length} buttons total`);

      buttons.each((index, button) => {
        const $btn = Cypress.$(button);
        const attrs = {};
        Array.from(button.attributes || []).forEach((attr) => {
          attrs[attr.name] = attr.value;
        });
        console.log(`Button ${index}:`, {
          text: $btn.text().trim(),
          attributes: attrs,
          visible: $btn.is(':visible'),
        });
      });
    });

    // Look for login form elements
    cy.get('body').then(($body) => {
      console.log('\n=== LOGIN FORM ANALYSIS ===');
      const inputs = $body.find('input');
      console.log(`Found ${inputs.length} input elements total`);

      inputs.each((index, input) => {
        const $input = Cypress.$(input);
        const attrs = {};
        Array.from(input.attributes || []).forEach((attr) => {
          attrs[attr.name] = attr.value;
        });
        console.log(`Input ${index}:`, {
          type: input.type,
          attributes: attrs,
          visible: $input.is(':visible'),
        });
      });
    });

    // Look for canvas elements
    cy.get('body').then(($body) => {
      console.log('\n=== CANVAS ANALYSIS ===');
      const canvasLike = $body.find('*').filter((index, el) => {
        const $el = Cypress.$(el);
        const id = $el.attr('id') || '';
        const className = $el.attr('class') || '';
        return id.toLowerCase().includes('canvas') || className.toLowerCase().includes('canvas');
      });

      console.log(`Found ${canvasLike.length} canvas-like elements`);
      canvasLike.each((index, el) => {
        const $el = Cypress.$(el);
        console.log(`Canvas-like ${index}:`, {
          tagName: el.tagName,
          id: $el.attr('id'),
          class: $el.attr('class'),
          visible: $el.is(':visible'),
        });
      });
    });

    // Take a screenshot for visual inspection
    cy.screenshot('nifi-ui-debug');
  });
});
