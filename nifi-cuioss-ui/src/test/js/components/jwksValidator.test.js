/**
 * Tests for the JWKS Validator component.
 */

const mockI18n = {
    'processor.jwt.testConnection': 'Test Connection',
    'processor.jwt.testing': 'Testing...',
    'processor.jwt.ok': 'OK',
    'processor.jwt.failed': 'Failed',
    'processor.jwt.validJwks': 'Valid JWKS',
    'processor.jwt.invalidJwks': 'Invalid JWKS',
    'processor.jwt.keysFound': 'keys found',
    'processor.jwt.validationError': 'Validation error'
};

jest.useFakeTimers();

describe('jwksValidator - Common Initialization and Callback', () => {
    let jwksValidator;
    let $;
    let nfCommon;
    let $element;
    let callback;
    const initialPropertyValue = 'https://example.com/.well-known/jwks.json';
    let consoleErrorSpy;
    let consoleLogSpy;

    beforeEach(() => {
        jest.resetModules();
        jwksValidator = require('components/jwksValidator');
        $ = require('jquery');
        nfCommon = require('nf.Common');

        const rawElement = document.createElement('div');
        document.body.appendChild(rawElement);
        $element = $(rawElement);

        callback = jest.fn();
        $.ajax = jest.fn();

        nfCommon.getI18n = jest.fn().mockReturnValue(mockI18n);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        $element.remove();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        // Reset any localhost override after common tests if any test accidentally sets it
        if (jwksValidator && typeof jwksValidator.__setIsLocalhostForTesting === 'function') {
            jwksValidator.__setIsLocalhostForTesting(null);
        }
    });

    describe('Initialization', () => {
        it('should create button and result container if jwks_type is "server" and input field is present', () => {
            $element.append('<input type="text">');
            jwksValidator.init($element[0], initialPropertyValue, 'server', callback);
            expect($element.find('.verify-jwks-button').length).toBe(1);
            expect($element.find('.verify-jwks-button').text()).toBe('Test Connection');
            expect($element.find('.verification-result').length).toBe(1);
            expect($element.find('.verification-result').html()).toBe('<em>Click the button to validate JWKS</em>');
            expect($element.find('input').next().hasClass('jwks-button-wrapper')).toBe(true);
            expect(callback).toHaveBeenCalled();
        });

        it('should create button and result container in main container if input field is NOT present and type is "server"', () => {
            jwksValidator.init($element[0], initialPropertyValue, 'server', callback);
            const verificationContainer = $element.find('.jwks-verification-container');
            expect(verificationContainer.length).toBe(1);
            expect(verificationContainer.find('.verify-jwks-button').length).toBe(1);
            expect(verificationContainer.find('.verification-result').length).toBe(1);
            expect(callback).toHaveBeenCalled();
        });

        it('should NOT create button if jwks_type is "file"', () => {
            jwksValidator.init($element[0], '/path/to/file.jwks', 'file', callback);
            expect($element.find('.verify-jwks-button').length).toBe(0);
            expect(callback).toHaveBeenCalled();
        });

        it('should NOT create button if jwks_type is "memory"', () => {
            jwksValidator.init($element[0], '{"keys":[]}', 'memory', callback);
            expect($element.find('.verify-jwks-button').length).toBe(0);
            expect(callback).toHaveBeenCalled();
        });

        it('should call i18n during init', () => {
            jwksValidator.init($element[0], initialPropertyValue, 'server', callback);
            expect(nfCommon.getI18n).toHaveBeenCalled();
        });

        it('should use empty object for i18n if nfCommon.getI18n returns null', () => {
            nfCommon.getI18n = jest.fn().mockReturnValue(null); // i18n will be {}
            $element.append('<input type="text">');
            jwksValidator.init($element[0], initialPropertyValue, 'server', callback);

            // Check button text (concatenation with undefined)
            expect($element.find('.verify-jwks-button').text()).toBe('undefined');
            expect(callback).toHaveBeenCalled();

            // Click the button to trigger messages that use the || 'Fallback' pattern
            const deferredDone = $.Deferred();
            $.ajax.mockReturnValueOnce(deferredDone.promise()); // For .done() path
            $element.find('.verify-jwks-button').trigger('click');

            // Check "Testing..." message fallback
            expect($element.find('.verification-result').html()).toBe('Testing...');

            // Test .done() path with fallbacks
            deferredDone.resolve({ valid: true, keyCount: 1 });
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--success-color); font-weight: bold;">OK</span> Valid JWKS (1 keys found)');

            // Reset for .fail() path (non-localhost)
            if (jwksValidator && typeof jwksValidator.__setIsLocalhostForTesting === 'function') {
                jwksValidator.__setIsLocalhostForTesting(false); // Explicitly set non-localhost for this part
            }
            // Case 1: xhr.responseText is present
            let deferredFail = $.Deferred();
            $.ajax.mockReturnValueOnce(deferredFail.promise());
            $element.find('.verify-jwks-button').trigger('click');
            deferredFail.reject({ responseText: 'Error from XHR' }, 'error', 'Condition1');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Error from XHR');

            // Case 2: xhr.responseText is null, error argument is present
            deferredFail = $.Deferred();
            $.ajax.mockReturnValueOnce(deferredFail.promise());
            $element.find('.verify-jwks-button').trigger('click');
            // Expect "Testing..." again
            expect($element.find('.verification-result').html()).toBe('Testing...');
            deferredFail.reject({ responseText: null }, 'error', 'Error From Arg');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Error From Arg');

            // Case 3: xhr.responseText is null, error argument is null
            deferredFail = $.Deferred();
            $.ajax.mockReturnValueOnce(deferredFail.promise());
            $element.find('.verify-jwks-button').trigger('click');
            // Expect "Testing..." again
            expect($element.find('.verification-result').html()).toBe('Testing...');
            deferredFail.reject({ responseText: null }, 'error', null);
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Unknown error');

            // Test .fail() path with localhost and fallbacks
            if (jwksValidator && typeof jwksValidator.__setIsLocalhostForTesting === 'function') {
                jwksValidator.__setIsLocalhostForTesting(true);
            }
            const deferredFailLocal = $.Deferred();
            $.ajax.mockReturnValueOnce(deferredFailLocal.promise()); // For .fail() localhost path
            $element.find('.verify-jwks-button').trigger('click');
            deferredFailLocal.reject({ responseText: 'Error from XHR local' }, 'error', 'Condition local');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--success-color); font-weight: bold;">OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
            if (jwksValidator && typeof jwksValidator.__setIsLocalhostForTesting === 'function') {
                jwksValidator.__setIsLocalhostForTesting(null); // reset
            }

            // Test catch block path with fallbacks (non-localhost)
            if (jwksValidator && typeof jwksValidator.__setIsLocalhostForTesting === 'function') {
                jwksValidator.__setIsLocalhostForTesting(false); // Explicitly set non-localhost for this part
            }
            // Case 1: error has a message
            $.ajax.mockImplementationOnce(() => { throw new Error('Catch this'); });
            $element.find('.verify-jwks-button').trigger('click');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Catch this');

            // Case 2: error has no message (e.g., e.message is null or undefined)
            const errorWithoutMessage = new Error();
            errorWithoutMessage.message = null;
            $.ajax.mockImplementationOnce(() => { throw errorWithoutMessage; });
            $element.find('.verify-jwks-button').trigger('click');
            // jest.runAllTimers(); // Not strictly necessary here as throw is synchronous
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Exception occurred');

            // Restore isLocalhostOverride to null to not affect other tests in this block
            if (jwksValidator && typeof jwksValidator.__setIsLocalhostForTesting === 'function') {
                jwksValidator.__setIsLocalhostForTesting(null);
            }
        });

        it('should initialize correctly if callback is not a function', () => {
            $element.append('<input type="text">');
            jwksValidator.init($element[0], initialPropertyValue, 'server', undefined);
            expect($element.find('.verify-jwks-button').length).toBe(1);
            expect(callback).not.toHaveBeenCalled();
        });

        it('getValue should handle null or undefined propertyValue initially from callback object', () => {
            jwksValidator.init($element[0], null, 'server', callback);
            let cbObject = callback.mock.calls[0][0];
            expect(cbObject.getValue()).toBeNull();
            callback.mockClear();
            jwksValidator.init($element[0], undefined, 'server', callback);
            cbObject = callback.mock.calls[0][0];
            expect(cbObject.getValue()).toBeUndefined();
        });

        it('should use default URL in AJAX call if propertyValue is null at button click (and cover default getIsLocalhost)', () => {
            // This test ensures that when isLocalhostOverride is null, the actual window.location is checked.
            // Since __setIsLocalhostForTesting(null) is called in afterEach of other blocks,
            // here it will be null by default if not set otherwise in a beforeEach.
            // We also test the propertyValue fallback here.
            jwksValidator.init($element[0], null, 'server', callback); // Initialize with null
            const deferred = $.Deferred();
            $.ajax.mockReturnValue(deferred.promise());
            $element.find('.verify-jwks-button').trigger('click');
            expect($.ajax).toHaveBeenCalledWith(expect.objectContaining({
                data: JSON.stringify({ jwksValue: 'https://example.com/.well-known/jwks.json' }),
            }));
        });

        it('should use default URL in AJAX call if propertyValue is undefined at button click', () => {
            jwksValidator.init($element[0], undefined, 'server', callback); // Initialize with undefined
            const deferred = $.Deferred();
            $.ajax.mockReturnValue(deferred.promise());
            $element.find('.verify-jwks-button').trigger('click');
            expect($.ajax).toHaveBeenCalledWith(expect.objectContaining({
                data: JSON.stringify({ jwksValue: 'https://example.com/.well-known/jwks.json' }),
            }));
        });

        it('should trigger AJAX call and use actual window.location when isLocalhostOverride is null', () => {
            // This test is specifically to ensure the branch where isLocalhostOverride === null is covered
            // within getIsLocalhost(), meaning window.location.href is accessed.
            // JSDOM's default window.location.href is 'http://localhost/', so it will behave as localhost.
            jwksValidator.init($element[0], 'http://some-url.com', 'server', callback);
            const deferred = $.Deferred();
            $.ajax.mockReturnValue(deferred.promise());

            // Ensure isLocalhostOverride is null (default state for this describe block)
            // No need to call __setIsLocalhostForTesting if it hasn't been set yet in this block.
            // Forcing it to null here to be absolutely sure, though afterEach should handle it.
            if (jwksValidator && typeof jwksValidator.__setIsLocalhostForTesting === 'function') {
                 jwksValidator.__setIsLocalhostForTesting(null);
            }


            $element.find('.verify-jwks-button').trigger('click');
            // AJAX fails, and since window.location.href is 'http://localhost/' by default in JSDOM,
            // it should take the simulated success path.
            deferred.reject({ responseText: 'some error' }, 'error', 'Error Condition');
            jest.runAllTimers();

            expect($.ajax).toHaveBeenCalled();
            expect($element.find('.verification-result').html()).toContain('<em>(Simulated response)</em>');
            // Verify that the console log for simulated response was called,
            // which indicates getIsLocalhost() returned true.
            expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG_LOG] Using simulated response for standalone testing');
        });
    });

    describe('Callback Object', () => {
        beforeEach(() => {
            jwksValidator.init($element[0], initialPropertyValue, 'server', callback);
        });

        it('should provide validate, getValue, setValue, and jwks_type via callback', () => {
            expect(callback).toHaveBeenCalledWith(expect.objectContaining({
                validate: expect.any(Function),
                getValue: expect.any(Function),
                setValue: expect.any(Function),
                jwks_type: 'server'
            }));
        });
        it('getValue should return initial propertyValue', () => {
            const callbackArg = callback.mock.calls[0][0];
            expect(callbackArg.getValue()).toBe(initialPropertyValue);
        });

        it('setValue should update value returned by getValue', () => {
            const callbackArg = callback.mock.calls[0][0];
            callbackArg.setValue('new-value');
            expect(callbackArg.getValue()).toBe('new-value');
        });

        it('validate should always return true', () => {
            const callbackArg = callback.mock.calls[0][0];
            expect(callbackArg.validate()).toBe(true);
        });
    });
});

describe('jwksValidator (non-localhost)', () => {
    let jwksValidator;
    let $;
    let nfCommon;
    let $element;
    let callback;
    const initialPropertyValue = 'https://example.com/.well-known/jwks.json';
    let consoleErrorSpy;
    let consoleLogSpy;

    beforeEach(() => {
        jest.resetModules();
        jwksValidator = require('components/jwksValidator');
        $ = require('jquery');
        nfCommon = require('nf.Common');

        jwksValidator.__setIsLocalhostForTesting(false);

        const rawElement = document.createElement('div');
        document.body.appendChild(rawElement);
        $element = $(rawElement);
        callback = jest.fn();
        $.ajax = jest.fn();

        nfCommon.getI18n = jest.fn().mockReturnValue(mockI18n);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        $element.append('<input type="text">');
        jwksValidator.init($element[0], initialPropertyValue, 'server', callback);
    });

    afterEach(() => {
        jwksValidator.__setIsLocalhostForTesting(null);
        $element.remove();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    describe('Button Click Handler (jwks_type="server")', () => {
        it('should set "Testing..." message and call $.ajax', () => {
            const testValue = 'https://my.custom.url/jwks';
            callback.mock.calls[0][0].setValue(testValue);
            const deferred = $.Deferred();
            $.ajax.mockReturnValue(deferred.promise());
            consoleLogSpy.mockClear(); // Clear any logs from init()
            $element.find('.verify-jwks-button').trigger('click');
            expect($element.find('.verification-result').html()).toBe(mockI18n['processor.jwt.testing']);
            expect($.ajax).toHaveBeenCalledWith(expect.objectContaining({
                data: JSON.stringify({ jwksValue: testValue }),
            }));
        });

        it('should show error from xhr.responseText (non-localhost)', () => {
            const deferred = $.Deferred();
            $.ajax.mockReturnValue(deferred.promise());
            consoleLogSpy.mockClear(); // Clear any logs from init()
            $element.find('.verify-jwks-button').trigger('click');
            deferred.reject({ responseText: 'XHR error text' }, 'error', 'Error Condition');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: XHR error text');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] JWKS validation error:', 'error', 'Error Condition');
            expect(consoleLogSpy).not.toHaveBeenCalled(); // No simulated success log
        });

        it('should show error from errorThrown if no xhr.responseText (non-localhost)', () => {
            const deferred = $.Deferred();
            $.ajax.mockReturnValue(deferred.promise());
            $element.find('.verify-jwks-button').trigger('click');
            deferred.reject({ responseText: null }, 'error', 'Thrown Error From Arg');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Thrown Error From Arg');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] JWKS validation error:', 'error', 'Thrown Error From Arg');
        });

        it('should show "Unknown error" if no responseText or errorThrown (non-localhost)', () => {
            const deferred = $.Deferred();
            $.ajax.mockReturnValue(deferred.promise());
            $element.find('.verify-jwks-button').trigger('click');
            deferred.reject({ responseText: null }, 'error', null); // error argument is null
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Unknown error');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] JWKS validation error:', 'error', null);
        });

        it('should show non-localhost exception message', () => {
            const exception = new Error('AJAX Setup Exception for non-localhost');
            $.ajax.mockImplementation(() => { throw exception; });
            consoleLogSpy.mockClear(); // Clear any logs from init()
            $element.find('.verify-jwks-button').trigger('click');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: ' + exception.message);
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation:', exception);
            expect(consoleLogSpy).not.toHaveBeenCalled(); // No simulated success log
        });

        it('should show non-localhost exception message with fallback if e.message is null', () => {
            const exception = new Error(); // Error without a message
            exception.message = null;
            $.ajax.mockImplementation(() => { throw exception; });
            consoleLogSpy.mockClear();
            $element.find('.verify-jwks-button').trigger('click');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Exception occurred');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation:', exception);
        });
    });
});

describe('jwksValidator (localhost)', () => {
    let jwksValidator;
    let $;
    let nfCommon;
    let $element;
    let callback;
    const initialPropertyValue = 'https://example.com/.well-known/jwks.json';
    let consoleErrorSpy;
    let consoleLogSpy;

    beforeEach(() => {
        jest.resetModules();
        jwksValidator = require('components/jwksValidator');
        $ = require('jquery');
        nfCommon = require('nf.Common');

        jwksValidator.__setIsLocalhostForTesting(true);

        const rawElement = document.createElement('div');
        document.body.appendChild(rawElement);
        $element = $(rawElement);
        callback = jest.fn();
        $.ajax = jest.fn();

        nfCommon.getI18n = jest.fn().mockReturnValue(mockI18n);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        $element.append('<input type="text">');
        jwksValidator.init($element[0], initialPropertyValue, 'server', callback);
    });

    afterEach(() => {
        jwksValidator.__setIsLocalhostForTesting(null);
        $element.remove();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    describe('Button Click Handler (jwks_type="server")', () => {
        it('should show success message on valid AJAX response', () => {
            const deferred = $.Deferred();
            $.ajax.mockReturnValue(deferred.promise());
            $element.find('.verify-jwks-button').trigger('click');
            deferred.resolve({ valid: true, keyCount: 5 });
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toContain('OK</span> Valid JWKS (5 keys found)');
        });

        it('should show failure message on invalid AJAX response', () => {
            const deferred = $.Deferred();
            $.ajax.mockReturnValue(deferred.promise());
            $element.find('.verify-jwks-button').trigger('click');
            deferred.resolve({ valid: false, message: 'Test error message' });
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toContain('Failed</span> Invalid JWKS: Test error message');
        });

        it('should show simulated success on AJAX fail (localhost)', () => {
            const deferred = $.Deferred();
            $.ajax.mockReturnValue(deferred.promise());
            $element.find('.verify-jwks-button').trigger('click');
            deferred.reject({ responseText: 'some error' }, 'error', 'Error Condition'); // xhr, status, error
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toContain('OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] JWKS validation error:', 'error', 'Error Condition');
            expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG_LOG] Using simulated response for standalone testing');
        });

        it('should show simulated success on exception during AJAX setup (localhost)', () => {
            const exception = new Error('AJAX Setup Exception for localhost');
            $.ajax.mockImplementation(() => { throw exception; });
            consoleLogSpy.mockClear(); // Clear any logs from init()
            $element.find('.verify-jwks-button').trigger('click');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--success-color); font-weight: bold;">OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation:', exception);
            expect(consoleLogSpy).not.toHaveBeenCalled(); // In localhost, catch logs to error, then shows simulated success, so no specific log for "simulated" here
        });

        it('should show simulated success on exception during AJAX setup (localhost) if e.message is null', () => {
            const exception = new Error();
            exception.message = null; // Simulate an error object with no message property
            $.ajax.mockImplementation(() => { throw exception; });
            consoleLogSpy.mockClear();
            $element.find('.verify-jwks-button').trigger('click');
            jest.runAllTimers();
            // Even with null message, localhost simulation should proceed
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--success-color); font-weight: bold;">OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation:', exception);
        });
    });
});

afterAll(() => {
    jest.useRealTimers();
});
