/**
 * Tests for the JWKS Validator component.
 */
// import $ from '../../../main/webapp/js/utils/jquery-compat.js'; // Not used by test logic

const mockI18n = {
    'processor.jwt.testConnection': 'Test Connection',
    'processor.jwt.testing': 'Testing...',
    'processor.jwt.ok': 'OK',
    'processor.jwt.failed': 'Failed',
    'processor.jwt.validJwks': 'Valid JWKS',
    'processor.jwt.invalidJwks': 'Invalid JWKS',
    'processor.jwt.keysFound': 'keys found',
    'processor.jwt.validationError': 'Validation error',
    'processor.jwt.initialInstructions': 'Click the button to validate JWKS' // Added for completeness
};

jest.useFakeTimers();

// Mock compatAjax BEFORE any describe blocks
const mockCompatAjax = jest.fn();
jest.mock('../../../main/webapp/js/utils/ajax.js', () => ({
    compatAjax: mockCompatAjax
}));

describe('jwksValidator - Common Initialization and Callback', () => {
    let localJwksValidator;
    let localNfCommon;
    let getI18nSpy;
    let parentElement;
    let callback;
    const initialPropertyValue = 'https://example.com/.well-known/jwks.json';
    let consoleErrorSpy;
    let consoleLogSpy;
    let currentDeferred; // For mock AJAX control

    beforeEach(() => {
        jest.resetModules();
        localJwksValidator = require('components/jwksValidator');
        localNfCommon = require('nf.Common');
        mockCompatAjax.mockClear();

        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
        callback = jest.fn();

        mockCompatAjax.mockImplementation(() => {
            currentDeferred = {
                _doneCallback: null,
                _failCallback: null,
                done: function(cb) { this._doneCallback = cb; return this; },
                fail: function(cb) { this._failCallback = cb; return this; },
                resolve: function(data) { if (this._doneCallback) { Promise.resolve(data).then(this._doneCallback); } },
                reject: function(xhr, status, error) { if (this._failCallback) { Promise.resolve().then(() => this._failCallback(xhr, status, error)); } }
            };
            return currentDeferred;
        });

        getI18nSpy = jest.spyOn(localNfCommon, 'getI18n').mockReturnValue(mockI18n);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
            localJwksValidator.__setIsLocalhostForTesting(null);
        }
    });

    afterEach(() => {
        if (parentElement.parentNode === document.body) {
            document.body.removeChild(parentElement);
        }
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        if (getI18nSpy) getI18nSpy.mockRestore();
        if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
            localJwksValidator.__setIsLocalhostForTesting(null);
        }
    });

    describe('Initialization', () => {
        it('should create button and result container if jwks_type is "server" and input field is present', () => {
            parentElement.innerHTML = '<input type="text">';
            localJwksValidator.init(parentElement, initialPropertyValue, 'server', callback);
            const button = parentElement.querySelector('.verify-jwks-button');
            const resultContainer = parentElement.querySelector('.verification-result');
            const inputField = parentElement.querySelector('input');

            expect(button).not.toBeNull();
            expect(button.textContent).toBe(mockI18n['processor.jwt.testConnection']);
            expect(resultContainer).not.toBeNull();
            expect(resultContainer.innerHTML).toBe('<em>Click the button to validate JWKS</em>');
            expect(inputField.nextElementSibling.classList.contains('jwks-button-wrapper')).toBe(true);
            expect(callback).toHaveBeenCalled();
        });

        it('should create button and result container in main container if input field is NOT present and type is "server"', () => {
            localJwksValidator.init(parentElement, initialPropertyValue, 'server', callback);
            const verificationContainer = parentElement.querySelector('.jwks-verification-container');
            expect(verificationContainer).not.toBeNull();
            expect(verificationContainer.querySelector('.verify-jwks-button')).not.toBeNull();
            expect(verificationContainer.querySelector('.verification-result')).not.toBeNull();
            expect(callback).toHaveBeenCalled();
        });

        it('should NOT create button if jwks_type is "file"', () => {
            localJwksValidator.init(parentElement, '/path/to/file.jwks', 'file', callback);
            expect(parentElement.querySelector('.verify-jwks-button')).toBeNull();
            expect(callback).toHaveBeenCalled();
        });

        it('should NOT create button if jwks_type is "memory"', () => {
            localJwksValidator.init(parentElement, '{"keys":[]}', 'memory', callback);
            expect(parentElement.querySelector('.verify-jwks-button')).toBeNull();
            expect(callback).toHaveBeenCalled();
        });

        it('should call i18n during init', () => {
            localJwksValidator.init(parentElement, initialPropertyValue, 'server', callback);
            expect(getI18nSpy).toHaveBeenCalled();
        });

        it('should use empty object for i18n if nfCommon.getI18n returns null', async () => {
            getI18nSpy.mockReturnValueOnce(null);
            parentElement.innerHTML = '<input type="text">';
            localJwksValidator.init(parentElement, initialPropertyValue, 'server', callback);

            expect(parentElement.querySelector('.verify-jwks-button').textContent).toBe('Test Connection'); // Default from SUT if i18n key missing
            expect(callback).toHaveBeenCalled();

            parentElement.querySelector('.verify-jwks-button').click();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('Testing...');
            currentDeferred.resolve({ valid: true, keyCount: 1 });
            await Promise.resolve();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--success-color); font-weight: bold;">OK</span> Valid JWKS (1 keys found)');

            if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
                localJwksValidator.__setIsLocalhostForTesting(false);
            }
            parentElement.querySelector('.verify-jwks-button').click();
            currentDeferred.reject({ responseText: 'Error from XHR' }, 'error', 'Condition1');
            await Promise.resolve();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Error from XHR');

            parentElement.querySelector('.verify-jwks-button').click();
            currentDeferred.reject({ responseText: null }, 'error', 'Error From Arg');
            await Promise.resolve();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Error From Arg');

            parentElement.querySelector('.verify-jwks-button').click();
            currentDeferred.reject({ responseText: null }, 'error', null);
            await Promise.resolve();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Unknown error');

            if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
                localJwksValidator.__setIsLocalhostForTesting(true);
            }
            parentElement.querySelector('.verify-jwks-button').click();
            currentDeferred.reject({ responseText: 'Error from XHR local' }, 'error', 'Condition local');
            await Promise.resolve();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--success-color); font-weight: bold;">OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');

            if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
                localJwksValidator.__setIsLocalhostForTesting(false);
            }
            mockCompatAjax.mockImplementationOnce(() => { throw new Error('Catch this'); });
            parentElement.querySelector('.verify-jwks-button').click();
            await Promise.resolve(); // For the throw itself if it were async, though here it's sync
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Catch this');

            const errorWithoutMessage = new Error();
            errorWithoutMessage.message = null;
            mockCompatAjax.mockImplementationOnce(() => { throw errorWithoutMessage; });
            parentElement.querySelector('.verify-jwks-button').click();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Exception occurred');

            if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
                localJwksValidator.__setIsLocalhostForTesting(null);
            }
        });

        it('should initialize correctly if callback is not a function', () => {
            parentElement.innerHTML = '<input type="text">';
            localJwksValidator.init(parentElement, initialPropertyValue, 'server', undefined);
            expect(parentElement.querySelector('.verify-jwks-button')).not.toBeNull();
            expect(callback).not.toHaveBeenCalled();
        });

        it('getValue should handle null or undefined propertyValue initially from callback object', () => {
            localJwksValidator.init(parentElement, null, 'server', callback);
            let cbObject = callback.mock.calls[0][0];
            expect(cbObject.getValue()).toBeNull();
            callback.mockClear();
            localJwksValidator.init(parentElement, undefined, 'server', callback);
            cbObject = callback.mock.calls[0][0];
            expect(cbObject.getValue()).toBeUndefined();
        });

        it('should use default URL in AJAX call if propertyValue is null at button click (and cover default getIsLocalhost)', () => {
            localJwksValidator.init(parentElement, null, 'server', callback);
            parentElement.querySelector('.verify-jwks-button').click();
            expect(mockCompatAjax).toHaveBeenCalledWith(expect.objectContaining({
                data: JSON.stringify({ jwksValue: 'https://example.com/.well-known/jwks.json' })
            }));
        });

        it('should use default URL in AJAX call if propertyValue is undefined at button click', () => {
            localJwksValidator.init(parentElement, undefined, 'server', callback);
            parentElement.querySelector('.verify-jwks-button').click();
            expect(mockCompatAjax).toHaveBeenCalledWith(expect.objectContaining({
                data: JSON.stringify({ jwksValue: 'https://example.com/.well-known/jwks.json' })
            }));
        });

        it('should trigger AJAX call and use actual window.location when isLocalhostOverride is null', async () => {
            localJwksValidator.init(parentElement, 'http://some-url.com', 'server', callback);

            if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
                localJwksValidator.__setIsLocalhostForTesting(null);
            }
            parentElement.querySelector('.verify-jwks-button').click();
            currentDeferred.reject({ responseText: 'some error' }, 'error', 'Error Condition');
            await Promise.resolve();
            jest.runAllTimers();

            expect(mockCompatAjax).toHaveBeenCalled();
            expect(parentElement.querySelector('.verification-result').innerHTML).toContain('<em>(Simulated response)</em>');
            expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG_LOG] Using simulated response for standalone testing');
        });
    });

    describe('Callback Object', () => {
        beforeEach(() => {
            localJwksValidator.init(parentElement, initialPropertyValue, 'server', callback);
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
    let localNfCommon;
    let getI18nSpy;
    let parentElement;
    let callback;
    const initialPropertyValue = 'https://example.com/.well-known/jwks.json';
    let consoleErrorSpy;
    let consoleLogSpy;
    let currentDeferred;

    beforeEach(() => {
        jest.resetModules();
        localJwksValidator = require('components/jwksValidator');
        localNfCommon = require('nf.Common');
        mockCompatAjax.mockClear();

        localJwksValidator.__setIsLocalhostForTesting(false);

        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
        parentElement.innerHTML = '<input type="text">';
        callback = jest.fn();

        mockCompatAjax.mockImplementation(() => {
            currentDeferred = {
                _doneCallback: null,
                _failCallback: null,
                done: function(cb) { this._doneCallback = cb; return this; },
                fail: function(cb) { this._failCallback = cb; return this; },
                resolve: function(data) { if (this._doneCallback) { Promise.resolve(data).then(this._doneCallback); } },
                reject: function(xhr, status, error) { if (this._failCallback) { Promise.resolve().then(() => this._failCallback(xhr, status, error)); } }
            };
            return currentDeferred;
        });

        getI18nSpy = jest.spyOn(localNfCommon, 'getI18n').mockReturnValue(mockI18n);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        localJwksValidator.init(parentElement, initialPropertyValue, 'server', callback);
    });

    afterEach(() => {
        localJwksValidator.__setIsLocalhostForTesting(null);
         if (parentElement.parentNode === document.body) {
            document.body.removeChild(parentElement);
        }
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        if (getI18nSpy) getI18nSpy.mockRestore();
    });

    describe('Button Click Handler (jwks_type="server")', () => {
        it('should set "Testing..." message and call $.ajax', async () => {
            const testValue = 'https://my.custom.url/jwks';
            callback.mock.calls[0][0].setValue(testValue);
            consoleLogSpy.mockClear();
            parentElement.querySelector('.verify-jwks-button').click();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe(mockI18n['processor.jwt.testing']);
            expect(mockCompatAjax).toHaveBeenCalledWith(expect.objectContaining({
                data: JSON.stringify({ jwksValue: testValue })
            }));
        });

        it('should show error from xhr.responseText (non-localhost)', async () => {
            consoleLogSpy.mockClear();
            parentElement.querySelector('.verify-jwks-button').click();
            currentDeferred.reject({ responseText: 'XHR error text' }, 'error', 'Error Condition');
            await Promise.resolve();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: XHR error text');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] JWKS validation error:', 'error', 'Error Condition');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should show error from errorThrown if no xhr.responseText (non-localhost)', async () => {
            parentElement.querySelector('.verify-jwks-button').click();
            currentDeferred.reject({ responseText: null }, 'error', 'Thrown Error From Arg');
            await Promise.resolve();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Thrown Error From Arg');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] JWKS validation error:', 'error', 'Thrown Error From Arg');
        });

        it('should show "Unknown error" if no responseText or errorThrown (non-localhost)', async () => {
            parentElement.querySelector('.verify-jwks-button').click();
            currentDeferred.reject({ responseText: null }, 'error', null);
            await Promise.resolve();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Unknown error');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] JWKS validation error:', 'error', null);
        });

        it('should show non-localhost exception message', () => {
            const exception = new Error('AJAX Setup Exception for non-localhost');
            mockCompatAjax.mockImplementationOnce(() => { throw exception; });
            consoleLogSpy.mockClear();
            parentElement.querySelector('.verify-jwks-button').click();
            // No await/jest.runAllTimers needed if error is synchronous from mock
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: ' + exception.message);
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation:', exception);
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should show non-localhost exception message with fallback if e.message is null', () => {
            const exception = new Error();
            exception.message = null;
            mockCompatAjax.mockImplementationOnce(() => { throw exception; });
            consoleLogSpy.mockClear();
            parentElement.querySelector('.verify-jwks-button').click();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Exception occurred');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation:', exception);
        });
    });
});

describe('jwksValidator (localhost)', () => {
    let localJwksValidator;
    let localNfCommon;
    let getI18nSpy;
    let parentElement;
    let callback;
    const initialPropertyValue = 'https://example.com/.well-known/jwks.json';
    let consoleErrorSpy;
    let consoleLogSpy;
    let currentDeferred;

    beforeEach(() => {
        jest.resetModules();
        localJwksValidator = require('components/jwksValidator');
        localNfCommon = require('nf.Common');
        mockCompatAjax.mockClear();

        localJwksValidator.__setIsLocalhostForTesting(true);

        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
        parentElement.innerHTML = '<input type="text">';
        callback = jest.fn();

        mockCompatAjax.mockImplementation(() => {
            currentDeferred = {
                _doneCallback: null,
                _failCallback: null,
                done: function(cb) { this._doneCallback = cb; return this; },
                fail: function(cb) { this._failCallback = cb; return this; },
                resolve: function(data) { if (this._doneCallback) { Promise.resolve(data).then(this._doneCallback); } },
                reject: function(xhr, status, error) { if (this._failCallback) { Promise.resolve().then(() => this._failCallback(xhr, status, error)); } }
            };
            return currentDeferred;
        });

        getI18nSpy = jest.spyOn(localNfCommon, 'getI18n').mockReturnValue(mockI18n);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        localJwksValidator.init(parentElement, initialPropertyValue, 'server', callback);
    });

    afterEach(() => {
        localJwksValidator.__setIsLocalhostForTesting(null);
        if (parentElement.parentNode === document.body) {
            document.body.removeChild(parentElement);
        }
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        if (getI18nSpy) getI18nSpy.mockRestore();
    });

    describe('Button Click Handler (jwks_type="server")', () => {
        it('should show success message on valid AJAX response', async () => {
            parentElement.querySelector('.verify-jwks-button').click();
            currentDeferred.resolve({ valid: true, keyCount: 5 });
            await Promise.resolve();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toContain('OK</span> Valid JWKS (5 keys found)');
        });

        it('should show failure message on invalid AJAX response', async () => {
            parentElement.querySelector('.verify-jwks-button').click();
            currentDeferred.resolve({ valid: false, message: 'Test error message' });
            await Promise.resolve();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toContain('Failed</span> Invalid JWKS: Test error message');
        });

        it('should show simulated success on AJAX fail (localhost)', async () => {
            parentElement.querySelector('.verify-jwks-button').click();
            currentDeferred.reject({ responseText: 'some error' }, 'error', 'Error Condition');
            await Promise.resolve();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toContain('OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] JWKS validation error:', 'error', 'Error Condition');
            expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG_LOG] Using simulated response for standalone testing');
        });

        it('should show simulated success on exception during AJAX setup (localhost)', () => {
            const exception = new Error('AJAX Setup Exception for localhost');
            mockCompatAjax.mockImplementationOnce(() => { throw exception; });
            consoleLogSpy.mockClear();
            parentElement.querySelector('.verify-jwks-button').click();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--success-color); font-weight: bold;">OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation:', exception);
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should show simulated success on exception during AJAX setup (localhost) if e.message is null', () => {
            const exception = new Error();
            exception.message = null;
            mockCompatAjax.mockImplementationOnce(() => { throw exception; });
            consoleLogSpy.mockClear();
            parentElement.querySelector('.verify-jwks-button').click();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--success-color); font-weight: bold;">OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation:', exception);
        });
    });
});

afterAll(() => {
    jest.useRealTimers();
});
