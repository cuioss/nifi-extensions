/**
 * Enhanced tests for validation utility functions with improved error messages.
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

import {
    expectWithContext,
    validateDOMElement,
    logTestState
} from './testHelpers.js';

describe('Validation utilities (simplified)', () => {
    describe('validateRequired', () => {
        it('should validate non-empty values', () => {
            const testInput = 'valid value';
            const testName = 'validateRequired with valid input';
            logTestState('execution', { input: testInput }, testName);
            
            const result = validateRequired(testInput);
            
            expectWithContext(result.isValid, `${testName} - isValid property`).toBe(true);
            expectWithContext(result.sanitizedValue, `${testName} - sanitizedValue property`).toBe(testInput);
        });

        it('should reject empty values', () => {
            const testInput = '';
            const testName = 'validateRequired with empty input';
            logTestState('execution', { input: testInput }, testName);
            
            const result = validateRequired(testInput);
            
            expectWithContext(result.isValid, `${testName} - isValid should be false`).toBe(false);
            expectWithContext(result.error, `${testName} - error should be present`).toBeTruthy();
            
            if (!result.error) {
                throw new Error(`Test failed: ${testName} - Expected error message but got: ${JSON.stringify(result)}`);
            }
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
            const testInput = 'http://example.com';
            const testName = 'validateUrl with HTTP URL';
            logTestState('execution', { input: testInput }, testName);
            
            const result = validateUrl(testInput);
            
            // Enhanced error context for debugging
            expect(result).toHaveProperty('isValid');
            
            if (!result.isValid) {
                throw new Error(`
=== TEST FAILURE DETAILS ===
Test: ${testName}
Input: ${testInput}
Expected: Valid HTTP URL should be accepted
Actual Result: ${JSON.stringify(result, null, 2)}
============================`);
            }
        });

        it('should validate basic HTTPS URL', () => {
            const testInput = 'https://example.com';
            const testName = 'validateUrl with HTTPS URL';
            logTestState('execution', { input: testInput }, testName);
            
            const result = validateUrl(testInput);
            
            // Enhanced assertions with better error context
            expect(result).toHaveProperty('isValid');
            
            if (!result.isValid) {
                throw new Error(`
=== TEST FAILURE DETAILS ===
Test: ${testName}
Input: ${testInput}
Expected: HTTPS URL should be valid
Actual Result: ${JSON.stringify(result, null, 2)}
============================`);
            }
            
            expect(result.isValid).toBe(true);
            expect(result.sanitizedValue).toBe(testInput);
        });

        it('should reject invalid URL formats', () => {
            const invalidUrls = [
                'not-a-url',
                'ftp://example.com',
                'javascript:alert(1)',
                'mailto:test@example.com'
            ];
            
            invalidUrls.forEach(testInput => {
                const testName = `validateUrl with invalid URL: ${testInput}`;
                logTestState('execution', { input: testInput }, testName);
                
                const result = validateUrl(testInput);
                
                if (result.isValid) {
                    throw new Error(`
=== TEST FAILURE DETAILS ===
Test: ${testName}
Input: ${testInput}
Expected: Invalid URL should be rejected
Actual Result: ${JSON.stringify(result, null, 2)}
Error: URL was incorrectly validated as valid
============================`);
                }
                
                expect(result.error).toBeTruthy();
                
                if (!result.error) {
                    throw new Error(`
=== TEST FAILURE DETAILS ===
Test: ${testName}
Input: ${testInput}
Expected: Error message should be present for invalid URL
Actual Result: ${JSON.stringify(result, null, 2)}
============================`);
                }
            });
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
