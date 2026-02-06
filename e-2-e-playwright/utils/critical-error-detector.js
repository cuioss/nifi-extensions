/**
 * @file Critical Error Detector
 * Detects critical errors that should cause immediate test failure
 * @version 1.0.0
 */

/**
 * Critical error patterns that should cause immediate test failure
 */
const CRITICAL_ERROR_PATTERNS = {
  JAVASCRIPT_ERRORS: [
    /Uncaught Error/i,
    /Uncaught TypeError/i,
    /Uncaught ReferenceError/i,
    /Uncaught SyntaxError/i,
    /Mismatched anonymous define\(\)/i,
    /Module name .* has not been loaded/i,
    /Script error/i
  ],

  UI_LOADING_STALLS: [
    /Loading JWT Validator UI\.\.\.$/, // Only match if it ends with "..." (actual stall)
    /UI loading timeout/i,
    /Loading indicator still visible/i,
    /UI failed to initialize/i,
    /Loading.*UI.*\.\.\.$/ // Only match if it ends with "..." (actual stall)
  ],

  MODULE_LOADING_ERRORS: [
    /RequireJS/i,
    /define\(\) module/i,
    /AMD module/i,
    /Module loading failed/i
  ],

  PAGE_ERRORS: [
    /Page crashed/i,
    /Navigation failed/i,
    /Script timeout/i
  ]
};

/**
 * Selectors for detecting empty canvas or missing content
 */
const EMPTY_CANVAS_SELECTORS = {
  PROCESSOR_ELEMENTS: [
    'g.processor',
    'rect.processor',
    '[data-component-type="processor"]',
    'g.component',
    '.processor-component'
  ],

  CANVAS_SELECTORS: [
    '#canvas-container',
    '#canvas',
    '.canvas',
    'svg',
    '.main-canvas'
  ]
};

/**
 * Critical Error Detector Class
 */
export class CriticalErrorDetector {
  constructor() {
    this.detectedErrors = [];
    this.isMonitoring = false;
  }

  /**
   * Start monitoring page for critical errors
   */
  startMonitoring(page, testInfo) {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.detectedErrors = [];

    // Monitor console messages for critical errors
    page.on('console', (msg) => {
      this.checkConsoleMessage(msg, testInfo);
    });

    // Monitor page errors
    page.on('pageerror', (error) => {
      this.checkPageError(error, testInfo);
    });

    // Monitor page crashes
    page.on('crash', () => {
      this.addCriticalError('PAGE_CRASH', 'Page crashed unexpectedly', testInfo);
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
  }

  /**
   * Check console message for critical errors
   */
  checkConsoleMessage(msg, testInfo) {
    const message = msg.text();
    const type = msg.type();

    // Skip success messages that indicate proper UI initialization
    const isSuccessMessage = /Loading indicator hidden|successfully hidden|initialization completed|Component registration successful/i.test(message);

    if (isSuccessMessage) {
      return; // Skip success messages from critical error detection
    }

    // Check for JavaScript errors
    if (type === 'error') {
      for (const pattern of CRITICAL_ERROR_PATTERNS.JAVASCRIPT_ERRORS) {
        if (pattern.test(message)) {
          this.addCriticalError(
            'JAVASCRIPT_ERROR',
            `JavaScript Error: ${message}`,
            testInfo,
            msg.location()
          );
          break;
        }
      }

      // Check for module loading errors
      for (const pattern of CRITICAL_ERROR_PATTERNS.MODULE_LOADING_ERRORS) {
        if (pattern.test(message)) {
          this.addCriticalError(
            'MODULE_LOADING_ERROR',
            `Module Loading Error: ${message}`,
            testInfo,
            msg.location()
          );
          break;
        }
      }
    }

    // Check for UI loading stalls in any message type (but skip debug messages)
    if (type !== 'debug') {
      for (const pattern of CRITICAL_ERROR_PATTERNS.UI_LOADING_STALLS) {
        if (pattern.test(message)) {
          this.addCriticalError(
            'UI_LOADING_STALL',
            `UI Loading Stall Detected: ${message}`,
            testInfo
          );
          break;
        }
      }
    }
  }

  /**
   * Check page error for critical patterns
   */
  checkPageError(error, testInfo) {
    const message = error.message;

    // All page errors are considered critical
    this.addCriticalError(
      'PAGE_ERROR',
      `Page Error: ${message}`,
      testInfo,
      null,
      error.stack
    );
  }

  /**
   * Add a critical error to the collection
   */
  addCriticalError(type, message, testInfo, location = null, stack = null) {
    const error = {
      type,
      message,
      timestamp: new Date().toISOString(),
      test: testInfo?.title || 'Unknown Test',
      testFile: testInfo?.titlePath?.[0] || 'Unknown File',
      location,
      stack
    };

    this.detectedErrors.push(error);

    // Log the critical error immediately
    console.error(`🚨 CRITICAL ERROR DETECTED: ${type} - ${message}`);
  }

  /**
   * Check if page/canvas is empty (no processors)
   */
  async checkForEmptyCanvas(page, testInfo) {
    try {
      // Check if canvas exists
      const canvasExists = await this.checkCanvasExists(page);
      if (!canvasExists) {
        this.addCriticalError(
          'EMPTY_PAGE',
          'Canvas element not found - page appears to be empty',
          testInfo
        );
        return false;
      }

      // Check for processors on canvas
      const hasProcessors = await this.checkForProcessors(page);
      if (!hasProcessors) {
        this.addCriticalError(
          'EMPTY_CANVAS',
          'No processors found on canvas - canvas is empty',
          testInfo
        );
        return false;
      }

      return true;
    } catch (error) {
      this.addCriticalError(
        'CANVAS_CHECK_ERROR',
        `Error checking canvas: ${error.message}`,
        testInfo
      );
      return false;
    }
  }

  /**
   * Check if canvas element exists
   */
  async checkCanvasExists(page) {
    for (const selector of EMPTY_CANVAS_SELECTORS.CANVAS_SELECTORS) {
      try {
        const element = page.locator(selector);
        const isVisible = await element.isVisible();
        if (isVisible) {
          return true;
        }
      } catch {
        // Continue to next selector
      }
    }
    return false;
  }

  /**
   * Check for processors on canvas
   */
  async checkForProcessors(page) {
    for (const selector of EMPTY_CANVAS_SELECTORS.PROCESSOR_ELEMENTS) {
      try {
        const locator = page.locator(selector).first();
        await locator.waitFor({ timeout: 2000 });
        return true;
      } catch {
        // Continue to next selector
      }
    }
    return false;
  }

  /**
   * Check for UI loading stalls
   */
  async checkForUILoadingStalls(page, testInfo) {
    try {
      // Check for loading indicator text
      const loadingStallSelectors = [
        'text="Loading JWT Validator UI..."',
        'text="Loading JWT Validator UI"',
        'text=Loading JWT Validator UI...',
        'text=Loading JWT Validator UI',
        '[class*="loading"]:has-text("JWT")',
        '[class*="loading"]:has-text("UI")'
      ];

      for (const selector of loadingStallSelectors) {
        try {
          const element = page.locator(selector);
          const isVisible = await element.isVisible();
          if (isVisible) {
            const textContent = await element.textContent();
            this.addCriticalError(
              'UI_LOADING_STALL',
              `UI is stalled at loading indicator: "${textContent}"`,
              testInfo
            );
            return true;
          }
        } catch {
          // Continue to next selector
        }
      }

      return false;
    } catch (error) {
      this.addCriticalError(
        'UI_STALL_CHECK_ERROR',
        `Error checking for UI stalls: ${error.message}`,
        testInfo
      );
      return false;
    }
  }

  /**
   * Fail test immediately if critical errors detected
   */
  failTestOnCriticalErrors() {
    if (this.detectedErrors.length > 0) {
      const errorSummary = this.detectedErrors
        .map(error => `${error.type}: ${error.message}`)
        .join('\n');

      throw new Error(
        `🚨 CRITICAL ERRORS DETECTED - Test failed immediately:\n\n${errorSummary}\n\n` +
        `Total errors: ${this.detectedErrors.length}\n` +
        `This test is designed to fail when critical UI or JavaScript errors are detected.`
      );
    }
  }

  /**
   * Get all detected errors
   */
  getDetectedErrors() {
    return [...this.detectedErrors];
  }

  /**
   * Clear detected errors
   */
  clearErrors() {
    this.detectedErrors = [];
  }

  /**
   * Check if any critical errors have been detected
   */
  hasCriticalErrors() {
    return this.detectedErrors.length > 0;
  }
}

/**
 * Global instance for use across tests
 */
export const globalCriticalErrorDetector = new CriticalErrorDetector();

/**
 * Utility function to setup critical error detection for a test
 */
export async function setupCriticalErrorDetection(page, testInfo) {
  globalCriticalErrorDetector.startMonitoring(page, testInfo);

  // Skip initial canvas checks during setup - processor setup will handle canvas state
  // Only check for UI loading stalls which are immediate issues
  await globalCriticalErrorDetector.checkForUILoadingStalls(page, testInfo);

  // Fail immediately if any critical errors detected
  globalCriticalErrorDetector.failTestOnCriticalErrors();
}

/**
 * Utility function to check for critical errors during test execution
 */
export async function checkCriticalErrors(page, testInfo) {
  // Check if NiFi is accessible before performing critical error checks
  try {
    const response = await page.request.get('https://localhost:9095/nifi/nifi-api/system-diagnostics', {
      timeout: 5000,
      failOnStatusCode: false
    });
    const isAccessible = response && ((response.status() >= 200 && response.status() < 400) || response.status() === 401);

    if (!isAccessible) {
      // NiFi is not accessible, fail the test
      throw new Error(
        'PRECONDITION FAILED: NiFi service is not accessible - cannot perform critical error checks. ' +
        'Make sure NiFi is running at https://localhost:9095/nifi'
      );
    }
  } catch (error) {
    // NiFi is not accessible, fail the test
    throw new Error(
      'PRECONDITION FAILED: NiFi service is not accessible - cannot perform critical error checks. ' +
      'Make sure NiFi is running at https://localhost:9095/nifi. ' +
      `Error: ${error.message}`
    );
  }

  await globalCriticalErrorDetector.checkForEmptyCanvas(page, testInfo);
  await globalCriticalErrorDetector.checkForUILoadingStalls(page, testInfo);
  globalCriticalErrorDetector.failTestOnCriticalErrors();
}

/**
 * Utility function to cleanup critical error detection
 */
export function cleanupCriticalErrorDetection() {
  globalCriticalErrorDetector.stopMonitoring();
  globalCriticalErrorDetector.clearErrors();
}