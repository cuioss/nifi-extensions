/**
 * Mock implementation of nf.Common for testing.
 * Provides simplified versions of NiFi Common functions used in the code.
 */

const nfCommon = {
    /**
     * Mock implementation of getI18n.
     * Returns a mock i18n object with translations.
     */
    getI18n: jest.fn().mockImplementation(() => {
        // Create translations
        const translations = {
            'testConnection': 'Test Connection',
            'testing': 'Testing...',
            'invalidType': 'Invalid JWKS type',
            'validJwks': 'Valid JWKS',
            'keysFound': 'keys found',
            'invalidJwks': 'Invalid JWKS',
            'validationError': 'Validation error',
            'tokenInput': 'JWT Token',
            'tokenInputPlaceholder': 'Paste your JWT token here',
            'verifyToken': 'Verify Token',
            'verificationResults': 'Verification Results',
            'noTokenProvided': 'No token provided',
            'verifying': 'Verifying token...',
            'tokenValid': 'Token is valid',
            'tokenDetails': 'Token Details',
            'subject': 'Subject',
            'issuer': 'Issuer',
            'audience': 'Audience',
            'expiration': 'Expiration',
            'roles': 'Roles',
            'scopes': 'Scopes',
            'allClaims': 'All Claims',
            'tokenInvalid': 'Token is invalid',
            'errorDetails': 'Error Details',
            'errorCategory': 'Error Category',
            'verificationError': 'Verification error'
        };

        // Create the nested structure that matches what the code expects
        return {
            'processor.jwt.testConnection': 'Test Connection',
            'processor.jwt.testing': 'Testing...',
            'processor.jwt.invalidType': 'Invalid JWKS type',
            'processor.jwt.validJwks': 'Valid JWKS',
            'processor.jwt.keysFound': 'keys found',
            'processor.jwt.invalidJwks': 'Invalid JWKS',
            'processor.jwt.validationError': 'Validation error',
            'processor.jwt.tokenInput': 'JWT Token',
            'processor.jwt.tokenInputPlaceholder': 'Paste your JWT token here',
            'processor.jwt.verifyToken': 'Verify Token',
            'processor.jwt.verificationResults': 'Verification Results',
            'processor.jwt.noTokenProvided': 'No token provided',
            'processor.jwt.verifying': 'Verifying token...',
            'processor.jwt.tokenValid': 'Token is valid',
            'processor.jwt.tokenDetails': 'Token Details',
            'processor.jwt.subject': 'Subject',
            'processor.jwt.issuer': 'Issuer',
            'processor.jwt.audience': 'Audience',
            'processor.jwt.expiration': 'Expiration',
            'processor.jwt.roles': 'Roles',
            'processor.jwt.scopes': 'Scopes',
            'processor.jwt.allClaims': 'All Claims',
            'processor.jwt.tokenInvalid': 'Token is invalid',
            'processor.jwt.errorDetails': 'Error Details',
            'processor.jwt.errorCategory': 'Error Category',
            'processor.jwt.verificationError': 'Verification error',
            processor: {
                jwt: translations
            }
        };
    }),

    /**
     * Mock implementation of registerCustomUiComponent.
     * Records that a custom UI component was registered.
     */
    registerCustomUiComponent: jest.fn(),

    /**
     * Mock implementation of registerCustomUiTab.
     * Records that a custom UI tab was registered.
     */
    registerCustomUiTab: jest.fn(),

    /**
     * Mock implementation of escapeHtml.
     * Escapes HTML special characters.
     */
    escapeHtml: jest.fn().mockImplementation(str => {
        if (!str) {
            return '';
        }
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }),

    /**
     * Mock implementation of formatValue.
     * Formats a value for display.
     */
    formatValue: jest.fn().mockImplementation(value => {
        if (value === null || value === undefined) {
            return '';
        }
        return value.toString();
    }),

    /**
     * Mock implementation of formatDateTime.
     * Formats a date/time value.
     */
    formatDateTime: jest.fn().mockImplementation(datetime => {
        if (!datetime) {
            return '';
        }
        try {
            const date = new Date(datetime);
            return date.toLocaleString();
        } catch (e) {
            return datetime;
        }
    }),

    /**
     * Mock implementation of showMessage.
     * Records that a message was shown.
     */
    showMessage: jest.fn(),

    /**
     * Mock implementation of showConfirmationDialog.
     * Records that a confirmation dialog was shown.
     */
    showConfirmationDialog: jest.fn(),

    /**
     * Mock implementation of ajax.
     * Provides a mock AJAX implementation.
     */
    ajax: jest.fn().mockImplementation(options => {
        const mockPromise = {
            done: function (callback) {
                this.doneCallback = callback;
                return this;
            },
            fail: function (callback) {
                this.failCallback = callback;
                return this;
            }
        };

        // Store the options for later inspection in tests
        mockPromise.options = options;

        // Return the mock promise
        return mockPromise;
    })
};

module.exports = nfCommon;
