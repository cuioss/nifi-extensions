/**
 * Tests for the Issuer Config Editor component.
 */

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
        // If it's a function (e.g., $(document).ready()), execute it.
        if (typeof selector === 'function') {
            selector();
            // Return a basic mock cash object for chaining if needed by ready() callbacks.
            return {
                on: jest.fn().mockReturnThis()
                // Add other methods if SUT chains off of $(document).ready() or similar
            };
        }
        // For all other selectors (string, element), delegate to actual cash-dom.
        // This relies on JSDOM's document being correctly available.
        return actualCash(selector);
    });
    cashSpy.ajax = mockComponentAjax; // Attach our ajax mock to the spy
    return cashSpy; // The default export is now our spy
});

const mockAjax = mockComponentAjax; // Alias for tests to use


const mockI18n = {
    'processor.jwt.testConnection': 'Test Connection',
    'processor.jwt.testing': 'Testing...',
    'processor.jwt.ok': 'OK',
    'processor.jwt.failed': 'Failed',
    'processor.jwt.validJwks': 'Valid JWKS',
    'processor.jwt.invalidJwks': 'Invalid JWKS',
    'processor.jwt.keysFound': 'keys found',
    'processor.jwt.validationError': 'Validation error',
    'issuerConfigEditor.title': 'Issuer Configurations',
    'issuerConfigEditor.description': 'Configure JWT issuers for token validation.',
    'issuerConfigEditor.addIssuer': 'Add Issuer',
    'issuerConfigEditor.removeIssuerConfirm': 'Are you sure you want to remove this issuer configuration?',
    'issuerConfigEditor.saveSuccess': 'Success: Issuer configuration saved successfully.',
    'issuerConfigEditor.saveSuccessStandalone': 'Success: Issuer configuration saved successfully (standalone mode).',
    'issuerConfigEditor.saveError': 'Error: Failed to save issuer configuration. See console for details.',
    'issuerConfigEditor.saveErrorStandalone': 'Error: Failed to save issuer configuration in standalone mode. See console for details.',
    'issuerConfigEditor.saveException': 'Error: Failed to save issuer configuration due to an exception. See console for details.',
    'issuerConfigEditor.removeSuccess': 'Success: Issuer configuration removed successfully.',
    'issuerConfigEditor.removeError': 'Error: Failed to remove issuer configuration. See console for details.',
    'issuerConfigEditor.removeException': 'Error: Failed to remove issuer configuration due to an exception. See console for details.',
    'issuerConfigEditor.getPropertiesError': 'Error: Failed to get processor properties. See console for details.',
    'issuerConfigEditor.error.nameRequired': 'Error: Issuer name is required.',
    'issuerConfigEditor.error.uriAndUrlRequired': 'Error: Issuer URI and JWKS URL are required.',
    'jwksValidator.initialInstructions': 'Click the button to validate JWKS'
};

let localNfCommon;

const createControllablePromise = () => {
    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });
    // @ts-ignore
    promise.resolve = resolvePromise;
    // @ts-ignore
    promise.reject = rejectPromise;
    return promise;
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

        let originalAlert, originalConfirm, originalLocation;
        let consoleErrorSpy, consoleLogSpy;

        beforeEach(function () {
            jest.resetModules();
            jest.useFakeTimers();

            apiClientForMocks = require('../../../main/webapp/js/services/apiClient.js');

            issuerConfigEditor = require('components/issuerConfigEditor');
            localNfCommon = require('nf.Common');

            apiClientForMocks.getProcessorProperties.mockClear();
            apiClientForMocks.updateProcessorProperties.mockClear();
            mockComponentAjax.mockReset();

            originalAlert = window.alert;
            originalConfirm = window.confirm;
            originalLocation = window.location;

            window.alert = jest.fn();
            window.confirm = jest.fn();
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

            localNfCommon.getI18n = jest.fn().mockReturnValue(mockI18n);

            parentElement = document.createElement('div');
            parentElement.id = 'test-container';
            document.body.appendChild(parentElement);

            mockConfig = {};
            mockCallback = jest.fn();

            currentTestUrl = 'http://localhost/nifi/processors/12345-abcde/edit';
            Object.defineProperty(window, 'location', {
                writable: true,
                value: { href: currentTestUrl },
                configurable: true
            });

            mockComponentAjax.mockImplementation(() => {
                let thenCb, catchCb;
                const promise = {
                    then: (cb) => { thenCb = cb; return promise; },
                    catch: (cb) => { catchCb = cb; return promise; },
                    _resolve: (data) => thenCb && thenCb(data),
                    _reject: (err) => catchCb && catchCb(err)
                };
                return promise;
            });
        });

        afterEach(function () {
            if (parentElement && parentElement.parentNode === document.body) {
                document.body.removeChild(parentElement);
            }
            Object.defineProperty(window, 'location', {
                writable: true,
                value: originalLocation,
                configurable: true
            });
            window.alert = originalAlert;
            window.confirm = originalConfirm;
            consoleErrorSpy.mockRestore();
            consoleLogSpy.mockRestore();
            jest.useRealTimers();
        });

        describe('init', function () {
            it('should initialize the component structure', async () => {
                apiClientForMocks.getProcessorProperties.mockResolvedValue({ properties: {} });

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                await Promise.resolve().then().then();
                jest.runAllTimers();

                expect(parentElement.querySelector('.issuer-config-editor')).not.toBeNull();
                expect(mockCallback).toHaveBeenCalled();
            });

            it('should call loadExistingIssuers which calls getProcessorProperties if processorId is found', async () => {
                apiClientForMocks.getProcessorProperties.mockResolvedValue({ properties: {} });

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                await Promise.resolve().then().then();
                jest.runAllTimers();

                expect(apiClientForMocks.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');
            });
        });

        describe('getProcessorIdFromUrl behavior (tested via init)', function () {
            it('should extract processor ID from URL and use it for API call', async () => {
                apiClientForMocks.getProcessorProperties.mockResolvedValue({ properties: {} });
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                await Promise.resolve().then().then();
                jest.runAllTimers();
                expect(apiClientForMocks.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');
            });

            it('should result in sample data if no processor ID in URL', async () => {
                Object.defineProperty(window, 'location', { value: { href: 'http://localhost/nifi/some/other/path' }, configurable: true });
                currentTestUrl = window.location.href;

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                jest.runAllTimers();

                expect(apiClientForMocks.getProcessorProperties).not.toHaveBeenCalled();
                expect(parentElement.querySelectorAll('.issuer-form').length).toBe(1);
            });
        });

        describe('loadExistingIssuers', function () {
            it('should populate forms from processor properties', async function () {
                const mockProperties = {
                    'issuer.issuerOne.issuer': 'uri1', 'issuer.issuerOne.jwks-url': 'url1',
                    'issuer.issuerTwo.issuer': 'uri2', 'issuer.issuerTwo.jwks-url': 'url2'
                };
                apiClientForMocks.getProcessorProperties.mockResolvedValue({ properties: mockProperties });

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                await Promise.resolve().then().then();
                jest.runAllTimers();

                const forms = parentElement.querySelectorAll('.issuer-form');
                expect(forms.length).toBe(2);
            });

            it('should add a sample issuer if getProcessorProperties fails', async function () {
                const specificError = { status: 500, statusText: 'API Error', responseText: 'API Error details' };
                apiClientForMocks.getProcessorProperties.mockRejectedValueOnce(specificError);

                Object.defineProperty(window, 'location', { value: { href: 'http://localhost/nifi/processors/abcde-fail-id/edit' }, configurable: true });
                currentTestUrl = window.location.href;

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);

                await Promise.resolve().then().then();
                jest.runAllTimers();

                expect(parentElement.querySelectorAll('.issuer-form').length).toBe(1);
            });
        });

        describe('addIssuerForm interaction (via Add Issuer button)', function () {
            it('should add a new blank issuer form when "Add Issuer" is clicked', async () => {
                apiClientForMocks.getProcessorProperties.mockResolvedValue({ properties: {} });
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                await Promise.resolve().then().then();
                jest.runAllTimers();

                expect(parentElement.querySelectorAll('.issuer-form').length).toBe(0);
                parentElement.querySelector('.add-issuer-button').click();
                expect(parentElement.querySelectorAll('.issuer-form').length).toBe(1);
            });
        });

        describe('JWKS URL Validation (Test Connection)', function () {
            let form;
            let testConnectionAjaxPromise;
            beforeEach(async () => {
                apiClientForMocks.getProcessorProperties.mockResolvedValue({ properties: {} });
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                await Promise.resolve().then().then();
                jest.runAllTimers();

                parentElement.querySelector('.add-issuer-button').click();
                form = parentElement.querySelector('.issuer-form');

                testConnectionAjaxPromise = createControllablePromise();
                mockComponentAjax.mockImplementationOnce(() => testConnectionAjaxPromise);
            });

            it('should show success for valid JWKS URL', async () => {
                form.querySelector('.field-jwks-url').value = 'https://valid.jwks.url/keys';
                form.querySelector('.verify-jwks-button').click();

                testConnectionAjaxPromise.resolve({ valid: true, keyCount: 3 });
                await testConnectionAjaxPromise;
                jest.runAllTimers();

                expect(form.querySelector('.verification-result').innerHTML).toContain('OK</span> Valid JWKS (3 keys found)');
            });

            it('should show failure for invalid JWKS URL', async () => {
                form.querySelector('.field-jwks-url').value = 'https://invalid.jwks.url/keys';
                form.querySelector('.verify-jwks-button').click();

                testConnectionAjaxPromise.resolve({ valid: false, message: 'Keys not found' });
                await testConnectionAjaxPromise;
                jest.runAllTimers();

                expect(form.querySelector('.verification-result').innerHTML).toContain('Failed</span> Invalid JWKS: Keys not found');
            });
        });

        describe('Save Issuer functionality', function () {
            let form;
            beforeEach(async () => {
                apiClientForMocks.getProcessorProperties.mockResolvedValue({ properties: {} });
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                await Promise.resolve().then().then();
                jest.runAllTimers();

                parentElement.querySelector('.add-issuer-button').click();
                form = parentElement.querySelector('.issuer-form');
            });

            it('should show alert if issuer name is missing', function () {
                form.querySelector('.issuer-name').value = '';
                form.querySelector('.save-issuer-button').click();
                expect(apiClientForMocks.updateProcessorProperties).not.toHaveBeenCalled();
            });

            it('should call updateProcessorProperties and show success on successful save', async () => {
                form.querySelector('.issuer-name').value = 'test-issuer';
                form.querySelector('.field-issuer').value = 'https://test.com/issuer';
                form.querySelector('.field-jwks-url').value = 'https://test.com/jwks.json';

                const mockUpdatePromise = createControllablePromise();
                apiClientForMocks.updateProcessorProperties.mockImplementation(() => mockUpdatePromise);
                form.querySelector('.save-issuer-button').click();
                mockUpdatePromise.resolve({});
                await mockUpdatePromise;
                jest.runAllTimers();

                expect(apiClientForMocks.updateProcessorProperties).toHaveBeenCalledWith('12345-abcde', expect.any(Object));
            });
        });

        describe('Remove Issuer functionality', function () {
            let form;
            const issuerName = 'test-issuer-to-remove';

            beforeEach(async () => {
                const mockInitProps = { properties: { ['issuer.' + issuerName + '.issuer']: 'uri' } };
                apiClientForMocks.getProcessorProperties.mockResolvedValueOnce(mockInitProps);

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                await Promise.resolve().then().then();
                jest.runAllTimers();

                form = Array.from(parentElement.querySelectorAll('.issuer-form')).find(f => f.querySelector('.issuer-name').value === issuerName);
                if (!form) throw new Error('Test setup error: Form for ' + issuerName + ' not found after init.');
            });

            it('should call window.confirm before removing', function () {
                window.confirm.mockReturnValue(false);
                form.querySelector('.remove-issuer-button').click();
                expect(window.confirm).not.toHaveBeenCalled();
            });

            it('should remove issuer and call updateProcessorProperties with null values on successful removal', async () => {
                window.confirm.mockReturnValue(true);

                const mockGetPropsPromiseRemove = createControllablePromise();
                apiClientForMocks.getProcessorProperties.mockImplementationOnce(() => mockGetPropsPromiseRemove);

                const mockUpdatePromise = createControllablePromise();
                apiClientForMocks.updateProcessorProperties.mockImplementationOnce(() => mockUpdatePromise);

                form.querySelector('.remove-issuer-button').click();

                const initialPropsForRemove = { properties: { ['issuer.' + issuerName + '.issuer']: 'uri' } };
                mockGetPropsPromiseRemove.resolve(initialPropsForRemove);
                await mockGetPropsPromiseRemove;
                jest.runAllTimers();

                mockUpdatePromise.resolve({});
                await mockUpdatePromise;
                jest.runAllTimers();

                expect(apiClientForMocks.updateProcessorProperties).toHaveBeenCalledWith('12345-abcde', { ['issuer.' + issuerName + '.issuer']: null });
            });
        });
    });
});

afterAll(() => {
    jest.useRealTimers();
});
