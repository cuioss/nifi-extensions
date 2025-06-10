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

    // Store button click handlers
    let verifyButtonClickHandler = null;
    let clearButtonClickHandler = null;

    // Track button creation
    let lastCreatedButtonHTML = '';

    const createMockElement = (isButton = false, buttonHTML = '', cssClass = '') => ({
        append: jest.fn().mockReturnThis(),
        html: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        on: jest.fn((event, handler) => {
            if (event === 'click') {
                // Capture handlers based on CSS class or button HTML
                if (cssClass.includes('verify-token-button') || buttonHTML.includes('verify-token-button')) {
                    verifyButtonClickHandler = handler;
                } else if (cssClass.includes('clear-token-button') || buttonHTML.includes('clear-token-button')) {
                    clearButtonClickHandler = handler;
                }
            }
            return createMockElement(isButton, buttonHTML, cssClass);
        }),
        find: jest.fn().mockImplementation((selector) => {
            if (selector === '#field-token-input') {
                return {
                    val: jest.fn().mockImplementation((newValue) => {
                        if (newValue !== undefined) {
                            tokenValue = newValue;
                            return createMockElement();
                        }
                        return tokenValue.trim();
                    }),
                    0: { tagName: 'INPUT' }
                };
            }
            return createMockElement();
        }),
        val: jest.fn().mockImplementation((newValue) => {
            if (newValue !== undefined) {
                tokenValue = newValue;
                return createMockElement();
            }
            return tokenValue;
        }),
        addClass: jest.fn().mockReturnThis(),
        removeClass: jest.fn().mockReturnThis(),
        prop: jest.fn().mockReturnThis(),
        0: { tagName: isButton ? 'BUTTON' : 'DIV' }
    });

    // Create the main cash-dom mock
    const mockCash = jest.fn((selector) => {
        // Handle button creation from HTML
        if (typeof selector === 'string' && selector.includes('<button')) {
            lastCreatedButtonHTML = selector;
            return createMockElement(true, selector);
        }

        // Handle CSS class selection that captures handlers
        if (typeof selector === 'string') {
            return createMockElement(false, '', selector);
        }

        // Handle regular element creation/selection
        return createMockElement();
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
        if (buttonType === 'verify' && verifyButtonClickHandler) {
            verifyButtonClickHandler();
        } else if (buttonType === 'clear' && clearButtonClickHandler) {
            clearButtonClickHandler();
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

        it('should initialize successfully and call callback', async () => {
            await tokenVerifier.init(parentElement, {}, null, callback);

            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({ validate: expect.any(Function) })
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

    describe('Token Verification Internal Functions', () => {
        it('should handle token verification response correctly', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { 'processor.jwt.tokenValid': 'Token is valid' };
            const mockDisplayValid = jest.fn();
            const mockDisplayInvalid = jest.fn();

            // Test valid response
            tokenVerifier.__test.handleTokenVerificationResponse(
                { valid: true, subject: 'test' },
                mockResultsContent,
                mockI18n,
                mockDisplayValid,
                mockDisplayInvalid
            );

            expect(mockDisplayValid).toHaveBeenCalledWith({ valid: true, subject: 'test' }, false);

            // Test invalid response
            tokenVerifier.__test.handleTokenVerificationResponse(
                { valid: false, message: 'Invalid' },
                mockResultsContent,
                mockI18n,
                mockDisplayValid,
                mockDisplayInvalid
            );

            expect(mockDisplayInvalid).toHaveBeenCalledWith(
                { valid: false, message: 'Invalid' },
                mockResultsContent,
                mockI18n
            );
        });

        it('should extract error messages from XHR responses', () => {
            // Test with JSON responseText
            let errorMessage = tokenVerifier.__test.extractErrorMessageFromXHR({
                statusText: 'Error',
                responseText: '{"message": "Custom error"}'
            });
            expect(errorMessage).toBe('Custom error');

            // Test with plain text responseText
            errorMessage = tokenVerifier.__test.extractErrorMessageFromXHR({
                statusText: 'Error',
                responseText: 'Plain text error'
            });
            expect(errorMessage).toBe('Plain text error');

            // Test with statusText only
            errorMessage = tokenVerifier.__test.extractErrorMessageFromXHR({
                statusText: 'Network Error'
            });
            expect(errorMessage).toBe('Network Error');

            // Test with malformed JSON
            errorMessage = tokenVerifier.__test.extractErrorMessageFromXHR({
                statusText: 'Error',
                responseText: '{"malformed": json'
            });
            expect(errorMessage).toBe('Error');
        });

        it('should sanitize error messages properly', () => {
            const mockI18n = { 'processor.jwt.unknownError': 'Unknown error' };

            // Test null/undefined values
            expect(tokenVerifier.__test.sanitizeErrorMessage(null, mockI18n)).toBe('Unknown error');
            expect(tokenVerifier.__test.sanitizeErrorMessage(undefined, mockI18n)).toBe('Unknown error');
            expect(tokenVerifier.__test.sanitizeErrorMessage('', mockI18n)).toBe('Unknown error');
            expect(tokenVerifier.__test.sanitizeErrorMessage('null', mockI18n)).toBe('Unknown error');
            expect(tokenVerifier.__test.sanitizeErrorMessage('undefined', mockI18n)).toBe('Unknown error');

            // Test valid message
            expect(tokenVerifier.__test.sanitizeErrorMessage('Valid error', mockI18n)).toBe('Valid error');
        });

        it('should create sample token response for localhost', () => {
            const sampleResponse = tokenVerifier.__test.createSampleTokenResponse();

            expect(sampleResponse.valid).toBe(true);
            expect(sampleResponse.subject).toBe('user123');
            expect(sampleResponse.issuer).toBe('https://sample-issuer.example.com');
            expect(sampleResponse.audience).toBe('sample-audience');
            expect(sampleResponse.roles).toEqual(['admin', 'user']);
            expect(sampleResponse.scopes).toEqual(['read', 'write']);
            expect(sampleResponse.claims).toHaveProperty('sub', 'user123');
            expect(sampleResponse.claims).toHaveProperty('email', 'john.doe@example.com');
        });

        it('should handle AJAX error scenarios correctly', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { 'processor.jwt.verificationError': 'Verification error' };
            const mockDisplayValid = jest.fn();
            const consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

            // Test localhost mode with AJAX error
            require('../../../main/webapp/js/utils/constants.js').getIsLocalhost.mockReturnValue(true);

            tokenVerifier.__test.handleTokenVerificationAjaxError(
                { statusText: 'Network Error', status: 500 },
                mockResultsContent,
                mockI18n,
                mockDisplayValid
            );

            // Should log extracted error message
            expect(consoleSpy).toHaveBeenCalledWith('Extracted error message:', 'Network Error');

            // Should show simulated response in localhost
            expect(mockDisplayValid).toHaveBeenCalledWith(expect.objectContaining({
                valid: true,
                subject: 'user123'
            }), true);

            // Reset localhost mode
            require('../../../main/webapp/js/utils/constants.js').getIsLocalhost.mockReturnValue(false);
            consoleSpy.mockRestore();
        });

        it('should handle synchronous exceptions correctly', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = {
                'processor.jwt.verificationError': 'Verification error',
                'processor.jwt.unknownError': 'Unknown error'
            };
            const mockDisplayValid = jest.fn();
            const consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

            // Test localhost mode with sync exception
            require('../../../main/webapp/js/utils/constants.js').getIsLocalhost.mockReturnValue(true);

            tokenVerifier.__test.handleTokenVerificationSyncException(
                new Error('AJAX setup failed'),
                mockResultsContent,
                mockI18n,
                mockDisplayValid
            );

            // Should log sanitized error message
            expect(consoleSpy).toHaveBeenCalledWith('Sanitized error message:', 'AJAX setup failed');

            // Should show simulated response in localhost
            expect(mockDisplayValid).toHaveBeenCalledWith(expect.objectContaining({
                valid: true,
                subject: 'user123'
            }), true);

            // Reset localhost mode
            require('../../../main/webapp/js/utils/constants.js').getIsLocalhost.mockReturnValue(false);
            consoleSpy.mockRestore();
        });

        it('should show initial instructions correctly', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { 'processor.jwt.initialInstructions': 'Test instructions' };

            tokenVerifier.__test.showInitialInstructions(mockResultsContent, mockI18n);

            expect(mockResultsContent.html).toHaveBeenCalledWith(
                expect.stringContaining('Test instructions')
            );
        });

        it('should show loading state correctly', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { 'processor.jwt.verifying': 'Verifying...' };

            tokenVerifier.__test.resetUIAndShowLoading(mockResultsContent, mockI18n);

            expect(mockResultsContent.html).toHaveBeenCalledWith(
                expect.stringContaining('Verifying...')
            );
        });

        it('should handle verify button click with empty token', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { 'processor.jwt.noTokenProvided': 'No token provided' };
            const mockResetButton = jest.fn();

            const result = tokenVerifier.__test.handleVerifyButtonClick('', mockResultsContent, mockI18n, mockResetButton);

            expect(result).toBe(false);
            expect(mockResultsContent.html).toHaveBeenCalledWith(
                expect.stringContaining('No token provided')
            );
        });

        it('should handle verify button click with valid token', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { 'processor.jwt.verifying': 'Verifying...' };
            const mockResetButton = jest.fn();

            const result = tokenVerifier.__test.handleVerifyButtonClick('valid.token', mockResultsContent, mockI18n, mockResetButton);

            expect(result).toBe(true);
            expect(mockResultsContent.html).toHaveBeenCalledWith(
                expect.stringContaining('Verifying...')
            );
        });

        it('should handle verify button click with whitespace token', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { 'processor.jwt.noTokenProvided': 'No token provided' };
            const mockResetButton = jest.fn();

            const result = tokenVerifier.__test.handleVerifyButtonClick('   ', mockResultsContent, mockI18n, mockResetButton);

            expect(result).toBe(false);
            expect(mockResultsContent.html).toHaveBeenCalledWith(
                expect.stringContaining('No token provided')
            );
        });

        it('should handle clear button click with empty form', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { };

            const result = tokenVerifier.__test.handleClearButtonClick('', '', mockResultsContent, mockI18n);

            expect(result).toBe(false);
            expect(mockResultsContent.html).toHaveBeenCalledWith(
                '<div class="info-message">Form is already empty.</div>'
            );
        });

        it('should handle clear button click with token content', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { };

            const result = tokenVerifier.__test.handleClearButtonClick('some.token', '', mockResultsContent, mockI18n);

            expect(result).toBe(true);
        });

        it('should handle clear button click with results content', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { };

            const result = tokenVerifier.__test.handleClearButtonClick('', '<div>Some results</div>', mockResultsContent, mockI18n);

            expect(result).toBe(true);
        });

        it('should handle timeout management for clear button when form is empty', () => {
            // Mock setTimeout to capture timeout behavior
            const originalSetTimeout = global.setTimeout;
            const mockSetTimeout = jest.fn((fn, delay) => {
                fn(); // Execute immediately for testing
                return 123; // Mock timeout ID
            });
            global.setTimeout = mockSetTimeout;

            // Mock window._tokenVerifierTimeouts to simulate the timeout tracking
            const originalTimeouts = global.window._tokenVerifierTimeouts;
            global.window._tokenVerifierTimeouts = [];

            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { };

            const result = tokenVerifier.__test.handleClearButtonClick('', '', mockResultsContent, mockI18n);

            expect(result).toBe(false);
            expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);
            expect(mockResultsContent.html).toHaveBeenCalledWith(
                '<div class="info-message">Form is already empty.</div>'
            );

            // Restore original functions
            global.setTimeout = originalSetTimeout;
            global.window._tokenVerifierTimeouts = originalTimeouts;
        });

        it('should handle clear button click with whitespace results', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { };

            const result = tokenVerifier.__test.handleClearButtonClick('', '   \n\t   ', mockResultsContent, mockI18n);

            expect(result).toBe(false);
            expect(mockResultsContent.html).toHaveBeenCalledWith(
                '<div class="info-message">Form is already empty.</div>'
            );
        });
    });

    describe('Additional Edge Cases and Validation', () => {
        it('should handle missing callback in init gracefully', async () => {
            await expect(tokenVerifier.init(parentElement, {}, null, null)).resolves.not.toThrow();
        });

        it('should handle null i18n resources', async () => {
            const nfCommon = require('nf.Common');
            nfCommon.getI18n.mockReturnValueOnce(null);

            await tokenVerifier.init(parentElement, {}, null, callback);
            expect(callback).toHaveBeenCalled();
        });

        it('should handle undefined config object', async () => {
            await tokenVerifier.init(parentElement, undefined, null, callback);
            expect(callback).toHaveBeenCalled();
        });

        it('should handle init function error path with null element', async () => {
            const mockCallback = jest.fn();

            await expect(tokenVerifier.init(null, {}, null, mockCallback)).rejects.toThrow('Token verifier element is required');

            // Should still call callback with error info
            expect(mockCallback).toHaveBeenCalledWith({
                validate: expect.any(Function),
                error: 'Token verifier element is required'
            });

            // Validate function should return false
            const callbackArg = mockCallback.mock.calls[0][0];
            expect(callbackArg.validate()).toBe(false);
        });

        it('should handle init function error path with undefined element', async () => {
            const mockCallback = jest.fn();

            await expect(tokenVerifier.init(undefined, {}, null, mockCallback)).rejects.toThrow('Token verifier element is required');

            expect(mockCallback).toHaveBeenCalledWith({
                validate: expect.any(Function),
                error: 'Token verifier element is required'
            });
        });

        it('should handle init function without callback', async () => {
            // Should not throw even without callback
            await expect(tokenVerifier.init(null, {}, null, null)).rejects.toThrow('Token verifier element is required');
        });

        it('should validate with complex error response structures', () => {
            // Test with nested JSON error
            const complexError = {
                statusText: 'Server Error',
                responseText: '{"error": {"message": "Complex nested error", "code": 500}}'
            };

            const result = tokenVerifier.__test.extractErrorMessageFromXHR(complexError);
            // Should fallback to statusText when nested message isn't found
            expect(result).toBe('Server Error');
        });

        it('should handle timeout management in actual UI flow', async () => {
            // Mock window._tokenVerifierTimeouts if not exists
            const originalTimeouts = global.window._tokenVerifierTimeouts;
            delete global.window._tokenVerifierTimeouts;

            await tokenVerifier.init(parentElement, {}, null, callback);

            // Simulate clear button click on empty form to test timeout tracking
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = {};

            // Mock setTimeout to capture the call
            const originalSetTimeout = global.setTimeout;
            const mockSetTimeout = jest.fn(() => 123); // Mock timeout ID
            global.setTimeout = mockSetTimeout;

            tokenVerifier.__test.handleClearButtonClick('', '', mockResultsContent, mockI18n);

            // Should have called setTimeout
            expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);

            // Restore
            global.setTimeout = originalSetTimeout;
            global.window._tokenVerifierTimeouts = originalTimeouts;
        });

        it('should handle non-localhost AJAX error path', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { 'processor.jwt.verificationError': 'Verification error' };
            const mockDisplayValid = jest.fn();

            // Test non-localhost mode with AJAX error
            require('../../../main/webapp/js/utils/constants.js').getIsLocalhost.mockReturnValue(false);

            // Mock displayUiError to capture the call
            const mockDisplayUiError = jest.fn();
            jest.doMock('../../../main/webapp/js/utils/uiErrorDisplay.js', () => ({
                displayUiError: mockDisplayUiError
            }));

            tokenVerifier.__test.handleTokenVerificationAjaxError(
                { statusText: 'Network Error', status: 500 },
                mockResultsContent,
                mockI18n,
                mockDisplayValid
            );

            // Should NOT show simulated response in non-localhost
            expect(mockDisplayValid).not.toHaveBeenCalled();

            // Reset localhost mode
            require('../../../main/webapp/js/utils/constants.js').getIsLocalhost.mockReturnValue(false);
        });

        it('should handle non-localhost sync exception path', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { 'processor.jwt.verificationError': 'Verification error' };
            const mockDisplayValid = jest.fn();

            // Test non-localhost mode with sync exception
            require('../../../main/webapp/js/utils/constants.js').getIsLocalhost.mockReturnValue(false);

            tokenVerifier.__test.handleTokenVerificationSyncException(
                new Error('Sync error'),
                mockResultsContent,
                mockI18n,
                mockDisplayValid
            );

            // Should NOT show simulated response in non-localhost
            expect(mockDisplayValid).not.toHaveBeenCalled();

            // Reset localhost mode
            require('../../../main/webapp/js/utils/constants.js').getIsLocalhost.mockReturnValue(false);
        });

        it('should handle empty responseText scenarios', () => {
            const emptyResponseError = {
                statusText: 'No Content',
                responseText: ''
            };

            const result = tokenVerifier.__test.extractErrorMessageFromXHR(emptyResponseError);
            expect(result).toBe('No Content');
        });

        it('should handle array responseText', () => {
            const arrayResponseError = {
                statusText: 'Array Error',
                responseText: '[{"message": "Array error"}]'
            };

            const result = tokenVerifier.__test.extractErrorMessageFromXHR(arrayResponseError);
            expect(result).toBe('Array Error');
        });

        it('should handle non-localhost environment errors gracefully', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { 'processor.jwt.verificationError': 'Verification failed' };
            const mockDisplayValid = jest.fn();

            // Ensure localhost is false
            require('../../../main/webapp/js/utils/constants.js').getIsLocalhost.mockReturnValue(false);

            tokenVerifier.__test.handleTokenVerificationAjaxError(
                { statusText: 'Network Error', status: 500 },
                mockResultsContent,
                mockI18n,
                mockDisplayValid
            );

            // Should call displayUiError, not display valid token
            expect(mockDisplayValid).not.toHaveBeenCalled();
        });

        it('should handle non-localhost sync exceptions gracefully', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { 'processor.jwt.verificationError': 'Verification failed' };
            const mockDisplayValid = jest.fn();

            // Ensure localhost is false
            require('../../../main/webapp/js/utils/constants.js').getIsLocalhost.mockReturnValue(false);

            tokenVerifier.__test.handleTokenVerificationSyncException(
                new Error('Sync error'),
                mockResultsContent,
                mockI18n,
                mockDisplayValid
            );

            // Should call displayUiError, not display valid token
            expect(mockDisplayValid).not.toHaveBeenCalled();
        });

        it('should handle trimmed whitespace token in verify handler', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { 'processor.jwt.verifying': 'Verifying...' };
            const mockResetButton = jest.fn();

            const result = tokenVerifier.__test.handleVerifyButtonClick('  valid.token  ', mockResultsContent, mockI18n, mockResetButton);

            expect(result).toBe(true);
            expect(mockResultsContent.html).toHaveBeenCalledWith(
                expect.stringContaining('Verifying...')
            );
        });

        it('should handle mixed content scenarios in clear handler', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { };

            // Token with whitespace, but valid HTML results
            const result = tokenVerifier.__test.handleClearButtonClick('  ', '<div>Valid HTML content</div>', mockResultsContent, mockI18n);

            expect(result).toBe(true);
        });

        it('should handle null token value in clear handler', () => {
            const mockResultsContent = { html: jest.fn() };
            const mockI18n = { };

            const result = tokenVerifier.__test.handleClearButtonClick(null, null, mockResultsContent, mockI18n);

            expect(result).toBe(false);
            expect(mockResultsContent.html).toHaveBeenCalledWith(
                '<div class="info-message">Form is already empty.</div>'
            );
        });

        it('should create valid token HTML with roles and scopes', () => {
            const mockResponse = {
                subject: 'test-user',
                issuer: 'https://test-issuer.com',
                audience: 'test-audience',
                expiration: '2024-01-01T00:00:00Z',
                roles: ['admin', 'user'],
                scopes: ['read', 'write'],
                claims: { sub: 'test-user', roles: ['admin', 'user'] }
            };
            const mockI18n = {
                'processor.jwt.tokenValid': 'Token is valid',
                'processor.jwt.tokenDetails': 'Token Details',
                'processor.jwt.subject': 'Subject',
                'processor.jwt.issuer': 'Issuer',
                'processor.jwt.audience': 'Audience',
                'processor.jwt.expiration': 'Expiration',
                'processor.jwt.roles': 'Roles',
                'processor.jwt.scopes': 'Scopes',
                'processor.jwt.allClaims': 'All Claims'
            };
            const mockCSS = {
                TOKEN_VERIFIER: {
                    TOKEN_VALID: 'token-valid',
                    TOKEN_DETAILS: 'token-details',
                    TOKEN_CLAIMS_TABLE: 'token-claims-table',
                    TOKEN_RAW_CLAIMS: 'token-raw-claims'
                }
            };

            const html = tokenVerifier.__test.createValidTokenHtml(mockResponse, false, mockI18n, mockCSS);

            expect(html).toContain('Token is valid');
            expect(html).toContain('test-user');
            expect(html).toContain('admin, user');
            expect(html).toContain('read write');
            expect(html).toContain('https://test-issuer.com');
            expect(html).toContain('test-audience');
            expect(html).toContain('2024-01-01T00:00:00Z');
        });

        it('should create valid token HTML without roles and scopes', () => {
            const mockResponse = {
                subject: 'test-user',
                issuer: 'https://test-issuer.com',
                audience: 'test-audience',
                expiration: '2024-01-01T00:00:00Z',
                roles: [],
                scopes: [],
                claims: { sub: 'test-user' }
            };
            const mockI18n = {
                'processor.jwt.tokenValid': 'Token is valid',
                'processor.jwt.tokenDetails': 'Token Details'
            };
            const mockCSS = {
                TOKEN_VERIFIER: {
                    TOKEN_VALID: 'token-valid',
                    TOKEN_DETAILS: 'token-details',
                    TOKEN_CLAIMS_TABLE: 'token-claims-table',
                    TOKEN_RAW_CLAIMS: 'token-raw-claims'
                }
            };

            const html = tokenVerifier.__test.createValidTokenHtml(mockResponse, false, mockI18n, mockCSS);

            expect(html).toContain('Token is valid');
            expect(html).toContain('test-user');
            expect(html).not.toContain('Roles');
            expect(html).not.toContain('Scopes');
        });

        it('should create simulated token HTML', () => {
            const mockResponse = {
                subject: 'test-user',
                claims: { sub: 'test-user' }
            };
            const mockI18n = { 'processor.jwt.tokenValid': 'Token is valid' };
            const mockCSS = {
                TOKEN_VERIFIER: {
                    TOKEN_VALID: 'token-valid',
                    TOKEN_DETAILS: 'token-details',
                    TOKEN_CLAIMS_TABLE: 'token-claims-table',
                    TOKEN_RAW_CLAIMS: 'token-raw-claims'
                }
            };

            const html = tokenVerifier.__test.createValidTokenHtml(mockResponse, true, mockI18n, mockCSS);

            expect(html).toContain('Token is valid');
            expect(html).toContain('<em>(Simulated response)</em>');
        });

        it('should handle missing i18n keys gracefully', () => {
            const mockResponse = {
                subject: 'test-user',
                claims: { sub: 'test-user' }
            };
            const mockI18n = {}; // Empty i18n
            const mockCSS = {
                TOKEN_VERIFIER: {
                    TOKEN_VALID: 'token-valid',
                    TOKEN_DETAILS: 'token-details',
                    TOKEN_CLAIMS_TABLE: 'token-claims-table',
                    TOKEN_RAW_CLAIMS: 'token-raw-claims'
                }
            };

            const html = tokenVerifier.__test.createValidTokenHtml(mockResponse, false, mockI18n, mockCSS);

            expect(html).toContain('Token is valid'); // fallback text
            expect(html).toContain('Token Details'); // fallback text
            expect(html).toContain('Subject'); // fallback text
        });
    });

    describe('Component Dependencies', () => {
        it('should handle clear form confirmation', async () => {
            const { confirmClearForm } = require('../../../main/webapp/js/utils/confirmationDialog.js');

            await tokenVerifier.init(parentElement, {}, null, callback);

            expect(confirmClearForm).toBeDefined();
        });

        it('should initialize with all dependencies', async () => {
            await tokenVerifier.init(parentElement, {}, null, callback);
            expect(callback).toHaveBeenCalled();
        });

        it('should handle localhost mode correctly', async () => {
            const constants = require('../../../main/webapp/js/utils/constants.js');
            constants.getIsLocalhost.mockReturnValue(true);

            await tokenVerifier.init(parentElement, {}, null, callback);
            expect(callback).toHaveBeenCalled();

            // Reset localhost mode
            constants.getIsLocalhost.mockReturnValue(false);
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

        it('should export test functions for comprehensive coverage', () => {
            expect(tokenVerifier.__test).toBeDefined();
            expect(tokenVerifier.__test.showInitialInstructions).toBeInstanceOf(Function);
            expect(tokenVerifier.__test.resetUIAndShowLoading).toBeInstanceOf(Function);
            expect(tokenVerifier.__test.handleTokenVerificationResponse).toBeInstanceOf(Function);
            expect(tokenVerifier.__test.extractErrorMessageFromXHR).toBeInstanceOf(Function);
            expect(tokenVerifier.__test.sanitizeErrorMessage).toBeInstanceOf(Function);
            expect(tokenVerifier.__test.createSampleTokenResponse).toBeInstanceOf(Function);
            expect(tokenVerifier.__test.handleTokenVerificationAjaxError).toBeInstanceOf(Function);
            expect(tokenVerifier.__test.handleTokenVerificationSyncException).toBeInstanceOf(Function);
            expect(tokenVerifier.__test.handleVerifyButtonClick).toBeInstanceOf(Function);
            expect(tokenVerifier.__test.handleClearButtonClick).toBeInstanceOf(Function);
        });
    });
});
