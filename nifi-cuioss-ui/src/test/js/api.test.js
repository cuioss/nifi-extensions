'use strict';

import {
    validateJwksUrl, validateJwksFile, validateJwksContent,
    verifyToken,
    getProcessorProperties, updateProcessorProperties,
    getComponentProperties, updateComponentProperties,
    getComponentId, detectComponentType, resetComponentCache,
    fetchGatewayApi, sendGatewayTestRequest, getCsrfToken, COMPONENT_TYPES
} from '../../main/webapp/js/api.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    // Reset fetch mock and location
    globalThis.fetch = jest.fn();
    delete globalThis.jwtAuthConfig;
    resetComponentCache();
    // Provide a default location for processor ID extraction
    Object.defineProperty(globalThis, 'location', {
        value: { search: '', href: 'https://nifi:8443/nifi' },
        writable: true,
        configurable: true
    });
});

const mockJsonResponse = (data, ok = true, status = 200) => {
    globalThis.fetch.mockResolvedValueOnce({
        ok,
        status,
        statusText: ok ? 'OK' : 'Error',
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data))
    });
};

const mockErrorResponse = (status, body = 'Error') => {
    globalThis.fetch.mockResolvedValueOnce({
        ok: false,
        status,
        statusText: 'Error',
        json: () => Promise.reject(new Error('not json')),
        text: () => Promise.resolve(body)
    });
};

// ---------------------------------------------------------------------------
// validateJwksUrl
// ---------------------------------------------------------------------------

describe('validateJwksUrl', () => {
    test('sends POST with correct body', async () => {
        mockJsonResponse({ valid: true, keyCount: 2 });

        const result = await validateJwksUrl('https://auth.example.com/jwks');

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        const [url, opts] = globalThis.fetch.mock.calls[0];
        expect(url).toBe('nifi-api/processors/jwt/validate-jwks-url');
        expect(opts.method).toBe('POST');
        expect(JSON.parse(opts.body)).toEqual({ jwksUrl: 'https://auth.example.com/jwks' });
        expect(result).toEqual({ valid: true, keyCount: 2 });
    });
});

// ---------------------------------------------------------------------------
// validateJwksFile
// ---------------------------------------------------------------------------

describe('validateJwksFile', () => {
    test('sends POST with filePath', async () => {
        mockJsonResponse({ valid: true });

        await validateJwksFile('/path/to/jwks.json');

        const [url, opts] = globalThis.fetch.mock.calls[0];
        expect(url).toBe('nifi-api/processors/jwt/validate-jwks-file');
        expect(JSON.parse(opts.body)).toEqual({ filePath: '/path/to/jwks.json' });
    });
});

// ---------------------------------------------------------------------------
// validateJwksContent
// ---------------------------------------------------------------------------

describe('validateJwksContent', () => {
    test('sends POST with content', async () => {
        mockJsonResponse({ valid: true });

        await validateJwksContent('{"keys":[]}');

        const [url, opts] = globalThis.fetch.mock.calls[0];
        expect(url).toBe('nifi-api/processors/jwt/validate-jwks-content');
        expect(JSON.parse(opts.body)).toEqual({ jwksContent: '{"keys":[]}' });
    });
});

// ---------------------------------------------------------------------------
// verifyToken
// ---------------------------------------------------------------------------

describe('verifyToken', () => {
    test('sends POST with token', async () => {
        mockJsonResponse({ valid: true, decoded: { header: {}, payload: {} } });

        const result = await verifyToken('eyJhbGci...');

        const [url, opts] = globalThis.fetch.mock.calls[0];
        expect(url).toBe('nifi-api/processors/jwt/verify-token');
        expect(JSON.parse(opts.body)).toEqual({ token: 'eyJhbGci...' });
        expect(result.valid).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// getProcessorProperties (backward-compatible)
// ---------------------------------------------------------------------------

describe('getProcessorProperties', () => {
    test('sends GET with processor ID using absolute path', async () => {
        mockJsonResponse({ revision: { version: 1 }, properties: {} });

        const result = await getProcessorProperties('proc-123');

        expect(globalThis.fetch.mock.calls[0][0]).toBe('/nifi-api/processors/proc-123');
        expect(result.revision.version).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// updateProcessorProperties (backward-compatible)
// ---------------------------------------------------------------------------

describe('updateProcessorProperties', () => {
    test('fetches current revision then sends PUT', async () => {
        // First call: GET current processor
        mockJsonResponse({ revision: { version: 3 }, component: { id: 'proc-123' } });
        // Second call: PUT update
        mockJsonResponse({ revision: { version: 4 } });

        const result = await updateProcessorProperties('proc-123', {
            'issuer.keycloak.issuer': 'https://auth.example.com'
        });

        expect(globalThis.fetch).toHaveBeenCalledTimes(2);

        // First call: GET
        expect(globalThis.fetch.mock.calls[0][0]).toBe('/nifi-api/processors/proc-123');
        expect(globalThis.fetch.mock.calls[0][1].method).toBe('GET');

        // Second call: PUT
        const [putUrl, putOpts] = globalThis.fetch.mock.calls[1];
        expect(putUrl).toBe('/nifi-api/processors/proc-123');
        expect(putOpts.method).toBe('PUT');
        const putBody = JSON.parse(putOpts.body);
        expect(putBody.revision.version).toBe(3);
        expect(putBody.component.properties['issuer.keycloak.issuer']).toBe(
            'https://auth.example.com'
        );
    });
});

// ---------------------------------------------------------------------------
// detectComponentType
// ---------------------------------------------------------------------------

describe('detectComponentType', () => {
    test('should detect processor type via WAR servlet', async () => {
        globalThis.jwtAuthConfig = { processorId: 'comp-123' };
        mockJsonResponse({
            type: 'PROCESSOR',
            componentClass: 'de.cuioss.nifi.processors.auth.MultiIssuerJWTTokenAuthenticator'
        });

        const info = await detectComponentType('comp-123');

        expect(info.type).toBe('PROCESSOR');
        expect(info.componentClass).toBe(
            'de.cuioss.nifi.processors.auth.MultiIssuerJWTTokenAuthenticator'
        );
        expect(info.apiPath).toBe('/nifi-api/processors');
        expect(globalThis.fetch.mock.calls[0][0]).toBe(
            'nifi-api/processors/jwt/component-info'
        );
    });

    test('should detect controller service type via WAR servlet', async () => {
        globalThis.jwtAuthConfig = { processorId: 'cs-456' };
        mockJsonResponse({
            type: 'CONTROLLER_SERVICE',
            componentClass: 'de.cuioss.nifi.jwt.config.StandardJwtIssuerConfigService'
        });

        const info = await detectComponentType('cs-456');

        expect(info.type).toBe('CONTROLLER_SERVICE');
        expect(info.componentClass).toBe(
            'de.cuioss.nifi.jwt.config.StandardJwtIssuerConfigService'
        );
        expect(info.apiPath).toBe('/nifi-api/controller-services');
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    test('should cache detection result', async () => {
        globalThis.jwtAuthConfig = { processorId: 'comp-123' };
        mockJsonResponse({ type: 'PROCESSOR', componentClass: 'SomeProcessor' });

        await detectComponentType('comp-123');
        const cached = await detectComponentType('comp-123');

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(cached.type).toBe('PROCESSOR');
    });

    test('should propagate errors from component-info endpoint', async () => {
        globalThis.jwtAuthConfig = { processorId: 'comp-123' };
        mockErrorResponse(500, 'Server Error');

        await expect(detectComponentType('comp-123')).rejects.toThrow('HTTP 500');
    });
});

// ---------------------------------------------------------------------------
// getComponentProperties
// ---------------------------------------------------------------------------

describe('getComponentProperties', () => {
    test('should extract processor properties via propsPath', async () => {
        globalThis.jwtAuthConfig = { processorId: 'proc-123' };
        // Detection call
        mockJsonResponse({ type: 'PROCESSOR', componentClass: 'SomeProcessor' });
        // Properties call — NiFi REST API response structure
        mockJsonResponse({
            revision: { version: 1 },
            component: { config: { properties: { 'key1': 'val1' } } }
        });

        const result = await getComponentProperties('proc-123');

        expect(result.properties).toEqual({ 'key1': 'val1' });
        expect(result.revision.version).toBe(1);
        expect(globalThis.fetch.mock.calls[1][0]).toBe('/nifi-api/processors/proc-123');
    });

    test('should extract CS properties via propsPath', async () => {
        globalThis.jwtAuthConfig = { processorId: 'cs-456' };
        // Detection call
        mockJsonResponse({ type: 'CONTROLLER_SERVICE', componentClass: 'SomeCS' });
        // Properties call — CS response structure
        mockJsonResponse({
            revision: { version: 1 },
            component: { properties: { 'csKey': 'csVal' } }
        });

        const result = await getComponentProperties('cs-456');

        expect(result.properties).toEqual({ 'csKey': 'csVal' });
        expect(globalThis.fetch.mock.calls[1][0]).toBe('/nifi-api/controller-services/cs-456');
    });

    test('should return empty properties when path yields null', async () => {
        globalThis.jwtAuthConfig = { processorId: 'proc-123' };
        mockJsonResponse({ type: 'PROCESSOR', componentClass: 'SomeProcessor' });
        mockJsonResponse({ revision: { version: 1 }, component: {} });

        const result = await getComponentProperties('proc-123');

        expect(result.properties).toEqual({});
    });
});

// ---------------------------------------------------------------------------
// updateComponentProperties
// ---------------------------------------------------------------------------

describe('updateComponentProperties', () => {
    test('should use correct API path for update', async () => {
        globalThis.jwtAuthConfig = { processorId: 'proc-123' };
        // Detection
        mockJsonResponse({ type: 'PROCESSOR', componentClass: 'SomeProcessor' });
        // GET current
        mockJsonResponse({ revision: { version: 5 }, component: { id: 'proc-123' } });
        // PUT update
        mockJsonResponse({ revision: { version: 6 } });

        await updateComponentProperties('proc-123', { 'key': 'value' });

        // 3 fetch calls: detect + GET + PUT
        expect(globalThis.fetch).toHaveBeenCalledTimes(3);
        const [putUrl, putOpts] = globalThis.fetch.mock.calls[2];
        expect(putUrl).toBe('/nifi-api/processors/proc-123');
        expect(putOpts.method).toBe('PUT');
        const putBody = JSON.parse(putOpts.body);
        expect(putBody.revision.version).toBe(5);
        expect(putBody.component.properties.key).toBe('value');
    });
});

// ---------------------------------------------------------------------------
// fetchGatewayApi
// ---------------------------------------------------------------------------

describe('fetchGatewayApi', () => {
    test('should call gateway proxy for /config', async () => {
        globalThis.jwtAuthConfig = { processorId: 'gw-proc-id' };
        mockJsonResponse({ port: 9443, routes: [] });

        const result = await fetchGatewayApi('/config');

        expect(globalThis.fetch.mock.calls[0][0]).toBe(
            'nifi-api/processors/jwt/gateway/config'
        );
        expect(result.port).toBe(9443);
    });

    test('should call gateway proxy for /metrics', async () => {
        globalThis.jwtAuthConfig = { processorId: 'gw-proc-id' };
        mockJsonResponse({ tokenValidation: {}, httpSecurity: {} });

        await fetchGatewayApi('/metrics');

        expect(globalThis.fetch.mock.calls[0][0]).toBe(
            'nifi-api/processors/jwt/gateway/metrics'
        );
    });
});

describe('sendGatewayTestRequest', () => {
    test('should POST to gateway test endpoint', async () => {
        globalThis.jwtAuthConfig = { processorId: 'gw-proc-id' };
        mockJsonResponse({ status: 200, body: '{"ok":true}', headers: {} });

        const payload = { path: '/api/users', method: 'GET', headers: {}, body: null };
        const result = await sendGatewayTestRequest(payload);

        expect(globalThis.fetch.mock.calls[0][0]).toBe(
            'nifi-api/processors/jwt/gateway/test'
        );
        expect(globalThis.fetch.mock.calls[0][1].method).toBe('POST');
        expect(result.status).toBe(200);
    });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
    test('throws on non-ok response', async () => {
        mockErrorResponse(500, 'Internal Server Error');

        await expect(verifyToken('test')).rejects.toThrow('HTTP 500');
    });

    test('includes status on error', async () => {
        mockErrorResponse(404, 'Not Found');

        const err = await verifyToken('test').catch((e) => e);
        expect(err.status).toBe(404);
        expect(err.responseText).toBe('Not Found');
    });
});

// ---------------------------------------------------------------------------
// X-Processor-Id header
// ---------------------------------------------------------------------------

describe('processor ID header', () => {
    test('adds X-Processor-Id header when processorId is available', async () => {
        globalThis.jwtAuthConfig = { processorId: 'test-proc-id' };
        mockJsonResponse({});

        await verifyToken('test');

        const headers = globalThis.fetch.mock.calls[0][1].headers;
        expect(headers['X-Processor-Id']).toBe('test-proc-id');
    });

    test('extracts processorId from URL query param', async () => {
        globalThis.location = {
            search: '?id=url-proc-id',
            href: 'https://nifi:8443/nifi?id=url-proc-id'
        };
        mockJsonResponse({});

        await verifyToken('test');

        const headers = globalThis.fetch.mock.calls[0][1].headers;
        expect(headers['X-Processor-Id']).toBe('url-proc-id');
    });
});

// ---------------------------------------------------------------------------
// COMPONENT_TYPES export
// ---------------------------------------------------------------------------

describe('COMPONENT_TYPES', () => {
    test('should expose processor and controller service types with absolute paths', () => {
        expect(COMPONENT_TYPES.PROCESSOR.apiPath).toBe('/nifi-api/processors');
        expect(COMPONENT_TYPES.CONTROLLER_SERVICE.apiPath).toBe('/nifi-api/controller-services');
    });

    test('should have correct property paths', () => {
        expect(COMPONENT_TYPES.PROCESSOR.propsPath).toEqual(['component', 'config', 'properties']);
        expect(COMPONENT_TYPES.CONTROLLER_SERVICE.propsPath).toEqual(['component', 'properties']);
    });
});

// ---------------------------------------------------------------------------
// getComponentId
// ---------------------------------------------------------------------------

describe('getComponentId', () => {
    test('returns cached processorId from jwtAuthConfig', () => {
        globalThis.jwtAuthConfig = { processorId: 'cached-id' };
        expect(getComponentId()).toBe('cached-id');
    });

    test('extracts id from URL search params', () => {
        globalThis.location = { search: '?id=url-id', href: 'https://nifi:8443' };
        expect(getComponentId()).toBe('url-id');
    });

    test('returns empty string when no ID available', () => {
        globalThis.location = { search: '', href: 'https://nifi:8443' };
        expect(getComponentId()).toBe('');
    });
});

// ---------------------------------------------------------------------------
// CSRF token handling
// ---------------------------------------------------------------------------

describe('CSRF token handling', () => {
    let cookieDescriptor;

    beforeEach(() => {
        cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
            || Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
    });

    afterEach(() => {
        if (cookieDescriptor) {
            Object.defineProperty(document, 'cookie', cookieDescriptor);
        }
    });

    test('getCsrfToken extracts token from document.cookie', () => {
        Object.defineProperty(document, 'cookie', {
            get: () => 'other=val; __Secure-Request-Token=csrf-abc-123; session=xyz',
            configurable: true
        });
        expect(getCsrfToken()).toBe('csrf-abc-123');
    });

    test('getCsrfToken returns null when cookie is absent', () => {
        Object.defineProperty(document, 'cookie', {
            get: () => 'session=xyz; other=val',
            configurable: true
        });
        expect(getCsrfToken()).toBeNull();
    });

    test('getCsrfToken returns null on empty cookies', () => {
        Object.defineProperty(document, 'cookie', {
            get: () => '',
            configurable: true
        });
        expect(getCsrfToken()).toBeNull();
    });

    test('adds Request-Token header for POST requests when cookie exists', async () => {
        Object.defineProperty(document, 'cookie', {
            get: () => '__Secure-Request-Token=test-csrf-token',
            configurable: true
        });
        mockJsonResponse({ valid: true });

        await verifyToken('test');

        const headers = globalThis.fetch.mock.calls[0][1].headers;
        expect(headers['Request-Token']).toBe('test-csrf-token');
    });

    test('does not add Request-Token for GET requests', async () => {
        Object.defineProperty(document, 'cookie', {
            get: () => '__Secure-Request-Token=test-csrf-token',
            configurable: true
        });
        globalThis.jwtAuthConfig = { processorId: 'comp-123' };
        mockJsonResponse({ type: 'PROCESSOR', componentClass: 'Test' });

        await detectComponentType('comp-123');

        const headers = globalThis.fetch.mock.calls[0][1].headers;
        expect(headers['Request-Token']).toBeUndefined();
    });

    test('gracefully handles missing CSRF cookie for POST', async () => {
        Object.defineProperty(document, 'cookie', {
            get: () => '',
            configurable: true
        });
        mockJsonResponse({ valid: true });

        await verifyToken('test');

        const headers = globalThis.fetch.mock.calls[0][1].headers;
        expect(headers['Request-Token']).toBeUndefined();
    });
});
