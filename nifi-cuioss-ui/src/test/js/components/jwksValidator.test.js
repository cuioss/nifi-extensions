/**
 * Tests for the JWKS Validator component.
 */
import $ from 'jquery'; // This top-level $ is fine for general jQuery functions if not re-mocked per test.
// For consistency and clarity, especially with $.ajax mocks, tests will use local$ from beforeEach.

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
    let localJwksValidator;
    let local$;
    let localNfCommon;
    let $element;
    let callback;
    const initialPropertyValue = 'https://example.com/.well-known/jwks.json';
    let consoleErrorSpy;
    let consoleLogSpy;

    beforeEach(() => {
        jest.resetModules();
        localJwksValidator = require('components/jwksValidator');
        local$ = require('jquery');
        localNfCommon = require('nf.Common');

        const rawElement = document.createElement('div');
        document.body.appendChild(rawElement);
        $element = local$(rawElement);

        callback = jest.fn();
        local$.ajax = jest.fn();

        localNfCommon.getI18n = jest.fn().mockReturnValue(mockI18n);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        $element.remove();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
            localJwksValidator.__setIsLocalhostForTesting(null);
        }
    });

    describe('Initialization', () => {
        it('should create button and result container if jwks_type is "server" and input field is present', () => {
            $element.append('<input type="text">');
            localJwksValidator.init($element[0], initialPropertyValue, 'server', callback);
            expect($element.find('.verify-jwks-button').length).toBe(1);
            expect($element.find('.verify-jwks-button').text()).toBe(mockI18n['processor.jwt.testConnection']);
            expect($element.find('.verification-result').length).toBe(1);
            expect($element.find('.verification-result').html()).toBe('<em>Click the button to validate JWKS</em>');
            expect($element.find('input').next().hasClass('jwks-button-wrapper')).toBe(true);
            expect(callback).toHaveBeenCalled();
        });

        it('should create button and result container in main container if input field is NOT present and type is "server"', () => {
            localJwksValidator.init($element[0], initialPropertyValue, 'server', callback);
            const verificationContainer = $element.find('.jwks-verification-container');
            expect(verificationContainer.length).toBe(1);
            expect(verificationContainer.find('.verify-jwks-button').length).toBe(1);
            expect(verificationContainer.find('.verification-result').length).toBe(1);
            expect(callback).toHaveBeenCalled();
        });

        it('should NOT create button if jwks_type is "file"', () => {
            localJwksValidator.init($element[0], '/path/to/file.jwks', 'file', callback);
            expect($element.find('.verify-jwks-button').length).toBe(0);
            expect(callback).toHaveBeenCalled();
        });

        it('should NOT create button if jwks_type is "memory"', () => {
            localJwksValidator.init($element[0], '{"keys":[]}', 'memory', callback);
            expect($element.find('.verify-jwks-button').length).toBe(0);
            expect(callback).toHaveBeenCalled();
        });

        it('should call i18n during init', () => {
            localJwksValidator.init($element[0], initialPropertyValue, 'server', callback);
            expect(localNfCommon.getI18n).toHaveBeenCalled();
        });

        it('should use empty object for i18n if nfCommon.getI18n returns null', () => {
            localNfCommon.getI18n = jest.fn().mockReturnValue(null);
            $element.append('<input type="text">');
            localJwksValidator.init($element[0], initialPropertyValue, 'server', callback);

            expect($element.find('.verify-jwks-button').text()).toBe('undefined');
            expect(callback).toHaveBeenCalled();

            const deferredDone = local$.Deferred();
            local$.ajax.mockReturnValueOnce(deferredDone.promise());
            $element.find('.verify-jwks-button').trigger('click');
            expect($element.find('.verification-result').html()).toBe('Testing...');
            deferredDone.resolve({ valid: true, keyCount: 1 });
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--success-color); font-weight: bold;">OK</span> Valid JWKS (1 keys found)');

            if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
                localJwksValidator.__setIsLocalhostForTesting(false);
            }
            let deferredFail = local$.Deferred();
            local$.ajax.mockReturnValueOnce(deferredFail.promise());
            $element.find('.verify-jwks-button').trigger('click');
            deferredFail.reject({ responseText: 'Error from XHR' }, 'error', 'Condition1');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Error from XHR');

            deferredFail = local$.Deferred();
            local$.ajax.mockReturnValueOnce(deferredFail.promise());
            $element.find('.verify-jwks-button').trigger('click');
            expect($element.find('.verification-result').html()).toBe('Testing...');
            deferredFail.reject({ responseText: null }, 'error', 'Error From Arg');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Error From Arg');

            deferredFail = local$.Deferred();
            local$.ajax.mockReturnValueOnce(deferredFail.promise());
            $element.find('.verify-jwks-button').trigger('click');
            expect($element.find('.verification-result').html()).toBe('Testing...');
            deferredFail.reject({ responseText: null }, 'error', null);
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Unknown error');

            if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
                localJwksValidator.__setIsLocalhostForTesting(true);
            }
            const deferredFailLocal = local$.Deferred();
            local$.ajax.mockReturnValueOnce(deferredFailLocal.promise());
            $element.find('.verify-jwks-button').trigger('click');
            deferredFailLocal.reject({ responseText: 'Error from XHR local' }, 'error', 'Condition local');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--success-color); font-weight: bold;">OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');

            if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
                localJwksValidator.__setIsLocalhostForTesting(false);
            }
            local$.ajax.mockImplementationOnce(() => { throw new Error('Catch this'); });
            $element.find('.verify-jwks-button').trigger('click');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Catch this');

            const errorWithoutMessage = new Error();
            errorWithoutMessage.message = null;
            local$.ajax.mockImplementationOnce(() => { throw errorWithoutMessage; });
            $element.find('.verify-jwks-button').trigger('click');
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Exception occurred');

            if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
                localJwksValidator.__setIsLocalhostForTesting(null);
            }
        });

        it('should initialize correctly if callback is not a function', () => {
            $element.append('<input type="text">');
            localJwksValidator.init($element[0], initialPropertyValue, 'server', undefined);
            expect($element.find('.verify-jwks-button').length).toBe(1);
            expect(callback).not.toHaveBeenCalled();
        });

        it('getValue should handle null or undefined propertyValue initially from callback object', () => {
            localJwksValidator.init($element[0], null, 'server', callback);
            let cbObject = callback.mock.calls[0][0];
            expect(cbObject.getValue()).toBeNull();
            callback.mockClear();
            localJwksValidator.init($element[0], undefined, 'server', callback);
            cbObject = callback.mock.calls[0][0];
            expect(cbObject.getValue()).toBeUndefined();
        });

        it('should use default URL in AJAX call if propertyValue is null at button click (and cover default getIsLocalhost)', () => {
            localJwksValidator.init($element[0], null, 'server', callback);
            const deferredNull = local$.Deferred();
            local$.ajax.mockReturnValue(deferredNull.promise());
            $element.find('.verify-jwks-button').trigger('click');
            expect(local$.ajax).toHaveBeenCalledWith(expect.objectContaining({
                data: JSON.stringify({ jwksValue: 'https://example.com/.well-known/jwks.json' })
            }));
        });

        it('should use default URL in AJAX call if propertyValue is undefined at button click', () => {
            localJwksValidator.init($element[0], undefined, 'server', callback);
            const deferredUndefined = local$.Deferred();
            local$.ajax.mockReturnValue(deferredUndefined.promise());
            $element.find('.verify-jwks-button').trigger('click');
            expect(local$.ajax).toHaveBeenCalledWith(expect.objectContaining({
                data: JSON.stringify({ jwksValue: 'https://example.com/.well-known/jwks.json' })
            }));
        });

        it('should trigger AJAX call and use actual window.location when isLocalhostOverride is null', () => {
            localJwksValidator.init($element[0], 'http://some-url.com', 'server', callback);
            const deferredLocation = local$.Deferred();
            local$.ajax.mockReturnValue(deferredLocation.promise());

            if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
                localJwksValidator.__setIsLocalhostForTesting(null);
            }
            $element.find('.verify-jwks-button').trigger('click');
            deferredLocation.reject({ responseText: 'some error' }, 'error', 'Error Condition');
            jest.runAllTimers();

            expect(local$.ajax).toHaveBeenCalled();
            expect($element.find('.verification-result').html()).toContain('<em>(Simulated response)</em>');
            expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG_LOG] Using simulated response for standalone testing');
        });
    });

    describe('Callback Object', () => {
        beforeEach(() => {
            localJwksValidator.init($element[0], initialPropertyValue, 'server', callback);
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
    let localJwksValidator;
    let local$;
    let localNfCommon;
    let $element;
    let callback;
    const initialPropertyValue = 'https://example.com/.well-known/jwks.json';
    let consoleErrorSpy;
    let consoleLogSpy;

    beforeEach(() => {
        jest.resetModules();
        localJwksValidator = require('components/jwksValidator');
        local$ = require('jquery');
        localNfCommon = require('nf.Common');

        localJwksValidator.__setIsLocalhostForTesting(false);

        const rawElement = document.createElement('div');
        document.body.appendChild(rawElement);
        $element = local$(rawElement);
        callback = jest.fn();
        local$.ajax = jest.fn();

        localNfCommon.getI18n = jest.fn().mockReturnValue(mockI18n);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        $element.append('<input type="text">');
        localJwksValidator.init($element[0], initialPropertyValue, 'server', callback);
    });

    afterEach(() => {
        localJwksValidator.__setIsLocalhostForTesting(null);
        $element.remove();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    describe('Button Click Handler (jwks_type="server")', () => {
        it('should set "Testing..." message and call $.ajax', () => {
            const testValue = 'https://my.custom.url/jwks';
            callback.mock.calls[0][0].setValue(testValue);
            const deferred = local$.Deferred();
            local$.ajax.mockReturnValue(deferred.promise());
            consoleLogSpy.mockClear();
            $element.find('.verify-jwks-button').trigger('click');
            expect($element.find('.verification-result').html()).toBe(mockI18n['processor.jwt.testing']);
            expect(local$.ajax).toHaveBeenCalledWith(expect.objectContaining({
                data: JSON.stringify({ jwksValue: testValue })
            }));
        });

        it('should show error from xhr.responseText (non-localhost)', () => {
            const deferred = local$.Deferred();
            local$.ajax.mockReturnValue(deferred.promise());
            consoleLogSpy.mockClear();
            $element.find('.verify-jwks-button').trigger('click');
            deferred.reject({ responseText: 'XHR error text' }, 'error', 'Error Condition');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: XHR error text');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] JWKS validation error:', 'error', 'Error Condition');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should show error from errorThrown if no xhr.responseText (non-localhost)', () => {
            const deferred = local$.Deferred();
            local$.ajax.mockReturnValue(deferred.promise());
            $element.find('.verify-jwks-button').trigger('click');
            deferred.reject({ responseText: null }, 'error', 'Thrown Error From Arg');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Thrown Error From Arg');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] JWKS validation error:', 'error', 'Thrown Error From Arg');
        });

        it('should show "Unknown error" if no responseText or errorThrown (non-localhost)', () => {
            const deferred = local$.Deferred();
            local$.ajax.mockReturnValue(deferred.promise());
            $element.find('.verify-jwks-button').trigger('click');
            deferred.reject({ responseText: null }, 'error', null);
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Unknown error');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] JWKS validation error:', 'error', null);
        });

        it('should show non-localhost exception message', () => {
            const exception = new Error('AJAX Setup Exception for non-localhost');
            local$.ajax.mockImplementation(() => { throw exception; });
            consoleLogSpy.mockClear();
            $element.find('.verify-jwks-button').trigger('click');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: ' + exception.message);
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation:', exception);
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should show non-localhost exception message with fallback if e.message is null', () => {
            const exception = new Error();
            exception.message = null;
            local$.ajax.mockImplementation(() => { throw exception; });
            consoleLogSpy.mockClear();
            $element.find('.verify-jwks-button').trigger('click');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Exception occurred');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation:', exception);
        });
    });
});

describe('jwksValidator (localhost)', () => {
    let localJwksValidator;
    let local$;
    let localNfCommon;
    let $element;
    let callback;
    const initialPropertyValue = 'https://example.com/.well-known/jwks.json';
    let consoleErrorSpy;
    let consoleLogSpy;

    beforeEach(() => {
        jest.resetModules();
        localJwksValidator = require('components/jwksValidator');
        local$ = require('jquery');
        localNfCommon = require('nf.Common');

        localJwksValidator.__setIsLocalhostForTesting(true);

        const rawElement = document.createElement('div');
        document.body.appendChild(rawElement);
        $element = local$(rawElement);
        callback = jest.fn();
        local$.ajax = jest.fn();

        localNfCommon.getI18n = jest.fn().mockReturnValue(mockI18n);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        $element.append('<input type="text">');
        localJwksValidator.init($element[0], initialPropertyValue, 'server', callback);
    });

    afterEach(() => {
        localJwksValidator.__setIsLocalhostForTesting(null);
        $element.remove();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    describe('Button Click Handler (jwks_type="server")', () => {
        it('should show success message on valid AJAX response', () => {
            const deferred = local$.Deferred();
            local$.ajax.mockReturnValue(deferred.promise());
            $element.find('.verify-jwks-button').trigger('click');
            deferred.resolve({ valid: true, keyCount: 5 });
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toContain('OK</span> Valid JWKS (5 keys found)');
        });

        it('should show failure message on invalid AJAX response', () => {
            const deferred = local$.Deferred();
            local$.ajax.mockReturnValue(deferred.promise());
            $element.find('.verify-jwks-button').trigger('click');
            deferred.resolve({ valid: false, message: 'Test error message' });
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toContain('Failed</span> Invalid JWKS: Test error message');
        });

        it('should show simulated success on AJAX fail (localhost)', () => {
            const deferred = local$.Deferred();
            local$.ajax.mockReturnValue(deferred.promise());
            $element.find('.verify-jwks-button').trigger('click');
            deferred.reject({ responseText: 'some error' }, 'error', 'Error Condition');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toContain('OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] JWKS validation error:', 'error', 'Error Condition');
            expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG_LOG] Using simulated response for standalone testing');
        });

        it('should show simulated success on exception during AJAX setup (localhost)', () => {
            const exception = new Error('AJAX Setup Exception for localhost');
            local$.ajax.mockImplementation(() => { throw exception; });
            consoleLogSpy.mockClear();
            $element.find('.verify-jwks-button').trigger('click');
            jest.runAllTimers();
            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--success-color); font-weight: bold;">OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation:', exception);
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should show simulated success on exception during AJAX setup (localhost) if e.message is null', () => {
            const exception = new Error();
            exception.message = null;
            local$.ajax.mockImplementation(() => { throw exception; });
            consoleLogSpy.mockClear();
            $element.find('.verify-jwks-button').trigger('click');
            jest.runAllTimers();

            expect($element.find('.verification-result').html()).toBe('<span style="color: var(--success-color); font-weight: bold;">OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation:', exception);
        });
    });
});

afterAll(() => {
    jest.useRealTimers();
});
