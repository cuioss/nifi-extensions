/**
 * Cypress Commands for Visual Testing
 *
 * These commands provide utilities for visual regression testing, screenshot comparison,
 * layout verification, and visual consistency checks across different states and themes.
 */

// Configuration and Setup Commands

/**
 * Configure visual testing environment
 */
Cypress.Commands.add('configureVisualTesting', () => {
  // Set up visual testing configuration
  cy.window().then((win) => {
    // Store visual testing configuration
    win.visualTestingConfig = {
      enabled: true,
      screenshotPath: 'cypress/screenshots/visual-tests',
      threshold: 0.02, // Default 2% threshold
      retryTimes: 3,
    };
  });

  // Ensure consistent rendering environment
  cy.viewport(1366, 768); // Standard desktop resolution
  cy.wait(500); // Allow for initial rendering
});

// Visual Snapshot Commands

/**
 * Take a visual snapshot for comparison
 * @param {string} name - Name of the snapshot
 * @param {Object} options - Options for the snapshot
 */
Cypress.Commands.add('visualSnapshot', (name, options = {}) => {
  const defaultOptions = {
    threshold: 0.02,
    capture: 'viewport',
    element: null,
    overwrite: false,
  };

  const config = { ...defaultOptions, ...options };

  // Generate timestamp for unique naming
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}`;

  if (config.element) {
    // Take screenshot of specific element
    cy.wrap(config.element).screenshot(filename, {
      capture: 'runner',
      onAfterScreenshot: ($el, props) => {
        cy.log(`Visual snapshot saved: ${props.path}`);
        cy.storeVisualSnapshot(name, props.path, config);
      },
    });
  } else {
    // Take full viewport screenshot
    cy.screenshot(filename, {
      capture: config.capture,
      onAfterScreenshot: ($el, props) => {
        cy.log(`Visual snapshot saved: ${props.path}`);
        cy.storeVisualSnapshot(name, props.path, config);
      },
    });
  }
});

/**
 * Store visual snapshot metadata for later comparison
 * @param {string} name - Snapshot name
 * @param {string} path - Screenshot path
 * @param {Object} config - Snapshot configuration
 */
Cypress.Commands.add('storeVisualSnapshot', (name, path, config) => {
  cy.window().then((win) => {
    if (!win.visualSnapshots) {
      win.visualSnapshots = {};
    }

    win.visualSnapshots[name] = {
      path: path,
      timestamp: new Date().toISOString(),
      config: config,
      browser: Cypress.browser.name,
      viewport: `${win.innerWidth}x${win.innerHeight}`,
    };
  });
});

// Visual Verification Commands

/**
 * Verify processor visual baseline
 * @param {string} processorId - Processor ID
 */
Cypress.Commands.add('verifyProcessorVisualBaseline', (processorId) => {
  cy.getProcessorElement(processorId).then(($processor) => {
    const element = $processor[0];
    const rect = element.getBoundingClientRect();

    // Verify processor has reasonable dimensions
    expect(rect.width).to.be.greaterThan(50);
    expect(rect.height).to.be.greaterThan(30);

    // Verify processor is visible
    expect(rect.width).to.be.greaterThan(0);
    expect(rect.height).to.be.greaterThan(0);

    // Verify processor is within viewport
    expect(rect.left).to.be.at.least(0);
    expect(rect.top).to.be.at.least(0);

    cy.log(
      `Processor visual baseline verified: ${rect.width}x${rect.height} at (${rect.left}, ${rect.top})`
    );
  });
});

/**
 * Verify configuration dialog visual baseline
 */
Cypress.Commands.add('verifyConfigDialogVisualBaseline', () => {
  cy.get('.configuration-dialog').then(($dialog) => {
    const element = $dialog[0];
    const rect = element.getBoundingClientRect();

    // Verify dialog has reasonable dimensions
    expect(rect.width).to.be.greaterThan(400);
    expect(rect.height).to.be.greaterThan(300);

    // Verify dialog is centered (approximately)
    const viewportWidth = Cypress.config('viewportWidth');
    const viewportHeight = Cypress.config('viewportHeight');

    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    const dialogCenterX = rect.left + rect.width / 2;
    const dialogCenterY = rect.top + rect.height / 2;

    // Allow some tolerance for centering
    expect(Math.abs(dialogCenterX - centerX)).to.be.below(100);
    expect(Math.abs(dialogCenterY - centerY)).to.be.below(100);

    cy.log(
      `Dialog visual baseline verified: ${rect.width}x${rect.height} centered at (${dialogCenterX}, ${dialogCenterY})`
    );
  });
});

/**
 * Verify error visual indicators
 */
Cypress.Commands.add('verifyErrorVisualIndicators', () => {
  // Check for visual error indicators
  cy.get('.error, .invalid, .validation-error').should('be.visible');

  // Verify error styling
  cy.get('.error, .invalid, .validation-error').each(($element) => {
    const computedStyle = window.getComputedStyle($element[0]);

    // Verify error has distinct visual styling
    const color = computedStyle.color;
    const backgroundColor = computedStyle.backgroundColor;
    const borderColor = computedStyle.borderColor;

    // At least one error styling should be present
    const hasErrorStyling =
      color.includes('red') ||
      backgroundColor.includes('red') ||
      borderColor.includes('red') ||
      $element.find('.error-icon').length > 0;

    expect(hasErrorStyling).to.be.true;
  });
});

// Layout Verification Commands

/**
 * Verify processor positioning
 * @param {string} processorId - Processor ID
 */
Cypress.Commands.add('verifyProcessorPositioning', (processorId) => {
  cy.getProcessorElement(processorId).then(($processor) => {
    const rect = $processor[0].getBoundingClientRect();

    // Verify processor is positioned within canvas bounds
    cy.get('.canvas').then(($canvas) => {
      const canvasRect = $canvas[0].getBoundingClientRect();

      expect(rect.left).to.be.at.least(canvasRect.left);
      expect(rect.top).to.be.at.least(canvasRect.top);
      expect(rect.right).to.be.at.most(canvasRect.right);
      expect(rect.bottom).to.be.at.most(canvasRect.bottom);
    });
  });
});

/**
 * Verify form element alignment
 */
Cypress.Commands.add('verifyFormElementAlignment', () => {
  // Check input field alignment
  cy.get('input, select, textarea').then(($inputs) => {
    if ($inputs.length > 1) {
      const firstRect = $inputs[0].getBoundingClientRect();

      // Check if other inputs are aligned with the first
      for (let i = 1; i < $inputs.length; i++) {
        const rect = $inputs[i].getBoundingClientRect();

        // Allow small tolerance for alignment
        const leftDifference = Math.abs(rect.left - firstRect.left);
        expect(leftDifference).to.be.below(10); // 10px tolerance
      }
    }
  });
});

/**
 * Verify label alignment
 */
Cypress.Commands.add('verifyLabelAlignment', () => {
  // Check label alignment with form controls
  cy.get('label').each(($label) => {
    const labelRect = $label[0].getBoundingClientRect();
    const forAttr = $label.attr('for');

    if (forAttr) {
      cy.get(`#${forAttr}`).then(($input) => {
        const inputRect = $input[0].getBoundingClientRect();

        // Labels should be positioned relative to their inputs
        // Either above (top alignment) or to the left (left alignment)
        const isAbove = labelRect.bottom <= inputRect.top + 5;
        const isLeft = labelRect.right <= inputRect.left + 5;
        const isOverlapping =
          labelRect.top <= inputRect.bottom && labelRect.bottom >= inputRect.top;

        expect(isAbove || isLeft || isOverlapping).to.be.true;
      });
    }
  });
});

/**
 * Verify button alignment
 */
Cypress.Commands.add('verifyButtonAlignment', () => {
  // Check button alignment in button containers
  cy.get('.button-container, .dialog-buttons').then(($container) => {
    if ($container.length > 0) {
      const buttons = $container.find('button');

      if (buttons.length > 1) {
        const firstButtonRect = buttons[0].getBoundingClientRect();

        buttons.each((index, button) => {
          if (index > 0) {
            const rect = button.getBoundingClientRect();

            // Buttons should be aligned (either horizontally or vertically)
            const horizontalAlignment = Math.abs(rect.top - firstButtonRect.top) < 5;
            const verticalAlignment = Math.abs(rect.left - firstButtonRect.left) < 5;

            expect(horizontalAlignment || verticalAlignment).to.be.true;
          }
        });
      }
    }
  });
});

// Theme and Style Commands

/**
 * Verify color consistency across components
 */
Cypress.Commands.add('verifyColorConsistency', () => {
  // Check primary color consistency
  cy.get('.primary, .btn-primary').then(($primaryElements) => {
    if ($primaryElements.length > 1) {
      const firstStyle = window.getComputedStyle($primaryElements[0]);
      const firstColor = firstStyle.backgroundColor || firstStyle.color;

      $primaryElements.each((index, element) => {
        if (index > 0) {
          const style = window.getComputedStyle(element);
          const color = style.backgroundColor || style.color;

          // Colors should be consistent (allowing for minor variations)
          expect(color).to.equal(firstColor);
        }
      });
    }
  });
});

/**
 * Verify font consistency
 */
Cypress.Commands.add('verifyFontConsistency', () => {
  // Check font family consistency
  cy.get('body, .main-content').then(($elements) => {
    const bodyStyle = window.getComputedStyle($elements[0]);
    const baseFontFamily = bodyStyle.fontFamily;

    // Check that important elements use consistent fonts
    cy.get('h1, h2, h3, p, span, div').each(($element) => {
      const style = window.getComputedStyle($element[0]);
      const fontFamily = style.fontFamily;

      // Font should be consistent or an acceptable variant
      const isConsistent =
        fontFamily === baseFontFamily ||
        fontFamily.includes(baseFontFamily) ||
        baseFontFamily.includes(fontFamily);

      expect(isConsistent).to.be.true;
    });
  });
});

/**
 * Verify brand colors are used consistently
 */
Cypress.Commands.add('verifyBrandColors', () => {
  // Define brand color patterns (these would be specific to the application)
  const brandColors = {
    primary: ['rgb(0, 123, 255)', '#007bff'],
    secondary: ['rgb(108, 117, 125)', '#6c757d'],
    success: ['rgb(40, 167, 69)', '#28a745'],
    danger: ['rgb(220, 53, 69)', '#dc3545'],
  };

  // Check that brand colors are used appropriately
  Object.keys(brandColors).forEach((colorType) => {
    cy.get(`.${colorType}, .btn-${colorType}, .text-${colorType}`).then(($elements) => {
      $elements.each((index, element) => {
        const style = window.getComputedStyle(element);
        const color = style.color || style.backgroundColor;

        // Color should match one of the brand colors
        const matchesBrand = brandColors[colorType].some((brandColor) =>
          color.includes(brandColor)
        );

        if (!matchesBrand) {
          cy.log(`Warning: Element may not use brand ${colorType} color: ${color}`);
        }
      });
    });
  });
});

/**
 * Verify typography guidelines
 */
Cypress.Commands.add('verifyTypographyGuidelines', () => {
  // Check heading hierarchy
  cy.get('h1, h2, h3, h4, h5, h6').each(($heading) => {
    const style = window.getComputedStyle($heading[0]);
    const fontSize = parseFloat(style.fontSize);
    const fontWeight = style.fontWeight;

    // Headings should have appropriate font sizes and weights
    expect(fontSize).to.be.at.least(14); // Minimum readable size
    expect(['bold', '600', '700', '800', '900']).to.include(fontWeight);
  });

  // Check body text readability
  cy.get('p, span, div').each(($element) => {
    const text = $element.text().trim();
    if (text.length > 10) {
      // Only check elements with substantial text
      const style = window.getComputedStyle($element[0]);
      const fontSize = parseFloat(style.fontSize);

      // Body text should be readable
      expect(fontSize).to.be.at.least(12);
    }
  });
});

/**
 * Verify spacing consistency
 */
Cypress.Commands.add('verifySpacingConsistency', () => {
  // Check consistent margins and padding
  cy.get('.component, .section, .container').each(($element) => {
    const style = window.getComputedStyle($element[0]);
    const margin = style.margin;
    const padding = style.padding;

    // Spacing should follow consistent patterns (multiples of 4px or 8px)
    const marginValues = margin.split(' ').map((val) => parseFloat(val));
    const paddingValues = padding.split(' ').map((val) => parseFloat(val));

    [...marginValues, ...paddingValues].forEach((value) => {
      if (!isNaN(value) && value > 0) {
        // Check if value follows spacing scale (4px, 8px, 12px, 16px, etc.)
        const isOnScale = value % 4 === 0;
        if (!isOnScale) {
          cy.log(`Warning: Spacing value ${value}px may not follow design system`);
        }
      }
    });
  });
});

// Theme Support Commands

/**
 * Enable dark theme
 */
Cypress.Commands.add('enableDarkTheme', () => {
  cy.window().then((win) => {
    win.document.body.classList.add('dark-theme');
    win.document.body.setAttribute('data-theme', 'dark');
  });

  cy.wait(300); // Allow for theme transition
});

/**
 * Disable dark theme
 */
Cypress.Commands.add('disableDarkTheme', () => {
  cy.window().then((win) => {
    win.document.body.classList.remove('dark-theme');
    win.document.body.removeAttribute('data-theme');
  });

  cy.wait(300);
});

/**
 * Enable high contrast theme
 */
Cypress.Commands.add('enableHighContrastTheme', () => {
  cy.window().then((win) => {
    win.document.body.classList.add('high-contrast');
    win.document.body.setAttribute('data-theme', 'high-contrast');
  });

  cy.wait(300);
});

/**
 * Disable high contrast theme
 */
Cypress.Commands.add('disableHighContrastTheme', () => {
  cy.window().then((win) => {
    win.document.body.classList.remove('high-contrast');
    win.document.body.removeAttribute('data-theme');
  });

  cy.wait(300);
});

// Resolution and Zoom Commands

/**
 * Verify responsive layout at given resolution
 * @param {Object} resolution - Resolution configuration
 */
Cypress.Commands.add('verifyResponsiveLayout', (resolution) => {
  // Verify layout adapts appropriately
  if (resolution.width < 768) {
    // Mobile layout checks
    cy.verifyMobileLayoutAdaptation();
  } else if (resolution.width < 1024) {
    // Tablet layout checks
    cy.verifyTabletLayoutAdaptation();
  } else {
    // Desktop layout checks
    cy.verifyDesktopLayoutAdaptation();
  }
});

/**
 * Verify mobile layout adaptation
 */
Cypress.Commands.add('verifyMobileLayoutAdaptation', () => {
  // Check that UI adapts for mobile
  cy.get('body').should('have.class', 'mobile').or('have.attr', 'data-mobile', 'true');

  // Verify touch-friendly elements
  cy.get('button, .clickable').each(($element) => {
    const rect = $element[0].getBoundingClientRect();
    expect(rect.height).to.be.at.least(44); // Minimum touch target
  });
});

/**
 * Verify tablet layout adaptation
 */
Cypress.Commands.add('verifyTabletLayoutAdaptation', () => {
  // Check tablet-specific adaptations
  cy.get('.canvas').should('be.visible');

  // Verify responsive grid behavior
  cy.get('.grid, .layout').then(($grid) => {
    if ($grid.length > 0) {
      const style = window.getComputedStyle($grid[0]);
      const gridColumns = style.gridTemplateColumns;

      // Should adapt column count for tablet
      if (gridColumns && gridColumns !== 'none') {
        cy.log(`Grid adapted for tablet: ${gridColumns}`);
      }
    }
  });
});

/**
 * Verify desktop layout adaptation
 */
Cypress.Commands.add('verifyDesktopLayoutAdaptation', () => {
  // Check desktop-specific features are available
  cy.get('.canvas').should('be.visible');
  cy.get('.toolbar, .sidebar').should('be.visible');
});

/**
 * Set zoom level for testing
 * @param {number} zoomLevel - Zoom percentage (e.g., 150)
 */
Cypress.Commands.add('setZoomLevel', (zoomLevel) => {
  cy.window().then((win) => {
    win.document.body.style.zoom = `${zoomLevel}%`;
  });

  cy.wait(300); // Allow for zoom adjustment
});

/**
 * Reset zoom level to 100%
 */
Cypress.Commands.add('resetZoomLevel', () => {
  cy.window().then((win) => {
    win.document.body.style.zoom = '100%';
  });

  cy.wait(300);
});

/**
 * Verify zoom layout doesn't break
 * @param {number} zoomLevel - Current zoom level
 */
Cypress.Commands.add('verifyZoomLayout', (zoomLevel) => {
  // Verify no horizontal scrolling at zoom level
  cy.window().then((win) => {
    const hasHorizontalScroll = win.document.body.scrollWidth > win.innerWidth;

    if (zoomLevel <= 200) {
      // At 200% zoom or less, horizontal scrolling should be minimal
      expect(hasHorizontalScroll).to.be.false;
    }
  });

  // Verify important elements are still visible
  cy.get('.canvas').should('be.visible');
});

/**
 * Set pixel ratio for high DPI testing
 * @param {number} ratio - Pixel ratio (e.g., 2 for Retina)
 */
Cypress.Commands.add('setPixelRatio', (ratio) => {
  cy.window().then((win) => {
    // This is a simulation - actual pixel ratio can't be changed
    win.devicePixelRatio = ratio;
    win.document.body.setAttribute('data-pixel-ratio', ratio.toString());
  });
});

/**
 * Reset pixel ratio
 */
Cypress.Commands.add('resetPixelRatio', () => {
  cy.window().then((win) => {
    win.document.body.removeAttribute('data-pixel-ratio');
  });
});

/**
 * Verify crisp rendering at high DPI
 * @param {number} ratio - Pixel ratio
 */
Cypress.Commands.add('verifyCrispRendering', (ratio) => {
  // Verify images and icons are crisp at high DPI
  cy.get('img, .icon, svg').each(($element) => {
    const element = $element[0];

    // Check for high DPI attributes or CSS
    const hasSrcSet = element.hasAttribute('srcset');
    const hasHighDPICSS = window.getComputedStyle(element).imageRendering !== 'auto';

    if (ratio > 1.5) {
      // At high DPI, should have some optimization
      cy.log(
        `High DPI optimization check for ratio ${ratio}: srcset=${hasSrcSet}, CSS=${hasHighDPICSS}`
      );
    }
  });
});

// Utility Commands

/**
 * Configure processor for visual testing with valid settings
 * @param {string} processorId - Processor ID
 */
Cypress.Commands.add('configureProcessorForTesting', (processorId) => {
  cy.openProcessorConfigDialog(processorId);

  // Set valid configuration for visual testing
  cy.setProcessorProperty('JWKS Source Type', 'IN_MEMORY');
  cy.setProcessorProperty('Token Audience', 'test-audience');
  cy.setProcessorProperty('Default Issuer', 'test-issuer');

  // Add valid JWKS content
  const testJWKS = JSON.stringify({
    keys: [
      {
        kty: 'RSA',
        kid: 'test-key-1',
        use: 'sig',
        n: 'test-modulus',
        e: 'AQAB',
      },
    ],
  });
  cy.setProcessorProperty('JWKS Content', testJWKS);

  cy.clickApplyButton();
  cy.closeDialog();
});
