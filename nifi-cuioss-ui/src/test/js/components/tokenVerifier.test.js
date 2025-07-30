/**
 * Tests for the Token Verifier component.
 * Updated to test vanilla JavaScript implementation.
 */

const mockI18n = {
    'processor.jwt.tokenInput': 'JWT Token Input Label',
    'processor.jwt.tokenInputDescription': 'Paste your JWT token for verification',
    'processor.jwt.tokenInputPlaceholder': 'Paste token here...',
    'processor.jwt.verifyToken': 'Verify Token Button',
    'processor.jwt.verificationResults': 'Verification Results Header',
    'processor.jwt.noTokenProvided': 'No token provided message',
    'processor.jwt.verifying': 'Verifying token message...',
    'processor.jwt.tokenValid': 'Token is valid message',
    'processor.jwt.tokenInvalid': 'Token is invalid',
    'processor.jwt.tokenHeader': 'Header',
    'processor.jwt.tokenPayload': 'Payload',
    'processor.jwt.expiration': 'Expiration',
    'processor.jwt.expired': 'Expired',
    'processor.jwt.issuer': 'Issuer',
    'processor.jwt.subject': 'Subject',
    'processor.jwt.error': 'Error',
    'processor.jwt.unknownError': 'Unknown error'
};

// Mock nfCommon
jest.mock('nf.Common', () => ({
    getI18n: jest.fn(() => mockI18n)
}), { virtual: true });

// Mock displayUiError
jest.mock('../../../main/webapp/js/utils/uiErrorDisplay.js', () => ({
    displayUiError: jest.fn()
}));

// Mock confirmClearForm
jest.mock('../../../main/webapp/js/utils/confirmationDialog.js', () => ({
    confirmClearForm: jest.fn()
}));

// Mock verifyToken
jest.mock('../../../main/webapp/js/services/apiClient.js', () => ({
    verifyToken: jest.fn()
}));

// Mock FormFieldFactory - Use factory function to avoid scope issues
jest.mock('../../../main/webapp/js/utils/formBuilder.js', () => {
    return {
        FormFieldFactory: jest.fn().mockImplementation(() => ({
            createField: jest.fn((config) => {
                // Create elements inside the function to avoid scope issues
                const mockDocument = global.document;
                const div = mockDocument.createElement('div');
                div.className = 'form-field';
                div.innerHTML = `
                    <label for="field-${config.name}">${config.label}</label>
                    <textarea id="field-${config.name}" placeholder="${config.placeholder}"></textarea>
                `;
                return div;
            }),
            createButton: jest.fn((config) => {
                // Create elements inside the function to avoid scope issues
                const mockDocument = global.document;
                const button = mockDocument.createElement('button');
                button.className = config.cssClass || '';
                button.innerHTML = `<i class="fa ${config.icon}"></i> ${config.text}`;
                return button;
            })
        }))
    };
});

describe('Token Verifier', () => {
    let tokenVerifier;
    let element;
    let mockDisplayUiError;
    let mockVerifyToken;
    let mockConfirmClearForm;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        // Get the mocked functions
        mockDisplayUiError = require('../../../main/webapp/js/utils/uiErrorDisplay.js').displayUiError;
        mockVerifyToken = require('../../../main/webapp/js/services/apiClient.js').verifyToken;
        mockConfirmClearForm = require('../../../main/webapp/js/utils/confirmationDialog.js').confirmClearForm;

        // Import the module
        tokenVerifier = require('../../../main/webapp/js/components/tokenVerifier.js');

        // Create a container element
        element = document.createElement('div');
        document.body.appendChild(element);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('init', () => {
        it('should initialize the token verifier UI', async () => {
            const callback = jest.fn();

            await tokenVerifier.init(element, {}, 'jwt', callback);

            // Check UI structure was created
            const container = element.querySelector('.token-verification-container');
            expect(container).toBeTruthy();

            // Check input section
            const inputSection = container.querySelector('.token-input-section');
            expect(inputSection).toBeTruthy();

            // Check textarea was created
            const textarea = inputSection.querySelector('#field-token-input');
            expect(textarea).toBeTruthy();
            expect(textarea.placeholder).toBe('Paste token here...');

            // Check buttons were created
            const verifyButton = inputSection.querySelector('.verify-token-button');
            const clearButton = inputSection.querySelector('.clear-token-button');
            expect(verifyButton).toBeTruthy();
            expect(clearButton).toBeTruthy();
            expect(verifyButton.textContent).toContain('Verify Token Button');

            // Check results section
            const resultsSection = container.querySelector('.token-results-section');
            expect(resultsSection).toBeTruthy();
            expect(resultsSection.textContent).toContain('Verification Results Header');

            // Check callback was called
            expect(callback).toHaveBeenCalledWith({
                validate: expect.any(Function),
                getValue: expect.any(Function),
                setValue: expect.any(Function)
            });
        });

        it('should handle missing element gracefully', async () => {
            const callback = jest.fn();

            await expect(tokenVerifier.init(null, {}, 'jwt', callback))
                .rejects.toThrow('Token verifier element is required');

            // Callback should still be called with error
            expect(callback).toHaveBeenCalledWith({
                validate: expect.any(Function),
                error: 'Token verifier element is required'
            });
        });
    });

    describe('Token verification', () => {
        it('should verify a valid token', async () => {
            const callback = jest.fn();
            const mockTokenResult = {
                valid: true,
                decoded: {
                    header: { alg: 'RS256', typ: 'JWT' },
                    payload: {
                        sub: 'user123',
                        iss: 'https://example.com',
                        exp: Math.floor(Date.now() / 1000) + 3600
                    }
                }
            };
            mockVerifyToken.mockResolvedValue(mockTokenResult);

            await tokenVerifier.init(element, {}, 'jwt', callback);

            // Set token value
            const textarea = element.querySelector('#field-token-input');
            textarea.value = 'test.jwt.token';

            // Click verify button
            const verifyButton = element.querySelector('.verify-token-button');
            verifyButton.click();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 0));

            // Check that verifyToken was called
            expect(mockVerifyToken).toHaveBeenCalledWith('test.jwt.token');

            // Check results are displayed
            const resultsContent = element.querySelector('.token-results-content');
            expect(resultsContent.innerHTML).toContain('verification-status valid');
            expect(resultsContent.innerHTML).toContain('Token is valid message');
            expect(resultsContent.innerHTML).toContain('Header');
            expect(resultsContent.innerHTML).toContain('Payload');
        });

        it('should handle invalid token', async () => {
            const callback = jest.fn();
            const mockTokenResult = {
                valid: false,
                error: 'Invalid signature'
            };
            mockVerifyToken.mockResolvedValue(mockTokenResult);

            await tokenVerifier.init(element, {}, 'jwt', callback);

            const textarea = element.querySelector('#field-token-input');
            textarea.value = 'invalid.jwt.token';

            const verifyButton = element.querySelector('.verify-token-button');
            verifyButton.click();

            await new Promise(resolve => setTimeout(resolve, 0));

            const resultsContent = element.querySelector('.token-results-content');
            expect(resultsContent.innerHTML).toContain('verification-status invalid');
            expect(resultsContent.innerHTML).toContain('Token is invalid');
            expect(resultsContent.innerHTML).toContain('Invalid signature');
        });

        it('should handle empty token', async () => {
            const callback = jest.fn();
            await tokenVerifier.init(element, {}, 'jwt', callback);

            const verifyButton = element.querySelector('.verify-token-button');
            verifyButton.click();

            await new Promise(resolve => setTimeout(resolve, 0));

            // Should display error for no token
            expect(mockDisplayUiError).toHaveBeenCalledWith(
                expect.any(HTMLElement),
                null,
                mockI18n,
                'processor.jwt.noTokenProvided'
            );
        });

        it('should handle verification errors', async () => {
            const callback = jest.fn();
            const error = {
                status: 500,
                statusText: 'Internal Server Error',
                message: 'Server error'
            };
            mockVerifyToken.mockRejectedValue(error);

            await tokenVerifier.init(element, {}, 'jwt', callback);

            const textarea = element.querySelector('#field-token-input');
            textarea.value = 'test.jwt.token';

            const verifyButton = element.querySelector('.verify-token-button');
            verifyButton.click();

            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockDisplayUiError).toHaveBeenCalled();
        });

        it('should show expired status for expired tokens', async () => {
            const callback = jest.fn();
            const mockTokenResult = {
                valid: true,
                decoded: {
                    payload: {
                        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
                    }
                }
            };
            mockVerifyToken.mockResolvedValue(mockTokenResult);

            await tokenVerifier.init(element, {}, 'jwt', callback);

            const textarea = element.querySelector('#field-token-input');
            textarea.value = 'expired.jwt.token';

            const verifyButton = element.querySelector('.verify-token-button');
            verifyButton.click();

            await new Promise(resolve => setTimeout(resolve, 0));

            const resultsContent = element.querySelector('.token-results-content');
            expect(resultsContent.innerHTML).toContain('expired');
            expect(resultsContent.innerHTML).toContain('Expired');
        });
    });

    describe('Clear functionality', () => {
        it('should clear form when clear button is clicked', async () => {
            const callback = jest.fn();
            mockConfirmClearForm.mockImplementation((cb) => cb());

            await tokenVerifier.init(element, {}, 'jwt', callback);

            // Set some values
            const textarea = element.querySelector('#field-token-input');
            textarea.value = 'test.jwt.token';

            const resultsContent = element.querySelector('.token-results-content');
            resultsContent.innerHTML = 'Some results';

            // Click clear button
            const clearButton = element.querySelector('.clear-token-button');
            clearButton.click();

            expect(mockConfirmClearForm).toHaveBeenCalled();
            expect(textarea.value).toBe('');
            expect(resultsContent.innerHTML).toBe('');
        });
    });

    describe('Callback functionality', () => {
        it('should provide working getValue and setValue functions', async () => {
            const callback = jest.fn();

            await tokenVerifier.init(element, {}, 'jwt', callback);

            const callbackArg = callback.mock.calls[0][0];
            const textarea = element.querySelector('#field-token-input');

            // Test setValue
            callbackArg.setValue('new.jwt.token');
            expect(textarea.value).toBe('new.jwt.token');

            // Test getValue
            expect(callbackArg.getValue()).toBe('new.jwt.token');

            // Test validate
            expect(callbackArg.validate()).toBe(true);
        });
    });

    describe('cleanup', () => {
        it('should be callable without errors', () => {
            expect(() => tokenVerifier.cleanup()).not.toThrow();
        });
    });
});

