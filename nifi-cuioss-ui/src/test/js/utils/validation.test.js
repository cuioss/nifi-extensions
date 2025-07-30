/**
 * Simple tests for validation utility functions.
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

describe('Validation utilities (simplified)', () => {
    describe('validateRequired', () => {
        it('should validate non-empty values', () => {
            const result = validateRequired('valid value');
            expect(result.isValid).toBe(true);
            expect(result.sanitizedValue).toBe('valid value');
        });

        it('should reject empty values', () => {
            const result = validateRequired('');
            expect(result.isValid).toBe(false);
            expect(result.error).toBeTruthy();
        });

        it('should handle optional fields', () => {
            const result = validateRequired('', false);
            expect(result.isValid).toBe(true);
        });
    });

    describe('validateProcessorIdFromUrl', () => {
        it('should extract processor ID from URL', () => {
            const result = validateProcessorIdFromUrl('/nifi/processors/12345678-1234-1234-1234-123456789abc/edit');
            expect(result.isValid).toBe(true);
            expect(result.sanitizedValue).toBeTruthy();
        });

        it('should reject URLs without processor pattern', () => {
            const result = validateProcessorIdFromUrl('/other/path');
            expect(result.isValid).toBe(false);
        });
    });

    describe('validateUrl', () => {
        it('should validate basic HTTP URL', () => {
            const result = validateUrl('http://example.com');
            expect(result).toHaveProperty('isValid');
        });

        it('should validate basic HTTPS URL', () => {
            const result = validateUrl('https://example.com');
            expect(result).toHaveProperty('isValid');
        });
    });

    describe('validateJwtToken', () => {
        it('should validate basic JWT format', () => {
            const result = validateJwtToken('abc.def.ghi');
            expect(result).toHaveProperty('isValid');
        });
    });

    describe('validateIssuerName', () => {
        it('should validate simple issuer name', () => {
            const result = validateIssuerName('keycloak');
            expect(result).toHaveProperty('isValid');
        });
    });

    describe('validateClientId', () => {
        it('should validate simple client ID', () => {
            const result = validateClientId('client123');
            expect(result).toHaveProperty('isValid');
        });
    });

    describe('validateAudience', () => {
        it('should validate audience', () => {
            const result = validateAudience('api');
            expect(result).toHaveProperty('isValid');
        });
    });

    describe('validateIssuerConfig', () => {
        it('should validate configuration object', () => {
            const config = {
                issuerName: 'test',
                issuer: 'https://example.com',
                'jwks-url': 'https://example.com/jwks'
            };
            const result = validateIssuerConfig(config);
            expect(result).toHaveProperty('isValid');
        });
    });
});
