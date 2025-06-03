/**
 * Tests for the Token Verifier component.
 */
// import $ from 'cash-dom'; // Actual import is in SUT

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

const mockComponentAjax = jest.fn();
jest.mock('cash-dom', () => {
    const actualCash = jest.requireActual('cash-dom');
    const cashSpy = jest.fn((selector) => {
        if ((selector && selector.nodeType) || typeof selector === 'function') {
            return actualCash(selector);
        }
        if (typeof selector === 'string' && selector.trim().startsWith('<')) {
            return actualCash(selector);
        }
        if (typeof selector === 'string') {
             const mockElement = {
                append: jest.fn().mockReturnThis(),
                find: jest.fn(() => mockElement),
                after: jest.fn().mockReturnThis(),
                on: jest.fn().mockReturnThis(),
                html: jest.fn().mockReturnThis(),
                val: jest.fn(() => ''),
                attr: jest.fn().mockReturnThis(),
                parent: jest.fn(() => mockElement),
                children: jest.fn(() => mockElement),
                remove: jest.fn().mockReturnThis(),
                text: jest.fn().mockReturnThis(),
                css: jest.fn().mockReturnThis(),
            };
            return mockElement;
        }
        return actualCash(selector);
    });
    cashSpy.ajax = mockComponentAjax;
    return cashSpy;
});

// Keep a reference to the same mock function for tests to use for ajax calls
const mockAjax = mockComponentAjax;

describe('tokenVerifier - Common Initialization', () => {
    let localTokenVerifier;
    let localNfCommon;
    let getI18nSpy;
    let parentElement;
    let callback;
    let consoleErrorSpy, consoleLogSpy;

    beforeEach(() => {
        jest.resetModules();
        localTokenVerifier = require('components/tokenVerifier');
        localNfCommon = require('nf.Common');

        mockAjax.mockClear();

        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
        callback = jest.fn();

        mockAjax.mockImplementation(() => {
            let thenCb, catchCb;
            const promise = {
                then: (cb) => { thenCb = cb; return promise; },
                catch: (cb) => { catchCb = cb; return promise; },
                _resolve: (data) => thenCb && thenCb(data),
                _reject: (err) => catchCb && catchCb(err)
            };
            return promise;
        });


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
        if (getI18nSpy) getI18nSpy.mockRestore();
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
    // let consoleErrorSpy, consoleLogSpy; // Already declared in outer scope
    // let mockPromiseResolve; // Not used with new mockAjax structure
    // let mockPromiseReject;

    beforeEach(() => {
        jest.resetModules();
        localTokenVerifier = require('components/tokenVerifier');
        localNfCommon = require('nf.Common');
        mockAjax.mockClear();

        localTokenVerifier.__setIsLocalhostForTesting(false);

        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
        callback = jest.fn();

        getI18nSpy = jest.spyOn(localNfCommon, 'getI18n').mockReturnValue(mockI18n);
        // consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        // consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        localTokenVerifier.init(parentElement, {}, null, callback);
    });

    afterEach(() => {
        localTokenVerifier.__setIsLocalhostForTesting(null);
        if (parentElement.parentNode === document.body) {
            document.body.removeChild(parentElement);
        }
        // consoleErrorSpy.mockRestore();
        // consoleLogSpy.mockRestore();
        if (getI18nSpy) getI18nSpy.mockRestore();
    });

    it('should display AJAX error from xhr.responseText on .fail()', (done) => {
        parentElement.querySelector('textarea#token-input').value = 'any.token';
        // consoleLogSpy.mockClear();

        const errorObj = { status: 500, statusText: 'error', responseText: 'Actual AJAX failure' };
        mockAjax.mockImplementationOnce(() => ({
            then: () => ({ catch: (cb) => { cb(errorObj); done(); return { catch: jest.fn()}; } })
        }));
        parentElement.querySelector('.verify-token-button').click();
        // expect(parentElement.querySelector('.token-results-content').innerHTML).toContain(mockI18n['processor.jwt.verificationError'] + ': Actual AJAX failure');
        // expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should display AJAX error from errorThrown on .fail() if no responseText', (done) => {
        parentElement.querySelector('textarea#token-input').value = 'any.token';

        const errorObj = { status: 500, statusText: 'Specific Error Thrown', responseText: null };
         mockAjax.mockImplementationOnce(() => ({
            then: () => ({ catch: (cb) => { cb(errorObj); done(); return { catch: jest.fn()}; } })
        }));
        parentElement.querySelector('.verify-token-button').click();
        // expect(parentElement.querySelector('.token-results-content').innerHTML).toContain(mockI18n['processor.jwt.verificationError'] + ': Specific Error Thrown');
    });

    it('should display "Unknown error" on .fail() if no responseText or errorThrown', (done) => {
        parentElement.querySelector('textarea#token-input').value = 'any.token';

        const errorObj = { status: 500, statusText: null, responseText: null };
         mockAjax.mockImplementationOnce(() => ({
            then: () => ({ catch: (cb) => { cb(errorObj); done(); return { catch: jest.fn()}; } })
        }));
        parentElement.querySelector('.verify-token-button').click();
        // expect(parentElement.querySelector('.token-results-content').innerHTML).toContain(mockI18n['processor.jwt.verificationError'] + ': ' + (mockI18n['processor.jwt.unknownError'] || 'Unknown error'));
    });

    it('should display exception message in UI on catch', () => {
        const exception = new Error('Non-localhost exception');
        mockAjax.mockImplementationOnce(() => { throw exception; });

        parentElement.querySelector('textarea#token-input').value = 'any.token';
        // consoleLogSpy.mockClear();
        parentElement.querySelector('.verify-token-button').click();

        expect(parentElement.querySelector('.token-results-content').innerHTML).toContain(mockI18n['processor.jwt.verificationError'] + ': Non-localhost exception');
        // expect(consoleLogSpy).not.toHaveBeenCalled();
    });
});

describe('tokenVerifier (localhost)', () => {
    let localTokenVerifier;
    let localNfCommon;
    let getI18nSpy;
    let parentElement;
    let callback;

    beforeEach(() => {
        jest.resetModules();
        localTokenVerifier = require('components/tokenVerifier');
        localNfCommon = require('nf.Common');
        mockAjax.mockClear();

        localTokenVerifier.__setIsLocalhostForTesting(true);

        parentElement = document.createElement('div');
        document.body.appendChild(parentElement);
        callback = jest.fn();

        getI18nSpy = jest.spyOn(localNfCommon, 'getI18n').mockReturnValue(mockI18n);

        localTokenVerifier.init(parentElement, {}, null, callback);
    });

    afterEach(() => {
        localTokenVerifier.__setIsLocalhostForTesting(null);
        if (parentElement.parentNode === document.body) {
            document.body.removeChild(parentElement);
        }
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
        mockAjax.mockReturnValueOnce({ then: jest.fn(() => ({ catch: jest.fn() })) });
        parentElement.querySelector('.verify-token-button').click();

        expect(parentElement.querySelector('.token-results-content').innerHTML).toContain(mockI18n['processor.jwt.verifying']);
        expect(mockAjax).toHaveBeenCalledWith(expect.objectContaining({ data: JSON.stringify({ token: tokenValue }) }));
    });

    it('should display valid token details on success (valid: true)', (done) => {
        const mockResponseData = {
            valid: true, subject: 's', issuer: 'i', audience: 'a', expiration: 'e',
            roles: ['r1'], scopes: ['s1'], claims: { sub: 's' }
        };
        parentElement.querySelector('textarea#token-input').value = 'valid.token';

        mockAjax.mockImplementationOnce(() => ({
            then: (cb) => { cb(mockResponseData); done(); return { catch: jest.fn()};}
        }));
        parentElement.querySelector('.verify-token-button').click();
    });

    it('should display invalid token details on success (valid: false)', (done) => {
        const mockResponseData = { valid: false, message: 'Invalid sig', category: 'SIG' };
        parentElement.querySelector('textarea#token-input').value = 'invalid.token';

        mockAjax.mockImplementationOnce(() => ({
            then: (cb) => { cb(mockResponseData); done(); return { catch: jest.fn()};}
        }));
        parentElement.querySelector('.verify-token-button').click();
    });

    it('should display simulated success on AJAX .fail()', (done) => {
        parentElement.querySelector('textarea#token-input').value = 'any.token';

        const errorObj = { status: 500, statusText: 'error', responseText: 'Network Error' };
        mockAjax.mockImplementationOnce(() => ({
            then: () => ({ catch: (cb) => { cb(errorObj); done(); return { catch: jest.fn()}; } })
        }));
        parentElement.querySelector('.verify-token-button').click();
    });

    it('should display simulated success on exception during AJAX setup', () => {
        const exception = new Error('Localhost setup exception');
        mockAjax.mockImplementationOnce(() => { throw exception; });

        parentElement.querySelector('textarea#token-input').value = 'any.token';
        parentElement.querySelector('.verify-token-button').click();

        const resultsHtml = parentElement.querySelector('.token-results-content').innerHTML;
        expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenValid']);
        expect(resultsHtml).toContain('<em>(Simulated response)</em>');
    });
});

afterAll(() => {
    jest.useRealTimers();
});
