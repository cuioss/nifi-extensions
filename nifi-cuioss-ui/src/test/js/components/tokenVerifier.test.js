/**
 * Tests for the Token Verifier component.
 */
import $ from 'cash-dom'; // Top-level import, changed from jquery-compat

const mockI18n = {
    'processor.jwt.tokenInput': 'JWT Token Input Label',
    'processor.jwt.tokenInputPlaceholder': 'Paste token here...',
    'processor.jwt.verifyToken': 'Verify Token Button',
    'processor.jwt.verificationResults': 'Verification Results Header',
    'processor.jwt.noTokenProvided': 'No token provided message',
    'processor.jwt.verifying': 'Verifying token message...',
    'processor.jwt.tokenValid': 'Token is valid message',
    'processor.jwt.tokenDetails': 'Token Details Header',
    'processor.jwt.subject': 'Subject Label',
    'processor.jwt.issuer': 'Issuer Label',
    'processor.jwt.audience': 'Audience Label',
    'processor.jwt.expiration': 'Expiration Label',
    'processor.jwt.roles': 'Roles Label',
    'processor.jwt.scopes': 'Scopes Label',
    'processor.jwt.allClaims': 'All Claims Header',
    'processor.jwt.tokenInvalid': 'Token is invalid message',
    'processor.jwt.errorDetails': 'Error Details Header',
    'processor.jwt.errorCategory': 'Error Category Label',
    'processor.jwt.verificationError': 'Verification error message',
    'processor.jwt.unknownError': 'Unknown error'
};

jest.useFakeTimers();

// Mock ajax BEFORE any describe blocks or imports that might use it indirectly.
const mockAjax = jest.fn(); // Renamed from mockCompatAjax
jest.mock('../../../main/webapp/js/utils/ajax.js', () => ({
    ajax: mockAjax // Mock the 'ajax' export
}));

describe('tokenVerifier - Common Initialization', () => {
    let localTokenVerifier;
    // let local$; // Will use vanilla JS or top-level $ if absolutely needed for SUT interaction
    let localNfCommon; // Will hold the actual module
    let getI18nSpy;   // Spy for the getI18n export
    let parentElement; // Vanilla DOM element
    let callback;
    let consoleErrorSpy, consoleLogSpy;
    let mockPromiseResolve; // For mock AJAX control
    let mockPromiseReject;  // For mock AJAX control

    beforeEach(() => {
        jest.resetModules();
        localTokenVerifier = require('components/tokenVerifier');
        localNfCommon = require('nf.Common');

        mockAjax.mockClear(); // Use new mock name

        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
        callback = jest.fn();

        getI18nSpy = jest.spyOn(localNfCommon, 'getI18n').mockReturnValue(mockI18n);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        if (localTokenVerifier && typeof localTokenVerifier.__setIsLocalhostForTesting === 'function') {
            localTokenVerifier.__setIsLocalhostForTesting(null);
        }
    });

    afterEach(() => {
        if (parentElement.parentNode === document.body) {
            document.body.removeChild(parentElement);
        }
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        if (getI18nSpy) getI18nSpy.mockRestore(); // Restore the spy
        if (localTokenVerifier && typeof localTokenVerifier.__setIsLocalhostForTesting === 'function') {
            localTokenVerifier.__setIsLocalhostForTesting(null);
        }
    });

    it('should create main container', () => {
        localTokenVerifier.init(parentElement, {}, null, callback);
        expect(parentElement.querySelector('.token-verification-container')).not.toBeNull();
    });

    it('should create input section with label, textarea, and button', () => {
        localTokenVerifier.init(parentElement, {}, null, callback);
        const inputSection = parentElement.querySelector('.token-input-section');
        expect(inputSection).not.toBeNull();
        expect(inputSection.querySelector('label[for="token-input"]').textContent).toBe(mockI18n['processor.jwt.tokenInput']);
        expect(inputSection.querySelector('textarea#token-input').getAttribute('placeholder')).toBe(mockI18n['processor.jwt.tokenInputPlaceholder']);
        expect(inputSection.querySelector('button.verify-token-button').textContent).toBe(mockI18n['processor.jwt.verifyToken']);
    });

    it('should create results section with header and content area', () => {
        localTokenVerifier.init(parentElement, {}, null, callback);
        const resultsSection = parentElement.querySelector('.token-results-section');
        expect(resultsSection).not.toBeNull();
        expect(resultsSection.querySelector('h3').textContent).toBe(mockI18n['processor.jwt.verificationResults']);
        expect(resultsSection.querySelector('.token-results-content').innerHTML).toContain('Enter a JWT token above and click "Verify Token"');
    });

    it('should call nfCommon.getI18n during init', () => {
        localTokenVerifier.init(parentElement, {}, null, callback);
        expect(getI18nSpy).toHaveBeenCalled();
    });

    it('should call the callback with a validate method', () => {
        localTokenVerifier.init(parentElement, {}, null, callback);
        expect(callback).toHaveBeenCalledWith(expect.objectContaining({
            validate: expect.any(Function)
        }));
        const callbackArg = callback.mock.calls[0][0];
        expect(callbackArg.validate()).toBe(true);
    });

    it('should use empty object for i18n if nfCommon.getI18n returns null', () => {
        getI18nSpy.mockReturnValueOnce(null);
        localTokenVerifier.init(parentElement, {}, null, callback);

        const inputSection = parentElement.querySelector('.token-input-section');
        expect(inputSection.querySelector('label[for="token-input"]').textContent).toBe('Enter Token:');
        expect(inputSection.querySelector('textarea#token-input').getAttribute('placeholder')).toBe('Paste token here...');
        expect(inputSection.querySelector('button.verify-token-button').textContent).toBe('Verify Token');
        const resultsSection = parentElement.querySelector('.token-results-section');
        expect(resultsSection.querySelector('h3').textContent).toBe('Verification Results');
        expect(resultsSection.querySelector('.token-results-content').innerHTML).toContain('Enter a JWT token above and click "Verify Token"');
    });

    it('should initialize correctly if callback is not a function', () => {
        localTokenVerifier.init(parentElement, {}, null, undefined);
        expect(parentElement.querySelector('.token-verification-container')).not.toBeNull();
        expect(callback).not.toHaveBeenCalled();
    });
});

describe('tokenVerifier (non-localhost)', () => {
    let localTokenVerifier;
    let localNfCommon;
    let getI18nSpy;
    let parentElement;
    let callback;
    let consoleErrorSpy, consoleLogSpy;
    let mockPromiseResolve;
    let mockPromiseReject;

    beforeEach(() => {
        jest.resetModules();
        localTokenVerifier = require('components/tokenVerifier');
        localNfCommon = require('nf.Common');
        mockAjax.mockClear(); // Use new mock name

        localTokenVerifier.__setIsLocalhostForTesting(false);

        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
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

        localTokenVerifier.init(parentElement, {}, null, callback);
    });

    afterEach(() => {
        localTokenVerifier.__setIsLocalhostForTesting(null);
        if (parentElement.parentNode === document.body) {
            document.body.removeChild(parentElement);
        }
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        if (getI18nSpy) getI18nSpy.mockRestore();
    });

    it('should display AJAX error from xhr.responseText on .fail()', async () => {
        parentElement.querySelector('textarea#token-input').value = 'any.token';
        consoleLogSpy.mockClear();
        parentElement.querySelector('.verify-token-button').click();

        expect(mockAjax).toHaveBeenCalledTimes(1); // Changed to mockAjax
        const errorObj = new Error('Failed');
        errorObj.response = { status: 500, statusText: 'error', text: () => Promise.resolve('Actual AJAX failure') };
        if (mockPromiseReject) mockPromiseReject(errorObj);


        await Promise.resolve().then().then(); // Ensure all microtasks run
        jest.runAllTimers();

        expect(parentElement.querySelector('.token-results-content').innerHTML).toContain(mockI18n['processor.jwt.verificationError'] + ': Actual AJAX failure');
        // expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Token verification error:', 'Failed', errorObj.response); // Removed: Debug log not present in source
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should display AJAX error from errorThrown on .fail() if no responseText', async () => {
        parentElement.querySelector('textarea#token-input').value = 'any.token';
        parentElement.querySelector('.verify-token-button').click();

        expect(mockAjax).toHaveBeenCalledTimes(1); // Changed to mockAjax
        const errorObj = new Error('Specific Error Thrown');
        errorObj.response = { status: 500, statusText: 'error', text: () => Promise.resolve(null) };
        if (mockPromiseReject) mockPromiseReject(errorObj);
        await Promise.resolve().then().then();
        jest.runAllTimers();

        expect(parentElement.querySelector('.token-results-content').innerHTML).toContain(mockI18n['processor.jwt.verificationError'] + ': Specific Error Thrown');
        // expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Token verification error:', 'Specific Error Thrown', errorObj.response); // Removed: Debug log not present in source
    });

    it('should display "Unknown error" on .fail() if no responseText or errorThrown', async () => {
        parentElement.querySelector('textarea#token-input').value = 'any.token';
        parentElement.querySelector('.verify-token-button').click();

        expect(mockAjax).toHaveBeenCalledTimes(1); // Changed to mockAjax
        const errorObj = new Error(null);
        errorObj.response = { status: 500, statusText: null, text: () => Promise.resolve(null) };
        if (mockPromiseReject) mockPromiseReject(errorObj);
        await Promise.resolve().then().then();
        jest.runAllTimers();

        expect(parentElement.querySelector('.token-results-content').innerHTML).toContain(mockI18n['processor.jwt.verificationError'] + ': ' + (mockI18n['processor.jwt.unknownError'] || 'Unknown error'));
        // expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Token verification error:', 'null', errorObj.response); // Removed: Debug log not present in source
    });

    it('should display exception message in UI on catch', () => {
        const exception = new Error('Non-localhost exception');
        mockAjax.mockImplementationOnce(() => { throw exception; }); // Changed to mockAjax

        parentElement.querySelector('textarea#token-input').value = 'any.token';
        consoleLogSpy.mockClear();
        parentElement.querySelector('.verify-token-button').click();

        expect(parentElement.querySelector('.token-results-content').innerHTML).toContain(mockI18n['processor.jwt.verificationError'] + ': Non-localhost exception');
        // expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in token verification setup:', exception); // Removed: Debug log not present in source
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });
});

describe('tokenVerifier (localhost)', () => {
    let localTokenVerifier;
    let localNfCommon;
    let getI18nSpy;
    let parentElement;
    let callback;
    let consoleErrorSpy, consoleLogSpy;
    let mockPromiseResolve;
    let mockPromiseReject;

    beforeEach(() => {
        jest.resetModules();
        localTokenVerifier = require('components/tokenVerifier');
        localNfCommon = require('nf.Common');
        mockAjax.mockClear(); // Use new mock name

        localTokenVerifier.__setIsLocalhostForTesting(true);

        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
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

        localTokenVerifier.init(parentElement, {}, null, callback);
    });

    afterEach(() => {
        localTokenVerifier.__setIsLocalhostForTesting(null);
        if (parentElement.parentNode === document.body) {
            document.body.removeChild(parentElement);
        }
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        if (getI18nSpy) getI18nSpy.mockRestore();
    });

    it('should show error if no token provided', () => {
        parentElement.querySelector('textarea#token-input').value = '';
        parentElement.querySelector('.verify-token-button').click();
        expect(parentElement.querySelector('.token-results-content').innerHTML).toContain(mockI18n['processor.jwt.noTokenProvided']);
    });

    it('should call compatAjax and show loading on token submit', () => {
        const tokenValue = 'test.token';
        parentElement.querySelector('textarea#token-input').value = tokenValue;
        parentElement.querySelector('.verify-token-button').click();

        expect(parentElement.querySelector('.token-results-content').innerHTML).toContain(mockI18n['processor.jwt.verifying']);
        expect(mockAjax).toHaveBeenCalledWith(expect.objectContaining({ data: JSON.stringify({ token: tokenValue }) })); // Changed to mockAjax
    });

    it('should display valid token details on success (valid: true)', async () => {
        const mockResponseData = { // This is what the ajax call's 'data' field would contain
            valid: true, subject: 's', issuer: 'i', audience: 'a', expiration: 'e',
            roles: ['r1'], scopes: ['s1'], claims: { sub: 's' }
        };
        parentElement.querySelector('textarea#token-input').value = 'valid.token';
        parentElement.querySelector('.verify-token-button').click();

        expect(mockAjax).toHaveBeenCalledTimes(1); // Changed to mockAjax
        if (mockPromiseResolve) mockPromiseResolve({ data: mockResponseData, status: 200, statusText: 'OK' }); // Corrected
        await Promise.resolve().then().then();
        jest.runAllTimers();

        const resultsHtml = parentElement.querySelector('.token-results-content').innerHTML;
        expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenValid']);
        expect(resultsHtml).toContain('s');
        expect(resultsHtml).toContain('r1');
        expect(resultsHtml).toContain('s1');

        mockAjax.mockClear(); // Changed to mockAjax
        const mockResponseNoOptionalData = {
            valid: true, subject: 's2', issuer: 'i2', audience: 'a2', expiration: 'e2',
            claims: { sub: 's2' }
        };
        parentElement.querySelector('textarea#token-input').value = 'valid.no.optional.token';
        parentElement.querySelector('.verify-token-button').click();
        expect(mockAjax).toHaveBeenCalledTimes(1); // Changed to mockAjax
        if (mockPromiseResolve) mockPromiseResolve({ data: mockResponseNoOptionalData, status: 200, statusText: 'OK' }); // Corrected
        await Promise.resolve().then().then();
        jest.runAllTimers();
        const resultsHtmlNoOptional = parentElement.querySelector('.token-results-content').innerHTML;
        expect(resultsHtmlNoOptional).toContain(mockI18n['processor.jwt.tokenValid']);
        expect(resultsHtmlNoOptional).toContain('s2');
        expect(resultsHtmlNoOptional).not.toContain(mockI18n['processor.jwt.roles']);
        expect(resultsHtmlNoOptional).not.toContain(mockI18n['processor.jwt.scopes']);

        mockAjax.mockClear(); // Changed to mockAjax
        const mockResponseEmptyOptionalData = {
            valid: true, subject: 's3', issuer: 'i3', audience: 'a3', expiration: 'e3',
            roles: [], scopes: [],
            claims: { sub: 's3' }
        };
        parentElement.querySelector('textarea#token-input').value = 'valid.empty.optional.token';
        parentElement.querySelector('.verify-token-button').click();
        expect(mockAjax).toHaveBeenCalledTimes(1); // Changed to mockAjax
        if (mockPromiseResolve) mockPromiseResolve({ data: mockResponseEmptyOptionalData, status: 200, statusText: 'OK' }); // Corrected
        await Promise.resolve().then().then();
        jest.runAllTimers();
        const resultsHtmlEmptyOptional = parentElement.querySelector('.token-results-content').innerHTML;
        expect(resultsHtmlEmptyOptional).toContain(mockI18n['processor.jwt.tokenValid']);
        expect(resultsHtmlEmptyOptional).toContain('s3');
        expect(resultsHtmlEmptyOptional).not.toContain(mockI18n['processor.jwt.roles']);
        expect(resultsHtmlEmptyOptional).not.toContain(mockI18n['processor.jwt.scopes']);
    });

    it('should display invalid token details on success (valid: false)', async () => {
        const mockResponseData = { valid: false, message: 'Invalid sig', category: 'SIG' };
        parentElement.querySelector('textarea#token-input').value = 'invalid.token';
        parentElement.querySelector('.verify-token-button').click();
        expect(mockAjax).toHaveBeenCalledTimes(1); // Changed to mockAjax
        if (mockPromiseResolve) mockPromiseResolve({ data: mockResponseData, status: 200, statusText: 'OK' }); // Corrected
        await Promise.resolve().then().then();
        jest.runAllTimers();
        const resultsHtml = parentElement.querySelector('.token-results-content').innerHTML;
        expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenInvalid']);
        expect(resultsHtml).toContain('Invalid sig');
        expect(resultsHtml).toContain('SIG');

        mockAjax.mockClear(); // Changed to mockAjax
        const mockResponseNoDetailsData = { valid: false };
        parentElement.querySelector('textarea#token-input').value = 'invalid.no.details.token';
        parentElement.querySelector('.verify-token-button').click();
        expect(mockAjax).toHaveBeenCalledTimes(1); // Changed to mockAjax
        if (mockPromiseResolve) mockPromiseResolve({ data: mockResponseNoDetailsData, status: 200, statusText: 'OK' }); // Corrected
        await Promise.resolve().then().then();
        jest.runAllTimers();
        const resultsHtmlNoDetails = parentElement.querySelector('.token-results-content').innerHTML;
        expect(resultsHtmlNoDetails).toContain(mockI18n['processor.jwt.tokenInvalid']);
        expect(resultsHtmlNoDetails).not.toContain(mockI18n['processor.jwt.errorCategory']);
        expect(resultsHtmlNoDetails).toContain(mockI18n['processor.jwt.errorDetails']);
        const errorMsgElement = parentElement.querySelector('.token-error-message');
        expect(errorMsgElement.textContent).toBe('');

        mockAjax.mockClear(); // Changed to mockAjax
        const mockResponseNullDetailsData = { valid: false, message: null, category: null };
        parentElement.querySelector('textarea#token-input').value = 'invalid.null.details.token';
        parentElement.querySelector('.verify-token-button').click();
        expect(mockAjax).toHaveBeenCalledTimes(1); // Changed to mockAjax
        if (mockPromiseResolve) mockPromiseResolve({ data: mockResponseNullDetailsData, status: 200, statusText: 'OK' }); // Corrected
        await Promise.resolve().then().then();
        jest.runAllTimers();
        const resultsHtmlNullDetails = parentElement.querySelector('.token-results-content').innerHTML;
        expect(resultsHtmlNullDetails).toContain(mockI18n['processor.jwt.tokenInvalid']);
        expect(resultsHtmlNullDetails).not.toContain(mockI18n['processor.jwt.errorCategory']);
        const errorMsgElementNull = parentElement.querySelector('.token-error-message');
        expect(errorMsgElementNull.textContent).toBe('');
    });

    it('should display simulated success on AJAX .fail()', async () => {
        parentElement.querySelector('textarea#token-input').value = 'any.token';
        parentElement.querySelector('.verify-token-button').click();

        expect(mockAjax).toHaveBeenCalledTimes(1); // Changed to mockAjax
        const errorObj = new Error('Network issue');
        errorObj.response = { status: 500, statusText: 'error', text: () => Promise.resolve('Network Error') };
        if (mockPromiseReject) mockPromiseReject(errorObj);
        await Promise.resolve().then().then();
        jest.runAllTimers();

        const resultsHtml = parentElement.querySelector('.token-results-content').innerHTML;
        expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenValid']);
        expect(resultsHtml).toContain('<em>(Simulated response)</em>');
        // expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Token verification error:', 'Network issue', errorObj.response); // Removed: Debug log not present in source
        // expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG_LOG] Using simulated response for standalone testing after error'); // Removed: Debug log not present in source
    });

    it('should display simulated success on exception during AJAX setup', () => {
        const exception = new Error('Localhost setup exception');
        mockAjax.mockImplementationOnce(() => { throw exception; }); // Changed to mockAjax

        parentElement.querySelector('textarea#token-input').value = 'any.token';
        parentElement.querySelector('.verify-token-button').click();

        const resultsHtml = parentElement.querySelector('.token-results-content').innerHTML;
        expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenValid']);
        expect(resultsHtml).toContain('<em>(Simulated response)</em>');
        // expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in token verification setup:', exception); // Removed: Debug log not present in source
        // expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG_LOG] Using simulated response for standalone testing (exception setup path)'); // Removed: Debug log not present in source
    });
});

afterAll(() => {
    jest.useRealTimers();
});
