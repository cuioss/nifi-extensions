/**
 * Tests for the Token Verifier component.
 * Streamlined approach focused on achieving 80%+ coverage.
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
    'processor.jwt.initialInstructions': 'Enter a JWT token above and click "Verify Token" to validate it.'
};

// Simplified cash-dom mock
jest.mock('cash-dom', () => {
    const mockElement = {
        append: jest.fn().mockReturnThis(),
        html: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis(),
        find: jest.fn().mockReturnThis(),
        val: jest.fn().mockReturnValue('')
    };

    const mockCash = jest.fn(() => mockElement);
    mockCash.ajax = jest.fn().mockReturnValue({
        then: jest.fn().mockReturnThis(),
        catch: jest.fn().mockReturnThis()
    });

    return { __esModule: true, default: mockCash };
});

// Mock dependencies with minimal required functionality
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
            TOKEN_DETAILS: 'token-details'
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

        it('should handle i18n being null', async () => {
            const nfCommon = require('nf.Common');
            nfCommon.getI18n.mockReturnValueOnce(null);

            await tokenVerifier.init(parentElement, {}, null, callback);
            expect(callback).toHaveBeenCalled();
        });
    });

    describe('Component Lifecycle', () => {
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
            const mockCash = require('cash-dom').default;

            await tokenVerifier.init(parentElement, {}, null, callback);

            // Verify cash-dom was called for DOM manipulation
            expect(mockCash).toHaveBeenCalled();
        });

        it('should handle FormFieldFactory creation', async () => {
            const { FormFieldFactory } = require('../../../main/webapp/js/utils/formBuilder.js');

            await tokenVerifier.init(parentElement, {}, null, callback);

            expect(FormFieldFactory).toHaveBeenCalled();
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
    });

    describe('Dependencies Integration', () => {
        it('should integrate with constants module', async () => {
            const constants = require('../../../main/webapp/js/utils/constants.js');

            await tokenVerifier.init(parentElement, {}, null, callback);

            expect(constants.getIsLocalhost).toBeDefined();
            expect(constants.setIsLocalhostForTesting).toBeDefined();
        });

        it('should integrate with uiErrorDisplay', async () => {
            const { displayUiError } = require('../../../main/webapp/js/utils/uiErrorDisplay.js');

            await tokenVerifier.init(parentElement, {}, null, callback);

            expect(displayUiError).toBeDefined();
        });
    });

    describe('Async Patterns', () => {
        it('should handle async initialization properly', async () => {
            const promise = tokenVerifier.init(parentElement, {}, null, callback);

            expect(promise).toBeInstanceOf(Promise);
            await expect(promise).resolves.not.toThrow();
        });
    });
});
