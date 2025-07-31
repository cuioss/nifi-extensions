/**
 * Test helper utilities for better error messages and debugging output
 * @fileoverview Provides utilities to improve test error messages and context
 */

/**
 * Creates a descriptive error message for test failures with additional context
 * @param {string} testName - Name of the test
 * @param {string} expected - What was expected
 * @param {*} actual - What was actually received
 * @param {object} [context] - Additional context information
 * @returns {string} Formatted error message
 */
export const createTestErrorMessage = (testName, expected, actual, context = {}) => {
    const contextStr = Object.keys(context).length > 0 
        ? `\nContext: ${JSON.stringify(context, null, 2)}`
        : '';
    
    return `
Test: ${testName}
Expected: ${expected}
Actual: ${JSON.stringify(actual, null, 2)}${contextStr}
`;
};

/**
 * Enhanced expect wrapper that provides better error messages
 * @param {*} actual - The actual value
 * @param {string} testName - Name of the test for context
 * @returns {object} Enhanced expect object
 */
export const expectWithContext = (actual, testName) => {
    const originalExpect = expect(actual);
    
    return {
        ...originalExpect,
        toBe: (expected) => {
            try {
                return originalExpect.toBe(expected);
            } catch (error) {
                throw new Error(createTestErrorMessage(testName, expected, actual));
            }
        },
        toEqual: (expected) => {
            try {
                return originalExpect.toEqual(expected);
            } catch (error) {
                throw new Error(createTestErrorMessage(testName, expected, actual));
            }
        },
        toHaveProperty: (property, value) => {
            try {
                return originalExpect.toHaveProperty(property, value);
            } catch (error) {
                const message = value !== undefined 
                    ? `property '${property}' with value ${JSON.stringify(value)}`
                    : `property '${property}'`;
                throw new Error(createTestErrorMessage(testName, message, actual));
            }
        }
    };
};

/**
 * Wrapper for async test functions that provides better error context
 * @param {string} testName - Name of the test
 * @param {Function} testFn - The test function
 * @returns {Function} Wrapped test function
 */
export const asyncTestWithContext = (testName, testFn) => {
    return async (...args) => {
        try {
            return await testFn(...args);
        } catch (error) {
            const enhancedError = new Error(`
Test: ${testName}
Original Error: ${error.message}
Stack: ${error.stack}
Arguments: ${JSON.stringify(args, null, 2)}
`);
            enhancedError.originalError = error;
            throw enhancedError;
        }
    };
};

/**
 * Logs detailed information about test state for debugging
 * @param {string} phase - Test phase (setup, execution, teardown)
 * @param {object} state - Current test state
 * @param {string} testName - Name of the test
 */
export const logTestState = (phase, state, testName) => {
    if (process.env.DEBUG) {
        console.debug(`
=== TEST DEBUG INFO ===
Test: ${testName}
Phase: ${phase}
State: ${JSON.stringify(state, null, 2)}
Timestamp: ${new Date().toISOString()}
=======================
`);
    }
};

/**
 * Validates that a DOM element exists and has expected properties
 * @param {HTMLElement} element - The DOM element to validate
 * @param {string} selector - The selector used to find the element
 * @param {object} expectedProperties - Expected properties/attributes
 * @param {string} testContext - Context for error messages
 * @throws {Error} If validation fails
 */
export const validateDOMElement = (element, selector, expectedProperties = {}, testContext = '') => {
    if (!element) {
        throw new Error(`
DOM Validation Failed
Context: ${testContext}
Issue: Element not found
Selector: ${selector}
Expected Properties: ${JSON.stringify(expectedProperties, null, 2)}
`);
    }

    for (const [property, expectedValue] of Object.entries(expectedProperties)) {
        const actualValue = element[property];
        if (actualValue !== expectedValue) {
            throw new Error(`
DOM Validation Failed
Context: ${testContext}
Element: ${selector}
Property: ${property}
Expected: ${expectedValue}
Actual: ${actualValue}
Element HTML: ${element.outerHTML}
`);
        }
    }
};

/**
 * Creates a mock function with enhanced error reporting
 * @param {string} mockName - Name of the mock for error reporting
 * @param {*} defaultReturnValue - Default return value
 * @returns {Function} Enhanced mock function
 */
export const createEnhancedMock = (mockName, defaultReturnValue) => {
    const mock = jest.fn().mockReturnValue(defaultReturnValue);
    
    // Add custom error reporting
    mock.getCallInfo = () => ({
        name: mockName,
        callCount: mock.mock.calls.length,
        calls: mock.mock.calls,
        results: mock.mock.results,
        lastCall: mock.mock.calls[mock.mock.calls.length - 1]
    });
    
    return mock;
};

/**
 * Waits for a condition to be true with enhanced error reporting
 * @param {Function} condition - Function that returns true when condition is met
 * @param {string} description - Description of what we're waiting for
 * @param {number} timeout - Timeout in milliseconds
 * @param {number} interval - Check interval in milliseconds
 * @returns {Promise} Resolves when condition is met
 */
export const waitForCondition = async (condition, description, timeout = 5000, interval = 100) => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        try {
            if (await condition()) {
                return;
            }
        } catch (error) {
            // Log the error but continue trying
            if (process.env.DEBUG) {
                console.debug(`Condition check failed: ${error.message}`);
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`
Timeout waiting for condition
Description: ${description}
Timeout: ${timeout}ms
Elapsed: ${Date.now() - startTime}ms
`);
};