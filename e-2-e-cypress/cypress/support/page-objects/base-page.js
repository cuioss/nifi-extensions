/**
 * Base page object class for NiFi E2E tests
 * Provides common functionality for all page objects
 */

import { waitForElement, safeClick, waitForLoadingComplete } from '../utils/ui-helpers.js';
import { validateNoConsoleErrors } from '../utils/validation-helpers.js';
import { startErrorTracking, assertNoErrors } from '../utils/error-tracking.js';

export class BasePage {
  constructor() {
    this.timeout = 15000;
    this.shortTimeout = 5000;
  }

  /**
   * Navigate to page and wait for it to load
   * @param {string} url - URL to navigate to
   * @param {Object} options - Navigation options
   */
  visit(url = '/', options = {}) {
    const { validateLoad = true, timeout = 30000 } = options;
    
    cy.log(`🌐 Navigating to: ${url}`);
    
    if (validateLoad) {
      startErrorTracking({ includeWarnings: false });
    }
    
    cy.visit(url, { failOnStatusCode: false, timeout });
    
    if (validateLoad) {
      this.waitForPageLoad();
      assertNoErrors(`Page navigation to ${url}`, { allowWarnings: true });
    }
    
    return this;
  }

  /**
   * Wait for page to load completely
   * @param {Object} options - Wait options
   */
  waitForPageLoad(options = {}) {
    const { timeout = this.timeout } = options;
    
    cy.log('⏳ Waiting for page to load');
    
    // Wait for body to be present
    cy.get('body', { timeout }).should('be.visible');
    
    // Wait for any loading indicators to disappear
    waitForLoadingComplete({ timeout });
    
    // Wait for critical page elements
    this.waitForCriticalElements();
    
    cy.log('✅ Page loaded successfully');
    return this;
  }

  /**
   * Wait for critical page elements (to be overridden by subclasses)
   */
  waitForCriticalElements() {
    // Base implementation - subclasses should override
    cy.get('body').should('be.visible');
  }

  /**
   * Click element with enhanced error handling
   * @param {string} selector - CSS selector
   * @param {Object} options - Click options
   */
  click(selector, options = {}) {
    const { errorContext = `Clicking ${selector}`, ...clickOptions } = options;
    
    safeClick(selector, { 
      timeout: this.timeout,
      errorContext,
      ...clickOptions
    });
    
    return this;
  }

  /**
   * Wait for element to be visible
   * @param {string} selector - CSS selector
   * @param {Object} options - Wait options
   */
  waitFor(selector, options = {}) {
    const { timeout = this.timeout } = options;
    
    waitForElement(selector, { timeout, visible: true });
    return this;
  }

  /**
   * Type text into element
   * @param {string} selector - CSS selector
   * @param {string} text - Text to type
   * @param {Object} options - Type options
   */
  type(selector, text, options = {}) {
    const { clear = true, timeout = this.timeout } = options;
    
    cy.get(selector, { timeout })
      .should('be.visible')
      .should('not.be.disabled');
    
    if (clear) {
      cy.get(selector).clear();
    }
    
    cy.get(selector).type(text);
    return this;
  }

  /**
   * Select option from dropdown
   * @param {string} selector - CSS selector for select element
   * @param {string} value - Value to select
   * @param {Object} options - Select options
   */
  select(selector, value, options = {}) {
    const { timeout = this.timeout } = options;
    
    cy.get(selector, { timeout })
      .should('be.visible')
      .should('not.be.disabled')
      .select(value);
    
    return this;
  }

  /**
   * Check if element exists
   * @param {string} selector - CSS selector
   * @param {Object} options - Check options
   * @returns {Cypress.Chainable<boolean>} True if element exists
   */
  exists(selector, options = {}) {
    return cy.get('body').then($body => {
      return $body.find(selector).length > 0;
    });
  }

  /**
   * Assert element contains text
   * @param {string} selector - CSS selector
   * @param {string} text - Expected text
   * @param {Object} options - Assertion options
   */
  shouldContain(selector, text, options = {}) {
    const { timeout = this.timeout } = options;
    
    cy.get(selector, { timeout })
      .should('be.visible')
      .should('contain', text);
    
    return this;
  }

  /**
   * Assert element is visible
   * @param {string} selector - CSS selector
   * @param {Object} options - Assertion options
   */
  shouldBeVisible(selector, options = {}) {
    const { timeout = this.timeout } = options;
    
    cy.get(selector, { timeout })
      .should('be.visible');
    
    return this;
  }

  /**
   * Assert element is not visible
   * @param {string} selector - CSS selector
   * @param {Object} options - Assertion options
   */
  shouldNotBeVisible(selector, options = {}) {
    const { timeout = this.timeout } = options;
    
    cy.get(selector, { timeout })
      .should('not.be.visible');
    
    return this;
  }

  /**
   * Assert element does not exist
   * @param {string} selector - CSS selector
   * @param {Object} options - Assertion options
   */
  shouldNotExist(selector, options = {}) {
    const { timeout = this.timeout } = options;
    
    cy.get(selector, { timeout })
      .should('not.exist');
    
    return this;
  }

  /**
   * Scroll to element
   * @param {string} selector - CSS selector
   * @param {Object} options - Scroll options
   */
  scrollTo(selector, options = {}) {
    const { position = 'center' } = options;
    
    cy.get(selector)
      .scrollIntoView({ position })
      .should('be.visible');
    
    return this;
  }

  /**
   * Take screenshot with descriptive name
   * @param {string} name - Screenshot name
   * @param {Object} options - Screenshot options
   */
  screenshot(name, options = {}) {
    cy.screenshot(name, options);
    return this;
  }

  /**
   * Wait for specific duration
   * @param {number} ms - Milliseconds to wait
   */
  wait(ms) {
    cy.wait(ms);
    return this;
  }

  /**
   * Validate no console errors occurred
   * @param {string} operation - Description of operation
   * @param {Object} options - Validation options
   */
  validateNoErrors(operation, options = {}) {
    validateNoConsoleErrors(operation, options);
    return this;
  }

  /**
   * Get element text content
   * @param {string} selector - CSS selector
   * @param {Object} options - Get options
   * @returns {Cypress.Chainable<string>} Element text content
   */
  getText(selector, options = {}) {
    const { timeout = this.timeout } = options;
    
    return cy.get(selector, { timeout })
      .should('be.visible')
      .invoke('text');
  }

  /**
   * Get element attribute value
   * @param {string} selector - CSS selector
   * @param {string} attribute - Attribute name
   * @param {Object} options - Get options
   * @returns {Cypress.Chainable<string>} Attribute value
   */
  getAttribute(selector, attribute, options = {}) {
    const { timeout = this.timeout } = options;
    
    return cy.get(selector, { timeout })
      .should('be.visible')
      .invoke('attr', attribute);
  }

  /**
   * Right-click on element
   * @param {string} selector - CSS selector
   * @param {Object} options - Right-click options
   */
  rightClick(selector, options = {}) {
    const { force = true, timeout = this.timeout } = options;
    
    cy.get(selector, { timeout })
      .should('be.visible')
      .rightclick({ force });
    
    return this;
  }

  /**
   * Double-click on element
   * @param {string} selector - CSS selector
   * @param {Object} options - Double-click options
   */
  doubleClick(selector, options = {}) {
    const { force = true, timeout = this.timeout } = options;
    
    cy.get(selector, { timeout })
      .should('be.visible')
      .dblclick({ force });
    
    return this;
  }

  /**
   * Hover over element
   * @param {string} selector - CSS selector
   * @param {Object} options - Hover options
   */
  hover(selector, options = {}) {
    const { timeout = this.timeout } = options;
    
    cy.get(selector, { timeout })
      .should('be.visible')
      .trigger('mouseover');
    
    return this;
  }

  /**
   * Press keyboard key
   * @param {string} key - Key to press (e.g., 'Enter', 'Escape', 'Tab')
   * @param {Object} options - Key press options
   */
  pressKey(key, options = {}) {
    const { element = 'body' } = options;
    
    cy.get(element).type(`{${key}}`);
    return this;
  }

  /**
   * Clear browser storage
   */
  clearStorage() {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.window().then(win => {
      if (win.sessionStorage) {
        win.sessionStorage.clear();
      }
    });
    return this;
  }

  /**
   * Reload page
   * @param {Object} options - Reload options
   */
  reload(options = {}) {
    const { forceReload = false } = options;
    
    cy.reload(forceReload);
    this.waitForPageLoad();
    return this;
  }
}
