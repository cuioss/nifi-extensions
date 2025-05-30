/**
 * Tests for the API Client service.
 */
const apiClient = require('services/apiClient');
const $ = require('jquery'); // This will be the Jest mock from setup or node_modules

// $.ajax is automatically mocked by Jest if jquery is in __mocks__ or if jest.mock('jquery') is used.
// Assuming $.ajax is jest.fn() due to global jQuery mock possibly in setup.js or Jest's automocking.

describe('apiClient', () => {
    let successCallback;
    let errorCallback;

    beforeEach(() => {
        // Reset mocks for each test
        successCallback = jest.fn();
        errorCallback = jest.fn();
        if ($.ajax && $.ajax.mockClear) { // Ensure $.ajax is a mock and has mockClear
            $.ajax.mockClear();
        } else {
            // If $.ajax is not a Jest mock function from our setup, this indicates a potential issue
            // with how jQuery is being mocked. For now, we'll proceed assuming it is.
            // console.warn("$.ajax is not a Jest mock function or does not have mockClear.");
        }
    });

    describe('validateJwksUrl', () => {
        const jwksUrl = 'https://example.com/.well-known/jwks.json';
        const expectedApiUrl = '../nifi-api/processors/jwt/validate-jwks-url';

        it('should make a POST request to the correct URL with correct data', () => {
            apiClient.validateJwksUrl(jwksUrl, successCallback, errorCallback);
            expect($.ajax).toHaveBeenCalledWith(expect.objectContaining({
                type: 'POST',
                url: expectedApiUrl,
                data: JSON.stringify({ jwksUrl: jwksUrl }),
                contentType: 'application/json',
                dataType: 'json'
            }));
        });

        it('should call successCallback with response on successful request', () => {
            const mockResponse = { valid: true, details: 'JWKS URL is valid' };
            $.ajax.mockReturnValue($.Deferred().resolve(mockResponse).promise());

            apiClient.validateJwksUrl(jwksUrl, successCallback, errorCallback);

            expect(successCallback).toHaveBeenCalledWith(mockResponse);
            expect(errorCallback).not.toHaveBeenCalled();
        });

        it('should call errorCallback with error message on failed request', () => {
            const mockXhr = { responseText: '{"error":"Invalid URL"}', statusText: 'Bad Request' };
            $.ajax.mockReturnValue($.Deferred().reject(mockXhr).promise());

            apiClient.validateJwksUrl(jwksUrl, successCallback, errorCallback);

            expect(errorCallback).toHaveBeenCalledWith('Invalid URL', mockXhr);
            expect(successCallback).not.toHaveBeenCalled();
        });
    });

    describe('validateJwksFile', () => {
        const filePath = '/path/to/jwks.json';
        const expectedApiUrl = '../nifi-api/processors/jwt/validate-jwks-file';

        it('should make a POST request to the correct URL with correct data', () => {
            apiClient.validateJwksFile(filePath, successCallback, errorCallback);
            expect($.ajax).toHaveBeenCalledWith(expect.objectContaining({
                type: 'POST',
                url: expectedApiUrl,
                data: JSON.stringify({ filePath: filePath }),
                contentType: 'application/json',
                dataType: 'json'
            }));
        });

        it('should call successCallback with response on successful request', () => {
            const mockResponse = { valid: true, details: 'JWKS File is valid' };
            $.ajax.mockReturnValue($.Deferred().resolve(mockResponse).promise());

            apiClient.validateJwksFile(filePath, successCallback, errorCallback);

            expect(successCallback).toHaveBeenCalledWith(mockResponse);
            expect(errorCallback).not.toHaveBeenCalled();
        });

        it('should call errorCallback with error message on failed request', () => {
            const mockXhr = { responseText: 'File not found', statusText: 'Not Found' }; // No JSON
            $.ajax.mockReturnValue($.Deferred().reject(mockXhr).promise());

            apiClient.validateJwksFile(filePath, successCallback, errorCallback);

            expect(errorCallback).toHaveBeenCalledWith('File not found', mockXhr);
            expect(successCallback).not.toHaveBeenCalled();
        });
    });

    describe('validateJwksContent', () => {
        const jwksContent = '{"keys":[]}';
        const expectedApiUrl = '../nifi-api/processors/jwt/validate-jwks-content';

        it('should make a POST request to the correct URL with correct data', () => {
            apiClient.validateJwksContent(jwksContent, successCallback, errorCallback);
            expect($.ajax).toHaveBeenCalledWith(expect.objectContaining({
                type: 'POST',
                url: expectedApiUrl,
                data: JSON.stringify({ jwksContent: jwksContent }),
                contentType: 'application/json',
                dataType: 'json'
            }));
        });

        it('should call successCallback with response on successful request', () => {
            const mockResponse = { valid: true, details: 'JWKS Content is valid' };
            $.ajax.mockReturnValue($.Deferred().resolve(mockResponse).promise());

            apiClient.validateJwksContent(jwksContent, successCallback, errorCallback);

            expect(successCallback).toHaveBeenCalledWith(mockResponse);
            expect(errorCallback).not.toHaveBeenCalled();
        });

        it('should call errorCallback with error message on failed request', () => {
            const mockXhr = { responseText: '{"error":"Invalid JSON content"}', statusText: 'Bad Request' };
            $.ajax.mockReturnValue($.Deferred().reject(mockXhr).promise());

            apiClient.validateJwksContent(jwksContent, successCallback, errorCallback);

            expect(errorCallback).toHaveBeenCalledWith('Invalid JSON content', mockXhr);
            expect(successCallback).not.toHaveBeenCalled();
        });
    });

    describe('verifyToken', () => {
        const token = 'eyJh...';
        const expectedApiUrl = '../nifi-api/processors/jwt/verify-token';

        it('should make a POST request to the correct URL with correct data', () => {
            apiClient.verifyToken(token, successCallback, errorCallback);
            expect($.ajax).toHaveBeenCalledWith(expect.objectContaining({
                type: 'POST',
                url: expectedApiUrl,
                data: JSON.stringify({ token: token }),
                contentType: 'application/json',
                dataType: 'json'
            }));
        });

        it('should call successCallback with response on successful request', () => {
            const mockResponse = { valid: true, claims: { sub: 'user1' } };
            $.ajax.mockReturnValue($.Deferred().resolve(mockResponse).promise());

            apiClient.verifyToken(token, successCallback, errorCallback);

            expect(successCallback).toHaveBeenCalledWith(mockResponse);
            expect(errorCallback).not.toHaveBeenCalled();
        });

        it('should call errorCallback with error message on failed request', () => {
            const mockXhr = { responseText: '{"error":"Invalid signature"}', statusText: 'Unauthorized' };
            $.ajax.mockReturnValue($.Deferred().reject(mockXhr).promise());

            apiClient.verifyToken(token, successCallback, errorCallback);

            expect(errorCallback).toHaveBeenCalledWith('Invalid signature', mockXhr);
            expect(successCallback).not.toHaveBeenCalled();
        });
    });

    describe('getSecurityMetrics', () => {
        const expectedApiUrl = '../nifi-api/processors/jwt/metrics';

        it('should make a GET request to the correct URL', () => {
            apiClient.getSecurityMetrics(successCallback, errorCallback);
            expect($.ajax).toHaveBeenCalledWith(expect.objectContaining({
                type: 'GET',
                url: expectedApiUrl,
                dataType: 'json'
            }));
        });

        it('should call successCallback with response on successful request', () => {
            const mockResponse = { requests: 100, successful: 95, failed: 5 };
            $.ajax.mockReturnValue($.Deferred().resolve(mockResponse).promise());

            apiClient.getSecurityMetrics(successCallback, errorCallback);

            expect(successCallback).toHaveBeenCalledWith(mockResponse);
            expect(errorCallback).not.toHaveBeenCalled();
        });

        it('should call errorCallback with error message on failed request', () => {
            const mockXhr = { responseText: 'Service unavailable', statusText: 'Service Unavailable' };
            $.ajax.mockReturnValue($.Deferred().reject(mockXhr).promise());

            apiClient.getSecurityMetrics(successCallback, errorCallback);

            expect(errorCallback).toHaveBeenCalledWith('Service unavailable', mockXhr);
            expect(successCallback).not.toHaveBeenCalled();
        });
    });

    // Tests for getProcessorProperties and updateProcessorProperties would be more complex
    // as they involve a sequence of AJAX calls or specific processorId.
    // For now, focusing on the primary validation/verification methods.
    // A simple "defined and callable" test might be kept for these if detailed testing is deferred.

    describe('getProcessorProperties', () => {
        it('should be defined and callable, returning a promise', () => {
            const processorId = 'test-processor-id';
            expect(apiClient.getProcessorProperties).toBeDefined();
            const promise = apiClient.getProcessorProperties(processorId);
            expect(promise).toBeDefined();
            expect(typeof promise.then).toBe('function'); // Check if it's a thenable
             // Verify $.ajax was called (basic check)
            expect($.ajax).toHaveBeenCalledWith(expect.objectContaining({
                type: 'GET',
                url: '../nifi-api/processors/' + processorId,
                dataType: 'json'
            }));
        });
    });

    describe('updateProcessorProperties', () => {
        // This is a more complex one due to the chained AJAX calls.
        // A full test would mock both the GET and PUT calls.
        it('should be defined and callable', () => {
            const processorId = 'test-processor-id';
            const properties = { someProp: 'someValue' };
            expect(apiClient.updateProcessorProperties).toBeDefined();
             // For now, just check it can be called.
            // A full test requires more intricate $.ajax mocking for the chain.
            // We can at least verify the first AJAX call (the GET).
            $.ajax.mockReturnValue($.Deferred().resolve({ revision: { version: 1 } }).promise()); // Mock the GET
            apiClient.updateProcessorProperties(processorId, properties);
            expect($.ajax).toHaveBeenCalledWith(expect.objectContaining({
                type: 'GET',
                url: '../nifi-api/processors/' + processorId
            }));
            // The second call (PUT) would ideally be checked too, but requires more setup.
        });
    });
});
