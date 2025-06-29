/**
 * @file Detailed SVG and Element Analysis for Phase 0
 * This test analyzes the 4 SVG elements found and waits for full page load
 *
 * 🎯 PURPOSE: Identify the real NiFi canvas from the SVG elements found
 */

describe('Phase 0: Detailed SVG and Element Analysis', () => {
  it('🔍 Analyze SVG Elements and Wait for Full Page Load', () => {
    cy.log('🔍 Starting detailed SVG analysis with proper page load waiting...');

    // Visit NiFi with longer timeout
    cy.visit('https://localhost:9095/nifi', {
      failOnStatusCode: false,
      timeout: 30000
    });

    // Wait for initial page load
    cy.wait(3000);

    cy.task('log', '🚀 DETAILED SVG AND ELEMENT ANALYSIS');
    cy.task('log', '===================================');

    // Wait for Angular/dynamic content to load
    cy.get('body').should('have.class', 'mat-app-background');

    // Wait a bit more for dynamic content
    cy.wait(5000);

    cy.get('body').then(($body) => {
      cy.url().then((currentUrl) => {
        cy.task('log', `Current URL: ${currentUrl}`);
      });

      cy.task('log', `Page title: ${$body.find('title').text() || 'No title'}`);
      cy.task('log', `Body classes: ${$body.attr('class') || 'none'}`);
      cy.task('log', `Total elements on page: ${$body.find('*').length}`);

      // Detailed SVG analysis
      const allSvgs = $body.find('svg');
      cy.task('log', '');
      cy.task('log', '🎯 DETAILED SVG ANALYSIS:');
      cy.task('log', `Total SVG elements: ${allSvgs.length}`);

      allSvgs.each((index, svg) => {
        const $svg = Cypress.$(svg);
        cy.task('log', '');
        cy.task('log', `SVG ${index + 1} DETAILED ANALYSIS:`);
        cy.task('log', `  ID: ${$svg.attr('id') || 'none'}`);
        cy.task('log', `  Classes: ${$svg.attr('class') || 'none'}`);
        cy.task('log', `  Width attr: ${$svg.attr('width') || 'none'}`);
        cy.task('log', `  Height attr: ${$svg.attr('height') || 'none'}`);
        cy.task('log', `  ViewBox: ${$svg.attr('viewBox') || 'none'}`);
        cy.task('log', `  Actual dimensions: ${svg.offsetWidth}x${svg.offsetHeight}`);
        cy.task('log', `  Visible: ${$svg.is(':visible')}`);
        cy.task('log', `  Display: ${$svg.css('display')}`);
        cy.task('log', `  Position: ${$svg.css('position')}`);

        // Parent analysis
        const $parent = $svg.parent();
        cy.task('log', `  Parent tag: ${$parent.prop('tagName')}`);
        cy.task('log', `  Parent ID: ${$parent.attr('id') || 'none'}`);
        cy.task('log', `  Parent classes: ${$parent.attr('class') || 'none'}`);
        cy.task('log', `  Parent dimensions: ${$parent[0].offsetWidth}x${$parent[0].offsetHeight}`);

        // Check for nested elements
        const children = $svg.children();
        cy.task('log', `  Child elements: ${children.length}`);
        if (children.length > 0) {
          children.slice(0, 5).each((childIndex, child) => {
            const $child = Cypress.$(child);
            cy.task('log', `    Child ${childIndex + 1}: ${child.tagName} (class: ${$child.attr('class') || 'none'})`);
          });
        }

        // Check if this could be a canvas
        const isLargeEnough = svg.offsetWidth > 200 && svg.offsetHeight > 200;
        const hasCanvasLikeParent = $parent.attr('class')?.includes('canvas') || $parent.attr('id')?.includes('canvas');
        const hasCanvasLikeClasses = $svg.attr('class')?.includes('canvas') || $svg.attr('class')?.includes('flow');

        cy.task('log', `  CANVAS CANDIDATE ANALYSIS:`);
        cy.task('log', `    Large enough (>200x200): ${isLargeEnough}`);
        cy.task('log', `    Canvas-like parent: ${hasCanvasLikeParent}`);
        cy.task('log', `    Canvas-like classes: ${hasCanvasLikeClasses}`);
        cy.task('log', `    CANVAS SCORE: ${(isLargeEnough ? 1 : 0) + (hasCanvasLikeParent ? 1 : 0) + (hasCanvasLikeClasses ? 1 : 0)}/3`);
      });

      // Look for Angular Material components
      cy.task('log', '');
      cy.task('log', '🎯 ANGULAR MATERIAL COMPONENTS:');
      const matElements = $body.find('[class*="mat-"]');
      cy.task('log', `Total Angular Material elements: ${matElements.length}`);

      // Group by component type
      const matTypes = {};
      matElements.each((index, element) => {
        const classes = Cypress.$(element).attr('class') || '';
        const matClasses = classes.split(' ').filter(cls => cls.startsWith('mat-'));
        matClasses.forEach(matClass => {
          const baseClass = matClass.split('-')[0] + '-' + matClass.split('-')[1];
          matTypes[baseClass] = (matTypes[baseClass] || 0) + 1;
        });
      });

      Object.entries(matTypes).forEach(([type, count]) => {
        cy.task('log', `  ${type}: ${count} elements`);
      });

      // Look for toolbar-like elements
      cy.task('log', '');
      cy.task('log', '🎯 TOOLBAR ANALYSIS:');
      const toolbarCandidates = $body.find('[class*="toolbar"], [class*="header"], [class*="nav"], mat-toolbar');
      cy.task('log', `Toolbar candidates found: ${toolbarCandidates.length}`);

      toolbarCandidates.each((index, toolbar) => {
        const $toolbar = Cypress.$(toolbar);
        cy.task('log', `Toolbar ${index + 1}:`);
        cy.task('log', `  Tag: ${toolbar.tagName}`);
        cy.task('log', `  ID: ${$toolbar.attr('id') || 'none'}`);
        cy.task('log', `  Classes: ${$toolbar.attr('class') || 'none'}`);
        cy.task('log', `  Visible: ${$toolbar.is(':visible')}`);
        cy.task('log', `  Position: top=${$toolbar.offset()?.top || 0}, left=${$toolbar.offset()?.left || 0}`);

        // Look for buttons within toolbar
        const buttons = $toolbar.find('button');
        cy.task('log', `  Buttons in toolbar: ${buttons.length}`);
      });

      // Look for all buttons on page
      cy.task('log', '');
      cy.task('log', '🎯 ALL BUTTONS ANALYSIS:');
      const allButtons = $body.find('button');
      cy.task('log', `Total buttons found: ${allButtons.length}`);

      allButtons.each((index, button) => {
        const $btn = Cypress.$(button);
        const text = $btn.text().trim();
        const title = $btn.attr('title') || '';
        const ariaLabel = $btn.attr('aria-label') || '';
        const classes = $btn.attr('class') || '';
        const id = $btn.attr('id') || '';

        cy.task('log', `Button ${index + 1}:`);
        cy.task('log', `  Text: "${text}"`);
        cy.task('log', `  Title: "${title}"`);
        cy.task('log', `  Aria-label: "${ariaLabel}"`);
        cy.task('log', `  ID: "${id}"`);
        cy.task('log', `  Classes: "${classes}"`);
        cy.task('log', `  Visible: ${$btn.is(':visible')}`);
        cy.task('log', `  Position: ${$btn.offset()?.top || 0}, ${$btn.offset()?.left || 0}`);

        // Check if this could be an "Add" button
        const couldBeAdd = text.toLowerCase().includes('add') ||
                          title.toLowerCase().includes('add') ||
                          ariaLabel.toLowerCase().includes('add') ||
                          classes.toLowerCase().includes('add');
        cy.task('log', `  Could be ADD button: ${couldBeAdd}`);
      });

      // Look for router-outlet or main content areas
      cy.task('log', '');
      cy.task('log', '🎯 MAIN CONTENT AREAS:');
      const contentAreas = $body.find('router-outlet, main, [role="main"], .main-content, .app-content');
      cy.task('log', `Content areas found: ${contentAreas.length}`);

      contentAreas.each((index, area) => {
        const $area = Cypress.$(area);
        cy.task('log', `Content area ${index + 1}:`);
        cy.task('log', `  Tag: ${area.tagName}`);
        cy.task('log', `  ID: ${$area.attr('id') || 'none'}`);
        cy.task('log', `  Classes: ${$area.attr('class') || 'none'}`);
        cy.task('log', `  Dimensions: ${area.offsetWidth}x${area.offsetHeight}`);
      });

      cy.task('log', '');
      cy.task('log', '🎯 PHASE 0 SELECTOR RECOMMENDATIONS:');
      cy.task('log', '=====================================');

      // Generate selector recommendations based on findings
      if (allSvgs.length > 0) {
        const largestSvg = Array.from(allSvgs).reduce((largest, current) => {
          return (current.offsetWidth * current.offsetHeight) > (largest.offsetWidth * largest.offsetHeight) ? current : largest;
        });
        const $largestSvg = Cypress.$(largestSvg);

        cy.task('log', 'RECOMMENDED CANVAS SELECTOR:');
        if ($largestSvg.attr('id')) {
          cy.task('log', `  Primary: #${$largestSvg.attr('id')}`);
        }
        if ($largestSvg.attr('class')) {
          const classes = $largestSvg.attr('class').split(' ');
          cy.task('log', `  By class: .${classes[0]}`);
        }
        cy.task('log', `  Generic: svg (element ${Array.from(allSvgs).indexOf(largestSvg) + 1} of ${allSvgs.length})`);
        cy.task('log', `  Parent-based: ${$largestSvg.parent().prop('tagName').toLowerCase()}${$largestSvg.parent().attr('id') ? '#' + $largestSvg.parent().attr('id') : ''} svg`);
      }

      cy.task('log', '');
      cy.task('log', '🚨 NEXT STEPS FOR PHASE 0 COMPLETION:');
      cy.task('log', '1. Use the selector recommendations above');
      cy.task('log', '2. Test selectors manually in browser console');
      cy.task('log', '3. Update cypress/support/constants.js with working selectors');
      cy.task('log', '4. Implement canvas interaction methods');
      cy.task('log', '5. Test processor add/remove operations');
    });

    expect(true).to.be.true;
  });
});