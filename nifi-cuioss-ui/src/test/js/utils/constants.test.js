/**
 * Tests for the constants utility module.
 */

import * as constants from '../../../main/webapp/js/utils/constants';

describe('constants utility', () => {
  describe('API constants', () => {
    it('should export API object with required properties', () => {
      expect(constants.API).toBeDefined();
      expect(constants.API.BASE_URL).toBeDefined();
      expect(constants.API.NIFI_BASE_URL).toBeDefined();
      expect(constants.API.ENDPOINTS).toBeDefined();
      expect(constants.API.TIMEOUTS).toBeDefined();
    });

    it('should have correct API endpoint URLs', () => {
      expect(constants.API.ENDPOINTS.VALIDATE_JWKS_URL).toBe('/validate-jwks-url');
      expect(constants.API.ENDPOINTS.VERIFY_TOKEN).toBe('/verify-token');
      expect(constants.API.ENDPOINTS.GET_ISSUER_CONFIG).toBe('/issuer-config');
      expect(constants.API.ENDPOINTS.SET_ISSUER_CONFIG).toBe('/issuer-config');
      expect(constants.API.ENDPOINTS.JWKS_VALIDATE_URL).toBe('../nifi-api/processors/jwks/validate-url');
      expect(constants.API.ENDPOINTS.JWT_VERIFY_TOKEN).toBe('../nifi-api/processors/jwt/verify-token');
    });

    it('should have correct timeout values', () => {
      expect(constants.API.TIMEOUTS.DEFAULT).toBe(5000);
      expect(constants.API.TIMEOUTS.LONG_OPERATION).toBe(10000);
      expect(constants.API.TIMEOUTS.SHORT_OPERATION).toBe(2000);
      expect(constants.API.TIMEOUTS.DIALOG_DELAY).toBe(500);
      expect(constants.API.TIMEOUTS.UI_FALLBACK_TIMEOUT).toBe(3000);
      expect(constants.API.TIMEOUTS.TOKEN_CACHE_DURATION).toBe(3600000);
      expect(constants.API.TIMEOUTS.ERROR_DISPLAY_TIMEOUT).toBe(5000);
    });
  });

  describe('CSS constants', () => {
    it('should export CSS object with required properties', () => {
      expect(constants.CSS).toBeDefined();
      expect(constants.CSS.CLASSES).toBeDefined();
      expect(constants.CSS.SELECTORS).toBeDefined();
      expect(constants.CSS.IDS).toBeDefined();
      expect(constants.CSS.ISSUER_CONFIG).toBeDefined();
      expect(constants.CSS.TOKEN_VERIFIER).toBeDefined();
    });

    it('should have consistent class and selector naming', () => {
      // Test a few key classes to ensure selectors match their class counterparts
      Object.keys(constants.CSS.CLASSES).forEach(key => {
        const className = constants.CSS.CLASSES[key];
        const selector = constants.CSS.SELECTORS[key];

        // If there's a matching selector, it should be the class with a dot prefix
        if (selector) {
          expect(selector).toBe(`.${className}`);
        }
      });
    });
  });

  describe('COMPONENTS constants', () => {
    it('should export COMPONENTS object with required properties', () => {
      expect(constants.COMPONENTS).toBeDefined();
      expect(constants.COMPONENTS.ISSUER_CONFIG_EDITOR).toBeDefined();
      expect(constants.COMPONENTS.TOKEN_VERIFIER).toBeDefined();
      expect(constants.COMPONENTS.JWKS_VALIDATOR).toBeDefined();
    });

    it('should have correct component configuration values', () => {
      expect(constants.COMPONENTS.TOKEN_VERIFIER.MAX_TOKEN_LENGTH).toBe(10000);
      expect(constants.COMPONENTS.TOKEN_VERIFIER.MIN_TOKEN_LENGTH).toBe(10);
      expect(constants.COMPONENTS.JWKS_VALIDATOR.MAX_URL_LENGTH).toBe(2048);
    });
  });

  describe('VALIDATION constants', () => {
    it('should export VALIDATION object with required properties', () => {
      expect(constants.VALIDATION).toBeDefined();
      expect(constants.VALIDATION.PATTERNS).toBeDefined();
      expect(constants.VALIDATION.LIMITS).toBeDefined();
    });

    it('should have valid regex patterns', () => {
      // Test that patterns are valid RegExp objects
      Object.values(constants.VALIDATION.PATTERNS).forEach(pattern => {
        expect(pattern).toBeInstanceOf(RegExp);
      });
    });

    it('should have correct validation limits', () => {
      expect(constants.VALIDATION.LIMITS.TOKEN_MIN).toBe(10);
      expect(constants.VALIDATION.LIMITS.TOKEN_MAX).toBe(10000);
      expect(constants.VALIDATION.LIMITS.URL_MAX).toBe(2048);
    });
  });

  describe('NIFI constants', () => {
    it('should export NIFI object with required properties', () => {
      expect(constants.NIFI).toBeDefined();
      expect(constants.NIFI.COMPONENT_TABS).toBeDefined();
      expect(constants.NIFI.PROCESSOR_TYPES).toBeDefined();
    });

    it('should have correct component tab identifiers', () => {
      expect(constants.NIFI.COMPONENT_TABS.ISSUER_CONFIG).toBe('jwt.validation.issuer.configuration');
      expect(constants.NIFI.COMPONENT_TABS.TOKEN_VERIFICATION).toBe('jwt.validation.token.verification');
    });
  });

  describe('UI_TEXT constants', () => {
    it('should export UI_TEXT object with required properties', () => {
      expect(constants.UI_TEXT).toBeDefined();
      expect(constants.UI_TEXT.HELP_TEXT_KEYS).toBeDefined();
      expect(constants.UI_TEXT.PROPERTY_LABELS).toBeDefined();
      expect(constants.UI_TEXT.I18N_KEYS).toBeDefined();
    });

    it('should have correct help text keys', () => {
      expect(constants.UI_TEXT.HELP_TEXT_KEYS.TOKEN_LOCATION).toBe('property.token.location.help');
      expect(constants.UI_TEXT.HELP_TEXT_KEYS.TOKEN_HEADER).toBe('property.token.header.help');
    });
  });

  describe('getIsLocalhost function', () => {
    const originalLocation = window.location;

    beforeEach(() => {
      // Mock window.location
      delete window.location;
      window.location = { hostname: '' };
    });

    afterEach(() => {
      // Restore original window.location
      window.location = originalLocation;
    });

    it('should return true for localhost', () => {
      window.location.hostname = 'localhost';
      expect(constants.getIsLocalhost()).toBe(true);
    });

    it('should return true for 127.0.0.1', () => {
      window.location.hostname = '127.0.0.1';
      expect(constants.getIsLocalhost()).toBe(true);
    });

    it('should return false for other hostnames', () => {
      window.location.hostname = 'example.com';
      expect(constants.getIsLocalhost()).toBe(false);
    });
  });

  describe('setIsLocalhostForTesting function', () => {
    afterEach(() => {
      // Reset the override after each test
      constants.setIsLocalhostForTesting(null);
    });

    it('should override getIsLocalhost when set to true', () => {
      constants.setIsLocalhostForTesting(true);
      expect(constants.getIsLocalhost()).toBe(true);
    });

    it('should override getIsLocalhost when set to false', () => {
      constants.setIsLocalhostForTesting(false);
      expect(constants.getIsLocalhost()).toBe(false);
    });

    it('should reset override when set to null', () => {
      // First set an override
      constants.setIsLocalhostForTesting(true);
      expect(constants.getIsLocalhost()).toBe(true);

      // Then reset it
      constants.setIsLocalhostForTesting(null);

      // Now it should use the actual hostname
      const isActuallyLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      expect(constants.getIsLocalhost()).toBe(isActuallyLocalhost);
    });
  });
});