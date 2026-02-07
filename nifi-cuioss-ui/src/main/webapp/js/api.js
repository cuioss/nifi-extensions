'use strict';

/**
 * Thin fetch-based API client for JWT validation operations.
 *
 * @module js/api
 */

const BASE_URL = 'nifi-api/processors/jwt';

/**
 * Returns the NiFi processor ID from the current URL's query string.
 * @returns {string}
 */
const getProcessorId = () => {
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
        const pid = getProcessorId();
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

/** Fetch processor configuration */
export const getProcessorProperties = (processorId) =>
    request('GET', `nifi-api/processors/${processorId}`);

/** Update processor properties (fetches current revision first) */
export const updateProcessorProperties = async (processorId, properties) => {
    const proc = await getProcessorProperties(processorId);
    return request('PUT', `nifi-api/processors/${processorId}`, {
        revision: proc.revision,
        component: { id: processorId, properties }
    });
};
