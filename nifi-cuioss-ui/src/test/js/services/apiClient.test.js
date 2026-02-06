/**
 * Tests for the API Client service.
 */
let apiClient; // To be required in beforeEach

// Mock SUT (apiClient.js) and its dependencies

// nfCommon is used by the SUT, so mock it.
// apiClient.js is the SUT, so we DO NOT mock it. We import the actual.

// Mock fetch API to work like jQuery ajax for test compatibility
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Helper functions to make fetch mock work like ajax mock
const mockFetchSuccess = (data) => {
    mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data))
    });
};

const mockFetchError = (errorObj) => {
    mockFetch.mockResolvedValue({
        ok: false,
        status: errorObj.status || 500,
        statusText: errorObj.statusText || 'Unknown error',
        json: () => Promise.reject(new Error('Response not JSON')),
        text: () => Promise.resolve(errorObj.responseText || '')
    });
};

// Create ajax-like mock that maps to fetch
const mockAjax = {
    mockResolvedValue: mockFetchSuccess,
    mockRejectedValue: mockFetchError,
    mockResolvedValueOnce: (data) => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: () => Promise.resolve(data),
            text: () => Promise.resolve(JSON.stringify(data))
        });
    },
    mockRejectedValueOnce: (errorObj) => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: errorObj.status || 500,
            statusText: errorObj.statusText || 'Unknown error',
            json: () => Promise.reject(new Error('Response not JSON')),
            text: () => Promise.resolve(errorObj.responseText || '')
        });
    },
    mockClear: () => mockFetch.mockClear(),
    mockImplementation: (impl) => mockFetch.mockImplementation(impl),
    mock: mockFetch.mock
};

const mockI18n = {
    'error.defaultUserMessage': 'An unexpected error has occurred. Please try again later or contact support if the issue persists.'
};
jest.mock('nf.Common', () => ({
    getI18n: jest.fn()
}));


describe('apiClient', () => {
    'use strict';

    let successCallback;
    let errorCallback;
    let consoleErrorSpy;
    let localNfCommon;

    beforeEach(() => {
        jest.resetModules(); // This is important
        apiClient = require('services/apiClient'); // Re-require SUT after resetModules
        localNfCommon = require('nf.Common'); // Mocked at top level
        localNfCommon.getI18n.mockReturnValue(mockI18n); // Configure the mock

        // We clear the mock for 'fetch' which apiClient.js uses.
        mockFetch.mockClear();

        successCallback = jest.fn();
        errorCallback = jest.fn();

        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Default mock for fetch-based implementation
        mockAjax.mockImplementation(() => {
            return Promise.resolve({
                ok: true,
                status: 200,
                statusText: 'OK',
                json: () => Promise.resolve({}),
                text: () => Promise.resolve('{}')
            });
        });
    });

    afterEach(() => {
        if (consoleErrorSpy) {
            consoleErrorSpy.mockRestore();
        }
        jest.useRealTimers();
    });

    describe('validateJwksUrl', () => {
        const jwksUrl = 'https://example.com/.well-known/jwks.json';

        it('should make a POST request and resolve on success', async () => {
            const mockResponseData = { valid: true, details: 'JWKS URL is valid' };
            mockAjax.mockResolvedValue(mockResponseData);

            const promise = apiClient.validateJwksUrl(jwksUrl);

            await expect(promise).resolves.toEqual(mockResponseData);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/validate-jwks-url'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ jwksUrl: jwksUrl }),
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    })
                })
            );
        });

        it('should reject with a standardized error object on AJAX failure', async () => {
            const mockJqXHR = { status: 500, statusText: 'Server Error', responseText: 'Server Message' };
            mockAjax.mockRejectedValue(mockJqXHR);

            const promise = apiClient.validateJwksUrl(jwksUrl);

            await expect(promise).rejects.toEqual({
                status: 500,
                statusText: 'Server Error',
                responseText: 'Server Message'
            });
        });

        it('should correctly use statusText from errorThrown or textStatus if jqXHR.statusText is missing', async () => {
            const mockJqXHRNoStatusText = { status: 404, responseText: 'Not Found Detail' };
            mockAjax.mockRejectedValue(mockJqXHRNoStatusText);
            const promise = apiClient.validateJwksUrl(jwksUrl);
            await expect(promise).rejects.toEqual({
                status: 404,
                statusText: 'Unknown error',
                responseText: 'Not Found Detail'
            });

            const mockJqXHRWithStatusText = { status: 403, statusText: 'Forbidden', responseText: 'Access Denied' };
            mockAjax.mockRejectedValue(mockJqXHRWithStatusText);
            const promise2 = apiClient.validateJwksUrl(jwksUrl);
            await expect(promise2).rejects.toEqual({
                status: 403,
                statusText: 'Forbidden',
                responseText: 'Access Denied'
            });
        });

        it('should use "Unknown error" from _createXhrErrorObject if statusText is missing (Promise)', async () => {
            const mockError = { status: 0, responseText: 'Network failed' }; // No statusText
            mockAjax.mockRejectedValue(mockError);
            await expect(apiClient.validateJwksUrl(jwksUrl)).rejects.toMatchObject({
                statusText: 'Unknown error',
                responseText: 'Network failed'
            });
        });
    });

    describe('getProcessorProperties', () => {
        const processorId = 'proc-id-get';
        const mockSuccessData = { component: { properties: { 'prop1': 'val1' } }, revision: { version: 1 } };

        it('should resolve with properties on successful GET', async () => {
            mockAjax.mockResolvedValue(mockSuccessData); // $.ajax().then() provides data directly
            const response = await apiClient.getProcessorProperties(processorId);
            expect(mockFetch).toHaveBeenCalledWith(`nifi-api/processors/${processorId}`, expect.objectContaining({ method: 'GET' }));
            expect(response).toEqual(mockSuccessData); // response is data itself
        });

        it('should reject with error on failed GET', async () => {
            const mockJqXHR = { status: 404, statusText: 'Not Found Error', responseText: 'Not Found' };
            mockAjax.mockRejectedValue(mockJqXHR);

            await expect(apiClient.getProcessorProperties(processorId)).rejects.toEqual(mockJqXHR);
            expect(mockFetch).toHaveBeenCalledWith(`nifi-api/processors/${processorId}`, expect.objectContaining({ method: 'GET' }));
        });
    });

    describe('updateProcessorProperties', () => {
        const processorId = 'proc-id-update';
        const propertiesToUpdate = { 'prop1': 'newVal' };

        const mockInitialRevision = { version: 1 };
        const mockInitialComponent = { id: processorId, properties: { 'prop1': 'initialVal' } };
        const mockGetResponse = { component: mockInitialComponent, revision: mockInitialRevision }; // Data for GET

        const mockPutResponseData = { component: { id: processorId, properties: propertiesToUpdate }, revision: { version: 2 } };

        it('should GET then PUT and resolve with updated properties on success', async () => {
            mockAjax.mockResolvedValueOnce(mockGetResponse); // For the initial GET (data directly)
            mockAjax.mockResolvedValueOnce(mockPutResponseData); // For the PUT (data directly)

            const response = await apiClient.updateProcessorProperties(processorId, propertiesToUpdate);

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(mockFetch.mock.calls[0]).toEqual([`nifi-api/processors/${processorId}`, expect.objectContaining({ method: 'GET' })]);
            expect(mockFetch.mock.calls[1]).toEqual([`nifi-api/processors/${processorId}`, expect.objectContaining({
                method: 'PUT',
                body: JSON.stringify({
                    revision: mockInitialRevision,
                    component: { id: processorId, properties: propertiesToUpdate }
                }),
                headers: expect.objectContaining({
                    'Content-Type': 'application/json'
                })
            })]);
            expect(response).toEqual(mockPutResponseData); // Response is data itself
        });

        it('should reject if initial GET fails', async () => {
            const mockJqXHR = { status: 500, statusText: 'GET Failed', responseText: 'GET Failed' };
            mockAjax.mockRejectedValueOnce(mockJqXHR); // Fail the GET

            await expect(apiClient.updateProcessorProperties(processorId, propertiesToUpdate)).rejects.toEqual(mockJqXHR);
            expect(mockFetch).toHaveBeenCalledTimes(1); // Only GET should be called
            expect(mockFetch.mock.calls[0]).toEqual([`nifi-api/processors/${processorId}`, expect.objectContaining({ method: 'GET' })]);
        });

        it('should reject if PUT fails', async () => {
            const mockJqXHR = { status: 500, statusText: 'PUT Failed', responseText: 'PUT Failed' };
            mockAjax.mockResolvedValueOnce(mockGetResponse); // GET succeeds
            mockAjax.mockRejectedValueOnce(mockJqXHR);   // PUT fails

            await expect(apiClient.updateProcessorProperties(processorId, propertiesToUpdate)).rejects.toEqual(mockJqXHR);
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    // The remaining functions (validateJwksFile, validateJwksContent, verifyToken, getSecurityMetrics)
    // follow a similar pattern to validateJwksUrl. Tests for these would involve:
    // 1. Calling the actual SUT function.
    // 2. Mocking `ajax` to resolve or reject.
    // 3. Asserting `successCallback` or `errorCallback` is called with correct arguments,
    //    including testing the `if (error.response)` and `else` branches in the SUT's catch block.
    // These are omitted for brevity but would be needed for full coverage.
    // The 'handleApiError edge cases' tests are effectively covered by testing the error paths
    // of each callback-based function properly.

    describe('validateJwksFile', () => {
        const filePath = '/path/to/jwks.json';

        it('should make a POST request and resolve on success', async () => {
            const mockResponseData = { valid: true, keys: 1 };
            mockAjax.mockResolvedValue(mockResponseData);

            const promise = apiClient.validateJwksFile(filePath);

            await expect(promise).resolves.toEqual(mockResponseData);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/validate-jwks-file'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ filePath: filePath }),
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    })
                })
            );
        });

        it('should reject with a standardized error object on AJAX failure', async () => {
            const mockJqXHR = { status: 500, statusText: 'Read Error', responseText: 'File not accessible' };
            mockAjax.mockRejectedValue(mockJqXHR);

            const promise = apiClient.validateJwksFile(filePath);

            await expect(promise).rejects.toEqual({
                status: 500,
                statusText: 'Read Error',
                responseText: 'File not accessible'
            });
        });
    });

    describe('validateJwksContent', () => {
        const jwksContent = '{"keys": [{"kty": "RSA", "kid": "key1"}]}';

        it('should make a POST request and resolve on success', async () => {
            const mockResponseData = { valid: true, keyCount: 1, jwks: {} };
            mockAjax.mockResolvedValue(mockResponseData);

            const promise = apiClient.validateJwksContent(jwksContent);

            await expect(promise).resolves.toEqual(mockResponseData);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/validate-jwks-content'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ jwksContent: jwksContent }),
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    })
                })
            );
        });

        it('should reject with a standardized error object on AJAX failure', async () => {
            const mockJqXHR = { status: 400, statusText: 'Invalid Content', responseText: 'Invalid JWKS format' };
            mockAjax.mockRejectedValue(mockJqXHR);

            const promise = apiClient.validateJwksContent(jwksContent);

            await expect(promise).rejects.toEqual({
                status: 400,
                statusText: 'Invalid Content',
                responseText: 'Invalid JWKS format'
            });
        });
    });

    describe('verifyToken', () => {
        const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';

        it('should make a POST request and resolve on success', async () => {
            const mockResponseData = {
                valid: true,
                claims: { sub: 'user123', iss: 'https://auth.example.com' },
                issuer: 'https://auth.example.com',
                exp: 1234567890,
                sub: 'user123',
                aud: ['api-audience']
            };
            mockAjax.mockResolvedValue(mockResponseData);

            const promise = apiClient.verifyToken(token);

            await expect(promise).resolves.toEqual(mockResponseData);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/verify-token'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ token: token }),
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    })
                })
            );
        });

        it('should reject with a standardized error object on AJAX failure', async () => {
            const mockJqXHR = { status: 401, statusText: 'Unauthorized', responseText: 'Invalid token signature' };
            mockAjax.mockRejectedValue(mockJqXHR);

            const promise = apiClient.verifyToken(token);

            await expect(promise).rejects.toEqual({
                status: 401,
                statusText: 'Unauthorized',
                responseText: 'Invalid token signature'
            });
        });
    });

    describe('getSecurityMetrics', () => {
        it('should make a GET request and resolve on success', async () => {
            const mockResponseData = {
                totalValidations: 1000,
                successfulValidations: 950,
                failedValidations: 50,
                issuerMetrics: { 'issuer1': { validations: 500, errors: 25 } },
                recentErrors: [],
                averageResponseTime: 150
            };
            mockAjax.mockResolvedValue(mockResponseData);

            const promise = apiClient.getSecurityMetrics();

            await expect(promise).resolves.toEqual(mockResponseData);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/metrics'),
                expect.objectContaining({
                    method: 'GET'
                })
            );
        });

        it('should reject with a standardized error object on AJAX failure', async () => {
            const mockJqXHR = { status: 503, statusText: 'Service Unavailable', responseText: 'Metrics service down' };
            mockAjax.mockRejectedValue(mockJqXHR);

            const promise = apiClient.getSecurityMetrics();

            await expect(promise).rejects.toEqual({
                status: 503,
                statusText: 'Service Unavailable',
                responseText: 'Metrics service down'
            });
        });
    });

    // Legacy callback API tests removed - only Promise-based APIs are now supported


    describe('_createXhrErrorObject specific scenarios (tested via public methods)', () => {
        const testUrl = 'any-url';

        it('Promise: should use "Unknown error" if statusText, errorThrown, and textStatus are all falsy', async () => {
            const mockError = { status: 0, responseText: '' };
            mockAjax.mockRejectedValue(mockError);
            await expect(apiClient.validateJwksUrl(testUrl)).rejects.toMatchObject({
                statusText: 'Unknown error'
            });
        });
    });

    // Note: The getAuthConfig function and auth header logic adds X-Processor-Id
    // when endpoint.includes('/jwt/'). With BASE_URL 'nifi-api/processors/jwt',
    // all JWT endpoints now correctly include '/jwt/' and receive auth headers.
});
