/**
 * @file Focused Selector Analysis for Phase 0
 * This test gathers essential selector information for Phase 0 implementation
 *
 * 🎯 PURPOSE: Identify real NiFi selectors to replace assumptions
 */

describe('Phase 0: Focused Selector Analysis', () => {
  beforeEach(() => {
    cy.visit('https://localhost:9095/nifi', {
      failOnStatusCode: false,
      timeout: 30000
    });

    // Handle authentication
    cy.get('body').then(($body) => {
      if ($body.find('input[type="password"]').length > 0) {
        cy.get('input[type="text"]').type('testUser');
        cy.get('input[type="password"]').type('drowssap');
        cy.get('button[type="submit"]').click();
        cy.wait(3000);
      }
    });
  });

  it('🔍 Find Real Canvas Selectors', () => {
    cy.log('🔍 Analyzing real NiFi canvas selectors...');

    cy.wait(2000);

    cy.get('body').then(($body) => {
      // Test our current assumed selectors
      const currentSelectors = [
        '#canvas svg',
        '#canvas',
        'svg',
        '#canvas-container'
      ];

      const results = {};

      currentSelectors.forEach(selector => {
        const elements = $body.find(selector);
        results[selector] = {
          found: elements.length > 0,
          count: elements.length,
          visible: elements.length > 0 ? elements.first().is(':visible') : false
        };

        if (elements.length > 0) {
          const firstElement = elements.first();
          results[selector].details = {
            tag: firstElement.prop('tagName'),
            id: firstElement.attr('id') || 'none',
            classes: firstElement.attr('class') || 'none',
            dimensions: `${firstElement[0].offsetWidth}x${firstElement[0].offsetHeight}`
          };
        }
      });

      // Output results
      cy.task('log', '🎯 CANVAS SELECTOR ANALYSIS RESULTS:');
      cy.task('log', '===================================');

      Object.entries(results).forEach(([selector, data]) => {
        cy.task('log', `Selector: ${selector}`);
        cy.task('log', `  Found: ${data.found} (${data.count} elements)`);
        cy.task('log', `  Visible: ${data.visible}`);
        if (data.details) {
          cy.task('log', `  Tag: ${data.details.tag}`);
          cy.task('log', `  ID: ${data.details.id}`);
          cy.task('log', `  Classes: ${data.details.classes}`);
          cy.task('log', `  Dimensions: ${data.details.dimensions}`);
        }
        cy.task('log', '');
      });

      // Look for alternative canvas selectors
      cy.task('log', '🔍 SEARCHING FOR ALTERNATIVE CANVAS SELECTORS:');

      // Find all SVG elements and analyze them
      const svgElements = $body.find('svg');
      cy.task('log', `Total SVG elements found: ${svgElements.length}`);

      svgElements.each((index, svg) => {
        const $svg = Cypress.$(svg);
        if ($svg.is(':visible') && svg.offsetWidth > 100 && svg.offsetHeight > 100) {
          cy.task('log', `Large visible SVG ${index + 1}:`);
          cy.task('log', `  ID: ${$svg.attr('id') || 'none'}`);
          cy.task('log', `  Classes: ${$svg.attr('class') || 'none'}`);
          cy.task('log', `  Dimensions: ${svg.offsetWidth}x${svg.offsetHeight}`);
          cy.task('log', `  Parent ID: ${$svg.parent().attr('id') || 'none'}`);
          cy.task('log', `  Parent Classes: ${$svg.parent().attr('class') || 'none'}`);
        }
      });
    });

    expect(true).to.be.true;
  });

  it('🔍 Find Real Toolbar Selectors', () => {
    cy.log('🔍 Analyzing real NiFi toolbar selectors...');

    cy.wait(2000);

    cy.get('body').then(($body) => {
      // Look for buttons in the top area of the page
      const topButtons = $body.find('button').filter((index, button) => {
        const $btn = Cypress.$(button);
        const offset = $btn.offset();
        return offset && offset.top < 150 && $btn.is(':visible');
      });

      cy.task('log', '🎯 TOP AREA BUTTONS ANALYSIS:');
      cy.task('log', '============================');
      cy.task('log', `Found ${topButtons.length} buttons in top 150px`);

      topButtons.slice(0, 10).each((index, button) => {
        const $btn = Cypress.$(button);
        const text = $btn.text().trim();
        const title = $btn.attr('title') || '';
        const classes = $btn.attr('class') || '';
        const id = $btn.attr('id') || '';

        cy.task('log', `Button ${index + 1}:`);
        cy.task('log', `  Text: "${text}"`);
        cy.task('log', `  Title: "${title}"`);
        cy.task('log', `  ID: "${id}"`);
        cy.task('log', `  Classes: "${classes}"`);
        cy.task('log', `  Position: ${$btn.offset()?.top || 0}, ${$btn.offset()?.left || 0}`);
        cy.task('log', '');
      });

      // Look for potential "Add" buttons
      const addButtons = $body.find('button').filter((index, button) => {
        const $btn = Cypress.$(button);
        const text = $btn.text().toLowerCase();
        const title = ($btn.attr('title') || '').toLowerCase();
        const classes = ($btn.attr('class') || '').toLowerCase();

        return (text.includes('add') || title.includes('add') || classes.includes('add')) && $btn.is(':visible');
      });

      cy.task('log', '🎯 POTENTIAL ADD BUTTONS:');
      cy.task('log', '========================');
      cy.task('log', `Found ${addButtons.length} potential add buttons`);

      addButtons.each((index, button) => {
        const $btn = Cypress.$(button);
        cy.task('log', `Add Button ${index + 1}:`);
        cy.task('log', `  Text: "${$btn.text().trim()}"`);
        cy.task('log', `  Title: "${$btn.attr('title') || ''}"`);
        cy.task('log', `  ID: "${$btn.attr('id') || ''}"`);
        cy.task('log', `  Classes: "${$btn.attr('class') || ''}"`);
        cy.task('log', '');
      });
    });

    expect(true).to.be.true;
  });

  it('📋 Generate Phase 0 Recommendations', () => {
    cy.log('📋 Generating Phase 0 implementation recommendations...');

    cy.task('log', '');
    cy.task('log', '🎯 PHASE 0 IMPLEMENTATION RECOMMENDATIONS');
    cy.task('log', '========================================');
    cy.task('log', '');
    cy.task('log', '📝 NEXT STEPS:');
    cy.task('log', '1. Review the analysis results above');
    cy.task('log', '2. Open https://localhost:9095/nifi in browser with F12 dev tools');
    cy.task('log', '3. Manually verify the selectors found in this analysis');
    cy.task('log', '4. Update cypress/support/constants.js with REAL working selectors');
    cy.task('log', '5. Test each selector manually in browser console');
    cy.task('log', '6. Create working processor add/remove operations');
    cy.task('log', '7. Only then proceed to Phase 1: Foundation Reconstruction');
    cy.task('log', '');
    cy.task('log', '🚨 CRITICAL: All selectors must be verified against real NiFi UI!');

    expect(true).to.be.true;
  });
});