import $ from 'jquery';
import * as issuerConfigEditor from 'components/issuerConfigEditor'; // The module under test
import nfCommon from 'nf.Common';
// Adjusted import path to be relative and match what the SUT would resolve,
// assuming default Jest resolution or a moduleNameMapper might be inconsistent.
// The key is for Jest to mock the exact module instance the SUT uses.
import * as apiClient from '../../../main/webapp/js/services/apiClient.js';
// import * as formatters from 'js/utils/formatters'; // Unused: Removed

// Mock the apiClient module using the exact path resolved by the SUT
// SUT is src/main/webapp/js/components/issuerConfigEditor.js
// SUT imports ../services/apiClient.js -> src/main/webapp/js/services/apiClient.js
// Test is src/test/js/components/issuerConfigEditor.test.js
// Path from test to SUT's apiClient: ../../../main/webapp/js/services/apiClient.js
jest.mock('../../../main/webapp/js/services/apiClient.js', () => ({
    getProcessorProperties: jest.fn(),
    updateProcessorProperties: jest.fn()
    // Add any other functions from apiClient.js that are used by the SUT, mocking them as jest.fn()
    // For now, assuming only these two are directly called by issuerConfigEditor.js
}));

describe('issuerConfigEditor', function () {
    'use strict';

    describe('issuerConfigEditor', function () {
        let mockElement;
        let mockConfig;
        let mockCallback;
        let currentTestUrl; // To hold the URL for init

        // Mock nfCommon
        const mockI18n = {
            'processor.jwt.ok': 'OK',
            'processor.jwt.failed': 'Failed',
            'processor.jwt.validJwks': 'Valid JWKS',
            'processor.jwt.invalidJwks': 'Invalid JWKS',
            'processor.jwt.keysFound': 'keys found',
            'processor.jwt.validationError': 'Validation error'
            // Add other translations as needed by the component
        };
        nfCommon.getI18n = jest.fn().mockReturnValue(mockI18n);

        // apiClient methods (getProcessorProperties, updateProcessorProperties) are already jest.fn()
        // due to the factory in jest.mock() at the top of the file.
        // We will use .mockClear(), .mockReturnValue(), .mockImplementation() on these directly.

        // Mock formatters (even if not directly used, it's a dependency)
        // formatters.formatValue = jest.fn(val => String(val)); // This causes no-import-assign error
        // Instead, we'll spyOn it if we need to control its behavior or verify calls.
        // For now, assuming its actual implementation or a global mock is fine.
        // If tests later require specific mock behavior for formatValue, jest.spyOn will be used.

        // Mock global jQuery AJAX
        // $.ajax = jest.fn(); // This will be redefined later inside tests if needed for specific scenarios.

        // Mock window.location.href
        let originalLocation;
        let mockLocation;

        // Mock window methods and console
        let originalAlert, originalConfirm;
        let consoleErrorSpy, consoleLogSpy, _originalConsoleError, _originalConsoleLog;
        let tempTestPathHit = false; // Flag for the TEMP TEST

        beforeEach(function () {
            originalAlert = window.alert;
            originalConfirm = window.confirm;
            _originalConsoleError = console.error; // Store original console.error, prefixed as unused
            _originalConsoleLog = console.log;   // Store original console.log, prefixed as unused

            window.alert = jest.fn();
            window.confirm = jest.fn();

            // Spy on console methods
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Keep it silent for now
            consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); // Keep it silent

            tempTestPathHit = false; // Reset flag for each test

            // jest.clearAllMocks() is called in the top-level beforeEach.
            // For clarity, explicitly clear mocks used in this specific describe block's beforeEach/tests.
            apiClient.getProcessorProperties.mockClear();
            apiClient.updateProcessorProperties.mockClear();
            nfCommon.getI18n.mockClear().mockReturnValue(mockI18n);
            // formatters.formatValue.mockClear().mockImplementation(val => String(val));
            // If formatValue was spied on, clear it: jest.spyOn(formatters, 'formatValue').mockClear();
            // For now, if it's not spied/re-assigned, no clear is needed here for it.
            // Let's assume the default mock or original implementation is used unless a test overrides.

            // Setup mock DOM element
            mockElement = $('<div id="test-container"></div>').appendTo('body');

            mockConfig = {}; // Default empty config
            mockCallback = jest.fn();

            // Mock window.location.href
            originalLocation = window.location; // This will actually store the original window.location object
            currentTestUrl = 'http://localhost/nifi/processors/12345-abcde/edit'; // Set fixed URL
            mockLocation = { href: currentTestUrl }; // Initialize with currentTestUrl
            Object.defineProperty(window, 'location', {
                writable: true,
                value: mockLocation, // Use the mockLocation object
                configurable: true
            });

            // Default mock for apiClient calls to return promises
            apiClient.getProcessorProperties.mockReturnValue($.Deferred().resolve({ properties: {} }).promise());
            apiClient.updateProcessorProperties.mockReturnValue($.Deferred().resolve().promise());

            // currentTestUrl is already set above

            // Default $.ajax mock
            // Storing and restoring global $.ajax might be problematic if other tests also modify it.
            // It's better to ensure each test suite using it cleans up if it mocks $.ajax globally.
            // For now, keep it simple as this suite is the primary user of this mock.
            // $.ajax = jest.fn(() => $.Deferred().resolve({ valid: true, keyCount: 1 }).promise()); // Removed for global mock
        });

        afterEach(function () {
            if (mockElement) { // Ensure mockElement exists before trying to remove
                mockElement.remove();
            }
            Object.defineProperty(window, 'location', { // Restore original location
                writable: true,
                value: originalLocation,
                configurable: true
            });
            window.alert = originalAlert;
            window.confirm = originalConfirm;

            // Restore spies
            consoleErrorSpy.mockRestore();
            consoleLogSpy.mockRestore();

            // if (global.originalAjax) { // Restore original $.ajax if it was stored // Removed for global mock
            //     $.ajax = global.originalAjax;
            // }
        });

        describe('init', function () {
            it('should initialize the component structure', function () {
                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                expect(mockElement.find('.issuer-config-editor').length).toBe(1);
                expect(mockElement.find('h3').text()).toBe('Issuer Configurations');
                expect(mockElement.find('p').text()).toContain('Configure JWT issuers');
                expect(mockElement.find('.issuers-container').length).toBe(1);
                expect(mockElement.find('.add-issuer-button').length).toBe(1);
                expect(mockCallback).toHaveBeenCalled();
                expect(consoleErrorSpy).not.toHaveBeenCalled(); // Check for unexpected errors using the spy
            });

            it('should call loadExistingIssuers which calls getProcessorProperties if processorId is found', function () {
                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);
                expect(apiClient.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');
            });

            it('should handle null element gracefully', function () {
                issuerConfigEditor.init(null, mockConfig, null, mockCallback, currentTestUrl);
                expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Error: No element provided to issuerConfigEditor.init'); // Use spied console.error
                expect(mockCallback).toHaveBeenCalled();
            });

            it('should handle null config gracefully', function () {
                issuerConfigEditor.init(mockElement[0], null, null, mockCallback, currentTestUrl);
                expect(mockCallback).toHaveBeenCalled();
                // Check that no TypeError or similar is logged due to null config
                expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('TypeError'));
                // Basic structure should still be there
                expect(mockElement.find('.issuer-config-editor').length).toBe(1);
            });

            it('should initialize without error if callback is undefined', () => {
                issuerConfigEditor.init(mockElement[0], mockConfig, null, undefined, currentTestUrl);
                expect(mockElement.find('.issuer-config-editor').length).toBe(1);
                // No error should be thrown, and the original mockCallback (jest.fn()) shouldn't be called.
                expect(mockCallback).not.toHaveBeenCalled();
            });

            it('should catch errors during initComponent and call callback', () => {
                const originalAppendTo = $.fn.appendTo;
                const testError = new Error('Simulated initComponent failure');
                // Mock only the first expected call to appendTo which should be creating the main container
                $.fn.appendTo = jest.fn().mockImplementationOnce(() => {
                    throw testError;
                });

                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Error initializing issuerConfigEditor:', testError);
                expect(mockCallback).toHaveBeenCalled(); // Callback should still be called from catch block

                $.fn.appendTo = originalAppendTo; // Restore
            });
        });

        describe('getProcessorIdFromUrl behavior (tested via init)', function () {
            it('should extract processor ID from URL and use it for API call', function () {
                // URL is set in beforeEach, init is called, then we check.
                // Default URL in beforeEach is 'http://localhost/nifi/processors/12345-abcde/edit'
                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);
                expect(apiClient.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');
            });

            it('should result in sample data if no processor ID in URL', function () {
                mockLocation.href = 'http://localhost/nifi/some/other/path'; // No processor ID
                currentTestUrl = mockLocation.href; // Update currentTestUrl
                apiClient.getProcessorProperties.mockClear();
                // Re-initialize with the new URL
                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                expect(apiClient.getProcessorProperties).not.toHaveBeenCalled();
                // Check for a sample issuer form being added by loadExistingIssuers
                expect(mockElement.find('.issuer-form').length).toBe(1);
                expect(mockElement.find('.issuer-form .issuer-name').val()).toBe('sample-issuer');
            });

            it('should handle null or non-string URL for processorId gracefully', function () {
                // Store the original window.location object from the main beforeEach
                const originalWindowLocation = window.location;
                const originalMockLocationHref = mockLocation.href; // Store the specific href of the mockLocation

                // Temporarily override window.location.href for THIS test specific execution path
                // This ensures that if currentTestUrlFromArg is null/non-string, the fallback
                // window.location.href will result in an empty processorId.
                Object.defineProperty(window, 'location', {
                    value: { href: 'http://localhost/nifi/' }, // URL that results in empty processorId
                    writable: true,
                    configurable: true
                });
                mockLocation.href = 'http://localhost/nifi/'; // Also update the global mockLocation object if it's referenced elsewhere

                apiClient.getProcessorProperties.mockClear();

                // Test with null URL
                // effectiveUrlForInit becomes window.location.href ('http://localhost/nifi/')
                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, null);
                expect(apiClient.getProcessorProperties).not.toHaveBeenCalled();
                expect(mockElement.find('.issuer-form').length).toBe(1); // Sample form due to empty processorId
                expect(mockElement.find('.issuer-form .issuer-name').val()).toBe('sample-issuer');

                mockElement.empty();
                apiClient.getProcessorProperties.mockClear();

                // Test with a number (non-string) URL
                // effectiveUrlForInit becomes window.location.href ('http://localhost/nifi/')
                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, 12345);
                expect(apiClient.getProcessorProperties).not.toHaveBeenCalled();
                expect(mockElement.find('.issuer-form').length).toBe(1); // Sample form
                expect(mockElement.find('.issuer-form .issuer-name').val()).toBe('sample-issuer');

                // Restore original window.location object and mockLocation.href from the main beforeEach
                Object.defineProperty(window, 'location', {
                    value: originalWindowLocation, // This is the object from the outer scope's beforeEach
                    writable: true,
                    configurable: true
                });
                mockLocation.href = originalMockLocationHref; // Restore href for the shared mockLocation object
            });
        });

        describe('loadExistingIssuers', function () {
            it('should populate forms from processor properties', function () {
                const mockProperties = {
                    'issuer.issuerOne.issuer': 'uri1',
                    'issuer.issuerOne.jwks-url': 'url1',
                    'issuer.issuerTwo.issuer': 'uri2',
                    'issuer.issuerTwo.jwks-url': 'url2',
                    'unrelated.property': 'test'
                };
                apiClient.getProcessorProperties.mockReturnValue($.Deferred().resolve({ properties: mockProperties }).promise());

                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                expect(mockElement.find('.issuer-form').length).toBe(2);
                const formOne = mockElement.find('.issuer-form').filter((_i, el) => $(el).find('.issuer-name').val() === 'issuerOne');
                expect(formOne.length).toBe(1);
                expect(formOne.find('.field-issuer').val()).toBe('uri1');
                expect(formOne.find('.field-jwks-url').val()).toBe('url1');

                const formTwo = mockElement.find('.issuer-form').filter((_i, el) => $(el).find('.issuer-name').val() === 'issuerTwo');
                expect(formTwo.length).toBe(1);
                expect(formTwo.find('.field-issuer').val()).toBe('uri2');
                expect(formTwo.find('.field-jwks-url').val()).toBe('url2');
            });

            it('should add a sample issuer if getProcessorProperties fails', function () {
                apiClient.getProcessorProperties.mockReturnValue($.Deferred().reject('API Error').promise());
                mockLocation.href = 'http://localhost/nifi/processors/abcde-fail-id/edit'; // Valid ID
                currentTestUrl = mockLocation.href;

                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                // If deferred is rejected with a single string 'API Error', then xhr='API Error', status=undefined, error=undefined
                expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Error loading processor properties:', undefined, undefined);
                expect(mockElement.find('.issuer-form').length).toBe(1);
                expect(mockElement.find('.issuer-name').val()).toBe('sample-issuer');
            });

            it('should add a sample issuer if an exception occurs during getProcessorProperties', function () {
                const specificError = new Error('Specific Unexpected Exception');
                apiClient.getProcessorProperties.mockImplementation(() => {
                    throw specificError;
                });
                mockLocation.href = 'http://localhost/nifi/processors/abcde-exception-id/edit'; // Valid ID
                currentTestUrl = mockLocation.href;

                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in loadExistingIssuers:', specificError);
                expect(mockElement.find('.issuer-form').length).toBe(1);
                expect(mockElement.find('.issuer-name').val()).toBe('sample-issuer');
            });

            it('should correctly parse properties and ignore malformed ones', function () {
                const mockProperties = {
                    properties: {
                        'issuer.validone.issuer': 'uri1',
                        'issuer.malformed': 'value1', // Malformed - no second dot
                        'issuer.another.jwks-url': 'url2',
                        'issuer.another.extra.bit': 'value2' // Malformed - too many parts
                    }
                };
                apiClient.getProcessorProperties.mockReturnValue($.Deferred().resolve(mockProperties).promise());

                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                expect(mockElement.find('.issuer-form').length).toBe(2);
                expect(mockElement.find('.issuer-form').filter((_i, el) => $(el).find('.issuer-name').val() === 'validone').length).toBe(1);
                expect(mockElement.find('.issuer-form').filter((_i, el) => $(el).find('.issuer-name').val() === 'another').length).toBe(1);
                // Ensure no errors were logged for malformed properties specifically (other logs might exist)
                expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Malformed property key'));
            });

            it('TEMP TEST: should demonstrate .fail() handler logging via spy', () => { // Renamed for clarity
                mockLocation.href = 'http://localhost/nifi/processors/abcde-temp-id/edit'; // Valid ID
                currentTestUrl = mockLocation.href;
                // Use .mockImplementation() on the existing mock function
                apiClient.getProcessorProperties.mockImplementation(() => {
                    tempTestPathHit = true;
                    // Removed direct console.error: console.error('Direct call test from apiClient mock');
                    // The component's .fail() handler is what we're testing the spy against.
                    return $.Deferred().reject('Forced reject after direct console call').promise();
                });

                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                expect(tempTestPathHit).toBe(true);
                // Check that the .fail() handler's console.error was also called (via the spy)
                expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Error loading processor properties:', undefined, undefined);
            });
        });

        describe('jQuery mock sanity checks', function () {
            it('should allow appending and finding an element', function () {
                const parentDiv = $('<div id="parent"></div>').appendTo(mockElement[0]); // mockElement[0] is the #test-container
                const childDiv = $('<div class="child">Hello</div>').appendTo(parentDiv); // Append to the jQuery object parentDiv

                // Test finding within mockElement directly
                const foundInMockElement = mockElement.find('.child');
                expect(foundInMockElement.length).toBe(1);
                expect(foundInMockElement.text()).toBe('Hello');

                // Test finding within the created parentDiv
                const foundInParentDiv = parentDiv.find('.child');
                expect(foundInParentDiv.length).toBe(1);
                expect(foundInParentDiv.text()).toBe('Hello');
            });
        });

        describe('addIssuerForm interaction (via Add Issuer button)', function () {
            it('should add a new blank issuer form when "Add Issuer" is clicked', function () {
                // Mock getProcessorProperties for the init call in this test
                // to ensure it loads zero forms initially.
                // currentTestUrl from the main beforeEach is 'http://localhost/nifi/processors/12345-abcde/edit'
                apiClient.getProcessorProperties.mockReturnValue($.Deferred().resolve({ properties: {} }).promise());

                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                // After init, with the above mock, no forms should be loaded from properties.
                expect(mockElement.find('.issuer-form').length).toBe(0);

                // Now, trigger the button click to add a new blank form.
                mockElement.find('.add-issuer-button').trigger('click');

                expect(mockElement.find('.issuer-form').length).toBe(1);
                const newForm = mockElement.find('.issuer-form').last();
                expect(newForm.find('.issuer-name').val()).toBe('');
                expect(newForm.find('.field-issuer').val()).toBe('');
                // Check for JWKS test connection button and result area
                expect(newForm.find('.verify-jwks-button').length).toBe(1);
                expect(newForm.find('.verification-result').length).toBe(1);
                expect(newForm.find('.verification-result').text()).toContain('Click the button to validate JWKS');
            });
        });

        describe('JWKS URL Validation (Test Connection)', function () {
            let form;
            beforeEach(() => {
                // Initialize the component and add one form
                apiClient.getProcessorProperties.mockReturnValue($.Deferred().resolve({ properties: {} }).promise());
                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);
                mockElement.find('.add-issuer-button').trigger('click');
                form = mockElement.find('.issuer-form').first();
                // expect(form.length).toBe(1); // Ensure form is found - Removed for jest/no-standalone-expect
                // const button = form.find('.verify-jwks-button'); // Unused: Removed
                // expect(button.length).toBe(1); // Ensure button is found within the form - Removed for jest/no-standalone-expect
            });

            it('should show success for valid JWKS URL', function () {
                $.ajax.mockImplementation((options) => {
                    if (options.success) {
                        options.success({ valid: true, keyCount: 3 });
                    }
                    return {
                        done: (cb) => { cb({ valid: true, keyCount: 3 }); return { fail: () => {} }; },
                        fail: () => {},
                        then: (cb) => { cb({ valid: true, keyCount: 3 }); return { catch: () => {} }; },
                        catch: () => {}
                    };
                });
                form.find('.field-jwks-url').val('https://valid.jwks.url/keys');
                form.find('.verify-jwks-button').trigger('click'); // This should trigger the UI update

                // Directly check the final state.
                // If this fails, it means the handler didn't run or update the resultContainer correctly.
                expect($.ajax).toHaveBeenCalled(); // Check if the handler was even triggered
                expect(form.find('.verification-result').html()).toContain('OK</span> Valid JWKS (3 keys found)');
            });

            it('should show failure for invalid JWKS URL', function () {
                $.ajax.mockImplementation((options) => {
                    if (options.success) {
                        options.success({ valid: false, message: 'Keys not found' });
                    }
                    return {
                        done: (cb) => { cb({ valid: false, message: 'Keys not found' }); return { fail: () => {} }; },
                        fail: () => {},
                        then: (cb) => { cb({ valid: false, message: 'Keys not found' }); return { catch: () => {} }; },
                        catch: () => {}
                    };
                });
                form.find('.field-jwks-url').val('https://invalid.jwks.url/keys');
                form.find('.verify-jwks-button').trigger('click');
                expect(form.find('.verification-result').html()).toContain('Failed</span> Invalid JWKS: Keys not found');
            });

            it('should show error if AJAX call fails for non-localhost', function () {
                const originalIndexOf = String.prototype.indexOf;
                const nonLocalhostUrl = 'http://some-non-localhost-url/nifi/processors/12345-abcde/edit';

                try {
                    String.prototype.indexOf = jest.fn(function (searchTerm) {
                        // 'this' refers to the string instance indexOf was called on.
                        if (this.toString() === nonLocalhostUrl && searchTerm === 'localhost') {
                            return -1; // Force 'localhost' not found for our specific URL
                        }
                        if (this.toString() === nonLocalhostUrl && searchTerm === '127.0.0.1') {
                            return -1; // Force '127.0.0.1' not found for our specific URL
                        }
                        return originalIndexOf.apply(this, arguments);
                    });

                    // Set window.location.href to the specific non-localhost URL
                    const originalTestWindowLocation = window.location;
                    window.location = { href: nonLocalhostUrl };

                    $.ajax.mockImplementation((options) => {
                        if (options.error) {
                            options.error({ responseText: 'Actual AJAX error' }, 'error', 'Error Condition');
                        }
                        return {
                            done: () => { return { fail: (cb) => { cb({ responseText: 'Actual AJAX error' }, 'error', 'Error Condition'); } }; },
                            fail: (cb) => { cb({ responseText: 'Actual AJAX error' }, 'error', 'Error Condition'); },
                            then: () => { return { catch: (cb) => { cb({ responseText: 'Actual AJAX error' }, 'error', 'Error Condition'); } }; },
                            catch: (cb) => { cb({ responseText: 'Actual AJAX error' }, 'error', 'Error Condition'); }
                        };
                    });

                    form.find('.field-jwks-url').val('https://failing.jwks.url/keys');
                    form.find('.verify-jwks-button').trigger('click');

                    expect(String.prototype.indexOf).toHaveBeenCalled(); // Ensure our mock was used
                    expect(form.find('.verification-result').html()).toContain('Failed</span> Validation error: Actual AJAX error');

                    window.location = originalTestWindowLocation; // Restore location for this test's scope
                } finally {
                    String.prototype.indexOf = originalIndexOf; // Restore original indexOf
                }
            });

            it('should use simulated response for localhost if AJAX fails', function () {
                $.ajax.mockImplementation((options) => {
                    if (options.error) {
                        // Simulate the behavior of jquery-extended.js for localhost failure
                        // It might call success with a simulated response or handle it internally
                        // For this test, we assume the component's logic for simulated response is triggered by the .fail() path
                        options.error(null, 'network error', 'Network Error');
                    }
                    return {
                        done: () => { return { fail: (cb) => { cb(null, 'network error', 'Network Error'); } }; },
                        fail: (cb) => { cb(null, 'network error', 'Network Error'); },
                        then: () => { return { catch: (cb) => { cb(null, 'network error', 'Network Error'); } }; },
                        catch: (cb) => { cb(null, 'network error', 'Network Error'); }
                    };
                });
                mockLocation.href = 'http://localhost/nifi/processors/12345-abcde/edit'; // localhost
                form.find('.field-jwks-url').val('https://any.jwks.url/keys');
                form.find('.verify-jwks-button').trigger('click');
                expect(form.find('.verification-result').html()).toContain('OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
            });

            it('should handle exception during AJAX call setup', function () {
                $.ajax.mockImplementation(() => {
                    throw new Error('Setup exception');
                });
                mockLocation.href = 'http://localhost/nifi/processors/12345-abcde/edit'; // localhost for simulated
                form.find('.field-jwks-url').val('https://any.jwks.url/keys');
                form.find('.verify-jwks-button').trigger('click');
                expect(form.find('.verification-result').html()).toContain('OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
                expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation:', expect.any(Error));
            });

            it('should use simulated response for 127.0.0.1 if AJAX fails', function () {
                $.ajax.mockImplementation((options) => {
                    if (options.error) {
                        options.error(null, 'network error', 'Network Error');
                    }
                    return {
                        done: () => { return { fail: (cb) => { cb(null, 'network error', 'Network Error'); } }; },
                        fail: (cb) => { cb(null, 'network error', 'Network Error'); },
                        then: () => { return { catch: (cb) => { cb(null, 'network error', 'Network Error'); } }; },
                        catch: (cb) => { cb(null, 'network error', 'Network Error'); }
                    };
                });
                mockLocation.href = 'http://127.0.0.1/nifi/processors/12345-abcde/edit'; // 127.0.0.1
                form.find('.field-jwks-url').val('https://any.jwks.url/keys');
                form.find('.verify-jwks-button').trigger('click');
                expect(form.find('.verification-result').html()).toContain('OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
                expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG_LOG] Using simulated response for standalone testing');
            });
        });

        describe('Save Issuer functionality', function () {
            let form;
            beforeEach(() => {
                // Initialize and add one form
                apiClient.getProcessorProperties.mockReturnValue($.Deferred().resolve({ properties: {} }).promise());
                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);
                mockElement.find('.add-issuer-button').trigger('click');
                form = mockElement.find('.issuer-form').first();
            });

            it('should show alert if issuer name is missing', function () {
                form.find('.issuer-name').val('');
                form.find('.save-issuer-button').trigger('click');
                expect(window.alert).toHaveBeenCalledWith('Error: Issuer name is required.');
                expect(apiClient.updateProcessorProperties).not.toHaveBeenCalled();
            });

            it('should show alert if issuer URI is missing', function () {
                form.find('.issuer-name').val('test-issuer');
                form.find('.field-issuer').val('');
                form.find('.field-jwks-url').val('https://some.url/jwks.json');
                form.find('.save-issuer-button').trigger('click');
                expect(window.alert).toHaveBeenCalledWith('Error: Issuer URI and JWKS URL are required.');
                expect(apiClient.updateProcessorProperties).not.toHaveBeenCalled();
            });

            it('should show alert if JWKS URL is missing', function () {
                form.find('.issuer-name').val('test-issuer');
                form.find('.field-issuer').val('https://some.issuer/uri');
                form.find('.field-jwks-url').val('');
                form.find('.save-issuer-button').trigger('click');
                expect(window.alert).toHaveBeenCalledWith('Error: Issuer URI and JWKS URL are required.');
                expect(apiClient.updateProcessorProperties).not.toHaveBeenCalled();
            });

            // Using processorId '12345-abcde' from the main beforeEach init
            it('should call updateProcessorProperties and show success on successful save', function () {
                form.find('.issuer-name').val('test-issuer');
                form.find('.field-issuer').val('https://test.com/issuer');
                form.find('.field-jwks-url').val('https://test.com/jwks.json');
                form.find('.field-audience').val('aud1');
                // Not setting client-id to test empty string handling

                apiClient.updateProcessorProperties.mockReturnValueOnce($.Deferred().resolve().promise()); // Use Once for specific test interaction
                form.find('.save-issuer-button').trigger('click');

                const expectedUpdates = {
                    'issuer.test-issuer.issuer': 'https://test.com/issuer',
                    'issuer.test-issuer.jwks-url': 'https://test.com/jwks.json',
                    'issuer.test-issuer.audience': 'aud1'
                    // Client ID should not be present if its input is empty
                };
                expect(apiClient.updateProcessorProperties).toHaveBeenCalledWith('12345-abcde', expectedUpdates);
                expect(window.alert).toHaveBeenCalledWith('Success: Issuer configuration saved successfully.');
            });

            // Using processorId '12345-abcde'
            it('should handle empty optional fields correctly during save', function () {
                form.find('.issuer-name').val('test-empty');
                form.find('.field-issuer').val('https://test.empty.com/issuer');
                form.find('.field-jwks-url').val('https://test.empty.com/jwks.json');
                form.find('.field-audience').val(''); // Empty optional field
                form.find('.field-client-id').val(''); // Empty optional field

                apiClient.updateProcessorProperties.mockReturnValueOnce($.Deferred().resolve().promise()); // Use Once
                form.find('.save-issuer-button').trigger('click');

                const expectedUpdates = {
                    'issuer.test-empty.issuer': 'https://test.empty.com/issuer',
                    'issuer.test-empty.jwks-url': 'https://test.empty.com/jwks.json'
                    // Audience and Client ID should not be present if their inputs are empty
                };
                expect(apiClient.updateProcessorProperties).toHaveBeenCalledWith('12345-abcde', expectedUpdates);
            });

            // Using processorId '12345-abcde'
            it('should show error on failed save and log to console', function () {
                form.find('.issuer-name').val('test-issuer');
                form.find('.field-issuer').val('https://test.com/issuer');
                form.find('.field-jwks-url').val('https://test.com/jwks.json');

                // Scenario 1: xhr is null, error argument is used
                apiClient.updateProcessorProperties.mockReturnValueOnce($.Deferred().reject(null, 'API Error Status', 'Save Failed Message').promise());
                form.find('.save-issuer-button').trigger('click');
                expect(window.alert).toHaveBeenCalledWith('Error: Failed to save issuer configuration. See console for details.');
                expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Error updating processor properties:', 'API Error Status', 'Save Failed Message');
                window.alert.mockClear(); consoleErrorSpy.mockClear(); apiClient.updateProcessorProperties.mockClear(); // Clear for next scenario

                // Scenario 2: xhr.responseText is JSON with a message
                const jsonErrorResponse = { message: 'JSON error from server' };
                apiClient.updateProcessorProperties.mockReturnValueOnce($.Deferred().reject({ responseText: JSON.stringify(jsonErrorResponse) }, 'API Error Status JSON', 'Ignored Error Arg').promise());
                form.find('.save-issuer-button').trigger('click');
                expect(window.alert).toHaveBeenCalledWith('Error: Failed to save issuer configuration. See console for details.');
                expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error updating processor properties'), 'API Error Status JSON', expect.anything());
                window.alert.mockClear(); consoleErrorSpy.mockClear(); apiClient.updateProcessorProperties.mockClear(); // Clear for next scenario

                // Scenario 3: xhr.responseText is non-JSON text
                apiClient.updateProcessorProperties.mockReturnValueOnce($.Deferred().reject({ responseText: 'Plain text error from server' }, 'API Error Status Text', 'Ignored Error Arg').promise());
                form.find('.save-issuer-button').trigger('click');
                expect(window.alert).toHaveBeenCalledWith('Error: Failed to save issuer configuration. See console for details.');
                expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error updating processor properties'), 'API Error Status Text', expect.anything());
            });

            // Using processorId '12345-abcde'
            it('should show error on exception during save and log to console', function () {
                form.find('.issuer-name').val('test-issuer');
                form.find('.field-issuer').val('https://test.com/issuer');
                form.find('.field-jwks-url').val('https://test.com/jwks.json');
                const exception = new Error('Save Exception');
                apiClient.updateProcessorProperties.mockImplementationOnce(() => { throw exception; }); // Use Once

                form.find('.save-issuer-button').trigger('click');

                expect(window.alert).toHaveBeenCalledWith('Error: Failed to save issuer configuration due to an exception. See console for details.');
                expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in saveIssuer:', exception);
            });

            it('should save in standalone mode if no processorId', function () {
                // This test needs its own init with a specific URL
                const originalTestWindowLocation = window.location;
                window.location = { href: 'http://localhost/nifi/' }; // No processorId
                currentTestUrl = window.location.href;

                // Since this init will likely add a sample form, clear any from outer beforeEaches
                mockElement.find('.issuers-container').empty();
                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                form = mockElement.find('.issuer-form').first(); // Should be the sample form
                expect(form.length).toBe(1);

                // Use the sample form's default name or set a new one
                form.find('.issuer-name').val(form.find('.issuer-name').val() || 'standalone-issuer');
                form.find('.field-issuer').val('https://standalone.com/issuer');
                form.find('.field-jwks-url').val('https://standalone.com/jwks.json');
                // Clear audience/client-id if they have values from sample to match assertion
                form.find('.field-audience').val('');
                form.find('.field-client-id').val('');


                form.find('.save-issuer-button').trigger('click');

                expect(apiClient.updateProcessorProperties).not.toHaveBeenCalled();
                expect(window.alert).toHaveBeenCalledWith('Success: Issuer configuration saved successfully (standalone mode).');
                expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG_LOG] Saving issuer in standalone mode:', form.find('.issuer-name').val(), {
                    issuer: 'https://standalone.com/issuer',
                    'jwks-url': 'https://standalone.com/jwks.json',
                    audience: '',
                    'client-id': ''
                });
                window.location = originalTestWindowLocation; // Restore
            });
        });

        // TODO: These tests are skipped because the module-level 'processorId' in issuerConfigEditor.js
        // appears to be unexpectedly reset to an empty string before the removeIssuer function is called
        // by the click handler. The processorId is correctly set during the init() call in the beforeEach
        // of this suite, but it's lost by the time the event handler executes. This needs further
        // investigation to determine if an unintended init() call is happening or if there's another
        // state corruption issue.
        // The entire 'Remove Issuer functionality' describe block has been removed to prevent parsing errors
        // and to satisfy linting rules regarding commented-out/skipped tests.
        // No TODO needed, init's catch block test was added above.

        describe('Remove Issuer functionality', function () {
            let form;
            const issuerName = 'test-issuer-to-remove';

            beforeEach(() => {
                // Initialize with one existing issuer matching `issuerName`
                const mockProperties = {
                    properties: {
                        ['issuer.' + issuerName + '.issuer']: 'uri-to-remove',
                        ['issuer.' + issuerName + '.jwks-url']: 'url-to-remove'
                    }
                };
                apiClient.getProcessorProperties.mockReturnValue($.Deferred().resolve(mockProperties).promise());
                // currentTestUrl (e.g., 'http://localhost/nifi/processors/12345-abcde/edit') is set in the main beforeEach
                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                // Find the specific form for 'test-issuer-to-remove'
                form = mockElement.find('.issuer-form').filter((_i, el) => $(el).find('.issuer-name').val() === issuerName);
                expect(form.length).toBe(1); // Ensure the form is loaded
            });

            it('should call window.confirm before removing', function () {
                window.confirm.mockReturnValue(false); // Simulate user clicking "Cancel"

                form.find('.remove-issuer-button').trigger('click');

                expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to remove this issuer configuration?');
                expect(apiClient.updateProcessorProperties).not.toHaveBeenCalled();
                expect(mockElement.find('.issuer-form').filter((_i, el) => $(el).find('.issuer-name').val() === issuerName).length).toBe(1); // Form should still exist
            });

            it('should remove issuer and call updateProcessorProperties with null values on successful removal', function () {
                window.confirm.mockReturnValue(true); // Simulate user clicking "OK"
                // Mock getProcessorProperties for the call inside removeIssuer
                const initialProps = {
                    properties: {
                        ['issuer.' + issuerName + '.issuer']: 'uri-to-remove',
                        ['issuer.' + issuerName + '.jwks-url']: 'url-to-remove',
                        ['issuer.' + issuerName + '.audience']: 'aud-remove',
                        'other.property': 'value'
                    }
                };
                apiClient.getProcessorProperties.mockReturnValueOnce($.Deferred().resolve(initialProps).promise());
                apiClient.updateProcessorProperties.mockReturnValueOnce($.Deferred().resolve().promise());

                form.find('.remove-issuer-button').trigger('click');

                expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to remove this issuer configuration?');
                // Check getProcessorProperties call inside removeIssuer (processorId from currentTestUrl is '12345-abcde')
                expect(apiClient.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');

                const expectedUpdates = {
                    ['issuer.' + issuerName + '.issuer']: null,
                    ['issuer.' + issuerName + '.jwks-url']: null,
                    ['issuer.' + issuerName + '.audience']: null
                };
                expect(apiClient.updateProcessorProperties).toHaveBeenCalledWith('12345-abcde', expectedUpdates);
                expect(window.alert).toHaveBeenCalledWith('Success: Issuer configuration removed successfully.');
                expect(mockElement.find('.issuer-form').filter((_i, el) => $(el).find('.issuer-name').val() === issuerName).length).toBe(0); // Form should be removed
            });

            it('should remove the form from UI even if no properties were found to unset (e.g. new unsaved form)', function () {
                window.confirm.mockReturnValue(true);
                // Simulate a new form that hasn't been saved, so getProcessorProperties returns no specific props for it.
                // Or an existing one for which properties were already cleared.
                apiClient.getProcessorProperties.mockReturnValueOnce($.Deferred().resolve({ properties: {} }).promise());
                // updateProcessorProperties should NOT be called if no properties are found for the issuer.
                // However, the component's current logic might call it with an empty updates object if the issuer name is not 'sample-issuer'.
                // The component shows a warning for this case if it's not 'sample-issuer' but proceeds.
                // For tests, we expect the success alert as per current component behavior.

                form.find('.remove-issuer-button').trigger('click');

                expect(window.confirm).toHaveBeenCalledTimes(1);
                expect(apiClient.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');
                // Depending on the exact logic for "no properties found", update might be called with {} or not at all.
                // Current SUT: if (Object.keys(updates).length === 0 && currentIssuerName !== 'sample-issuer') { console.warn; window.alert('Success...'); return; }
                // So, updateProcessorProperties won't be called in this specific path.
                expect(apiClient.updateProcessorProperties).not.toHaveBeenCalled();
                expect(window.alert).toHaveBeenCalledWith('Success: Issuer configuration removed successfully.'); // This alert is shown by the component
                expect(mockElement.find('.issuer-form').filter((_i, el) => $(el).find('.issuer-name').val() === issuerName).length).toBe(0); // Form should be removed
            });


            it('should handle API error during getProcessorProperties for removal and show alert', function () {
                window.confirm.mockReturnValue(true);
                apiClient.getProcessorProperties.mockReturnValueOnce($.Deferred().reject('API Get Error').promise());

                form.find('.remove-issuer-button').trigger('click');

                expect(apiClient.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');
                expect(apiClient.updateProcessorProperties).not.toHaveBeenCalled();
                expect(window.alert).toHaveBeenCalledWith('Error: Failed to get processor properties. See console for details.');
                expect(mockElement.find('.issuer-form').filter((_i, el) => $(el).find('.issuer-name').val() === issuerName).length).toBe(0); // Form is removed from DOM regardless of API error
            });

            it('should handle API error during updateProcessorProperties for removal and show alert', function () {
                window.confirm.mockReturnValue(true);
                const initialProps = {
                    properties: { ['issuer.' + issuerName + '.issuer']: 'uri-to-remove' }
                };
                apiClient.getProcessorProperties.mockReturnValueOnce($.Deferred().resolve(initialProps).promise());
                apiClient.updateProcessorProperties.mockReturnValueOnce($.Deferred().reject(null, 'API Update Error Status', 'Update Failed Message').promise());

                form.find('.remove-issuer-button').trigger('click');

                expect(apiClient.updateProcessorProperties).toHaveBeenCalled();
                expect(window.alert).toHaveBeenCalledWith('Error: Failed to remove issuer configuration. See console for details.');
                expect(mockElement.find('.issuer-form').filter((_i, el) => $(el).find('.issuer-name').val() === issuerName).length).toBe(0); // Form is removed
            });

            it('should handle exception during getProcessorProperties for removal and show alert', function () {
                window.confirm.mockReturnValue(true);
                const exception = new Error('Get Props Exception');
                apiClient.getProcessorProperties.mockImplementationOnce(() => { throw exception; });

                form.find('.remove-issuer-button').trigger('click');

                expect(window.alert).toHaveBeenCalledWith('Error: Failed to remove issuer configuration due to an exception. See console for details.');
                expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in removeIssuer:', exception);
                expect(mockElement.find('.issuer-form').filter((_i, el) => $(el).find('.issuer-name').val() === issuerName).length).toBe(0); // Form removed
            });

            it('should handle exception during updateProcessorProperties for removal and show alert', function () {
                window.confirm.mockReturnValue(true);
                const initialProps = {
                    properties: { ['issuer.' + issuerName + '.issuer']: 'uri-to-remove' }
                };
                apiClient.getProcessorProperties.mockReturnValueOnce($.Deferred().resolve(initialProps).promise());
                const exception = new Error('Update Props Exception');
                apiClient.updateProcessorProperties.mockImplementationOnce(() => { throw exception; });

                form.find('.remove-issuer-button').trigger('click');

                expect(window.alert).toHaveBeenCalledWith('Error: Failed to remove issuer configuration due to an exception. See console for details.');
                expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in removeIssuer:', exception);
                expect(mockElement.find('.issuer-form').filter((_i, el) => $(el).find('.issuer-name').val() === issuerName).length).toBe(0); // Form removed
            });

            describe('Standalone mode (no processorId)', function () {
                let originalTestWindowLocationForStandalone; // Specific for this describe's beforeEach/afterEach pair
                beforeEach(() => {
                    // Set URL to one without a processorId for these specific tests
                    originalTestWindowLocationForStandalone = window.location; // Store current window.location
                    window.location = { href: 'http://localhost/nifi/' }; // No processorId
                    currentTestUrl = window.location.href; // Update for init

                    // Re-initialize with no processorId, this should load a sample issuer or be empty
                    mockElement.empty(); // Clear previous content
                    apiClient.getProcessorProperties.mockClear(); // Ensure it's not called
                    // Init for standalone: it will add a sample issuer if no processorId
                    issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                    // Add a specific issuer form for removal in standalone
                    mockElement.find('.add-issuer-button').trigger('click');
                    form = mockElement.find('.issuer-form').last(); // Get the newly added form
                    form.find('.issuer-name').val(issuerName); // Set its name
                });

                afterEach(() => {
                    // Restore window.location specific to this describe block's changes
                    if (originalTestWindowLocationForStandalone) {
                        window.location = originalTestWindowLocationForStandalone;
                    }
                    // Reset currentTestUrl to the main one from the outer beforeEach,
                    // so that subsequent tests in other describe blocks are not affected.
                    currentTestUrl = 'http://localhost/nifi/processors/12345-abcde/edit';
                });

                it('should remove form from UI and not call apiClient in standalone mode', function () {
                    window.confirm.mockReturnValue(true);
                    // Ensure no processorId context for this test
                    // eslint-disable-next-line jest/no-standalone-expect
                    expect(currentTestUrl).toBe('http://localhost/nifi/');

                    // The form to remove is the one we just added and named 'test-issuer-to-remove'
                    const formsBeforeRemoval = mockElement.find('.issuer-form').filter((_i, el) => $(el).find('.issuer-name').val() === issuerName);
                    expect(formsBeforeRemoval.length).toBe(1);


                    formsBeforeRemoval.find('.remove-issuer-button').trigger('click');

                    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to remove this issuer configuration?');
                    expect(apiClient.getProcessorProperties).not.toHaveBeenCalled(); // Should not be called if no processorId
                    expect(apiClient.updateProcessorProperties).not.toHaveBeenCalled();
                    // Check console log for standalone removal
                    expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG_LOG] Removing issuer in standalone mode. Issuer:', issuerName);
                    // No alert should be shown for success in standalone, as per component code
                    expect(window.alert).not.toHaveBeenCalledWith(expect.stringContaining('Success'));
                    expect(mockElement.find('.issuer-form').filter((_i, el) => $(el).find('.issuer-name').val() === issuerName).length).toBe(0);
                });
            });
        });
    });
});
