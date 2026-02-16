'use strict';

/**
 * Thin fetch-based API client for JWT validation operations.
 * Supports both processor and controller service component types.
 *
 * @module js/api
 */

const BASE_URL = 'nifi-api/processors/jwt';

/** Component type definitions with NiFi REST API paths. */
const COMPONENT_TYPES = {
    PROCESSOR: { apiPath: 'nifi-api/processors', propsPath: ['config', 'properties'] },
    CONTROLLER_SERVICE: { apiPath: 'nifi-api/controller-services', propsPath: ['properties'] }
};

/** Cached component detection result: { type, componentClass, apiPath, propsPath } */
let _componentInfo = null;

/**
 * Returns the NiFi component ID from the current URL's query string.
 * @returns {string}
 */
const getComponentId = () => {
    if (globalThis.jwtAuthConfig?.processorId) return globalThis.jwtAuthConfig.processorId;
    const params = new URLSearchParams(globalThis.location.search);
    const id = params.get('id') || params.get('processorId') || '';
    if (id) globalThis.jwtAuthConfig = { processorId: id };
    return id;
};

/**
 * Core fetch wrapper with JSON handling, auth headers, and timeout.
 *
 * @param {string} method  HTTP method
 * @param {string} url     endpoint
 * @param {Object|null} [body=null]  JSON body
 * @returns {Promise<Object>}  parsed JSON response
 */
const request = async (method, url, body = null) => {
    const headers = {};

    // Attach processor-id header for JWT endpoints
    if (url.includes('/jwt/')) {
        const pid = getComponentId();
        if (pid) headers['X-Processor-Id'] = pid;
    }

    const opts = { method, headers, credentials: 'same-origin' };

    if (body) {
        headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }

    const res = await fetch(url, opts);

    if (!res.ok) {
        const text = await res.text();
        const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
        err.status = res.status;
        err.statusText = res.statusText;
        err.responseText = text;
        try { err.responseJSON = JSON.parse(text); } catch { /* not JSON */ }
        throw err;
    }

    return res.json();
};

// ---------------------------------------------------------------------------
// Component type detection
// ---------------------------------------------------------------------------

/**
 * Auto-detects the component type by trying the processor API first,
 * then falling back to controller service.
 *
 * @param {string} componentId  NiFi component UUID
 * @returns {Promise<{type: string, componentClass: string}>}
 */
const detectComponentType = async (componentId) => {
    if (_componentInfo) return _componentInfo;

    // Try processor first
    try {
        const data = await request('GET', `${COMPONENT_TYPES.PROCESSOR.apiPath}/${componentId}`);
        const componentClass = data?.component?.type || '';
        _componentInfo = {
            type: 'PROCESSOR',
            componentClass,
            ...COMPONENT_TYPES.PROCESSOR
        };
        return _componentInfo;
    } catch (processorErr) {
        if (processorErr.status !== 404) throw processorErr;
    }

    // Try controller service
    try {
        const data = await request('GET',
            `${COMPONENT_TYPES.CONTROLLER_SERVICE.apiPath}/${componentId}`);
        const componentClass = data?.component?.type || '';
        _componentInfo = {
            type: 'CONTROLLER_SERVICE',
            componentClass,
            ...COMPONENT_TYPES.CONTROLLER_SERVICE
        };
        return _componentInfo;
    } catch (csErr) {
        if (csErr.status !== 404) throw csErr;
        throw new Error(`Component not found: ${componentId}`);
    }
};

/**
 * Resets cached component info. Useful for testing.
 */
const resetComponentCache = () => { _componentInfo = null; };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Validate a JWKS URL */
export const validateJwksUrl = (jwksUrl) =>
    request('POST', `${BASE_URL}/validate-jwks-url`, { jwksUrl });

/** Validate a local JWKS file */
export const validateJwksFile = (filePath) =>
    request('POST', `${BASE_URL}/validate-jwks-file`, { filePath });

/** Validate raw JWKS content */
export const validateJwksContent = (jwksContent) =>
    request('POST', `${BASE_URL}/validate-jwks-content`, { jwksContent });

/** Verify a JWT token */
export const verifyToken = (token) =>
    request('POST', `${BASE_URL}/verify-token`, { token });

/** Fetch security / validation metrics */
export const getSecurityMetrics = () =>
    request('GET', `${BASE_URL}/metrics`);

/**
 * Fetch component configuration using the correct API path for the component type.
 *
 * @param {string} componentId  NiFi component UUID
 * @returns {Promise<Object>}  NiFi REST API response
 */
export const getComponentProperties = async (componentId) => {
    const info = await detectComponentType(componentId);
    return request('GET', `${info.apiPath}/${componentId}`);
};

/**
 * Update component properties (fetches current revision first).
 *
 * @param {string} componentId  NiFi component UUID
 * @param {Object} properties   properties to update
 * @returns {Promise<Object>}  updated component response
 */
export const updateComponentProperties = async (componentId, properties) => {
    const info = await detectComponentType(componentId);
    const current = await request('GET', `${info.apiPath}/${componentId}`);
    return request('PUT', `${info.apiPath}/${componentId}`, {
        revision: current.revision,
        component: { id: componentId, properties }
    });
};

/**
 * Proxy call to gateway management API via GatewayProxyServlet.
 *
 * @param {string} path  management API path (e.g. '/metrics', '/config')
 * @returns {Promise<Object>}  gateway response
 */
export const fetchGatewayApi = (path) =>
    request('GET', `${BASE_URL}/gateway${path}`);

// Backward-compatible aliases
/** @deprecated Use getComponentProperties instead */
export const getProcessorProperties = (processorId) =>
    request('GET', `nifi-api/processors/${processorId}`);

/** @deprecated Use updateComponentProperties instead */
export const updateProcessorProperties = async (processorId, properties) => {
    const proc = await getProcessorProperties(processorId);
    return request('PUT', `nifi-api/processors/${processorId}`, {
        revision: proc.revision,
        component: { id: processorId, properties }
    });
};

export { getComponentId, detectComponentType, resetComponentCache, COMPONENT_TYPES };
