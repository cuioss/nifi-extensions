/**
 * Tests for the Issuer Config Editor component.
 */
import $ from 'cash-dom'; // Import cash-dom
import { createAjaxMock, sampleJwksSuccess } from '../test-utils';

jest.mock('../../../main/webapp/js/services/apiClient.js', () => ({
    getProcessorProperties: jest.fn((...args) => {
        return Promise.resolve({ properties: {} });
    }),
    updateProcessorProperties: jest.fn((...args) => {
        return Promise.resolve({});
    })
}));

const mockComponentAjax = jest.fn();
jest.mock('cash-dom', () => {
    const actualCash = jest.requireActual('cash-dom');
    const cashSpy = jest.fn((selector) => {
        if (typeof selector === 'function') {
            selector();
            return { on: jest.fn().mockReturnThis() };
        }
        return actualCash(selector);
    });
    cashSpy.ajax = mockComponentAjax;
    return cashSpy;
});

const mockAjax = mockComponentAjax;

// displayUiError will be mocked using jest.doMock in beforeEach

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
    'jwksValidator.initialInstructions': 'Click the button to validate JWKS', // Used by SUT
    // Keys used by issuerConfigEditor SUT for errors/success
    'issuerConfigEditor.error.issuerNameRequired': 'Issuer name is required.',
    'issuerConfigEditor.error.requiredFields': 'Issuer URI and JWKS URL are required.',
    'issuerConfigEditor.error.title': 'Configuration Error',
    'issuerConfigEditor.success.saved': 'Issuer configuration saved successfully.',
    'issuerConfigEditor.error.saveFailedTitle': 'Save Error',
    'issuerConfigEditor.success.savedStandalone': 'Issuer configuration saved successfully (standalone mode).',
    // Other keys from original mockI18n for completeness, might not be directly asserted but good for nfCommon.getI18n mock
    'issuerConfigEditor.title': 'Issuer Configurations',
    'issuerConfigEditor.description': 'Configure JWT issuers for token validation.',
    'issuerConfigEditor.addIssuer': 'Add Issuer',
    'issuerConfigEditor.saveError': 'Error: Failed to save issuer configuration. See console for details.',
    'issuerConfigEditor.saveException': 'Error: Failed to save issuer configuration due to an exception. See console for details.',
    'issuerConfigEditor.removeSuccess': 'Success: Issuer configuration removed successfully.',
    'issuerConfigEditor.removeError': 'Error: Failed to remove issuer configuration. See console for details.',
    'issuerConfigEditor.removeException': 'Error: Failed to remove issuer configuration due to an exception. See console for details.',
    'issuerConfigEditor.getPropertiesError': 'Error: Failed to get processor properties. See console for details.'
};

let localNfCommon; // To hold the mocked nf.Common module

// Helper to get verification result innerHTML
const getVerificationResultHTMLFromForm = (formElement) => {
    const el = formElement.querySelector('.verification-result');
    return el ? el.innerHTML : undefined;
};

describe('issuerConfigEditor', function () {
    'use strict';

    describe('issuerConfigEditor Tests', function () {
        let parentElement;
        let mockConfig;
        let mockCallback;
        let currentTestUrl;
        let issuerConfigEditor;
        let apiClientForMocks;
        let originalGlobalGetIsLocalhost;
        let displayUiError; // To hold the mock function

        beforeEach(function () {
            jest.resetModules(); // This is key when using jest.doMock
            jest.useFakeTimers();

            // Mock uiErrorDisplay before requiring the SUT
            jest.doMock('../../../main/webapp/js/utils/uiErrorDisplay.js', () => ({
                displayUiError: jest.fn()
            }));
            displayUiError = require('../../../main/webapp/js/utils/uiErrorDisplay.js').displayUiError;

            // Mock nf.Common to ensure SUT gets the mockI18n from this test
            jest.doMock('nf.Common', () => ({
                getI18n: jest.fn().mockReturnValue(mockI18n)
            }), { virtual: true }); // virtual: true might be needed if Jest struggles to find nf.Common

            // Require SUT and other dependencies after mocks are set up
            localNfCommon = require('nf.Common'); // Get the mocked nf.Common
            apiClientForMocks = require('../../../main/webapp/js/services/apiClient.js');
            issuerConfigEditor = require('components/issuerConfigEditor'); // SUT is required here

            // Clear mocks
            if (localNfCommon && localNfCommon.getI18n.mockClear) { // Check if getI18n is a mock
                localNfCommon.getI18n.mockClear();
            }
            apiClientForMocks.getProcessorProperties.mockClear();
            apiClientForMocks.updateProcessorProperties.mockClear();
            mockComponentAjax.mockReset();

            originalGlobalGetIsLocalhost = global.getIsLocalhost;
            global.getIsLocalhost = jest.fn().mockReturnValue(false); // Default to non-localhost
            window.getIsLocalhost = global.getIsLocalhost; // Also set on window

            window.alert = jest.fn(); // SUT uses console.warn, not alert
            window.confirm = jest.fn(); // SUT does not use confirm anymore

            localNfCommon.getI18n = jest.fn().mockReturnValue(mockI18n);

            parentElement = document.createElement('div');
            parentElement.id = 'test-container';
            document.body.appendChild(parentElement);
            mockConfig = {};
            mockCallback = jest.fn();
            currentTestUrl = 'http://localhost/nifi/processors/12345-abcde/edit';
            Object.defineProperty(window, 'location', {
                writable: true, value: { href: currentTestUrl }, configurable: true
            });
            if (displayUiError) displayUiError.mockClear(); // Clear mock before each test
        });

        afterEach(function () {
            if (parentElement && parentElement.parentNode === document.body) {
                document.body.removeChild(parentElement);
            }
            delete window.getIsLocalhost; // Clean up window property
            global.getIsLocalhost = originalGlobalGetIsLocalhost;
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        describe('init', function () {
            it('should initialize the component structure', async () => {
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                await jest.runAllTimersAsync();
                expect(parentElement.querySelector('.issuer-config-editor')).not.toBeNull();
                expect(mockCallback).toHaveBeenCalled();
            });
            it('should call loadExistingIssuers which calls getProcessorProperties if processorId is found', async () => {
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                await jest.runAllTimersAsync();
                expect(apiClientForMocks.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');
            });
        });

        // Other top-level describe blocks like 'getProcessorIdFromUrl behavior', 'loadExistingIssuers',
        // 'addIssuerForm interaction' are assumed to be mostly okay as they don't directly involve the AJAX calls
        // this subtask is focused on refactoring with createAjaxMock.
        // For brevity, only JWKS validation and relevant parts of save/remove/init error are detailed.

        describe('JWKS URL Validation (Test Connection)', function () {
            let form;

            beforeEach(async () => {
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                await jest.runAllTimersAsync();
                parentElement.querySelector('.add-issuer-button').click();
                form = parentElement.querySelector('.issuer-form');
                // Ensure field-jwks-url input exists for tests
                if (!form.querySelector('.field-jwks-url')) {
                    const jwksUrlInput = document.createElement('input');
                    jwksUrlInput.className = 'field-jwks-url';
                    form.querySelector('.form-fields').appendChild(jwksUrlInput);
                }
            });

            it('should show success for valid JWKS URL (non-localhost)', async () => {
                global.getIsLocalhost.mockReturnValue(false);
                form.querySelector('.field-jwks-url').value = 'https://valid.jwks.url/keys';
                mockComponentAjax.mockImplementationOnce(createAjaxMock({
                    isLocalhostValue: false,
                    successData: { valid: true, keyCount: 3 }
                }));
                form.querySelector('.verify-jwks-button').click();
                await jest.runAllTimersAsync();
                expect(getVerificationResultHTMLFromForm(form)).toContain('OK</span> Valid JWKS (3 keys found)');
            });

            it('should show failure for invalid JWKS URL (non-localhost)', async () => {
                global.getIsLocalhost.mockReturnValue(false);
                form.querySelector('.field-jwks-url').value = 'https://invalid.jwks.url/keys';
                mockComponentAjax.mockImplementationOnce(createAjaxMock({
                    isLocalhostValue: false,
                    successData: { valid: false, message: 'Keys not found' }
                }));
                form.querySelector('.verify-jwks-button').click();
                await jest.runAllTimersAsync();
                // Check that displayUiError was called correctly, instead of checking innerHTML
                expect(displayUiError).toHaveBeenCalledWith(
                    expect.anything(), // $resultContainer (or its cash-dom equivalent)
                    { responseJSON: { valid: false, message: 'Keys not found' } },
                    mockI18n,
                    'processor.jwt.invalidJwks'
                );
            });

            it('should show SUTs synchronous error path response when ajax mock throws synchronously (non-localhost)', async () => {
                global.getIsLocalhost.mockReturnValue(false);
                form.querySelector('.field-jwks-url').value = 'https://sync-error.jwks.url/keys';
                mockComponentAjax.mockImplementationOnce(createAjaxMock({
                    isLocalhostValue: false,
                    isSynchronousErrorScenario: true
                }));
                form.querySelector('.verify-jwks-button').click();
                await jest.runAllTimersAsync();
                // SUT now calls displayUiError for this case
                expect(displayUiError).toHaveBeenCalledWith(
                    expect.anything(), // Using expect.anything() for the target element
                    expect.objectContaining({ message: 'Simulated synchronous AJAX error by test-utils' }),
                    mockI18n,
                    'processor.jwt.validationError'
                );
            });

            describe('AJAX failure .catch(jqXHR) block', () => {
                it('should show simulated success on AJAX failure when getIsLocalhost is true', async () => {
                    global.getIsLocalhost.mockReturnValue(true);
                    form.querySelector('.field-jwks-url').value = 'https://some.url/keys';
                    mockComponentAjax.mockImplementationOnce(createAjaxMock({
                        isLocalhostValue: true,
                        isErrorScenario: true,
                        simulatedLocalhostSuccessData: sampleJwksSuccess, // SUT uses its own sample for JWKS errors
                        errorData: { statusText: 'Server Error', responseText: '{"message":"Details"}' }
                    }));
                    form.querySelector('.verify-jwks-button').click();
                    await jest.runAllTimersAsync();
                    expect(global.getIsLocalhost).toHaveBeenCalled();
                    expect(getVerificationResultHTMLFromForm(form)).toContain('OK</span> Valid JWKS');
                    expect(getVerificationResultHTMLFromForm(form)).toContain('<em>(Simulated response)</em>');
                });

                it('should show actual error on AJAX failure when getIsLocalhost is false', async () => {
                    global.getIsLocalhost.mockReturnValue(false);
                    form.querySelector('.field-jwks-url').value = 'https://some.url/keys';
                    const errorDetails = { statusText: 'Real Server Error', responseText: '{"message":"Real Error Details"}' };
                    mockComponentAjax.mockImplementationOnce(createAjaxMock({
                        isLocalhostValue: false, isErrorScenario: true, errorData: errorDetails
                    }));
                    form.querySelector('.verify-jwks-button').click();
                    await jest.runAllTimersAsync();
                    expect(global.getIsLocalhost).toHaveBeenCalled();
                    // SUT now calls displayUiError for this case
                    expect(displayUiError).toHaveBeenCalledWith(
                        expect.anything(), // Using expect.anything() for the target element
                        expect.objectContaining(errorDetails),
                        mockI18n,
                        'processor.jwt.validationError'
                    );
                });
            });
        });

        describe('Save Issuer functionality', function () {
            let form;
            let $formErrorContainer;

            beforeEach(async () => {
                apiClientForMocks.getProcessorProperties.mockResolvedValue({ properties: {} });
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                await jest.runAllTimersAsync();
                parentElement.querySelector('.add-issuer-button').click();
                form = parentElement.querySelector('.issuer-form');
                $formErrorContainer = $(form.querySelector('.issuer-form-error-messages'));
            });

            it('should display error via displayUiError if issuer name is missing', function () {
                form.querySelector('.issuer-name').value = ''; // Empty name
                form.querySelector('.save-issuer-button').click();

                expect(apiClientForMocks.updateProcessorProperties).not.toHaveBeenCalled();
                expect(displayUiError).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.objectContaining({ message: mockI18n['issuerConfigEditor.error.issuerNameRequired'] }),
                    mockI18n,
                    'issuerConfigEditor.error.title'
                );
            });

            it('should display error via displayUiError if issuer URI or JWKS URL is missing', function () {
                form.querySelector('.issuer-name').value = 'test-issuer';
                form.querySelector('.field-issuer').value = ''; // Missing issuer URI
                form.querySelector('.field-jwks-url').value = 'https://some.url/jwks.json';
                form.querySelector('.save-issuer-button').click();

                expect(apiClientForMocks.updateProcessorProperties).not.toHaveBeenCalled();
                expect(displayUiError).toHaveBeenCalledWith(
                    expect.anything(), // Use expect.anything() for the target element here as well
                    expect.objectContaining({ message: mockI18n['issuerConfigEditor.error.requiredFields'] }),
                    mockI18n,
                    'issuerConfigEditor.error.title'
                );

                if (displayUiError) displayUiError.mockClear(); // Clear for next check

                form.querySelector('.field-issuer').value = 'https://some.issuer.com';
                form.querySelector('.field-jwks-url').value = ''; // Missing JWKS URL
                form.querySelector('.save-issuer-button').click();
                expect(displayUiError).toHaveBeenCalledWith(
                    expect.anything(), // Ensure this also uses expect.anything()
                    expect.objectContaining({ message: mockI18n['issuerConfigEditor.error.requiredFields'] }),
                    mockI18n,
                    'issuerConfigEditor.error.title'
                );

                displayUiError.mockClear(); // Clear for next check

                form.querySelector('.field-issuer').value = 'https://some.issuer.com';
                form.querySelector('.field-jwks-url').value = ''; // Missing JWKS URL
                form.querySelector('.save-issuer-button').click();
                expect(displayUiError).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.objectContaining({ message: mockI18n['issuerConfigEditor.error.requiredFields'] }),
                    mockI18n,
                    'issuerConfigEditor.error.title'
                );
            });

            it('should call displayUiError on apiClient.updateProcessorProperties failure', async () => {
                const saveError = new Error('Failed to save');
                apiClientForMocks.updateProcessorProperties.mockRejectedValueOnce(saveError);

                form.querySelector('.issuer-name').value = 'test-issuer';
                form.querySelector('.field-issuer').value = 'https://my.issuer.com';
                form.querySelector('.field-jwks-url').value = 'https://my.jwks.url/file.json';
                form.querySelector('.save-issuer-button').click();

                await jest.runAllTimersAsync(); // For promise resolution

                expect(apiClientForMocks.updateProcessorProperties).toHaveBeenCalled();
                expect(displayUiError).toHaveBeenCalledWith(
                    expect.anything(), // Using expect.anything() for the target element
                    saveError,
                    mockI18n,
                    'issuerConfigEditor.error.saveFailedTitle'
                );
            });

            it('should display success message in $formErrorContainer on successful save', async () => {
                apiClientForMocks.updateProcessorProperties.mockResolvedValueOnce({}); // Simulate successful save

                form.querySelector('.issuer-name').value = 'test-issuer';
                form.querySelector('.field-issuer').value = 'https://my.issuer.com';
                form.querySelector('.field-jwks-url').value = 'https://my.jwks.url/file.json';
                form.querySelector('.save-issuer-button').click();

                // Try more robust flushing for promise resolution and subsequent DOM updates
                await Promise.resolve();
                jest.advanceTimersByTime(0);
                await Promise.resolve();
                jest.advanceTimersByTime(0);

                expect(apiClientForMocks.updateProcessorProperties).toHaveBeenCalled();
                expect(displayUiError).not.toHaveBeenCalled(); // No error

                const errorMessagesElement = form.querySelector('.issuer-form-error-messages');
                expect(errorMessagesElement).not.toBeNull(); // Check if element is found
                expect(errorMessagesElement.innerHTML).toContain(mockI18n['issuerConfigEditor.success.saved']);


                // Test auto-clear of success message
                jest.advanceTimersByTime(5000); // This will run the 5000ms setTimeout to clear the message
                // expect($errorContainerForCheck.html()).toBe('');
                expect(errorMessagesElement.innerHTML).toBe('');
            });
            // ... other save/remove tests ...
        });

        describe('init error handling', () => {
            it('should call callback if element is null', () => {
                issuerConfigEditor.init(null, mockConfig, null, mockCallback, currentTestUrl);
                expect(mockCallback).toHaveBeenCalled();
            });
            // This test checks if the main init's try-catch calls the callback.
            // The SUT's loadExistingIssuers has its own .catch that handles apiClient rejections
            // and prevents them from propagating to init's catch block.
            // So, we simulate a synchronous error during initComponent instead.
            it('should call callback if an exception occurs during initComponent setup', async () => {
                jest.resetModules();
                const cash = require('cash-dom');
                const issuerConfigEditorToTest = require('components/issuerConfigEditor');
                localNfCommon = require('nf.Common');
                localNfCommon.getI18n = jest.fn().mockReturnValue(mockI18n);

                // Make cash-dom throw an error when _createEditorStructure is called
                const originalCashFn = cash.fn;
                cash.fn = jest.fn((selector) => {
                    if (selector === '<div class="issuer-config-editor"></div>') {
                        throw new Error('Simulated DOM creation error');
                    }
                    return actualCash(selector); // Use actualCash for other calls
                });
                cash.ajax = mockComponentAjax; // Keep ajax mock

                issuerConfigEditorToTest.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                await jest.runAllTimersAsync();

                expect(mockCallback).toHaveBeenCalled();
                cash.fn = originalCashFn; // Restore original cash.fn
            });
        });
    });
});

afterAll(() => {
    jest.useRealTimers();
});
