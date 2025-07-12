/**
 * @file Selector Strategy - Manage selector patterns and element discovery
 * Provides a strategic approach to finding elements with multiple selector fallbacks
 * @version 1.0.0
 */

/**
 * Selector strategy class for managing multiple selector patterns
 */
export class SelectorStrategy {
  constructor(selectors, name = 'Unknown') {
    this.selectors = Array.isArray(selectors) ? selectors : [selectors];
    this.name = name;
  }

  /**
   * Find first matching element using any of the selectors
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @returns {Promise<Element|null>} First matching element or null
   */
  async findFirst(page) {
    for (const selector of this.selectors) {
      try {
        const element = await page.$(selector);
        if (element) return element;
      } catch (e) {
        // Continue to next selector if this one fails
      }
    }
    return null;
  }

  /**
   * Find all matching elements using any of the selectors
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @returns {Promise<Array>} Array of matching elements
   */
  async findAll(page) {
    for (const selector of this.selectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) return elements;
      } catch (e) {
        // Continue to next selector if this one fails
      }
    }
    return [];
  }

  /**
   * Try each selector and return information about what was found
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @returns {Promise<Object>} Selection results with details
   */
  async findWithDetails(page) {
    const results = {
      found: false,
      selector: null,
      elements: [],
      attempts: []
    };

    for (const selector of this.selectors) {
      try {
        const elements = await page.$$(selector);
        results.attempts.push({ selector, count: elements.length, success: elements.length > 0 });
        
        if (elements.length > 0 && !results.found) {
          results.found = true;
          results.selector = selector;
          results.elements = elements;
        }
      } catch (e) {
        results.attempts.push({ selector, count: 0, success: false, error: e.message });
      }
    }

    return results;
  }
}

/**
 * Predefined selector strategies for common NiFi elements
 */
export const NIFI_SELECTORS = {
  PROCESSORS: new SelectorStrategy([
    'svg g.component',
    'svg g[class*="processor"]',
    'svg g[data-type*="processor"]',
    'svg .component',
    '.processors',
    'g.processor',
    '[data-testid="processor"]',
    '.nifi-processor'
  ], 'Processors'),

  CONTEXT_MENU: new SelectorStrategy([
    '.context-menu',
    '.dropdown-menu',
    '[role="menu"]',
    '.menu-items',
    'ul.context-menu'
  ], 'Context Menu'),

  DIALOGS: new SelectorStrategy([
    '.mat-dialog-container',
    '.modal-dialog',
    '.dialog',
    '[role="dialog"]',
    '.popup'
  ], 'Dialogs'),

  CANVAS: new SelectorStrategy([
    'mat-sidenav-content',
    '#canvas-container',
    '.mat-drawer-content',
    'body',
    'nifi'
  ], 'Canvas')
};

/**
 * Create a processor-specific selector strategy
 * @param {string} processorType - Type of processor to find
 * @returns {SelectorStrategy} Configured selector strategy
 */
export function createProcessorStrategy(processorType) {
  const baseSelectors = NIFI_SELECTORS.PROCESSORS.selectors;
  
  // Add processor-specific selectors
  const specificSelectors = [
    `[title*="${processorType}"]`,
    `[data-processor-type*="${processorType}"]`,
    `text="${processorType}"`,
    ...baseSelectors
  ];

  return new SelectorStrategy(specificSelectors, `${processorType} Processor`);
}

/**
 * Matcher function factory for processor identification
 * @param {string} processorType - Type of processor to match
 * @returns {Function} Matcher function
 */
export function createProcessorMatcher(processorType) {
  const type = processorType.toLowerCase();
  
  return (element, text, attributes) => {
    // Check various text and attribute sources
    const sources = [
      text?.toLowerCase(),
      attributes.id?.toLowerCase(),
      attributes.title?.toLowerCase(),
      attributes.class?.toLowerCase(),
      attributes['data-type']?.toLowerCase()
    ].filter(Boolean);

    return sources.some(source => source.includes(type));
  };
}