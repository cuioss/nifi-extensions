/**
 * Tests for error handler utilities.
 */
import {
    createApiClientCallbackErrorHandler,
    createApiClientErrorHandler,
    createXhrErrorObject
} from '../../../main/webapp/js/utils/errorHandler.js';

describe('Error Handler utilities', () => {
    describe('createXhrErrorObject', () => {
        it('should create error object from jqXHR with all properties', () => {
            const mockJqXHR = {
                status: 404,
                statusText: 'Not Found',
                responseText: '{"error": "Resource not found"}'
            };

            const errorObj = createXhrErrorObject(mockJqXHR, 'error', 'Not Found');

            expect(errorObj).toEqual({
                status: 404,
                statusText: 'Not Found',
                responseText: '{"error": "Resource not found"}'
            });
        });

        it('should prioritize jqXHR.statusText over parameters', () => {
            const mockJqXHR = {
                status: 500,
                statusText: 'Internal Server Error',
                responseText: 'Server error'
            };

            const errorObj = createXhrErrorObject(mockJqXHR, 'different text', 'different error');

            expect(errorObj.statusText).toBe('Internal Server Error');
        });

        it('should fallback to parameters when jqXHR properties are missing', () => {
            const mockJqXHR = {
                status: 400,
                responseText: 'Bad request'
                // statusText is missing
            };

            const errorObj = createXhrErrorObject(mockJqXHR, 'error', 'Bad Request');

            expect(errorObj.statusText).toBe('Bad Request');
        });

        it('should handle completely empty jqXHR object', () => {
            const mockJqXHR = {};

            const errorObj = createXhrErrorObject(mockJqXHR, 'timeout', 'Request timeout');

            expect(errorObj).toEqual({
                status: undefined,
                statusText: 'Request timeout',
                responseText: undefined
            });
        });

        it('should fallback to "Unknown error" when all parameters are missing', () => {
            const mockJqXHR = {};

            const errorObj = createXhrErrorObject(mockJqXHR);

            expect(errorObj.statusText).toBe('Unknown error');
        });

        it('should handle null/undefined jqXHR', () => {
            const errorObj1 = createXhrErrorObject(null, 'error', 'Null error');
            const errorObj2 = createXhrErrorObject(undefined, 'error', 'Undefined error');

            expect(errorObj1.statusText).toBe('Null error');
            expect(errorObj2.statusText).toBe('Undefined error');
        });
    });

    describe('createApiClientErrorHandler', () => {
        it('should create error handler that calls reject with standardized error', () => {
            const mockReject = jest.fn();
            const errorHandler = createApiClientErrorHandler(mockReject);

            const mockError = {
                status: 401,
                statusText: 'Unauthorized',
                responseText: 'Access denied'
            };

            errorHandler(mockError);

            expect(mockReject).toHaveBeenCalledWith({
                status: 401,
                statusText: 'Unauthorized',
                responseText: 'Access denied'
            });
        });

        it('should handle null jqXHR object', () => {
            const result = createXhrErrorObject(null);
            expect(result).toEqual({
                status: 0,
                statusText: 'Unknown error',
                responseText: ''
            });
        });

        it('should handle null jqXHR with textStatus', () => {
            const result = createXhrErrorObject(null, 'timeout');
            expect(result).toEqual({
                status: 0,
                statusText: 'timeout',
                responseText: ''
            });
        });

        it('should handle null jqXHR with errorThrown', () => {
            const result = createXhrErrorObject(null, null, 'Network Error');
            expect(result).toEqual({
                status: 0,
                statusText: 'Network Error',
                responseText: ''
            });
        });

        it('should handle undefined jqXHR object', () => {
            const result = createXhrErrorObject(undefined);
            expect(result).toEqual({
                status: 0,
                statusText: 'Unknown error',
                responseText: ''
            });
        });

        it('should prioritize jqXHR.statusText over textStatus and errorThrown', () => {
            const mockError = {
                status: 400,
                statusText: 'Bad Request',
                responseText: 'Invalid data'
            };

            const result = createXhrErrorObject(mockError, 'error', 'HTTP Error');
            expect(result).toEqual({
                status: 400,
                statusText: 'Bad Request', // Should use jqXHR.statusText
                responseText: 'Invalid data'
            });
        });

        it('should fallback to errorThrown when statusText is missing', () => {
            const mockError = {
                status: 500,
                responseText: 'Server error'
                // statusText is missing
            };

            const result = createXhrErrorObject(mockError, 'error', 'Internal Server Error');
            expect(result).toEqual({
                status: 500,
                statusText: 'Internal Server Error', // Should use errorThrown
                responseText: 'Server error'
            });
        });

        it('should fallback to textStatus when both statusText and errorThrown are missing', () => {
            const mockError = {
                status: 404,
                responseText: 'Not found'
                // statusText and errorThrown are missing
            };

            const result = createXhrErrorObject(mockError, 'timeout', null);
            expect(result).toEqual({
                status: 404,
                statusText: 'timeout', // Should use textStatus
                responseText: 'Not found'
            });
        });

        it('should handle errors with missing properties', () => {
            const mockReject = jest.fn();
            const errorHandler = createApiClientErrorHandler(mockReject);

            const mockError = {
                status: 500
                // missing statusText and responseText
            };

            errorHandler(mockError);

            expect(mockReject).toHaveBeenCalledWith({
                status: 500,
                statusText: 'Unknown error',
                responseText: undefined
            });
        });

        it('should return a function', () => {
            const mockReject = jest.fn();
            const errorHandler = createApiClientErrorHandler(mockReject);

            expect(typeof errorHandler).toBe('function');
        });

        it('should handle null reject function gracefully', () => {
            expect(() => {
                const errorHandler = createApiClientErrorHandler(null);
                errorHandler({ status: 500 });
            }).toThrow(); // Should throw when trying to call null as function
        });
    });

    describe('createApiClientCallbackErrorHandler', () => {
        it('should create error handler that calls callback with error message and object', () => {
            const mockCallback = jest.fn();
            const errorHandler = createApiClientCallbackErrorHandler(mockCallback);

            const mockError = {
                status: 403,
                statusText: 'Forbidden',
                responseText: 'Permission denied'
            };

            errorHandler(mockError);

            expect(mockCallback).toHaveBeenCalledWith(
                'Permission denied', // responseText is prioritized for better error details
                {
                    status: 403,
                    statusText: 'Forbidden',
                    responseText: 'Permission denied'
                }
            );
        });

        it('should prioritize responseText over statusText for error message', () => {
            const mockCallback = jest.fn();
            const errorHandler = createApiClientCallbackErrorHandler(mockCallback);

            const mockError = {
                status: 400,
                statusText: 'Bad Request',
                responseText: 'Detailed error message'
            };

            errorHandler(mockError);

            expect(mockCallback).toHaveBeenCalledWith(
                'Detailed error message', // responseText is prioritized
                expect.objectContaining({
                    statusText: 'Bad Request',
                    responseText: 'Detailed error message'
                })
            );
        });

        it('should fallback to responseText when statusText is missing', () => {
            const mockCallback = jest.fn();
            const errorHandler = createApiClientCallbackErrorHandler(mockCallback);

            const mockError = {
                status: 500,
                responseText: 'Internal server error details'
                // statusText is missing
            };

            errorHandler(mockError);

            expect(mockCallback).toHaveBeenCalledWith(
                'Internal server error details',
                expect.objectContaining({
                    responseText: 'Internal server error details'
                })
            );
        });

        it('should fallback to "Unknown error" when both statusText and responseText are missing', () => {
            const mockCallback = jest.fn();
            const errorHandler = createApiClientCallbackErrorHandler(mockCallback);

            const mockError = {
                status: 500
                // statusText and responseText are missing
            };

            errorHandler(mockError);

            expect(mockCallback).toHaveBeenCalledWith(
                'Unknown error',
                expect.objectContaining({
                    status: 500,
                    statusText: 'Unknown error'
                })
            );
        });

        it('should not call callback when errorCallback is null/undefined', () => {
            const errorHandler1 = createApiClientCallbackErrorHandler(null);
            const errorHandler2 = createApiClientCallbackErrorHandler(undefined);

            expect(() => {
                errorHandler1({ status: 500 });
                errorHandler2({ status: 500 });
            }).not.toThrow();
        });

        it('should return a function', () => {
            const mockCallback = jest.fn();
            const errorHandler = createApiClientCallbackErrorHandler(mockCallback);

            expect(typeof errorHandler).toBe('function');
        });

        it('should handle complex error scenarios', () => {
            const mockCallback = jest.fn();
            const errorHandler = createApiClientCallbackErrorHandler(mockCallback);

            // Network timeout error
            const timeoutError = {
                status: 0,
                statusText: '',
                responseText: ''
            };

            errorHandler(timeoutError);

            expect(mockCallback).toHaveBeenCalledWith(
                'Unknown error',
                expect.objectContaining({
                    status: 0,
                    statusText: 'Unknown error'
                })
            );
        });
    });

    describe('integration scenarios', () => {
        it('should work with Promise-based API client pattern', async () => {
            const mockApiCall = () => {
                return new Promise((resolve, reject) => {
                    const errorHandler = createApiClientErrorHandler(reject);

                    // Simulate API failure
                    setTimeout(() => {
                        errorHandler({
                            status: 404,
                            statusText: 'Not Found',
                            responseText: 'User not found'
                        });
                    }, 10);
                });
            };

            await expect(mockApiCall()).rejects.toEqual({
                status: 404,
                statusText: 'Not Found',
                responseText: 'User not found'
            });
        });

        it('should work with callback-based API client pattern', async () => {
            return new Promise((resolve, reject) => {
                const mockApiCall = (successCallback, errorCallback) => {
                    const errorHandler = createApiClientCallbackErrorHandler(errorCallback);

                    // Simulate API failure
                    setTimeout(() => {
                        errorHandler({
                            status: 500,
                            statusText: 'Internal Server Error',
                            responseText: 'Database connection failed'
                        });
                    }, 10);
                };

                mockApiCall(
                    () => {
                        reject(new Error('Success callback should not be called'));
                    },
                    (errorMessage, errorObject) => {
                        try {
                            expect(errorMessage).toBe('Database connection failed');
                            expect(errorObject.status).toBe(500);
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    }
                );
            });
        });
    });

    describe('edge cases and error conditions', () => {
        it('should handle very large error objects', () => {
            const mockReject = jest.fn();
            const errorHandler = createApiClientErrorHandler(mockReject);

            const largeResponseText = 'x'.repeat(10000);
            const mockError = {
                status: 500,
                statusText: 'Internal Server Error',
                responseText: largeResponseText
            };

            errorHandler(mockError);

            expect(mockReject).toHaveBeenCalledWith(
                expect.objectContaining({
                    responseText: largeResponseText
                })
            );
        });

        it('should handle circular reference objects safely', () => {
            const mockReject = jest.fn();
            const errorHandler = createApiClientErrorHandler(mockReject);

            const circularError = {
                status: 500,
                statusText: 'Error'
            };
            circularError.self = circularError; // Create circular reference

            expect(() => {
                errorHandler(circularError);
            }).not.toThrow();

            expect(mockReject).toHaveBeenCalled();
        });

        it('should handle non-object error inputs', () => {
            const mockReject = jest.fn();
            const errorHandler = createApiClientErrorHandler(mockReject);

            // Test with string
            errorHandler('string error');
            expect(mockReject).toHaveBeenCalledWith({
                status: undefined,
                statusText: 'Unknown error',
                responseText: undefined
            });

            // Test with number
            mockReject.mockClear();
            errorHandler(404);
            expect(mockReject).toHaveBeenCalledWith({
                status: undefined,
                statusText: 'Unknown error',
                responseText: undefined
            });
        });
    });
});
