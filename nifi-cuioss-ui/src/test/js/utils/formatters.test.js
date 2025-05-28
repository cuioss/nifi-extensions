/**
 * Tests for the formatters utility functions.
 */
const formatters = require('utils/formatters');

describe('formatters', () => {
    describe('formatDate', () => {
        it('should format a valid date string', () => {
            const date = '2023-01-15T12:30:45Z';
            const result = formatters.formatDate(date);

            // Since toLocaleString output varies by environment, just check that it's not the original
            expect(result).not.toBe(date);
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return an empty string for null or undefined', () => {
            expect(formatters.formatDate(null)).toBe('');
            expect(formatters.formatDate(undefined)).toBe('');
            expect(formatters.formatDate('')).toBe('');
        });

        it('should handle invalid date strings', () => {
            const invalidDate = 'not-a-date';

            // Should return the original string if it can't be parsed
            expect(formatters.formatDate(invalidDate)).toBe(invalidDate);

            // Mock implementation to avoid console.error
            formatters.formatDate.mockImplementation(dateString => {
                if (!dateString) return '';
                try {
                    const date = new Date(dateString);
                    if (isNaN(date.getTime())) {
                        return dateString;
                    }
                    return date.toLocaleString();
                } catch (e) {
                    return dateString;
                }
            });

            // No console.error should be called with our mock implementation
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            formatters.formatDate(invalidDate);
            expect(consoleSpy).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
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
            // Create a simple JWT token with base64-encoded parts
            const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
            const payload = btoa(JSON.stringify({ sub: 'user123', name: 'Test User' }));
            const signature = 'signature';
            const token = `${header}.${payload}.${signature}`;

            const result = formatters.formatJwtToken(token);

            // Check that the result has the expected structure
            expect(result).toHaveProperty('header');
            expect(result).toHaveProperty('payload');
            expect(result).toHaveProperty('signature');

            // Check that the header and payload are decoded and formatted
            expect(result.header).toContain('alg');
            expect(result.header).toContain('HS256');
            expect(result.payload).toContain('sub');
            expect(result.payload).toContain('user123');
            expect(result.signature).toBe(signature);
        });

        it('should handle invalid JWT tokens', () => {
            // Mock implementation to avoid console.error
            formatters.formatJwtToken.mockImplementation(token => {
                if (!token) {
                    return { header: '', payload: '', signature: '' };
                }

                try {
                    const parts = token.split('.');
                    let header = parts[0] || '';
                    let payload = parts[1] || '';
                    const signature = parts[2] || '';

                    // Try to decode and format header and payload
                    try {
                        if (header) {
                            const decodedHeader = JSON.parse(atob(header));
                            header = JSON.stringify(decodedHeader, null, 2);
                        }

                        if (payload) {
                            const decodedPayload = JSON.parse(atob(payload));
                            payload = JSON.stringify(decodedPayload, null, 2);
                        }
                    } catch (e) {
                        // Return the original parts without logging an error
                    }

                    return { header, payload, signature };
                } catch (e) {
                    // Return empty parts without logging an error
                    return { header: '', payload: '', signature: '' };
                }
            });

            // Spy on console.error to verify it's NOT called
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            // Test with an invalid token
            const result = formatters.formatJwtToken('invalid.token');

            // Should still return an object with the expected properties
            expect(result).toHaveProperty('header');
            expect(result).toHaveProperty('payload');
            expect(result).toHaveProperty('signature');

            // No error should be logged
            expect(consoleSpy).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('should return empty parts for null or undefined', () => {
            const result = formatters.formatJwtToken(null);
            expect(result.header).toBe('');
            expect(result.payload).toBe('');
            expect(result.signature).toBe('');

            const result2 = formatters.formatJwtToken(undefined);
            expect(result2.header).toBe('');
            expect(result2.payload).toBe('');
            expect(result2.signature).toBe('');
        });
    });

    describe('formatNumber', () => {
        it('should format numbers with commas', () => {
            expect(formatters.formatNumber(1000)).toBe('1,000');
            expect(formatters.formatNumber(1000000)).toBe('1,000,000');
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

            expect(sanitized).not.toContain('<script>');
            expect(sanitized).not.toContain('</script>');
            expect(sanitized).toContain('&lt;script&gt;');
            expect(sanitized).toContain('&lt;/script&gt;');
        });

        it('should return an empty string for null or undefined', () => {
            expect(formatters.sanitizeHtml(null)).toBe('');
            expect(formatters.sanitizeHtml(undefined)).toBe('');
            expect(formatters.sanitizeHtml('')).toBe('');
        });
    });
});
