/**
 * Mock implementation of jwksValidator for testing.
 */
module.exports = {
    // This mock implementation checks for a callback function before invoking it.
    // Note: No DOM manipulation or AJAX calls are included in this mock, as it is intended for simplified testing purposes.
    init: jest.fn().mockImplementation((element, propertyValue, jwks_type, callback) => {
        if (typeof callback === 'function') {
            callback({
                validate: jest.fn().mockReturnValue(true),
                getValue: jest.fn().mockReturnValue(propertyValue),
                setValue: jest.fn().mockImplementation(newValue => {
                    // This mock implementation for setValue can be kept simple.
                    // If tests needed to verify the new value was "stored" by the mock,
                    // one might assign `propertyValue = newValue;` here,
                    // but for a basic mock, jest.fn() is sufficient.
                    return newValue; // Or simply return nothing if not chained.
                }),
                jwks_type: jwks_type // Pass through the jwks_type
            });
        }
        // No DOM manipulation or internal AJAX calls should be present here.
        // The 'element' argument is acknowledged but not used, aligning with a simplified mock.
    }),
    // If there are other exported functions from the actual jwksValidator.js,
    // they should be mocked here as well, e.g.:
    // __setIsLocalhostForTesting: jest.fn()
    // For now, assuming only 'init' is primarily used by other modules in tests.
    // Adding the __setIsLocalhostForTesting mock as it exists in the actual module
    __setIsLocalhostForTesting: jest.fn()
};
