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
    'processor.jwt.unknownError': 'Unknown error',
    'processor.jwt.filePathDescription': 'Enter file path to JWKS file',
    'processor.jwt.validateFile': 'Validate File',
    'processor.jwt.noFilePathProvided': 'No file path provided',
    'processor.jwt.validatingFile': 'Validating file...',
    'processor.jwt.fileValidationNotImplemented': 'File validation not yet implemented',
    'processor.jwt.memoryContentDescription': 'Enter JWKS JSON content directly',
    'processor.jwt.validateContent': 'Validate JSON',
    'processor.jwt.noContentProvided': 'No JWKS content provided',
    'processor.jwt.validatingContent': 'Validating content...',
    'processor.jwt.invalidJson': 'Invalid JSON',
    'processor.jwt.invalidJwksStructure': 'Invalid JWKS structure: missing "keys" array',
    'processor.jwt.noKeysInJwks': 'No keys found in JWKS',
    'processor.jwt.missingKeyType': 'Missing key type (kty)',
    'processor.jwt.missingKeyUsage': 'Missing key usage (use or key_ops)'
};

// Mock nfCommon
jest.mock('nf.Common', () => ({
    getI18n: jest.fn(() => mockI18n)
}), { virtual: true });

// Mock displayUiError
jest.mock('../../../main/webapp/js/utils/uiErrorDisplay.js', () => ({
    displayUiError: jest.fn()
}));

// Mock validateJwksUrl and validateJwksFile
jest.mock('../../../main/webapp/js/services/apiClient.js', () => ({
    validateJwksUrl: jest.fn(),
    validateJwksFile: jest.fn()
}));

describe('JWKS Validator', () => {
    let jwksValidator;
    let element;
    let mockDisplayUiError;
    let mockValidateJwksUrl;
    let mockValidateJwksFile;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        // Get the mocked functions
        mockDisplayUiError = require('../../../main/webapp/js/utils/uiErrorDisplay.js').displayUiError;
        mockValidateJwksUrl = require('../../../main/webapp/js/services/apiClient.js').validateJwksUrl;
        mockValidateJwksFile = require('../../../main/webapp/js/services/apiClient.js').validateJwksFile;

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

    describe('File type JWKS validation', () => {
        beforeEach(() => {
            // Add input field to the element for file path
            element.innerHTML = '<input type="text" value="/path/to/jwks.json" />';
        });

        it('should create file validation UI for file type', async () => {
            await jwksValidator.init(element, '/path/to/jwks.json', 'file', jest.fn());

            const fileContainer = element.querySelector('.jwks-file-container');
            expect(fileContainer).toBeTruthy();

            const filePathDisplay = fileContainer.querySelector('.file-path-display');
            expect(filePathDisplay.textContent).toContain('Enter file path to JWKS file');

            const validateButton = fileContainer.querySelector('.validate-file-button');
            expect(validateButton).toBeTruthy();
            expect(validateButton.textContent).toBe('Validate File');

            const resultContainer = fileContainer.querySelector('.file-validation-result');
            expect(resultContainer).toBeTruthy();
        });

        it('should show error when no file path provided', async () => {
            element.innerHTML = '<input type="text" value="" />';
            await jwksValidator.init(element, '', 'file', jest.fn());

            const validateButton = element.querySelector('.validate-file-button');
            const resultContainer = element.querySelector('.file-validation-result');

            validateButton.click();

            expect(resultContainer.innerHTML).toContain('No file path provided');
            expect(resultContainer.querySelector('.error-message')).toBeTruthy();
        });

        it('should validate file successfully', async () => {
            mockValidateJwksFile.mockResolvedValue({
                valid: true,
                keyCount: 2
            });

            await jwksValidator.init(element, '/path/to/jwks.json', 'file', jest.fn());

            const validateButton = element.querySelector('.validate-file-button');
            const resultContainer = element.querySelector('.file-validation-result');

            validateButton.click();

            // Should show validating message initially
            expect(resultContainer.innerHTML).toContain('Validating file...');
            expect(resultContainer.querySelector('.loading')).toBeTruthy();

            // Wait for promise to resolve
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should show success message
            expect(mockValidateJwksFile).toHaveBeenCalledWith('/path/to/jwks.json');
            expect(resultContainer.innerHTML).toContain('OK');
            expect(resultContainer.innerHTML).toContain('Valid JWKS file');
            expect(resultContainer.innerHTML).toContain('2 keys found');
            expect(resultContainer.querySelector('.success-message')).toBeTruthy();
        });

        it('should show error message when file validation fails', async () => {
            mockValidateJwksFile.mockResolvedValue({
                valid: false,
                error: 'File not found'
            });

            await jwksValidator.init(element, '/path/to/jwks.json', 'file', jest.fn());

            const validateButton = element.querySelector('.validate-file-button');
            const resultContainer = element.querySelector('.file-validation-result');

            validateButton.click();

            // Wait for promise to resolve
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockValidateJwksFile).toHaveBeenCalledWith('/path/to/jwks.json');
            expect(resultContainer.innerHTML).toContain('File not found');
            expect(resultContainer.querySelector('.error-message')).toBeTruthy();
        });

        it('should show error message when file validation API fails', async () => {
            mockValidateJwksFile.mockRejectedValue({
                responseJSON: { error: 'API error occurred' },
                statusText: 'Internal Server Error'
            });

            await jwksValidator.init(element, '/path/to/jwks.json', 'file', jest.fn());

            const validateButton = element.querySelector('.validate-file-button');
            const resultContainer = element.querySelector('.file-validation-result');

            validateButton.click();

            // Wait for promise to resolve
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockValidateJwksFile).toHaveBeenCalledWith('/path/to/jwks.json');
            expect(resultContainer.innerHTML).toContain('API error occurred');
            expect(resultContainer.querySelector('.error-message')).toBeTruthy();
        });
    });

    describe('Memory type JWKS validation', () => {
        const validJwks = JSON.stringify({
            keys: [
                {
                    kty: 'RSA',
                    use: 'sig',
                    n: 'test',
                    e: 'AQAB'
                }
            ]
        });

        beforeEach(() => {
            // Add textarea for JWKS content
            element.innerHTML = `<textarea>${validJwks}</textarea>`;
        });

        it('should create memory validation UI for memory type', async () => {
            await jwksValidator.init(element, validJwks, 'memory', jest.fn());

            const memoryContainer = element.querySelector('.jwks-memory-container');
            expect(memoryContainer).toBeTruthy();

            const contentDescription = memoryContainer.querySelector('.content-description');
            expect(contentDescription.textContent).toContain('Enter JWKS JSON content directly');

            const validateButton = memoryContainer.querySelector('.validate-content-button');
            expect(validateButton).toBeTruthy();
            expect(validateButton.textContent).toBe('Validate JSON');

            const resultContainer = memoryContainer.querySelector('.content-validation-result');
            expect(resultContainer).toBeTruthy();
        });

        it('should show error when no content provided', async () => {
            element.innerHTML = '<textarea></textarea>';
            await jwksValidator.init(element, '', 'memory', jest.fn());

            const validateButton = element.querySelector('.validate-content-button');
            const resultContainer = element.querySelector('.content-validation-result');

            validateButton.click();

            expect(resultContainer.innerHTML).toContain('No JWKS content provided');
            expect(resultContainer.querySelector('.error-message')).toBeTruthy();
        });

        it('should validate valid JWKS content', async () => {
            await jwksValidator.init(element, validJwks, 'memory', jest.fn());

            const validateButton = element.querySelector('.validate-content-button');
            const resultContainer = element.querySelector('.content-validation-result');

            validateButton.click();

            expect(resultContainer.innerHTML).toContain('OK');
            expect(resultContainer.innerHTML).toContain('Valid JWKS');
            expect(resultContainer.innerHTML).toContain('1 keys found');
            expect(resultContainer.querySelector('.success-message')).toBeTruthy();
        });

        it('should show error for invalid JSON', async () => {
            element.innerHTML = '<textarea>invalid json</textarea>';
            await jwksValidator.init(element, 'invalid json', 'memory', jest.fn());

            const validateButton = element.querySelector('.validate-content-button');
            const resultContainer = element.querySelector('.content-validation-result');

            validateButton.click();

            expect(resultContainer.innerHTML).toContain('Invalid JSON');
            expect(resultContainer.querySelector('.error-message')).toBeTruthy();
        });

        it('should show error for missing keys array', async () => {
            element.innerHTML = '<textarea>{"notKeys": []}</textarea>';
            await jwksValidator.init(element, '{"notKeys": []}', 'memory', jest.fn());

            const validateButton = element.querySelector('.validate-content-button');
            const resultContainer = element.querySelector('.content-validation-result');

            validateButton.click();

            expect(resultContainer.innerHTML).toContain('Invalid JWKS structure: missing "keys" array');
            expect(resultContainer.querySelector('.error-message')).toBeTruthy();
        });

        it('should show error for empty keys array', async () => {
            element.innerHTML = '<textarea>{"keys": []}</textarea>';
            await jwksValidator.init(element, '{"keys": []}', 'memory', jest.fn());

            const validateButton = element.querySelector('.validate-content-button');
            const resultContainer = element.querySelector('.content-validation-result');

            validateButton.click();

            expect(resultContainer.innerHTML).toContain('No keys found in JWKS');
            expect(resultContainer.querySelector('.error-message')).toBeTruthy();
        });

        it('should show error for missing key type', async () => {
            const invalidJwks = JSON.stringify({
                keys: [{ use: 'sig' }]
            });
            element.innerHTML = `<textarea>${invalidJwks}</textarea>`;
            await jwksValidator.init(element, invalidJwks, 'memory', jest.fn());

            const validateButton = element.querySelector('.validate-content-button');
            const resultContainer = element.querySelector('.content-validation-result');

            validateButton.click();

            expect(resultContainer.innerHTML).toContain('Missing key type (kty) at index 0');
            expect(resultContainer.querySelector('.error-message')).toBeTruthy();
        });

        it('should show error for missing key usage', async () => {
            const invalidJwks = JSON.stringify({
                keys: [{ kty: 'RSA' }]
            });
            element.innerHTML = `<textarea>${invalidJwks}</textarea>`;
            await jwksValidator.init(element, invalidJwks, 'memory', jest.fn());

            const validateButton = element.querySelector('.validate-content-button');
            const resultContainer = element.querySelector('.content-validation-result');

            validateButton.click();

            expect(resultContainer.innerHTML).toContain('Missing key usage (use or key_ops) at index 0');
            expect(resultContainer.querySelector('.error-message')).toBeTruthy();
        });

        it('should validate JWKS with key_ops instead of use', async () => {
            const jwksWithKeyOps = JSON.stringify({
                keys: [{
                    kty: 'RSA',
                    key_ops: ['sign', 'verify'],
                    n: 'test',
                    e: 'AQAB'
                }]
            });
            element.innerHTML = `<textarea>${jwksWithKeyOps}</textarea>`;
            await jwksValidator.init(element, jwksWithKeyOps, 'memory', jest.fn());

            const validateButton = element.querySelector('.validate-content-button');
            const resultContainer = element.querySelector('.content-validation-result');

            validateButton.click();

            expect(resultContainer.innerHTML).toContain('OK');
            expect(resultContainer.innerHTML).toContain('Valid JWKS');
            expect(resultContainer.innerHTML).toContain('1 keys found');
        });
    });
});
