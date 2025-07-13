/**
 * @fileoverview Processor Discovery Service - Modern 2025 Patterns
 * Focused module for finding and identifying processors on NiFi canvas
 */

import { expect } from '@playwright/test';
import { CONSTANTS } from './constants.js';
import { processorLogger as logMessage, logTimed } from './shared-logger.js';

/**
 * Modern processor discovery service
 */
export class ProcessorDiscovery {
  constructor(page) {
    this.page = page;
  }

  /**
   * Extract processor attributes using modern locator patterns
   */
  async extractAttributes(element) {
    const locator = this.page.locator(element);
    
    return {
      text: await locator.textContent().catch(() => ''),
      id: await locator.getAttribute('id').catch(() => ''),
      className: await locator.getAttribute('class').catch(() => ''),
      title: await locator.getAttribute('title').catch(() => ''),
      dataType: await locator.getAttribute('data-type').catch(() => '')
    };
  }

  /**
   * Create processor object with modern patterns
   */
  async createProcessorObject(element, processorType, attributes) {
    const locator = this.page.locator(element);
    const boundingBox = await locator.boundingBox().catch(() => null);
    
    return {
      element,
      locator,
      type: processorType,
      name: attributes.text,
      id: attributes.id,
      position: {
        x: boundingBox ? boundingBox.x + boundingBox.width / 2 : 0,
        y: boundingBox ? boundingBox.y + boundingBox.height / 2 : 0
      },
      isVisible: !!boundingBox,
      className: attributes.className,
      title: attributes.title,
      dataType: attributes.dataType
    };
  }

  /**
   * Find processor using modern semantic locators
   */
  async findProcessor(processorType, options = {}) {
    const { failIfNotFound = false, timeout = 10000 } = options;

    return await logTimed(`Searching for processor: ${processorType}`, async () => {
      // Ensure we're on the main canvas
      await expect(this.page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS))
        .toBeVisible({ timeout });

      // Use modern locator strategies
      const processorLocators = [
        // By processor type
        this.page.locator(`[data-type*="${processorType}"]`),
        // By text content
        this.page.locator('text=' + processorType),
        // By title attribute
        this.page.locator(`[title*="${processorType}"]`),
        // By class name patterns
        this.page.locator(`.processor:has-text("${processorType}")`)
      ];

      for (const locator of processorLocators) {
        try {
          await locator.first().waitFor({ timeout: 2000 });
          const element = await locator.first().elementHandle();
          
          if (element) {
            const attributes = await this.extractAttributes(element);
            const processor = await this.createProcessorObject(element, processorType, attributes);
            
            logMessage('success', `Found processor: ${processorType}`);
            return processor;
          }
        } catch (error) {
          // Continue to next locator strategy
        }
      }

      if (failIfNotFound) {
        throw new Error(`Processor not found: ${processorType}`);
      }
      
      logMessage('warn', `Processor not found: ${processorType}`);
      return null;
    });
  }

  /**
   * Find JWT Token Authenticator using modern patterns
   */
  async findJwtTokenAuthenticator(options = {}) {
    const processorTypes = [
      'JWT Token Authenticator',
      'JwtTokenAuthenticator',
      'jwt-token-authenticator'
    ];

    for (const type of processorTypes) {
      const processor = await this.findProcessor(type, { ...options, failIfNotFound: false });
      if (processor) {
        return processor;
      }
    }

    if (options.failIfNotFound) {
      throw new Error('JWT Token Authenticator not found');
    }
    return null;
  }

  /**
   * Find Multi-Issuer JWT Authenticator using modern patterns
   */
  async findMultiIssuerJwtAuthenticator(options = {}) {
    const processorTypes = [
      'Multi-Issuer JWT Token Authenticator',
      'MultiIssuerJwtTokenAuthenticator',
      'multi-issuer-jwt-token-authenticator'
    ];

    for (const type of processorTypes) {
      const processor = await this.findProcessor(type, { ...options, failIfNotFound: false });
      if (processor) {
        return processor;
      }
    }

    if (options.failIfNotFound) {
      throw new Error('Multi-Issuer JWT Token Authenticator not found');
    }
    return null;
  }

  /**
   * Verify processor deployment with modern assertions
   */
  async verifyDeployment(processorType, options = {}) {
    const { timeout = 30000 } = options;
    
    return await logTimed(`Verifying deployment: ${processorType}`, async () => {
      const processor = await this.findProcessor(processorType, { 
        failIfNotFound: true, 
        timeout 
      });

      // Modern assertions
      expect(processor, `Processor ${processorType} should be found`).toBeTruthy();
      expect(processor.isVisible, `Processor ${processorType} should be visible`).toBeTruthy();
      
      // Verify processor is on canvas
      await expect(this.page.locator(processor.element))
        .toBeVisible({ timeout: 5000 });

      logMessage('success', `Verified deployment: ${processorType}`);
      return processor;
    });
  }
}

/**
 * Convenience functions for backward compatibility
 */
export async function findProcessor(page, processorType, options = {}) {
  const discovery = new ProcessorDiscovery(page);
  return discovery.findProcessor(processorType, options);
}

export async function findJwtTokenAuthenticator(page, options = {}) {
  const discovery = new ProcessorDiscovery(page);
  return discovery.findJwtTokenAuthenticator(options);
}

export async function findMultiIssuerJwtAuthenticator(page, options = {}) {
  const discovery = new ProcessorDiscovery(page);
  return discovery.findMultiIssuerJwtAuthenticator(options);
}

export async function verifyProcessorDeployment(page, processorType, options = {}) {
  const discovery = new ProcessorDiscovery(page);
  return discovery.verifyDeployment(processorType, options);
}

export async function verifyJwtTokenAuthenticatorDeployment(page, options = {}) {
  const discovery = new ProcessorDiscovery(page);
  return discovery.verifyDeployment('JWT Token Authenticator', options);
}

export async function verifyMultiIssuerJwtAuthenticatorDeployment(page, options = {}) {
  const discovery = new ProcessorDiscovery(page);
  return discovery.verifyDeployment('Multi-Issuer JWT Token Authenticator', options);
}