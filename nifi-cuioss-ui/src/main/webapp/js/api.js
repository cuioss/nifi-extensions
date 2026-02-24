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
    PROCESSOR: { apiPath: '/nifi-api/processors', propsPath: ['component', 'config', 'properties'] },
    CONTROLLER_SERVICE: { apiPath: '/nifi-api/controller-services', propsPath: ['component', 'properties'] }
};

/** Cached component detection result: { type, componentClass, apiPath, propsPath } */
let _componentInfo = null;

/** UUID v4 pattern for NiFi component ID validation. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate that an ID matches the NiFi UUID format to prevent path traversal. */
const assertValidUuid = (id, label = 'Component ID') => {
    if (!id || !UUID_PATTERN.test(id)) {
        throw new Error(`Invalid ${label}: expected UUID format`);
    }
};

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
 * Extract NiFi's CSRF token from the __Secure-Request-Token cookie.
 * Tries document.cookie first, then window.parent.document.cookie
 * (Custom UI runs in an iframe; the cookie path may restrict direct access).
 * @returns {string|null}
 */
const getCsrfToken = () => {
    const cookieName = '__Secure-Request-Token=';
    const extract = (cookieString) => {
        const match = cookieString.split(';')
            .map(c => c.trim())
            .find(c => c.startsWith(cookieName));
        return match ? match.split('=')[1] : null;
    };
    try {
        const token = extract(document.cookie);
        if (token) return token;
    } catch { /* no document.cookie access */ }
    try {
        return extract(window.parent.document.cookie);
    } catch { /* cross-origin or no parent */ }
    return null;
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

    // NiFi CSRF protection: double-submit cookie pattern requires
    // Request-Token header for state-changing methods
    if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
        const csrfToken = getCsrfToken();
        if (csrfToken) headers['Request-Token'] = csrfToken;
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
const detectComponentType = async (_componentId) => {
    if (_componentInfo) return _componentInfo;

    // Call WAR servlet — resolves within the WAR context (works both in
    // NiFi iframe and standalone E2E). The request() function adds the
    // X-Processor-Id header automatically for URLs containing '/jwt/'.
    const data = await request('GET', `${BASE_URL}/component-info`);
    _componentInfo = {
        type: data.type,
        componentClass: data.componentClass,
        ...COMPONENT_TYPES[data.type]
    };
    return _componentInfo;
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

/**
 * Fetch component configuration using the correct API path for the component type.
 *
 * @param {string} componentId  NiFi component UUID
 * @returns {Promise<Object>}  NiFi REST API response
 */
export const getComponentProperties = async (componentId) => {
    const info = await detectComponentType(componentId);
    const data = await request('GET', `${info.apiPath}/${componentId}`);
    // Navigate propsPath to extract properties: e.g. ['component', 'config', 'properties']
    let props = data;
    for (const key of info.propsPath) { props = props?.[key]; }
    return { properties: props || {}, revision: data.revision };
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

/**
 * Send a test request to the gateway via proxy servlet.
 *
 * @param {Object} payload  test request payload: {path, method, headers, body}
 * @returns {Promise<Object>}  wrapped gateway response: {status, headers, body}
 */
export const sendGatewayTestRequest = (payload) =>
    request('POST', `${BASE_URL}/gateway/test`, payload);

// ---------------------------------------------------------------------------
// Direct Controller Service accessors (bypass detectComponentType cache)
// ---------------------------------------------------------------------------

/**
 * Fetch controller service properties directly by CS UUID.
 * Unlike getComponentProperties(), this does not use detectComponentType —
 * it always targets the controller-services endpoint.
 *
 * @param {string} csId  Controller Service UUID
 * @returns {Promise<{properties: Object, revision: Object}>}
 */
export const getControllerServiceProperties = async (csId) => {
    assertValidUuid(csId, 'Controller Service ID');
    const data = await request('GET', `${COMPONENT_TYPES.CONTROLLER_SERVICE.apiPath}/${csId}`);
    let props = data;
    for (const key of COMPONENT_TYPES.CONTROLLER_SERVICE.propsPath) { props = props?.[key]; }
    return { properties: props || {}, revision: data.revision };
};

/**
 * Update controller service properties directly by CS UUID.
 * Fetches current revision first, then sends PUT.
 *
 * @param {string} csId  Controller Service UUID
 * @param {Object} properties  properties to update
 * @returns {Promise<Object>}  updated CS response
 */
export const updateControllerServiceProperties = async (csId, properties) => {
    assertValidUuid(csId, 'Controller Service ID');
    const current = await request('GET', `${COMPONENT_TYPES.CONTROLLER_SERVICE.apiPath}/${csId}`);
    return request('PUT', `${COMPONENT_TYPES.CONTROLLER_SERVICE.apiPath}/${csId}`, {
        revision: current.revision,
        component: { id: csId, properties }
    });
};

/**
 * Resolve the JWT Config Service UUID from a gateway processor's properties.
 * Looks for 'rest.gateway.jwt.config.service' or 'jwt.issuer.config.service'.
 *
 * @param {string} processorId  Gateway processor UUID
 * @returns {Promise<string|null>}  CS UUID or null if not configured
 */
export const resolveJwtConfigServiceId = async (processorId) => {
    assertValidUuid(processorId, 'Processor ID');
    const info = await detectComponentType(processorId);
    const data = await request('GET', `${info.apiPath}/${processorId}`);
    let props = data;
    for (const key of info.propsPath) { props = props?.[key]; }
    const properties = props || {};
    return properties['rest.gateway.jwt.config.service']
        || properties['jwt.issuer.config.service']
        || null;
};

// Backward-compatible aliases
/** @deprecated Use getComponentProperties instead */
export const getProcessorProperties = (processorId) =>
    request('GET', `/nifi-api/processors/${processorId}`);

/** @deprecated Use updateComponentProperties instead */
export const updateProcessorProperties = async (processorId, properties) => {
    const proc = await getProcessorProperties(processorId);
    return request('PUT', `/nifi-api/processors/${processorId}`, {
        revision: proc.revision,
        component: { id: processorId, properties }
    });
};

export {
    getComponentId, detectComponentType, resetComponentCache, getCsrfToken, COMPONENT_TYPES
};
