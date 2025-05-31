/**
 * Tests for the Token Verifier component.
 */
// tokenVerifier, $, nfCommon are required inside describe/beforeEach to use fresh modules with overrides

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
    'processor.jwt.unknownError': 'Unknown error' // Assuming this might be used by component
};

jest.useFakeTimers();

describe('tokenVerifier - Common Initialization', () => {
    let tokenVerifier;
    let $;
    let nfCommon;
    let $element;
    let callback;
    let consoleErrorSpy, consoleLogSpy;

    beforeEach(() => {
        jest.resetModules();
        tokenVerifier = require('components/tokenVerifier');
        $ = require('jquery');
        nfCommon = require('nf.Common');

        const rawElement = document.createElement('div');
        document.body.appendChild(rawElement);
        $element = $(rawElement);
        callback = jest.fn();
        $.ajax = jest.fn(); // Mock $.ajax

        nfCommon.getI18n = jest.fn().mockReturnValue(mockI18n);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        // Ensure __setIsLocalhostForTesting is reset if a previous suite (incorrectly) left it set
         if (tokenVerifier && typeof tokenVerifier.__setIsLocalhostForTesting === 'function') {
            tokenVerifier.__setIsLocalhostForTesting(null);
        }
    });

    afterEach(() => {
        $element.remove();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        if (tokenVerifier && typeof tokenVerifier.__setIsLocalhostForTesting === 'function') {
            tokenVerifier.__setIsLocalhostForTesting(null);
        }
    });

    // Initialization tests
    it('should create main container', () => {
        tokenVerifier.init($element[0], {}, null, callback);
        expect($element.find('.token-verification-container').length).toBe(1);
    });

    it('should create input section with label, textarea, and button', () => {
        tokenVerifier.init($element[0], {}, null, callback);
        const inputSection = $element.find('.token-input-section');
        expect(inputSection.length).toBe(1);
        expect(inputSection.find('label[for="token-input"]').text()).toBe(mockI18n['processor.jwt.tokenInput']);
        expect(inputSection.find('textarea#token-input').attr('placeholder')).toBe(mockI18n['processor.jwt.tokenInputPlaceholder']);
        expect(inputSection.find('button.verify-token-button').text()).toBe(mockI18n['processor.jwt.verifyToken']);
    });

    it('should create results section with header and content area', () => {
        tokenVerifier.init($element[0], {}, null, callback);
        const resultsSection = $element.find('.token-results-section');
        expect(resultsSection.length).toBe(1);
        expect(resultsSection.find('h3').text()).toBe(mockI18n['processor.jwt.verificationResults']);
        expect(resultsSection.find('.token-results-content').html()).toContain('Enter a JWT token above and click "Verify Token"');
    });

    it('should call nfCommon.getI18n during init', () => {
        tokenVerifier.init($element[0], {}, null, callback);
        expect(nfCommon.getI18n).toHaveBeenCalled();
    });

    it('should call the callback with a validate method', () => {
        tokenVerifier.init($element[0], {}, null, callback);
        expect(callback).toHaveBeenCalledWith(expect.objectContaining({
            validate: expect.any(Function)
        }));
        const callbackArg = callback.mock.calls[0][0];
        expect(callbackArg.validate()).toBe(true);
    });

    it('should use empty object for i18n if nfCommon.getI18n returns null', () => {
        nfCommon.getI18n.mockReturnValueOnce(null); // i18n will be {}
        tokenVerifier.init($element[0], {}, null, callback);

        // Initial UI checks (already covered existing fallbacks)
        const inputSection = $element.find('.token-input-section');
        expect(inputSection.find('label[for="token-input"]').text()).toBe('Enter Token:');
        expect(inputSection.find('textarea#token-input').attr('placeholder')).toBe('Paste token here...');
        expect(inputSection.find('button.verify-token-button').text()).toBe('Verify Token');
        const resultsSection = $element.find('.token-results-section');
        expect(resultsSection.find('h3').text()).toBe('Verification Results');
        expect(resultsSection.find('.token-results-content').html()).toContain('Enter a JWT token above and click "Verify Token"');

        // --- Test AJAX error paths with i18n = {} ---
        $element.find('textarea#token-input').val('any.token');

        // ** Non-localhost behavior **
        if (tokenVerifier && typeof tokenVerifier.__setIsLocalhostForTesting === 'function') {
            tokenVerifier.__setIsLocalhostForTesting(false);
        }

        // .fail() path with fallbacks
        // Case 1: xhr.responseText
        let deferred = $.Deferred();
        $.ajax.mockReturnValueOnce(deferred.promise());
        $element.find('.verify-token-button').trigger('click');
        expect($element.find('.token-results-content').html()).toContain('Verifying token...'); // Verifying message fallback
        deferred.reject({ responseText: 'XHR Text Error Fallback' }, 'error', 'Condition1');
        jest.runAllTimers();
        expect($element.find('.token-results-content').html()).toContain('Verification error: XHR Text Error Fallback');

        // Case 2: error argument
        deferred = $.Deferred();
        $.ajax.mockReturnValueOnce(deferred.promise());
        $element.find('.verify-token-button').trigger('click');
        deferred.reject({ responseText: null }, 'error', 'Error Arg Fallback');
        jest.runAllTimers();
        expect($element.find('.token-results-content').html()).toContain('Verification error: Error Arg Fallback');

        // Case 3: Unknown error fallback
        deferred = $.Deferred();
        $.ajax.mockReturnValueOnce(deferred.promise());
        $element.find('.verify-token-button').trigger('click');
        deferred.reject({ responseText: null }, 'error', null);
        jest.runAllTimers();
        expect($element.find('.token-results-content').html()).toContain('Verification error: Unknown error');

        // catch (e) path with fallbacks
        // Case 1: e.message present
        $.ajax.mockImplementationOnce(() => { throw new Error('Exception Message Fallback'); });
        $element.find('.verify-token-button').trigger('click');
        // Synchronous throw, no need for jest.runAllTimers() for the error to appear
        expect($element.find('.token-results-content').html()).toContain('Verification error: Exception Message Fallback');

        // Case 2: e.message is null/undefined
        const errNoMsg = new Error();
        errNoMsg.message = null;
        $.ajax.mockImplementationOnce(() => { throw errNoMsg; });
        $element.find('.verify-token-button').trigger('click');
        expect($element.find('.token-results-content').html()).toContain('Verification error: Exception occurred');


        // ** Localhost behavior (simulated success) **
        if (tokenVerifier && typeof tokenVerifier.__setIsLocalhostForTesting === 'function') {
            tokenVerifier.__setIsLocalhostForTesting(true);
        }
        // .fail() path
        deferred = $.Deferred();
        $.ajax.mockReturnValueOnce(deferred.promise());
        $element.find('.verify-token-button').trigger('click');
        deferred.reject({ responseText: 'Simulated Fail' }, 'error', 'ConditionLocal');
        jest.runAllTimers();
        expect($element.find('.token-results-content').html()).toContain('Token is valid'); // Default valid message
        expect($element.find('.token-results-content').html()).toContain('<em>(Simulated response)</em>');

        // catch (e) path
        $.ajax.mockImplementationOnce(() => { throw new Error('Simulated Exception'); });
        $element.find('.verify-token-button').trigger('click');
        expect($element.find('.token-results-content').html()).toContain('Token is valid'); // Default valid message
        expect($element.find('.token-results-content').html()).toContain('<em>(Simulated response)</em>');


        // Reset localhost override
        if (tokenVerifier && typeof tokenVerifier.__setIsLocalhostForTesting === 'function') {
            tokenVerifier.__setIsLocalhostForTesting(null);
        }
    });

    it('should initialize correctly if callback is not a function', () => {
        tokenVerifier.init($element[0], {}, null, undefined); // Pass undefined callback
        expect($element.find('.token-verification-container').length).toBe(1);
        expect(callback).not.toHaveBeenCalled();
    });
});

// --- Tests for non-localhost behavior ---
describe('tokenVerifier (non-localhost)', () => {
    let tokenVerifier;
    let $;
    let nfCommon;
    let $element;
    let callback;
    let consoleErrorSpy, consoleLogSpy;

    beforeEach(() => {
        jest.resetModules();
        tokenVerifier = require('components/tokenVerifier');
        $ = require('jquery');
        nfCommon = require('nf.Common');

        tokenVerifier.__setIsLocalhostForTesting(false);

        const rawElement = document.createElement('div');
        document.body.appendChild(rawElement);
        $element = $(rawElement);
        callback = jest.fn();
        $.ajax = jest.fn();

        nfCommon.getI18n = jest.fn().mockReturnValue(mockI18n);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        tokenVerifier.init($element[0], {}, null, callback); // Init after setting override
    });

    afterEach(() => {
        tokenVerifier.__setIsLocalhostForTesting(null);
        $element.remove();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    it('should display AJAX error from xhr.responseText on .fail()', () => {
        const deferred = $.Deferred();
        $.ajax.mockReturnValue(deferred.promise());
        $element.find('textarea#token-input').val('any.token');
        consoleLogSpy.mockClear(); // Clear logs from init before click
        $element.find('.verify-token-button').trigger('click');
        deferred.reject({ responseText: 'Actual AJAX failure' }, 'error', 'Failed');
        jest.runAllTimers();
        expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.verificationError'] + ': Actual AJAX failure');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Token verification error:', 'error', 'Failed');
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should display AJAX error from errorThrown on .fail() if no responseText', () => {
        const deferred = $.Deferred();
        $.ajax.mockReturnValue(deferred.promise());
        $element.find('textarea#token-input').val('any.token');
        $element.find('.verify-token-button').trigger('click');
        deferred.reject({ responseText: null }, 'error', 'Specific Error Thrown');
        jest.runAllTimers();
        expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.verificationError'] + ': Specific Error Thrown');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Token verification error:', 'error', 'Specific Error Thrown');
    });

    it('should display "Unknown error" on .fail() if no responseText or errorThrown', () => {
        const deferred = $.Deferred();
        $.ajax.mockReturnValue(deferred.promise());
        $element.find('textarea#token-input').val('any.token');
        $element.find('.verify-token-button').trigger('click');
        deferred.reject({ responseText: null }, 'error', null); // error is null
        jest.runAllTimers();
        expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.verificationError'] + ': Unknown error');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Token verification error:', 'error', null);
    });

    it('should display exception message in UI on catch', () => {
        const exception = new Error('Non-localhost exception');
        $.ajax.mockImplementation(() => { throw exception; });
        $element.find('textarea#token-input').val('any.token');
        consoleLogSpy.mockClear(); // Clear logs from init before click
        $element.find('.verify-token-button').trigger('click');
        jest.runAllTimers();
        expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.verificationError'] + ': Non-localhost exception');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG_LOG] Exception in token verification:', exception);
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });
});

// --- Tests for localhost behavior ---
describe('tokenVerifier (localhost)', () => {
    let tokenVerifier;
    let $;
    let nfCommon;
    let $element;
    let callback;
    let consoleErrorSpy, consoleLogSpy;

    beforeEach(() => {
        jest.resetModules();
        tokenVerifier = require('components/tokenVerifier');
        $ = require('jquery');
        nfCommon = require('nf.Common');

        tokenVerifier.__setIsLocalhostForTesting(true);

        const rawElement = document.createElement('div');
        document.body.appendChild(rawElement);
        $element = $(rawElement);
        callback = jest.fn();
        $.ajax = jest.fn();

        nfCommon.getI18n = jest.fn().mockReturnValue(mockI18n);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        tokenVerifier.init($element[0], {}, null, callback); // Init after setting override
    });

    afterEach(() => {
        tokenVerifier.__setIsLocalhostForTesting(null);
        $element.remove();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    // Common AJAX success/fail logic (independent of localhost for these paths)
    it('should show error if no token provided', () => {
        $element.find('textarea#token-input').val('');
        $element.find('.verify-token-button').trigger('click');
        expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.noTokenProvided']);
        expect($.ajax).not.toHaveBeenCalled();
    });

    it('should call $.ajax and show loading on token submit', () => {
        const tokenValue = 'test.token';
        $element.find('textarea#token-input').val(tokenValue);
         const deferred = $.Deferred(); // $.ajax must return a promise
        $.ajax.mockReturnValue(deferred.promise());
        $element.find('.verify-token-button').trigger('click');
        expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.verifying']);
        expect($.ajax).toHaveBeenCalledWith(expect.objectContaining({ data: JSON.stringify({ token: tokenValue }) }));
    });

    it('should display valid token details on success (valid: true)', () => {
        const mockResponse = {
            valid: true, subject: 's', issuer: 'i', audience: 'a', expiration: 'e',
            roles: ['r1'], scopes: ['s1'], claims: { sub: 's' }
        };
        $.ajax.mockReturnValue($.Deferred().resolve(mockResponse).promise());
        $element.find('textarea#token-input').val('valid.token');
        $element.find('.verify-token-button').trigger('click');
        const resultsHtml = $element.find('.token-results-content').html();
        expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenValid']);
        expect(resultsHtml).toContain('s'); // subject
        expect(resultsHtml).toContain('r1'); // roles
        expect(resultsHtml).toContain('s1'); // scopes

        // Test with missing optional fields (roles, scopes)
        const mockResponseNoOptional = {
            valid: true, subject: 's2', issuer: 'i2', audience: 'a2', expiration: 'e2',
            claims: { sub: 's2' }
            // roles and scopes are undefined
        };
        $.ajax.mockReturnValue($.Deferred().resolve(mockResponseNoOptional).promise());
        $element.find('textarea#token-input').val('valid.no.optional.token');
        $element.find('.verify-token-button').trigger('click');
        const resultsHtmlNoOptional = $element.find('.token-results-content').html();
        expect(resultsHtmlNoOptional).toContain(mockI18n['processor.jwt.tokenValid']);
        expect(resultsHtmlNoOptional).toContain('s2');
        expect(resultsHtmlNoOptional).not.toContain(mockI18n['processor.jwt.roles']);
        expect(resultsHtmlNoOptional).not.toContain(mockI18n['processor.jwt.scopes']);

        // Test with empty optional fields (roles, scopes)
        const mockResponseEmptyOptional = {
            valid: true, subject: 's3', issuer: 'i3', audience: 'a3', expiration: 'e3',
            roles: [], scopes: [], // Empty arrays
            claims: { sub: 's3' }
        };
        $.ajax.mockReturnValue($.Deferred().resolve(mockResponseEmptyOptional).promise());
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
        $.ajax.mockReturnValue($.Deferred().resolve(mockResponse).promise());
        $element.find('textarea#token-input').val('invalid.token');
        $element.find('.verify-token-button').trigger('click');
        const resultsHtml = $element.find('.token-results-content').html();
        expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenInvalid']);
        expect(resultsHtml).toContain('Invalid sig');
        expect(resultsHtml).toContain('SIG');

        // Test with missing message and category
        const mockResponseNoDetails = { valid: false };
        $.ajax.mockReturnValue($.Deferred().resolve(mockResponseNoDetails).promise());
        $element.find('textarea#token-input').val('invalid.no.details.token');
        $element.find('.verify-token-button').trigger('click');
        const resultsHtmlNoDetails = $element.find('.token-results-content').html();
        expect(resultsHtmlNoDetails).toContain(mockI18n['processor.jwt.tokenInvalid']);
        // message becomes '', category part is not added
        expect(resultsHtmlNoDetails).not.toContain(mockI18n['processor.jwt.errorCategory']);
        // Check that the main error message container is there, but specific parts might be empty
        expect(resultsHtmlNoDetails).toContain(mockI18n['processor.jwt.errorDetails']);
        // A more robust check for empty message:
        const errorMsgElement = $element.find('.token-error-message');
        expect(errorMsgElement.text()).toBe('');


        // Test with null message and category
        const mockResponseNullDetails = { valid: false, message: null, category: null };
        $.ajax.mockReturnValue($.Deferred().resolve(mockResponseNullDetails).promise());
        $element.find('textarea#token-input').val('invalid.null.details.token');
        $element.find('.verify-token-button').trigger('click');
        const resultsHtmlNullDetails = $element.find('.token-results-content').html();
        expect(resultsHtmlNullDetails).toContain(mockI18n['processor.jwt.tokenInvalid']);
        expect(resultsHtmlNullDetails).not.toContain(mockI18n['processor.jwt.errorCategory']);
        const errorMsgElementNull = $element.find('.token-error-message');
        expect(errorMsgElementNull.text()).toBe('');
    });

    it('should display simulated success on AJAX .fail()', () => {
        const deferred = $.Deferred();
        $.ajax.mockReturnValue(deferred.promise());
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
        $.ajax.mockImplementation(() => { throw exception; });
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
