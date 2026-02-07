'use strict';

import {
    validateJwksUrl, validateJwksFile, validateJwksContent,
    verifyToken, getSecurityMetrics,
    getProcessorProperties, updateProcessorProperties
} from '../../main/webapp/js/api.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    // Reset fetch mock and location
    globalThis.fetch = jest.fn();
    delete globalThis.jwtAuthConfig;
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
// getSecurityMetrics
// ---------------------------------------------------------------------------

describe('getSecurityMetrics', () => {
    test('sends GET request', async () => {
        mockJsonResponse({ totalTokensValidated: 100 });

        const result = await getSecurityMetrics();

        const [url, opts] = globalThis.fetch.mock.calls[0];
        expect(url).toBe('nifi-api/processors/jwt/metrics');
        expect(opts.method).toBe('GET');
        expect(result.totalTokensValidated).toBe(100);
    });
});

// ---------------------------------------------------------------------------
// getProcessorProperties
// ---------------------------------------------------------------------------

describe('getProcessorProperties', () => {
    test('sends GET with processor ID', async () => {
        mockJsonResponse({ revision: { version: 1 }, properties: {} });

        const result = await getProcessorProperties('proc-123');

        expect(globalThis.fetch.mock.calls[0][0]).toBe('nifi-api/processors/proc-123');
        expect(result.revision.version).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// updateProcessorProperties
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
        expect(globalThis.fetch.mock.calls[0][0]).toBe('nifi-api/processors/proc-123');
        expect(globalThis.fetch.mock.calls[0][1].method).toBe('GET');

        // Second call: PUT
        const [putUrl, putOpts] = globalThis.fetch.mock.calls[1];
        expect(putUrl).toBe('nifi-api/processors/proc-123');
        expect(putOpts.method).toBe('PUT');
        const putBody = JSON.parse(putOpts.body);
        expect(putBody.revision.version).toBe(3);
        expect(putBody.component.properties['issuer.keycloak.issuer']).toBe(
            'https://auth.example.com'
        );
    });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
    test('throws on non-ok response', async () => {
        mockErrorResponse(500, 'Internal Server Error');

        await expect(getSecurityMetrics()).rejects.toThrow('HTTP 500');
    });

    test('includes status on error', async () => {
        mockErrorResponse(404, 'Not Found');

        const err = await getSecurityMetrics().catch((e) => e);
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

        await getSecurityMetrics();

        const headers = globalThis.fetch.mock.calls[0][1].headers;
        expect(headers['X-Processor-Id']).toBe('test-proc-id');
    });

    test('extracts processorId from URL query param', async () => {
        globalThis.location = {
            search: '?id=url-proc-id',
            href: 'https://nifi:8443/nifi?id=url-proc-id'
        };
        mockJsonResponse({});

        await getSecurityMetrics();

        const headers = globalThis.fetch.mock.calls[0][1].headers;
        expect(headers['X-Processor-Id']).toBe('url-proc-id');
    });
});
