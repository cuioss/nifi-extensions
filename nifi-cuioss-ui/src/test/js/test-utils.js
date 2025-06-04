/**
 * Provides utility functions for tests, particularly for mocking AJAX responses
 * that are aware of a simulated "localhost" environment.
 */

/**
 * Creates a mock implementation for cash-dom's $.ajax.
 * This mock can simulate localhost behavior, where AJAX errors might be presented
 * as successes with sample data, or behave normally for non-localhost scenarios.
 *
 * @param {object} options - Configuration for the mock.
 * @param {boolean} options.isLocalhostValue - The current localhost state for the test.
 * @param {object} options.simulatedLocalhostSuccessData - Data to resolve with when isLocalhostValue is true and an AJAX "error" occurs,
 *                                                       or when a success occurs on localhost.
 * @param {object} [options.successData] - Data to resolve with for a successful AJAX call when not on localhost.
 * @param {object} [options.errorData] - Data to reject with for a failed AJAX call when not on localhost.
 * @param {boolean} [options.isErrorScenario=false] - Set to true if this mock is for a scenario that should lead to an AJAX error/rejection.
 * @param {boolean} [options.isSynchronousErrorScenario=false] - If true and isErrorScenario is true, the mock will throw a synchronous error.
 */
export const createAjaxMock = ({
    isLocalhostValue,
    simulatedLocalhostSuccessData,
    successData, // For actual success (non-localhost, or localhost if not overriding errors)
    errorData,   // For actual errors (non-localhost)
    isErrorScenario = false,
    isSynchronousErrorScenario = false
}) => {
    return jest.fn((ajaxSettings) => { // This is the function that will mock $.ajax
        if (isSynchronousErrorScenario) {
            // console.log('test-utils: Throwing synchronous error');
            throw new Error('Simulated synchronous AJAX error by test-utils');
        }

        let thenCb, catchCb;
        const promise = {
            then: function (cb) { thenCb = cb; return this; },
            catch: function (cb) { catchCb = cb; return this; },
            // Helper to simulate async resolution/rejection
            _resolve: function (data) { setTimeout(() => { if (thenCb) thenCb(data); }, 0); },
            _reject: function (err) { setTimeout(() => { if (catchCb) catchCb(err); }, 0); }
        };

        if (isErrorScenario) {
            if (isLocalhostValue) {
                // For localhost error scenarios, the SUT's .catch block should be hit,
                // which then decides to show a simulated success. So, we reject here.
                // console.log('test-utils: Simulating localhost error scenario (will reject)');
                promise._reject(errorData || { statusText: 'Simulated Localhost Error', responseText: 'Error for localhost test to trigger SUT catch' });
            } else {
                // console.log('test-utils: Simulating actual error for non-localhost');
                promise._reject(errorData || { statusText: 'Generic Test Error', responseText: 'Error from test-utils' });
            }
        } else { // Success scenario
            if (isLocalhostValue) {
                // console.log('test-utils: Simulating localhost success for a success scenario');
                promise._resolve(simulatedLocalhostSuccessData); // Often localhost success is also simulated
            } else {
                // console.log('test-utils: Simulating actual success for non-localhost');
                promise._resolve(successData || {});
            }
        }
        return promise;
    });
};

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
