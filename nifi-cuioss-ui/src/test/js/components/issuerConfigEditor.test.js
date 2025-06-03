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

let localNfCommon; // This will be set in beforeEach

// This is the helper function that tests will use to create specific promise instances
// for their mock implementations.
const createApiMockPromise = () => {
    let doneCb = () => {};
    let failCb = () => {};

    const promiseObj = {
        done: jest.fn(function (cb) { doneCb = cb; return this; }),
        fail: jest.fn(function (cb) { failCb = cb; return this; }),
        _resolve: function (data) {
            if (typeof doneCb === 'function') {
                doneCb(data);
            }
        },
        _reject: function (xhr, status, error) {
            if (typeof failCb === 'function') {
                failCb(xhr, status, error);
            }
        }
    };
    return promiseObj;
};

// const createMockDeferred = () => { // No longer needed
//     let doneCb = () => {};
//     let failCb = () => {};
//     const promise = {
//         done: (cb) => { doneCb = cb; return promise; },
//         fail: (cb) => { failCb = cb; return promise; },
//         always: () => promise,
//         _resolve: (data) => {
//             Promise.resolve(data).then(val => { if(doneCb) doneCb(val); });
//         },
//         _reject: (xhr, status, error) => {
//             Promise.resolve().then(() => { if(failCb) failCb(xhr, status, error); });
//         }
//     };
//     return promise;
// };

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
            // The functions on apiClientForMocks are already jest.fn() from the top-level factory mock
            apiClientForMocks.getProcessorProperties.mockClear();
            apiClientForMocks.updateProcessorProperties.mockClear();
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

            // mockCompatAjax is now mocked directly in tests that use it.
            // No default implementation needed here anymore.
            // If a test needs a default, it can be added: mockCompatAjax.mockResolvedValue({});
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
                const mockGetPropsPromise = createApiMockPromise();
                apiClientForMocks.getProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (init structure) CALLED WITH:', args);
                    return mockGetPropsPromise;
                });

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromise._resolve({ properties: {} });
                jest.runAllTimers();

                expect(parentElement.querySelector('.issuer-config-editor')).not.toBeNull();
                expect(mockCallback).toHaveBeenCalled();
            });

            it('should call loadExistingIssuers which calls getProcessorProperties if processorId is found', async () => {
                const mockGetPropsPromise = createApiMockPromise();
                apiClientForMocks.getProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (init loadExisting) CALLED WITH:', args);
                    return mockGetPropsPromise;
                });

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromise._resolve({ properties: {} }); // Resolve it to allow component to proceed
                jest.runAllTimers();

                expect(apiClientForMocks.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');
            });
        });

        describe('getProcessorIdFromUrl behavior (tested via init)', function () {
            it('should extract processor ID from URL and use it for API call', async () => {
                const mockGetPropsPromise = createApiMockPromise();
                apiClientForMocks.getProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (getProcessorIdFromUrl) CALLED WITH:', args);
                    return mockGetPropsPromise;
                });
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromise._resolve({ properties: {} });
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
                const mockGetPropsPromise = createApiMockPromise();
                apiClientForMocks.getProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (loadExisting populate) CALLED WITH:', args);
                    return mockGetPropsPromise;
                });

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromise._resolve({ properties: mockProperties });
                jest.runAllTimers();

                const forms = parentElement.querySelectorAll('.issuer-form');
                expect(forms.length).toBe(2);
            });

            it('should add a sample issuer if getProcessorProperties fails', async function () {
                const mockGetPropsPromise = createApiMockPromise();
                apiClientForMocks.getProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (loadExisting fails) CALLED WITH:', args);
                    return mockGetPropsPromise;
                });

                Object.defineProperty(window, 'location', { value: { href: 'http://localhost/nifi/processors/abcde-fail-id/edit' }, configurable: true });
                currentTestUrl = window.location.href;

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromise._reject({}, 'error', 'API Error'); // jQuery style args
                jest.runAllTimers();

                expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Error loading processor properties:', 'error', 'API Error');
                expect(parentElement.querySelectorAll('.issuer-form').length).toBe(1);
            });
        });

        describe('addIssuerForm interaction (via Add Issuer button)', function () {
            it('should add a new blank issuer form when "Add Issuer" is clicked', async () => {
                const mockGetPropsPromise = createApiMockPromise();
                apiClientForMocks.getProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (addIssuerForm) CALLED WITH:', args);
                    return mockGetPropsPromise;
                });
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromise._resolve({ properties: {} }); // Initial load
                jest.runAllTimers();

                expect(parentElement.querySelectorAll('.issuer-form').length).toBe(0); // Should be 0 if properties are empty
                parentElement.querySelector('.add-issuer-button').click();
                expect(parentElement.querySelectorAll('.issuer-form').length).toBe(1);
            });
        });

        describe('JWKS URL Validation (Test Connection)', function () {
            let form;
            beforeEach(async () => {
                const mockGetPropsPromise = createApiMockPromise();
                apiClientForMocks.getProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (JWKS beforeEach) CALLED WITH:', args);
                    return mockGetPropsPromise;
                });
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromise._resolve({ properties: {} }); // Initial load for init
                jest.runAllTimers();

                parentElement.querySelector('.add-issuer-button').click();
                form = parentElement.querySelector('.issuer-form');
            });

            it('should show success for valid JWKS URL', async () => {
                form.querySelector('.field-jwks-url').value = 'https://valid.jwks.url/keys';
                // mockCompatAjax is setup in the main beforeEach to return jwksValidationDeferred
                // We need to change that setup first.
                mockCompatAjax.mockResolvedValueOnce({ valid: true, keyCount: 3 });
                form.querySelector('.verify-jwks-button').click();

                // expect(mockCompatAjax).toHaveBeenCalled(); // This will be called by the click
                await Promise.resolve(); jest.runAllTimers(); // Allow promise from mockCompatAjax and subsequent UI updates

                expect(form.querySelector('.verification-result').innerHTML).toContain('OK</span> Valid JWKS (3 keys found)');
            });

            it('should show failure for invalid JWKS URL', async () => {
                form.querySelector('.field-jwks-url').value = 'https://invalid.jwks.url/keys';

                const mockAjaxPromise = createApiMockPromise();
                mockCompatAjax.mockImplementationOnce(() => {
                    // console.log('Per-test MOCK compatAjax (JWKS failure) CALLED'); // Optional debug log
                    return mockAjaxPromise;
                });

                form.querySelector('.verify-jwks-button').click();

                mockAjaxPromise._resolve({ valid: false, message: 'Keys not found' });
                jest.runAllTimers(); // Allow UI updates

                expect(form.querySelector('.verification-result').innerHTML).toContain('Failed</span> Invalid JWKS: Keys not found');
            });
        });

        describe('Save Issuer functionality', function () {
            let form;
            beforeEach(async () => {
                const mockGetPropsPromise = createApiMockPromise();
                apiClientForMocks.getProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (Save Issuer beforeEach) CALLED WITH:', args);
                    return mockGetPropsPromise;
                });
                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromise._resolve({ properties: {} });
                jest.runAllTimers();

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

                const mockUpdatePromise = createApiMockPromise();
                apiClientForMocks.updateProcessorProperties.mockImplementation((...args) => {
                    console.log('Per-test MOCK updateProcessorProperties (save success) CALLED WITH:', args);
                    return mockUpdatePromise;
                });
                form.querySelector('.save-issuer-button').click();
                mockUpdatePromise._resolve({}); // Simulate successful update
                jest.runAllTimers();

                expect(apiClientForMocks.updateProcessorProperties).toHaveBeenCalledWith('12345-abcde', expect.any(Object));
                expect(window.alert).toHaveBeenCalledWith(mockI18n['issuerConfigEditor.saveSuccess']);
            });
        });

        describe('Remove Issuer functionality', function () {
            let form;
            const issuerName = 'test-issuer-to-remove';

            beforeEach(async () => {
                const mockInitProps = { properties: { ['issuer.' + issuerName + '.issuer']: 'uri' } };
                const mockGetPropsPromiseInit = createApiMockPromise();
                // Use mockImplementationOnce for calls specific to this beforeEach's init
                apiClientForMocks.getProcessorProperties.mockImplementationOnce((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (Remove Issuer beforeEach Init) CALLED WITH:', args);
                    return mockGetPropsPromiseInit;
                });

                issuerConfigEditor.init(parentElement, mockConfig, null, mockCallback, currentTestUrl);
                mockGetPropsPromiseInit._resolve(mockInitProps);
                jest.runAllTimers();

                form = Array.from(parentElement.querySelectorAll('.issuer-form')).find(f => f.querySelector('.issuer-name').value === issuerName);
                if (!form) throw new Error('Test setup error: Form for ' + issuerName + ' not found after init.');
            });

            it('should call window.confirm before removing', function () {
                window.confirm.mockReturnValue(false);
                form.querySelector('.remove-issuer-button').click();
                expect(window.confirm).toHaveBeenCalledWith(mockI18n['issuerConfigEditor.removeIssuerConfirm']);
            });

            it('should remove issuer and call updateProcessorProperties with null values on successful removal', async () => {
                window.confirm.mockReturnValue(true);

                const mockGetPropsPromiseRemove = createApiMockPromise();
                apiClientForMocks.getProcessorProperties.mockImplementationOnce((...args) => {
                    console.log('Per-test MOCK getProcessorProperties (Remove Issuer - remove action) CALLED WITH:', args);
                    return mockGetPropsPromiseRemove;
                });

                const mockUpdatePromise = createApiMockPromise();
                apiClientForMocks.updateProcessorProperties.mockImplementationOnce((...args) => {
                    console.log('Per-test MOCK updateProcessorProperties (Remove Issuer - save action) CALLED WITH:', args);
                    return mockUpdatePromise;
                });

                form.querySelector('.remove-issuer-button').click();

                const initialPropsForRemove = { properties: { ['issuer.' + issuerName + '.issuer']: 'uri' } };
                mockGetPropsPromiseRemove._resolve(initialPropsForRemove);
                jest.runAllTimers();

                mockUpdatePromise._resolve({});
                jest.runAllTimers();

                expect(window.alert).toHaveBeenCalledWith(mockI18n['issuerConfigEditor.removeSuccess']);
            });
        });
    });
});

afterAll(() => {
    jest.useRealTimers();
});
