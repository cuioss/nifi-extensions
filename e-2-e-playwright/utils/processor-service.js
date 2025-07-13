/**
 * @fileoverview Unified Processor Service - Modern 2025 Patterns
 * Combines discovery and interaction with a clean API
 */

import { ProcessorDiscovery } from './processor-discovery.js';
import { ProcessorInteraction } from './processor-interaction.js';
import { processorLogger as logMessage } from './shared-logger.js';

/**
 * Unified processor service combining discovery and interaction
 */
export class ProcessorService {
  constructor(page) {
    this.page = page;
    this.discovery = new ProcessorDiscovery(page);
    this.interaction = new ProcessorInteraction(page);
  }

  /**
   * Find a processor (discovery)
   */
  async find(processorType, options = {}) {
    return this.discovery.findProcessor(processorType, options);
  }

  /**
   * Interact with a processor
   */
  async interact(processor, options = {}) {
    return this.interaction.interact(processor, options);
  }

  /**
   * Find and interact with a processor in one call
   */
  async findAndInteract(processorType, interactionOptions = {}, findOptions = {}) {
    const processor = await this.discovery.findProcessor(processorType, findOptions);
    if (!processor) {
      throw new Error(`Processor not found: ${processorType}`);
    }
    
    return this.interaction.interact(processor, interactionOptions);
  }

  /**
   * Open configuration for a processor type
   */
  async openConfiguration(processorType, options = {}) {
    const processor = await this.discovery.findProcessor(processorType, { failIfNotFound: true });
    return this.interaction.openConfigureDialog(processor, options);
  }

  /**
   * Open advanced configuration for a processor type
   */
  async openAdvancedConfiguration(processorType, options = {}) {
    const processor = await this.discovery.findProcessor(processorType, { failIfNotFound: true });
    return this.interaction.openAdvancedConfiguration(processor, options);
  }

  /**
   * Verify processor deployment and interact
   */
  async verifyAndInteract(processorType, interactionOptions = {}, verifyOptions = {}) {
    const processor = await this.discovery.verifyDeployment(processorType, verifyOptions);
    return this.interaction.interact(processor, interactionOptions);
  }

  /**
   * JWT Token Authenticator specific methods
   */
  async findJwtAuthenticator(options = {}) {
    return this.discovery.findJwtTokenAuthenticator(options);
  }

  async verifyJwtAuthenticator(options = {}) {
    return this.discovery.verifyDeployment('JWT Token Authenticator', options);
  }

  async configureJwtAuthenticator(options = {}) {
    const processor = await this.discovery.findJwtTokenAuthenticator({ failIfNotFound: true });
    return this.interaction.openAdvancedConfiguration(processor, options);
  }

  /**
   * Multi-Issuer JWT Authenticator specific methods
   */
  async findMultiIssuerJwtAuthenticator(options = {}) {
    return this.discovery.findMultiIssuerJwtAuthenticator(options);
  }

  async verifyMultiIssuerJwtAuthenticator(options = {}) {
    return this.discovery.verifyDeployment('Multi-Issuer JWT Token Authenticator', options);
  }

  async configureMultiIssuerJwtAuthenticator(options = {}) {
    const processor = await this.discovery.findMultiIssuerJwtAuthenticator({ failIfNotFound: true });
    return this.interaction.openAdvancedConfiguration(processor, options);
  }
}

/**
 * Convenience factory function
 */
export function createProcessorService(page) {
  return new ProcessorService(page);
}

// Re-export individual services for granular use
export { ProcessorDiscovery } from './processor-discovery.js';
export { ProcessorInteraction } from './processor-interaction.js';

// Backward compatibility - export original functions
export {
  findProcessor,
  findJwtTokenAuthenticator,
  findMultiIssuerJwtAuthenticator,
  verifyProcessorDeployment,
  verifyJwtTokenAuthenticatorDeployment,
  verifyMultiIssuerJwtAuthenticatorDeployment
} from './processor-discovery.js';

export {
  interactWithProcessor,
  openProcessorConfigureDialog,
  openProcessorAdvancedConfiguration
} from './processor-interaction.js';