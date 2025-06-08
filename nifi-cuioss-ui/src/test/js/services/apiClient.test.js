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
});
