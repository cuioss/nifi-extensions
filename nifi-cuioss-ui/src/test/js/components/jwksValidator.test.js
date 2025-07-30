/**
 * Tests for the JWKS Validator component.
 * Updated to test vanilla JavaScript implementation.
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

// Mock nfCommon
jest.mock('nf.Common', () => ({
    getI18n: jest.fn(() => mockI18n)
}), { virtual: true });

// Mock displayUiError
jest.mock('../../../main/webapp/js/utils/uiErrorDisplay.js', () => ({
    displayUiError: jest.fn()
}));

// Mock validateJwksUrl
jest.mock('../../../main/webapp/js/services/apiClient.js', () => ({
    validateJwksUrl: jest.fn()
}));

describe('JWKS Validator', () => {
    let jwksValidator;
    let element;
    let mockDisplayUiError;
    let mockValidateJwksUrl;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        // Get the mocked functions
        mockDisplayUiError = require('../../../main/webapp/js/utils/uiErrorDisplay.js').displayUiError;
        mockValidateJwksUrl = require('../../../main/webapp/js/services/apiClient.js').validateJwksUrl;

        // Import the module
        jwksValidator = require('../../../main/webapp/js/components/jwksValidator.js');

        // Create a container element with an input field
        element = document.createElement('div');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = 'https://example.com/.well-known/jwks.json';
        element.appendChild(input);
        document.body.appendChild(element);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('init', () => {
        it('should initialize the JWKS validator for server type', async () => {
            const callback = jest.fn();

            await jwksValidator.init(element, 'https://test.com/jwks', 'server', callback);

            // Check button was created
            const button = element.querySelector('.verify-jwks-button');
            expect(button).toBeTruthy();
            expect(button.textContent).toBe('Test Connection Button');

            // Check result container was created
            const resultContainer = element.querySelector('.verification-result');
            expect(resultContainer).toBeTruthy();
            expect(resultContainer.innerHTML).toContain('Click the button to validate JWKS');

            // Check callback was called
            expect(callback).toHaveBeenCalledWith({
                validate: expect.any(Function),
                getValue: expect.any(Function),
                setValue: expect.any(Function),
                jwks_type: 'server'
            });
        });

        it('should not show button for non-server types', async () => {
            const callback = jest.fn();

            await jwksValidator.init(element, '/path/to/file', 'file', callback);

            // Check no button was created
            const button = element.querySelector('.verify-jwks-button');
            expect(button).toBeFalsy();
        });

        it('should handle missing element gracefully', async () => {
            const callback = jest.fn();

            await expect(jwksValidator.init(null, 'value', 'server', callback))
                .rejects.toThrow('JWKS validator element is required');

            // Callback should still be called with error
            expect(callback).toHaveBeenCalledWith({
                validate: expect.any(Function),
                error: 'JWKS validator element is required'
            });
        });
    });

    describe('Button click handling', () => {
        it('should validate JWKS URL on button click', async () => {
            const callback = jest.fn();
            mockValidateJwksUrl.mockResolvedValue({
                valid: true,
                keyCount: 3
            });

            await jwksValidator.init(element, 'https://test.com/jwks', 'server', callback);

            const button = element.querySelector('.verify-jwks-button');
            const resultContainer = element.querySelector('.verification-result');

            // Click the button
            button.click();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 0));

            // Check that validateJwksUrl was called
            expect(mockValidateJwksUrl).toHaveBeenCalledWith('https://example.com/.well-known/jwks.json');

            // Check success message
            expect(resultContainer.innerHTML).toContain('OK');
            expect(resultContainer.innerHTML).toContain('Valid JWKS');
            expect(resultContainer.innerHTML).toContain('3 keys found');
        });

        it('should handle validation errors', async () => {
            const callback = jest.fn();
            const error = {
                status: 404,
                statusText: 'Not Found',
                message: 'JWKS not found'
            };
            mockValidateJwksUrl.mockRejectedValue(error);

            await jwksValidator.init(element, 'https://test.com/jwks', 'server', callback);

            const button = element.querySelector('.verify-jwks-button');
            button.click();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 0));

            // Check that error was displayed
            expect(mockDisplayUiError).toHaveBeenCalled();
            const errorCall = mockDisplayUiError.mock.calls[0];
            expect(errorCall[1]).toMatchObject({
                status: 404,
                statusText: 'Not Found'
            });
        });

        it('should use callback setValue and getValue properly', async () => {
            const callback = jest.fn();

            mockValidateJwksUrl.mockResolvedValue({ valid: true, keyCount: 1 });

            await jwksValidator.init(element, 'https://initial.com/jwks', 'server', callback);

            // Get the callback object that was passed to the callback
            const callbackArg = callback.mock.calls[0][0];

            // Clear the input field so callback value is used
            const input = element.querySelector('input');
            input.value = '';

            // Update the value using setValue
            callbackArg.setValue('https://updated.com/jwks');

            const button = element.querySelector('.verify-jwks-button');
            button.click();

            await new Promise(resolve => setTimeout(resolve, 0));

            // Should use the updated value from getValue
            expect(mockValidateJwksUrl).toHaveBeenCalledWith('https://updated.com/jwks');
        });
    });

    describe('Callback functionality', () => {
        it('should provide working getValue and setValue functions', async () => {
            const callback = jest.fn();

            await jwksValidator.init(element, 'initial-value', 'server', callback);

            const callbackArg = callback.mock.calls[0][0];

            // Test getValue
            expect(callbackArg.getValue()).toBe('initial-value');

            // Test setValue
            callbackArg.setValue('new-value');
            expect(callbackArg.getValue()).toBe('new-value');

            // Test validate
            expect(callbackArg.validate()).toBe(true);
        });
    });

    describe('Element structure', () => {
        it('should insert button after input field when input exists', async () => {
            await jwksValidator.init(element, 'https://test.com/jwks', 'server', jest.fn());

            const input = element.querySelector('input');
            const nextElement = input.nextSibling;

            expect(nextElement).toBeTruthy();
            expect(nextElement.classList.contains('jwks-button-wrapper')).toBe(true);
            expect(nextElement.querySelector('.verify-jwks-button')).toBeTruthy();
        });

        it('should append to container when no input field exists', async () => {
            // Remove input field
            element.innerHTML = '';

            await jwksValidator.init(element, 'https://test.com/jwks', 'server', jest.fn());

            const container = element.querySelector('.jwks-verification-container');
            expect(container).toBeTruthy();
            expect(container.querySelector('.verify-jwks-button')).toBeTruthy();
        });
    });

    describe('cleanup', () => {
        it('should be callable without errors', () => {
            expect(() => jwksValidator.cleanup()).not.toThrow();
        });
    });
});
