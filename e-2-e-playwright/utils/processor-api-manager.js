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
   * Get authentication headers from the page context
   * This is kept for backward compatibility
   */
  async getAuthHeaders() {
    // Get headers that were set with setExtraHTTPHeaders during login
    // The AuthService sets these headers after successful authentication
    
    // Try to get JWT token from window object (set during login)
    const token = await this.page.evaluate(() => window.__jwtToken).catch(() => null);
    
    if (token) {
      processorLogger.debug('Using JWT token for authentication');
      return {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
    }
    
    processorLogger.debug('No JWT token found, relying on session cookies');
    // Fallback to empty headers (will rely on cookies)
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
  }

  /**
   * Make an authenticated API call using the page's browser context
   * This ensures cookies and session are properly used
   * IMPORTANT: Uses page.evaluate with fetch because page.request doesn't share cookie context
   */
  async makeApiCall(path, options = {}) {
    const { method = 'GET', body = null } = options;
    
    // Get CSRF token for POST/PUT/DELETE operations
    // NiFi requires Request-Token header for state-changing operations
    let requestToken = null;
    if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
      const cookies = await this.page.context().cookies();
      const requestTokenCookie = cookies.find(c => c.name === '__Secure-Request-Token');
      requestToken = requestTokenCookie?.value;
      
      if (!requestToken) {
        processorLogger.warn('No CSRF token found for write operation - request may fail');
      }
    }
    
    // Convert path to relative URL if it's absolute
    const relativePath = path.replace(/^https?:\/\/[^\/]+/, '').replace('/nifi/nifi-api', '/nifi-api');
    
    return await this.page.evaluate(async ({relativePath, method, body, requestToken}) => {
      try {
        const fetchOptions = {
          method: method,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          credentials: 'include' // This ensures cookies are sent
        };
        
        // Add CSRF token for write operations
        if (requestToken && ['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
          fetchOptions.headers['Request-Token'] = requestToken;
        }
        
        if (body) {
          fetchOptions.body = JSON.stringify(body);
        }
        
        const response = await fetch(relativePath, fetchOptions);
        
        const contentType = response.headers.get('content-type');
        let data = null;
        
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }
        
        return {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          data: data
        };
      } catch (error) {
        return {
          ok: false,
          error: error.message,
          data: null
        };
      }
    }, {relativePath, method, body, requestToken});
  }

  /**
   * Get the root process group ID
   */
  async getRootProcessGroupId() {
    try {
      const result = await this.makeApiCall('/nifi-api/flow/process-groups/root');
      
      if (result.ok && result.data) {
        return result.data.processGroupFlow?.id || result.data.id || 'root';
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
      // Use makeApiCall which uses page.evaluate with fetch (works with cookies)
      const result = await this.makeApiCall('/nifi-api/flow/processor-types');
      
      if (!result.ok) {
        processorLogger.error(`Failed to get processor types: ${result.status || result.error}`);
        if (result.status === 401) {
          processorLogger.error('Authentication failed - ensure login was successful');
        }
        return false;
      }
      
      // Check if we got JSON data
      if (typeof result.data === 'string') {
        processorLogger.error('Received text instead of JSON object');
        if (result.data.startsWith('<!') || result.data.includes('<html')) {
          processorLogger.error('Received HTML instead of JSON - authentication may have failed');
        }
        return false;
      }
      
      const processorTypes = result.data?.processorTypes || [];
      
      // Log total number of processor types found
      processorLogger.debug(`Found ${processorTypes.length} total processor types`);
      
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
        
        // Log all JWT/Auth related processors for debugging
        const relevantTypes = processorTypes.filter(t => 
          t.type?.includes('JWT') || 
          t.type?.includes('Auth') || 
          t.type?.includes('Token') ||
          t.bundle?.artifact?.includes('cuioss') ||
          t.bundle?.artifact?.includes('auth')
        );
        
        if (relevantTypes.length > 0) {
          processorLogger.debug('Found potentially related processor types:');
          relevantTypes.forEach(t => {
            processorLogger.debug(`  - ${t.type} (artifact: ${t.bundle?.artifact})`);
          });
        } else {
          processorLogger.debug('No JWT/Auth/Token related processors found');
          // Log first few processor types as sample
          processorLogger.debug('Sample of available processor types:');
          processorTypes.slice(0, 5).forEach(t => {
            processorLogger.debug(`  - ${t.type} (artifact: ${t.bundle?.artifact})`);
          });
        }
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
      const result = await this.makeApiCall(`/nifi-api/process-groups/${rootGroupId}/processors`);
      
      if (!result.ok) {
        processorLogger.error(`Failed to get processors: ${result.status || result.error}`);
        return [];
      }

      return result.data?.processors || [];
    } catch (error) {
      processorLogger.error('Error getting processors on canvas:', error.message);
      return [];
    }
  }

  /**
   * Verify if MultiIssuerJWTTokenAuthenticator is on the canvas
   */
  async verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas() {
    processorLogger.debug('Verifying MultiIssuerJWTTokenAuthenticator is on canvas...');
    
    try {
      const processors = await this.getProcessorsOnCanvas();
      
      const found = processors.find(p => 
        p.component?.type === this.processorType ||
        p.component?.type?.includes('MultiIssuerJWTTokenAuthenticator') ||
        p.component?.name?.includes('MultiIssuerJWTTokenAuthenticator')
      );

      if (found) {
        processorLogger.debug(`MultiIssuerJWTTokenAuthenticator found on canvas with ID: ${found.id}`);
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
        
        const stopResult = await this.makeApiCall(
          `/nifi-api/processors/${processor.id}/run-status`,
          {
            method: 'PUT',
            body: {
              revision: {
                version: processor.revision?.version || 0
              },
              state: 'STOPPED'
            }
          }
        );

        if (!stopResult.ok) {
          processorLogger.warn(`Could not stop processor: ${stopResult.status || stopResult.error}`);
        }
      }

      // Delete the processor
      const deleteUrl = `/nifi-api/processors/${processor.id}?version=${processor.revision?.version || 0}`;
      const deleteResult = await this.makeApiCall(deleteUrl, { method: 'DELETE' });

      if (deleteResult.ok) {
        processorLogger.success('MultiIssuerJWTTokenAuthenticator removed from canvas');
        return true;
      } else {
        processorLogger.error(`Failed to delete processor: ${deleteResult.status || deleteResult.error}`);
        processorLogger.debug('Delete error:', deleteResult.data);
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
      const typesResult = await this.makeApiCall('/nifi-api/flow/processor-types');

      let processorTypeInfo = null;
      if (typesResult.ok && typesResult.data) {
        processorTypeInfo = typesResult.data.processorTypes?.find(type => 
          type.type === this.processorType ||
          type.type?.includes('MultiIssuerJWTTokenAuthenticator')
        );
      }

      if (!processorTypeInfo) {
        processorLogger.error('Could not find processor type info');
        return false;
      }

      // Create the processor
      const createResult = await this.makeApiCall(
        `/nifi-api/process-groups/${rootGroupId}/processors`,
        {
          method: 'POST',
          body: {
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
          }
        }
      );

      if (createResult.ok) {
        processorLogger.success(`MultiIssuerJWTTokenAuthenticator added to canvas with ID: ${createResult.data?.id}`);
        return true;
      } else {
        processorLogger.error(`Failed to create processor: ${createResult.status || createResult.error}`);
        if (createResult.status === 403) {
          processorLogger.error('Permission denied - user may not have rights to add processors');
        }
        processorLogger.debug('Create error response:', JSON.stringify(createResult.data, null, 2));
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
    
    processorLogger.debug('Processor already on canvas');
    return true;
  }

  /**
   * Get processor details by ID
   */
  async getProcessorDetails(processorId) {
    try {
      const result = await this.makeApiCall(`/nifi-api/processors/${processorId}`);
      
      if (result.ok && result.data) {
        return result.data;
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

      const result = await this.makeApiCall(
        `/nifi-api/processors/${processor.id}/run-status`,
        {
          method: 'PUT',
          body: {
            revision: {
              version: processor.revision?.version || 0
            },
            state: 'RUNNING'
          }
        }
      );

      if (result.ok) {
        processorLogger.success('Processor started successfully');
        return true;
      } else {
        processorLogger.error(`Failed to start processor: ${result.status || result.error}`);
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

      const result = await this.makeApiCall(
        `/nifi-api/processors/${processor.id}/run-status`,
        {
          method: 'PUT',
          body: {
            revision: {
              version: processor.revision?.version || 0
            },
            state: 'STOPPED'
          }
        }
      );

      if (result.ok) {
        processorLogger.success('Processor stopped successfully');
        return true;
      } else {
        processorLogger.error(`Failed to stop processor: ${result.status || result.error}`);
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