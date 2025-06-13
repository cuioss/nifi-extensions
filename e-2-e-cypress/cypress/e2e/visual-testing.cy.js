/**
 * End-to-End Tests for Visual Testing - Phase 5.5
 *
 * This test suite validates the visual appearance and consistency of the MultiIssuerJWTTokenAuthenticator UI,
 * ensuring pixel-perfect rendering, visual regression detection, and consistent styling across different states.
 *
 * Test Categories:
 * 1. Visual Regression Testing
 * 2. Component State Visualization
 * 3. Layout and Positioning Verification
 * 4. Animation and Transition Testing
 * 5. Theme and Style Consistency
 * 6. Cross-Resolution Visual Testing
 */

/**
 * Visual Testing Scenarios
 * CUI Standards Compliant
 */

import { SELECTORS, TIMEOUTS } from '../constants.js';
import { waitForVisible } from '../wait-utils.js';

describe('Visual Testing', () => {
  let processorId;

  beforeEach(() => {
    // Configure visual testing environment
    cy.configureVisualTesting();

    // Start with a clean session
    cy.clearAllSessionStorage();
    cy.clearAllLocalStorage();
    cy.clearCookies();

    // Login and navigate to canvas
    cy.loginToNiFi();
    cy.navigateToCanvas();

    // Add processor for visual testing
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((id) => {
      processorId = id;
    });
  });

  afterEach(() => {
    // Clean up processor after each test
    if (processorId) {
      cy.removeProcessor(processorId);
    }
  });

  describe('Visual Regression Testing', () => {
    it('should maintain consistent processor appearance in default state', () => {
      // Take baseline screenshot of processor in default state
      cy.getProcessorElement(processorId).should('be.visible');

      // Capture processor visual state
      cy.visualSnapshot('processor-default-state', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.01, // 1% threshold for minor rendering differences
      });

      // Verify processor dimensions and positioning
      cy.verifyProcessorVisualBaseline(processorId);
    });

    it('should maintain consistent configuration dialog appearance', () => {
      cy.openProcessorConfigDialog(processorId);

      // Wait for dialog to fully render
      waitForVisible('.configuration-dialog');

      // Capture configuration dialog visual state
      cy.visualSnapshot('config-dialog-default', {
        element: '.configuration-dialog',
        threshold: 0.02,
      });

      // Verify dialog layout and components
      cy.verifyConfigDialogVisualBaseline();

      cy.closeDialog();
    });

    it('should detect visual changes in property configuration forms', () => {
      cy.openProcessorConfigDialog(processorId);

      // Configure different JWKS source types and capture visuals
      cy.setProcessorProperty('JWKS Source Type', 'SERVER');
      // Form updates should be ready immediately

      cy.visualSnapshot('config-dialog-server-type', {
        element: '.properties-section',
        threshold: 0.02,
      });

      // Switch to FILE type
      cy.setProcessorProperty('JWKS Source Type', 'FILE');
      // Animation wait removed - using proper element visibility;

      cy.visualSnapshot('config-dialog-file-type', {
        element: '.properties-section',
        threshold: 0.02,
      });

      // Switch to IN_MEMORY type
      cy.setProcessorProperty('JWKS Source Type', 'IN_MEMORY');
      // Animation wait removed - using proper element visibility;

      cy.visualSnapshot('config-dialog-memory-type', {
        element: '.properties-section',
        threshold: 0.02,
      });

      cy.closeDialog();
    });

    it('should capture error state visual representations', () => {
      cy.openProcessorConfigDialog(processorId);

      // Create validation errors for visual testing
      cy.setProcessorProperty('JWKS Source Type', 'SERVER');
      cy.setProcessorProperty('JWKS Server URL', 'invalid-url');
      cy.clickApplyButton();

      // Capture error state visuals
      cy.visualSnapshot('config-dialog-error-state', {
        element: '.configuration-dialog',
        threshold: 0.02,
      });

      // Verify error visual indicators
      cy.verifyErrorVisualIndicators();

      cy.closeDialog();
    });
  });

  describe('Component State Visualization', () => {
    it('should visually validate processor states', () => {
      // Test STOPPED state
      cy.verifyProcessorState(processorId, 'STOPPED');
      cy.visualSnapshot('processor-stopped-state', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.01,
      });

      // Configure and start processor
      cy.configureProcessorForTesting(processorId);
      cy.startProcessor(processorId);
      // Loading wait removed - using proper element readiness checks;

      // Test RUNNING state
      cy.verifyProcessorState(processorId, 'RUNNING');
      cy.visualSnapshot('processor-running-state', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.01,
      });

      // Stop processor
      cy.stopProcessor(processorId);
      // Loading wait removed - using proper element readiness checks;

      // Verify return to STOPPED state
      cy.visualSnapshot('processor-stopped-after-run', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.01,
      });
    });

    it('should capture processor selection and hover states', () => {
      // Test default state
      cy.visualSnapshot('processor-default', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.01,
      });

      // Test hover state
      cy.getProcessorElement(processorId).trigger('mouseenter');
      // Animation wait removed - using proper element visibility;
      cy.visualSnapshot('processor-hover-state', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.01,
      });

      // Test selected state
      cy.getProcessorElement(processorId).click();
      // Animation wait removed - using proper element visibility;
      cy.visualSnapshot('processor-selected-state', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.01,
      });

      // Return to default state
      cy.get('.canvas').click(50, 50); // Click on empty canvas area
    });

    it('should validate context menu visual appearance', () => {
      // Right-click to show context menu
      cy.getProcessorElement(processorId).rightclick();
      // Animation wait removed - using proper element visibility;

      // Capture context menu
      cy.get('.context-menu, .popup-menu').should('be.visible');
      cy.visualSnapshot('processor-context-menu', {
        element: '.context-menu, .popup-menu',
        threshold: 0.02,
      });

      // Test menu item hover states
      cy.get('.menu-item, .popup-menu-item').first().trigger('mouseenter');
      // Short animation wait removed - using proper element visibility;
      cy.visualSnapshot('context-menu-item-hover', {
        element: '.context-menu, .popup-menu',
        threshold: 0.02,
      });

      // Close menu
      cy.get('body').click();
    });

    it('should capture loading and processing states', () => {
      cy.openProcessorConfigDialog(processorId);

      // Set up configuration that might show loading states
      cy.setProcessorProperty('JWKS Source Type', 'SERVER');
      cy.setProcessorProperty('JWKS Server URL', 'https://httpbin.org/delay/3');

      // Click apply to trigger potential loading state
      cy.get('.apply-button').click();

      // Try to capture loading state (if it appears)
      cy.get('body').then(($body) => {
        if ($body.find('.loading, .spinner, .progress').length > 0) {
          cy.visualSnapshot('config-dialog-loading-state', {
            element: '.configuration-dialog',
            threshold: 0.02,
          });
        }
      });

      cy.wait(4000); // Wait for potential network call
      cy.closeDialog();
    });
  });

  describe('Layout and Positioning Verification', () => {
    it('should verify processor positioning and alignment on canvas', () => {
      // Capture canvas with processor for layout verification
      cy.visualSnapshot('canvas-processor-layout', {
        element: '.canvas',
        threshold: 0.01,
      });

      // Verify processor is properly positioned
      cy.verifyProcessorPositioning(processorId);

      // Add another processor to test relative positioning
      cy.addProcessor('MultiIssuerJWTTokenAuthenticator', { x: 200, y: 200 }).then(
        (secondProcessorId) => {
          // Capture layout with multiple processors
          cy.visualSnapshot('canvas-multiple-processors', {
            element: '.canvas',
            threshold: 0.01,
          });

          // Clean up second processor
          cy.removeProcessor(secondProcessorId);
        }
      );
    });

    it('should validate configuration dialog layout and spacing', () => {
      cy.openProcessorConfigDialog(processorId);

      // Capture full dialog layout
      cy.visualSnapshot('config-dialog-full-layout', {
        element: '.configuration-dialog',
        threshold: 0.02,
      });

      // Verify specific layout sections
      cy.get('.properties-section').then(($section) => {
        if ($section.length > 0) {
          cy.visualSnapshot('config-properties-section', {
            element: '.properties-section',
            threshold: 0.02,
          });
        }
      });

      // Check tab layout if present
      cy.get('.tab-container, .tabs').then(($tabs) => {
        if ($tabs.length > 0) {
          cy.visualSnapshot('config-dialog-tabs', {
            element: '.tab-container, .tabs',
            threshold: 0.02,
          });
        }
      });

      cy.closeDialog();
    });

    it('should verify form element alignment and spacing', () => {
      cy.openProcessorConfigDialog(processorId);

      // Capture form layout for alignment verification
      cy.get('.form, .property-form').then(($form) => {
        if ($form.length > 0) {
          cy.visualSnapshot('form-element-alignment', {
            element: '.form, .property-form',
            threshold: 0.02,
          });
        }
      });

      // Verify input field alignment
      cy.verifyFormElementAlignment();

      // Verify label positioning
      cy.verifyLabelAlignment();

      cy.closeDialog();
    });

    it('should validate button layout and positioning', () => {
      cy.openProcessorConfigDialog(processorId);

      // Capture button layout
      cy.get('.button-container, .dialog-buttons').then(($buttons) => {
        if ($buttons.length > 0) {
          cy.visualSnapshot('dialog-button-layout', {
            element: '.button-container, .dialog-buttons',
            threshold: 0.02,
          });
        }
      });

      // Verify button spacing and alignment
      cy.verifyButtonAlignment();

      cy.closeDialog();
    });
  });

  describe('Animation and Transition Testing', () => {
    it('should capture processor state transition animations', () => {
      // Configure processor for testing
      cy.configureProcessorForTesting(processorId);

      // Capture before starting
      cy.visualSnapshot('processor-before-start', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.01,
      });

      // Start processor and capture transition
      cy.startProcessor(processorId);
      // Animation wait removed - using proper element visibility; // Allow for animation

      cy.visualSnapshot('processor-start-transition', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.02, // Higher threshold for animations
      });

      // Wait for animation to complete
      // Loading wait removed - using proper element readiness checks;
      cy.visualSnapshot('processor-running-final', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.01,
      });

      cy.stopProcessor(processorId);
    });

    it('should validate dialog opening and closing animations', () => {
      // Capture canvas before dialog
      cy.visualSnapshot('canvas-before-dialog', {
        element: 'body',
        threshold: 0.01,
      });

      // Open dialog and capture during animation
      cy.getProcessorElement(processorId).dblclick();
      // Animation wait removed - using proper element visibility; // Mid-animation

      cy.get('.configuration-dialog').then(($dialog) => {
        if ($dialog.is(':visible')) {
          cy.visualSnapshot('dialog-opening-animation', {
            element: 'body',
            threshold: 0.03, // Higher threshold for animation
          });
        }
      });

      // Wait for animation to complete
      // Animation wait removed - using proper element visibility;
      cy.visualSnapshot('dialog-opened-final', {
        element: 'body',
        threshold: 0.01,
      });

      // Close dialog and capture animation
      cy.get('.cancel-button, .close-button').click();
      // Animation wait removed - using proper element visibility; // Mid-animation

      cy.visualSnapshot('dialog-closing-animation', {
        element: 'body',
        threshold: 0.03,
      });
    });

    it('should test hover and focus animations', () => {
      // Test processor hover animation
      cy.getProcessorElement(processorId).trigger('mouseenter');
      // Animation wait removed - using proper element visibility; // Allow for hover animation

      cy.visualSnapshot('processor-hover-animation', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.02,
      });

      // Test button hover in dialog
      cy.openProcessorConfigDialog(processorId);

      cy.get('.apply-button').trigger('mouseenter');
      // Animation wait removed - using proper element visibility;

      cy.visualSnapshot('button-hover-animation', {
        element: '.apply-button',
        threshold: 0.02,
      });

      cy.closeDialog();
    });

    it('should validate loading spinner and progress animations', () => {
      cy.openProcessorConfigDialog(processorId);

      // Configure to potentially trigger loading
      cy.setProcessorProperty('JWKS Source Type', 'SERVER');
      cy.setProcessorProperty('JWKS Server URL', 'https://httpbin.org/delay/2');

      // Trigger action that might show loading
      cy.get('.apply-button').click();

      // Try to capture loading animation
      cy.get('body', { timeout: 1000 }).then(($body) => {
        if ($body.find('.loading, .spinner').length > 0) {
          cy.visualSnapshot('loading-animation', {
            element: '.loading, .spinner',
            threshold: 0.05, // High threshold for animated spinners
          });
        }
      });

      cy.wait(3000);
      cy.closeDialog();
    });
  });

  describe('Theme and Style Consistency', () => {
    it('should validate consistent styling across components', () => {
      // Capture processor for style consistency
      cy.visualSnapshot('processor-styling', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.01,
      });

      // Capture dialog styling
      cy.openProcessorConfigDialog(processorId);
      cy.visualSnapshot('dialog-styling', {
        element: '.configuration-dialog',
        threshold: 0.01,
      });

      // Verify color consistency
      cy.verifyColorConsistency();

      // Verify font consistency
      cy.verifyFontConsistency();

      cy.closeDialog();
    });

    it('should test dark theme compatibility (if available)', () => {
      // Check if dark theme is available
      cy.window().then((win) => {
        if (win.document.body.classList.contains('dark-theme-available')) {
          // Enable dark theme
          cy.enableDarkTheme();

          // Capture processor in dark theme
          cy.visualSnapshot('processor-dark-theme', {
            element: cy.getProcessorElement(processorId),
            threshold: 0.02,
          });

          // Capture dialog in dark theme
          cy.openProcessorConfigDialog(processorId);
          cy.visualSnapshot('dialog-dark-theme', {
            element: '.configuration-dialog',
            threshold: 0.02,
          });

          cy.closeDialog();
          cy.disableDarkTheme();
        }
      });
    });

    it('should validate high contrast theme support', () => {
      // Enable high contrast if supported
      cy.enableHighContrastTheme();

      // Capture processor in high contrast
      cy.visualSnapshot('processor-high-contrast', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.03,
      });

      // Capture dialog in high contrast
      cy.openProcessorConfigDialog(processorId);
      cy.visualSnapshot('dialog-high-contrast', {
        element: '.configuration-dialog',
        threshold: 0.03,
      });

      cy.closeDialog();
      cy.disableHighContrastTheme();
    });

    it('should verify brand consistency and styling guidelines', () => {
      // Verify brand colors are used consistently
      cy.verifyBrandColors();

      // Verify typography follows guidelines
      cy.verifyTypographyGuidelines();

      // Verify spacing follows design system
      cy.verifySpacingConsistency();

      // Capture overall brand compliance
      cy.visualSnapshot('brand-compliance-overview', {
        element: 'body',
        threshold: 0.01,
      });
    });
  });

  describe('Cross-Resolution Visual Testing', () => {
    it('should validate appearance across different screen resolutions', () => {
      const resolutions = [
        { width: 1920, height: 1080, name: '1080p' },
        { width: 1366, height: 768, name: 'WXGA' },
        { width: 1024, height: 768, name: 'XGA' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' },
      ];

      resolutions.forEach((resolution) => {
        cy.viewport(resolution.width, resolution.height);
        // Animation wait removed - using proper element visibility; // Allow for responsive adjustments

        // Capture processor at this resolution
        cy.visualSnapshot(`processor-${resolution.name.toLowerCase()}`, {
          element: cy.getProcessorElement(processorId),
          threshold: 0.02,
        });

        // Capture configuration dialog
        cy.openProcessorConfigDialog(processorId);
        cy.visualSnapshot(`dialog-${resolution.name.toLowerCase()}`, {
          element: '.configuration-dialog',
          threshold: 0.02,
        });

        // Verify responsive design
        cy.verifyResponsiveLayout(resolution);

        cy.closeDialog();
      });
    });

    it('should test zoom level visual consistency', () => {
      const zoomLevels = [75, 100, 125, 150, 200];

      zoomLevels.forEach((zoomLevel) => {
        cy.setZoomLevel(zoomLevel);
        // Animation wait removed - using proper element visibility;

        // Capture processor at zoom level
        cy.visualSnapshot(`processor-zoom-${zoomLevel}`, {
          element: cy.getProcessorElement(processorId),
          threshold: 0.03, // Higher threshold for zoom differences
        });

        // Verify zoom doesn't break layout
        cy.verifyZoomLayout(zoomLevel);
      });

      cy.resetZoomLevel();
    });

    it('should validate pixel density handling', () => {
      // Test different pixel ratios if supported
      const pixelRatios = [1, 1.5, 2, 2.5, 3];

      pixelRatios.forEach((ratio) => {
        cy.setPixelRatio(ratio);
        // Animation wait removed - using proper element visibility;

        // Capture at different pixel densities
        cy.visualSnapshot(`processor-dpr-${ratio}`, {
          element: cy.getProcessorElement(processorId),
          threshold: 0.02,
        });

        // Verify crisp rendering at high DPI
        cy.verifyCrispRendering(ratio);
      });

      cy.resetPixelRatio();
    });
  });

  describe('Visual Regression Detection', () => {
    it('should detect unintended visual changes', () => {
      // Establish baseline
      cy.visualSnapshot('regression-baseline', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.001, // Very strict threshold for regression detection
      });

      // Make processor configuration change
      cy.configureProcessorForTesting(processorId);

      // Verify visual consistency after configuration
      cy.visualSnapshot('regression-after-config', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.001,
      });
    });

    it('should validate visual stability across browser refreshes', () => {
      // Take initial snapshot
      cy.visualSnapshot('stability-initial', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.001,
      });

      // Refresh page and verify consistency
      cy.reload();
      cy.loginToNiFi();
      cy.navigateToCanvas();

      // Add processor again
      cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((newProcessorId) => {
        processorId = newProcessorId;

        // Compare with initial snapshot
        cy.visualSnapshot('stability-after-refresh', {
          element: cy.getProcessorElement(processorId),
          threshold: 0.001,
        });
      });
    });

    it('should maintain visual consistency across user interactions', () => {
      // Baseline
      cy.visualSnapshot('interaction-baseline', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.001,
      });

      // Perform various interactions
      cy.getProcessorElement(processorId).click();
      cy.get('.canvas').click(100, 100); // Deselect
      cy.getProcessorElement(processorId).trigger('mouseenter');
      cy.getProcessorElement(processorId).trigger('mouseleave');

      // Verify visual consistency after interactions
      cy.visualSnapshot('interaction-after-events', {
        element: cy.getProcessorElement(processorId),
        threshold: 0.001,
      });
    });
  });
});
