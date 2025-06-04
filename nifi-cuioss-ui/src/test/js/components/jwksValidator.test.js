/**
 * Tests for the JWKS Validator component.
 */
import { createAjaxMock, sampleJwksSuccess } from '../test-utils';

const mockI18n = {
    'processor.jwt.testConnection': 'Test Connection',
    'processor.jwt.testing': 'Testing...',
    'processor.jwt.ok': 'OK',
    'processor.jwt.failed': 'Failed',
    'processor.jwt.validJwks': 'Valid JWKS',
    'processor.jwt.invalidJwks': 'Invalid JWKS',
    'processor.jwt.keysFound': 'keys found',
    'processor.jwt.validationError': 'Validation error',
    'processor.jwt.unknownError': 'Unknown error',
    'jwksValidator.initialInstructions': 'Click the button to validate JWKS'
};

jest.useFakeTimers();

const mockComponentAjax = jest.fn();
jest.mock('cash-dom', () => {
    const actualCash = jest.requireActual('cash-dom');
    const cashSpy = jest.fn((selector) => {
        if (typeof selector === 'function') {
            selector();
            return { on: jest.fn().mockReturnThis() };
        }
        return actualCash(selector);
    });
    cashSpy.ajax = mockComponentAjax;
    return cashSpy;
});

const mockAjax = mockComponentAjax;

const getVerificationResultHTML = (parentElement) => {
    const el = parentElement.querySelector('.verification-result');
    return el ? el.innerHTML : undefined;
};

describe('jwksValidator - Common Initialization and Callback', () => {
    let localJwksValidator;
    let localNfCommon;
    let getI18nSpy;
    let parentElement;
    let callback;
    const initialPropertyValue = 'https://example.com/.well-known/jwks.json';

    beforeEach(() => {
        jest.resetModules();
        localJwksValidator = require('components/jwksValidator');
        localNfCommon = require('nf.Common');
        mockAjax.mockClear();

        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
        callback = jest.fn();

        getI18nSpy = jest.spyOn(localNfCommon, 'getI18n').mockReturnValue(mockI18n);

        if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
            localJwksValidator.__setIsLocalhostForTesting(null);
        }
    });

    afterEach(() => {
        if (parentElement.parentNode === document.body) {
            document.body.removeChild(parentElement);
        }
        if (getI18nSpy) getI18nSpy.mockRestore();
        if (localJwksValidator && typeof localJwksValidator.__setIsLocalhostForTesting === 'function') {
            localJwksValidator.__setIsLocalhostForTesting(null);
        }
        jest.clearAllTimers();
    });

    describe('Initialization', () => {
        // Assuming original initialization tests are mostly fine.
        // Key is that parentElement must contain an input for some tests.
        it('should create button and result container if jwks_type is "server" and input field is present', () => {
            parentElement.innerHTML = '<input type="text" value="' + initialPropertyValue + '">';
            localJwksValidator.init(parentElement, initialPropertyValue, 'server', callback);
            const button = parentElement.querySelector('.verify-jwks-button');
            expect(button).not.toBeNull();
            expect(button.textContent).toBe(mockI18n['processor.jwt.testConnection']);
            expect(parentElement.querySelector('.verification-result').innerHTML).toBe('<em>' + mockI18n['jwksValidator.initialInstructions'] + '</em>');
        });
    });

    describe('Callback Object', () => {
        beforeEach(() => {
            localJwksValidator.init(parentElement, initialPropertyValue, 'server', callback);
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
    });

    it('should use actual window.location for getIsLocalhost when override is null', async () => {
        // This test specifically targets the default path of getIsLocalhost (SUT line 15)
        localJwksValidator.__setIsLocalhostForTesting(null);

        // JSDOM's default window.location.href is 'http://localhost/', so SUT getIsLocalhost() will be true.
        const expectedIsLocalhostResultInSUT = window.location.href.includes('localhost') || window.location.href.includes('127.0.0.1');

        parentElement.innerHTML = '<input type="text" value="any-url">'; // Ensure input for init
        localJwksValidator.init(parentElement, 'any-url', 'server', callback);

        const errorResponse = { statusText: 'Error for getIsLocalhost default test' };
        mockAjax.mockImplementationOnce(createAjaxMock({
            isLocalhostValue: expectedIsLocalhostResultInSUT, // Mock reflects what SUT will determine
            isErrorScenario: true,
            simulatedLocalhostSuccessData: sampleJwksSuccess,
            errorData: errorResponse
        }));

        parentElement.querySelector('.verify-jwks-button').click();
        await jest.runAllTimersAsync();

        let expectedHtmlContent;
        if (expectedIsLocalhostResultInSUT) {
            expectedHtmlContent = 'OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>';
        } else {
            // This else branch is unlikely to be hit with default JSDOM URL
            expectedHtmlContent = mockI18n['processor.jwt.validationError'] + ': Error for getIsLocalhost default test';
        }
        expect(getVerificationResultHTML(parentElement)).toContain(expectedHtmlContent);
    });
});

describe('jwksValidator (non-localhost)', () => {
    let localJwksValidator;
    let localNfCommon;
    let getI18nSpy;
    let parentElement;
    let callback;
    const initialPropertyValue = 'https://test-url.com/jwks.json';

    beforeEach(() => {
        jest.resetModules();
        localJwksValidator = require('components/jwksValidator');
        localNfCommon = require('nf.Common');
        mockAjax.mockClear();

        localJwksValidator.__setIsLocalhostForTesting(false); // NON-LOCALHOST

        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
        // SUT expects parent to contain an input. For these tests, init creates it.
        parentElement.innerHTML = '<input type="text" value="' + initialPropertyValue + '">';

        callback = jest.fn();
        getI18nSpy = jest.spyOn(localNfCommon, 'getI18n').mockReturnValue(mockI18n);
        // Initialize with the input's current value or the initialPropertyValue if input is empty
        const currentVal = parentElement.querySelector('input').value || initialPropertyValue;
        localJwksValidator.init(parentElement, currentVal, 'server', callback);
    });

    afterEach(() => {
        localJwksValidator.__setIsLocalhostForTesting(null);
        if (parentElement.parentNode === document.body) { document.body.removeChild(parentElement); }
        if (getI18nSpy) getI18nSpy.mockRestore();
        jest.clearAllTimers();
    });

    describe('Button Click Handler (jwks_type="server")', () => {
        it('should set "Testing..." message and call $.ajax', async () => {
            const testValue = 'https://my.custom.url/jwks';
            callback.mock.calls[0][0].setValue(testValue); // Use callback to set value SUT will use

            mockAjax.mockImplementationOnce(createAjaxMock({
                isLocalhostValue: false,
                successData: sampleJwksSuccess
            }));

            parentElement.querySelector('.verify-jwks-button').click();
            expect(getVerificationResultHTML(parentElement)).toBe(mockI18n['processor.jwt.testing']);
            expect(mockAjax).toHaveBeenCalledWith(expect.objectContaining({
                data: JSON.stringify({ jwksValue: testValue })
            }));
            await jest.runAllTimersAsync();
        });

        it('should show error from xhr.responseText (non-localhost)', async () => {
            callback.mock.calls[0][0].setValue('https://error.url/jwks');
            const errorResponse = { status: 500, statusText: 'Internal Server Error', responseText: 'XHR error text' };
            mockAjax.mockImplementationOnce(createAjaxMock({
                isLocalhostValue: false, isErrorScenario: true, errorData: errorResponse
            }));

            parentElement.querySelector('.verify-jwks-button').click();
            await jest.runAllTimersAsync();
            expect(getVerificationResultHTML(parentElement)).toContain(mockI18n['processor.jwt.validationError'] + ': XHR error text');
        });

        it('should show error from statusText if no responseText (non-localhost)', async () => {
            callback.mock.calls[0][0].setValue('https://error.url/jwks');
            const errorResponse = { status: 500, statusText: 'Thrown Error From Arg', responseText: null };
            mockAjax.mockImplementationOnce(createAjaxMock({
                isLocalhostValue: false, isErrorScenario: true, errorData: errorResponse
            }));
            parentElement.querySelector('.verify-jwks-button').click();
            await jest.runAllTimersAsync();
            expect(getVerificationResultHTML(parentElement)).toContain(mockI18n['processor.jwt.validationError'] + ': Thrown Error From Arg');
        });

        it('should show "Unknown error" if no responseText or statusText (non-localhost)', async () => {
            callback.mock.calls[0][0].setValue('https://error.url/jwks');
            const errorResponse = { status: 500, statusText: null, responseText: null };
            mockAjax.mockImplementationOnce(createAjaxMock({
                isLocalhostValue: false, isErrorScenario: true, errorData: errorResponse
            }));
            parentElement.querySelector('.verify-jwks-button').click();
            await jest.runAllTimersAsync();
            expect(getVerificationResultHTML(parentElement)).toContain(mockI18n['processor.jwt.validationError'] + ': ' + (mockI18n['processor.jwt.unknownError'] || 'Unknown error'));
        });

        it('should show non-localhost exception message for synchronous error', async () => {
            callback.mock.calls[0][0].setValue('https://sync.error.url/jwks');
            mockAjax.mockImplementationOnce(createAjaxMock({
                isLocalhostValue: false, isSynchronousErrorScenario: true
            }));
            parentElement.querySelector('.verify-jwks-button').click();
            await jest.runAllTimersAsync();
            expect(getVerificationResultHTML(parentElement)).toContain(mockI18n['processor.jwt.validationError'] + ': Simulated synchronous AJAX error by test-utils');
        });

        it('should show non-localhost fallback for null message in synchronous error', async () => {
            callback.mock.calls[0][0].setValue('https://sync.error.url/jwks');
            mockAjax.mockImplementationOnce(() => { const err = new Error(); err.message = null; throw err; });
            parentElement.querySelector('.verify-jwks-button').click();
            await jest.runAllTimersAsync();
            expect(getVerificationResultHTML(parentElement)).toContain(mockI18n['processor.jwt.validationError'] + ': ' + (mockI18n['processor.jwt.unknownError'] || 'Exception occurred'));
        });
        // Add other sync error message variations if needed

        it('should display error from responseJSON.errors (array of strings)', async () => {
            callback.mock.calls[0][0].setValue('https://error.url/jwks');
            const errorResponse = {
                status: 500,
                statusText: 'Bad Request',
                responseJSON: { errors: ['Error 1', 'Error 2'] }
            };
            mockAjax.mockImplementationOnce(createAjaxMock({
                isLocalhostValue: false, isErrorScenario: true, errorData: errorResponse
            }));
            parentElement.querySelector('.verify-jwks-button').click();
            await jest.runAllTimersAsync();
            expect(getVerificationResultHTML(parentElement)).toContain(mockI18n['processor.jwt.validationError'] + ': Error 1, Error 2');
        });

        it('should display error from responseJSON.errors (array of objects)', async () => {
            callback.mock.calls[0][0].setValue('https://error.url/jwks');
            const errorResponse = {
                status: 500,
                statusText: 'Bad Request',
                responseJSON: { errors: [{ msg: 'Detail error 1' }, { msg: 'Detail error 2' }] }
            };
            mockAjax.mockImplementationOnce(createAjaxMock({
                isLocalhostValue: false, isErrorScenario: true, errorData: errorResponse
            }));
            parentElement.querySelector('.verify-jwks-button').click();
            await jest.runAllTimersAsync();
            expect(getVerificationResultHTML(parentElement)).toContain(mockI18n['processor.jwt.validationError'] + ': Detail error 1, Detail error 2');
        });

        it('should display error from parsed responseText.errors', async () => {
            callback.mock.calls[0][0].setValue('https://error.url/jwks');
            const errorResponse = {
                status: 500,
                statusText: 'Internal Server Error',
                responseText: JSON.stringify({ errors: ['Parsed Error 1', 'Parsed Error 2'] })
            };
            mockAjax.mockImplementationOnce(createAjaxMock({
                isLocalhostValue: false, isErrorScenario: true, errorData: errorResponse
            }));
            parentElement.querySelector('.verify-jwks-button').click();
            await jest.runAllTimersAsync();
            expect(getVerificationResultHTML(parentElement)).toContain(mockI18n['processor.jwt.validationError'] + ': Parsed Error 1, Parsed Error 2');
        });

        it('should display full responseText if parsed JSON has no message/errors', async () => {
            callback.mock.calls[0][0].setValue('https://error.url/jwks');
            const errorResponse = {
                status: 500,
                statusText: 'Internal Server Error',
                responseText: JSON.stringify({ detail: 'Some other JSON structure' })
            };
            mockAjax.mockImplementationOnce(createAjaxMock({
                isLocalhostValue: false, isErrorScenario: true, errorData: errorResponse
            }));
            parentElement.querySelector('.verify-jwks-button').click();
            await jest.runAllTimersAsync();
            expect(getVerificationResultHTML(parentElement)).toContain(mockI18n['processor.jwt.validationError'] + ': {"detail":"Some other JSON structure"}');
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

    beforeEach(() => {
        jest.resetModules();
        localJwksValidator = require('components/jwksValidator');
        localNfCommon = require('nf.Common');
        mockAjax.mockClear();

        localJwksValidator.__setIsLocalhostForTesting(true); // LOCALHOST

        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
        parentElement.innerHTML = '<input type="text" value="' + initialPropertyValue + '">';
        callback = jest.fn();
        getI18nSpy = jest.spyOn(localNfCommon, 'getI18n').mockReturnValue(mockI18n);
        localJwksValidator.init(parentElement, initialPropertyValue, 'server', callback);
    });

    afterEach(() => {
        localJwksValidator.__setIsLocalhostForTesting(null);
        if (parentElement.parentNode === document.body) { document.body.removeChild(parentElement); }
        if (getI18nSpy) getI18nSpy.mockRestore();
        jest.clearAllTimers();
    });

    describe('Button Click Handler (jwks_type="server")', () => {
        it('should show success message on valid AJAX response (simulated for localhost)', async () => {
            callback.mock.calls[0][0].setValue('https://any.url/keys');
            mockAjax.mockImplementationOnce(createAjaxMock({
                isLocalhostValue: true,
                simulatedLocalhostSuccessData: { ...sampleJwksSuccess, keyCount: 5 }
            }));
            parentElement.querySelector('.verify-jwks-button').click();
            await jest.runAllTimersAsync();
            expect(getVerificationResultHTML(parentElement)).toContain('OK</span> Valid JWKS (5 keys found)');
        });

        it('should show simulated success even for "invalid" AJAX response data (localhost)', async () => {
            callback.mock.calls[0][0].setValue('https://any.url/keys');
            mockAjax.mockImplementationOnce(createAjaxMock({
                isLocalhostValue: true,
                simulatedLocalhostSuccessData: sampleJwksSuccess,
                successData: { valid: false, message: 'This would be for non-localhost' }
            }));
            parentElement.querySelector('.verify-jwks-button').click();
            await jest.runAllTimersAsync();
            expect(getVerificationResultHTML(parentElement)).toContain('OK</span> Valid JWKS (3 keys found)');
        });

        it('should show simulated success on AJAX fail (localhost)', async () => {
            callback.mock.calls[0][0].setValue('https://any.url/keys');
            mockAjax.mockImplementationOnce(createAjaxMock({
                isLocalhostValue: true,
                isErrorScenario: true,
                simulatedLocalhostSuccessData: sampleJwksSuccess,
                errorData: { statusText: 'This error is for non-localhost' }
            }));
            parentElement.querySelector('.verify-jwks-button').click();
            await jest.runAllTimersAsync();
            expect(getVerificationResultHTML(parentElement)).toContain('OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
        });

        it('should show simulated success on synchronous exception during AJAX setup (localhost)', async () => {
            callback.mock.calls[0][0].setValue('https://any.url/keys');
            mockAjax.mockImplementationOnce(createAjaxMock({
                isLocalhostValue: true,
                isSynchronousErrorScenario: true,
                simulatedLocalhostSuccessData: sampleJwksSuccess
            }));
            parentElement.querySelector('.verify-jwks-button').click();
            await jest.runAllTimersAsync();
            expect(getVerificationResultHTML(parentElement)).toContain('OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
        });

        it('should show simulated success on synchronous exception (with null message) (localhost)', async () => {
            callback.mock.calls[0][0].setValue('https://any.url/keys');
            mockAjax.mockImplementationOnce(() => { const err = new Error(); err.message = null; throw err; });
            parentElement.querySelector('.verify-jwks-button').click();
            await jest.runAllTimersAsync();
            expect(getVerificationResultHTML(parentElement)).toContain('OK</span> Valid JWKS (3 keys found) <em>(Simulated response)</em>');
        });
    });
});

afterAll(() => {
    jest.useRealTimers();
});
