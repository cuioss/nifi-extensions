/**
 * Provides utility functions for tests, particularly for mocking fetch responses
 * that are aware of a simulated "localhost" environment.
 */

/**
 * Creates a mock implementation for fetch API.
 * This mock can simulate localhost behavior, where fetch errors might be presented
 * as successes with sample data, or behave normally for non-localhost scenarios.
 *
 * @param {object} options - Configuration for the mock.
 * @param {boolean} options.isLocalhostValue - The current localhost state for the test.
 * @param {object} options.simulatedLocalhostSuccessData - Data to resolve with when isLocalhostValue is true and an error occurs,
 *                                                       or when a success occurs on localhost.
 * @param {object} [options.successData] - Data to resolve with for a successful fetch call when not on localhost.
 * @param {object} [options.errorData] - Data to reject with for a failed fetch call when not on localhost.
 * @param {boolean} [options.isErrorScenario=false] - Set to true if this mock is for a scenario that should lead to a fetch error/rejection.
 * @param {boolean} [options.isSynchronousErrorScenario=false] - If true and isErrorScenario is true, the mock will throw a synchronous error.
 */
export const createFetchMock = ({
    isLocalhostValue,
    simulatedLocalhostSuccessData,
    successData, // For actual success (non-localhost, or localhost if not overriding errors)
    errorData,   // For actual errors (non-localhost)
    isErrorScenario = false,
    isSynchronousErrorScenario = false
}) => {
    return jest.fn(() => {
        if (isSynchronousErrorScenario) {
            throw new Error('Simulated synchronous fetch error by test-utils');
        }

        if (isErrorScenario) {
            if (isLocalhostValue) {
                // For localhost error scenarios, simulate a network error
                return Promise.reject(errorData || new Error('Simulated Localhost Error'));
            } else {
                // For non-localhost error scenarios, simulate HTTP error response
                const errorResponse = {
                    ok: false,
                    status: 500,
                    statusText: 'Internal Server Error',
                    json: () => Promise.resolve(errorData || { error: 'Generic Test Error' }),
                    text: () => Promise.resolve(JSON.stringify(errorData || { error: 'Generic Test Error' }))
                };
                return Promise.resolve(errorResponse);
            }
        } else { // Success scenario
            const responseData = isLocalhostValue
                ? simulatedLocalhostSuccessData // Use simulated data for localhost
                : (successData || {}); // Use provided success data or empty object for non-localhost

            // Add metadata about the environment for debugging
            const environmentInfo = {
                isLocalhost: isLocalhostValue,
                timestamp: new Date().toISOString(),
                scenario: 'success'
            };

            const finalData = {
                ...responseData,
                __testMetadata: environmentInfo
            };

            const successResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: () => Promise.resolve(finalData),
                text: () => Promise.resolve(JSON.stringify(finalData))
            };

            return Promise.resolve(successResponse);
        }
    });
};

/**
 * Legacy alias for backwards compatibility.
 * @deprecated Use createFetchMock instead
 */
export const createAjaxMock = createFetchMock;

// Sample data that can be imported by tests
export const sampleJwksSuccess = {
    valid: true,
    keyCount: 3
};

export const sampleTokenSuccess = {
    valid: true,
    subject: 'test-subject',
    issuer: 'test-issuer',
    audience: 'test-audience',
    expiration: new Date(Date.now() + 3600000).toISOString(),
    roles: ['user', 'reader'],
    scopes: ['read', 'profile'],
    claims: {
        sub: 'test-subject',
        iss: 'test-issuer',
        aud: 'test-audience',
        exp: Math.floor((Date.now() + 3600000) / 1000),
        iat: Math.floor(Date.now() / 1000),
        name: 'Test User',
        groups: ['user', 'reader'],
        scope: 'read profile'
    }
};
