/**
 * Tests for the Token Verifier component.
 */
import $ from 'jquery'; // Top-level import for jQuery

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

describe('tokenVerifier - Common Initialization', () => {
    let localTokenVerifier;
    let local$;
    let localNfCommon;
    let $element;
    let callback;
    let consoleErrorSpy, consoleLogSpy;

    beforeEach(() => {
        jest.resetModules();
        localTokenVerifier = require('components/tokenVerifier');
        local$ = require('jquery');
        localNfCommon = require('nf.Common');

        const rawElement = document.createElement('div');
        document.body.appendChild(rawElement);
        $element = local$(rawElement);
        callback = jest.fn();
        local$.ajax = jest.fn(); // Mock $.ajax

        localNfCommon.getI18n = jest.fn().mockReturnValue(mockI18n);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        if (localTokenVerifier && typeof localTokenVerifier.__setIsLocalhostForTesting === 'function') {
            localTokenVerifier.__setIsLocalhostForTesting(null);
        }
    });

    afterEach(() => {
        $element.remove();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        if (localTokenVerifier && typeof localTokenVerifier.__setIsLocalhostForTesting === 'function') {
            localTokenVerifier.__setIsLocalhostForTesting(null);
        }
    });

    it('should create main container', () => {
        localTokenVerifier.init($element[0], {}, null, callback);
        expect($element.find('.token-verification-container').length).toBe(1);
    });

    it('should create input section with label, textarea, and button', () => {
        localTokenVerifier.init($element[0], {}, null, callback);
        const inputSection = $element.find('.token-input-section');
        expect(inputSection.length).toBe(1);
        expect(inputSection.find('label[for="token-input"]').text()).toBe(mockI18n['processor.jwt.tokenInput']);
        expect(inputSection.find('textarea#token-input').attr('placeholder')).toBe(mockI18n['processor.jwt.tokenInputPlaceholder']);
        expect(inputSection.find('button.verify-token-button').text()).toBe(mockI18n['processor.jwt.verifyToken']);
    });

    it('should create results section with header and content area', () => {
        localTokenVerifier.init($element[0], {}, null, callback);
        const resultsSection = $element.find('.token-results-section');
        expect(resultsSection.length).toBe(1);
        expect(resultsSection.find('h3').text()).toBe(mockI18n['processor.jwt.verificationResults']);
        expect(resultsSection.find('.token-results-content').html()).toContain('Enter a JWT token above and click "Verify Token"');
    });

    it('should call nfCommon.getI18n during init', () => {
        localTokenVerifier.init($element[0], {}, null, callback);
        expect(localNfCommon.getI18n).toHaveBeenCalled();
    });

    it('should call the callback with a validate method', () => {
        localTokenVerifier.init($element[0], {}, null, callback);
        expect(callback).toHaveBeenCalledWith(expect.objectContaining({
            validate: expect.any(Function)
        }));
        const callbackArg = callback.mock.calls[0][0];
        expect(callbackArg.validate()).toBe(true);
    });

    it('should use empty object for i18n if nfCommon.getI18n returns null', () => {
        localNfCommon.getI18n.mockReturnValueOnce(null);
        localTokenVerifier.init($element[0], {}, null, callback);

        const inputSection = $element.find('.token-input-section');
        expect(inputSection.find('label[for="token-input"]').text()).toBe('Enter Token:');
        expect(inputSection.find('textarea#token-input').attr('placeholder')).toBe('Paste token here...');
        expect(inputSection.find('button.verify-token-button').text()).toBe('Verify Token');
        const resultsSection = $element.find('.token-results-section');
        expect(resultsSection.find('h3').text()).toBe('Verification Results');
        expect(resultsSection.find('.token-results-content').html()).toContain('Enter a JWT token above and click "Verify Token"');

        $element.find('textarea#token-input').val('any.token');

        if (localTokenVerifier && typeof localTokenVerifier.__setIsLocalhostForTesting === 'function') {
            localTokenVerifier.__setIsLocalhostForTesting(false);
        }

        let deferred = local$.Deferred();
        local$.ajax.mockReturnValueOnce(deferred.promise());
        $element.find('.verify-token-button').trigger('click');
        expect($element.find('.token-results-content').html()).toContain('Verifying token...');
        deferred.reject({ responseText: 'XHR Text Error Fallback' }, 'error', 'Condition1');
        jest.runAllTimers();
        expect($element.find('.token-results-content').html()).toContain('Verification error: XHR Text Error Fallback');

        deferred = local$.Deferred();
        local$.ajax.mockReturnValueOnce(deferred.promise());
        $element.find('.verify-token-button').trigger('click');
        deferred.reject({ responseText: null }, 'error', 'Error Arg Fallback');
        jest.runAllTimers();
        expect($element.find('.token-results-content').html()).toContain('Verification error: Error Arg Fallback');

        deferred = local$.Deferred();
        local$.ajax.mockReturnValueOnce(deferred.promise());
        $element.find('.verify-token-button').trigger('click');
        deferred.reject({ responseText: null }, 'error', null);
        jest.runAllTimers();
        expect($element.find('.token-results-content').html()).toContain('Verification error: Unknown error');

        local$.ajax.mockImplementationOnce(() => { throw new Error('Exception Message Fallback'); });
        $element.find('.verify-token-button').trigger('click');
        expect($element.find('.token-results-content').html()).toContain('Verification error: Exception Message Fallback');

        const errNoMsg = new Error();
        errNoMsg.message = null;
        local$.ajax.mockImplementationOnce(() => { throw errNoMsg; });
        $element.find('.verify-token-button').trigger('click');
        expect($element.find('.token-results-content').html()).toContain('Verification error: Exception occurred');

        if (localTokenVerifier && typeof localTokenVerifier.__setIsLocalhostForTesting === 'function') {
            localTokenVerifier.__setIsLocalhostForTesting(true);
        }
        deferred = local$.Deferred();
        local$.ajax.mockReturnValueOnce(deferred.promise());
        $element.find('.verify-token-button').trigger('click');
        deferred.reject({ responseText: 'Simulated Fail' }, 'error', 'ConditionLocal');
        jest.runAllTimers();
        expect($element.find('.token-results-content').html()).toContain('Token is valid');
        expect($element.find('.token-results-content').html()).toContain('<em>(Simulated response)</em>');

        local$.ajax.mockImplementationOnce(() => { throw new Error('Simulated Exception'); });
        $element.find('.verify-token-button').trigger('click');
        expect($element.find('.token-results-content').html()).toContain('Token is valid');
        expect($element.find('.token-results-content').html()).toContain('<em>(Simulated response)</em>');

        if (localTokenVerifier && typeof localTokenVerifier.__setIsLocalhostForTesting === 'function') {
            localTokenVerifier.__setIsLocalhostForTesting(null);
        }
    });

    it('should initialize correctly if callback is not a function', () => {
        localTokenVerifier.init($element[0], {}, null, undefined);
        expect($element.find('.token-verification-container').length).toBe(1);
        expect(callback).not.toHaveBeenCalled();
    });
});

describe('tokenVerifier (non-localhost)', () => {
    let localTokenVerifier;
    let local$;
    let localNfCommon;
    let $element;
    let callback;
    let consoleErrorSpy, consoleLogSpy;

    beforeEach(() => {
        jest.resetModules();
        localTokenVerifier = require('components/tokenVerifier');
        local$ = require('jquery');
        localNfCommon = require('nf.Common');

        localTokenVerifier.__setIsLocalhostForTesting(false);

        const rawElement = document.createElement('div');
        document.body.appendChild(rawElement);
        $element = local$(rawElement);
        callback = jest.fn();
        local$.ajax = jest.fn();

        localNfCommon.getI18n = jest.fn().mockReturnValue(mockI18n);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        localTokenVerifier.init($element[0], {}, null, callback);
    });

    afterEach(() => {
        localTokenVerifier.__setIsLocalhostForTesting(null);
        $element.remove();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    it('should display AJAX error from xhr.responseText on .fail()', () => {
        const deferred = local$.Deferred();
        local$.ajax.mockReturnValue(deferred.promise());
        $element.find('textarea#token-input').val('any.token');
        consoleLogSpy.mockClear();
        $element.find('.verify-token-button').trigger('click');
        deferred.reject({ responseText: 'Actual AJAX failure' }, 'error', 'Failed');
        jest.runAllTimers();
        expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.verificationError'] + ': Actual AJAX failure');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Token verification error:', 'error', 'Failed');
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should display AJAX error from errorThrown on .fail() if no responseText', () => {
        const deferred = local$.Deferred();
        local$.ajax.mockReturnValue(deferred.promise());
        $element.find('textarea#token-input').val('any.token');
        $element.find('.verify-token-button').trigger('click');
        deferred.reject({ responseText: null }, 'error', 'Specific Error Thrown');
        jest.runAllTimers();
        expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.verificationError'] + ': Specific Error Thrown');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Token verification error:', 'error', 'Specific Error Thrown');
    });

    it('should display "Unknown error" on .fail() if no responseText or errorThrown', () => {
        const deferred = local$.Deferred();
        local$.ajax.mockReturnValue(deferred.promise());
        $element.find('textarea#token-input').val('any.token');
        $element.find('.verify-token-button').trigger('click');
        deferred.reject({ responseText: null }, 'error', null);
        jest.runAllTimers();
        expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.verificationError'] + ': Unknown error');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Token verification error:', 'error', null);
    });

    it('should display exception message in UI on catch', () => {
        const exception = new Error('Non-localhost exception');
        local$.ajax.mockImplementation(() => { throw exception; });
        $element.find('textarea#token-input').val('any.token');
        consoleLogSpy.mockClear();
        $element.find('.verify-token-button').trigger('click');
        jest.runAllTimers();
        expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.verificationError'] + ': Non-localhost exception');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in token verification:', exception);
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });
});

describe('tokenVerifier (localhost)', () => {
    let localTokenVerifier;
    let local$;
    let localNfCommon;
    let $element;
    let callback;
    let consoleErrorSpy, consoleLogSpy;

    beforeEach(() => {
        jest.resetModules();
        localTokenVerifier = require('components/tokenVerifier');
        local$ = require('jquery');
        localNfCommon = require('nf.Common');

        localTokenVerifier.__setIsLocalhostForTesting(true);

        const rawElement = document.createElement('div');
        document.body.appendChild(rawElement);
        $element = local$(rawElement);
        callback = jest.fn();
        local$.ajax = jest.fn();

        localNfCommon.getI18n = jest.fn().mockReturnValue(mockI18n);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        localTokenVerifier.init($element[0], {}, null, callback);
    });

    afterEach(() => {
        localTokenVerifier.__setIsLocalhostForTesting(null);
        $element.remove();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    it('should show error if no token provided', () => {
        $element.find('textarea#token-input').val('');
        $element.find('.verify-token-button').trigger('click');
        expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.noTokenProvided']);
        expect(local$.ajax).not.toHaveBeenCalled();
    });

    it('should call $.ajax and show loading on token submit', () => {
        const tokenValue = 'test.token';
        $element.find('textarea#token-input').val(tokenValue);
        const deferred = local$.Deferred();
        local$.ajax.mockReturnValue(deferred.promise());
        $element.find('.verify-token-button').trigger('click');
        expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.verifying']);
        expect(local$.ajax).toHaveBeenCalledWith(expect.objectContaining({ data: JSON.stringify({ token: tokenValue }) }));
    });

    it('should display valid token details on success (valid: true)', () => {
        const mockResponse = {
            valid: true, subject: 's', issuer: 'i', audience: 'a', expiration: 'e',
            roles: ['r1'], scopes: ['s1'], claims: { sub: 's' }
        };
        local$.ajax.mockReturnValue(local$.Deferred().resolve(mockResponse).promise());
        $element.find('textarea#token-input').val('valid.token');
        $element.find('.verify-token-button').trigger('click');
        const resultsHtml = $element.find('.token-results-content').html();
        expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenValid']);
        expect(resultsHtml).toContain('s');
        expect(resultsHtml).toContain('r1');
        expect(resultsHtml).toContain('s1');

        const mockResponseNoOptional = {
            valid: true, subject: 's2', issuer: 'i2', audience: 'a2', expiration: 'e2',
            claims: { sub: 's2' }
        };
        local$.ajax.mockReturnValue(local$.Deferred().resolve(mockResponseNoOptional).promise());
        $element.find('textarea#token-input').val('valid.no.optional.token');
        $element.find('.verify-token-button').trigger('click');
        const resultsHtmlNoOptional = $element.find('.token-results-content').html();
        expect(resultsHtmlNoOptional).toContain(mockI18n['processor.jwt.tokenValid']);
        expect(resultsHtmlNoOptional).toContain('s2');
        expect(resultsHtmlNoOptional).not.toContain(mockI18n['processor.jwt.roles']);
        expect(resultsHtmlNoOptional).not.toContain(mockI18n['processor.jwt.scopes']);

        const mockResponseEmptyOptional = {
            valid: true, subject: 's3', issuer: 'i3', audience: 'a3', expiration: 'e3',
            roles: [], scopes: [],
            claims: { sub: 's3' }
        };
        local$.ajax.mockReturnValue(local$.Deferred().resolve(mockResponseEmptyOptional).promise());
        $element.find('textarea#token-input').val('valid.empty.optional.token');
        $element.find('.verify-token-button').trigger('click');
        const resultsHtmlEmptyOptional = $element.find('.token-results-content').html();
        expect(resultsHtmlEmptyOptional).toContain(mockI18n['processor.jwt.tokenValid']);
        expect(resultsHtmlEmptyOptional).toContain('s3');
        expect(resultsHtmlEmptyOptional).not.toContain(mockI18n['processor.jwt.roles']);
        expect(resultsHtmlEmptyOptional).not.toContain(mockI18n['processor.jwt.scopes']);
    });

    it('should display invalid token details on success (valid: false)', () => {
        const mockResponse = { valid: false, message: 'Invalid sig', category: 'SIG' };
        local$.ajax.mockReturnValue(local$.Deferred().resolve(mockResponse).promise());
        $element.find('textarea#token-input').val('invalid.token');
        $element.find('.verify-token-button').trigger('click');
        const resultsHtml = $element.find('.token-results-content').html();
        expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenInvalid']);
        expect(resultsHtml).toContain('Invalid sig');
        expect(resultsHtml).toContain('SIG');

        const mockResponseNoDetails = { valid: false };
        local$.ajax.mockReturnValue(local$.Deferred().resolve(mockResponseNoDetails).promise());
        $element.find('textarea#token-input').val('invalid.no.details.token');
        $element.find('.verify-token-button').trigger('click');
        const resultsHtmlNoDetails = $element.find('.token-results-content').html();
        expect(resultsHtmlNoDetails).toContain(mockI18n['processor.jwt.tokenInvalid']);
        expect(resultsHtmlNoDetails).not.toContain(mockI18n['processor.jwt.errorCategory']);
        expect(resultsHtmlNoDetails).toContain(mockI18n['processor.jwt.errorDetails']);
        const errorMsgElement = $element.find('.token-error-message');
        expect(errorMsgElement.text()).toBe('');

        const mockResponseNullDetails = { valid: false, message: null, category: null };
        local$.ajax.mockReturnValue(local$.Deferred().resolve(mockResponseNullDetails).promise());
        $element.find('textarea#token-input').val('invalid.null.details.token');
        $element.find('.verify-token-button').trigger('click');
        const resultsHtmlNullDetails = $element.find('.token-results-content').html();
        expect(resultsHtmlNullDetails).toContain(mockI18n['processor.jwt.tokenInvalid']);
        expect(resultsHtmlNullDetails).not.toContain(mockI18n['processor.jwt.errorCategory']);
        const errorMsgElementNull = $element.find('.token-error-message');
        expect(errorMsgElementNull.text()).toBe('');
    });

    it('should display simulated success on AJAX .fail()', () => {
        const deferred = local$.Deferred();
        local$.ajax.mockReturnValue(deferred.promise());
        $element.find('textarea#token-input').val('any.token');
        $element.find('.verify-token-button').trigger('click');
        deferred.reject({ responseText: 'Network Error' }, 'error', 'Network issue');
        jest.runAllTimers();
        const resultsHtml = $element.find('.token-results-content').html();
        expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenValid']);
        expect(resultsHtml).toContain('<em>(Simulated response)</em>');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Token verification error:', 'error', 'Network issue');
        expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG_LOG] Using simulated response for standalone testing');
    });

    it('should display simulated success on exception during AJAX setup', () => {
        const exception = new Error('Localhost setup exception');
        local$.ajax.mockImplementation(() => { throw exception; });
        $element.find('textarea#token-input').val('any.token');
        $element.find('.verify-token-button').trigger('click');
        jest.runAllTimers();
        const resultsHtml = $element.find('.token-results-content').html();
        expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenValid']);
        expect(resultsHtml).toContain('<em>(Simulated response)</em>');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in token verification:', exception);
        expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG_LOG] Using simulated response for standalone testing (exception path)');
    });
});

afterAll(() => {
    jest.useRealTimers();
});
