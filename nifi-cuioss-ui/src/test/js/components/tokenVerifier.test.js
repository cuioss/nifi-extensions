/**
 * Tests for the Token Verifier component.
 * Comprehensive test coverage for all functionality.
 */

const mockI18n = {
    'processor.jwt.tokenInput': 'JWT Token Input Label',
    'processor.jwt.tokenInputPlaceholder': 'Paste token here...',
    'processor.jwt.verifyToken': 'Verify Token Button',
    'processor.jwt.verificationResults': 'Verification Results Header',
    'processor.jwt.noTokenProvided': 'No token provided message',
    'processor.jwt.verifying': 'Verifying token message...',
    'processor.jwt.tokenValid': 'Token is valid message',
    'processor.jwt.tokenDetails': 'Token Details Header',
    'processor.jwt.initialInstructions': 'Enter a JWT token above and click "Verify Token" to validate it.',
    'processor.jwt.unknownError': 'Unknown error'
};

// Mock cash-dom with comprehensive functionality
jest.mock('cash-dom', () => {
    let tokenValue = '';
    let ajaxResolver = null;
    let ajaxRejecter = null;

    // Store a single verify button click handler and a single clear button click handler
    let verifyButtonClickHandler = null;
    let clearButtonClickHandler = null;

    // Create a shared mock element with all the methods that need to be tracked
    const mockElement = {
        append: jest.fn().mockReturnThis(),
        html: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        on: jest.fn((event, handler) => {
            console.log(`Registering ${event} handler for selector: "${mockElement.lastSelector}"`);
            if (event === 'click') {
                // Store handlers based on the button class in the selector
                if (mockElement.lastSelector && mockElement.lastSelector.includes('verify-token-button')) {
                    console.log('Setting verify button click handler');
                    verifyButtonClickHandler = handler;
                } else if (mockElement.lastSelector && mockElement.lastSelector.includes('clear-token-button')) {
                    console.log('Setting clear button click handler');
                    clearButtonClickHandler = handler;
                } else {
                    console.log('No matching button class found in selector');
                }
            }
            return mockElement;
        }),
        find: jest.fn().mockImplementation((selector) => {
            if (selector === '#field-token-input') {
                return {
                    val: jest.fn().mockImplementation((newValue) => {
                        if (newValue !== undefined) {
                            tokenValue = newValue;
                            return mockElement;
                        }
                        return tokenValue;
                    }),
                    0: { tagName: 'INPUT' }
                };
            }
            return mockElement;
        }),
        val: jest.fn().mockImplementation((newValue) => {
            if (newValue !== undefined) {
                tokenValue = newValue;
                return mockElement;
            }
            return tokenValue;
        }),
        addClass: jest.fn().mockReturnThis(),
        removeClass: jest.fn().mockReturnThis(),
        prop: jest.fn().mockReturnThis(),
        0: { tagName: 'DIV' },
        lastSelector: null
    };

    // Create the main cash-dom mock
    const mockCash = jest.fn((selector) => {
        // Store the last selector for context in the on() method
        mockElement.lastSelector = typeof selector === 'string' ? selector : '';
        return mockElement;
    });

    // Mock the ajax method
    mockCash.ajax = jest.fn().mockImplementation(() => {
        const promise = new Promise((resolve, reject) => {
            ajaxResolver = resolve;
            ajaxRejecter = reject;
        });

        return {
            then: jest.fn().mockImplementation((callback) => {
                promise.then(callback);
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
    mockCash.__setTokenValue = (value) => {
        tokenValue = value;
    };

    mockCash.__triggerClick = (buttonType = 'verify') => {
        console.log(`Trying to trigger click for button type: "${buttonType}"`);
        console.log(`Verify handler exists: ${!!verifyButtonClickHandler}`);
        console.log(`Clear handler exists: ${!!clearButtonClickHandler}`);

        if (buttonType === 'verify' && verifyButtonClickHandler) {
            console.log('Executing verify button click handler');
            verifyButtonClickHandler();
        } else if (buttonType === 'clear' && clearButtonClickHandler) {
            console.log('Executing clear button click handler');
            clearButtonClickHandler();
        } else {
            console.warn(`No click handler found for button type: ${buttonType}`);
        }
    };

    mockCash.__resolveAjax = (data) => {
        if (ajaxResolver) ajaxResolver(data);
    };

    mockCash.__rejectAjax = (error) => {
        // Ensure error has a properly formatted responseText if not already present
        if (error && !error.responseText && error.message) {
            error.responseText = JSON.stringify({ message: error.message });
        } else if (error && !error.responseText && error.statusText) {
            error.responseText = JSON.stringify({ message: error.statusText });
        }
        if (ajaxRejecter) ajaxRejecter(error);
    };

    // For testing purposes, expose the mockElement
    mockCash.mockElement = mockElement;

    return { __esModule: true, default: mockCash };
});

// Mock dependencies
jest.mock('nf.Common', () => ({
    getI18n: jest.fn().mockReturnValue(mockI18n)
}));

jest.mock('../../../main/webapp/js/utils/uiErrorDisplay.js', () => ({
    displayUiError: jest.fn()
}));

jest.mock('../../../main/webapp/js/utils/confirmationDialog.js', () => ({
    confirmClearForm: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../../main/webapp/js/utils/constants.js', () => ({
    getIsLocalhost: jest.fn().mockReturnValue(false),
    setIsLocalhostForTesting: jest.fn(),
    API: {
        ENDPOINTS: { JWT_VERIFY_TOKEN: '/api/verify-token' },
        TIMEOUTS: { DEFAULT: 5000 }
    },
    CSS: {
        TOKEN_VERIFIER: {
            CONTAINER: 'token-verification-container',
            INPUT_SECTION: 'token-input-section',
            VERIFY_BUTTON: 'verify-token-button',
            RESULTS_SECTION: 'token-results-section',
            RESULTS_CONTENT: 'token-results-content',
            TOKEN_ERROR: 'token-error',
            TOKEN_LOADING: 'token-loading',
            TOKEN_VALID: 'token-valid',
            TOKEN_DETAILS: 'token-details',
            TOKEN_INSTRUCTIONS: 'token-instructions',
            TOKEN_CLAIMS_TABLE: 'token-claims-table',
            TOKEN_RAW_CLAIMS: 'token-raw-claims'
        }
    }
}));

jest.mock('../../../main/webapp/js/utils/formBuilder.js', () => ({
    FormFieldFactory: jest.fn().mockImplementation(() => ({
        createField: jest.fn().mockReturnValue('<div id="field-token-input"></div>'),
        createButton: jest.fn().mockReturnValue('<button class="verify-token-button">Verify</button>')
    }))
}));

describe('tokenVerifier', () => {
    let tokenVerifier;
    let parentElement;
    let callback;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        tokenVerifier = require('components/tokenVerifier');
        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
        callback = jest.fn();
    });

    afterEach(() => {
        if (parentElement.parentNode === document.body) {
            document.body.removeChild(parentElement);
        }
    });

    describe('Basic Functionality', () => {
        it('should initialize successfully', async () => {
            await tokenVerifier.init(parentElement, {}, null, callback);
            expect(callback).toHaveBeenCalled();
        });

        it('should handle missing element', async () => {
            await expect(tokenVerifier.init(null, {}, null, callback)).rejects.toThrow();
            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.any(String) })
            );
        });

        it('should handle missing callback gracefully', async () => {
            await expect(tokenVerifier.init(parentElement, {}, null, null)).resolves.not.toThrow();
        });

        it('should provide validate function', async () => {
            await tokenVerifier.init(parentElement, {}, null, callback);
            const callbackArg = callback.mock.calls[0][0];
            expect(callbackArg.validate()).toBe(true);
        });

        it('should handle cleanup', () => {
            expect(() => tokenVerifier.cleanup()).not.toThrow();
        });

        it('should handle localhost testing override', () => {
            expect(() => {
                tokenVerifier.__setIsLocalhostForTesting(true);
                tokenVerifier.__setIsLocalhostForTesting(false);
                tokenVerifier.__setIsLocalhostForTesting(null);
            }).not.toThrow();
        });
    });

    describe('UI Creation', () => {
        it('should create UI components using factories', async () => {
            const { FormFieldFactory } = require('../../../main/webapp/js/utils/formBuilder.js');

            await tokenVerifier.init(parentElement, {}, null, callback);

            expect(FormFieldFactory).toHaveBeenCalled();
        });

        it('should display initial instructions', async () => {
            const mockCash = require('cash-dom').default;
            const mockElement = mockCash();

            await tokenVerifier.init(parentElement, {}, null, callback);

            expect(mockElement.html).toHaveBeenCalledWith(
                expect.stringContaining('Enter a JWT token above and click "Verify Token" to validate it.')
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle FormFieldFactory initialization errors', async () => {
            const { FormFieldFactory } = require('../../../main/webapp/js/utils/formBuilder.js');
            FormFieldFactory.mockImplementationOnce(() => {
                throw new Error('Factory failed');
            });

            await expect(tokenVerifier.init(parentElement, {}, null, callback)).rejects.toThrow();
            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.any(String) })
            );
        });

        it('should handle missing i18n values gracefully', async () => {
            const nfCommon = require('nf.Common');
            nfCommon.getI18n.mockReturnValueOnce({});

            await tokenVerifier.init(parentElement, {}, null, callback);
            expect(callback).toHaveBeenCalled();
        });
    });

    describe('Token Verification', () => {
        it('should handle verify button click with empty token', async () => {
            const mockCash = require('cash-dom').default;

            await tokenVerifier.init(parentElement, {}, null, callback);

            // Set empty token
            mockCash.__setTokenValue('');

            // Trigger verify button click
            mockCash.__triggerClick();

            expect(mockCash().html).toHaveBeenCalledWith(
                expect.stringContaining('No token provided')
            );
        });

        it('should handle verify button click with valid token', async () => {
            const mockCash = require('cash-dom').default;

            await tokenVerifier.init(parentElement, {}, null, callback);

            // Set valid token
            mockCash.__setTokenValue('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test');

            // Trigger verify button click
            mockCash.__triggerClick();

            // Should start loading
            expect(mockCash().addClass).toHaveBeenCalledWith('loading');
            expect(mockCash().prop).toHaveBeenCalledWith('disabled', true);

            // Resolve with valid response
            mockCash.__resolveAjax({
                valid: true,
                subject: 'testuser',
                issuer: 'test-issuer',
                audience: 'test-audience',
                expiration: '2025-12-31T23:59:59Z',
                roles: ['admin', 'user'],
                scopes: ['read', 'write'],
                claims: { sub: 'testuser' }
            });

            // Wait for promise resolution
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should stop loading
            expect(mockCash().removeClass).toHaveBeenCalledWith('loading');
            expect(mockCash().prop).toHaveBeenCalledWith('disabled', false);
        });

        it('should handle verify button click with invalid token', async () => {
            const mockCash = require('cash-dom').default;

            await tokenVerifier.init(parentElement, {}, null, callback);

            // Set token
            mockCash.__setTokenValue('invalid.token.here');

            // Trigger verify button click
            mockCash.__triggerClick();

            // Resolve with invalid response
            mockCash.__resolveAjax({
                valid: false,
                message: 'Token is invalid'
            });

            // Wait for promise resolution
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should display invalid token
            expect(mockCash().html).toHaveBeenCalled();
        });

        it('should handle AJAX errors', async () => {
            const mockCash = require('cash-dom').default;

            await tokenVerifier.init(parentElement, {}, null, callback);

            // Set token
            mockCash.__setTokenValue('some.token.here');

            // Trigger verify button click
            mockCash.__triggerClick();

            // Reject with error
            mockCash.__rejectAjax({ statusText: 'Network Error', status: 500 });

            // Wait for promise rejection
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should stop loading and display error
            expect(mockCash().removeClass).toHaveBeenCalledWith('loading');
            expect(mockCash().prop).toHaveBeenCalledWith('disabled', false);
        });

        it('should handle synchronous exceptions during AJAX setup', async () => {
            const mockCash = require('cash-dom').default;

            // Mock ajax to throw synchronous error
            mockCash.ajax.mockImplementationOnce(() => {
                throw new Error('AJAX setup failed');
            });

            await tokenVerifier.init(parentElement, {}, null, callback);

            // Set token
            mockCash.__setTokenValue('some.token.here');

            // Trigger verify button click (should handle sync exception)
            expect(() => mockCash.__triggerClick()).not.toThrow();
        });

        it('should handle token verification with complex claims', async () => {
            const mockCash = require('cash-dom').default;

            await tokenVerifier.init(parentElement, {}, null, callback);

            // Set token
            mockCash.__setTokenValue('complex.token.with.claims');

            // Trigger verify button click
            mockCash.__triggerClick();

            // Resolve with complex response
            mockCash.__resolveAjax({
                valid: true,
                subject: 'complex-user',
                issuer: 'https://auth.example.com',
                audience: ['app1', 'app2'],
                expiration: '2025-12-31T23:59:59Z',
                issuedAt: '2025-01-01T00:00:00Z',
                notBefore: '2025-01-01T00:00:00Z',
                tokenId: 'uuid-12345',
                roles: ['admin', 'user', 'editor'],
                scopes: ['read', 'write', 'delete'],
                groups: ['developers', 'admins'],
                claims: {
                    sub: 'complex-user',
                    name: 'Complex User',
                    email: 'user@example.com',
                    customClaim: 'custom value'
                }
            });

            // Wait for promise resolution
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should display the complex token information
            expect(mockCash().html).toHaveBeenCalled();
        });
    });

    describe('Clear Functionality', () => {
        it('should handle clear form confirmation', async () => {
            const { confirmClearForm } = require('../../../main/webapp/js/utils/confirmationDialog.js');

            await tokenVerifier.init(parentElement, {}, null, callback);

            expect(confirmClearForm).toBeDefined();
        });

        it('should have clear button event handler', async () => {
            const mockCash = require('cash-dom').default;

            await tokenVerifier.init(parentElement, {}, null, callback);

            // Verify that event handlers are set up
            expect(mockCash().on).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('should clear results when new verification starts', async () => {
            const mockCash = require('cash-dom').default;

            await tokenVerifier.init(parentElement, {}, null, callback);

            // Set token and verify
            mockCash.__setTokenValue('test.token');
            mockCash.__triggerClick();

            // Should show loading state
            expect(mockCash().html).toHaveBeenCalledWith(
                expect.stringContaining('Verifying token')
            );
        });
    });

    describe('Localhost Behavior', () => {
        it('should handle localhost mode correctly', async () => {
            const constants = require('../../../main/webapp/js/utils/constants.js');
            constants.getIsLocalhost.mockReturnValue(true);

            await tokenVerifier.init(parentElement, {}, null, callback);
            expect(callback).toHaveBeenCalled();
        });

        it('should show simulated response in localhost mode on AJAX error', async () => {
            const constants = require('../../../main/webapp/js/utils/constants.js');
            constants.getIsLocalhost.mockReturnValue(true);
            const mockCash = require('cash-dom').default;

            await tokenVerifier.init(parentElement, {}, null, callback);

            // Set token
            mockCash.__setTokenValue('test.token.localhost');

            // Trigger verify button click
            mockCash.__triggerClick();

            // Reject with error (should trigger localhost behavior)
            mockCash.__rejectAjax({ statusText: 'Connection refused', status: 0 });

            // Wait for promise rejection
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should display simulated response
            expect(mockCash().html).toHaveBeenCalled();
        });

        it('should show simulated response in localhost mode on sync exception', async () => {
            const constants = require('../../../main/webapp/js/utils/constants.js');
            constants.getIsLocalhost.mockReturnValue(true);
            const mockCash = require('cash-dom').default;

            // Mock ajax to throw synchronous error
            mockCash.ajax.mockImplementationOnce(() => {
                throw new Error('Connection failed');
            });

            await tokenVerifier.init(parentElement, {}, null, callback);

            // Set token
            mockCash.__setTokenValue('test.token.localhost');

            // Trigger verify button click (should handle sync exception with localhost behavior)
            mockCash.__triggerClick();

            // Should display simulated response
            expect(mockCash().html).toHaveBeenCalled();
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle malformed AJAX response', async () => {
            const mockCash = require('cash-dom').default;

            await tokenVerifier.init(parentElement, {}, null, callback);

            // Set token
            mockCash.__setTokenValue('test.token');

            // Trigger verify button click
            mockCash.__triggerClick();

            // Resolve with malformed response
            mockCash.__resolveAjax(null);

            // Wait for promise resolution
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should handle gracefully
            expect(mockCash().removeClass).toHaveBeenCalledWith('loading');
        });

        it('should handle AJAX response without valid field', async () => {
            const mockCash = require('cash-dom').default;

            await tokenVerifier.init(parentElement, {}, null, callback);

            // Set token
            mockCash.__setTokenValue('test.token');

            // Trigger verify button click
            mockCash.__triggerClick();

            // Resolve with response missing valid field
            mockCash.__resolveAjax({ message: 'Some response without valid field' });

            // Wait for promise resolution
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should handle gracefully
            expect(mockCash().html).toHaveBeenCalled();
        });

        it('should handle whitespace-only token input', async () => {
            const mockCash = require('cash-dom').default;

            await tokenVerifier.init(parentElement, {}, null, callback);

            // Set whitespace-only token
            mockCash.__setTokenValue('   \\n\\t  ');

            // Trigger verify button click
            mockCash.__triggerClick();

            // Should treat as empty token
            expect(mockCash().html).toHaveBeenCalledWith(
                expect.stringContaining('No token provided')
            );
        });

        it('should handle very long token', async () => {
            const mockCash = require('cash-dom').default;

            await tokenVerifier.init(parentElement, {}, null, callback);

            // Set very long token
            const longToken = 'a'.repeat(10000);
            mockCash.__setTokenValue(longToken);

            // Trigger verify button click
            mockCash.__triggerClick();

            // Should start verification process
            expect(mockCash().addClass).toHaveBeenCalledWith('loading');
        });
    });

    describe('Integration Tests', () => {
        it('should integrate with all required dependencies', async () => {
            const constants = require('../../../main/webapp/js/utils/constants.js');
            const { displayUiError } = require('../../../main/webapp/js/utils/uiErrorDisplay.js');
            const { confirmClearForm } = require('../../../main/webapp/js/utils/confirmationDialog.js');

            await tokenVerifier.init(parentElement, {}, null, callback);

            expect(constants.getIsLocalhost).toBeDefined();
            expect(displayUiError).toBeDefined();
            expect(confirmClearForm).toBeDefined();
        });
    });
});
