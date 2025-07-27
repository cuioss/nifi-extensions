/**
 * Tests for the JWKS Validator component.
 * Comprehensive test coverage for all functionality.
 */

const mockI18n = {
    'processor.jwt.testConnection': 'Test Connection Button',
    'processor.jwt.testing': 'Testing JWKS...',
    'processor.jwt.ok': 'OK',
    'processor.jwt.validJwks': 'Valid JWKS',
    'processor.jwt.keysFound': 'keys found',
    'processor.jwt.invalidJwks': 'Invalid JWKS',
    'jwksValidator.initialInstructions': 'Click the button to validate JWKS',
    'processor.jwt.unknownError': 'Unknown error'
};

// Mock cash-dom with comprehensive functionality
jest.mock('cash-dom', () => {
    let eventHandlers = {};
    let ajaxResolver = null;
    let ajaxRejecter = null;
    let hasInputField = true;

    const mockElement = {
        append: jest.fn().mockReturnThis(),
        html: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        on: jest.fn((event, handler) => {
            eventHandlers[event] = handler;
            return mockElement;
        }),
        find: jest.fn().mockImplementation((selector) => {
            if (selector === 'input') {
                return {
                    length: hasInputField ? 1 : 0,
                    after: jest.fn().mockReturnThis()
                };
            }
            return {
                length: 1,
                after: jest.fn().mockReturnThis()
            };
        }),
        after: jest.fn().mockReturnThis(),
        addClass: jest.fn().mockReturnThis(),
        removeClass: jest.fn().mockReturnThis(),
        prop: jest.fn().mockReturnThis(),
        length: 1
    };

    const mockCash = jest.fn((selector) => {
        if (typeof selector === 'string' && selector.includes('<')) {
            // Creating new element from HTML
            return mockElement;
        }
        return mockElement;
    });

    mockCash.ajax = jest.fn().mockImplementation(() => {
        const promise = new Promise((resolve, reject) => {
            ajaxResolver = resolve;
            ajaxRejecter = reject;
        });

        return {
            then: jest.fn().mockImplementation((callback) => {
                promise.then(callback).catch(() => {}); // Suppress uncaught promise rejections
                return {
                    catch: jest.fn().mockImplementation((errorCallback) => {
                        promise.catch(errorCallback);
                    })
                };
            }),
            catch: jest.fn().mockImplementation((errorCallback) => {
                promise.catch(errorCallback);
            })
        };
    });

    // Helper functions for testing
    mockCash.__triggerClick = () => {
        if (eventHandlers['click']) {
            eventHandlers['click']();
        }
    };
    mockCash.__resolveAjax = (data) => {
        if (ajaxResolver) ajaxResolver(data);
    };
    mockCash.__rejectAjax = (error) => {
        if (ajaxRejecter) ajaxRejecter(error);
    };
    mockCash.__setHasInputField = (value) => { hasInputField = value; };
    mockCash.__clearHandlers = () => { eventHandlers = {}; };

    return { __esModule: true, default: mockCash };
});

// Mock dependencies
jest.mock('nf.Common', () => ({
    getI18n: jest.fn().mockReturnValue(mockI18n)
}));

jest.mock('../../../main/webapp/js/utils/uiErrorDisplay.js', () => ({
    displayUiError: jest.fn()
}));

jest.mock('../../../main/webapp/js/utils/constants.js', () => ({
    getIsLocalhost: jest.fn().mockReturnValue(false),
    setIsLocalhostForTesting: jest.fn(),
    API: {
        ENDPOINTS: { JWKS_VALIDATE_URL: '/api/validate-jwks' },
        TIMEOUTS: { DEFAULT: 5000 }
    }
}));

// Mock the apiClient module
let mockValidateJwksUrl;
jest.mock('../../../main/webapp/js/services/apiClient.js', () => ({
    validateJwksUrl: jest.fn().mockImplementation(() => {
        return mockValidateJwksUrl();
    })
}));

describe('jwksValidator', () => {
    let jwksValidator;
    let parentElement;
    let callback;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        // Default mock implementation for validateJwksUrl
        mockValidateJwksUrl = jest.fn().mockResolvedValue({
            valid: true,
            keyCount: 3
        });

        jwksValidator = require('components/jwksValidator');
        parentElement = document.createElement('div');
        parentElement.innerHTML = '<input type="text" value="https://example.com/.well-known/jwks.json" />';
        document.body.appendChild(parentElement);
        callback = jest.fn();
    });

    afterEach(() => {
        if (parentElement.parentNode === document.body) {
            document.body.removeChild(parentElement);
        }
    });

    describe('Basic Functionality', () => {
        it('should initialize successfully for server type', async () => {
            await jwksValidator.init(parentElement, 'https://example.com/.well-known/jwks.json', 'server', callback);
            expect(callback).toHaveBeenCalled();
        });

        it('should initialize successfully for non-server type', async () => {
            await jwksValidator.init(parentElement, 'file://jwks.json', 'file', callback);
            expect(callback).toHaveBeenCalled();
        });

        it('should handle missing element', async () => {
            await expect(jwksValidator.init(null, 'https://example.com', 'server', callback)).rejects.toThrow();
            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.any(String) })
            );
        });

        it('should handle missing callback gracefully', async () => {
            await expect(jwksValidator.init(parentElement, 'https://example.com', 'server', null)).resolves.not.toThrow();
        });

        it('should provide validate function', async () => {
            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);
            const callbackArg = callback.mock.calls[0][0];
            expect(callbackArg.validate()).toBe(true);
        });

        it('should provide getValue and setValue functions', async () => {
            const initialValue = 'https://example.com/.well-known/jwks.json';
            await jwksValidator.init(parentElement, initialValue, 'server', callback);
            const callbackArg = callback.mock.calls[0][0];

            expect(callbackArg.getValue()).toBe(initialValue);

            const newValue = 'https://newdomain.com/.well-known/jwks.json';
            callbackArg.setValue(newValue);
            expect(callbackArg.getValue()).toBe(newValue);
        });

        it('should handle cleanup', () => {
            expect(() => jwksValidator.cleanup()).not.toThrow();
        });

        it('should handle localhost testing override', () => {
            expect(() => {
                jwksValidator.__setIsLocalhostForTesting(true);
                jwksValidator.__setIsLocalhostForTesting(false);
                jwksValidator.__setIsLocalhostForTesting(null);
            }).not.toThrow();
        });
    });

    describe('UI Creation for Server Type', () => {
        it('should create test connection button for server type', async () => {
            const mockCash = require('cash-dom').default;
            const mockElement = mockCash();

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            expect(mockElement.text).toHaveBeenCalledWith('Test Connection Button');
        });

        it('should display initial instructions', async () => {
            const mockCash = require('cash-dom').default;
            const mockElement = mockCash();

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            expect(mockElement.html).toHaveBeenCalledWith(
                expect.stringContaining('Click the button to validate JWKS')
            );
        });

        it('should handle element with input field properly', async () => {
            const mockCash = require('cash-dom').default;
            mockCash.__setHasInputField(true);

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            expect(mockCash().find).toHaveBeenCalledWith('input');
            // The after method is called on the found input field, not the main element
        });

        it('should handle element without input field (fallback)', async () => {
            const mockCash = require('cash-dom').default;
            mockCash.__setHasInputField(false);

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            expect(mockCash().find).toHaveBeenCalledWith('input');
            expect(mockCash().append).toHaveBeenCalled();
        });

        it('should handle button click and start JWKS validation', async () => {
            const mockCash = require('cash-dom').default;
            const { validateJwksUrl } = require('../../../main/webapp/js/services/apiClient.js');

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            // Trigger button click
            mockCash.__triggerClick();

            // Should show testing message
            expect(mockCash().html).toHaveBeenCalledWith('Testing JWKS...');
            expect(validateJwksUrl).toHaveBeenCalled();
        });
    });

    describe('UI Creation for Non-Server Types', () => {
        it('should not create test connection button for file type', async () => {
            const mockCash = require('cash-dom').default;
            const mockElement = mockCash();

            await jwksValidator.init(parentElement, 'file://jwks.json', 'file', callback);

            expect(mockElement.text).not.toHaveBeenCalledWith('Test Connection Button');
        });

        it('should not create test connection button for memory type', async () => {
            const mockCash = require('cash-dom').default;
            const mockElement = mockCash();

            await jwksValidator.init(parentElement, '{}', 'memory', callback);

            expect(mockElement.text).not.toHaveBeenCalledWith('Test Connection Button');
        });
    });

    describe('Error Handling', () => {
        it('should handle missing i18n values gracefully', async () => {
            const nfCommon = require('nf.Common');
            nfCommon.getI18n.mockReturnValueOnce({});

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);
            expect(callback).toHaveBeenCalled();
        });

        it('should handle null i18n gracefully', async () => {
            const nfCommon = require('nf.Common');
            nfCommon.getI18n.mockReturnValueOnce(null);

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);
            expect(callback).toHaveBeenCalled();
        });
    });

    describe('JWKS Validation', () => {
        it('should handle valid JWKS response', async () => {
            const mockCash = require('cash-dom').default;
            const { validateJwksUrl } = require('../../../main/webapp/js/services/apiClient.js');

            // Set up successful response
            mockValidateJwksUrl = jest.fn().mockResolvedValue({
                valid: true,
                keyCount: 5
            });

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            // Trigger button click
            mockCash.__triggerClick();

            // Wait for promise resolution
            await new Promise(resolve => setTimeout(resolve, 0));

            // Check that validateJwksUrl was called with correct parameter
            expect(validateJwksUrl).toHaveBeenCalledWith('https://example.com');

            // Should display success message
            expect(mockCash().html).toHaveBeenCalledWith(
                expect.stringContaining('Valid JWKS')
            );
        });

        it('should handle invalid JWKS response', async () => {
            const mockCash = require('cash-dom').default;

            // Set up invalid response
            mockValidateJwksUrl = jest.fn().mockResolvedValue({
                valid: false,
                message: 'JWKS is invalid'
            });

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            // Trigger button click
            mockCash.__triggerClick();

            // Wait for promise resolution
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should handle the invalid response (uiErrorDisplay is called)
            const { displayUiError } = require('../../../main/webapp/js/utils/uiErrorDisplay.js');
            expect(displayUiError).toHaveBeenCalled();
        });

        it('should handle AJAX errors', async () => {
            const mockCash = require('cash-dom').default;
            const { validateJwksUrl } = require('../../../main/webapp/js/services/apiClient.js');

            // Set up rejection
            mockValidateJwksUrl = jest.fn().mockRejectedValue({
                status: 500,
                statusText: 'Server Error',
                message: 'Failed to validate'
            });

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            // Test that button click triggers validation
            mockCash.__triggerClick();
            expect(validateJwksUrl).toHaveBeenCalled();

            // Test that initial testing message is shown
            expect(mockCash().html).toHaveBeenCalledWith('Testing JWKS...');

            // Wait for promise rejection
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should handle error
            const { displayUiError } = require('../../../main/webapp/js/utils/uiErrorDisplay.js');
            expect(displayUiError).toHaveBeenCalled();
        });

        it('should handle synchronous exceptions', async () => {
            const mockCash = require('cash-dom').default;
            const { validateJwksUrl } = require('../../../main/webapp/js/services/apiClient.js');

            // Mock validateJwksUrl to throw synchronous error
            validateJwksUrl.mockImplementationOnce(() => {
                throw new Error('Validation setup failed');
            });

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            // Trigger button click (should handle sync exception)
            expect(() => mockCash.__triggerClick()).not.toThrow();

            // Should handle error
            const { displayUiError } = require('../../../main/webapp/js/utils/uiErrorDisplay.js');
            expect(displayUiError).toHaveBeenCalled();
        });

        it('should use callback getValue if available', async () => {
            const callbackWithGetValue = jest.fn();
            callbackWithGetValue.getValue = jest.fn().mockReturnValue('https://custom-url.com');
            const mockCash = require('cash-dom').default;
            const { validateJwksUrl } = require('../../../main/webapp/js/services/apiClient.js');

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callbackWithGetValue);

            // Trigger button click
            mockCash.__triggerClick();

            // Should use getValue from callback
            expect(callbackWithGetValue.getValue).toHaveBeenCalled();

            // Should call validateJwksUrl with custom URL
            expect(validateJwksUrl).toHaveBeenCalledWith('https://custom-url.com');
        });

        it('should fallback to propertyValue when callback getValue not available', async () => {
            const callbackWithoutGetValue = jest.fn();
            const mockCash = require('cash-dom').default;
            const { validateJwksUrl } = require('../../../main/webapp/js/services/apiClient.js');

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callbackWithoutGetValue);

            // Trigger button click
            mockCash.__triggerClick();

            // Should use propertyValue as fallback
            expect(validateJwksUrl).toHaveBeenCalledWith('https://example.com');
        });

        it('should handle empty jwks value with default', async () => {
            const mockCash = require('cash-dom').default;
            const { validateJwksUrl } = require('../../../main/webapp/js/services/apiClient.js');

            await jwksValidator.init(parentElement, '', 'server', callback);

            // Trigger button click
            mockCash.__triggerClick();

            // Should use default JWKS URL
            expect(validateJwksUrl).toHaveBeenCalledWith('https://example.com/.well-known/jwks.json');
        });
    });

    describe('Localhost Behavior', () => {
        it('should show simulated response on AJAX error in localhost mode', async () => {
            const constants = require('../../../main/webapp/js/utils/constants.js');
            constants.getIsLocalhost.mockReturnValue(true);
            const mockCash = require('cash-dom').default;

            // Set up rejection
            mockValidateJwksUrl = jest.fn().mockRejectedValue({
                status: 0,
                statusText: 'Connection refused'
            });

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            // Trigger button click
            mockCash.__triggerClick();

            // Wait for promise rejection
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should display simulated response in localhost
            expect(mockCash().html).toHaveBeenCalledWith(
                expect.stringContaining('Valid JWKS')
            );
            expect(mockCash().html).toHaveBeenCalledWith(
                expect.stringContaining('(Simulated response)')
            );
        });

        it('should show simulated response on synchronous exception in localhost mode', async () => {
            const constants = require('../../../main/webapp/js/utils/constants.js');
            constants.getIsLocalhost.mockReturnValue(true);
            const mockCash = require('cash-dom').default;
            const { validateJwksUrl } = require('../../../main/webapp/js/services/apiClient.js');

            // Mock validateJwksUrl to throw synchronous error
            validateJwksUrl.mockImplementationOnce(() => {
                throw new Error('Connection failed');
            });

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            // Trigger button click (should handle sync exception with localhost behavior)
            mockCash.__triggerClick();

            // Should display simulated response
            expect(mockCash().html).toHaveBeenCalledWith(
                expect.stringContaining('Valid JWKS')
            );
        });

        it('should not show localhost behavior when not in localhost mode', async () => {
            const constants = require('../../../main/webapp/js/utils/constants.js');
            constants.getIsLocalhost.mockReturnValue(false);
            const mockCash = require('cash-dom').default;

            // Set up rejection
            mockValidateJwksUrl = jest.fn().mockRejectedValue({
                status: 500,
                statusText: 'Network Error'
            });

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            // Trigger button click
            mockCash.__triggerClick();

            // Wait for promise rejection
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should handle error normally (not simulated response)
            const { displayUiError } = require('../../../main/webapp/js/utils/uiErrorDisplay.js');
            expect(displayUiError).toHaveBeenCalled();

            // Should NOT show simulated response
            const htmlCalls = mockCash().html.mock.calls;
            const hasSimulatedResponse = htmlCalls.some(call =>
                call[0] && call[0].includes('(Simulated response)')
            );
            expect(hasSimulatedResponse).toBe(false);
        });
    });

    describe('Integration Tests', () => {
        it('should integrate with all required dependencies', async () => {
            const constants = require('../../../main/webapp/js/utils/constants.js');
            const { displayUiError } = require('../../../main/webapp/js/utils/uiErrorDisplay.js');
            const nfCommon = require('nf.Common');

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            expect(constants.getIsLocalhost).toBeDefined();
            expect(displayUiError).toBeDefined();
            expect(nfCommon.getI18n).toBeDefined();
        });

        it('should pass jwks_type in callback data', async () => {
            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);
            const callbackArg = callback.mock.calls[0][0];
            expect(callbackArg.jwks_type).toBe('server');
        });

        it('should provide setValue and getValue functions in callback', async () => {
            await jwksValidator.init(parentElement, 'initial-value', 'server', callback);
            const callbackArg = callback.mock.calls[0][0];

            expect(typeof callbackArg.getValue).toBe('function');
            expect(typeof callbackArg.setValue).toBe('function');
            expect(callbackArg.getValue()).toBe('initial-value');

            // Test setValue
            callbackArg.setValue('new-value');
            expect(callbackArg.getValue()).toBe('new-value');
        });

        it('should handle null callback gracefully', async () => {
            await expect(jwksValidator.init(parentElement, 'https://example.com', 'server', null)).resolves.not.toThrow();
        });

        it('should handle undefined callback gracefully', async () => {
            await expect(jwksValidator.init(parentElement, 'https://example.com', 'server', undefined)).resolves.not.toThrow();
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle malformed AJAX response', async () => {
            const mockCash = require('cash-dom').default;

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            // Trigger button click
            mockCash.__triggerClick();

            // Resolve with malformed response (empty object instead of null)
            mockCash.__resolveAjax({});

            // Wait for promise resolution
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should handle gracefully
            expect(mockCash().html).toHaveBeenCalled();
        });

        it('should handle AJAX response without valid field', async () => {
            const mockCash = require('cash-dom').default;

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            // Trigger button click
            mockCash.__triggerClick();

            // Resolve with response missing valid field
            mockCash.__resolveAjax({ message: 'Some response without valid field' });

            // Wait for promise resolution
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should handle gracefully
            expect(mockCash().html).toHaveBeenCalled();
        });

        it('should handle AJAX timeout error', async () => {
            const mockCash = require('cash-dom').default;

            // Set up timeout rejection
            mockValidateJwksUrl = jest.fn().mockRejectedValue({
                status: 0,
                statusText: 'timeout'
            });

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            // Trigger button click
            mockCash.__triggerClick();

            // Wait for promise rejection
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should handle timeout gracefully
            const { displayUiError } = require('../../../main/webapp/js/utils/uiErrorDisplay.js');
            expect(displayUiError).toHaveBeenCalled();
        });

        it('should handle invalid keyCount in response', async () => {
            const mockCash = require('cash-dom').default;

            // Set up response without keyCount
            mockValidateJwksUrl = jest.fn().mockResolvedValue({ valid: true });

            await jwksValidator.init(parentElement, 'https://example.com', 'server', callback);

            // Trigger button click
            mockCash.__triggerClick();

            // Wait for promise resolution
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should handle gracefully
            expect(mockCash().html).toHaveBeenCalledWith(
                expect.stringContaining('Valid JWKS')
            );
        });

        it('should handle different jwks_type values correctly', async () => {
            const testTypes = ['file', 'memory', 'custom'];

            for (const type of testTypes) {
                callback.mockClear();
                await jwksValidator.init(parentElement, 'test-value', type, callback);

                const callbackArg = callback.mock.calls[0][0];
                expect(callbackArg.jwks_type).toBe(type);
            }
        });

        it('should handle very long JWKS URL', async () => {
            const longUrl = 'https://example.com/' + 'a'.repeat(1000) + '/.well-known/jwks.json';
            const mockCash = require('cash-dom').default;

            await jwksValidator.init(parentElement, longUrl, 'server', callback);

            // Trigger button click
            mockCash.__triggerClick();

            // Should start validation process
            expect(mockCash().html).toHaveBeenCalledWith('Testing JWKS...');
        });

        it('should handle special characters in JWKS URL', async () => {
            const specialUrl = 'https://example.com/jwks?param=value&other=test%20encoded';
            const mockCash = require('cash-dom').default;
            const { validateJwksUrl } = require('../../../main/webapp/js/services/apiClient.js');

            await jwksValidator.init(parentElement, specialUrl, 'server', callback);

            // Trigger button click
            mockCash.__triggerClick();

            // Should handle special characters
            expect(validateJwksUrl).toHaveBeenCalledWith(specialUrl);
        });
    });
});
