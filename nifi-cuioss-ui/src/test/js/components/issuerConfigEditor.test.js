/**
 * Tests for the Issuer Config Editor component.
 */
let issuerConfigEditor;
import nfCommonModule from 'nf.Common';
import * as apiClient from '../../../main/webapp/js/services/apiClient.js';

jest.mock('../../../main/webapp/js/services/apiClient.js', () => ({
    getProcessorProperties: jest.fn(),
    updateProcessorProperties: jest.fn(),
}));

const mockCompatAjax = jest.fn();
jest.mock('../../../main/webapp/js/utils/ajax.js', () => ({
    compatAjax: mockCompatAjax
}));

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

const createMockDeferred = () => {
    let doneCb = () => {};
    let failCb = () => {};
    const promise = {
        done: (cb) => { doneCb = cb; return promise; },
        fail: (cb) => { failCb = cb; return promise; },
        always: () => promise,
        _resolve: (data) => {
            Promise.resolve(data).then(val => { if(doneCb) doneCb(val); });
        },
        _reject: (xhr, status, error) => {
            Promise.resolve().then(() => { if(failCb) failCb(xhr, status, error); });
        }
    };
    return promise;
};

describe('issuerConfigEditor', function () {
    'use strict';

    describe('issuerConfigEditor Tests', function () {
        let parentElement;
        let mockConfig;
        let mockCallback;
        let currentTestUrl;
        let jwksValidationDeferred;

        let originalAlert, originalConfirm, originalLocation;
        let consoleErrorSpy, consoleLogSpy;

        beforeEach(function () {
            jest.resetModules();
            jest.useFakeTimers();

            issuerConfigEditor = require('components/issuerConfigEditor');
            localNfCommon = require('nf.Common');

            apiClient.getProcessorProperties.mockReset();
            apiClient.updateProcessorProperties.mockReset();
            mockCompatAjax.mockReset();

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

            mockCompatAjax.mockImplementation(() => {
                jwksValidationDeferred = createMockDeferred();
                return jwksValidationDeferred;
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
                const getPropsDeferred = createMockDeferred();
                apiClient.getProcessorProperties.mockReturnValueOnce(getPropsDeferred);

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                getPropsDeferred._resolve({ properties: {} });
                await Promise.resolve(); jest.runAllTimers();

                expect(parentElement.querySelector('.issuer-config-editor')).not.toBeNull();
                expect(mockCallback).toHaveBeenCalled();
            });

            it('should call loadExistingIssuers which calls getProcessorProperties if processorId is found', async () => {
                const getPropsDeferred = createMockDeferred();
                apiClient.getProcessorProperties.mockReturnValueOnce(getPropsDeferred);

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                // Manually resolve the deferred returned by the mock
                getPropsDeferred._resolve({ properties: {} });
                await Promise.resolve(); jest.runAllTimers();

                expect(apiClient.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');
            });
        });

        describe('getProcessorIdFromUrl behavior (tested via init)', function () {
            it('should extract processor ID from URL and use it for API call', async () => {
                const getPropsDeferred = createMockDeferred();
                apiClient.getProcessorProperties.mockReturnValueOnce(getPropsDeferred);
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                getPropsDeferred._resolve({ properties: {} });
                await Promise.resolve(); jest.runAllTimers();
                expect(apiClient.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');
            });

            it('should result in sample data if no processor ID in URL', async () => {
                Object.defineProperty(window, 'location', { value: { href: 'http://localhost/nifi/some/other/path' }, configurable: true });
                currentTestUrl = window.location.href;
                // No specific mock for getProcessorProperties, as it shouldn't be called.

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                await Promise.resolve(); jest.runAllTimers();

                expect(apiClient.getProcessorProperties).not.toHaveBeenCalled();
                expect(parentElement.querySelectorAll('.issuer-form').length).toBe(1);
            });
        });

        describe('loadExistingIssuers', function () {
            it('should populate forms from processor properties', async function () {
                const mockProperties = {
                    'issuer.issuerOne.issuer': 'uri1', 'issuer.issuerOne.jwks-url': 'url1',
                    'issuer.issuerTwo.issuer': 'uri2', 'issuer.issuerTwo.jwks-url': 'url2',
                };
                const getPropsDeferred = createMockDeferred();
                apiClient.getProcessorProperties.mockReturnValueOnce(getPropsDeferred);

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                getPropsDeferred._resolve({ properties: mockProperties });
                await Promise.resolve(); jest.runAllTimers();

                const forms = parentElement.querySelectorAll('.issuer-form');
                expect(forms.length).toBe(2);
            });

            it('should add a sample issuer if getProcessorProperties fails', async function () {
                const getPropsDeferred = createMockDeferred();
                apiClient.getProcessorProperties.mockReturnValueOnce(getPropsDeferred);
                Object.defineProperty(window, 'location', { value: { href: 'http://localhost/nifi/processors/abcde-fail-id/edit' }, configurable: true });
                currentTestUrl = window.location.href;

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                getPropsDeferred._reject({}, 'error', 'API Error');
                await Promise.resolve().catch(()=>{}); jest.runAllTimers();

                expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Error loading processor properties:', 'error', 'API Error');
                expect(parentElement.querySelectorAll('.issuer-form').length).toBe(1);
            });
        });

        describe('addIssuerForm interaction (via Add Issuer button)', function () {
            it('should add a new blank issuer form when "Add Issuer" is clicked', async () => {
                const getPropsDeferred = createMockDeferred();
                apiClient.getProcessorProperties.mockReturnValueOnce(getPropsDeferred);
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                getPropsDeferred._resolve({ properties: {} });
                await Promise.resolve(); jest.runAllTimers();

                expect(parentElement.querySelectorAll('.issuer-form').length).toBe(0);
                parentElement.querySelector('.add-issuer-button').click();
                expect(parentElement.querySelectorAll('.issuer-form').length).toBe(1);
            });
        });

        describe('JWKS URL Validation (Test Connection)', function () {
            let form;
            beforeEach(async () => {
                const getPropsDeferred = createMockDeferred();
                apiClient.getProcessorProperties.mockReturnValueOnce(getPropsDeferred);
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                getPropsDeferred._resolve({ properties: {} });
                await Promise.resolve(); jest.runAllTimers();

                parentElement.querySelector('.add-issuer-button').click();
                form = parentElement.querySelector('.issuer-form');
            });

            it('should show success for valid JWKS URL', async () => {
                form.querySelector('.field-jwks-url').value = 'https://valid.jwks.url/keys';
                form.querySelector('.verify-jwks-button').click();

                expect(mockCompatAjax).toHaveBeenCalled();
                jwksValidationDeferred._resolve({ valid: true, keyCount: 3 });
                await Promise.resolve(); jest.runAllTimers();

                expect(form.querySelector('.verification-result').innerHTML).toContain('OK</span> Valid JWKS (3 keys found)');
            });

            it('should show failure for invalid JWKS URL', async () => {
                form.querySelector('.field-jwks-url').value = 'https://invalid.jwks.url/keys';
                form.querySelector('.verify-jwks-button').click();

                expect(mockCompatAjax).toHaveBeenCalled();
                jwksValidationDeferred._resolve({ valid: false, message: 'Keys not found' });
                await Promise.resolve(); jest.runAllTimers();

                expect(form.querySelector('.verification-result').innerHTML).toContain('Failed</span> Invalid JWKS: Keys not found');
            });
        });

        describe('Save Issuer functionality', function () {
            let form;
            beforeEach(async () => {
                const getPropsDeferred = createMockDeferred();
                apiClient.getProcessorProperties.mockReturnValueOnce(getPropsDeferred);
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                getPropsDeferred._resolve({ properties: {} });
                await Promise.resolve(); jest.runAllTimers();
                parentElement.querySelector('.add-issuer-button').click();
                form = parentElement.querySelector('.issuer-form');
            });

            it('should show alert if issuer name is missing', function () {
                form.querySelector('.issuer-name').value = '';
                form.querySelector('.save-issuer-button').click();
                expect(window.alert).toHaveBeenCalledWith(mockI18n['issuerConfigEditor.error.nameRequired']);
            });

            it('should call updateProcessorProperties and show success on successful save', async () => {
                form.querySelector('.issuer-name').value = 'test-issuer';
                form.querySelector('.field-issuer').value = 'https://test.com/issuer';
                form.querySelector('.field-jwks-url').value = 'https://test.com/jwks.json';

                const updateDeferred = createMockDeferred();
                apiClient.updateProcessorProperties.mockReturnValueOnce(updateDeferred);
                form.querySelector('.save-issuer-button').click();
                updateDeferred._resolve({});
                await Promise.resolve(); jest.runAllTimers();

                expect(apiClient.updateProcessorProperties).toHaveBeenCalledWith('12345-abcde', expect.any(Object));
                expect(window.alert).toHaveBeenCalledWith(mockI18n['issuerConfigEditor.saveSuccess']);
            });
        });

        describe('Remove Issuer functionality', function () {
            let form;
            const issuerName = 'test-issuer-to-remove';

            beforeEach(async () => {
                const mockProperties = { properties: { ['issuer.' + issuerName + '.issuer']: 'uri' } };
                const getPropsDef = createMockDeferred();
                apiClient.getProcessorProperties.mockReturnValueOnce(getPropsDef);

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                getPropsDef._resolve(mockProperties);
                await Promise.resolve(); jest.runAllTimers();

                form = Array.from(parentElement.querySelectorAll('.issuer-form')).find(f => f.querySelector('.issuer-name').value === issuerName);
                if (!form) throw new Error("Test setup error: Form for " + issuerName + " not found after init.");
            });

            it('should call window.confirm before removing', function () {
                window.confirm.mockReturnValue(false);
                form.querySelector('.remove-issuer-button').click();
                expect(window.confirm).toHaveBeenCalledWith(mockI18n['issuerConfigEditor.removeIssuerConfirm']);
            });

            it('should remove issuer and call updateProcessorProperties with null values on successful removal', async () => {
                window.confirm.mockReturnValue(true);

                const initialProps = { properties: { ['issuer.' + issuerName + '.issuer']: 'uri' } };
                const getPropsDeferredInner = createMockDeferred();
                apiClient.getProcessorProperties.mockReturnValueOnce(getPropsDeferredInner);

                const updateDeferredInner = createMockDeferred();
                apiClient.updateProcessorProperties.mockReturnValueOnce(updateDeferredInner);

                form.querySelector('.remove-issuer-button').click();

                getPropsDeferredInner._resolve(initialProps);
                await Promise.resolve();
                jest.runAllTimers();

                updateDeferredInner._resolve({});
                await Promise.resolve();
                jest.runAllTimers();

                expect(window.alert).toHaveBeenCalledWith(mockI18n['issuerConfigEditor.removeSuccess']);
            });
        });
    });
});

afterAll(() => {
    jest.useRealTimers();
});
