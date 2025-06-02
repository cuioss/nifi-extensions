/**
     * Tests for the API Client service.
     */
import * as apiClient from 'services/apiClient';
import $ from 'jquery';

describe('apiClient', () => {
    let successCallback;
    let errorCallback;

    beforeEach(() => {
        successCallback = jest.fn();
        errorCallback = jest.fn();
        // Reset the $.ajax mock before each test if it's going to be redefined per test
        // For jest.mock('jquery'), $ is a mock function, and $.ajax is a property on it.
        // If $ itself is not reset, $.ajax needs to be.
        // However, Jest's default behavior with resetMocks:true should handle this.
        // If not, explicitly do: $.ajax = jest.fn(); or similar in beforeEach.
        // For now, relying on Jest's default mock reset.
        // If $.ajax is defined on the mock's prototype, it might need specific reset.
        // The simplest for jest.mock() is that $.ajax will be jest.fn() by default.
        if ($.ajax && $.ajax.mockClear) { // Check if $.ajax is a mock and clear it
            $.ajax.mockClear();
        }
    });

    // mockAjaxDoneFail helper is commented out as it's not used by the active tests
    const mockAjaxDoneFail = (shouldSucceed, responseData, errorData) => {
        const RealjQuery = jest.requireActual('jquery');
        const jqPromise = RealjQuery.Deferred(); // Use real jQuery deferred for done/fail behavior

        if (shouldSucceed) {
            process.nextTick(() => jqPromise.resolve(responseData));
        } else {
            process.nextTick(() => jqPromise.reject(errorData.xhr, errorData.status, errorData.error));
        }
        // Ensure $.ajax is a mock function before setting mockImplementationOnce
        if (typeof $.ajax.mockImplementationOnce !== 'function') {
            $.ajax = jest.fn();
        }
        $.ajax.mockImplementationOnce(() => jqPromise.promise());
        return jqPromise.promise(); // Return the promise
    };

    // All other 'describe' blocks are commented out
    describe('validateJwksUrl', () => {
        const jwksUrl = 'https://example.com/.well-known/jwks.json';
        it('should make a POST request and call successCallback on success', () => {
            expect.hasAssertions(); // Tell Jest to expect assertions
            const mockResponse = { valid: true, details: 'JWKS URL is valid' };
            $.ajax = jest.fn(); // Ensure $.ajax is a mock for this test
            mockAjaxDoneFail(true, mockResponse); // This now sets up $.ajax to return a promise

            apiClient.validateJwksUrl(jwksUrl, successCallback, errorCallback);
            expect($.ajax).toHaveBeenCalledWith(expect.objectContaining({ type: 'POST', data: JSON.stringify({ jwksUrl }) }));

            // Return a promise that resolves after checking callbacks
            return new Promise(resolve => {
                process.nextTick(() => {
                    expect(successCallback).toHaveBeenCalledWith(mockResponse);
                    expect(errorCallback).not.toHaveBeenCalled();
                    resolve();
                });
            });
        });

        it('should call errorCallback on failure', () => {
            expect.hasAssertions();
            const mockError = { xhr: { responseText: '{"error":"Invalid URL"}' }, status: 'error', error: 'Bad Request' };
            $.ajax = jest.fn(); // Ensure $.ajax is a mock for this test
            mockAjaxDoneFail(false, null, mockError); // This now sets up $.ajax to return a promise

            apiClient.validateJwksUrl(jwksUrl, successCallback, errorCallback);

            // Return a promise that resolves after checking callbacks
            return new Promise(resolve => {
                process.nextTick(() => {
                    // The handleApiError function parses JSON, so we expect the parsed message.
                    expect(errorCallback).toHaveBeenCalledWith('Invalid URL', mockError.xhr);
                    resolve();
                });
            });
        });
    });
    // ... other suites ...

    describe('getProcessorProperties', () => {
        const processorId = 'proc-id-get';
        const rawAjaxSuccessData = { component: { properties: { 'prop1': 'val1' } }, revision: { version: 1 } };
        const ajaxFailureDetails = { xhr: { responseText: 'Not Found', status: 404 }, status: 'error', error: 'Not Found Error' };

        it('should resolve with properties on successful GET', () => {
            // $.ajax needs to be mocked here since we removed the global jest.mock('jquery')
            $.ajax = jest.fn().mockImplementationOnce(() => {
                return jest.requireActual('jquery').Deferred().resolve(rawAjaxSuccessData).promise();
            });

            return apiClient.getProcessorProperties(processorId)
                .then(response => {
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect($.ajax).toHaveBeenCalledTimes(1);
                    // The function returns the whole response, not just component.properties
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(response).toEqual(rawAjaxSuccessData);
                });
        });

        it('should reject with error from handleApiError on failed GET', () => {
            // $.ajax needs to be mocked here
            $.ajax = jest.fn().mockImplementationOnce(() => {
                // jQuery's .fail() callback receives (jqXHR, textStatus, errorThrown)
                // The promise's .catch() will receive the first argument passed to reject(), which is the xhr.
                return jest.requireActual('jquery').Deferred().reject(ajaxFailureDetails.xhr, ajaxFailureDetails.status, ajaxFailureDetails.error).promise();
            });

            return apiClient.getProcessorProperties(processorId)
                .then(() => { throw new Error('Promise should have rejected'); })
                .catch(errorXhr => { // This will be the xhr object
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect($.ajax).toHaveBeenCalledTimes(1);
                    // The error object passed to .catch is the xhr object itself.
                    // The 'message' would be part of xhr.responseText or statusText.
                    // The original test was checking error.message, which implies a custom error object.
                    // For a direct jQuery promise, we check the xhr object.
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(errorXhr.responseText).toBe(ajaxFailureDetails.xhr.responseText);
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(errorXhr.status).toBe(ajaxFailureDetails.xhr.status);
                });
        });
    });

    describe('updateProcessorProperties', () => {
        const processorId = 'proc-id-update';
        const initialProperties = { 'prop1': 'initialVal', 'prop2': 'initialVal2' };
        const updatedProperties = { 'prop1': 'newVal', 'prop2': 'initialVal2' }; // Only prop1 is changed

        const mockInitialRevision = { version: 1 };
        const mockInitialComponent = { id: processorId, properties: initialProperties };
        const mockGetResponse = { component: mockInitialComponent, revision: mockInitialRevision };

        const mockUpdatedRevision = { version: 2 };
        const mockPutResponse = { component: { id: processorId, properties: updatedProperties }, revision: mockUpdatedRevision };
        const ajaxFailureDetails = { xhr: { responseText: 'Update Conflict', status: 409 }, status: 'error', error: 'Conflict' };


        it('should GET then PUT and resolve with updated properties on success', () => {
            expect.assertions(8); // Ensure all assertions in the promise chain are checked
            $.ajax = jest.fn(); // Ensure $.ajax is a mock

            // Mock for the initial GET request
            $.ajax.mockImplementationOnce(() => {
                return jest.requireActual('jquery').Deferred().resolve(mockGetResponse).promise();
            });

            // Mock for the PUT request
            $.ajax.mockImplementationOnce(() => {
                return jest.requireActual('jquery').Deferred().resolve(mockPutResponse).promise();
            });

            return apiClient.updateProcessorProperties(processorId, updatedProperties)
                .then(response => {
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect($.ajax).toHaveBeenCalledTimes(2);

                    // Check GET call
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect($.ajax.mock.calls[0][0].type).toBe('GET');
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect($.ajax.mock.calls[0][0].url).toBe(`../nifi-api/processors/${processorId}`);

                    // Check PUT call
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect($.ajax.mock.calls[1][0].type).toBe('PUT');
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect($.ajax.mock.calls[1][0].url).toBe(`../nifi-api/processors/${processorId}`);
                    const putData = JSON.parse($.ajax.mock.calls[1][0].data);
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(putData.revision).toEqual(mockInitialRevision);
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(putData.component.properties).toEqual(updatedProperties);

                    // Check final response
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(response).toEqual(mockPutResponse);
                });
        });

        it('should reject if initial GET fails', () => {
            expect.assertions(2); //toHaveBeenCalledTimes and responseText check
            $.ajax = jest.fn().mockImplementationOnce(() => {
                return jest.requireActual('jquery').Deferred().reject(ajaxFailureDetails.xhr, ajaxFailureDetails.status, ajaxFailureDetails.error).promise();
            });

            return apiClient.updateProcessorProperties(processorId, updatedProperties)
                .then(() => { throw new Error('Promise should have rejected'); })
                .catch(errorXhr => {
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect($.ajax).toHaveBeenCalledTimes(1);
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(errorXhr.responseText).toBe(ajaxFailureDetails.xhr.responseText);
                });
        });

        it('should reject if PUT fails', () => {
            expect.assertions(2); //toHaveBeenCalledTimes and responseText check
            $.ajax = jest.fn();
            // Mock for the initial GET request (success)
            $.ajax.mockImplementationOnce(() => {
                return jest.requireActual('jquery').Deferred().resolve(mockGetResponse).promise();
            });
            // Mock for the PUT request (failure)
            $.ajax.mockImplementationOnce(() => {
                return jest.requireActual('jquery').Deferred().reject(ajaxFailureDetails.xhr, ajaxFailureDetails.status, ajaxFailureDetails.error).promise();
            });

            return apiClient.updateProcessorProperties(processorId, updatedProperties)
                .then(() => { throw new Error('Promise should have rejected'); })
                .catch(errorXhr => {
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect($.ajax).toHaveBeenCalledTimes(2);
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(errorXhr.responseText).toBe(ajaxFailureDetails.xhr.responseText);
                });
        });
    });

    describe('handleApiError edge cases (via validateJwksUrl)', () => {
        // For these tests, we call validateJwksUrl but focus on handleApiError's behavior.
        // We need $.ajax to be a mock that calls .fail() with different xhr contents.
        const url = 'some-url';

        beforeEach(() => {
            // Ensure $.ajax is a fresh mock for each test in this suite
            $.ajax = jest.fn();
        });

        it('should use xhr.responseText if JSON parsing fails and responseText is available', () => {
            expect.hasAssertions(); // Tell Jest to expect assertions
            const mockXhr = { responseText: 'Raw Error Message', status: 500 };
            mockAjaxDoneFail(false, null, { xhr: mockXhr, status: 'error', error: 'Server Error' });

            apiClient.validateJwksUrl(url, successCallback, errorCallback);
            return new Promise(resolve => {
                process.nextTick(() => {
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(errorCallback).toHaveBeenCalledWith('Raw Error Message', mockXhr);
                    resolve();
                });
            });
        });

        it('should use xhr.statusText if JSON parsing fails and responseText is empty', () => {
            expect.hasAssertions();
            const mockXhr = { responseText: '', statusText: 'Custom Status', status: 500 };
            mockAjaxDoneFail(false, null, { xhr: mockXhr, status: 'error', error: 'Server Error' });

            apiClient.validateJwksUrl(url, successCallback, errorCallback);
            return new Promise(resolve => {
                process.nextTick(() => {
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(errorCallback).toHaveBeenCalledWith('Custom Status', mockXhr);
                    resolve();
                });
            });
        });

        it('should use parsed response.message if available', () => {
            expect.hasAssertions();
            const mockXhr = { responseText: '{"message":"Error from message field"}', status: 400 };
            mockAjaxDoneFail(false, null, { xhr: mockXhr, status: 'error', error: 'Bad Request' });

            apiClient.validateJwksUrl(url, successCallback, errorCallback);
            return new Promise(resolve => {
                process.nextTick(() => {
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(errorCallback).toHaveBeenCalledWith('Error from message field', mockXhr);
                    resolve();
                });
            });
        });

        it('should use parsed response.error if available and message is not', () => {
            expect.hasAssertions();
            const mockXhr = { responseText: '{"error":"Error from error field"}', status: 400 };
            mockAjaxDoneFail(false, null, { xhr: mockXhr, status: 'error', error: 'Bad Request' });

            apiClient.validateJwksUrl(url, successCallback, errorCallback);
            return new Promise(resolve => {
                process.nextTick(() => {
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(errorCallback).toHaveBeenCalledWith('Error from error field', mockXhr);
                    resolve();
                });
            });
        });

        it('should default to xhr.statusText if response is JSON but no message/error fields', () => {
            expect.hasAssertions();
            const mockXhr = { responseText: '{"details":"Some details"}', statusText: 'Bad Req', status: 400 };
            mockAjaxDoneFail(false, null, { xhr: mockXhr, status: 'error', error: 'Bad Request' });

            apiClient.validateJwksUrl(url, successCallback, errorCallback);
            return new Promise(resolve => {
                process.nextTick(() => {
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(errorCallback).toHaveBeenCalledWith('Bad Req', mockXhr);
                    resolve();
                });
            });
        });

        it('replaces "Internal Server Error" with a user-friendly message', () => {
            expect.hasAssertions();
            const mockXhr = { responseText: 'Internal Server Error', status: 500 };
            mockAjaxDoneFail(false, null, { xhr: mockXhr, status: 'error', error: 'Internal Server Error' });

            apiClient.validateJwksUrl(url, successCallback, errorCallback);
            return new Promise(resolve => {
                process.nextTick(() => {
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(errorCallback).toHaveBeenCalledWith(
                        'An unexpected error has occurred. Please try again later or contact support if the issue persists.',
                        mockXhr
                    );
                    resolve();
                });
            });
        });
    });
});
