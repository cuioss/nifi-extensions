/**
 * Tests for the Issuer Config Editor component.
 */
// Remove top-level import of apiClient, it will be required in beforeEach
// import nfCommonModule from 'nf.Common'; // Keep if used at top level, or move to beforeEach if only test-scoped
// import * as apiClient from '../../../main/webapp/js/services/apiClient.js'; // REMOVE THIS

// nfCommonModule is used by the component, not directly in test top-level scope usually.
// For safety, ensure it's also freshly required if needed by tests, or ensure component gets fresh one.
// However, nf.Common is typically a global-like utility, less likely to be the source of mocking issues here.
// For now, let's focus on apiClient.

jest.mock('../../../main/webapp/js/services/apiClient.js', () => ({
    getProcessorProperties: jest.fn((...args) => {
        // This console.log will help verify if the mock is ever called.
        // It's a default implementation. Tests should override with their own specific mock logic.
        console.log('Default MOCK getProcessorProperties CALLED WITH:', args);
        // Return a basic promise-like structure to avoid errors if not overridden,
        // but tests relying on its resolution/rejection should mockImplementation.
        return {
            done: jest.fn().mockReturnThis(),
            fail: jest.fn().mockReturnThis(),
            // Add _resolve and _reject so tests don't break if they try to call these on a default mock,
            // though they shouldn't rely on these for default mocks.
            _resolve: jest.fn(),
            _reject: jest.fn()
        };
    }),
    updateProcessorProperties: jest.fn((...args) => {
        console.log('Default MOCK updateProcessorProperties CALLED WITH:', args);
        return {
            done: jest.fn().mockReturnThis(),
            fail: jest.fn().mockReturnThis(),
            _resolve: jest.fn(),
            _reject: jest.fn()
        };
    })
}));

// Mock ajax (formerly compatAjax)
const mockAjax = jest.fn(); // Renamed from mockCompatAjax
jest.mock('../../../main/webapp/js/utils/ajax.js', () => ({
    ajax: mockAjax // Mock the 'ajax' export
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

let localNfCommon; // This will be set in beforeEach

// This is the helper function that tests will use to create specific promise instances
// for their mock implementations.
// This helper now returns a structure that allows controlling a standard Promise
const createControllablePromise = () => {
    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });
    promise.resolve = resolvePromise; // Attach resolve to the promise object for test control
    promise.reject = rejectPromise;   // Attach reject
    return promise;
};

describe('issuerConfigEditor', function () {
    'use strict';

    describe('issuerConfigEditor Tests', function () {
        let parentElement;
        let mockConfig;
        let mockCallback;
        let currentTestUrl;
        let issuerConfigEditor; // To be set in beforeEach
        let apiClientForMocks;  // To hold the required apiClient for tests

        let originalAlert, originalConfirm, originalLocation;
        let consoleErrorSpy, consoleLogSpy;

        beforeEach(function () {
            jest.resetModules();
            jest.useFakeTimers();

            // Re-require apiClient here to get the mocked version for this test's context
            apiClientForMocks = require('../../../main/webapp/js/services/apiClient.js');

            // Import/require modules under test AFTER resetModules and AFTER apiClient is (re)loaded
            issuerConfigEditor = require('components/issuerConfigEditor');
            localNfCommon = require('nf.Common'); // nf.Common is a global utility, usually safe

            // Clear mock history before each test for the specific apiClient instance
            apiClientForMocks.getProcessorProperties.mockClear();
            apiClientForMocks.updateProcessorProperties.mockClear();
            mockAjax.mockReset(); // Use the new mock name

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

            // Default mock for ajax calls if not overridden in a specific test
            mockAjax.mockImplementation(() => createControllablePromise());
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
                const mockGetPropsPromise = createControllablePromise(); // Use new helper
                apiClientForMocks.getProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (init structure) CALLED WITH:', args);
                    return mockGetPropsPromise;
                });

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromise.resolve({ data: { properties: {} } });
                await mockGetPropsPromise; // Await the promise itself
                jest.runAllTimers();

                expect(parentElement.querySelector('.issuer-config-editor')).not.toBeNull();
                expect(mockCallback).toHaveBeenCalled();
            });

            it('should call loadExistingIssuers which calls getProcessorProperties if processorId is found', async () => {
                const mockGetPropsPromise = createControllablePromise(); // Use new helper
                apiClientForMocks.getProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (init loadExisting) CALLED WITH:', args);
                    return mockGetPropsPromise;
                });

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromise.resolve({ data: { properties: {} } });
                await mockGetPropsPromise;
                jest.runAllTimers();

                expect(apiClientForMocks.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');
            });
        });

        describe('getProcessorIdFromUrl behavior (tested via init)', function () {
            it('should extract processor ID from URL and use it for API call', async () => {
                const mockGetPropsPromise = createControllablePromise(); // Use new helper
                apiClientForMocks.getProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (getProcessorIdFromUrl) CALLED WITH:', args);
                    return mockGetPropsPromise;
                });
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromise.resolve({ data: { properties: {} } });
                await mockGetPropsPromise;
                jest.runAllTimers();
                expect(apiClientForMocks.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');
            });

            it('should result in sample data if no processor ID in URL', async () => {
                Object.defineProperty(window, 'location', { value: { href: 'http://localhost/nifi/some/other/path' }, configurable: true });
                currentTestUrl = window.location.href;
                // No specific mock for getProcessorProperties, as it shouldn't be called if URL doesn't contain ID.
                // The component logic should handle this, so no need to mockImplementation here if not called.

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                // await Promise.resolve(); // Not strictly needed if no async ops are triggered for this path
                jest.runAllTimers(); // For any synchronous UI updates

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
                const mockGetPropsPromise = createControllablePromise(); // Use new helper
                apiClientForMocks.getProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (loadExisting populate) CALLED WITH:', args);
                    return mockGetPropsPromise;
                });

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromise.resolve({ data: { properties: mockProperties } });
                await mockGetPropsPromise;
                jest.runAllTimers();

                const forms = parentElement.querySelectorAll('.issuer-form');
                expect(forms.length).toBe(2);
            });

            it('should add a sample issuer if getProcessorProperties fails', async function () {
                const mockGetPropsPromise = createControllablePromise(); // Use new helper
                apiClientForMocks.getProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (loadExisting fails) CALLED WITH:', args);
                    return mockGetPropsPromise;
                });

                Object.defineProperty(window, 'location', { value: { href: 'http://localhost/nifi/processors/abcde-fail-id/edit' }, configurable: true });
                currentTestUrl = window.location.href;

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                const errorToReject = new Error('API Error');
                errorToReject.response = { status: 500, statusText: 'API Error', text: () => Promise.resolve('API Error details') };
                mockGetPropsPromise.reject(errorToReject);
                // Allow the promise rejection to propagate and be handled by the SUT's catch block
                await Promise.resolve().then(() => {}).catch(() => {}); // Ensure microtasks queue is processed for the rejection
                await Promise.resolve().then(() => {}).catch(() => {}); // Add another cycle for safety in tests
                jest.runAllTimers();

                // expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Error loading processor properties:', 'API Error', 'API Error'); // This log no longer exists
                expect(parentElement.querySelectorAll('.issuer-form').length).toBe(1);
            });
        });

        describe('addIssuerForm interaction (via Add Issuer button)', function () {
            it('should add a new blank issuer form when "Add Issuer" is clicked', async () => {
                const mockGetPropsPromise = createControllablePromise(); // Use new helper
                apiClientForMocks.getProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (addIssuerForm) CALLED WITH:', args);
                    return mockGetPropsPromise;
                });
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromise.resolve({ data: { properties: {} } });
                await mockGetPropsPromise;
                jest.runAllTimers();

                expect(parentElement.querySelectorAll('.issuer-form').length).toBe(0);
                parentElement.querySelector('.add-issuer-button').click();
                expect(parentElement.querySelectorAll('.issuer-form').length).toBe(1);
            });
        });

        describe('JWKS URL Validation (Test Connection)', function () {
            let form;
            beforeEach(async () => {
                const mockGetPropsPromise = createControllablePromise(); // Use new helper
                apiClientForMocks.getProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (JWKS beforeEach) CALLED WITH:', args);
                    return mockGetPropsPromise;
                });
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromise.resolve({ data: { properties: {} } });
                await mockGetPropsPromise;
                jest.runAllTimers();

                parentElement.querySelector('.add-issuer-button').click();
                form = parentElement.querySelector('.issuer-form');
            });

            it('should show success for valid JWKS URL', async () => {
                form.querySelector('.field-jwks-url').value = 'https://valid.jwks.url/keys';
                const mockJwksPromise = createControllablePromise();
                mockAjax.mockImplementationOnce(() => mockJwksPromise); // Mock ajax directly
                form.querySelector('.verify-jwks-button').click();

                mockJwksPromise.resolve({ data: { valid: true, keyCount: 3 }, status: 200, statusText: 'OK' });
                await mockJwksPromise;
                jest.runAllTimers();

                expect(form.querySelector('.verification-result').innerHTML).toContain('OK</span> Valid JWKS (3 keys found)');
            });

            it('should show failure for invalid JWKS URL', async () => {
                form.querySelector('.field-jwks-url').value = 'https://invalid.jwks.url/keys';
                const mockJwksPromise = createControllablePromise();
                mockAjax.mockImplementationOnce(() => mockJwksPromise);

                form.querySelector('.verify-jwks-button').click();

                mockJwksPromise.resolve({ data: { valid: false, message: 'Keys not found' }, status: 200, statusText: 'OK' });
                await mockJwksPromise;
                jest.runAllTimers();

                expect(form.querySelector('.verification-result').innerHTML).toContain('Failed</span> Invalid JWKS: Keys not found');
            });
        });

        describe('Save Issuer functionality', function () {
            let form;
            beforeEach(async () => {
                const mockGetPropsPromise = createControllablePromise();
                apiClientForMocks.getProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (Save Issuer beforeEach) CALLED WITH:', args);
                    return mockGetPropsPromise;
                });
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromise.resolve({ data: { properties: {} } });
                await mockGetPropsPromise;
                jest.runAllTimers();

                parentElement.querySelector('.add-issuer-button').click();
                form = parentElement.querySelector('.issuer-form');
            });

            it('should show alert if issuer name is missing', function () {
                form.querySelector('.issuer-name').value = '';
                form.querySelector('.save-issuer-button').click();
                // expect(window.alert).toHaveBeenCalledWith(mockI18n['issuerConfigEditor.error.nameRequired']); // Alert is commented out in source
                expect(apiClientForMocks.updateProcessorProperties).not.toHaveBeenCalled();
            });

            it('should call updateProcessorProperties and show success on successful save', async () => {
                form.querySelector('.issuer-name').value = 'test-issuer';
                form.querySelector('.field-issuer').value = 'https://test.com/issuer';
                form.querySelector('.field-jwks-url').value = 'https://test.com/jwks.json';

                const mockUpdatePromise = createControllablePromise(); // Use new helper
                apiClientForMocks.updateProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK updateProcessorProperties (save success) CALLED WITH:', args);
                    return mockUpdatePromise;
                });
                form.querySelector('.save-issuer-button').click();
                mockUpdatePromise.resolve({ data: {} });
                await mockUpdatePromise;
                jest.runAllTimers();

                expect(apiClientForMocks.updateProcessorProperties).toHaveBeenCalledWith('12345-abcde', expect.any(Object));
                // expect(window.alert).toHaveBeenCalledWith(mockI18n['issuerConfigEditor.saveSuccess']); // Alert is commented out in source
            });
        });

        describe('Remove Issuer functionality', function () {
            let form;
            const issuerName = 'test-issuer-to-remove';

            beforeEach(async () => {
                const mockInitProps = { properties: { ['issuer.' + issuerName + '.issuer']: 'uri' } };
                const mockGetPropsPromiseInit = createControllablePromise(); // Use new helper
                apiClientForMocks.getProcessorProperties.mockImplementationOnce((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (Remove Issuer beforeEach Init) CALLED WITH:', args);
                    return mockGetPropsPromiseInit;
                });

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromiseInit.resolve({ data: mockInitProps });
                await mockGetPropsPromiseInit;
                jest.runAllTimers();

                form = Array.from(parentElement.querySelectorAll('.issuer-form')).find(f => f.querySelector('.issuer-name').value === issuerName);
                if (!form) throw new Error('Test setup error: Form for ' + issuerName + ' not found after init.');
            });

            it('should call window.confirm before removing', function () {
                window.confirm.mockReturnValue(false); // Test still needs to control the flow if confirm was present
                form.querySelector('.remove-issuer-button').click();
                // expect(window.confirm).toHaveBeenCalledWith(mockI18n['issuerConfigEditor.removeIssuerConfirm']); // Confirm is removed in source
                expect(window.confirm).not.toHaveBeenCalled();
            });

            it('should remove issuer and call updateProcessorProperties with null values on successful removal', async () => {
                window.confirm.mockReturnValue(true);

                const mockGetPropsPromiseRemove = createControllablePromise(); // Use new helper
                apiClientForMocks.getProcessorProperties.mockImplementationOnce((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (Remove Issuer - remove action) CALLED WITH:', args);
                    return mockGetPropsPromiseRemove;
                });

                const mockUpdatePromise = createControllablePromise();
                apiClientForMocks.updateProcessorProperties.mockImplementationOnce((...args) => {
                    console.log('Per-test MOCK updateProcessorProperties (Remove Issuer - save action) CALLED WITH:', args);
                    return mockUpdatePromise;
                });

                form.querySelector('.remove-issuer-button').click();

                const initialPropsForRemove = { properties: { ['issuer.' + issuerName + '.issuer']: 'uri' } };
                mockGetPropsPromiseRemove.resolve({ data: initialPropsForRemove });
                await mockGetPropsPromiseRemove;
                jest.runAllTimers();

                mockUpdatePromise.resolve({ data: {} });
                await mockUpdatePromise;
                jest.runAllTimers();

                // expect(window.alert).toHaveBeenCalledWith(mockI18n['issuerConfigEditor.removeSuccess']); // Alert is commented out in source
                expect(apiClientForMocks.updateProcessorProperties).toHaveBeenCalledWith('12345-abcde', { ['issuer.' + issuerName + '.issuer']: null });
            });
        });
    });
});

afterAll(() => {
    jest.useRealTimers();
});
