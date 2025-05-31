define([
    'jquery',
    'components/issuerConfigEditor', // The module under test
    'nf.Common',
    'services/apiClient',
    'js/utils/formatters'
], function ($, issuerConfigEditor, nfCommon, apiClient, formatters) {
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

        // Mock apiClient
        apiClient.getProcessorProperties = jest.fn();
        apiClient.updateProcessorProperties = jest.fn();

        // Mock formatters (even if not directly used, it's a dependency)
        formatters.formatValue = jest.fn(val => String(val));

        // Mock global jQuery AJAX
        // $.ajax = jest.fn(); // This will be redefined later inside tests if needed for specific scenarios.

        // Mock window.location.href
        let originalLocation;
        let mockLocation;

        // Mock window methods and console
        let originalAlert, originalConfirm;
        let consoleErrorSpy, consoleLogSpy, originalConsoleError, originalConsoleLog;
        let tempTestPathHit = false; // Flag for the TEMP TEST

        beforeEach(function () {
            originalAlert = window.alert;
            originalConfirm = window.confirm;
            originalConsoleError = console.error; // Store original console.error
            originalConsoleLog = console.log;   // Store original console.log

            window.alert = jest.fn();
            window.confirm = jest.fn();

            // Spy on console methods
            // Using mockImplementation to still see output if needed: jest.fn( (...args) => originalConsoleError.apply(console, args) )
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Keep it silent for now
            consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); // Keep it silent

            tempTestPathHit = false; // Reset flag for each test

            // Reset all mocks created with jest.fn() AND spies
            jest.clearAllMocks(); // This should clear spies as well
            // If explicit reset is needed for spies:
            // consoleErrorSpy.mockClear();
            // consoleLogSpy.mockClear();

            nfCommon.getI18n.mockClear().mockReturnValue(mockI18n);
            apiClient.getProcessorProperties.mockClear();
            apiClient.updateProcessorProperties.mockClear();
            formatters.formatValue.mockClear().mockImplementation(val => String(val));

            // Setup mock DOM element
            mockElement = $('<div id="test-container"></div>').appendTo('body');

            mockConfig = {}; // Default empty config
            mockCallback = jest.fn();

            // Mock window.location.href
            originalLocation = window.location; // This will actually store the original window.location object
            // Adjusted to match the regex in getProcessorIdFromUrl
            mockLocation = { href: 'http://localhost/nifi/processors/12345-abcde/edit' };
            Object.defineProperty(window, 'location', {
                writable: true,
                value: mockLocation,
                configurable: true // Allow redefinition in afterEach
            });

            // Default mock for apiClient calls to return promises
            apiClient.getProcessorProperties.mockReturnValue($.Deferred().resolve({ properties: {} }).promise());
            apiClient.updateProcessorProperties.mockReturnValue($.Deferred().resolve().promise());

            currentTestUrl = mockLocation.href; // Initialize currentTestUrl

            // Default $.ajax mock
            // Storing and restoring global $.ajax might be problematic if other tests also modify it.
            // It's better to ensure each test suite using it cleans up if it mocks $.ajax globally.
            // For now, keep it simple as this suite is the primary user of this mock.
            if (!global.originalAjax) global.originalAjax = $.ajax;
            $.ajax = jest.fn(() => $.Deferred().resolve({ valid: true, keyCount: 1 }).promise());
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

            if (global.originalAjax) { // Restore original $.ajax if it was stored
                $.ajax = global.originalAjax;
            }
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
                expect(console.error).not.toHaveBeenCalled(); // Check for unexpected errors using the spy
            });

            it('should call loadExistingIssuers which calls getProcessorProperties if processorId is found', function () {
                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);
                expect(apiClient.getProcessorProperties).toHaveBeenCalledWith('12345-abcde');
            });

            it('should handle null element gracefully', function () {
                issuerConfigEditor.init(null, mockConfig, null, mockCallback, currentTestUrl);
                expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] Error: No element provided to issuerConfigEditor.init'); // Use spied console.error
                expect(mockCallback).toHaveBeenCalled();
            });

            it('should handle null config gracefully', function () {
                issuerConfigEditor.init(mockElement[0], null, null, mockCallback, currentTestUrl);
                expect(mockCallback).toHaveBeenCalled();
                // Check that no TypeError or similar is logged due to null config
                expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('TypeError'));
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

                expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] Error initializing issuerConfigEditor:', testError);
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
                const formOne = mockElement.find('.issuer-name[value="issuerOne"]').closest('.issuer-form');
                expect(formOne.length).toBe(1);
                expect(formOne.find('.field-issuer').val()).toBe('uri1');
                expect(formOne.find('.field-jwks-url').val()).toBe('url1');

                const formTwo = mockElement.find('.issuer-name[value="issuerTwo"]').closest('.issuer-form');
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
                expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] Error loading processor properties:', undefined, undefined);
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

                expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] Exception in loadExistingIssuers:', specificError);
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
                expect(mockElement.find('.issuer-name[value="validone"]').length).toBe(1);
                expect(mockElement.find('.issuer-name[value="another"]').length).toBe(1);
                // Ensure no errors were logged for malformed properties specifically (other logs might exist)
                expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('Malformed property key'));
            });

            it('TEMP TEST: should call console.error directly if apiClient is forced, and also from .fail()', () => {
                mockLocation.href = 'http://localhost/nifi/processors/abcde-temp-id/edit'; // Valid ID
                currentTestUrl = mockLocation.href;
                apiClient.getProcessorProperties = jest.fn(() => {
                    tempTestPathHit = true;
                    console.error('Direct call test from apiClient mock');
                    // This rejection will cause the .fail() handler in the component to be called
                    return $.Deferred().reject('Forced reject after direct console call').promise();
                });

                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                expect(tempTestPathHit).toBe(true);
                expect(console.error).toHaveBeenCalledWith('Direct call test from apiClient mock');
                // Check that the .fail() handler's console.error was also called
                expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] Error loading processor properties:', undefined, undefined);
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
                // Mock getProcessorProperties to return an empty set, so no initial forms are loaded
                apiClient.getProcessorProperties.mockReturnValue($.Deferred().resolve({ properties: {} }).promise());
                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                // Ensure no forms initially from loadExistingIssuers
                expect(mockElement.find('.issuer-form').length).toBe(0);

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
                expect(form.length).toBe(1); // Ensure form is found
                const button = form.find('.verify-jwks-button');
                expect(button.length).toBe(1); // Ensure button is found within the form
            });

            it('should show success for valid JWKS URL', function () {
                $.ajax.mockReturnValue($.Deferred().resolve({ valid: true, keyCount: 3 }).promise());
                form.find('.field-jwks-url').val('https://valid.jwks.url/keys');
                form.find('.verify-jwks-button').trigger('click'); // This should trigger the UI update

                // Directly check the final state.
                // If this fails, it means the handler didn't run or update the resultContainer correctly.
                expect($.ajax).toHaveBeenCalled(); // Check if the handler was even triggered
                expect(form.find('.verification-result').html()).toContain('OK</span> Valid JWKS (3 keys found)');
            });

            it('should show failure for invalid JWKS URL', function () {
                $.ajax.mockReturnValue($.Deferred().resolve({ valid: false, message: 'Keys not found' }).promise());
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

                    $.ajax.mockReturnValue($.Deferred().reject({ responseText: 'Actual AJAX error' }, 'error', 'Error Condition').promise());

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
                $.ajax.mockReturnValue($.Deferred().reject(null, 'network error', 'Network Error').promise());
                mockLocation.href = 'http://localhost/nifi/processors/12345-abcde/edit'; // localhost
                form.find('.field-jwks-url').val('https://any.jwks.url/keys');
                form.find('.verify-jwks-button').trigger('click');
                expect(form.find('.verification-result').html()).toContain('OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
            });

            it('should handle exception during AJAX call setup', function () {
                $.ajax.mockImplementation(() => { throw new Error('Setup exception'); });
                mockLocation.href = 'http://localhost/nifi/processors/12345-abcde/edit'; // localhost for simulated
                form.find('.field-jwks-url').val('https://any.jwks.url/keys');
                form.find('.verify-jwks-button').trigger('click');
                expect(form.find('.verification-result').html()).toContain('OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
                expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation:', expect.any(Error));
            });

            it('should use simulated response for 127.0.0.1 if AJAX fails', function () {
                $.ajax.mockReturnValue($.Deferred().reject(null, 'network error', 'Network Error').promise());
                mockLocation.href = 'http://127.0.0.1/nifi/processors/12345-abcde/edit'; // 127.0.0.1
                form.find('.field-jwks-url').val('https://any.jwks.url/keys');
                form.find('.verify-jwks-button').trigger('click');
                expect(form.find('.verification-result').html()).toContain('OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
                expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Using simulated response for standalone testing');
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

                apiClient.updateProcessorProperties.mockReturnValue($.Deferred().resolve().promise());
                form.find('.save-issuer-button').trigger('click');

                const expectedUpdates = {
                    'issuer.test-issuer.issuer': 'https://test.com/issuer',
                    'issuer.test-issuer.jwks-url': 'https://test.com/jwks.json',
                    'issuer.test-issuer.audience': 'aud1'
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

                apiClient.updateProcessorProperties.mockReturnValue($.Deferred().resolve().promise());
                form.find('.save-issuer-button').trigger('click');

                const expectedUpdates = {
                    'issuer.test-empty.issuer': 'https://test.empty.com/issuer',
                    'issuer.test-empty.jwks-url': 'https://test.empty.com/jwks.json'
                };
                expect(apiClient.updateProcessorProperties).toHaveBeenCalledWith('12345-abcde', expectedUpdates);
            });

            // Using processorId '12345-abcde'
            it('should show error on failed save and log to console', function () {
                form.find('.issuer-name').val('test-issuer');
                form.find('.field-issuer').val('https://test.com/issuer');
                form.find('.field-jwks-url').val('https://test.com/jwks.json');

                apiClient.updateProcessorProperties.mockReturnValue($.Deferred().reject(null, 'API Error', 'Save Failed').promise());
                form.find('.save-issuer-button').trigger('click');

                expect(apiClient.updateProcessorProperties).toHaveBeenCalled();
                expect(window.alert).toHaveBeenCalledWith('Error: Failed to save issuer configuration. See console for details.');
                expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] Error updating processor properties:', 'API Error', 'Save Failed');
            });

            // Using processorId '12345-abcde'
            it('should show error on exception during save and log to console', function () {
                form.find('.issuer-name').val('test-issuer');
                form.find('.field-issuer').val('https://test.com/issuer');
                form.find('.field-jwks-url').val('https://test.com/jwks.json');
                const exception = new Error('Save Exception');
                apiClient.updateProcessorProperties.mockImplementation(() => { throw exception; });

                form.find('.save-issuer-button').trigger('click');

                expect(window.alert).toHaveBeenCalledWith('Error: Failed to save issuer configuration due to an exception. See console for details.');
                expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] Exception in saveIssuer:', exception);
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
                expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Saving issuer in standalone mode:', form.find('.issuer-name').val(), {
                    issuer: 'https://standalone.com/issuer',
                    'jwks-url': 'https://standalone.com/jwks.json',
                    audience: '',
                    'client-id': ''
                });
                window.location = originalTestWindowLocation; // Restore
            });
        });

        describe('Remove Issuer functionality', function () {
            let form;
            const initialIssuerName = 'issuertoremove'; // Simplified name
            const initialProperties = {
                'issuer.issuertoremove.issuer': 'uri-remove',
                'issuer.issuertoremove.jwks-url': 'url-remove'
            };

            beforeEach(() => {
                mockElement.empty();
                mockLocation.href = 'http://localhost/nifi/processors/proc-id-remove/edit';
                currentTestUrl = mockLocation.href; // Ensure this is used for the init
                apiClient.getProcessorProperties.mockClear();
                apiClient.getProcessorProperties.mockReturnValue($.Deferred().resolve({ properties: {} }).promise());
                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);
                mockElement.find('.add-issuer-button').trigger('click');
                form = mockElement.find('.issuer-form').last();
                expect(form.length).toBe(1); // Ensure a blank form was added
                form.find('.issuer-name').val(initialIssuerName);
                form.find('.field-issuer').val('uri-remove');
                form.find('.field-jwks-url').val('url-remove');
            });

            it('should not remove if user cancels confirmation', function () {
                window.confirm.mockReturnValue(false);
                form.find('.remove-issuer-button').trigger('click');

                expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to remove this issuer configuration?');
                expect(mockElement.find(`.issuer-name[value="${initialIssuerName}"]`).length).toBe(1); // Form still there
                expect(apiClient.updateProcessorProperties).not.toHaveBeenCalled(); // updateProcessorProperties for removal not called
            });

            it('should remove form and call updateProcessorProperties on successful removal', function () {
                console.log('Starting test: should remove form and call updateProcessorProperties on successful removal');
                window.confirm.mockReturnValue(true);
                // let locationSpy; // No longer using jest.replaceProperty or manual spy for this
                // let hrefGetter;

                try {
                    mockElement.empty();

                    // Directly set window.location.href for this test.
                    // The original window.location object is restored in afterEach.
                    window.location.href = 'http://localhost/nifi/processors/proc-id-remove/edit';
                    currentTestUrl = window.location.href; // Update for this specific init

                    // Mock getProcessorProperties for the init call to avoid loading existing forms
                    apiClient.getProcessorProperties = jest.fn().mockReturnValue($.Deferred().resolve({ properties: {} }).promise());
                    issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                    // Setup form after init
                    mockElement.find('.add-issuer-button').trigger('click');
                    form = mockElement.find('.issuer-form').last();
                    form.find('.issuer-name').val(initialIssuerName);
                    form.find('.field-issuer').val('uri-remove');
                    form.find('.field-jwks-url').val('url-remove');

                    // Mock for getProcessorProperties called inside removeIssuer
                    const propsToRemove = {};
                    propsToRemove['issuer.' + initialIssuerName + '.issuer'] = 'uri-remove';
                    propsToRemove['issuer.' + initialIssuerName + '.jwks-url'] = 'url-remove';
                    apiClient.getProcessorProperties = jest.fn().mockReturnValue($.Deferred().resolve({ properties: propsToRemove }).promise());

                    // Mock for updateProcessorProperties called inside removeIssuer
                    apiClient.updateProcessorProperties = jest.fn().mockReturnValue($.Deferred().resolve().promise());

                    window.location.href = 'http://localhost/nifi/processors/proc-id-remove/edit'; // Explicitly set before trigger
                    form.find('.remove-issuer-button').trigger('click');

                    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to remove this issuer configuration?');
                    // Use a more specific selector to ensure the correct form is checked for removal
                    expect(mockElement.find(`.issuer-form .issuer-name[value="${initialIssuerName}"]`).closest('.issuer-form').length).toBe(0);
                    const expectedUpdates = {};
                    expectedUpdates['issuer.' + initialIssuerName + '.issuer'] = null;
                    expectedUpdates['issuer.' + initialIssuerName + '.jwks-url'] = null;

                    expect(apiClient.getProcessorProperties).toHaveBeenCalledWith('proc-id-remove');
                    expect(apiClient.updateProcessorProperties).toHaveBeenCalledWith('proc-id-remove', expectedUpdates);
                    expect(window.alert).toHaveBeenCalledWith('Success: Issuer configuration removed successfully.');
                } finally {
                    // window.location.href will be restored by the main afterEach
                }
            });

            it('should remove form and show error if getProcessorProperties fails during removal', function () {
                window.confirm.mockReturnValue(true);
                // let locationSpy; // Not needed

                try {
                    mockElement.empty();
                    window.location.href = 'http://localhost/nifi/processors/proc-id-remove/edit';
                    // apiClient.getProcessorProperties will be mocked for init by default from main beforeEach
                    // or needs to be set if specific behavior for init is needed before this test's logic.
                    // For this test, we assume init completes and we're focused on the 'remove' part.
                    // So, let init use its default getProcessorProperties mock (empty properties).
                    apiClient.getProcessorProperties = jest.fn().mockReturnValue($.Deferred().resolve({ properties: {} }).promise());
                    issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, window.location.href);

                    mockElement.find('.add-issuer-button').trigger('click');
                    form = mockElement.find('.issuer-form').last();
                    form.find('.issuer-name').val(initialIssuerName);
                    form.find('.field-issuer').val('uri-remove');
                    form.find('.field-jwks-url').val('url-remove');

                    // This mock is for the getProcessorProperties call inside removeIssuer
                    apiClient.getProcessorProperties = jest.fn().mockReturnValue($.Deferred().reject('API Get Error').promise());
                    apiClient.updateProcessorProperties = jest.fn(); // Not expected to be called

                    window.location.href = 'http://localhost/nifi/processors/proc-id-remove/edit'; // Explicitly set before trigger
                    form.find('.remove-issuer-button').trigger('click');

                    expect(mockElement.find(`.issuer-name[value="${initialIssuerName}"]`).length).toBe(0); // Form is removed
                    expect(window.alert).toHaveBeenCalledWith('Error: Failed to get processor properties. See console for details.');
                    expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] Error getting processor properties:', 'API Get Error', undefined);
                } finally {
                    // window.location.href restored by main afterEach
                }
            });

            it('should remove form and show error if updateProcessorProperties fails during removal', function () {
                window.confirm.mockReturnValue(true);
                // let locationSpy;

                try {
                    mockElement.empty();
                    window.location.href = 'http://localhost/nifi/processors/proc-id-remove/edit';
                    currentTestUrl = window.location.href; // Update for this specific init
                    apiClient.getProcessorProperties = jest.fn().mockReturnValue($.Deferred().resolve({ properties: {} }).promise()); // For init
                    issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                    mockElement.find('.add-issuer-button').trigger('click');
                    form = mockElement.find('.issuer-form').last();
                    form.find('.issuer-name').val(initialIssuerName);
                    form.find('.field-issuer').val('uri-remove');
                    form.find('.field-jwks-url').val('url-remove');

                    // Mock for getProcessorProperties inside removeIssuer
                    apiClient.getProcessorProperties = jest.fn().mockReturnValue($.Deferred().resolve({ properties: initialProperties }).promise());
                    // Mock for updateProcessorProperties inside removeIssuer
                    apiClient.updateProcessorProperties = jest.fn().mockReturnValue($.Deferred().reject('API Update Error').promise());

                    window.location.href = 'http://localhost/nifi/processors/proc-id-remove/edit'; // Explicitly set before trigger
                    form.find('.remove-issuer-button').trigger('click');

                    expect(mockElement.find(`.issuer-name[value="${initialIssuerName}"]`).length).toBe(0); // Form removed
                    expect(window.alert).toHaveBeenCalledWith('Error: Failed to remove issuer configuration. See console for details.');
                    expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] Error updating processor properties:', 'API Update Error', undefined);
                } finally {
                    // window.location.href restored by main afterEach
                }
            });

            it('should remove form and show error on exception during removal', function () {
                window.confirm.mockReturnValue(true);
                // let locationSpy;

                try {
                    mockElement.empty();
                    window.location.href = 'http://localhost/nifi/processors/proc-id-remove/edit';
                    currentTestUrl = window.location.href; // Update for this specific init
                    apiClient.getProcessorProperties = jest.fn().mockReturnValue($.Deferred().resolve({ properties: {} }).promise()); // For init
                    issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);

                    mockElement.find('.add-issuer-button').trigger('click');
                    form = mockElement.find('.issuer-form').last();
                    form.find('.issuer-name').val(initialIssuerName);
                    form.find('.field-issuer').val('uri-remove');
                    form.find('.field-jwks-url').val('url-remove');

                    const exception = new Error('Removal Exception');
                    // This mock is for getProcessorProperties inside removeIssuer
                    apiClient.getProcessorProperties = jest.fn().mockImplementation(() => { throw exception; });
                    apiClient.updateProcessorProperties = jest.fn(); // Not expected to be called

                    window.location.href = 'http://localhost/nifi/processors/proc-id-remove/edit'; // Explicitly set before trigger
                    form.find('.remove-issuer-button').trigger('click');

                    expect(mockElement.find(`.issuer-name[value="${initialIssuerName}"]`).length).toBe(0); // Form removed
                    expect(window.alert).toHaveBeenCalledWith('Error: Failed to remove issuer configuration due to an exception. See console for details.');
                    expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] Exception in removeIssuer:', exception);
                } finally {
                    // window.location.href restored by main afterEach
                }
            });

            it('should remove in standalone mode if no processorId', function () {
                // Re-initialize for standalone mode
                const originalTestWindowLocation = window.location;
                window.location = { href: 'http://localhost/nifi/' }; // No processorId
                currentTestUrl = window.location.href;
                mockElement.find('.issuers-container').empty(); // Clear previous forms
                // init will add a sample form because no processorId and no properties passed
                issuerConfigEditor.init(mockElement[0], mockConfig, null, mockCallback, currentTestUrl);
                form = mockElement.find('.issuer-form').first(); // This is the sample form
                expect(form.length).toBe(1);
                const sampleIssuerName = form.find('.issuer-name').val(); // Get the actual sample name

                window.confirm.mockReturnValue(true);
                form.find('.remove-issuer-button').trigger('click');

                expect(mockElement.find(`.issuer-name[value="${sampleIssuerName}"]`).length).toBe(0); // Form removed
                expect(apiClient.updateProcessorProperties).not.toHaveBeenCalled();
                expect(window.alert).toHaveBeenCalledWith('Success: Issuer configuration removed successfully (standalone mode).');
                expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Removing issuer in standalone mode:', sampleIssuerName);

                window.location = originalTestWindowLocation; // Restore
            });
        });
        // No TODO needed, init's catch block test was added above.
    });
});
