/**
 * Edge case tests for validation utility functions to improve coverage.
 * These tests target specific uncovered branches and error conditions.
 */
import {
    validateAudience,
    validateClientId,
    validateIssuerConfig,
    validateIssuerName,
    validateJwtToken,
    validateProcessorIdFromUrl,
    validateRequired,
    validateUrl
} from '../../../main/webapp/js/utils/validation.js';

describe('Validation Edge Cases', () => {
    describe('validateRequired edge cases', () => {
        it('should handle null values', () => {
            const result = validateRequired(null);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('This field is required.');
        });

        it('should handle undefined values', () => {
            const result = validateRequired(undefined);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('This field is required.');
        });

        it('should handle "null" string', () => {
            const result = validateRequired('null');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('This field is required.');
        });

        it('should handle "undefined" string', () => {
            const result = validateRequired('undefined');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('This field is required.');
        });

        it('should handle whitespace-only strings', () => {
            const result = validateRequired('   ');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('This field is required.');
        });
    });

    describe('validateProcessorIdFromUrl edge cases', () => {
        it('should handle empty URL', () => {
            const result = validateProcessorIdFromUrl('');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('URL is required for processor ID extraction.');
        });

        it('should handle null URL', () => {
            const result = validateProcessorIdFromUrl(null);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('URL is required for processor ID extraction.');
        });
    });

    describe('validateUrl edge cases', () => {
        it('should handle empty URL', () => {
            const result = validateUrl('');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('URL is required.');
        });

        it('should handle URL too long', () => {
            const longUrl = 'https://example.com/' + 'a'.repeat(2000);
            const result = validateUrl(longUrl, { maxLength: 1000 });
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('URL is too long');
        });

        it('should handle invalid URL format', () => {
            const result = validateUrl('invalid-url');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Invalid URL format');
        });

        it('should enforce HTTPS when httpsOnly is true', () => {
            const result = validateUrl('http://example.com', { httpsOnly: true });
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('HTTPS');
        });
    });

    describe('validateJwtToken edge cases', () => {
        it('should handle empty token', () => {
            const result = validateJwtToken('');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Token is required.');
        });

        it('should handle token too short', () => {
            const result = validateJwtToken('a.b');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Token is too short');
        });

        it('should handle token too long', () => {
            const longToken = 'a'.repeat(10000) + '.' + 'b'.repeat(10000) + '.' + 'c'.repeat(10000);
            const result = validateJwtToken(longToken);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Token is too long');
        });

        it('should handle token with insufficient parts', () => {
            const result = validateJwtToken('onlyonepart');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Expected at least 2 parts');
        });
    });

    describe('validateIssuerName edge cases', () => {
        it('should handle empty issuer name', () => {
            const result = validateIssuerName('');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Issuer name is required.');
        });

        it('should handle issuer name too short', () => {
            const result = validateIssuerName('a');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('at least 2 characters');
        });

        it('should handle issuer name too long', () => {
            const longName = 'a'.repeat(101);
            const result = validateIssuerName(longName);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('too long');
        });

        it('should handle issuer name with invalid characters', () => {
            const result = validateIssuerName('invalid@name!');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('can only contain letters');
        });
    });

    describe('validateAudience edge cases', () => {
        it('should handle empty audience when not required', () => {
            const result = validateAudience('', false);
            expect(result.isValid).toBe(true);
            expect(result.sanitizedValue).toBe('');
        });

        it('should handle audience too long', () => {
            const longAudience = 'a'.repeat(501);
            const result = validateAudience(longAudience);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('too long');
        });

        it('should handle empty audience when required', () => {
            const result = validateAudience('', true);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('This field is required.');
        });
    });

    describe('validateClientId edge cases', () => {
        it('should handle empty client ID when not required', () => {
            const result = validateClientId('', false);
            expect(result.isValid).toBe(true);
            expect(result.sanitizedValue).toBe('');
        });

        it('should handle client ID too long', () => {
            const longClientId = 'a'.repeat(201);
            const result = validateClientId(longClientId);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('too long');
        });

        it('should handle empty client ID when required', () => {
            const result = validateClientId('', true);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('This field is required.');
        });
    });

    describe('validateIssuerConfig edge cases', () => {
        it('should handle multiple validation errors', () => {
            const invalidConfig = {
                issuerName: '', // invalid - empty
                issuer: 'invalid-url', // invalid - bad format
                'jwks-url': 'invalid-jwks', // invalid - bad format
                audience: 'a'.repeat(501), // invalid - too long
                'client-id': 'b'.repeat(201) // invalid - too long
            };
            const result = validateIssuerConfig(invalidConfig);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Issuer Name:');
            expect(result.error).toContain('Issuer URI:');
            expect(result.error).toContain('JWKS URL:');
            expect(result.error).toContain('Audience:');
            expect(result.error).toContain('Client ID:');
        });

        it('should handle valid minimal config', () => {
            const validConfig = {
                issuerName: 'test-issuer',
                issuer: 'https://example.com',
                'jwks-url': 'https://example.com/jwks',
                audience: '',
                'client-id': ''
            };
            const result = validateIssuerConfig(validConfig);
            expect(result.isValid).toBe(true);
        });
    });
});
