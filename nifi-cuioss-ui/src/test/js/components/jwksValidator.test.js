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
    'processor.jwt.unknownError': 'Unknown error', // Added this key
    'processor.jwt.initialInstructions': 'Click the button to validate JWKS'
};

jest.useFakeTimers();

// Mock ajax BEFORE any describe blocks
const mockAjax = jest.fn();
jest.mock('../../../main/webapp/js/utils/ajax.js', () => ({
    ajax: mockAjax // Ensure this matches the export name from ajax.js
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
    let mockPromiseResolve; // For mock AJAX control
    let mockPromiseReject;  // For mock AJAX control

    beforeEach(() => {
        jest.resetModules();
        localJwksValidator = require('components/jwksValidator');
        localNfCommon = require('nf.Common');
        mockAjax.mockClear(); // Use the new mock name

        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
        callback = jest.fn();

        // Updated mock implementation to return a controllable Promise
        mockAjax.mockImplementation(() => {
            return new Promise((resolve, reject) => {
                mockPromiseResolve = resolve;
                mockPromiseReject = reject;
            });
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
            // Simulate successful AJAX call
            mockPromiseResolve({ data: { valid: true, keyCount: 1 }, status: 200, statusText: 'OK' }); // This was correct
            await Promise.resolve().then().then(); // Ensure all microtasks run
            jest.runAllTimers(); // Allow setTimeout/setInterval to run if any
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--success-color); font-weight: bold;">OK</span> Valid JWKS (1 keys found)');

            if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
                localJwksValidator.__setIsLocalhostForTesting(false);
            }
            if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
                localJwksValidator.__setIsLocalhostForTesting(false);
            }
            parentElement.querySelector('.verify-jwks-button').click();
            // Simulate failed AJAX call
            const errorObj1 = new Error('Condition1');
            errorObj1.response = { status: 500, statusText: 'Internal Server Error', text: () => Promise.resolve('Error from XHR') };
            if (mockPromiseReject) mockPromiseReject(errorObj1); // Corrected: use mockPromiseReject
            await Promise.resolve().then().then();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Error from XHR');

            parentElement.querySelector('.verify-jwks-button').click();
            const errorObj2 = new Error('Error From Arg');
            errorObj2.response = { status: 500, statusText: 'Error From Arg', text: () => Promise.resolve(null) };
            if (mockPromiseReject) mockPromiseReject(errorObj2); // Corrected
            await Promise.resolve().then().then();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Error From Arg');

            parentElement.querySelector('.verify-jwks-button').click();
            const errorObj3 = new Error(null);
            errorObj3.response = { status: 500, statusText: null, text: () => Promise.resolve(null) };
            if (mockPromiseReject) mockPromiseReject(errorObj3); // Corrected
            await Promise.resolve().then().then();
            jest.runAllTimers();
            // error.message is null in this test case, so the component falls back to the i18n string for 'Unknown error'
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: ' + (mockI18n['processor.jwt.unknownError'] || 'Unknown error'));

            if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
                localJwksValidator.__setIsLocalhostForTesting(true);
            }
            parentElement.querySelector('.verify-jwks-button').click();
            const errorObj4 = new Error('Condition local');
            errorObj4.response = { status: 500, statusText: 'Internal Server Error', text: () => Promise.resolve('Error from XHR local') };
            if (mockPromiseReject) mockPromiseReject(errorObj4); // Corrected
            await Promise.resolve().then().then();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--success-color); font-weight: bold;">OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');

            if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
                localJwksValidator.__setIsLocalhostForTesting(false);
            }
            mockAjax.mockImplementationOnce(() => { throw new Error('Catch this'); });
            parentElement.querySelector('.verify-jwks-button').click();
            await Promise.resolve();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Catch this');

            const errorWithoutMessage = new Error();
            errorWithoutMessage.message = null;
            mockAjax.mockImplementationOnce(() => { throw errorWithoutMessage; });
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
            expect(mockAjax).toHaveBeenCalledWith(expect.objectContaining({ // Changed to mockAjax
                data: JSON.stringify({ jwksValue: 'https://example.com/.well-known/jwks.json' })
            }));
        });

        it('should use default URL in AJAX call if propertyValue is undefined at button click', () => {
            localJwksValidator.init(parentElement, undefined, 'server', callback);
            parentElement.querySelector('.verify-jwks-button').click();
            expect(mockAjax).toHaveBeenCalledWith(expect.objectContaining({ // Changed to mockAjax
                data: JSON.stringify({ jwksValue: 'https://example.com/.well-known/jwks.json' })
            }));
        });

        it('should trigger AJAX call and use actual window.location when isLocalhostOverride is null', async () => {
            localJwksValidator.init(parentElement, 'http://some-url.com', 'server', callback);

            if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
                localJwksValidator.__setIsLocalhostForTesting(null);
            }
            parentElement.querySelector('.verify-jwks-button').click();

            const errorObj = new Error('Error Condition');
            errorObj.response = { status: 500, statusText: 'Internal Server Error', text: () => Promise.resolve('some error') };
            if (mockPromiseReject) mockPromiseReject(errorObj); // Corrected
            await Promise.resolve().then().then();
            jest.runAllTimers();

            expect(mockAjax).toHaveBeenCalled();
            // Depending on actual window.location.href during test, this might or might not be simulated
            // If window.location.href is localhost-like, it will show simulated success.
            // If not, it will show the actual error.
            // The key is that getIsLocalhost() inside the SUT will determine this.
            // For this test, assuming it results in simulated due to Jest's default environment.
            expect(parentElement.querySelector('.verification-result').innerHTML).toContain('<em>(Simulated response)</em>');
            // expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG_LOG] Using simulated response for standalone testing after error'); // This log no longer exists
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
    let mockPromiseResolve;
    let mockPromiseReject;

    beforeEach(() => {
        jest.resetModules();
        localJwksValidator = require('components/jwksValidator');
        localNfCommon = require('nf.Common');
        mockAjax.mockClear(); // Use new mock name

        localJwksValidator.__setIsLocalhostForTesting(false);

        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
        parentElement.innerHTML = '<input type="text">';
        callback = jest.fn();

        mockAjax.mockImplementation(() => { // Use new mock name
            return new Promise((resolve, reject) => {
                mockPromiseResolve = resolve;
                mockPromiseReject = reject;
            });
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
            expect(mockAjax).toHaveBeenCalledWith(expect.objectContaining({ // Changed to mockAjax
                data: JSON.stringify({ jwksValue: testValue })
            }));
        });

        it('should show error from xhr.responseText (non-localhost)', async () => {
            consoleLogSpy.mockClear();
            parentElement.querySelector('.verify-jwks-button').click();
            const errorObj = new Error('Error Condition');
            errorObj.response = { status: 500, statusText: 'Internal Server Error', text: () => Promise.resolve('XHR error text') };
            if (mockPromiseReject) mockPromiseReject(errorObj); // Corrected
            await Promise.resolve().then().then();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: XHR error text');
            // expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] JWKS validation error:', 'Error Condition', errorObj.response); // This log no longer exists
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should show error from errorThrown if no xhr.responseText (non-localhost)', async () => {
            parentElement.querySelector('.verify-jwks-button').click();
            const errorObj = new Error('Thrown Error From Arg');
            errorObj.response = { status: 500, statusText: 'Thrown Error From Arg', text: () => Promise.resolve(null) };
            if (mockPromiseReject) mockPromiseReject(errorObj); // Corrected
            await Promise.resolve().then().then();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: Thrown Error From Arg');
            // expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] JWKS validation error:', 'Thrown Error From Arg', errorObj.response); // This log no longer exists
        });

        it('should show "Unknown error" if no responseText or errorThrown (non-localhost)', async () => {
            parentElement.querySelector('.verify-jwks-button').click();
            const errorObj = new Error(null);
            errorObj.response = { status: 500, statusText: null, text: () => Promise.resolve(null) };
            if (mockPromiseReject) mockPromiseReject(errorObj); // Corrected
            await Promise.resolve().then().then();
            jest.runAllTimers();
            // error.message is null in this test case, so the component falls back to the i18n string for 'Unknown error'
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: ' + (mockI18n['processor.jwt.unknownError'] || 'Unknown error'));
            // expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] JWKS validation error:', 'null', errorObj.response); // This log no longer exists
        });

        it('should show non-localhost exception message', () => {
            const exception = new Error('AJAX Setup Exception for non-localhost');
            mockAjax.mockImplementationOnce(() => { throw exception; });
            consoleLogSpy.mockClear();
            parentElement.querySelector('.verify-jwks-button').click();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: ' + exception.message);
            // expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation setup:', exception); // This log no longer exists
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should show non-localhost exception message with fallback if e.message is null', () => {
            const exception = new Error();
            exception.message = null;
            mockAjax.mockImplementationOnce(() => { throw exception; });
            consoleLogSpy.mockClear();
            parentElement.querySelector('.verify-jwks-button').click();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--error-color); font-weight: bold;">Failed</span> Validation error: ' + (mockI18n['processor.jwt.unknownError'] || 'Unknown error'));
            // expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation setup:', exception);  // This log no longer exists
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
    let mockPromiseResolve;
    let mockPromiseReject;

    beforeEach(() => {
        jest.resetModules();
        localJwksValidator = require('components/jwksValidator');
        localNfCommon = require('nf.Common');
        mockAjax.mockClear(); // Use new mock name

        localJwksValidator.__setIsLocalhostForTesting(true);

        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
        parentElement.innerHTML = '<input type="text">';
        callback = jest.fn();

        mockAjax.mockImplementation(() => { // Use new mock name
            return new Promise((resolve, reject) => {
                mockPromiseResolve = resolve;
                mockPromiseReject = reject;
            });
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
            if (mockPromiseResolve) mockPromiseResolve({ data: { valid: true, keyCount: 5 }, status: 200, statusText: 'OK' }); // Corrected
            await Promise.resolve().then().then();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toContain('OK</span> Valid JWKS (5 keys found)');
        });

        it('should show failure message on invalid AJAX response', async () => {
            parentElement.querySelector('.verify-jwks-button').click();
            if (mockPromiseResolve) mockPromiseResolve({ data: { valid: false, message: 'Test error message' }, status: 200, statusText: 'OK' }); // Corrected
            await Promise.resolve().then().then();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toContain('Failed</span> Invalid JWKS: Test error message');
        });

        it('should show simulated success on AJAX fail (localhost)', async () => {
            parentElement.querySelector('.verify-jwks-button').click();
            const errorObj = new Error('Error Condition');
            errorObj.response = { status: 500, statusText: 'Internal Server Error', text: () => Promise.resolve('some error') };
            if (mockPromiseReject) mockPromiseReject(errorObj); // Corrected
            await Promise.resolve().then().then();
            jest.runAllTimers();
            expect(parentElement.querySelector('.verification-result').innerHTML).toContain('OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
            // expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] JWKS validation error:', 'Error Condition', errorObj.response); // This log no longer exists
            // expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG_LOG] Using simulated response for standalone testing after error'); // This log no longer exists
        });

        it('should show simulated success on exception during AJAX setup (localhost)', () => {
            const exception = new Error('AJAX Setup Exception for localhost');
            mockAjax.mockImplementationOnce(() => { throw exception; });
            consoleLogSpy.mockClear();
            parentElement.querySelector('.verify-jwks-button').click();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--success-color); font-weight: bold;">OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
            // expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation setup:', exception); // This log no longer exists
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should show simulated success on exception during AJAX setup (localhost) if e.message is null', () => {
            const exception = new Error();
            exception.message = null;
            mockAjax.mockImplementationOnce(() => { throw exception; });
            consoleLogSpy.mockClear();
            parentElement.querySelector('.verify-jwks-button').click();
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<span style="color: var(--success-color); font-weight: bold;">OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
            // expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in JWKS validation setup:', exception);  // This log no longer exists
        });
    });
});

afterAll(() => {
    jest.useRealTimers();
});
