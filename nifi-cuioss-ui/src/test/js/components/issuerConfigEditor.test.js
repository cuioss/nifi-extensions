/**
 * Tests for the Issuer Config Editor component.
 */

// Mock apiClient module
jest.mock('../../../main/webapp/js/services/apiClient.js', () => ({
    getProcessorProperties: jest.fn(),
    updateProcessorProperties: jest.fn()
}));

// Mock uiErrorDisplay module
jest.mock('../../../main/webapp/js/utils/uiErrorDisplay.js', () => ({
    displayUiError: jest.fn(),
    displayUiSuccess: jest.fn(),
    displayUiInfo: jest.fn(),
    displayUiWarning: jest.fn()
}));

// Mock confirmation dialog
jest.mock('../../../main/webapp/js/utils/confirmationDialog.js', () => ({
    confirmRemoveIssuer: jest.fn()
}));

// Mock i18n
const mockI18n = {
    'processor.jwt.testConnection': 'Test Connection',
    'processor.jwt.testing': 'Testing...',
    'processor.jwt.ok': 'OK',
    'processor.jwt.failed': 'Failed',
    'processor.jwt.validJwks': 'Valid JWKS',
    'processor.jwt.invalidJwks': 'Invalid JWKS',
    'processor.jwt.keysFound': 'keys found',
    'processor.jwt.validationError': 'Validation error',
    'processor.jwt.unknownError': 'Unknown error',
    'jwksValidator.initialInstructions': 'Click the button to validate JWKS',
    'issuerConfigEditor.error.issuerNameRequired': 'Issuer name is required.',
    'issuerConfigEditor.error.requiredFields': 'Issuer URI and JWKS URL are required.',
    'issuerConfigEditor.error.title': 'Configuration Error',
    'issuerConfigEditor.success.saved': 'Issuer configuration saved successfully.',
    'issuerConfigEditor.error.saveFailedTitle': 'Save Error',
    'issuerConfigEditor.success.savedStandalone': 'Issuer configuration saved successfully (standalone mode).',
    'issuerConfigEditor.title': 'Issuer Configurations',
    'issuerConfigEditor.description': 'Configure JWT issuers for token validation.',
    'issuerConfigEditor.addIssuer': 'Add Issuer',
    'issuerConfigEditor.removeIssuer': 'Remove Issuer',
    'Jwt.Validation.Issuer.Configuration': 'Issuer Configurations',
    'issuer.config.description': 'Configure JWT issuers for token validation. Each issuer requires a name and properties like jwks-url and issuer URI.'
};

// Mock nf.Common
jest.mock('nf.Common', () => ({
    getI18n: jest.fn().mockReturnValue(mockI18n)
}), { virtual: true });

describe('issuerConfigEditor', function () {
    'use strict';

    describe('issuerConfigEditor Tests', function () {
        let parentElement;
        let mockCallback;
        let currentTestUrl;
        let issuerConfigEditor;
        let apiClient;
        let uiErrorDisplay;
        let confirmationDialog;
        let originalGlobalGetIsLocalhost;

        beforeEach(function () {
            jest.useFakeTimers();
            jest.resetModules();

            // Re-require modules after mocks are set up
            apiClient = require('../../../main/webapp/js/services/apiClient.js');
            uiErrorDisplay = require('../../../main/webapp/js/utils/uiErrorDisplay.js');
            confirmationDialog = require('../../../main/webapp/js/utils/confirmationDialog.js');
            issuerConfigEditor = require('components/issuerConfigEditor');

            // Clear mocks
            apiClient.getProcessorProperties.mockReset().mockResolvedValue({ properties: {} });
            apiClient.updateProcessorProperties.mockReset().mockResolvedValue({});
            uiErrorDisplay.displayUiError.mockClear();
            uiErrorDisplay.displayUiSuccess.mockClear();
            confirmationDialog.confirmRemoveIssuer.mockClear();

            originalGlobalGetIsLocalhost = global.getIsLocalhost;
            global.getIsLocalhost = jest.fn().mockReturnValue(false);
            window.getIsLocalhost = global.getIsLocalhost;

            window.alert = jest.fn();
            window.confirm = jest.fn().mockReturnValue(true);

            parentElement = document.createElement('div');
            parentElement.id = 'test-container';
            document.body.appendChild(parentElement);

            mockCallback = jest.fn();
            currentTestUrl = 'http://localhost/nifi/processors/12345-abcde/edit';
            Object.defineProperty(window, 'location', {
                writable: true, value: { href: currentTestUrl }, configurable: true
            });
        });

        afterEach(function () {
            if (parentElement && parentElement.parentNode === document.body) {
                document.body.removeChild(parentElement);
            }
            delete window.getIsLocalhost;
            global.getIsLocalhost = originalGlobalGetIsLocalhost;
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        describe('init', function () {
            it('should initialize the component structure', async () => {
                issuerConfigEditor.init(parentElement, mockCallback, currentTestUrl);
                await jest.runAllTimersAsync();

                // Check that the main container was created
                const container = parentElement.querySelector('.issuer-config-editor');
                expect(container).toBeTruthy();

                // Check for title
                const title = container.querySelector('h3');
                expect(title).toBeTruthy();
                expect(title.textContent).toContain('Issuer Configurations');

                // Check for description
                const description = container.querySelector('p');
                expect(description).toBeTruthy();

                // Check for issuers container
                const issuersContainer = container.querySelector('.issuers-container');
                expect(issuersContainer).toBeTruthy();

                // Check for add button
                const addButton = container.querySelector('.add-issuer-button');
                expect(addButton).toBeTruthy();
                expect(addButton.textContent).toBe('Add Issuer');

                expect(mockCallback).toHaveBeenCalled();
            });

            it('should call loadExistingIssuers which calls getProcessorProperties if processorId is found', async () => {
                issuerConfigEditor.init(parentElement, mockCallback, currentTestUrl);
                await jest.runAllTimersAsync();
                expect(apiClient.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');
            });
        });

        describe('loadExistingIssuers', () => {
            it('should add sample form if getProcessorProperties rejects', async () => {
                apiClient.getProcessorProperties.mockRejectedValueOnce(new Error('API Down'));

                issuerConfigEditor.init(parentElement, mockCallback, currentTestUrl);
                await jest.runAllTimersAsync();

                expect(apiClient.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');

                // Check that a sample form was added
                const forms = parentElement.querySelectorAll('.issuer-form');
                expect(forms.length).toBeGreaterThan(0);
            });

            it('should add sample form if a synchronous error occurs during property processing', async () => {
                apiClient.getProcessorProperties.mockImplementationOnce(() => {
                    throw new Error('Sync error');
                });

                issuerConfigEditor.init(parentElement, mockCallback, currentTestUrl);
                await jest.runAllTimersAsync();

                expect(apiClient.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');

                // Check that a sample form was added
                const forms = parentElement.querySelectorAll('.issuer-form');
                expect(forms.length).toBeGreaterThan(0);
            });

            it('should handle malformed processor properties', async () => {
                apiClient.getProcessorProperties.mockResolvedValueOnce({
                    properties: {
                        'issuer.testissuer.prop1': 'val1',
                        'issuer.testissuer.prop2.toolong.extrastuff': 'val2'
                    }
                });

                issuerConfigEditor.init(parentElement, mockCallback, currentTestUrl);
                await jest.runAllTimersAsync();

                expect(apiClient.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');

                // Should create a form for testissuer (ignoring malformed property)
                const forms = parentElement.querySelectorAll('.issuer-form');
                expect(forms.length).toBe(1);
            });
        });

        describe('addIssuerForm', () => {
            it('should create a new issuer form when "Add Issuer" is clicked', async () => {
                issuerConfigEditor.init(parentElement, mockCallback, 'http://localhost/nifi/');
                await jest.runAllTimersAsync();

                const addButton = parentElement.querySelector('.add-issuer-button');
                expect(addButton).toBeTruthy();

                // Click the add button
                addButton.click();

                // Check that a new form was added
                const forms = parentElement.querySelectorAll('.issuer-form');
                expect(forms.length).toBeGreaterThan(0);

                // Check that the form has expected elements
                const form = forms[0];
                expect(form.querySelector('.issuer-name')).toBeTruthy();
                expect(form.querySelector('.field-issuer')).toBeTruthy();
                expect(form.querySelector('.field-jwks-url')).toBeTruthy();
            });
        });

        describe('JWKS URL Validation', function () {
            beforeEach(async () => {
                issuerConfigEditor.init(parentElement, mockCallback, currentTestUrl);
                await jest.runAllTimersAsync();

                // Add an issuer form
                const addButton = parentElement.querySelector('.add-issuer-button');
                addButton.click();
            });

            it('should show success for valid JWKS URL', async () => {
                global.getIsLocalhost.mockReturnValue(false);

                const form = parentElement.querySelector('.issuer-form');
                const jwksUrlField = form.querySelector('.field-jwks-url');
                const verifyButton = form.querySelector('.verify-jwks-button');
                const resultContainer = form.querySelector('.verification-result');

                // Set JWKS URL
                jwksUrlField.value = 'https://valid.jwks.url/keys';

                // Mock successful fetch response
                global.fetch = jest.fn().mockResolvedValue({
                    ok: true,
                    json: jest.fn().mockResolvedValue({ valid: true, keyCount: 3 })
                });

                // Click verify button
                verifyButton.click();

                await jest.runAllTimersAsync();

                // Verify fetch was called correctly
                expect(global.fetch).toHaveBeenCalledWith('../nifi-api/processors/jwks/validate-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jwksValue: 'https://valid.jwks.url/keys' }),
                    credentials: 'same-origin'
                });

                // Verify success message is displayed
                expect(resultContainer.innerHTML).toContain('Valid JWKS');
                expect(resultContainer.innerHTML).toContain('3 keys found');
            });

            it('should show failure for invalid JWKS URL', async () => {
                global.getIsLocalhost.mockReturnValue(false);

                const form = parentElement.querySelector('.issuer-form');
                const jwksUrlField = form.querySelector('.field-jwks-url');
                const verifyButton = form.querySelector('.verify-jwks-button');
                const resultContainer = form.querySelector('.verification-result');

                jwksUrlField.value = 'https://invalid.jwks.url/keys';

                // Mock fetch with invalid response
                global.fetch = jest.fn().mockResolvedValue({
                    ok: true,
                    json: jest.fn().mockResolvedValue({ valid: false, message: 'Keys not found' })
                });

                verifyButton.click();
                await jest.runAllTimersAsync();

                expect(uiErrorDisplay.displayUiError).toHaveBeenCalledWith(
                    resultContainer,
                    { responseJSON: { valid: false, message: 'Keys not found' } },
                    mockI18n,
                    'processor.jwt.invalidJwks'
                );
            });

            it('should handle AJAX error for JWKS validation', async () => {
                global.getIsLocalhost.mockReturnValue(false);

                const form = parentElement.querySelector('.issuer-form');
                const jwksUrlField = form.querySelector('.field-jwks-url');
                const verifyButton = form.querySelector('.verify-jwks-button');
                const resultContainer = form.querySelector('.verification-result');

                jwksUrlField.value = 'https://error.jwks.url/keys';

                // Mock fetch to reject
                global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

                verifyButton.click();
                await jest.runAllTimersAsync();

                expect(uiErrorDisplay.displayUiError).toHaveBeenCalledWith(
                    resultContainer,
                    expect.any(Error),
                    mockI18n,
                    'processor.jwt.validationError'
                );
            });
        });

        describe('Save Issuer functionality', function () {
            let form;
            let errorContainer;

            beforeEach(async () => {
                issuerConfigEditor.init(parentElement, mockCallback, currentTestUrl);
                await jest.runAllTimersAsync();

                // Add an issuer form
                const addButton = parentElement.querySelector('.add-issuer-button');
                addButton.click();

                form = parentElement.querySelector('.issuer-form');
                errorContainer = form.querySelector('.issuer-form-error-messages');
            });

            it('should display error if issuer name is missing', function () {
                const saveButton = form.querySelector('.save-issuer-button');

                // Leave issuer name empty
                form.querySelector('.issuer-name').value = '';
                form.querySelector('.field-issuer').value = 'https://test.com';
                form.querySelector('.field-jwks-url').value = 'https://test.com/jwks.json';

                saveButton.click();

                expect(uiErrorDisplay.displayUiError).toHaveBeenCalledWith(
                    errorContainer,
                    expect.any(Error),
                    mockI18n,
                    'issuerConfigEditor.error.title'
                );
            });

            it('should display error if required fields are missing', function () {
                const saveButton = form.querySelector('.save-issuer-button');

                form.querySelector('.issuer-name').value = 'test-issuer';
                form.querySelector('.field-issuer').value = '';
                form.querySelector('.field-jwks-url').value = 'https://test.com/jwks.json';

                saveButton.click();

                expect(uiErrorDisplay.displayUiError).toHaveBeenCalledWith(
                    errorContainer,
                    expect.any(Error),
                    mockI18n,
                    'issuerConfigEditor.error.title'
                );
            });

            it('should display success message on successful save', async () => {
                const saveButton = form.querySelector('.save-issuer-button');

                form.querySelector('.issuer-name').value = 'test-issuer';
                form.querySelector('.field-issuer').value = 'https://test.com';
                form.querySelector('.field-jwks-url').value = 'https://test.com/jwks.json';

                saveButton.click();
                await jest.runAllTimersAsync();

                expect(apiClient.updateProcessorProperties).toHaveBeenCalledWith('12345-abcde', {
                    'issuer.test-issuer.issuer': 'https://test.com',
                    'issuer.test-issuer.jwks-url': 'https://test.com/jwks.json',
                    'issuer.test-issuer.audience': 'sample-audience',
                    'issuer.test-issuer.client-id': 'sample-client'
                });

                expect(uiErrorDisplay.displayUiSuccess).toHaveBeenCalled();
            });

            it('should display success message in standalone mode', async () => {
                // Re-initialize without processor ID
                document.body.removeChild(parentElement);
                parentElement = document.createElement('div');
                document.body.appendChild(parentElement);

                currentTestUrl = 'http://localhost/nifi/';
                Object.defineProperty(window, 'location', {
                    writable: true,
                    value: { href: currentTestUrl },
                    configurable: true
                });

                issuerConfigEditor.init(parentElement, jest.fn(), currentTestUrl);
                await jest.runAllTimersAsync();

                const addButton = parentElement.querySelector('.add-issuer-button');
                addButton.click();

                const standaloneForm = parentElement.querySelector('.issuer-form');
                const standaloneErrorContainer = standaloneForm.querySelector('.issuer-form-error-messages');
                const saveButton = standaloneForm.querySelector('.save-issuer-button');

                standaloneForm.querySelector('.issuer-name').value = 'test-issuer';
                standaloneForm.querySelector('.field-issuer').value = 'https://test.com';
                standaloneForm.querySelector('.field-jwks-url').value = 'https://test.com/jwks.json';

                saveButton.click();
                await jest.runAllTimersAsync();

                expect(apiClient.updateProcessorProperties).not.toHaveBeenCalled();
                expect(uiErrorDisplay.displayUiSuccess).toHaveBeenCalledWith(
                    standaloneErrorContainer,
                    expect.stringContaining('standalone mode')
                );
            });

            it('should handle save error', async () => {
                const saveButton = form.querySelector('.save-issuer-button');

                form.querySelector('.issuer-name').value = 'test-issuer';
                form.querySelector('.field-issuer').value = 'https://test.com';
                form.querySelector('.field-jwks-url').value = 'https://test.com/jwks.json';

                apiClient.updateProcessorProperties.mockRejectedValueOnce(new Error('Save failed'));

                saveButton.click();
                await jest.runAllTimersAsync();

                expect(uiErrorDisplay.displayUiError).toHaveBeenCalledWith(
                    errorContainer,
                    expect.any(Error),
                    mockI18n,
                    'issuerConfigEditor.error.saveFailedTitle'
                );
            });
        });

        describe('Remove Issuer functionality', () => {
            beforeEach(async () => {
                apiClient.getProcessorProperties.mockResolvedValueOnce({
                    properties: {
                        'issuer.issuer1.jwks-url': 'url1',
                        'issuer.issuer1.audience': 'aud1'
                    }
                });

                issuerConfigEditor.init(parentElement, mockCallback, currentTestUrl);
                await jest.runAllTimersAsync();
            });

            it('should remove an issuer form and update properties', async () => {
                const form = parentElement.querySelector('.issuer-form');
                const removeButton = form.querySelector('.remove-issuer-button');
                const issuerNameInput = form.querySelector('.issuer-name');

                // Mock confirmation dialog to immediately call onConfirm
                confirmationDialog.confirmRemoveIssuer.mockImplementationOnce((name, onConfirm) => {
                    onConfirm();
                });

                // Reset mocks to check removal calls
                apiClient.getProcessorProperties.mockResolvedValueOnce({
                    properties: {
                        'issuer.issuer1.jwks-url': 'url1',
                        'issuer.issuer1.audience': 'aud1'
                    }
                });

                removeButton.click();
                await jest.runAllTimersAsync();

                // Verify confirmation dialog was shown
                expect(confirmationDialog.confirmRemoveIssuer).toHaveBeenCalledWith(
                    issuerNameInput.value,
                    expect.any(Function)
                );

                // Verify form was removed
                expect(form.parentNode).toBeNull();

                // Verify properties were updated
                expect(apiClient.updateProcessorProperties).toHaveBeenCalledWith('12345-abcde', {
                    'issuer.issuer1.jwks-url': null,
                    'issuer.issuer1.audience': null
                });
            });

            it('should handle removal errors', async () => {
                const form = parentElement.querySelector('.issuer-form');
                const removeButton = form.querySelector('.remove-issuer-button');

                confirmationDialog.confirmRemoveIssuer.mockImplementationOnce((name, onConfirm) => {
                    onConfirm();
                });

                apiClient.getProcessorProperties.mockRejectedValueOnce(new Error('Get failed'));

                removeButton.click();
                await jest.runAllTimersAsync();

                // Form should still be removed
                expect(form.parentNode).toBeNull();

                // Error should be displayed
                const globalErrorContainer = parentElement.querySelector('.global-error-messages');
                expect(uiErrorDisplay.displayUiError).toHaveBeenCalledWith(
                    globalErrorContainer,
                    expect.any(Error),
                    mockI18n,
                    'issuerConfigEditor.error.removeFailedTitle'
                );
            });
        });

        describe('Helper function tests', () => {
            it('should handle non-string input in getProcessorIdFromUrl', () => {
                expect(issuerConfigEditor.__test_exports.getProcessorIdFromUrl(null)).toBe('');
                expect(issuerConfigEditor.__test_exports.getProcessorIdFromUrl(undefined)).toBe('');
                expect(issuerConfigEditor.__test_exports.getProcessorIdFromUrl(123)).toBe('');
                expect(issuerConfigEditor.__test_exports.getProcessorIdFromUrl({})).toBe('');
            });

            it('should extract processor ID from valid URLs', () => {
                expect(issuerConfigEditor.__test_exports.getProcessorIdFromUrl('http://localhost/nifi-api/processors/12345-abcde/config')).toBe('12345-abcde');
                expect(issuerConfigEditor.__test_exports.getProcessorIdFromUrl('/nifi-api/processors/abc-123-def/config')).toBe('abc-123-def');
                expect(issuerConfigEditor.__test_exports.getProcessorIdFromUrl('http://localhost/nifi/')).toBe('');
            });

            it('should parse issuer properties correctly', () => {
                const rawProperties = {
                    'issuer.test-issuer-1.issuer': 'https://test1.com',
                    'issuer.test-issuer-1.jwks-url': 'https://test1.com/jwks.json',
                    'issuer.test-issuer-2.issuer': 'https://test2.com',
                    'some.other.property': 'should-be-ignored',
                    'issuer.malformed': 'should-be-ignored'
                };

                const result = issuerConfigEditor.__test_exports._parseIssuerProperties(rawProperties);

                expect(result).toEqual({
                    'test-issuer-1': {
                        'issuer': 'https://test1.com',
                        'jwks-url': 'https://test1.com/jwks.json'
                    },
                    'test-issuer-2': {
                        'issuer': 'https://test2.com'
                    }
                });
            });

            it('should validate issuer form data correctly', () => {
                // Test missing issuer name
                const validation1 = issuerConfigEditor.__test_exports._validateIssuerFormData({
                    issuerName: '',
                    issuer: 'https://test.com',
                    'jwks-url': 'https://test.com/jwks.json'
                });
                expect(validation1.isValid).toBe(false);
                expect(validation1.error.message).toContain('Issuer name is required');

                // Test missing required fields
                const validation2 = issuerConfigEditor.__test_exports._validateIssuerFormData({
                    issuerName: 'test-issuer',
                    issuer: '',
                    'jwks-url': 'https://test.com/jwks.json'
                });
                expect(validation2.isValid).toBe(false);
                expect(validation2.error.message).toContain('Issuer URI and JWKS URL are required');

                // Test valid data
                const validation3 = issuerConfigEditor.__test_exports._validateIssuerFormData({
                    issuerName: 'test-issuer',
                    issuer: 'https://test.com',
                    'jwks-url': 'https://test.com/jwks.json'
                });
                expect(validation3.isValid).toBe(true);
            });
        });

        describe('init error handling', () => {
            it('should call callback if element is null', () => {
                issuerConfigEditor.init(null, mockCallback, currentTestUrl);
                expect(mockCallback).toHaveBeenCalled();
            });
        });
    });
});

afterAll(() => {
    jest.useRealTimers();
});
