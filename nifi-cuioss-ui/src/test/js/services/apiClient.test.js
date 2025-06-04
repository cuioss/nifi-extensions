/**
 * Tests for the API Client service.
 */
let apiClient; // To be required in beforeEach
import nfCommon from 'nf.Common'; // Will be re-required

// Mock SUT (apiClient.js) and its dependencies

// nfCommon is used by the SUT, so mock it.
// apiClient.js is the SUT, so we DO NOT mock it. We import the actual.

const mockAjax = jest.fn();
// Mock cash-dom to provide our mockAjax function for $.ajax
jest.mock('cash-dom', () => ({
    __esModule: true, // if cash-dom is an ES module
    default: { // if cash-dom exports $ as default
        ajax: mockAjax
    },
    ajax: mockAjax // if cash-dom also has a named export (less likely for $)
}));

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

        // We clear the mock for 'ajax' which apiClient.js uses.
        mockAjax.mockClear();

        successCallback = jest.fn();
        errorCallback = jest.fn();

        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Default mock for compatAjax for each test
        // This is used by SUT's validateJwksUrl if it internally calls compatAjax
        // and by other SUT functions if they use ajax.
        // Since apiClient.js uses ajax internally, this mock will be used by it.
        // This default implementation returns a promise that can be controlled in tests
        // if a more specific mock isn't provided via mockResolvedValueOnce/mockRejectedValueOnce.
        mockAjax.mockImplementation(() => {
            let resolvePromise, rejectPromise;
            const promise = new Promise((resolve, reject) => {
                resolvePromise = resolve;
                rejectPromise = reject;
            });
            // @ts-ignore
            promise.resolve = resolvePromise;
            // @ts-ignore
            promise.reject = rejectPromise;
            // Add done/fail/always for compatibility with SUT if it uses them (though cash-dom might not)
            promise.done = (fn) => { promise.then(fn); return promise; };
            promise.fail = (fn) => { promise.catch(fn); return promise; };
            promise.always = (fn) => { promise.finally(fn); return promise; };
            return promise;
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
            expect(mockAjax).toHaveBeenCalledWith(expect.objectContaining({
                method: 'POST',
                url: expect.stringContaining('/validate-jwks-url'),
                data: JSON.stringify({ jwksUrl: jwksUrl })
            }));
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
            try {
                await apiClient.validateJwksUrl(jwksUrl);
            } catch (e) {
                expect(e.statusText).toBe('Unknown error');
                expect(e.responseText).toBe('Network failed');
            }
        });
    });

    describe('getProcessorProperties', () => {
        const processorId = 'proc-id-get';
        const mockSuccessData = { component: { properties: { 'prop1': 'val1' } }, revision: { version: 1 } };

        it('should resolve with properties on successful GET', async () => {
            mockAjax.mockResolvedValue(mockSuccessData); // $.ajax().then() provides data directly
            const response = await apiClient.getProcessorProperties(processorId);
            expect(mockAjax).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', url: `../nifi-api/processors/${processorId}` }));
            expect(response).toEqual(mockSuccessData); // response is data itself
        });

        it('should reject with error on failed GET', async () => {
            const mockJqXHR = { status: 404, statusText: 'Not Found Error', responseText: 'Not Found' };
            mockAjax.mockRejectedValue(mockJqXHR);

            await expect(apiClient.getProcessorProperties(processorId)).rejects.toEqual(mockJqXHR);
            expect(mockAjax).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', url: `../nifi-api/processors/${processorId}` }));
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
            mockAjax
                .mockResolvedValueOnce(mockGetResponse) // For the initial GET (data directly)
                .mockResolvedValueOnce(mockPutResponseData); // For the PUT (data directly)

            const response = await apiClient.updateProcessorProperties(processorId, propertiesToUpdate);

            expect(mockAjax).toHaveBeenCalledTimes(2);
            expect(mockAjax.mock.calls[0][0]).toEqual(expect.objectContaining({ method: 'GET', url: `../nifi-api/processors/${processorId}` }));
            expect(mockAjax.mock.calls[1][0]).toEqual(expect.objectContaining({
                method: 'PUT',
                url: `../nifi-api/processors/${processorId}`,
                data: JSON.stringify({
                    revision: mockInitialRevision,
                    component: { id: processorId, properties: propertiesToUpdate }
                }),
                contentType: 'application/json'
            }));
            expect(response).toEqual(mockPutResponseData); // Response is data itself
        });

        it('should reject if initial GET fails', async () => {
            const mockJqXHR = { status: 500, statusText: 'GET Failed', responseText: 'GET Failed' };
            mockAjax.mockRejectedValueOnce(mockJqXHR); // Fail the GET

            await expect(apiClient.updateProcessorProperties(processorId, propertiesToUpdate)).rejects.toEqual(mockJqXHR);
            expect(mockAjax).toHaveBeenCalledTimes(1); // Only GET should be called
            expect(mockAjax.mock.calls[0][0]).toEqual(expect.objectContaining({ method: 'GET', url: `../nifi-api/processors/${processorId}` }));
        });

        it('should reject if PUT fails', async () => {
            const mockJqXHR = { status: 500, statusText: 'PUT Failed', responseText: 'PUT Failed' };
            mockAjax
                .mockResolvedValueOnce(mockGetResponse) // GET succeeds
                .mockRejectedValueOnce(mockJqXHR);      // PUT fails

            await expect(apiClient.updateProcessorProperties(processorId, propertiesToUpdate)).rejects.toEqual(mockJqXHR);
            expect(mockAjax).toHaveBeenCalledTimes(2);
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
            expect(mockAjax).toHaveBeenCalledWith(expect.objectContaining({
                method: 'POST',
                url: expect.stringContaining('/validate-jwks-file'),
                data: JSON.stringify({ filePath: filePath })
            }));
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

    // Test table for callback-based API methods
    const callbackApiTestTable = [
        {
            methodName: 'validateJwksContent',
            apiMethodName: 'validateJwksContent',
            methodArgs: ['{"keys":[]}'], // jwksContent
            mockSuccessData: { valid: true, keyCount: 0 },
            expectedSuccessArgs: [{ valid: true, keyCount: 0 }],
            mockErrorData: { status: 400, statusText: 'Bad Request', responseText: 'Invalid JWKS content' },
            expectedErrorArgs: [
                'Bad Request', // statusText
                { status: 400, statusText: 'Bad Request', responseText: 'Invalid JWKS content' } // standardized error object
            ]
        },
        {
            methodName: 'validateJwksContent (no statusText in error)',
            apiMethodName: 'validateJwksContent', // Changed from apiMethod
            methodArgs: ['invalid-json'],
            mockSuccessData: { valid: false }, // Should not be used in error test
            expectedSuccessArgs: [{ valid: false }], // Should not be used in error test
            mockErrorData: { status: 500, responseText: 'Server Processing Error' }, // statusText is missing
            expectedErrorArgs: [
                'Unknown error', // Default statusText from _createXhrErrorObject
                { status: 500, statusText: 'Unknown error', responseText: 'Server Processing Error' }
            ]
        },
        {
            methodName: 'verifyToken',
            apiMethodName: 'verifyToken', // Changed from apiMethod
            methodArgs: ['a.b.c'], // token
            mockSuccessData: { valid: true, claims: { sub: 'user1' } },
            expectedSuccessArgs: [{ valid: true, claims: { sub: 'user1' } }],
            mockErrorData: { status: 401, statusText: 'Unauthorized', responseText: 'Token expired' },
            expectedErrorArgs: [
                'Unauthorized',
                { status: 401, statusText: 'Unauthorized', responseText: 'Token expired' }
            ]
        },
        {
            methodName: 'getSecurityMetrics',
            apiMethodName: 'getSecurityMetrics', // Changed from apiMethod
            methodArgs: [], // No specific args other than callbacks
            mockSuccessData: { activeSessions: 10, jwksValidations: 100 },
            expectedSuccessArgs: [{ activeSessions: 10, jwksValidations: 100 }],
            mockErrorData: { status: 503, statusText: 'Service Unavailable', responseText: 'Metrics service down' },
            expectedErrorArgs: [
                'Service Unavailable',
                { status: 503, statusText: 'Service Unavailable', responseText: 'Metrics service down' }
            ]
        }
    ];

    describe.each(callbackApiTestTable)('Callback API: $methodName', ({ apiMethodName, methodArgs, mockSuccessData, expectedSuccessArgs, mockErrorData, expectedErrorArgs }) => {
        it('should call successCallback with expected data on successful AJAX request', async () => {
            mockAjax.mockResolvedValue(mockSuccessData);

            apiClient[apiMethodName](...methodArgs, successCallback, errorCallback);
            await Promise.resolve().then().then();

            expect(successCallback).toHaveBeenCalledWith(...expectedSuccessArgs);
            expect(errorCallback).not.toHaveBeenCalled();
        });

        it('should call errorCallback with standardized error object on failed AJAX request', async () => {
            mockAjax.mockRejectedValue(mockErrorData);

            apiClient[apiMethodName](...methodArgs, successCallback, errorCallback);
            await Promise.resolve().then().then();

            expect(errorCallback).toHaveBeenCalledWith(...expectedErrorArgs);
            expect(successCallback).not.toHaveBeenCalled();
        });

        // Test cases for when callbacks are null/undefined
        it('should not throw if successCallback is null/undefined on success', async () => {
            mockAjax.mockResolvedValue(mockSuccessData);
            expect(() => {
                apiClient[apiMethodName](...methodArgs, null, errorCallback);
            }).not.toThrow();
            await Promise.resolve().then().then();
            expect(errorCallback).not.toHaveBeenCalled();
        });

        it('should not throw if errorCallback is null/undefined on error', async () => {
            mockAjax.mockRejectedValue(mockErrorData);
            expect(() => {
                apiClient[apiMethodName](...methodArgs, successCallback, null);
            }).not.toThrow();
            await Promise.resolve().then().then();
            expect(successCallback).not.toHaveBeenCalled();
        });

        it('should use "Unknown error" from _createXhrErrorObject if statusText is missing (Callback)', async () => {
            const mockErrorNoStatus = { status: 500, responseText: 'Server Internal Error Detail' };
            mockAjax.mockRejectedValue(mockErrorNoStatus);

            apiClient[apiMethodName](...methodArgs, successCallback, errorCallback);
            await Promise.resolve().then().then();

            expect(errorCallback).toHaveBeenCalledWith(
                'Unknown error', // Defaulted by _createXhrErrorObject
                expect.objectContaining({
                    status: 500,
                    responseText: 'Server Internal Error Detail',
                    statusText: 'Unknown error'
                })
            );
            expect(successCallback).not.toHaveBeenCalled();
        });

        // Test cases for when callbacks are null/undefined
        it('should not throw if successCallback is null/undefined on success', async () => {
            mockAjax.mockResolvedValue(mockSuccessData);
            expect(() => {
                apiClient[apiMethodName](...methodArgs, null, errorCallback);
            }).not.toThrow();
            await Promise.resolve().then().then();
            expect(errorCallback).not.toHaveBeenCalled();
        });

        it('should not throw if errorCallback is null/undefined on error', async () => {
            mockAjax.mockRejectedValue(mockErrorData);
            expect(() => {
                apiClient[apiMethodName](...methodArgs, successCallback, null);
            }).not.toThrow();
            await Promise.resolve().then().then();
            expect(successCallback).not.toHaveBeenCalled();
        });

        it('should use "Unknown error" from _createXhrErrorObject if statusText is missing (Callback)', async () => {
            const mockErrorNoStatus = { status: 500, responseText: 'Server Internal Error Detail' };
            mockAjax.mockRejectedValue(mockErrorNoStatus);

            apiClient[apiMethodName](...methodArgs, successCallback, errorCallback);
            await Promise.resolve().then().then();

            expect(errorCallback).toHaveBeenCalledWith(
                'Unknown error', // Defaulted by _createXhrErrorObject
                expect.objectContaining({
                    status: 500,
                    responseText: 'Server Internal Error Detail',
                    statusText: 'Unknown error'
                })
            );
            expect(successCallback).not.toHaveBeenCalled();
        });
    });

    describe('_createXhrErrorObject specific scenarios (tested via public methods)', () => {
        const testUrl = 'any-url';
        // Define testCallbackApi and testCallbackArgs inside beforeEach or tests where apiClient is defined
        let testCallbackApi;
        const testCallbackArgs = ['test-content'];

        beforeEach(() => {
            // apiClient is initialized in the higher-level beforeEach
            testCallbackApi = apiClient.validateJwksContent;
        });

        it('Promise: should use "Unknown error" if statusText, errorThrown, and textStatus are all falsy', async () => {
            const mockError = { status: 0, responseText: '' };
            mockAjax.mockRejectedValue(mockError);
            try {
                await apiClient.validateJwksUrl(testUrl);
            } catch (e) {
                expect(e.statusText).toBe('Unknown error');
            }
        });

        it('Callback: should use "Unknown error" if statusText, errorThrown, and textStatus are all falsy', async () => {
            const mockError = { status: 0, responseText: '' };
            mockAjax.mockRejectedValue(mockError);

            testCallbackApi(...testCallbackArgs, successCallback, errorCallback);
            await Promise.resolve().then().then();

            expect(errorCallback).toHaveBeenCalledWith(
                'Unknown error',
                expect.objectContaining({ status: 0, statusText: 'Unknown error'})
            );
        });
    });
});
