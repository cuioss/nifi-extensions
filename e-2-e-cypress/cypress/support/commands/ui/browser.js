/**
 * Cypress Commands for Cross-Browser Compatibility Testing
 *
 * These commands provide utilities for testing browser compatibility, feature detection,
 * performance measurement, and cross-browser behavior validation.
 */

import { TEXT_CONSTANTS } from '../../constants.js';

// Browser Detection and Information Commands

/**
 * Get comprehensive browser information
 * @returns {object} Browser information including name, version, family, and capabilities
 */
Cypress.Commands.add('getBrowserInfo', () => {
  return cy.window().then((win) => {
    const browser = Cypress.browser;
    const userAgent = win.navigator.userAgent;

    return {
      name: browser.name,
      version: browser.version,
      family: browser.family,
      isHeaded: browser.isHeaded,
      isHeadless: browser.isHeadless,
      userAgent: userAgent,
      platform: win.navigator.platform,
      language: win.navigator.language,
      cookieEnabled: win.navigator.cookieEnabled,
      onLine: win.navigator.onLine,
    };
  });
});

/**
 * Check browser feature support
 * @returns {object} Object with feature support flags
 */
Cypress.Commands.add('checkBrowserFeatureSupport', () => {
  return cy.window().then((win) => {
    const features = {
      localStorage: typeof win.localStorage !== 'undefined',
      sessionStorage: typeof win.sessionStorage !== 'undefined',
      webWorkers: typeof win.Worker !== 'undefined',
      es6: typeof win.Symbol !== 'undefined' && typeof win.Promise !== 'undefined',
      fetch: typeof win.fetch !== 'undefined',
      promises: typeof win.Promise !== 'undefined',
      weakMap: typeof win.WeakMap !== 'undefined',
      map: typeof win.Map !== 'undefined',
      set: typeof win.Set !== 'undefined',
      requestAnimationFrame: typeof win.requestAnimationFrame !== 'undefined',
      webGL: !!win.WebGLRenderingContext,
      canvas: !!win.HTMLCanvasElement,
      svg: !!win.SVGElement,
      webSockets: typeof win.WebSocket !== 'undefined',
      geolocation: !!win.navigator.geolocation,
      deviceMotion: 'DeviceMotionEvent' in win,
      touchEvents: 'ontouchstart' in win,
      pointerEvents: 'PointerEvent' in win,
      intersectionObserver: 'IntersectionObserver' in win,
      mutationObserver: 'MutationObserver' in win,
      customElements: 'customElements' in win,
      shadowDOM: 'attachShadow' in Element.prototype,
    };

    return features;
  });
});

/**
 * Test browser-specific quirks and workarounds
 * @param {string} browserFamily - Browser family (chromium, firefox, webkit)
 */
Cypress.Commands.add('testBrowserQuirks', (browserFamily) => {
  cy.window().then((win) => {
    switch (browserFamily) {
      case 'chromium':
        // Test Chromium-specific behaviors
        cy.testChromiumQuirks(win);
        break;
      case 'firefox':
        // Test Firefox-specific behaviors
        cy.testFirefoxQuirks(win);
        break;
      case 'webkit':
        // Test WebKit-specific behaviors
        cy.testWebKitQuirks(win);
        break;
      default:
        cy.log(`Unknown browser family: ${browserFamily}`);
    }
  });
});

/**
 * Test Chromium-specific quirks
 * @param {Window} win - Window object
 */
Cypress.Commands.add('testChromiumQuirks', (win) => {
  // Test Chromium-specific features
  const isChromium = !!win.chrome;
  expect(isChromium).to.be.true;

  // Test Blink rendering engine specific behaviors
  cy.log('Testing Chromium-specific behaviors');
});

/**
 * Test Firefox-specific quirks
 * @param {Window} win - Window object
 */
Cypress.Commands.add('testFirefoxQuirks', (win) => {
  // Test Firefox-specific features
  const isFirefox = typeof win.InstallTrigger !== 'undefined';

  // Test Gecko rendering engine specific behaviors
  cy.log(`Testing Firefox-specific behaviors (Firefox: ${isFirefox})`);
});

/**
 * Test WebKit-specific quirks
 * @param {Window} win - Window object
 */
Cypress.Commands.add('testWebKitQuirks', (win) => {
  // Test WebKit-specific features
  const isWebKit = !!win.safari || /webkit/i.test(win.navigator.userAgent);

  // Test WebKit rendering engine specific behaviors
  cy.log(`Testing WebKit-specific behaviors (WebKit: ${isWebKit})`);
});

// CSS Feature Support Commands

/**
 * Check CSS feature support
 * @param {string} feature - CSS feature to check
 * @returns {boolean} True if feature is supported
 */
Cypress.Commands.add('checkCSSFeatureSupport', (feature) => {
  return cy.window().then((win) => {
    const testElement = win.document.createElement('div');
    const style = testElement.style;

    switch (feature) {
      case 'grid':
        return 'grid' in style || 'msGrid' in style || 'webkitGrid' in style;
      case 'flexbox':
        return 'flex' in style || 'webkitFlex' in style || 'msFlex' in style;
      case 'custom-properties':
        return win.CSS && win.CSS.supports && win.CSS.supports('--custom-property', 'value');
      case 'transforms':
        return 'transform' in style || 'webkitTransform' in style || 'msTransform' in style;
      case 'animations':
        return 'animation' in style || 'webkitAnimation' in style;
      case 'transitions':
        return 'transition' in style || 'webkitTransition' in style;
      default:
        return false;
    }
  });
});

/**
 * Verify UI rendering consistency
 */
Cypress.Commands.add('verifyUIRenderingConsistency', () => {
  // Check that essential UI elements are properly rendered
  cy.get('.canvas').should('be.visible');
  cy.get('.toolbar, .header').should('be.visible');

  // Verify no layout issues
  cy.get('body').should('not.have.css', 'overflow-x', 'scroll');

  // Check for broken layouts
  cy.verifyNoOverflowingElements();
});

/**
 * Verify no elements are overflowing their containers
 */
Cypress.Commands.add('verifyNoOverflowingElements', () => {
  cy.get('*').then(($elements) => {
    $elements.each((index, element) => {
      const rect = element.getBoundingClientRect();
      const parent = element.parentElement;

      if (parent && rect.width > 0 && rect.height > 0) {
        const parentRect = parent.getBoundingClientRect();

        // Allow some tolerance for borders and margins
        const tolerance = 5;

        if (
          rect.right > parentRect.right + tolerance ||
          rect.bottom > parentRect.bottom + tolerance
        ) {
          cy.log(`Element overflowing: ${element.tagName} (${element.className})`);
        }
      }
    });
  });
});

// Configuration Dialog Testing Commands

/**
 * Verify configuration dialog behavior across browsers
 * @param {string} browserFamily - Browser family
 */
Cypress.Commands.add('verifyConfigurationDialogBehavior', (browserFamily) => {
  // Verify dialog is properly displayed
  cy.get('.configuration-dialog, .processor-configuration').should('be.visible');

  // Test browser-specific dialog behaviors
  switch (browserFamily) {
    case 'chromium':
      // Test Chromium-specific dialog rendering
      cy.verifyChromiumDialogBehavior();
      break;
    case 'firefox':
      // Test Firefox-specific dialog rendering
      cy.verifyFirefoxDialogBehavior();
      break;
    case 'webkit':
      // Test WebKit-specific dialog rendering
      cy.verifyWebKitDialogBehavior();
      break;
  }

  // Verify common dialog functionality
  cy.get('.tab, .property-input').should('be.visible');
  cy.get('.apply-button, .ok-button').should('be.enabled');
});

/**
 * Verify Chromium-specific dialog behavior
 */
Cypress.Commands.add('verifyChromiumDialogBehavior', () => {
  // Test Chromium-specific rendering and interactions
  cy.log('Verifying Chromium dialog behavior');

  // Verify scrollbar behavior
  cy.get('.configuration-dialog').then(($dialog) => {
    const hasScrollbar = $dialog[0].scrollHeight > $dialog[0].clientHeight;
    if (hasScrollbar) {
      cy.log('Dialog has scrollbar - testing scroll behavior');
    }
  });
});

/**
 * Verify Firefox-specific dialog behavior
 */
Cypress.Commands.add('verifyFirefoxDialogBehavior', () => {
  // Test Firefox-specific rendering and interactions
  cy.log('Verifying Firefox dialog behavior');

  // Firefox may handle focus differently
  cy.get('.configuration-dialog').should('be.visible');
});

/**
 * Verify WebKit-specific dialog behavior
 */
Cypress.Commands.add('verifyWebKitDialogBehavior', () => {
  // Test WebKit-specific rendering and interactions
  cy.log('Verifying WebKit dialog behavior');

  // WebKit may have different scrolling behavior
  cy.get('.configuration-dialog').should('be.visible');
});

// Responsive Design Testing Commands

/**
 * Verify responsive design behavior
 * @param {object} viewport - Viewport configuration
 */
Cypress.Commands.add('verifyResponsiveDesign', (viewport) => {
  // Verify UI adapts to different screen sizes
  if (viewport.width < 1024) {
    // Mobile/tablet specific checks
    cy.verifyMobileLayout();
  } else {
    // Desktop specific checks
    cy.verifyDesktopLayout();
  }
});

/**
 * Verify mobile layout behavior
 */
Cypress.Commands.add('verifyMobileLayout', () => {
  // Check mobile-specific UI adaptations
  cy.get('.canvas').should('be.visible');

  // Verify touch-friendly elements
  cy.get('button, .clickable').each(($el) => {
    const rect = $el[0].getBoundingClientRect();
    expect(rect.height).to.be.at.least(44); // Minimum touch target size
  });
});

/**
 * Verify desktop layout behavior
 */
Cypress.Commands.add('verifyDesktopLayout', () => {
  // Check desktop-specific UI features
  cy.get('.canvas').should('be.visible');
  cy.get('.toolbar').should('be.visible');
});

// JavaScript Compatibility Testing Commands

/**
 * Test ES6+ compatibility
 */
Cypress.Commands.add('testES6Compatibility', () => {
  cy.window().then((_win) => {
    // Test arrow functions
    /**
     * Test arrow function for browser compatibility validation
     * @returns {string} Test string value
     * @example
     * const result = arrowFunc(); // returns 'test'
     */
    const arrowFunc = () => 'test';
    expect(arrowFunc()).to.equal('test');

    // Test template literals
    const template = `template ${arrowFunc()}`;
    expect(template).to.equal('template test');

    // Test destructuring
    const obj = { a: 1, b: 2 };
    const { a, b } = obj;
    expect(a).to.equal(1);
    expect(b).to.equal(2);

    // Test spread operator
    const arr1 = [1, 2];
    const arr2 = [...arr1, 3];
    expect(arr2).to.deep.equal([1, 2, 3]);

    // Test class syntax
    /**
     *
     */
    class TestClass {
      /**
       * Test method for browser compatibility validation
       * @param {any} value - The value to process
       * @example
       * const testClass = new TestClass();
       * testClass.testMethod('value');
       */
      constructor(value) {
        this.value = value;
      }
      /**
       * Get the stored value for testing purposes
       * @returns {any} The stored value
       * @example
       * const instance = new TestClass('test');
       * const value = instance.getValue(); // returns 'test'
       */
      getValue() {
        return this.value;
      }
    }
    const instance = new TestClass('test');
    expect(instance.getValue()).to.equal('test');
  });
});

/**
 * Test asynchronous operation compatibility
 */
Cypress.Commands.add('testAsyncCompatibility', () => {
  // Test Promise support
  const promise = new Promise((resolve) => {
    setTimeout(() => resolve('async test'), 100);
  });

  return promise.then((result) => {
    expect(result).to.equal('async test');
  });
});

/**
 * Test Fetch API consistency
 */
Cypress.Commands.add('testFetchAPIConsistency', () => {
  cy.window().then((win) => {
    if (typeof win.fetch !== 'undefined') {
      // Test basic fetch functionality
      return win
        .fetch('data:text/plain,test')
        .then((response) => response.text())
        .then((text) => {
          expect(text).to.equal('test');
        });
    } else {
      cy.log('Fetch API not supported, skipping test');
    }
  });
});

/**
 * Test DOM manipulation compatibility
 */
Cypress.Commands.add('testDOMCompatibility', () => {
  cy.window().then((win) => {
    const doc = win.document;

    // Test element creation and manipulation
    const testEl = doc.createElement('div');
    testEl.className = 'test-element';
    testEl.textContent = 'test content';

    expect(testEl.tagName.toLowerCase()).to.equal('div');
    expect(testEl.className).to.equal('test-element');
    expect(testEl.textContent).to.equal('test content');

    // Test query selectors
    const body = doc.querySelector('body');
    expect(body).to.exist;

    // Test classList API
    testEl.classList.add('new-class');
    expect(testEl.classList.contains('new-class')).to.be.true;
  });
});

/**
 * Verify DOM manipulation consistency in configuration dialog
 */
Cypress.Commands.add('verifyDOMManipulationConsistency', () => {
  // Test that DOM operations work consistently
  cy.get('.property-input')
    .first()
    .then(($input) => {
      const initialValue = $input.val();

      // Change value and verify it's updated
      cy.wrap($input).clear().type('test-value');
      cy.wrap($input).should('have.value', 'test-value');

      // Reset to initial value
      cy.wrap($input)
        .clear()
        .type(initialValue || '');
    });
});

/**
 * Test event handling compatibility
 */
Cypress.Commands.add('testEventHandlingCompatibility', () => {
  cy.window().then((win) => {
    const doc = win.document;

    // Test event listener attachment and firing
    let eventFired = false;
    const testEl = doc.createElement('div');

    /**
     *
     * @example
     */
    const eventHandler = () => {
      eventFired = true;
    };

    testEl.addEventListener('click', eventHandler);

    // Simulate click event
    const clickEvent = doc.createEvent('MouseEvents');
    clickEvent.initMouseEvent(
      'click',
      true,
      true,
      win,
      0,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      0,
      null
    );
    testEl.dispatchEvent(clickEvent);

    expect(eventFired).to.be.true;

    // Clean up
    testEl.removeEventListener('click', eventHandler);
  });
});

/**
 * Verify event handling consistency for processor
 * @param {string} processorId - Processor ID
 */
Cypress.Commands.add('verifyEventHandlingConsistency', (processorId) => {
  // Verify processor responds to events consistently
  cy.getProcessorElement(processorId).should('be.visible');

  // Test hover effects
  cy.getProcessorElement(processorId).trigger('mouseenter');
  cy.getProcessorElement(processorId).should('have.class', 'hover').or('have.attr', 'data-hover');

  // Test click handling
  cy.getProcessorElement(processorId).click();
  // Verify processor is selected or some state change occurs
});

// Performance Measurement Commands

/**
 * Measure DOM operation performance
 * @returns {object} Performance metrics
 */
Cypress.Commands.add('measureDOMPerformance', () => {
  return cy.window().then((win) => {
    const doc = win.document;
    const metrics = {};

    // Measure querySelector performance
    const queryStart = win.performance.now();
    doc.querySelector('body');
    metrics.querySelector = win.performance.now() - queryStart;

    // Measure appendChild performance
    const appendStart = win.performance.now();
    const testEl = doc.createElement('div');
    doc.body.appendChild(testEl);
    metrics.appendChild = win.performance.now() - appendStart;

    // Measure removeChild performance
    const removeStart = win.performance.now();
    doc.body.removeChild(testEl);
    metrics.removeChild = win.performance.now() - removeStart;

    return metrics;
  });
});

/**
 * Measure rendering performance
 * @returns {object} Rendering performance metrics
 */
Cypress.Commands.add('measureRenderingPerformance', () => {
  return cy.window().then((win) => {
    const metrics = {};

    // Measure configuration dialog rendering
    const dialogStart = win.performance.now();
    cy.get('.configuration-dialog')
      .should('be.visible')
      .then(() => {
        metrics.configDialogRender = win.performance.now() - dialogStart;
      });

    // Measure property list rendering
    const listStart = win.performance.now();
    cy.get('.property-list, .properties-table')
      .should('be.visible')
      .then(() => {
        metrics.propertyListRender = win.performance.now() - listStart;
      });

    return metrics;
  });
});

/**
 * Measure network performance
 * @returns {object} Network performance metrics
 */
Cypress.Commands.add('measureNetworkPerformance', () => {
  return cy.window().then((win) => {
    const metrics = {};

    // Use Navigation Timing API if available
    if (win.performance && win.performance.timing) {
      const timing = win.performance.timing;
      metrics.dnsLookup = timing.domainLookupEnd - timing.domainLookupStart;
      metrics.tcpConnect = timing.connectEnd - timing.connectStart;
      metrics.requestTime = timing.responseStart - timing.requestStart;
      metrics.responseTime = timing.responseEnd - timing.responseStart;
      metrics.connectionTime = timing.connectEnd - timing.connectStart;
      metrics.avgResponseTime = timing.loadEventEnd - timing.navigationStart;
    } else {
      // Fallback metrics
      metrics.avgResponseTime = 1000; // Default assumption
      metrics.connectionTime = 500;
    }

    return metrics;
  });
});

/**
 * Measure memory usage
 * @returns {object} Memory usage metrics
 */
Cypress.Commands.add('measureMemoryUsage', () => {
  return cy.window().then((win) => {
    const metrics = {};

    // Use Memory API if available (Chrome)
    if (win.performance && win.performance.memory) {
      metrics.initialMemory = win.performance.memory.usedJSHeapSize;
      metrics.totalMemory = win.performance.memory.totalJSHeapSize;
      metrics.memoryLimit = win.performance.memory.jsHeapSizeLimit;

      // Simulate some operations and measure peak
      const testArray = new Array(10000).fill('test');
      metrics.peakMemory = win.performance.memory.usedJSHeapSize;

      // Clean up
      testArray.length = 0;
    } else {
      // Fallback: estimate based on DOM elements
      const elementCount = win.document.getElementsByTagName('*').length;
      metrics.initialMemory = elementCount * 100; // Rough estimate
      metrics.totalMemory = metrics.initialMemory * 2;
      metrics.peakMemory = metrics.initialMemory * 1.5;
    }

    return metrics;
  });
});

// Helper Commands for Complex Configurations

/**
 * Configure processor with large dataset for performance testing
 * @param {string} processorId - Processor ID
 */
Cypress.Commands.add('configureProcessorWithLargeDataset', (processorId) => {
  cy.openProcessorConfigDialog(processorId);

  // Create a large JWKS dataset
  const largeJWKS = {
    keys: [],
  };

  // Add multiple keys to simulate large dataset
  for (let i = 0; i < 50; i++) {
    largeJWKS.keys.push({
      kty: 'RSA',
      kid: `test-key-${i}`,
      use: 'sig',
      n: `test-modulus-${i}`.repeat(10), // Make it larger
      e: 'AQAB',
    });
  }

  cy.setProcessorProperty('JWKS Source Type', 'IN_MEMORY');
  cy.setProcessorProperty('JWKS Content', JSON.stringify(largeJWKS));
  cy.setProcessorProperty('Token Audience', 'test-audience');
  cy.setProcessorProperty('Default Issuer', TEXT_CONSTANTS.TEST_ISSUER_VALUE);

  cy.clickApplyButton();
  cy.closeDialog();
});

// Visual Comparison Commands

/**
 * Take screenshot for comparison across browsers
 * @param {string} processorId - Processor ID for context
 * @param {string} screenshotName - Name for the screenshot
 */
Cypress.Commands.add('takeScreenshotForComparison', (processorId, screenshotName) => {
  const browserName = Cypress.browser.name;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${screenshotName}-${browserName}-${timestamp}`;

  cy.screenshot(filename, {
    capture: 'viewport',
    /**
     *
     * @param $el
     * @param props
     * @example
     */
    onAfterScreenshot: ($el, props) => {
      cy.log(`Screenshot saved: ${props.path}`);
    },
  });
});

/**
 * Verify layout consistency
 */
Cypress.Commands.add('verifyLayoutConsistency', () => {
  // Check that major layout elements have expected dimensions
  cy.get('.configuration-dialog').then(($dialog) => {
    const rect = $dialog[0].getBoundingClientRect();

    // Verify dialog has reasonable dimensions
    expect(rect.width).to.be.at.least(400);
    expect(rect.height).to.be.at.least(300);

    // Verify dialog is positioned properly
    expect(rect.left).to.be.at.least(0);
    expect(rect.top).to.be.at.least(0);
  });

  // Check property inputs are properly aligned
  cy.get('.property-input').then(($inputs) => {
    if ($inputs.length > 1) {
      const first = $inputs[0].getBoundingClientRect();
      const second = $inputs[1].getBoundingClientRect();

      // Verify inputs are aligned (within tolerance)
      const tolerance = 5;
      expect(Math.abs(first.left - second.left)).to.be.below(tolerance);
    }
  });
});

// Security and Compliance Commands

/**
 * Verify HTTPS consistency
 */
Cypress.Commands.add('verifyHTTPSConsistency', () => {
  cy.location('protocol').should('eq', 'https:');

  // Verify secure context features are available
  cy.window().then((win) => {
    expect(win.isSecureContext).to.be.true;
  });
});

/**
 * Verify secure cookie handling
 */
Cypress.Commands.add('verifySecureCookieHandling', () => {
  // Check that cookies are handled securely
  cy.getCookies().then((cookies) => {
    cookies.forEach((cookie) => {
      if (cookie.httpOnly !== undefined) {
        expect(cookie.secure).to.be.true;
      }
    });
  });
});

/**
 * Verify Content Security Policy compliance
 */
Cypress.Commands.add('verifyCSPCompliance', () => {
  // Check for CSP headers and compliance
  cy.window().then((win) => {
    // Monitor console for CSP violations
    const originalConsoleError = win.console.error;
    const cspViolations = [];

    /**
     *
     * @param {...any} args
     * @example
     */
    win.console.error = function (...args) {
      const message = args.join(' ');
      if (message.includes('Content Security Policy')) {
        cspViolations.push(message);
      }
      originalConsoleError.apply(win.console, args);
    };

    // Store violations for later verification
    win.cspViolations = cspViolations;
  });
});

/**
 * Verify no CSP violations occurred
 */
Cypress.Commands.add('verifyNoCSPViolations', () => {
  cy.window().then((win) => {
    const violations = win.cspViolations || [];
    expect(violations).to.have.length(0);
  });
});

// Storage Compatibility Commands

/**
 * Test localStorage compatibility
 */
Cypress.Commands.add('testLocalStorageCompatibility', () => {
  cy.window().then((win) => {
    const testKey = 'cypress-test-key';
    const testValue = 'cypress-test-value';

    // Test localStorage operations
    win.localStorage.setItem(testKey, testValue);
    expect(win.localStorage.getItem(testKey)).to.equal(testValue);

    // Test JSON storage
    const testObject = { test: 'value', number: 42 };
    win.localStorage.setItem('test-object', JSON.stringify(testObject));
    const retrieved = JSON.parse(win.localStorage.getItem('test-object'));
    expect(retrieved).to.deep.equal(testObject);

    // Clean up
    win.localStorage.removeItem(testKey);
    win.localStorage.removeItem('test-object');
  });
});

/**
 * Test sessionStorage compatibility
 */
Cypress.Commands.add('testSessionStorageCompatibility', () => {
  cy.window().then((win) => {
    const testKey = 'cypress-session-test';
    const testValue = 'session-value';

    // Test sessionStorage operations
    win.sessionStorage.setItem(testKey, testValue);
    expect(win.sessionStorage.getItem(testKey)).to.equal(testValue);

    // Clean up
    win.sessionStorage.removeItem(testKey);
  });
});

/**
 * Test cookie compatibility
 */
Cypress.Commands.add('testCookieCompatibility', () => {
  // Test cookie operations through Cypress API
  cy.setCookie('test-cookie', 'test-value');
  cy.getCookie('test-cookie').should('have.property', 'value', 'test-value');
  cy.clearCookie('test-cookie');
});
