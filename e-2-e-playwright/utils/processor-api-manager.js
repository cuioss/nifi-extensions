/**
 * @fileoverview API-based Processor Management for MultiIssuerJWTTokenAuthenticator
 * This utility uses the NiFi REST API to manage processors on the canvas programmatically
 * avoiding unreliable UI-based interactions.
 */

import { processorLogger } from './shared-logger.js';
import { CONSTANTS } from './constants.js';

/**
 * API-based Processor Manager for MultiIssuerJWTTokenAuthenticator
 * Uses NiFi REST API for reliable processor management
 */
export class ProcessorApiManager {
  constructor(page) {
    this.page = page;
    this.baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'https://localhost:9095/nifi';
    this.processorType = 'de.cuioss.nifi.processors.auth.MultiIssuerJWTTokenAuthenticator';
    this.processorName = 'MultiIssuerJWTTokenAuthenticator';
  }

  /**
   * Get authorization headers for API requests
   * Extracts the Bearer token from page headers if available
   */
  async getAuthHeaders() {
    // Get the current extra HTTP headers from the page
    // These are set by AuthService after successful login
    const currentHeaders = await this.page.evaluate(() => {
      // Check if there's an Authorization header stored in window
      return window.__authorizationHeader || null;
    }).catch(() => null);

    if (currentHeaders) {
      return { 'Authorization': currentHeaders };
    }

    // Try to get token from cookies for CSRF protection
    const cookies = await this.page.context().cookies();
    const requestTokenCookie = cookies.find(c => c.name === '__Secure-Request-Token');
    
    const headers = {};
    if (requestTokenCookie) {
      headers['Request-Token'] = requestTokenCookie.value;
    }

    // Add common headers
    headers['Accept'] = 'application/json';
    
    return headers;
  }

  /**
   * Get the root process group ID
   */
  async getRootProcessGroupId() {
    try {
      const response = await this.page.request.get(`${this.baseUrl}/nifi-api/flow/process-groups/root`, {
        headers: await this.getAuthHeaders(),
        failOnStatusCode: false
      });

      if (response.ok()) {
        const data = await response.json();
        return data.processGroupFlow?.id || data.id || 'root';
      }

      // Fallback to 'root' if API call fails
      processorLogger.warn('Could not get root process group ID, using "root"');
      return 'root';
    } catch (error) {
      processorLogger.error('Error getting root process group ID:', error.message);
      return 'root';
    }
  }

  /**
   * Verify if MultiIssuerJWTTokenAuthenticator is deployed (available in the system)
   * This checks if the processor type is available in NiFi
   */
  async verifyMultiIssuerJWTTokenAuthenticatorIsDeployed() {
    processorLogger.info('Verifying MultiIssuerJWTTokenAuthenticator deployment...');
    
    try {
      const response = await this.page.request.get(`${this.baseUrl}/nifi-api/flow/processor-types`, {
        headers: await this.getAuthHeaders(),
        failOnStatusCode: false
      });

      if (!response.ok()) {
        processorLogger.error(`Failed to get processor types: ${response.status()}`);
        return false;
      }

      const data = await response.json();
      const processorTypes = data.processorTypes || [];
      
      // Check if our processor type is available
      const isDeployed = processorTypes.some(type => 
        type.type === this.processorType ||
        type.type?.includes('MultiIssuerJWTTokenAuthenticator') ||
        type.bundle?.artifact?.includes('cuioss')
      );

      if (isDeployed) {
        processorLogger.success('MultiIssuerJWTTokenAuthenticator is deployed');
      } else {
        processorLogger.warn('MultiIssuerJWTTokenAuthenticator is NOT deployed');
        processorLogger.debug('Available processor types:', processorTypes.map(t => t.type).filter(t => t?.includes('JWT') || t?.includes('Auth')));
      }

      return isDeployed;
    } catch (error) {
      processorLogger.error('Error verifying processor deployment:', error.message);
      return false;
    }
  }

  /**
   * Get all processors on the canvas
   */
  async getProcessorsOnCanvas() {
    try {
      const rootGroupId = await this.getRootProcessGroupId();
      const response = await this.page.request.get(`${this.baseUrl}/nifi-api/process-groups/${rootGroupId}/processors`, {
        headers: await this.getAuthHeaders(),
        failOnStatusCode: false
      });

      if (!response.ok()) {
        processorLogger.error(`Failed to get processors: ${response.status()}`);
        return [];
      }

      const data = await response.json();
      return data.processors || [];
    } catch (error) {
      processorLogger.error('Error getting processors on canvas:', error.message);
      return [];
    }
  }

  /**
   * Verify if MultiIssuerJWTTokenAuthenticator is on the canvas
   */
  async verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas() {
    processorLogger.info('Verifying MultiIssuerJWTTokenAuthenticator is on canvas...');
    
    try {
      const processors = await this.getProcessorsOnCanvas();
      
      const found = processors.find(p => 
        p.component?.type === this.processorType ||
        p.component?.type?.includes('MultiIssuerJWTTokenAuthenticator') ||
        p.component?.name?.includes('MultiIssuerJWTTokenAuthenticator')
      );

      if (found) {
        processorLogger.success(`MultiIssuerJWTTokenAuthenticator found on canvas with ID: ${found.id}`);
        return { exists: true, processor: found };
      } else {
        processorLogger.warn('MultiIssuerJWTTokenAuthenticator NOT found on canvas');
        processorLogger.debug('Processors on canvas:', processors.map(p => ({
          id: p.id,
          name: p.component?.name,
          type: p.component?.type
        })));
        return { exists: false, processor: null };
      }
    } catch (error) {
      processorLogger.error('Error verifying processor on canvas:', error.message);
      return { exists: false, processor: null };
    }
  }

  /**
   * Remove MultiIssuerJWTTokenAuthenticator from canvas
   */
  async removeMultiIssuerJWTTokenAuthenticatorFromCanvas() {
    processorLogger.info('Removing MultiIssuerJWTTokenAuthenticator from canvas...');
    
    try {
      const { exists, processor } = await this.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
      
      if (!exists) {
        processorLogger.info('MultiIssuerJWTTokenAuthenticator not on canvas, nothing to remove');
        return true;
      }

      // Stop the processor first if it's running
      if (processor.status?.runStatus === 'Running') {
        processorLogger.debug('Stopping processor before deletion...');
        
        const stopResponse = await this.page.request.put(`${this.baseUrl}/nifi-api/processors/${processor.id}/run-status`, {
          headers: {
            ...await this.getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          data: {
            revision: {
              version: processor.revision?.version || 0
            },
            state: 'STOPPED'
          },
          failOnStatusCode: false
        });

        if (!stopResponse.ok()) {
          processorLogger.warn(`Could not stop processor: ${stopResponse.status()}`);
        }
      }

      // Delete the processor
      const deleteUrl = `${this.baseUrl}/nifi-api/processors/${processor.id}?version=${processor.revision?.version || 0}`;
      const deleteResponse = await this.page.request.delete(deleteUrl, {
        headers: await this.getAuthHeaders(),
        failOnStatusCode: false
      });

      if (deleteResponse.ok()) {
        processorLogger.success('MultiIssuerJWTTokenAuthenticator removed from canvas');
        return true;
      } else {
        processorLogger.error(`Failed to delete processor: ${deleteResponse.status()}`);
        const errorText = await deleteResponse.text().catch(() => '');
        processorLogger.debug('Delete error:', errorText);
        return false;
      }
    } catch (error) {
      processorLogger.error('Error removing processor from canvas:', error.message);
      return false;
    }
  }

  /**
   * Add MultiIssuerJWTTokenAuthenticator to canvas
   */
  async addMultiIssuerJWTTokenAuthenticatorOnCanvas(position = { x: 400, y: 200 }) {
    processorLogger.info('Adding MultiIssuerJWTTokenAuthenticator to canvas...');
    
    try {
      // First check if it's already on canvas
      const { exists } = await this.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
      if (exists) {
        processorLogger.info('MultiIssuerJWTTokenAuthenticator already on canvas');
        return true;
      }

      // Check if the processor type is deployed
      const isDeployed = await this.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();
      if (!isDeployed) {
        processorLogger.error('MultiIssuerJWTTokenAuthenticator is not deployed in the system');
        return false;
      }

      const rootGroupId = await this.getRootProcessGroupId();
      
      // Get available processor types to find the exact type and bundle info
      const typesResponse = await this.page.request.get(`${this.baseUrl}/nifi-api/flow/processor-types`, {
        headers: await this.getAuthHeaders(),
        failOnStatusCode: false
      });

      let processorTypeInfo = null;
      if (typesResponse.ok()) {
        const typesData = await typesResponse.json();
        processorTypeInfo = typesData.processorTypes?.find(type => 
          type.type === this.processorType ||
          type.type?.includes('MultiIssuerJWTTokenAuthenticator')
        );
      }

      if (!processorTypeInfo) {
        processorLogger.error('Could not find processor type info');
        return false;
      }

      // Create the processor
      const createResponse = await this.page.request.post(`${this.baseUrl}/nifi-api/process-groups/${rootGroupId}/processors`, {
        headers: {
          ...await this.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        data: {
          revision: {
            version: 0
          },
          component: {
            type: processorTypeInfo.type,
            bundle: processorTypeInfo.bundle,
            name: this.processorName,
            position: position,
            config: {
              properties: {},
              autoTerminatedRelationships: []
            }
          }
        },
        failOnStatusCode: false
      });

      if (createResponse.ok()) {
        const createdProcessor = await createResponse.json();
        processorLogger.success(`MultiIssuerJWTTokenAuthenticator added to canvas with ID: ${createdProcessor.id}`);
        return true;
      } else {
        processorLogger.error(`Failed to create processor: ${createResponse.status()}`);
        const errorText = await createResponse.text().catch(() => '');
        processorLogger.debug('Create error:', errorText);
        return false;
      }
    } catch (error) {
      processorLogger.error('Error adding processor to canvas:', error.message);
      return false;
    }
  }

  /**
   * Ensure MultiIssuerJWTTokenAuthenticator is on canvas
   * This is a convenience method that adds the processor if it's not already there
   */
  async ensureProcessorOnCanvas() {
    const { exists } = await this.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
    
    if (!exists) {
      processorLogger.info('Processor not on canvas, adding it...');
      return await this.addMultiIssuerJWTTokenAuthenticatorOnCanvas();
    }
    
    processorLogger.info('Processor already on canvas');
    return true;
  }

  /**
   * Get processor details by ID
   */
  async getProcessorDetails(processorId) {
    try {
      const response = await this.page.request.get(`${this.baseUrl}/nifi-api/processors/${processorId}`, {
        headers: await this.getAuthHeaders(),
        failOnStatusCode: false
      });

      if (response.ok()) {
        return await response.json();
      }
      
      return null;
    } catch (error) {
      processorLogger.error('Error getting processor details:', error.message);
      return null;
    }
  }

  /**
   * Start the MultiIssuerJWTTokenAuthenticator processor
   */
  async startProcessor() {
    processorLogger.info('Starting MultiIssuerJWTTokenAuthenticator processor...');
    
    try {
      const { exists, processor } = await this.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
      
      if (!exists) {
        processorLogger.error('Cannot start processor - not on canvas');
        return false;
      }

      const response = await this.page.request.put(`${this.baseUrl}/nifi-api/processors/${processor.id}/run-status`, {
        headers: {
          ...await this.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        data: {
          revision: {
            version: processor.revision?.version || 0
          },
          state: 'RUNNING'
        },
        failOnStatusCode: false
      });

      if (response.ok()) {
        processorLogger.success('Processor started successfully');
        return true;
      } else {
        processorLogger.error(`Failed to start processor: ${response.status()}`);
        return false;
      }
    } catch (error) {
      processorLogger.error('Error starting processor:', error.message);
      return false;
    }
  }

  /**
   * Stop the MultiIssuerJWTTokenAuthenticator processor
   */
  async stopProcessor() {
    processorLogger.info('Stopping MultiIssuerJWTTokenAuthenticator processor...');
    
    try {
      const { exists, processor } = await this.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
      
      if (!exists) {
        processorLogger.error('Cannot stop processor - not on canvas');
        return false;
      }

      const response = await this.page.request.put(`${this.baseUrl}/nifi-api/processors/${processor.id}/run-status`, {
        headers: {
          ...await this.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        data: {
          revision: {
            version: processor.revision?.version || 0
          },
          state: 'STOPPED'
        },
        failOnStatusCode: false
      });

      if (response.ok()) {
        processorLogger.success('Processor stopped successfully');
        return true;
      } else {
        processorLogger.error(`Failed to stop processor: ${response.status()}`);
        return false;
      }
    } catch (error) {
      processorLogger.error('Error stopping processor:', error.message);
      return false;
    }
  }
}

// Export convenience functions for backward compatibility
export async function verifyMultiIssuerJWTTokenAuthenticatorIsDeployed(page) {
  const manager = new ProcessorApiManager(page);
  return manager.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();
}

export async function verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas(page) {
  const manager = new ProcessorApiManager(page);
  return manager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
}

export async function removeMultiIssuerJWTTokenAuthenticatorFromCanvas(page) {
  const manager = new ProcessorApiManager(page);
  return manager.removeMultiIssuerJWTTokenAuthenticatorFromCanvas();
}

export async function addMultiIssuerJWTTokenAuthenticatorOnCanvas(page, position) {
  const manager = new ProcessorApiManager(page);
  return manager.addMultiIssuerJWTTokenAuthenticatorOnCanvas(position);
}

export async function ensureProcessorOnCanvas(page) {
  const manager = new ProcessorApiManager(page);
  return manager.ensureProcessorOnCanvas();
}