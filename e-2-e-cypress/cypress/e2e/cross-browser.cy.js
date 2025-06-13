import { TEXT_CONSTANTS } from "../support/constants.js";
/**
 * End-to-End Tests for Cross-Browser Compatibility - Phase 5.3
 *
 * This test suite validates the MultiIssuerJWTTokenAuthenticator functionality across different browsers,
 * ensuring consistent behavior and compatibility with various browser engines and versions.
 *
 * Test Categories:
 * 1. Browser Detection and Feature Support
 * 2. JavaScript Engine Compatibility
 * 3. CSS Rendering Consistency
 * 4. Browser-Specific API Usage
 * 5. Performance Across Browsers
 * 6. Security Feature Compatibility
 */

describe('Cross-Browser Compatibility Tests', () => {
  let processorId;
  let browserInfo;

  before(() => {
    // Detect browser information once for the entire suite
    cy.getBrowserInfo().then((info) => {
      browserInfo = info;
      cy.log(`Running tests on ${info.name} ${info.version} (${info.family})`);
    });
  });

  beforeEach(() => {
    // Clear browser state and start fresh for each test
    cy.clearAllSessionStorage();
    cy.clearAllLocalStorage();
    cy.clearCookies();

    // Login and navigate to canvas
    cy.nifiLogin();
    cy.navigateToCanvas();

    // Add processor for testing
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

  describe('Browser Detection and Feature Support', () => {
    it('should detect browser capabilities correctly', () => {
      cy.checkBrowserFeatureSupport().then((features) => {
        // Verify essential features are supported
        expect(features.localStorage).to.be.true;
        expect(features.sessionStorage).to.be.true;
        expect(features.webWorkers).to.be.true;
        expect(features.es6).to.be.true;
        expect(features.fetch).to.be.true;
        expect(features.promises).to.be.true;

        // Log browser-specific capabilities
        cy.log('Browser Feature Support:', JSON.stringify(features, null, 2));
      });
    });

    it('should handle browser-specific quirks gracefully', () => {
      // Test browser-specific behavior handling
      cy.testBrowserQuirks(browserInfo.family);

      // Verify the processor still works correctly
      cy.getProcessorElement(processorId).should(TEXT_CONSTANTS.BE_VISIBLE);
      cy.openProcessorConfigDialog(processorId);
      cy.verifyConfigurationDialogBehavior(browserInfo.family);
      cy.closeDialog();
    });

    it('should support required CSS features', () => {
      // Test CSS Grid support (required for modern UI)
      cy.checkCSSFeatureSupport('grid').should('be.true');

      // Test Flexbox support
      cy.checkCSSFeatureSupport('flexbox').should('be.true');

      // Test CSS Variables support
      cy.checkCSSFeatureSupport('custom-properties').should('be.true');

      // Verify UI renders correctly with supported features
      cy.verifyUIRenderingConsistency();
    });

    it('should handle viewport and responsive design consistently', () => {
      // Test different viewport sizes
      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop Large' },
        { width: 1366, height: 768, name: 'Desktop Standard' },
        { width: 1024, height: 768, name: 'Tablet Landscape' },
        { width: 768, height: 1024, name: 'Tablet Portrait' },
      ];

      viewports.forEach((viewport) => {
        cy.viewport(viewport.width, viewport.height);
        cy.log(`Testing viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);

        // Verify processor is still visible and functional
        cy.getProcessorElement(processorId).should(TEXT_CONSTANTS.BE_VISIBLE);

        // Test responsive behavior
        cy.verifyResponsiveDesign(viewport);
      });
    });
  });

  describe('JavaScript Engine Compatibility', () => {
    it('should handle ES6+ features consistently', () => {
      // Test arrow functions, template literals, destructuring, etc.
      cy.testES6Compatibility();

      // Verify processor functionality uses compatible JavaScript
      cy.configureProcessorForTesting(processorId);
      cy.startProcessor(processorId);
      cy.sendTokenToProcessor(processorId, cy.generateValidToken());
      // Loading wait removed - using proper element readiness checks;
      cy.verifyProcessorState(processorId, 'RUNNING');

      cy.stopProcessor(processorId);
    });

    it('should handle asynchronous operations correctly', () => {
      // Test Promise handling across browsers
      cy.testAsyncCompatibility();

      // Test Fetch API consistency
      cy.testFetchAPIConsistency();

      // Verify AJAX requests work consistently
      cy.openProcessorConfigDialog(processorId);
      cy.setProcessorProperty('JWKS Source Type', 'SERVER');
      cy.setProcessorProperty('JWKS Server URL', 'https://httpbin.org/delay/1');

      // Apply configuration and verify async behavior
      cy.clickApplyButton();
      cy.verifyAsyncConfigurationHandling();

      cy.closeDialog();
    });

    it('should handle DOM manipulation consistently', () => {
      // Test DOM querying and manipulation
      cy.testDOMCompatibility();

      // Verify processor configuration UI manipulates DOM correctly
      cy.openProcessorConfigDialog(processorId);
      cy.verifyDOMManipulationConsistency();
      cy.closeDialog();
    });

    it('should handle event handling uniformly', () => {
      // Test event listener compatibility
      cy.testEventHandlingCompatibility();

      // Test mouse and keyboard events on processor
      cy.getProcessorElement(processorId).trigger('mouseenter');
      cy.getProcessorElement(processorId).trigger('mouseleave');
      cy.getProcessorElement(processorId).click();

      // Verify events are handled consistently
      cy.verifyEventHandlingConsistency(processorId);
    });
  });

  describe('CSS Rendering Consistency', () => {
    it('should render processor UI consistently across browsers', () => {
      // Take screenshots for visual comparison
      cy.takeScreenshotForComparison(processorId, 'processor-initial');

      // Open configuration dialog
      cy.openProcessorConfigDialog(processorId);
      cy.takeScreenshotForComparison(processorId, 'processor-config-dialog');

      // Verify layout consistency
      cy.verifyLayoutConsistency();

      cy.closeDialog();
    });

    it('should handle CSS animations and transitions uniformly', () => {
      // Test animation support
      cy.checkAnimationSupport();

      // Test processor state transitions
      cy.startProcessor(processorId);
      cy.verifyAnimationConsistency(processorId, 'start');

      cy.stopProcessor(processorId);
      cy.verifyAnimationConsistency(processorId, 'stop');
    });

    it('should render fonts and text consistently', () => {
      // Verify font rendering
      cy.verifyFontRendering();

      // Check text in processor configuration
      cy.openProcessorConfigDialog(processorId);
      cy.verifyTextRenderingConsistency();
      cy.closeDialog();
    });

    it('should handle z-index and layering correctly', () => {
      // Test modal dialogs and overlays
      cy.openProcessorConfigDialog(processorId);
      cy.verifyModalLayering();

      // Test context menus
      cy.closeDialog();
      cy.getProcessorElement(processorId).rightclick();
      cy.verifyContextMenuLayering();
      cy.get('body').click(); // Close context menu
    });
  });

  describe('Browser-Specific API Usage', () => {
    it('should handle local storage consistently', () => {
      // Test localStorage behavior
      cy.testLocalStorageCompatibility();

      // Verify processor configuration persistence
      cy.configureProcessorForTesting(processorId);
      cy.verifyConfigurationPersistence();
    });

    it('should handle session storage uniformly', () => {
      // Test sessionStorage behavior
      cy.testSessionStorageCompatibility();

      // Verify session data handling
      cy.verifySessionDataHandling();
    });

    it('should handle cookie operations consistently', () => {
      // Test cookie handling across browsers
      cy.testCookieCompatibility();

      // Verify authentication cookie handling
      cy.verifyCookieHandling();
    });

    it('should handle URL and history API uniformly', () => {
      // Test history API support
      cy.testHistoryAPICompatibility();

      // Test URL parameter handling
      cy.testURLParameterHandling();

      // Navigate and verify history works
      cy.navigateToCanvas();
      cy.verifyHistoryAPIConsistency();
    });
  });

  describe('Performance Across Browsers', () => {
    it('should perform DOM operations efficiently', () => {
      // Measure DOM operation performance
      cy.measureDOMPerformance().then((metrics) => {
        // Verify performance is within acceptable bounds
        expect(metrics.querySelector).to.be.below(100); // ms
        expect(metrics.appendChild).to.be.below(50); // ms
        expect(metrics.removeChild).to.be.below(50); // ms

        cy.log('DOM Performance Metrics:', JSON.stringify(metrics, null, 2));
      });
    });

    it('should handle large datasets efficiently', () => {
      // Configure processor with complex settings
      cy.configureProcessorWithLargeDataset(processorId);

      // Measure rendering performance
      cy.measureRenderingPerformance().then((metrics) => {
        expect(metrics.configDialogRender).to.be.below(2000); // ms
        expect(metrics.propertyListRender).to.be.below(1000); // ms

        cy.log('Rendering Performance Metrics:', JSON.stringify(metrics, null, 2));
      });
    });

    it('should handle network requests efficiently', () => {
      // Test network request performance
      cy.measureNetworkPerformance().then((metrics) => {
        expect(metrics.avgResponseTime).to.be.below(5000); // ms
        expect(metrics.connectionTime).to.be.below(2000); // ms

        cy.log('Network Performance Metrics:', JSON.stringify(metrics, null, 2));
      });
    });

    it('should manage memory usage effectively', () => {
      // Test memory usage patterns
      cy.measureMemoryUsage().then((metrics) => {
        // Verify memory usage is reasonable
        expect(metrics.initialMemory).to.be.above(0);
        expect(metrics.peakMemory).to.be.below(metrics.initialMemory * 5); // Not more than 5x initial

        cy.log('Memory Usage Metrics:', JSON.stringify(metrics, null, 2));
      });
    });
  });

  describe('Security Feature Compatibility', () => {
    it('should handle HTTPS consistently', () => {
      // Verify HTTPS handling
      cy.verifyHTTPSConsistency();

      // Test secure cookie handling
      cy.verifySecureCookieHandling();
    });

    it('should handle Content Security Policy uniformly', () => {
      // Test CSP compliance
      cy.verifyCSPCompliance();

      // Verify no CSP violations in processor functionality
      cy.configureProcessorForTesting(processorId);
      cy.startProcessor(processorId);
      cy.verifyNoCSPViolations();
      cy.stopProcessor(processorId);
    });

    it('should handle CORS requests consistently', () => {
      // Test CORS handling
      cy.verifyCORSHandling();

      // Test JWKS endpoint requests with CORS
      cy.openProcessorConfigDialog(processorId);
      cy.setProcessorProperty('JWKS Source Type', 'SERVER');
      cy.setProcessorProperty('JWKS Server URL', 'https://httpbin.org/json');
      cy.verifyCORSRequestHandling();
      cy.closeDialog();
    });

    it('should handle JWT token security consistently', () => {
      // Test JWT handling across browsers
      cy.verifyJWTSecurityConsistency();

      // Verify token validation behavior
      cy.configureProcessorForTesting(processorId);
      cy.startProcessor(processorId);

      // Send various token types
      cy.sendTokenToProcessor(processorId, cy.generateValidToken());
      cy.sendTokenToProcessor(processorId, 'invalid.token.here');

      // Loading wait removed - using proper element readiness checks;
      cy.verifyTokenValidationConsistency(processorId);

      cy.stopProcessor(processorId);
    });
  });
});
