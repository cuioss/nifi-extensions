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

        it('should make a POST request and call successCallback on success', async () => {
            const mockResponseData = { valid: true, details: 'JWKS URL is valid' };
            // Configure the mockAjax to resolve successfully for this test
            mockAjax.mockResolvedValue(mockResponseData); // cash-dom's $.ajax().then() callback receives data directly

            // Call the actual apiClient.validateJwksUrl
            apiClient.validateJwksUrl(jwksUrl, successCallback, errorCallback);

            // Allow promise in SUT to resolve
            await Promise.resolve().then().then(); // Wait for microtasks

            expect(mockAjax).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/validate-jwks-url') }));
            expect(successCallback).toHaveBeenCalledWith(mockResponseData);
            expect(errorCallback).not.toHaveBeenCalled();
        });

        it('should call errorCallback on failure (with error.response)', async () => {
            const mockJqXHR = { status: 500, statusText: 'Server Error', responseText: 'Server Message' };
            mockAjax.mockRejectedValue(mockJqXHR);

            apiClient.validateJwksUrl(jwksUrl, successCallback, errorCallback);
            await Promise.resolve().then().then(); // Wait for microtasks

            expect(errorCallback).toHaveBeenCalledWith('Server Error', expect.objectContaining({
                status: 500,
                statusText: 'Server Error',
                responseText: 'Server Message'
            }));
            expect(successCallback).not.toHaveBeenCalled();
        });

        it('should call errorCallback on failure (without error.response)', async () => {
            const mockJqXHR = { status: 0, statusText: 'Network Failure', responseText: 'Network Failure' };
            // No error.response for this case, cash-dom might pass jqXHR directly to catch
            mockAjax.mockRejectedValue(mockJqXHR);

            apiClient.validateJwksUrl(jwksUrl, successCallback, errorCallback);
            await Promise.resolve().then().then(); // Wait for microtasks

            expect(errorCallback).toHaveBeenCalledWith('Network Failure', expect.objectContaining({
                status: 0,
                statusText: 'Network Failure',
                responseText: 'Network Failure'
            }));
            expect(successCallback).not.toHaveBeenCalled();
        });

        it('should not call successCallback if it is not provided', async () => {
            const mockResponseData = { valid: true };
            mockAjax.mockResolvedValue(mockResponseData);
            // Call without successCallback
            apiClient.validateJwksUrl(jwksUrl, null, errorCallback);
            await Promise.resolve().then().then();
            // No explicit assertion for successCallback not being called,
            // but we ensure no error if it's null. errorCallback should not be called either.
            expect(errorCallback).not.toHaveBeenCalled();
        });

        it('should not call errorCallback if it is not provided and ajax rejects', async () => {
            const mockJqXHR = { status: 0, statusText: 'Network Failure', responseText: 'Network Failure' };
            mockAjax.mockRejectedValue(mockJqXHR);
            // Call without errorCallback
            apiClient.validateJwksUrl(jwksUrl, successCallback, null);
            await Promise.resolve().then().then();
            // No explicit assertion for errorCallback not being called,
            // but we ensure no error if it's null. successCallback should not be called either.
            expect(successCallback).not.toHaveBeenCalled();
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
        const mockResponseData = { valid: true, keys: 1 };

        it('should call successCallback on success', async () => {
            mockAjax.mockResolvedValue(mockResponseData);
            apiClient.validateJwksFile(filePath, successCallback, errorCallback);
            await Promise.resolve().then().then();
            expect(mockAjax).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/validate-jwks-file') }));
            expect(successCallback).toHaveBeenCalledWith(mockResponseData);
            expect(errorCallback).not.toHaveBeenCalled();
        });

        it('should call errorCallback on failure (with error.response)', async () => {
            const mockJqXHR = { status: 500, statusText: 'Read Error', responseText: 'File not accessible' };
            mockAjax.mockRejectedValue(mockJqXHR);
            apiClient.validateJwksFile(filePath, successCallback, errorCallback);
            await Promise.resolve().then().then();
            expect(errorCallback).toHaveBeenCalledWith('Read Error', expect.objectContaining({ status: 500, responseText: 'File not accessible' }));
        });

        it('should call errorCallback on failure (without error.response)', async () => {
            const mockJqXHR = { status: 0, statusText: 'Network Error', responseText: 'Network Error' };
            mockAjax.mockRejectedValue(mockJqXHR);
            apiClient.validateJwksFile(filePath, successCallback, errorCallback);
            await Promise.resolve().then().then();
            expect(errorCallback).toHaveBeenCalledWith('Network Error', expect.objectContaining({ status: 0, responseText: 'Network Error' }));
        });

        it('should not call callbacks if not provided', async () => {
            mockAjax.mockResolvedValue(mockResponseData);
            apiClient.validateJwksFile(filePath, null, null);
            await Promise.resolve().then().then();
            // No error expected

            mockAjax.mockRejectedValue({ status: 500, statusText: 'Error', responseText: 'Error' });
            apiClient.validateJwksFile(filePath, null, null);
            await Promise.resolve().then().then().catch(() => {}); // Catch expected rejection
            expect(successCallback).not.toHaveBeenCalled();
            expect(errorCallback).not.toHaveBeenCalled();
        });
    });

    describe('validateJwksContent', () => {
        const jwksContent = '{"keys":[]}';
        it('should call successCallback on success', async () => {
            mockAjax.mockResolvedValue({ valid: true });
            apiClient.validateJwksContent(jwksContent, successCallback, errorCallback);
            await Promise.resolve().then().then();
            expect(successCallback).toHaveBeenCalledWith({ valid: true });
        });
        it('should call errorCallback on failure', async () => {
            const mockJqXHR = { status: 500, statusText: 'Content Error', responseText: 'Content Error' };
            mockAjax.mockRejectedValue(mockJqXHR);
            apiClient.validateJwksContent(jwksContent, successCallback, errorCallback);
            await Promise.resolve().then().then();
            expect(errorCallback).toHaveBeenCalledWith('Content Error', expect.anything());
        });
    });

    describe('verifyToken', () => {
        const token = 'a.b.c';
        it('should call successCallback on success', async () => {
            mockAjax.mockResolvedValue({ valid: true });
            apiClient.verifyToken(token, successCallback, errorCallback);
            await Promise.resolve().then().then();
            expect(successCallback).toHaveBeenCalledWith({ valid: true });
        });
        it('should call errorCallback on failure', async () => {
            const mockJqXHR = { status: 500, statusText: 'Token Error', responseText: 'Token Error' };
            mockAjax.mockRejectedValue(mockJqXHR);
            apiClient.verifyToken(token, successCallback, errorCallback);
            await Promise.resolve().then().then();
            expect(errorCallback).toHaveBeenCalledWith('Token Error', expect.anything());
        });
    });

    describe('getSecurityMetrics', () => {
        it('should call successCallback on success', async () => {
            mockAjax.mockResolvedValue({ metrics: 'data' });
            apiClient.getSecurityMetrics(successCallback, errorCallback);
            await Promise.resolve().then().then();
            expect(successCallback).toHaveBeenCalledWith({ metrics: 'data' });
        });
        it('should call errorCallback on failure', async () => {
            const mockJqXHR = { status: 500, statusText: 'Metrics Error', responseText: 'Metrics Error' };
            mockAjax.mockRejectedValue(mockJqXHR);
            apiClient.getSecurityMetrics(successCallback, errorCallback);
            await Promise.resolve().then().then();
            expect(errorCallback).toHaveBeenCalledWith('Metrics Error', expect.anything());
        });
    });
});
