/**
 * Tests for the formatters utility functions.
 */
const formatters = require('utils/formatters');
const $ = require('jquery'); // Required for sanitizeHtml if it uses $

// btoa and atob are needed for formatJwtToken tests
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.atob = (b64Encoded) => Buffer.from(b64Encoded, 'base64').toString('binary');

describe('formatters', () => {
    let consoleWarnSpy;
    let consoleErrorSpy; // Though formatters.js seems to use warn for recoverable issues

    beforeEach(() => {
        // Spy on console.warn and console.error before each test
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        // Restore original console functions after each test
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe('formatDate', () => {
        it('should format a valid date string', () => {
            const date = '2023-01-15T12:30:45Z';
            const result = formatters.formatDate(date);

            // Since toLocaleString output varies by environment, just check that it's not the original
            // and that it's a non-empty string.
            expect(result).not.toBe(date);
            expect(result.length).toBeGreaterThan(0);
            // A more robust check might involve parsing 'result' back to a Date and comparing timestamps,
            // but that's often overkill if we trust toLocaleString() itself.
        });

        it('should return an empty string for null or undefined or empty string', () => {
            expect(formatters.formatDate(null)).toBe('');
            expect(formatters.formatDate(undefined)).toBe('');
            expect(formatters.formatDate('')).toBe('');
        });

        it('should return "not-a-date" for "not-a-date" input and not warn', () => {
            const invalidDate = 'not-a-date';
            expect(formatters.formatDate(invalidDate)).toBe(invalidDate);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('should return the original string for other invalid date strings and warn', () => {
            const invalidDate = 'this is not a date';
            expect(formatters.formatDate(invalidDate)).toBe(invalidDate);
            expect(consoleWarnSpy).toHaveBeenCalledWith(`Invalid date format: ${invalidDate}`);
        });
    });

    describe('formatDuration', () => {
        it('should format seconds correctly', () => {
            expect(formatters.formatDuration(1)).toBe('1 second');
            expect(formatters.formatDuration(45)).toBe('45 seconds');
        });

        it('should format minutes correctly', () => {
            expect(formatters.formatDuration(60)).toBe('1 minute');
            expect(formatters.formatDuration(120)).toBe('2 minutes');
            expect(formatters.formatDuration(90)).toBe('1 minute, 30 seconds');
        });

        it('should format hours correctly', () => {
            expect(formatters.formatDuration(3600)).toBe('1 hour');
            expect(formatters.formatDuration(7200)).toBe('2 hours');
            expect(formatters.formatDuration(3660)).toBe('1 hour, 1 minute');
            expect(formatters.formatDuration(3661)).toBe('1 hour, 1 minute, 1 second');
        });

        it('should format days correctly', () => {
            expect(formatters.formatDuration(86400)).toBe('1 day');
            expect(formatters.formatDuration(172800)).toBe('2 days');
            expect(formatters.formatDuration(90000)).toBe('1 day, 1 hour');
        });

        it('should return an empty string for null or undefined', () => {
            expect(formatters.formatDuration(null)).toBe('');
            expect(formatters.formatDuration(undefined)).toBe('');
        });

        it('should handle zero seconds', () => {
            expect(formatters.formatDuration(0)).toBe('0 seconds');
        });
    });

    describe('formatJwtToken', () => {
        it('should format a valid JWT token', () => {
            const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
            const payload = btoa(JSON.stringify({ sub: 'user123', name: 'Test User' }));
            const signature = 'signature';
            const token = `${header}.${payload}.${signature}`;

            const result = formatters.formatJwtToken(token);

            expect(result).toHaveProperty('header');
            expect(result).toHaveProperty('payload');
            expect(result).toHaveProperty('signature', signature);

            const parsedHeader = JSON.parse(result.header);
            const parsedPayload = JSON.parse(result.payload);

            expect(parsedHeader).toEqual({ alg: 'HS256', typ: 'JWT' });
            expect(parsedPayload).toEqual({ sub: 'user123', name: 'Test User' });
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('should handle JWT with invalid JSON in parts and warn', () => {
            const header = btoa('not-json');
            const payload = btoa('also-not-json');
            const signature = 'signature';
            const token = `${header}.${payload}.${signature}`;

            const result = formatters.formatJwtToken(token);

            expect(result.header).toContain('Unable to decode header');
            expect(result.payload).toContain('Unable to decode payload');
            expect(result.signature).toBe(signature);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Error decoding JWT token parts'));
        });

        it('should handle JWT with non-base64 parts and warn', () => {
            const token = 'not.base64.atall';
            const result = formatters.formatJwtToken(token);

            expect(result.header).toContain('Unable to decode header');
            expect(result.payload).toContain('Unable to decode payload');
            expect(result.signature).toBe('atall');
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Error decoding JWT token parts'));
        });

        it('should handle malformed JWT (not enough parts) and warn', () => {
            const token = 'invalidtoken';
            const result = formatters.formatJwtToken(token);
            // The current logic enters the inner catch, not the outer one for this specific input.
            expect(result.header).toBe('Unable to decode header: invalidtoken');
            expect(result.payload).toBe('Unable to decode payload: '); // payload was initialized to ''
            expect(result.signature).toBe(''); // signature was initialized to ''
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Error decoding JWT token parts'));
        });


        it('should return empty parts for null or undefined', () => {
            const resultNull = formatters.formatJwtToken(null);
            expect(resultNull.header).toBe('');
            expect(resultNull.payload).toBe('');
            expect(resultNull.signature).toBe('');

            const resultUndefined = formatters.formatJwtToken(undefined);
            expect(resultUndefined.header).toBe('');
            expect(resultUndefined.payload).toBe('');
            expect(resultUndefined.signature).toBe('');
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });

    describe('formatNumber', () => {
        it('should format numbers with commas', () => {
            expect(formatters.formatNumber(1000)).toBe('1,000');
            expect(formatters.formatNumber(1000000)).toBe('1,000,000');
            // Note: Intl.NumberFormat default for en-US does not include .00 for whole numbers
            expect(formatters.formatNumber(1234567.89)).toBe('1,234,567.89');
        });

        it('should handle small numbers', () => {
            expect(formatters.formatNumber(0)).toBe('0');
            expect(formatters.formatNumber(1)).toBe('1');
            expect(formatters.formatNumber(999)).toBe('999');
        });

        it('should return an empty string for null or undefined', () => {
            expect(formatters.formatNumber(null)).toBe('');
            expect(formatters.formatNumber(undefined)).toBe('');
        });
    });

    describe('sanitizeHtml', () => {
        it('should escape HTML special characters', () => {
            const html = '<script>alert("XSS")</script>';
            const sanitized = formatters.sanitizeHtml(html);

            expect(sanitized).toBe('&lt;script&gt;alert("XSS")&lt;/script&gt;');
        });

        it('should return an empty string for null or undefined or empty string', () => {
            expect(formatters.sanitizeHtml(null)).toBe('');
            expect(formatters.sanitizeHtml(undefined)).toBe('');
            expect(formatters.sanitizeHtml('')).toBe('');
        });

        it('should correctly handle text with no HTML characters', () => {
            expect(formatters.sanitizeHtml('Hello world')).toBe('Hello world');
        });

        it('should handle text with some HTML characters', () => {
            expect(formatters.sanitizeHtml('<b>Bold</b> & "quotes"')).toBe('&lt;b&gt;Bold&lt;/b&gt; &amp; "quotes"');
        });
    });
});
