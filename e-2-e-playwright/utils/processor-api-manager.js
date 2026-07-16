/**
 * @fileoverview API-based Processor Management for MultiIssuerJWTTokenAuthenticator
 * This utility uses the NiFi REST API to manage processors on the canvas programmatically
 * avoiding unreliable UI-based interactions.
 */

import { testLogger } from './test-logger.js';
import { PROCESS_GROUPS, TIMEOUTS } from './constants.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';


/**
 * API-based Processor Manager for MultiIssuerJWTTokenAuthenticator
 * Uses NiFi REST API for reliable processor management
 */
export class ProcessorApiManager {
  /** Module-level cache for invariant API responses (shared across instances) */
  static _cache = {};

  constructor(page) {
    this.page = page;
    this.baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'https://localhost:9095/nifi';
    this.processorType = 'de.cuioss.nifi.processors.auth.MultiIssuerJWTTokenAuthenticator';
    this.processorName = 'MultiIssuerJWTTokenAuthenticator';
    ProcessorApiManager._seedFromContext();
  }

  /** Clear the module-level cache (e.g. for test cleanup) */
  static clearCache() {
    ProcessorApiManager._cache = {};
  }

  /**
   * Pre-seed the cache from the global-setup test-context.json file.
   * Called automatically on first construction if the file exists.
   */
  static _seedFromContext() {
    if (ProcessorApiManager._contextSeeded) return;
    ProcessorApiManager._contextSeeded = true;
    try {
      const thisDir = dirname(fileURLToPath(import.meta.url));
      const contextPath = join(thisDir, '..', '.auth', 'test-context.json');
      const ctx = JSON.parse(readFileSync(contextPath, 'utf-8'));
      if (ctx.rootGroupId) ProcessorApiManager._cache.rootGroupId = ctx.rootGroupId;
      if (ctx.jwtPipelineGroupId !== undefined) ProcessorApiManager._cache.jwtPipelineGroupId = ctx.jwtPipelineGroupId;
      if (ctx.gatewayGroupId !== undefined) ProcessorApiManager._cache.gatewayGroupId = ctx.gatewayGroupId;
      testLogger.info('Processor', 'Cache pre-seeded from test-context.json');
    } catch {
      // File doesn't exist yet (first run or running outside project system) — that's OK
    }
  }

  static _contextSeeded = false;

  /**
   * Get base request headers. Authentication itself rides on the session cookie
   * (sent via credentials:'include' in makeApiCall) plus the Authorization header
   * installed by AuthService.login()/global-setup via setExtraHTTPHeaders — those
   * survive in-page navigation, whereas a window token would be wiped by the
   * post-login page.goto('/nifi'), so no window token is consulted here (N69).
   */
  async getAuthHeaders() {
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
        testLogger.warn('Processor','No CSRF token found for write operation - request may fail');
      }
    }
    
    // Convert path to relative URL if it's absolute
    const relativePath = path.replace(/^https?:\/\/[^/]+/, '').replace('/nifi/nifi-api', '/nifi-api');
    
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
   * Get the root process group ID (cached after first successful call)
   */
  async getRootProcessGroupId() {
    if (ProcessorApiManager._cache.rootGroupId) {
      return ProcessorApiManager._cache.rootGroupId;
    }
    try {
      const result = await this.makeApiCall('/nifi-api/flow/process-groups/root');

      if (result.ok && result.data) {
        const id = result.data.processGroupFlow?.id || result.data.id || 'root';
        ProcessorApiManager._cache.rootGroupId = id;
        return id;
      }

      // Fallback to 'root' if API call fails
      testLogger.warn('Processor','Could not get root process group ID, using "root"');
      return 'root';
    } catch (error) {
      testLogger.error('Processor', `Error getting root process group ID: ${error.message}`);
      return 'root';
    }
  }

  /**
   * Get child process groups of the root process group (cached after first successful call)
   */
  async getProcessGroups() {
    if (ProcessorApiManager._cache.processGroups) {
      return ProcessorApiManager._cache.processGroups;
    }
    try {
      const rootGroupId = await this.getRootProcessGroupId();
      const result = await this.makeApiCall(`/nifi-api/process-groups/${rootGroupId}/process-groups`);

      if (!result.ok) {
        testLogger.error('Processor', `Failed to get process groups: ${result.status || result.error}`);
        return [];
      }

      const groups = result.data?.processGroups || [];
      ProcessorApiManager._cache.processGroups = groups;
      return groups;
    } catch (error) {
      testLogger.error('Processor', `Error getting process groups: ${error.message}`);
      return [];
    }
  }

  /**
   * Find the JWT Auth Pipeline process group and return its id (cached)
   */
  async getJwtPipelineProcessGroupId() {
    if (ProcessorApiManager._cache.jwtPipelineGroupId !== undefined) {
      return ProcessorApiManager._cache.jwtPipelineGroupId;
    }
    const groups = await this.getProcessGroups();
    const jwtGroup = groups.find(g =>
      g.component?.name === PROCESS_GROUPS.JWT_AUTH_PIPELINE
    );

    if (jwtGroup) {
      testLogger.info('Processor', `Found JWT Auth Pipeline group: ${jwtGroup.id}`);
      ProcessorApiManager._cache.jwtPipelineGroupId = jwtGroup.id;
      return jwtGroup.id;
    }

    testLogger.warn('Processor', 'JWT Auth Pipeline process group not found');
    ProcessorApiManager._cache.jwtPipelineGroupId = null;
    return null;
  }

  /**
   * Find the REST API Gateway process group and return its id (cached)
   */
  async getGatewayProcessGroupId() {
    if (ProcessorApiManager._cache.gatewayGroupId !== undefined) {
      return ProcessorApiManager._cache.gatewayGroupId;
    }
    const groups = await this.getProcessGroups();
    const gatewayGroup = groups.find(g =>
      g.component?.name === PROCESS_GROUPS.REST_API_GATEWAY
    );

    if (gatewayGroup) {
      testLogger.info('Processor', `Found REST API Gateway group: ${gatewayGroup.id}`);
      ProcessorApiManager._cache.gatewayGroupId = gatewayGroup.id;
      return gatewayGroup.id;
    }

    testLogger.warn('Processor', 'REST API Gateway process group not found');
    ProcessorApiManager._cache.gatewayGroupId = null;
    return null;
  }

  /**
   * Find the RestApiGatewayProcessor on the canvas and return its ID.
   * Searches the REST API Gateway process group first, then falls back to root.
   */
  async getGatewayProcessorId() {
    const gatewayGroupId = await this.getGatewayProcessGroupId();
    const processors = gatewayGroupId
      ? await this.getProcessorsOnCanvas(gatewayGroupId)
      : await this.getProcessorsOnCanvas();

    const found = processors.find(p =>
      p.component?.type?.includes('RestApiGateway') ||
      p.component?.name?.includes('RestApiGateway')
    );

    if (found) {
      testLogger.info('Processor', `RestApiGatewayProcessor found with ID: ${found.id}`);
      return found.id;
    }

    testLogger.warn('Processor', 'RestApiGatewayProcessor NOT found on canvas');
    return null;
  }

  /**
   * Ensure the REST API Gateway processor is on canvas and navigate
   * into its process group. Returns true on success.
   */
  async ensureGatewayProcessorOnCanvas() {
    try {
      const gatewayGroupId = await this.getGatewayProcessGroupId();
      if (!gatewayGroupId) {
        throw new Error('PRECONDITION FAILED: REST API Gateway process group not found');
      }

      const processorId = await this.getGatewayProcessorId();
      if (!processorId) {
        throw new Error('PRECONDITION FAILED: RestApiGatewayProcessor not found on canvas');
      }

      await this.navigateToProcessGroup(gatewayGroupId);
      testLogger.info('Processor', 'Gateway preconditions met');
      return true;
    } catch (error) {
      if (error.message.includes('PRECONDITION FAILED')) throw error;
      throw new Error(
        'PRECONDITION FAILED: Cannot ensure RestApiGatewayProcessor is on canvas. ' +
        `Details: ${error.message}`,
        { cause: error }
      );
    }
  }

  /**
   * Navigate the browser to a specific process group on the NiFi canvas
   */
  async navigateToProcessGroup(groupId) {
    const url = `${this.baseUrl}#/process-groups/${groupId}`;
    testLogger.info('Processor', `Navigating to process group: ${url}`);
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    // Wait for canvas to render
    await this.page.waitForSelector('#canvas-container', { timeout: TIMEOUTS.NAVIGATION });
  }

  /**
   * Verify if MultiIssuerJWTTokenAuthenticator is deployed (available in the system)
   * This checks if the processor type is available in NiFi
   */
  async verifyMultiIssuerJWTTokenAuthenticatorIsDeployed() {
    testLogger.info('Processor','Verifying MultiIssuerJWTTokenAuthenticator deployment...');
    
    try {
      // Use makeApiCall which uses page.evaluate with fetch (works with cookies)
      const result = await this.makeApiCall('/nifi-api/flow/processor-types');
      
      if (!result.ok) {
        testLogger.error('Processor',`Failed to get processor types: ${result.status || result.error}`);
        if (result.status === 401) {
          testLogger.error('Processor','Authentication failed - ensure login was successful');
        }
        return false;
      }
      
      // Check if we got JSON data
      if (typeof result.data === 'string') {
        testLogger.error('Processor','Received text instead of JSON object');
        if (result.data.startsWith('<!') || result.data.includes('<html')) {
          testLogger.error('Processor','Received HTML instead of JSON - authentication may have failed');
        }
        return false;
      }
      
      const processorTypes = result.data?.processorTypes || [];
      
      // Log total number of processor types found
      testLogger.info('Processor',`Found ${processorTypes.length} total processor types`);
      
      // Check if our processor type is available
      const isDeployed = processorTypes.some(type => 
        type.type === this.processorType ||
        type.type?.includes('MultiIssuerJWTTokenAuthenticator') ||
        type.bundle?.artifact?.includes('cuioss')
      );

      if (isDeployed) {
        testLogger.info('Processor','MultiIssuerJWTTokenAuthenticator is deployed');
      } else {
        testLogger.warn('Processor','MultiIssuerJWTTokenAuthenticator is NOT deployed');
        
        // Log all JWT/Auth related processors for debugging
        const relevantTypes = processorTypes.filter(t => 
          t.type?.includes('JWT') || 
          t.type?.includes('Auth') || 
          t.type?.includes('Token') ||
          t.bundle?.artifact?.includes('cuioss') ||
          t.bundle?.artifact?.includes('auth')
        );
        
        if (relevantTypes.length > 0) {
          testLogger.info('Processor','Found potentially related processor types:');
          relevantTypes.forEach(t => {
            testLogger.info('Processor',`  - ${t.type} (artifact: ${t.bundle?.artifact})`);
          });
        } else {
          testLogger.info('Processor','No JWT/Auth/Token related processors found');
          // Log first few processor types as sample
          testLogger.info('Processor','Sample of available processor types:');
          processorTypes.slice(0, 5).forEach(t => {
            testLogger.info('Processor',`  - ${t.type} (artifact: ${t.bundle?.artifact})`);
          });
        }
      }

      return isDeployed;
    } catch (error) {
      testLogger.error('Processor', `Error verifying processor deployment: ${error.message}`);
      return false;
    }
  }

  /**
   * Get all processors on the canvas.
   * @param {string} [groupId] - optional process group id; defaults to root
   */
  async getProcessorsOnCanvas(groupId) {
    try {
      const targetGroupId = groupId || await this.getRootProcessGroupId();
      const result = await this.makeApiCall(`/nifi-api/process-groups/${targetGroupId}/processors`);
      
      if (!result.ok) {
        testLogger.error('Processor',`Failed to get processors: ${result.status || result.error}`);
        return [];
      }

      return result.data?.processors || [];
    } catch (error) {
      testLogger.error('Processor', `Error getting processors on canvas: ${error.message}`);
      return [];
    }
  }

  /**
   * Verify if MultiIssuerJWTTokenAuthenticator is on the canvas.
   * Searches the JWT Auth Pipeline process group first, then falls back to root.
   */
  async verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas() {
    testLogger.info('Processor','Verifying MultiIssuerJWTTokenAuthenticator is on canvas...');

    try {
      // Search in the JWT Pipeline group first
      const jwtGroupId = await this.getJwtPipelineProcessGroupId();
      const processors = jwtGroupId
        ? await this.getProcessorsOnCanvas(jwtGroupId)
        : await this.getProcessorsOnCanvas();
      
      const found = processors.find(p => 
        p.component?.type === this.processorType ||
        p.component?.type?.includes('MultiIssuerJWTTokenAuthenticator') ||
        p.component?.name?.includes('MultiIssuerJWTTokenAuthenticator')
      );

      if (found) {
        testLogger.info('Processor',`MultiIssuerJWTTokenAuthenticator found on canvas with ID: ${found.id}`);
        return { exists: true, processor: found };
      } else {
        testLogger.warn('Processor','MultiIssuerJWTTokenAuthenticator NOT found on canvas');
        testLogger.info('Processor', `Processors on canvas: ${JSON.stringify(processors.map(p => ({
          id: p.id,
          name: p.component?.name,
          type: p.component?.type
        })))}`);
        return { exists: false, processor: null };
      }
    } catch (error) {
      testLogger.error('Processor', `Error verifying processor on canvas: ${error.message}`);
      return { exists: false, processor: null };
    }
  }

  /**
   * Stop all processors in the JWT Pipeline process group (or root as fallback).
   * Required before removing connections between processors.
   */
  async stopAllProcessors() {
    const jwtGroupId = await this.getJwtPipelineProcessGroupId();
    const groupId = jwtGroupId || await this.getRootProcessGroupId();
    const result = await this.makeApiCall(
      `/nifi-api/flow/process-groups/${groupId}`,
      {
        method: 'PUT',
        body: { id: groupId, state: 'STOPPED' }
      }
    );

    if (!result.ok) {
      testLogger.warn('Processor', `Could not stop all processors: ${result.status || result.error}`);
    }

    // Poll until no processor in the group reports a RUNNING run-status instead
    // of sleeping a fixed 2s and hoping NiFi caught up (N64).
    await this._waitForProcessorsStopped(groupId);
    return result.ok;
  }

  /**
   * Poll the group's processors until none reports a RUNNING run-status.
   * @param {string} groupId - process group id
   * @param {number} [timeoutMs] - overall wait budget in milliseconds
   * @returns {Promise<boolean>} true once all processors are stopped, false on timeout
   */
  async _waitForProcessorsStopped(groupId, timeoutMs = TIMEOUTS.MEDIUM) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const processors = await this.getProcessorsOnCanvas(groupId);
      const anyRunning = processors.some(p => {
        const state =
          p.status?.aggregateSnapshot?.runStatus ||
          p.status?.runStatus ||
          p.component?.state;
        return typeof state === 'string' && state.toUpperCase() === 'RUNNING';
      });
      if (!anyRunning) return true;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    testLogger.warn('Processor', 'Timed out waiting for processors to stop');
    return false;
  }

  /**
   * Remove all connections to/from a processor.
   * Drops queued FlowFiles and deletes each connection.
   */
  async removeConnectionsForProcessor(processorId) {
    const jwtGroupId = await this.getJwtPipelineProcessGroupId();
    const groupId = jwtGroupId || await this.getRootProcessGroupId();
    const result = await this.makeApiCall(
      `/nifi-api/process-groups/${groupId}/connections`
    );

    if (!result.ok || !result.data?.connections) {
      testLogger.warn('Processor', 'Could not retrieve connections');
      return;
    }

    const related = result.data.connections.filter(c =>
      c.component?.source?.id === processorId ||
      c.component?.destination?.id === processorId
    );

    testLogger.info('Processor', `Found ${related.length} connections for processor ${processorId}`);

    for (const conn of related) {
      const connId = conn.id;

      // Drop queued FlowFiles, then poll the drop-request to completion instead
      // of a fixed 500ms sleep (N64).
      const dropResult = await this.makeApiCall(
        `/nifi-api/flowfile-queues/${connId}/drop-requests`,
        { method: 'POST' }
      );
      const dropRequestId = dropResult.ok ? dropResult.data?.dropRequest?.id : null;
      if (dropRequestId) {
        await this._waitForDropRequest(connId, dropRequestId);
      }

      // Delete using the current revision. A stale version yields 409; the
      // correct recovery is to re-read the live revision, not to blindly guess
      // version+1 (N64).
      const deleted = await this._deleteConnectionWithFreshRevision(
        connId,
        conn.revision?.version ?? 0
      );
      if (deleted) {
        testLogger.info('Processor', `Deleted connection ${connId}`);
      } else {
        testLogger.warn('Processor', `Could not delete connection ${connId}`);
      }
    }
  }

  /**
   * Poll a FlowFile drop-request until it reports finished, then delete it.
   * @param {string} connId - connection (flowfile-queue) id
   * @param {string} dropRequestId - drop-request id returned by the POST
   * @param {number} [timeoutMs] - overall wait budget in milliseconds
   */
  async _waitForDropRequest(connId, dropRequestId, timeoutMs = TIMEOUTS.MEDIUM) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = await this.makeApiCall(
        `/nifi-api/flowfile-queues/${connId}/drop-requests/${dropRequestId}`
      );
      if (!status.ok || status.data?.dropRequest?.finished) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    // Release the drop-request resource (best effort)
    await this.makeApiCall(
      `/nifi-api/flowfile-queues/${connId}/drop-requests/${dropRequestId}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Fetch a connection's current revision version.
   * @param {string} connId - connection id
   * @returns {Promise<number|null>} the live revision version, or null if unavailable
   */
  async _fetchConnectionRevision(connId) {
    const result = await this.makeApiCall(`/nifi-api/connections/${connId}`);
    if (result.ok && result.data) {
      return result.data.revision?.version ?? null;
    }
    return null;
  }

  /**
   * Delete a connection, recovering from a version conflict by re-reading the
   * live revision (never by guessing version+1).
   * @param {string} connId - connection id
   * @param {number} listedVersion - revision version from the connections listing
   * @returns {Promise<boolean>} true when the connection is gone (deleted or 404)
   */
  async _deleteConnectionWithFreshRevision(connId, listedVersion) {
    const attempt = version =>
      this.makeApiCall(
        `/nifi-api/connections/${connId}?version=${version}&disconnectedNodeAcknowledged=false`,
        { method: 'DELETE' }
      );

    let deleteResult = await attempt(listedVersion);
    if (deleteResult.ok || deleteResult.status === 404) return true;

    if (deleteResult.status === 409) {
      const freshVersion = await this._fetchConnectionRevision(connId);
      if (freshVersion === null) return false;
      deleteResult = await attempt(freshVersion);
      return deleteResult.ok || deleteResult.status === 404;
    }
    return false;
  }

  /**
   * Remove MultiIssuerJWTTokenAuthenticator from canvas.
   * Handles processors with active connections by stopping all processors,
   * removing connections, then deleting the target processor.
   */
  async removeMultiIssuerJWTTokenAuthenticatorFromCanvas() {
    testLogger.info('Processor','Removing MultiIssuerJWTTokenAuthenticator from canvas...');

    try {
      const { exists, processor } = await this.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();

      if (!exists) {
        testLogger.info('Processor','MultiIssuerJWTTokenAuthenticator not on canvas, nothing to remove');
        return true;
      }

      // Stop all processors in the group (required before removing connections)
      await this.stopAllProcessors();

      // Remove all connections to/from this processor
      await this.removeConnectionsForProcessor(processor.id);

      // Re-fetch the processor to get the latest revision after state changes
      const refreshed = await this.getProcessorDetails(processor.id);
      const version = refreshed?.revision?.version || processor.revision?.version || 0;

      // Delete the processor
      const deleteUrl = `/nifi-api/processors/${processor.id}?version=${version}`;
      const deleteResult = await this.makeApiCall(deleteUrl, { method: 'DELETE' });

      if (deleteResult.ok || deleteResult.status === 404) {
        testLogger.info('Processor','MultiIssuerJWTTokenAuthenticator removed from canvas');
        return true;
      }

      testLogger.warn('Processor',`Delete returned ${deleteResult.status}, verifying processor state...`);

      // Delete failed — check if processor is actually gone despite the error
      const verifyResult = await this.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
      if (!verifyResult.exists) {
        testLogger.info('Processor','Processor confirmed removed from canvas');
        return true;
      }

      // Processor still exists — try one more time with a fresh version
      const retryDetails = await this.getProcessorDetails(verifyResult.processor.id);
      if (retryDetails) {
        const retryVersion = retryDetails.revision?.version || 0;
        const retryUrl = `/nifi-api/processors/${verifyResult.processor.id}?version=${retryVersion}`;
        const retryResult = await this.makeApiCall(retryUrl, { method: 'DELETE' });
        if (retryResult.ok || retryResult.status === 404) {
          testLogger.info('Processor','Processor removed on retry');
          return true;
        }
        testLogger.error('Processor',`Retry delete failed: ${retryResult.status} - ${JSON.stringify(retryResult.data)}`);
      }

      testLogger.error('Processor',`Failed to delete processor: ${deleteResult.status || deleteResult.error}`);
      return false;
    } catch (error) {
      testLogger.error('Processor', `Error removing processor from canvas: ${error.message}`);
      return false;
    }
  }

  /**
   * Add MultiIssuerJWTTokenAuthenticator to canvas
   */
  async addMultiIssuerJWTTokenAuthenticatorOnCanvas(position = { x: 400, y: 200 }) {
    testLogger.info('Processor','Adding MultiIssuerJWTTokenAuthenticator to canvas...');
    
    try {
      // First check if it's already on canvas
      const { exists } = await this.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
      if (exists) {
        testLogger.info('Processor','MultiIssuerJWTTokenAuthenticator already on canvas');
        return true;
      }

      // Check if the processor type is deployed
      const isDeployed = await this.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();
      if (!isDeployed) {
        testLogger.error('Processor','MultiIssuerJWTTokenAuthenticator is not deployed in the system');
        return false;
      }

      // Add to the JWT Pipeline group if it exists, otherwise root
      const jwtGroupId = await this.getJwtPipelineProcessGroupId();
      const targetGroupId = jwtGroupId || await this.getRootProcessGroupId();

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
        testLogger.error('Processor','Could not find processor type info');
        return false;
      }

      // Create the processor
      const createResult = await this.makeApiCall(
        `/nifi-api/process-groups/${targetGroupId}/processors`,
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
        testLogger.info('Processor',`MultiIssuerJWTTokenAuthenticator added to canvas with ID: ${createResult.data?.id}`);
        return true;
      } else {
        testLogger.error('Processor',`Failed to create processor: ${createResult.status || createResult.error}`);
        if (createResult.status === 403) {
          testLogger.error('Processor','Permission denied - user may not have rights to add processors');
        }
        testLogger.info('Processor', `Create error response: ${JSON.stringify(createResult.data, null, 2)}`);
        return false;
      }
    } catch (error) {
      testLogger.error('Processor', `Error adding processor to canvas: ${error.message}`);
      return false;
    }
  }

  /**
   * Ensure MultiIssuerJWTTokenAuthenticator is on canvas
   * This method handles all preconditions: verification, adding if needed, error handling, and logging
   * Returns true on success, throws an error if preconditions cannot be met
   */
  async ensureProcessorOnCanvas() {
    try {
      const { exists } = await this.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();

      if (!exists) {
        testLogger.info('Processor','Processor not on canvas, adding it...');
        const added = await this.addMultiIssuerJWTTokenAuthenticatorOnCanvas();
        if (!added) {
          throw new Error(
            'PRECONDITION FAILED: Cannot add MultiIssuerJWTTokenAuthenticator to canvas. ' +
            'The processor must be deployed in NiFi for tests to run.'
          );
        }
      } else {
        testLogger.info('Processor','Processor already on canvas');
      }

      // Navigate into the JWT Pipeline process group so the canvas shows only its processors
      const jwtGroupId = await this.getJwtPipelineProcessGroupId();
      if (jwtGroupId) {
        await this.navigateToProcessGroup(jwtGroupId);
      }

      testLogger.info('Processor','All preconditions met');
      return true;
      
    } catch (error) {
      // Re-throw with clear error message for test failure
      if (error.message.includes('PRECONDITION FAILED')) {
        throw error; // Already has proper error message
      }
      
      throw new Error(
        'PRECONDITION FAILED: Cannot ensure MultiIssuerJWTTokenAuthenticator is on canvas. ' +
        'The processor must be deployed in NiFi for tests to run. ' +
        `Details: ${error.message}`,
        { cause: error },
      );
    }
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

      testLogger.warn('Processor', `getProcessorDetails(${processorId}): ${result.status || result.error}`);
      return null;
    } catch (error) {
      testLogger.error('Processor', `Error getting processor details: ${error.message}`);
      return null;
    }
  }

  /**
   * Start the MultiIssuerJWTTokenAuthenticator processor
   */
  async startProcessor() {
    testLogger.info('Processor','Starting MultiIssuerJWTTokenAuthenticator processor...');
    
    try {
      const { exists, processor } = await this.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
      
      if (!exists) {
        testLogger.error('Processor','Cannot start processor - not on canvas');
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
        testLogger.info('Processor','Processor started successfully');
        return true;
      } else {
        testLogger.error('Processor',`Failed to start processor: ${result.status || result.error}`);
        return false;
      }
    } catch (error) {
      testLogger.error('Processor', `Error starting processor: ${error.message}`);
      return false;
    }
  }

  /**
   * Stop the MultiIssuerJWTTokenAuthenticator processor
   */
  async stopProcessor() {
    testLogger.info('Processor','Stopping MultiIssuerJWTTokenAuthenticator processor...');
    
    try {
      const { exists, processor } = await this.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
      
      if (!exists) {
        testLogger.error('Processor','Cannot stop processor - not on canvas');
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
        testLogger.info('Processor','Processor stopped successfully');
        return true;
      } else {
        testLogger.error('Processor',`Failed to stop processor: ${result.status || result.error}`);
        return false;
      }
    } catch (error) {
      testLogger.error('Processor', `Error stopping processor: ${error.message}`);
      return false;
    }
  }

  /**
   * Add an isolated throwaway MultiIssuerJWTTokenAuthenticator instance with a
   * distinct name so lifecycle self-tests can exercise add/start/stop/remove
   * WITHOUT touching the provisioned pipeline processor or its connections (M21).
   * Unlike addMultiIssuerJWTTokenAuthenticatorOnCanvas, this always creates a new
   * instance and returns its entity.
   * @param {string} name - unique processor name for the throwaway instance
   * @param {{x:number,y:number}} [position] - canvas position
   * @returns {Promise<object|null>} the created processor entity, or null on failure
   */
  async addThrowawayProcessor(name, position = { x: 100, y: 100 }) {
    const isDeployed = await this.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();
    if (!isDeployed) {
      testLogger.error('Processor', 'Cannot add throwaway — processor type not deployed');
      return null;
    }

    const jwtGroupId = await this.getJwtPipelineProcessGroupId();
    const targetGroupId = jwtGroupId || await this.getRootProcessGroupId();

    const typesResult = await this.makeApiCall('/nifi-api/flow/processor-types');
    const processorTypeInfo = typesResult.ok && typesResult.data
      ? typesResult.data.processorTypes?.find(type =>
          type.type === this.processorType ||
          type.type?.includes('MultiIssuerJWTTokenAuthenticator'))
      : null;
    if (!processorTypeInfo) {
      testLogger.error('Processor', 'Could not find processor type info for throwaway');
      return null;
    }

    const createResult = await this.makeApiCall(
      `/nifi-api/process-groups/${targetGroupId}/processors`,
      {
        method: 'POST',
        body: {
          revision: { version: 0 },
          component: {
            type: processorTypeInfo.type,
            bundle: processorTypeInfo.bundle,
            name,
            position,
            config: { properties: {}, autoTerminatedRelationships: [] }
          }
        }
      }
    );
    if (createResult.ok) {
      testLogger.info('Processor', `Throwaway processor '${name}' added with ID: ${createResult.data?.id}`);
      return createResult.data;
    }
    testLogger.error('Processor', `Failed to create throwaway processor: ${createResult.status || createResult.error}`);
    return null;
  }

  /**
   * Find a processor in the JWT pipeline group (or root) by exact name.
   * @param {string} name - processor name to match
   * @returns {Promise<object|null>} the processor entity, or null when not found
   */
  async findProcessorByName(name) {
    const jwtGroupId = await this.getJwtPipelineProcessGroupId();
    const processors = jwtGroupId
      ? await this.getProcessorsOnCanvas(jwtGroupId)
      : await this.getProcessorsOnCanvas();
    return processors.find(p => p.component?.name === name) || null;
  }

  /**
   * Set a specific processor's run-status by id (re-fetches its revision first).
   * @param {string} processorId - target processor id
   * @param {'RUNNING'|'STOPPED'} state - desired run state
   * @returns {Promise<boolean>} true when NiFi accepted the state change
   */
  async setProcessorRunStatusById(processorId, state) {
    const details = await this.getProcessorDetails(processorId);
    if (!details) return false;
    const result = await this.makeApiCall(
      `/nifi-api/processors/${processorId}/run-status`,
      {
        method: 'PUT',
        body: {
          revision: { version: details.revision?.version || 0 },
          state
        }
      }
    );
    return result.ok;
  }

  /**
   * Remove a specific processor by id (re-fetches its revision first).
   * @param {string} processorId - target processor id
   * @returns {Promise<boolean>} true when the processor is gone (deleted or 404)
   */
  async removeProcessorById(processorId) {
    const initial = await this.getProcessorDetails(processorId);
    if (!initial) return true; // already gone

    // NiFi rejects a processor DELETE (409) while the processor is RUNNING or
    // still has active threads terminating. Ensure it is stopped, then poll
    // until the thread count settles before attempting deletion.
    const initialState =
      initial.status?.aggregateSnapshot?.runStatus || initial.component?.state || '';
    if (initialState.toUpperCase() === 'RUNNING') {
      await this.setProcessorRunStatusById(processorId, 'STOPPED');
    }

    const deadline = Date.now() + TIMEOUTS.MEDIUM;
    while (Date.now() < deadline) {
      const d = await this.getProcessorDetails(processorId);
      if (!d) return true; // disappeared while we polled
      const runStatus =
        d.status?.aggregateSnapshot?.runStatus || d.component?.state || '';
      const activeThreads = d.status?.aggregateSnapshot?.activeThreadCount ?? 0;
      if (runStatus.toUpperCase() !== 'RUNNING' && activeThreads === 0) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    // Delete with a freshly-fetched revision, retrying once on a 409 (a stale
    // revision or a still-settling thread count).
    for (let attempt = 0; attempt < 2; attempt++) {
      const details = await this.getProcessorDetails(processorId);
      if (!details) return true; // already gone
      const version = details.revision?.version || 0;
      const result = await this.makeApiCall(
        `/nifi-api/processors/${processorId}?version=${version}`,
        { method: 'DELETE' }
      );
      if (result.ok || result.status === 404) return true;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    return false;
  }

  /**
   * Poll a processor until its PHYSICAL state is STOPPED with no active threads.
   * The physicalState field is authoritative here: a start requested while the
   * processor is INVALID parks it in a pending-start limbo where runStatus
   * reports 'Invalid' (not 'Running') and component.state reports STOPPED, yet
   * NiFi still rejects config mutations with 'Cannot modify configuration while
   * the Processor is running'. Only physicalState === 'STOPPED' guarantees the
   * PUT is accepted (no fixed sleep, N64).
   * @param {string} processorId - target processor id
   * @param {number} [timeoutMs] - overall wait budget in milliseconds
   * @returns {Promise<object|null>} the settled processor details, or null if it
   *   vanished OR the settle timed out. A null return is the caller's signal that
   *   the processor is NOT safely stopped — never treat a timeout as settled, or a
   *   subsequent config PUT can still fail with 'Cannot modify configuration while
   *   the Processor is running' (the PR #445 failure mode).
   */
  async _waitForProcessorSettled(processorId, timeoutMs = TIMEOUTS.MEDIUM) {
    const deadline = Date.now() + timeoutMs;
    let details = await this.getProcessorDetails(processorId);
    while (Date.now() < deadline) {
      if (!details) return null;
      const physicalState = (details.physicalState || details.component?.state || '').toUpperCase();
      const activeThreads = details.status?.aggregateSnapshot?.activeThreadCount ?? 0;
      if (physicalState === 'STOPPED' && activeThreads === 0) return details;
      await new Promise(resolve => setTimeout(resolve, 250));
      details = await this.getProcessorDetails(processorId);
    }
    // Timed out without reaching a physically STOPPED, thread-idle state. Return
    // null (NOT the last-fetched details) so the caller's `if (!settled)` guard
    // treats a timeout as a failed settle rather than proceeding to mutate a
    // still-running processor.
    testLogger.warn('Processor', `Timed out waiting for processor ${processorId} to settle`);
    return null;
  }

  /**
   * Poll a processor until its physical state is RUNNING.
   * @param {string} processorId - target processor id
   * @param {number} [timeoutMs] - overall wait budget in milliseconds
   * @returns {Promise<boolean>} true once the processor is RUNNING, false on timeout
   */
  async _waitForProcessorRunning(processorId, timeoutMs = TIMEOUTS.MEDIUM) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const details = await this.getProcessorDetails(processorId);
      const physicalState =
        (details?.physicalState || details?.component?.state || '').toUpperCase();
      if (physicalState === 'RUNNING') return true;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    testLogger.warn('Processor', `Timed out waiting for processor ${processorId} to reach RUNNING`);
    return false;
  }

  /**
   * PUT the processor config, recovering from a stale-revision 409 by
   * re-reading the live revision once — never guessing version+1 (N64).
   * @param {string} processorId - target processor id
   * @param {number} version - revision version to attempt first
   * @param {object} config - partial config DTO (e.g. properties mapped to null, autoTerminatedRelationships)
   * @returns {Promise<boolean>} true when NiFi accepted the config update
   */
  async _updateProcessorConfigWithFreshRevision(processorId, version, config) {
    const attempt = rev =>
      this.makeApiCall(`/nifi-api/processors/${processorId}`, {
        method: 'PUT',
        body: {
          revision: { version: rev },
          component: {
            id: processorId,
            config
          }
        }
      });

    let result = await attempt(version);
    if (result.ok) return true;

    if (result.status === 409) {
      const fresh = await this.getProcessorDetails(processorId);
      const freshVersion = fresh?.revision?.version;
      if (freshVersion === undefined || freshVersion === null) return false;
      result = await attempt(freshVersion);
      return result.ok;
    }
    return false;
  }

  /**
   * Remove all restapi.{routeName}.* properties from the RestApiGatewayProcessor
   * via the REST API. Idempotent: returns true as a no-op when the gateway
   * processor is absent from the canvas or carries no matching properties. When
   * properties do match, the processor is stopped (whenever physicalState is not
   * STOPPED — this also cancels an INVALID pending-start limbo), polled to a
   * physically STOPPED state, its config PUT with each matched key mapped to
   * null AND the route's dynamic relationship auto-terminated (else the stale
   * relationship keeps the processor INVALID and the restart deadlocks), then
   * restarted and confirmed RUNNING — all without a fixed sleep (N64). Stale
   * revisions on the PUT are recovered by re-reading the live revision (N64).
   * @param {string} routeName - route whose restapi.{routeName}.* properties to clear
   * @returns {Promise<boolean>} true on success (including the idempotent no-op cases)
   */
  async removeGatewayRouteProperties(routeName) {
    const gatewayId = await this.getGatewayProcessorId();
    if (!gatewayId) {
      testLogger.info(
        'Processor',
        `removeGatewayRouteProperties('${routeName}'): gateway processor not on canvas — nothing to clean`
      );
      return true;
    }

    const details = await this.getProcessorDetails(gatewayId);
    if (!details) {
      testLogger.warn(
        'Processor',
        `removeGatewayRouteProperties('${routeName}'): could not fetch gateway processor ${gatewayId} details`
      );
      return false;
    }

    const prefix = `restapi.${routeName}.`;
    const currentProps = details.component?.config?.properties || {};
    const matchedKeys = Object.keys(currentProps).filter(key => key.startsWith(prefix));
    if (matchedKeys.length === 0) {
      testLogger.info(
        'Processor',
        `removeGatewayRouteProperties('${routeName}'): no properties matching '${prefix}' — already clean`
      );
      return true;
    }

    testLogger.info(
      'Processor',
      `removeGatewayRouteProperties('${routeName}'): clearing ${matchedKeys.length} property(ies): ${matchedKeys.join(', ')}`
    );

    // Stop the gateway before mutating its config. Judge by physicalState, not
    // runStatus: a start requested while the processor is INVALID parks it in a
    // pending-start limbo ('physicalState: STARTING', runStatus 'Invalid') that
    // still rejects config PUTs with 'Cannot modify configuration while the
    // Processor is running' — the exact failure that sank the PR #445 UI
    // cleanup. An explicit STOPPED cancels the pending start.
    const initialPhysicalState =
      (details.physicalState || details.component?.state || '').toUpperCase();
    if (initialPhysicalState !== 'STOPPED') {
      await this.setProcessorRunStatusById(gatewayId, 'STOPPED');
    }

    // Poll to a physically STOPPED (no active threads) state before the PUT.
    const settled = await this._waitForProcessorSettled(gatewayId);
    if (!settled) {
      testLogger.warn(
        'Processor',
        `removeGatewayRouteProperties('${routeName}'): gateway processor ${gatewayId} did not settle (vanished or timed out) — not safe to mutate config`
      );
      return false;
    }

    // Map each matched key to null so NiFi clears it. The processor recomputes
    // its dynamic route relationships only in onScheduled, so clearing the
    // properties alone leaves a stale '{routeName}' relationship that keeps the
    // processor INVALID ('not connected and not auto-terminated') and deadlocks
    // the restart. Auto-terminate that relationship in the same PUT — the same
    // thing the route-editor UI does on route deletion; the entry becomes a
    // harmless leftover once onScheduled drops the relationship.
    const clearMap = {};
    for (const key of matchedKeys) clearMap[key] = null;
    const autoTerminated = new Set(
      settled.component?.config?.autoTerminatedRelationships || []
    );
    autoTerminated.add(routeName);

    const version = settled.revision?.version ?? 0;
    const updated = await this._updateProcessorConfigWithFreshRevision(gatewayId, version, {
      properties: clearMap,
      autoTerminatedRelationships: [...autoTerminated]
    });

    // Always try to leave the provisioned gateway RUNNING again, even on failure.
    await this.setProcessorRunStatusById(gatewayId, 'RUNNING');
    const running = await this._waitForProcessorRunning(gatewayId);

    if (!updated) {
      testLogger.error(
        'Processor',
        `removeGatewayRouteProperties('${routeName}'): failed to clear properties on gateway ${gatewayId}`
      );
      return false;
    }

    if (!running) {
      testLogger.warn(
        'Processor',
        `removeGatewayRouteProperties('${routeName}'): cleared properties but gateway ${gatewayId} did not confirm RUNNING`
      );
      return false;
    }

    testLogger.info(
      'Processor',
      `removeGatewayRouteProperties('${routeName}'): cleared ${matchedKeys.length} property(ies); gateway ${gatewayId} restarted and RUNNING`
    );
    return true;
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