/**
 * Tests for the Token Verifier component.
 */
const tokenVerifier = require('components/tokenVerifier');
const $ = require('jquery');
const nfCommon = require('nf.Common');

describe('tokenVerifier', () => {
    let $element;
    let callback;
    let consoleErrorSpy, consoleLogSpy;

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
        'processor.jwt.verificationError': 'Verification error message'
    };

    beforeEach(() => {
        const rawElement = document.createElement('div');
        document.body.appendChild(rawElement);
        $element = $(rawElement);

        callback = jest.fn();
        $.ajax.mockClear();

        // nfCommon.getI18n is already a mock from jest.mock('nf.Common', ...)
        // Set its default behavior for most tests here.
        nfCommon.getI18n.mockReturnValue(mockI18n);
        nfCommon.getI18n.mockClear(); // Clear history from previous tests

        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        $element.remove();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        // No need to restore nfCommon.getI18n if its behavior is reset in beforeEach.
    });

    describe('Initialization', () => {
        // This beforeEach will run AFTER the main beforeEach,
        // so nfCommon.getI18n will be returning mockI18n.
        beforeEach(() => {
            tokenVerifier.init($element[0], {}, null, callback);
        });

        it('should create main container', () => {
            expect($element.find('.token-verification-container').length).toBe(1);
        });

        it('should create input section with label, textarea, and button', () => {
            const inputSection = $element.find('.token-input-section');
            expect(inputSection.length).toBe(1);
            expect(inputSection.find('label[for="token-input"]').text()).toBe(mockI18n['processor.jwt.tokenInput']);
            expect(inputSection.find('textarea#token-input').attr('placeholder')).toBe(mockI18n['processor.jwt.tokenInputPlaceholder']);
            expect(inputSection.find('button.verify-token-button').text()).toBe(mockI18n['processor.jwt.verifyToken']);
        });

        it('should create results section with header and content area', () => {
            const resultsSection = $element.find('.token-results-section');
            expect(resultsSection.length).toBe(1);
            expect(resultsSection.find('h3').text()).toBe(mockI18n['processor.jwt.verificationResults']);
            expect(resultsSection.find('.token-results-content').html()).toContain('Enter a JWT token above and click "Verify Token"');
        });

        it('should call nfCommon.getI18n', () => {
            expect(nfCommon.getI18n).toHaveBeenCalled();
        });

        it('should call the callback with a validate method', () => {
            expect(callback).toHaveBeenCalledWith(expect.objectContaining({
                validate: expect.any(Function)
            }));
            const callbackArg = callback.mock.calls[0][0];
            expect(callbackArg.validate()).toBe(true);
        });

        it('should use empty object for i18n if nfCommon.getI18n returns null', () => {
            // Override the mock behavior for this specific test's init call
            nfCommon.getI18n.mockReturnValueOnce(null);

            $element.empty(); // Clear element from main/describe beforeEach init
            // This init call will use the null i18n from mockReturnValueOnce
            tokenVerifier.init($element[0], {}, null, callback);
            // Subsequent calls to nfCommon.getI18n (if any in this test) would revert to mockI18n
            // or whatever the default is set in the main beforeEach for the *next* test.

            const inputSection = $element.find('.token-input-section');
            expect(inputSection.find('label[for="token-input"]').text()).toBe('undefined');
            expect(inputSection.find('textarea#token-input').attr('placeholder')).toBe('undefined');
            expect(inputSection.find('button.verify-token-button').text()).toBe('undefined');
            const resultsSection = $element.find('.token-results-section');
            expect(resultsSection.find('h3').text()).toBe('undefined');
            expect(resultsSection.find('.token-results-content').html()).toContain('Enter a JWT token above and click "Verify Token"');
            expect(callback).toHaveBeenCalled(); // callback from this init
        });

        it('should initialize correctly if callback is not a function', () => {
            $element.empty();
            callback.mockClear();
            tokenVerifier.init($element[0], {}, null, undefined);

            expect($element.find('.token-verification-container').length).toBe(1);
            expect($element.find('button.verify-token-button').length).toBe(1);
            // The original `callback` (jest.fn()) should not have been called by this init
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('Button Click Handler', () => {
        beforeEach(() => {
            // Initialize component before each button click test
            tokenVerifier.init($element[0], {}, null, callback);
        });

        it('should show error message if no token is provided and not call ajax', () => {
            $element.find('textarea#token-input').val(''); // Ensure textarea is empty
            $element.find('.verify-token-button').trigger('click');

            expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.noTokenProvided']);
            expect($.ajax).not.toHaveBeenCalled();
        });

        it('should show loading state and call $.ajax with correct parameters when token is provided', () => {
            const tokenValue = 'test.jwt.token';
            $element.find('textarea#token-input').val(tokenValue);
            $element.find('.verify-token-button').trigger('click');

            expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.verifying']);
            expect($element.find('.token-results-content').html()).toContain('fa-spinner fa-spin');

            expect($.ajax).toHaveBeenCalledWith(expect.objectContaining({
                type: 'POST',
                url: '../nifi-api/processors/jwt/verify-token',
                data: JSON.stringify({ token: tokenValue }),
                contentType: 'application/json',
                dataType: 'json',
                timeout: 5000
            }));
        });

        it('should display valid token details on AJAX success (valid: true)', () => {
            const mockResponse = {
                valid: true,
                subject: 'test-subject',
                issuer: 'test-issuer',
                audience: 'test-audience',
                expiration: '2099-01-01T00:00:00Z',
                roles: ['role1', 'role2'],
                scopes: ['scopeA', 'scopeB'],
                claims: { sub: 'test-subject', iss: 'test-issuer', aud: 'test-audience', custom: 'value' }
            };
            $.ajax.mockReturnValue($.Deferred().resolve(mockResponse).promise());
            $element.find('textarea#token-input').val('valid.token');
            $element.find('.verify-token-button').trigger('click');

            const resultsHtml = $element.find('.token-results-content').html();
            expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenValid']);
            expect(resultsHtml).toContain('test-subject');
            expect(resultsHtml).toContain('test-issuer');
            expect(resultsHtml).toContain('test-audience');
            expect(resultsHtml).toContain('2099-01-01T00:00:00Z');
            expect(resultsHtml).toContain('role1, role2');
            expect(resultsHtml).toContain('scopeA scopeB');
            expect(resultsHtml).toContain(JSON.stringify(mockResponse.claims, null, 2));
        });

        it('should display valid token details with null/undefined optional fields handled by fallbacks', () => {
            const mockResponse = {
                valid: true,
                subject: null, // Test null
                issuer: undefined, // Test undefined
                audience: 'test-audience', // Keep one defined for contrast
                expiration: null,
                roles: null,    // Test null roles
                scopes: undefined, // Test undefined scopes
                claims: { aud: 'test-audience', custom: 'value' } // Minimal claims for test
            };
            $.ajax.mockReturnValue($.Deferred().resolve(mockResponse).promise());
            $element.find('textarea#token-input').val('valid.token.null.optionals');
            $element.find('.verify-token-button').trigger('click');

            const resultsHtml = $element.find('.token-results-content').html();
            expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenValid']);

            // Check how null/undefined values are rendered (should be empty strings due to || '')
            const detailsTable = $element.find('.token-claims-table'); // Corrected class name
            let subjectText, issuerText, audienceText, expirationText;

            detailsTable.find('tr').each(function () {
                const th = $(this).find('th').eq(0); // Get the first <th>
                const td = $(this).find('td').eq(0); // Get the first <td>

                if (th.length && td.length) { // Ensure both th and td were found
                    const label = th.text().trim();
                    const value = td.text();

                    if (label === mockI18n['processor.jwt.subject']) subjectText = value;
                    if (label === mockI18n['processor.jwt.issuer']) issuerText = value;
                    if (label === mockI18n['processor.jwt.audience']) audienceText = value;
                    if (label === mockI18n['processor.jwt.expiration']) expirationText = value;
                }
            });

            expect(subjectText).toBe('');
            expect(issuerText).toBe('');
            expect(audienceText).toBe('test-audience');
            expect(expirationText).toBe('');

            // Roles and Scopes rows are not added if their text is empty after fallback
            expect(resultsHtml).not.toContain(mockI18n['processor.jwt.roles']);
            expect(resultsHtml).not.toContain(mockI18n['processor.jwt.scopes']);

            // Check claims display
            expect(resultsHtml).toContain(JSON.stringify(mockResponse.claims, null, 2));
        });

        it('should display invalid token details on AJAX success (valid: false)', () => {
            const mockResponse = {
                valid: false,
                message: 'Token signature invalid',
                category: 'InvalidSignature'
            };
            $.ajax.mockReturnValue($.Deferred().resolve(mockResponse).promise());
            $element.find('textarea#token-input').val('invalid.token');
            $element.find('.verify-token-button').trigger('click');

            const resultsHtml = $element.find('.token-results-content').html();
            expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenInvalid']);
            expect(resultsHtml).toContain('Token signature invalid');
            expect(resultsHtml).toContain('InvalidSignature');
        });

        it('should display invalid token details if category is missing', () => {
            const mockResponse = {
                valid: false,
                message: 'Some other error'
                // category is missing
            };
            $.ajax.mockReturnValue($.Deferred().resolve(mockResponse).promise());
            $element.find('textarea#token-input').val('invalid.token.no.category');
            $element.find('.verify-token-button').trigger('click');

            const resultsHtml = $element.find('.token-results-content').html();
            expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenInvalid']);
            expect(resultsHtml).toContain('Some other error');
            expect(resultsHtml).not.toContain(mockI18n['processor.jwt.errorCategory']);
        });

        it('should display AJAX error from xhr.responseText on .fail() (non-localhost)', () => {
            const nonLocalhostUrl = 'http://some-server-for-token-verifier/nifi';
            let locationSpy;
            try {
                locationSpy = jest.spyOn(window, 'location', 'get');
                locationSpy.mockReturnValue({ href: nonLocalhostUrl });

                $.ajax.mockReturnValue($.Deferred().reject({ responseText: 'Actual AJAX failure message' }, 'error', 'Failed').promise());
                $element.find('textarea#token-input').val('any.token');
                $element.find('.verify-token-button').trigger('click');
                expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.verificationError'] + ': Actual AJAX failure message');
            } finally {
                if (locationSpy) locationSpy.mockRestore();
            }
        });

        it('should display AJAX error from errorThrown argument on .fail() if responseText is null (non-localhost)', () => {
            const nonLocalhostUrl = 'http://some-server-for-token-verifier/nifi';
            let locationSpy;
            try {
                locationSpy = jest.spyOn(window, 'location', 'get');
                locationSpy.mockReturnValue({ href: nonLocalhostUrl });

                // Simulate xhr.responseText being null, and error (3rd arg) being the source of info
                $.ajax.mockReturnValue($.Deferred().reject({ responseText: null }, 'error', 'Specific Error Thrown').promise());
                $element.find('textarea#token-input').val('any.token');
                $element.find('.verify-token-button').trigger('click');
                expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.verificationError'] + ': Specific Error Thrown');
            } finally {
                if (locationSpy) locationSpy.mockRestore();
            }
        });

        it('should display AJAX error as "Unknown error" if responseText and errorThrown are null/undefined (non-localhost)', () => {
            const nonLocalhostUrl = 'http://some-server-for-token-verifier/nifi';
            let locationSpy;
            try {
                locationSpy = jest.spyOn(window, 'location', 'get');
                locationSpy.mockReturnValue({ href: nonLocalhostUrl });

                // Simulate xhr.responseText and error (3rd arg) being unhelpful
                $.ajax.mockReturnValue($.Deferred().reject({ responseText: null }, 'error', undefined).promise());
                $element.find('textarea#token-input').val('any.token');
                $element.find('.verify-token-button').trigger('click');
                // The component defaults to 'Unknown error' which might not be in mockI18n explicitly for this generic case.
                // Let's assume 'Unknown error' is the fallback text from the component.
                // The i18n key 'processor.jwt.unknownError' could be used if defined in component.
                // For now, we check against the component's actual fallback.
                // The component code is: `message = i18n['processor.jwt.verificationError'] + ': ' + (xhr.responseText || errorThrown || 'Unknown error');`
                expect($element.find('.token-results-content').html()).toContain(mockI18n['processor.jwt.verificationError'] + ': Unknown error');
            } finally {
                if (locationSpy) locationSpy.mockRestore();
            }
        });

        it('should display simulated success on .fail() (127.0.0.1)', () => {
            const originalGlobalHref = window.location.href;
            try {
                window.location.href = 'http://127.0.0.1/nifi'; // Simulate 127.0.0.1
                $.ajax.mockReturnValue($.Deferred().reject({}, 'error', 'Network issue').promise());
                $element.find('textarea#token-input').val('any.token');
                $element.find('.verify-token-button').trigger('click');

                const resultsHtml = $element.find('.token-results-content').html();
                expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenValid']);
                expect(resultsHtml).toContain('<em>(Simulated response)</em>');
                expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Using simulated response for standalone testing');
            } finally {
                window.location.href = originalGlobalHref;
            }
        });

        it('should display simulated success on .fail() (localhost)', () => {
            const originalGlobalHref = window.location.href;
            try {
                window.location.href = 'http://localhost/nifi'; // Simulate localhost
                $.ajax.mockReturnValue($.Deferred().reject({}, 'error', 'Network issue').promise());
                $element.find('textarea#token-input').val('any.token');
                $element.find('.verify-token-button').trigger('click');

                const resultsHtml = $element.find('.token-results-content').html();
                expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenValid']);
                expect(resultsHtml).toContain('<em>(Simulated response)</em>');
                expect(console.log).toHaveBeenCalledWith('[DEBUG_LOG] Using simulated response for standalone testing');
            } finally {
                window.location.href = originalGlobalHref;
            }
        });

        it('should display simulated success on exception during AJAX setup (localhost)', () => {
            const originalGlobalHref = window.location.href;
            try {
                window.location.href = 'http://localhost/nifi'; // Simulate localhost
                $.ajax.mockImplementation(() => { throw new Error('Setup failed'); });
                $element.find('textarea#token-input').val('any.token');
                $element.find('.verify-token-button').trigger('click');

                const resultsHtml = $element.find('.token-results-content').html();
                expect(resultsHtml).toContain(mockI18n['processor.jwt.tokenValid']);
                expect(resultsHtml).toContain('<em>(Simulated response)</em>');
                expect(console.error).toHaveBeenCalledWith('[DEBUG_LOG] Exception in token verification:', expect.any(Error));
            } finally {
                window.location.href = originalGlobalHref;
            }
        });
    });
});
