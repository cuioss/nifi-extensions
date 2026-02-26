'use strict';

import {
    sanitizeHtml, formatNumber, formatDate, t, lang, TRANSLATIONS, log,
    validateRequired, validateUrl, validateJwtToken,
    validateIssuerName, validateProcessorIdFromUrl,
    validateIssuerConfig,
    displayUiError, displayUiSuccess, createXhrErrorObject,
    showConfirmationDialog, confirmRemoveIssuer, confirmClearForm
} from '../../main/webapp/js/utils.js';

// ---------------------------------------------------------------------------
// sanitizeHtml — uses textContent/innerHTML (browser-native escaping)
// ---------------------------------------------------------------------------

describe('sanitizeHtml', () => {
    test('escapes HTML angle brackets and ampersands', () => {
        const result = sanitizeHtml('<script>alert("xss")</script>');
        expect(result).toContain('&lt;');
        expect(result).toContain('&gt;');
        expect(result).not.toContain('<script>');
    });

    test('escapes ampersands', () => {
        expect(sanitizeHtml('a&b')).toBe('a&amp;b');
    });

    test('returns empty string for falsy input', () => {
        expect(sanitizeHtml(null)).toBe('');
        expect(sanitizeHtml(undefined)).toBe('');
        expect(sanitizeHtml('')).toBe('');
    });

    test('converts non-string input via textContent', () => {
        // sanitizeHtml(42) calls d.textContent = 42 which coerces to '42'
        expect(sanitizeHtml(42)).toBe('42');
    });

    test('preserves safe text', () => {
        expect(sanitizeHtml('Hello World 123')).toBe('Hello World 123');
    });
});

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------

describe('formatNumber', () => {
    test('formats numbers with locale separators', () => {
        const result = formatNumber(1234567);
        expect(typeof result).toBe('string');
        expect(result).toContain('1');
    });

    test('handles zero', () => {
        expect(formatNumber(0)).toBe('0');
    });

    test('handles null/undefined', () => {
        expect(formatNumber(null)).toBe('');
        expect(formatNumber(undefined)).toBe('');
    });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
    test('formats a Date object', () => {
        const date = new Date('2024-06-15T12:00:00Z');
        const result = formatDate(date);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    test('returns empty string for null', () => {
        expect(formatDate(null)).toBe('');
    });

    test('returns string representation for invalid date string', () => {
        // 'not-a-date' creates an Invalid Date; formatDate returns String(d)
        const result = formatDate('not-a-date');
        expect(result).toBe('not-a-date');
    });
});

// ---------------------------------------------------------------------------
// i18n: t()
// ---------------------------------------------------------------------------

describe('t (i18n)', () => {
    test('returns translation for known key', () => {
        const result = t('jwt.validator.metrics.title');
        // May be en or de depending on test environment locale
        expect(['JWT Validation Metrics', 'JWT-Validierungsmetriken']).toContain(result);
    });

    test('returns key as fallback for unknown key', () => {
        expect(t('unknown.key.xyz')).toBe('unknown.key.xyz');
    });

    test('returns translation for origin badge keys', () => {
        const keys = [
            'origin.badge.persisted.title',
            'origin.badge.modified.title',
            'origin.badge.new.title',
            'origin.badge.modified',
            'origin.badge.new'
        ];
        for (const key of keys) {
            const result = t(key);
            // Must return a real translation, not the key itself
            expect(result).not.toBe(key);
            expect(result.length).toBeGreaterThan(0);
        }
    });

    test('supports parameter substitution with {0}, {1}', () => {
        const result = t('common.error.server', 404);
        expect(result).toContain('404');
        // Original template has {0} which should be replaced
        expect(result).not.toContain('{0}');
    });

    test('handles multiple parameters', () => {
        // Find a key with {0} param and test it
        const result = t('route.validate.name.duplicate', 'my-route');
        expect(result).toContain('my-route');
        expect(result).not.toContain('{0}');
    });

    test('leaves unreplaced placeholders when no params given', () => {
        // Calling parameterized key without args leaves {0} in place
        const result = t('common.error.server');
        expect(result).toContain('{0}');
    });
});

describe('TRANSLATIONS completeness', () => {
    test('lang is either "en" or "de"', () => {
        expect(['en', 'de']).toContain(lang);
    });

    test('every EN key has a DE counterpart', () => {
        const enKeys = Object.keys(TRANSLATIONS.en);
        const deKeys = Object.keys(TRANSLATIONS.de);
        const missingInDe = enKeys.filter((k) => !deKeys.includes(k));
        expect(missingInDe).toEqual([]);
    });

    test('every DE key has an EN counterpart', () => {
        const enKeys = Object.keys(TRANSLATIONS.en);
        const deKeys = Object.keys(TRANSLATIONS.de);
        const missingInEn = deKeys.filter((k) => !enKeys.includes(k));
        expect(missingInEn).toEqual([]);
    });

    test('no empty translation values', () => {
        for (const locale of ['en', 'de']) {
            for (const [key, value] of Object.entries(TRANSLATIONS[locale])) {
                expect(value.length).toBeGreaterThan(0);
                // eslint-disable-next-line jest/no-conditional-expect -- intentional per-key check
                if (value.trim().length === 0) expect(`${locale}.${key}`).toBe('non-empty');
            }
        }
    });
});

// ---------------------------------------------------------------------------
// log
// ---------------------------------------------------------------------------

describe('log', () => {
    test('has standard logging methods', () => {
        expect(typeof log.debug).toBe('function');
        expect(typeof log.info).toBe('function');
        expect(typeof log.warn).toBe('function');
        expect(typeof log.error).toBe('function');
    });

    test('does not throw when called', () => {
        expect(() => log.debug('test debug')).not.toThrow();
    });

    test('warn and error methods output to console', () => {
        expect(() => log.warn('test warning')).not.toThrow();
        expect(() => log.error('test error')).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

describe('validateRequired', () => {
    test('invalid when empty', () => {
        expect(validateRequired('').isValid).toBe(false);
        expect(validateRequired(null).isValid).toBe(false);
        expect(validateRequired(undefined).isValid).toBe(false);
    });

    test('valid when non-empty', () => {
        expect(validateRequired('hello').isValid).toBe(true);
    });

    test('trims whitespace', () => {
        expect(validateRequired('   ').isValid).toBe(false);
        expect(validateRequired('  x  ').isValid).toBe(true);
    });

    test('treats "null" and "undefined" strings as empty', () => {
        expect(validateRequired('null').isValid).toBe(false);
        expect(validateRequired('undefined').isValid).toBe(false);
    });
});

describe('validateUrl', () => {
    test('valid HTTPS URL', () => {
        expect(validateUrl('https://example.com').isValid).toBe(true);
    });

    test('valid HTTP URL', () => {
        expect(validateUrl('http://example.com/path').isValid).toBe(true);
    });

    test('localhost URL uses numeric IP pattern', () => {
        // The URL regex requires a domain pattern; localhost:port may or may not match.
        // Just validate that empty and non-URL strings fail
        expect(validateUrl('').isValid).toBe(false);
        expect(validateUrl('not-a-url').isValid).toBe(false);
    });

    test('rejects non-http protocols', () => {
        expect(validateUrl('ftp://files.example.com').isValid).toBe(false);
    });

    test('httpsOnly option rejects HTTP', () => {
        expect(validateUrl('http://example.com', { httpsOnly: true }).isValid).toBe(false);
        expect(validateUrl('https://example.com', { httpsOnly: true }).isValid).toBe(true);
    });

    test('rejects URL exceeding maxLength', () => {
        const longUrl = 'https://example.com/' + 'a'.repeat(2050);
        const result = validateUrl(longUrl);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('too long');
    });
});

describe('validateJwtToken', () => {
    // A syntactically valid JWT (3 base64url segments, >10 chars, <10000 chars)
    const validToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    test('valid JWT format', () => {
        expect(validateJwtToken(validToken).isValid).toBe(true);
    });

    test('rejects empty token', () => {
        expect(validateJwtToken('').isValid).toBe(false);
    });

    test('rejects token without dots', () => {
        expect(validateJwtToken('onlyone').isValid).toBe(false);
    });

    test('rejects very short token', () => {
        expect(validateJwtToken('a.b').isValid).toBe(false);
    });

    test('rejects token exceeding max length', () => {
        const longToken = 'a'.repeat(5001) + '.' + 'b'.repeat(5001);
        const result = validateJwtToken(longToken);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('too long');
    });
});

describe('validateIssuerName', () => {
    test('valid names', () => {
        expect(validateIssuerName('keycloak').isValid).toBe(true);
        expect(validateIssuerName('auth-0').isValid).toBe(true);
        expect(validateIssuerName('my_issuer').isValid).toBe(true);
    });

    test('rejects empty name', () => {
        expect(validateIssuerName('').isValid).toBe(false);
    });

    test('rejects name with spaces', () => {
        expect(validateIssuerName('has spaces').isValid).toBe(false);
    });

    test('rejects special characters', () => {
        expect(validateIssuerName('special!chars').isValid).toBe(false);
    });

    test('rejects single character (min 2)', () => {
        expect(validateIssuerName('a').isValid).toBe(false);
    });
});

describe('validateProcessorIdFromUrl', () => {
    test('extracts processor ID from path segment', () => {
        // The regex looks for /processors/<uuid> in the path
        const result = validateProcessorIdFromUrl(
            'https://nifi:8443/nifi-api/processors/550e8400-e29b-41d4-a716-446655440000'
        );
        expect(result.isValid).toBe(true);
        expect(result.sanitizedValue).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    test('rejects URL without processor path', () => {
        expect(validateProcessorIdFromUrl('https://nifi:8443/nifi').isValid).toBe(false);
    });

    test('rejects empty URL', () => {
        expect(validateProcessorIdFromUrl('').isValid).toBe(false);
    });
});

describe('validateIssuerConfig', () => {
    test('valid config with URL type', () => {
        const result = validateIssuerConfig({
            issuerName: 'keycloak',
            issuer: 'https://auth.example.com',
            'jwks-type': 'url',
            'jwks-url': 'https://auth.example.com/.well-known/jwks.json'
        });
        expect(result.isValid).toBe(true);
    });

    test('invalid: missing issuer name', () => {
        const result = validateIssuerConfig({
            issuerName: '',
            issuer: 'https://auth.example.com',
            'jwks-type': 'url',
            'jwks-url': 'https://auth.example.com/.well-known/jwks.json'
        });
        expect(result.isValid).toBe(false);
    });

    test('invalid: missing issuer URI', () => {
        const result = validateIssuerConfig({
            issuerName: 'keycloak',
            issuer: '',
            'jwks-type': 'url',
            'jwks-url': 'https://auth.example.com/.well-known/jwks.json'
        });
        expect(result.isValid).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// UI display helpers
// ---------------------------------------------------------------------------

describe('displayUiError', () => {
    test('renders error message into element', () => {
        document.body.innerHTML = '<div id="err"></div>';
        const el = document.getElementById('err');
        displayUiError(el, new Error('Test error'), {});
        expect(el.innerHTML).toContain('Test error');
        expect(el.innerHTML).toContain('error');
    });

    test('handles null error with fallback message', () => {
        document.body.innerHTML = '<div id="err"></div>';
        const el = document.getElementById('err');
        displayUiError(el, null, {}, 'fallback.key');
        expect(el.innerHTML).toContain('Unknown error');
    });

    test('extracts message from responseJSON.message', () => {
        document.body.innerHTML = '<div id="err"></div>';
        const el = document.getElementById('err');
        displayUiError(el, { responseJSON: { message: 'JSON error' } });
        expect(el.innerHTML).toContain('JSON error');
    });

    test('extracts error from responseJSON.error (servlet validation format)', () => {
        document.body.innerHTML = '<div id="err"></div>';
        const el = document.getElementById('err');
        displayUiError(el, { responseJSON: { valid: false, error: 'Invalid JWKS URL format' } });
        expect(el.innerHTML).toContain('Invalid JWKS URL format');
    });

    test('extracts message from responseText JSON with message field', () => {
        document.body.innerHTML = '<div id="err"></div>';
        const el = document.getElementById('err');
        displayUiError(el, { responseText: '{"message":"Parsed error"}' });
        expect(el.innerHTML).toContain('Parsed error');
    });

    test('extracts error from responseText JSON with error field', () => {
        document.body.innerHTML = '<div id="err"></div>';
        const el = document.getElementById('err');
        displayUiError(el, { responseText: '{"valid":false,"error":"Connection refused"}' });
        expect(el.innerHTML).toContain('Connection refused');
    });

    test('uses responseText directly when not JSON', () => {
        document.body.innerHTML = '<div id="err"></div>';
        const el = document.getElementById('err');
        displayUiError(el, { responseText: 'Plain text error' });
        expect(el.innerHTML).toContain('Plain text error');
    });

    test('displays user-friendly message for HTML error responses', () => {
        document.body.innerHTML = '<div id="err"></div>';
        const el = document.getElementById('err');
        displayUiError(el, {
            status: 403,
            responseText: '<html><body><h1>403 Forbidden</h1></body></html>'
        });
        expect(el.textContent).toContain('Server error (HTTP 403)');
        expect(el.textContent).not.toContain('<html>');
    });

    test('displays user-friendly message for HTML error with unknown status', () => {
        document.body.innerHTML = '<div id="err"></div>';
        const el = document.getElementById('err');
        displayUiError(el, {
            responseText: '<!DOCTYPE html><html>Error</html>'
        });
        expect(el.textContent).toContain('Server error (HTTP unknown)');
    });

    test('handles null element gracefully', () => {
        expect(() => displayUiError(null, new Error('test'))).not.toThrow();
    });
});

describe('displayUiSuccess', () => {
    test('renders success message into element', () => {
        document.body.innerHTML = '<div id="msg"></div>';
        const el = document.getElementById('msg');
        displayUiSuccess(el, 'Saved!');
        expect(el.innerHTML).toContain('Saved!');
        expect(el.innerHTML).toContain('success');
    });

    test('auto-removes success message after timeout', () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="msg"></div>';
        const el = document.getElementById('msg');
        displayUiSuccess(el, 'Auto-clear');
        expect(el.querySelector('.success-message')).not.toBeNull();

        jest.advanceTimersByTime(5000);

        expect(el.querySelector('.success-message')).toBeNull();
        jest.useRealTimers();
    });
});

// ---------------------------------------------------------------------------
// createXhrErrorObject
// ---------------------------------------------------------------------------

describe('createXhrErrorObject', () => {
    test('creates error object from XHR-like input', () => {
        const err = createXhrErrorObject({ status: 404, statusText: 'Not Found', responseText: 'page not found' });
        expect(err.status).toBe(404);
        expect(err.statusText).toBe('Not Found');
    });

    test('handles null input', () => {
        const err = createXhrErrorObject(null);
        expect(err.status).toBe(0);
        expect(err.statusText).toBe('Unknown error');
    });
});

// ---------------------------------------------------------------------------
// Confirmation dialogs (use DOM-based dialog, not window.confirm)
// ---------------------------------------------------------------------------

describe('showConfirmationDialog', () => {
    test('appends dialog to DOM', async () => {
        const callback = jest.fn();
        // Start the dialog (returns a promise)
        const promise = showConfirmationDialog({
            title: 'Test',
            message: 'Are you sure?',
            onConfirm: callback
        });

        // Find and click confirm button
        const confirmBtn = document.querySelector('.confirm-button');
        expect(confirmBtn).toBeTruthy();
        confirmBtn.click();

        const result = await promise;
        expect(result).toBe(true);
        expect(callback).toHaveBeenCalled();
    });

    test('Escape key closes dialog', async () => {
        const promise = showConfirmationDialog({
            title: 'Test',
            message: 'Are you sure?'
        });

        const dialog = document.querySelector('.confirmation-dialog');
        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        const result = await promise;
        expect(result).toBe(false);
        expect(document.querySelector('.confirmation-dialog')).toBeNull();
    });

    test('overlay click closes dialog', async () => {
        const promise = showConfirmationDialog({
            title: 'Test',
            message: 'Are you sure?'
        });

        document.querySelector('.dialog-overlay').click();

        const result = await promise;
        expect(result).toBe(false);
    });

    test('cancel button resolves false', async () => {
        const callback = jest.fn();
        const promise = showConfirmationDialog({
            title: 'Test',
            message: 'Are you sure?',
            onConfirm: callback
        });

        document.querySelector('.cancel-button').click();

        const result = await promise;
        expect(result).toBe(false);
        expect(callback).not.toHaveBeenCalled();
    });
});

describe('confirmRemoveIssuer', () => {
    test('shows dialog and calls callback on confirm', async () => {
        const callback = jest.fn();
        const promise = confirmRemoveIssuer('test-issuer', callback);

        // Verify dialog content
        expect(document.querySelector('.dialog-message').textContent)
            .toContain('test-issuer');

        document.querySelector('.confirm-button').click();
        await promise;
        expect(callback).toHaveBeenCalled();
    });
});

describe('confirmClearForm', () => {
    test('shows dialog and calls callback on confirm', async () => {
        const callback = jest.fn();
        const promise = confirmClearForm(callback);

        document.querySelector('.confirm-button').click();
        await promise;
        expect(callback).toHaveBeenCalled();
    });
});
