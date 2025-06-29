/**
 * @file Automated DOM Analysis for Phase 0
 * This test programmatically analyzes the real NiFi DOM structure
 * to help complete Phase 0: NiFi Structure Analysis
 *
 * 🎯 PURPOSE: Generate real selector mappings to replace assumptions
 */

describe('Phase 0: Automated NiFi DOM Structure Analysis', () => {
  beforeEach(() => {
    // Visit the real NiFi instance
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
        cy.wait(3000); // Wait for login to complete
      }
    });
  });

  it('🔍 PHASE 0.1: Analyze Canvas Structure', () => {
    cy.log('🔍 Analyzing real NiFi canvas DOM structure...');

    // Wait for page to fully load
    cy.wait(2000);

    cy.get('body').then(($body) => {
      cy.log('📊 CANVAS STRUCTURE ANALYSIS RESULTS:');
      cy.log('=====================================');
      console.log('📊 CANVAS STRUCTURE ANALYSIS RESULTS:');
      console.log('=====================================');

      // 1. Look for main canvas container candidates
      const canvasCandidates = [
        '#canvas',
        '.canvas',
        '[id*="canvas"]',
        '[class*="canvas"]',
        'div[role="main"]',
        'main',
        '.nifi-canvas',
        '#nifi-canvas'
      ];

      cy.log('🎯 CANVAS CONTAINER CANDIDATES:');
      canvasCandidates.forEach(selector => {
        const elements = $body.find(selector);
        if (elements.length > 0) {
          elements.each((index, element) => {
            const $el = Cypress.$(element);
            cy.log(`✅ FOUND: ${selector}`);
            cy.log(`   - Tag: ${element.tagName}`);
            cy.log(`   - ID: ${$el.attr('id') || 'none'}`);
            cy.log(`   - Classes: ${$el.attr('class') || 'none'}`);
            cy.log(`   - Dimensions: ${element.offsetWidth}x${element.offsetHeight}`);
            cy.log(`   - Visible: ${$el.is(':visible')}`);
          });
        } else {
          cy.log(`❌ NOT FOUND: ${selector}`);
        }
      });

      // 2. Look for SVG elements
      cy.log('');
      cy.log('🎯 SVG ELEMENTS ANALYSIS:');
      const svgElements = $body.find('svg');
      cy.log(`📊 Total SVG elements found: ${svgElements.length}`);

      svgElements.each((index, svg) => {
        const $svg = Cypress.$(svg);
        cy.log(`📐 SVG ${index + 1}:`);
        cy.log(`   - ID: ${$svg.attr('id') || 'none'}`);
        cy.log(`   - Classes: ${$svg.attr('class') || 'none'}`);
        cy.log(`   - Dimensions: ${svg.getAttribute('width')}x${svg.getAttribute('height')}`);
        cy.log(`   - ViewBox: ${svg.getAttribute('viewBox') || 'none'}`);
        cy.log(`   - Parent: ${$svg.parent().prop('tagName')} (${$svg.parent().attr('class') || 'no class'})`);
        cy.log(`   - Visible: ${$svg.is(':visible')}`);

        // Check for nested groups
        const groups = $svg.find('g');
        if (groups.length > 0) {
          cy.log(`   - Nested groups: ${groups.length}`);
          groups.slice(0, 5).each((gIndex, group) => {
            const $group = Cypress.$(group);
            cy.log(`     - Group ${gIndex + 1}: class="${$group.attr('class') || 'none'}" id="${$group.attr('id') || 'none'}"`);
          });
        }
      });
    });

    // Always pass - this is analysis, not validation
    expect(true).to.be.true;
  });

  it('🔍 PHASE 0.2: Analyze Toolbar Structure', () => {
    cy.log('🔍 Analyzing real NiFi toolbar DOM structure...');

    cy.wait(2000);

    cy.get('body').then(($body) => {
      cy.log('📊 TOOLBAR STRUCTURE ANALYSIS RESULTS:');
      cy.log('=====================================');

      // 1. Look for toolbar containers
      const toolbarCandidates = [
        '.toolbar',
        '#toolbar',
        '[class*="toolbar"]',
        '[id*="toolbar"]',
        'nav',
        '.nav',
        '.header-toolbar',
        '.top-toolbar',
        '.nifi-toolbar'
      ];

      cy.log('🎯 TOOLBAR CONTAINER CANDIDATES:');
      toolbarCandidates.forEach(selector => {
        const elements = $body.find(selector);
        if (elements.length > 0) {
          elements.each((index, element) => {
            const $el = Cypress.$(element);
            cy.log(`✅ FOUND TOOLBAR: ${selector}`);
            cy.log(`   - Tag: ${element.tagName}`);
            cy.log(`   - ID: ${$el.attr('id') || 'none'}`);
            cy.log(`   - Classes: ${$el.attr('class') || 'none'}`);
            cy.log(`   - Position: top=${$el.offset()?.top || 0}, left=${$el.offset()?.left || 0}`);
            cy.log(`   - Visible: ${$el.is(':visible')}`);

            // Look for buttons within this toolbar
            const buttons = $el.find('button');
            if (buttons.length > 0) {
              cy.log(`   - Buttons found: ${buttons.length}`);
              buttons.slice(0, 10).each((btnIndex, btn) => {
                const $btn = Cypress.$(btn);
                const text = $btn.text().trim();
                const title = $btn.attr('title') || '';
                const classes = $btn.attr('class') || '';
                cy.log(`     - Button ${btnIndex + 1}: "${text}" title="${title}" class="${classes}"`);
              });
            }
          });
        } else {
          cy.log(`❌ NOT FOUND: ${selector}`);
        }
      });

      // 2. Look for buttons that might be "Add Processor"
      cy.log('');
      cy.log('🎯 ADD PROCESSOR BUTTON CANDIDATES:');
      const addButtonCandidates = [
        'button:contains("Add")',
        'button:contains("Processor")',
        'button[title*="Add"]',
        'button[title*="Processor"]',
        'button[aria-label*="Add"]',
        'button[aria-label*="Processor"]',
        '.add-processor',
        '#add-processor',
        '[class*="add"]',
        '[id*="add"]'
      ];

      addButtonCandidates.forEach(selector => {
        try {
          const elements = $body.find(selector);
          if (elements.length > 0) {
            cy.log(`✅ POTENTIAL ADD BUTTON: ${selector} (${elements.length} elements)`);
            elements.slice(0, 3).each((index, element) => {
              const $el = Cypress.$(element);
              cy.log(`   - Element ${index + 1}:`);
              cy.log(`     - Tag: ${element.tagName}`);
              cy.log(`     - Text: "${$el.text().trim()}"`);
              cy.log(`     - Title: "${$el.attr('title') || 'none'}"`);
              cy.log(`     - Classes: "${$el.attr('class') || 'none'}"`);
              cy.log(`     - ID: "${$el.attr('id') || 'none'}"`);
              cy.log(`     - Visible: ${$el.is(':visible')}`);
            });
          }
        } catch (e) {
          cy.log(`⚠️ Error checking ${selector}: ${e.message}`);
        }
      });
    });

    expect(true).to.be.true;
  });

  it('📋 PHASE 0: Generate Selector Mapping Report', () => {
    cy.log('📋 Generating comprehensive selector mapping report...');

    cy.wait(2000);

    cy.get('body').then(($body) => {
      cy.log('');
      cy.log('🎯 PHASE 0 SELECTOR MAPPING REPORT');
      cy.log('==================================');
      cy.log('');
      cy.log('📝 INSTRUCTIONS FOR MANUAL COMPLETION:');
      cy.log('1. Review the analysis results above');
      cy.log('2. Open https://localhost:9095/nifi in browser');
      cy.log('3. Use F12 Developer Tools to inspect elements');
      cy.log('4. Update cypress/support/constants.js with REAL selectors');
      cy.log('5. Test each selector manually in browser console');
      cy.log('');
      cy.log('🚨 CRITICAL: Do not proceed to Phase 1 until ALL selectors are verified!');
      cy.log('');

      // Generate a summary of what was found
      const summary = {
        svgElements: $body.find('svg').length,
        buttons: $body.find('button').length,
        clickableElements: $body.find('button, [role="button"], [onclick]').length,
        totalElements: $body.find('*').length
      };

      cy.log('📊 SUMMARY STATISTICS:');
      cy.log(`   - Total DOM elements: ${summary.totalElements}`);
      cy.log(`   - SVG elements: ${summary.svgElements}`);
      cy.log(`   - Button elements: ${summary.buttons}`);
      cy.log(`   - Clickable elements: ${summary.clickableElements}`);
      cy.log('');
      cy.log('🎯 NEXT STEPS:');
      cy.log('1. Use browser dev tools to manually inspect the actual NiFi UI');
      cy.log('2. Document REAL selectors in PHASE_0_NIFI_DOM_ANALYSIS.md');
      cy.log('3. Update cypress/support/constants.js with verified selectors');
      cy.log('4. Test selectors work with real NiFi instance');
      cy.log('5. Only then proceed to Phase 1: Foundation Reconstruction');
    });

    expect(true).to.be.true;
  });
});
