'use strict';

/**
 * Thin fetch-based API client for JWT validation operations.
 * Supports both processor and controller service component types.
 *
 * @module js/api
 */

import { log } from './utils.js';

const BASE_URL = 'nifi-api/processors/jwt';

/** Abort an in-flight API request after this many milliseconds (see request()). */
const REQUEST_TIMEOUT_MS = 30000;

/** WAR-relative path of the proxy context-path resolver servlet. */
const PROXY_CONTEXT_PATH_URL = 'nifi-api/context-path';

/** Component type definitions with NiFi REST API paths. */
const COMPONENT_TYPES = {
    PROCESSOR: { apiPath: '/nifi-api/processors', propsPath: ['component', 'config', 'properties'] },
    CONTROLLER_SERVICE: { apiPath: '/nifi-api/controller-services', propsPath: ['component', 'properties'] }
};

// ---------------------------------------------------------------------------
// Reverse-proxy context path
// ---------------------------------------------------------------------------

/**
 * Cached reverse-proxy context path prefix.
 * `null` = not yet resolved; a string (possibly empty) = resolved value.
 * Host-absolute /nifi-api/... URLs are prefixed with this so that requests
 * routed through a reverse proxy (which serves NiFi under a sub-path) hit the
 * correct path. Empty string for direct, non-proxied deployments.
 */
let _proxyContextPath = null;

/**
 * In-flight resolution promise, deduplicating concurrent first-call fetches.
 * `null` when no fetch is pending. Cleared once the resolution settles.
 */
let _proxyContextPathPromise = null;

/**
 * Resolve and cache the reverse-proxy context path prefix.
 *
 * Browser JavaScript cannot read the proxy headers (X-ProxyContextPath /
 * X-Forwarded-Prefix) directly — they are added by the reverse proxy on the
 * hop to NiFi and never reach the browser. The ProxyContextPathServlet does
 * receive them and returns the resolved prefix as JSON.
 *
 * The result is cached after the first successful call; subsequent calls
 * return the cached value without re-fetching. Any failure (servlet
 * unreachable, non-OK response, malformed body) resolves to an empty string,
 * caching it so a flaky servlet does not trigger a fetch on every API call.
 * Concurrent first calls (several API entry points priming the cache at once on
 * page load) share a single in-flight fetch via `_proxyContextPathPromise`, so
 * the servlet is hit at most once. Once resolved, `nifiApiUrl()` reads the
 * cached value synchronously.
 *
 * @returns {Promise<string>}  the normalized prefix (e.g. '/my-app/ui'), or ''
 */
export const getProxyContextPath = async () => {
    if (_proxyContextPath !== null) return _proxyContextPath;
    if (_proxyContextPathPromise) return _proxyContextPathPromise;

    _proxyContextPathPromise = (async () => {
        try {
            const res = await fetch(PROXY_CONTEXT_PATH_URL, { credentials: 'same-origin' });
            if (res.ok) {
                const data = await res.json();
                _proxyContextPath = typeof data?.contextPath === 'string' ? data.contextPath : '';
            } else {
                log.warn(`Proxy context-path servlet returned HTTP ${res.status}; using empty prefix`);
                _proxyContextPath = '';
            }
        } catch (e) {
            log.warn('Failed to resolve proxy context path; using empty prefix:', e);
            _proxyContextPath = '';
        } finally {
            _proxyContextPathPromise = null;
        }
        return _proxyContextPath;
    })();

    return _proxyContextPathPromise;
};

/**
 * Prepend the resolved reverse-proxy context path to a host-absolute NiFi REST
 * API path. Reads the cached prefix synchronously (defaulting to '' until
 * getProxyContextPath() has resolved it), so callers must prime the cache via
 * getProxyContextPath() at startup for proxied deployments. WAR-relative paths
 * (BASE_URL-based, no leading slash) are NOT routed through here — they already
 * resolve relative to the proxied WAR context.
 *
 * @param {string} absolutePath  a host-absolute path beginning with '/nifi-api'
 * @returns {string}  the prefixed path
 */
const nifiApiUrl = (absolutePath) => `${_proxyContextPath || ''}${absolutePath}`;

/** Reset the cached proxy context path (and any in-flight fetch). Useful for testing. */
const resetProxyContextPath = () => { _proxyContextPath = null; _proxyContextPathPromise = null; };

/** Cached component detection results keyed by component ID. */
const _componentInfoCache = new Map();

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
        // Slice after the first '=' (the name/value separator) rather than split('='):
        // a base64 token may itself contain '=' padding, which split('=')[1] would
        // truncate. Slicing at indexOf('=') is robust regardless of whether cookieName
        // carries its own trailing '='.
        return match ? match.slice(match.indexOf('=') + 1) : null;
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
 * @param {Object} [opts={}]  extra options
 * @param {string} [opts.componentId]  explicit component ID for X-Processor-Id header
 * @returns {Promise<Object>}  parsed JSON response
 */
const request = async (method, url, body = null, { componentId } = {}) => {
    const headers = {};

    // Attach processor-id header for JWT endpoints
    if (url.includes('/jwt/')) {
        const pid = componentId || getComponentId();
        if (pid) headers['X-Processor-Id'] = pid;
    }

    // NiFi CSRF protection: double-submit cookie pattern requires
    // Request-Token header for state-changing methods
    if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
        const csrfToken = getCsrfToken();
        if (csrfToken) headers['Request-Token'] = csrfToken;
    }

    // Enforce the JSDoc-documented timeout: abort the fetch after REQUEST_TIMEOUT_MS so a
    // hung gateway call does not leave action buttons stuck disabled ("Sending…/Testing…").
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const opts = { method, headers, credentials: 'same-origin', signal: controller.signal };

    if (body) {
        headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }

    let res;
    try {
        res = await fetch(url, opts);
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(
                `Request timed out after ${REQUEST_TIMEOUT_MS} ms: ${method} ${url}`,
                { cause: error }
            );
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }

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
 * Auto-detects the component type by calling the WAR servlet with
 * the given component ID.
 *
 * @param {string} componentId  NiFi component UUID
 * @returns {Promise<{type: string, componentClass: string, apiPath: string, propsPath: string[]}>}
 */
const detectComponentType = async (componentId) => {
    assertValidUuid(componentId);
    const cached = _componentInfoCache.get(componentId);
    if (cached) return cached;

    // Call WAR servlet with the explicit component ID so the backend
    // resolves the correct component regardless of global state.
    const data = await request('GET', `${BASE_URL}/component-info`,
        null, { componentId });
    const info = {
        type: data.type,
        componentClass: data.componentClass,
        ...COMPONENT_TYPES[data.type]
    };
    _componentInfoCache.set(componentId, info);
    return info;
};

/**
 * Resets cached component info. Useful for testing.
 */
const resetComponentCache = () => { _componentInfoCache.clear(); };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Validate a JWKS URL */
export const validateJwksUrl = (jwksUrl) =>
    request('POST', `${BASE_URL}/validate-jwks-url`, { jwksUrl });

/** Validate a local JWKS file */
export const validateJwksFile = (filePath) =>
    request('POST', `${BASE_URL}/validate-jwks-file`, { jwksFilePath: filePath });

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
    assertValidUuid(componentId);
    await getProxyContextPath();
    const info = await detectComponentType(componentId);
    const data = await request('GET', nifiApiUrl(`${info.apiPath}/${componentId}`));
    // Navigate propsPath to extract properties: e.g. ['component', 'config', 'properties']
    let props = data;
    for (const key of info.propsPath) { props = props?.[key]; }
    return { properties: props || {}, revision: data.revision };
};

/**
 * Update component properties (fetches current revision first).
 * For processors, uses a stop → update → start cycle because NiFi
 * rejects property updates on RUNNING processors (HTTP 409).
 *
 * @param {string} componentId  NiFi component UUID
 * @param {Object} properties   properties to update
 * @returns {Promise<Object>}  updated component response
 */
export const updateComponentProperties = async (componentId, properties) => {
    assertValidUuid(componentId);
    await getProxyContextPath();
    const info = await detectComponentType(componentId);

    if (info.type === 'PROCESSOR') {
        return updateProcessorWithStopStart(componentId, info, properties);
    }

    const current = await request('GET', nifiApiUrl(`${info.apiPath}/${componentId}`));
    return request('PUT', nifiApiUrl(`${info.apiPath}/${componentId}`), {
        revision: current.revision,
        component: { id: componentId, properties }
    });
};

/**
 * Build the PUT body using propsPath so the nested structure matches NiFi's DTO.
 * PROCESSOR: { id, config: { properties } }
 * CONTROLLER_SERVICE: { id, properties }
 *
 * @param {string} componentId
 * @param {string[]} propsPath  e.g. ['component', 'config', 'properties']
 * @param {Object} properties
 * @returns {Object}  the component body for the PUT request
 */
const buildComponentBody = (componentId, propsPath, properties) => {
    const componentBody = { id: componentId };
    let target = componentBody;
    // Skip 'component' (first) and 'properties' (last) — build intermediate nesting
    for (const segment of propsPath.slice(1, -1)) {
        target[segment] = {};
        target = target[segment];
    }
    target.properties = properties;
    return componentBody;
};

/**
 * Stop a RUNNING processor, update properties, then restart.
 * If the processor is already stopped, just updates and restarts.
 */
const updateProcessorWithStopStart = async (componentId, info, properties) => {
    // Settle-at-entry: wait for a STABLE run state (RUNNING or STOPPED) before
    // reading run state or mutating. A prior mutation on this same processor
    // (e.g. add-route then edit-route then delete-route in quick succession)
    // restarts it and returns WITHOUT awaiting the restart, so this mutation can
    // begin while that restart is still in flight (a transitional Starting/
    // Stopping state). Settling here — rather than awaiting the restart at the
    // END of the previous mutation — guarantees the stop/PUT below never races
    // an in-flight restart, without adding end-of-function latency that would
    // block the caller's form-close (saveRoute) or the delete's own row-removal.
    const current = await waitForStableProcessorState(componentId, info);
    // The processor is now in a stable terminal state, so an exact-match check is
    // sufficient — no transitional (Starting/Stopping) state can be observed here.
    const runStatus = current.component?.status?.runStatus;
    const state = current.component?.state;
    const wasRunning = runStatus === 'Running' || state === 'RUNNING';

    // Stop the processor if running
    if (wasRunning) {
        await updateProcessorRunStatus(componentId, 'STOPPED', current.revision);
        await waitForProcessorState(componentId, info, 'STOPPED');
    }

    // Fetch fresh revision after state change
    const fresh = wasRunning
        ? await request('GET', nifiApiUrl(`${info.apiPath}/${componentId}`))
        : current;

    // Preserve autoTerminatedRelationships so NiFi doesn't reset them
    const autoTerminated = fresh.component?.config?.autoTerminatedRelationships || [];
    const componentBody = buildComponentBody(componentId, info.propsPath, properties);
    if (componentBody.config) {
        componentBody.config.autoTerminatedRelationships = autoTerminated;
    }

    let result;
    try {
        result = await request('PUT', nifiApiUrl(`${info.apiPath}/${componentId}`), {
            revision: fresh.revision,
            component: componentBody
        });
    } finally {
        // Always restart if it was running, even if the update failed
        if (wasRunning) {
            try {
                await autoTerminateStaleRelationships(componentId, info);
                const latest = await request('GET', nifiApiUrl(`${info.apiPath}/${componentId}`));
                await updateProcessorRunStatus(componentId, 'RUNNING', latest.revision);
            } catch (e) { log.warn('Failed to restart processor after property update:', e); }
        }
    }
    return result;
};

/**
 * Update a processor's run status (RUNNING or STOPPED).
 */
const updateProcessorRunStatus = (componentId, state, revision) => {
    assertValidUuid(componentId, 'Processor ID');
    return request('PUT', nifiApiUrl(`/nifi-api/processors/${componentId}/run-status`), {
        revision,
        state
    });
};

/**
 * Poll until the processor reaches the desired state (max ~10s).
 */
const waitForProcessorState = async (componentId, info, desiredState) => {
    const maxAttempts = 20;
    const delayMs = 500;
    for (let i = 0; i < maxAttempts; i++) {
        const data = await request('GET', nifiApiUrl(`${info.apiPath}/${componentId}`));
        if (data.component?.state === desiredState) return;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(`Processor did not reach state '${desiredState}' within ${maxAttempts * delayMs / 1000} seconds.`);
};

/**
 * Poll until the processor reports a STABLE terminal run state — RUNNING or
 * STOPPED — as opposed to a transitional Starting/Stopping state, then return
 * the settled GET response (needed for its revision and run state). Uses the
 * same bounding as waitForProcessorState (20 × 500ms). A processor already in a
 * stable state returns on the first GET with no extra delay (the common case is
 * not slowed); only a processor caught mid-transition incurs polling.
 *
 * NiFi reports run state in two shapes: component.state uses UPPERCASE
 * (RUNNING/STOPPED/STARTING/STOPPING) and component.status.runStatus uses
 * TitleCase (Running/Stopped/Starting/Stopping). Either reaching a stable value
 * counts as settled.
 *
 * @param {string} componentId  NiFi processor UUID
 * @param {Object} info  component type descriptor (apiPath, propsPath)
 * @returns {Promise<Object>}  the settled GET response
 */
const waitForStableProcessorState = async (componentId, info) => {
    const maxAttempts = 20;
    const delayMs = 500;
    const isStable = (data) => {
        const state = data.component?.state;
        const runStatus = data.component?.status?.runStatus;
        return state === 'RUNNING' || state === 'STOPPED' ||
            runStatus === 'Running' || runStatus === 'Stopped';
    };
    for (let i = 0; i < maxAttempts; i++) {
        const data = await request('GET', nifiApiUrl(`${info.apiPath}/${componentId}`));
        if (isStable(data)) return data;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(`Processor did not reach a stable state (RUNNING or STOPPED) within ${maxAttempts * delayMs / 1000} seconds.`);
};

/**
 * After a property update, auto-terminate only *stale* unconnected relationships
 * (from removed routes). Newly added route relationships are left unconnected so
 * the user can wire them on the NiFi canvas.
 *
 * Stale = relationship exists but no restapi.*.success-outcome property references it.
 */
const autoTerminateStaleRelationships = async (componentId, info) => {
    const proc = await request('GET', nifiApiUrl(`${info.apiPath}/${componentId}`));
    const errors = proc.component?.validationErrors || [];
    // Parse relationship names from validation errors like:
    // "'Relationship foo' is invalid because Relationship 'foo' is not connected..."
    const unconnected = errors
        .filter((e) => e.includes('is not connected') && e.includes('is not auto-terminated'))
        .map((e) => {
            const match = e.match(/Relationship '([^']+)'/);
            return match ? match[1] : null;
        })
        .filter(Boolean);

    if (unconnected.length === 0) return;

    // Determine which relationships are backed by current route properties
    const props = proc.component?.config?.properties || {};
    const activeOutcomes = new Set(
        Object.entries(props)
            .filter(([k]) => k.endsWith('.success-outcome'))
            .map(([, v]) => v)
            .filter(Boolean)
    );

    // Only auto-terminate stale relationships (no matching success-outcome)
    const stale = unconnected.filter((rel) => !activeOutcomes.has(rel));
    if (stale.length === 0) return;

    const current = proc.component?.config?.autoTerminatedRelationships || [];
    const updated = [...new Set([...current, ...stale])];
    await request('PUT', nifiApiUrl(`${info.apiPath}/${componentId}`), {
        revision: proc.revision,
        component: { id: componentId, config: { autoTerminatedRelationships: updated } }
    });
};

/**
 * Get the set of relationship names that are connected to downstream components
 * on the NiFi canvas for a given processor.
 *
 * @param {string} componentId  processor ID
 * @returns {Promise<Set<string>>}  set of connected relationship names
 */
export const getConnectedRelationships = async (componentId) => {
    assertValidUuid(componentId, 'Processor ID');
    await getProxyContextPath();
    try {
        const proc = await request('GET', nifiApiUrl(`/nifi-api/processors/${componentId}`));
        const pgId = proc.component?.parentGroupId;
        if (!pgId) return new Set();
        const connData = await request('GET', nifiApiUrl(`/nifi-api/process-groups/${pgId}/connections`));
        const connections = connData.connections || [];
        return new Set(
            connections
                .filter((c) => c.component?.source?.id === componentId)
                .flatMap((c) => c.component.selectedRelationships || [])
        );
    } catch (e) {
        log.warn('Failed to fetch connected relationships:', e);
        return new Set();
    }
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

/**
 * Fetch an OAuth token from the IDP via the backend proxy.
 *
 * @param {Object} payload  token request: {tokenEndpointUrl, grantType, clientId, clientSecret, username, password, scope}
 * @returns {Promise<Object>}  token response: {access_token, expires_in, idpStatus, error?}
 */
export const fetchOAuthToken = (payload) =>
    request('POST', `${BASE_URL}/gateway/token-fetch`, payload);

/**
 * Discover the token endpoint URL via OIDC discovery.
 *
 * @param {string} issuerUrl  the issuer URL
 * @returns {Promise<Object>}  discovery response: {tokenEndpoint}
 */
export const discoverTokenEndpoint = (issuerUrl) =>
    request('POST', `${BASE_URL}/gateway/discover-token-endpoint`, { issuerUrl });

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
    await getProxyContextPath();
    const data = await request('GET', nifiApiUrl(`${COMPONENT_TYPES.CONTROLLER_SERVICE.apiPath}/${csId}`));
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
    await getProxyContextPath();
    const current = await request('GET', nifiApiUrl(`${COMPONENT_TYPES.CONTROLLER_SERVICE.apiPath}/${csId}`));
    return request('PUT', nifiApiUrl(`${COMPONENT_TYPES.CONTROLLER_SERVICE.apiPath}/${csId}`), {
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
    await getProxyContextPath();
    const info = await detectComponentType(processorId);
    const data = await request('GET', nifiApiUrl(`${info.apiPath}/${processorId}`));
    let props = data;
    for (const key of info.propsPath) { props = props?.[key]; }
    const properties = props || {};
    return properties['rest.gateway.jwt.config.service']
        || properties['jwt.issuer.config.service']
        || null;
};

// Backward-compatible aliases
/** @deprecated Use getComponentProperties instead */
export const getProcessorProperties = async (processorId) => {
    assertValidUuid(processorId, 'Processor ID');
    await getProxyContextPath();
    return request('GET', nifiApiUrl(`/nifi-api/processors/${processorId}`));
};

/** @deprecated Use updateComponentProperties instead */
export const updateProcessorProperties = async (processorId, properties) => {
    assertValidUuid(processorId, 'Processor ID');
    await getProxyContextPath();
    const proc = await request('GET', nifiApiUrl(`/nifi-api/processors/${processorId}`));
    return request('PUT', nifiApiUrl(`/nifi-api/processors/${processorId}`), {
        revision: proc.revision,
        component: { id: processorId, config: { properties } }
    });
};

export {
    getComponentId, detectComponentType, resetComponentCache, getCsrfToken, COMPONENT_TYPES,
    resetProxyContextPath
};
