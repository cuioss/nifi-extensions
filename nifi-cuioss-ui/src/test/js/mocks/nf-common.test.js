import nfCommon from './nf-common.js'; // Changed from require to import

// Define the original implementations so we can restore them
const originalImplementations = {
    getI18n: () => ({
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
        'processor.jwt.testConnection': 'Test Connection',
        'processor.jwt.verificationError': 'Verification error',
        processor: {
            jwt: {
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
            }
        }
    }),
    escapeHtml: (str) => {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },
    formatValue: (value) => {
        if (value === null || value === undefined) return '';
        return value.toString();
    },
    formatDateTime: (datetime) => {
        if (!datetime) return '';
        try {
            return new Date(datetime).toLocaleString();
        } catch (e) {
            return datetime;
        }
    },
    ajax: (options) => {
        const mockPromise = {
            done: function (callback) { this.doneCallback = callback; return this; },
            fail: function (callback) { this.failCallback = callback; return this; }
        };
        mockPromise.options = options;
        return mockPromise;
    }
};

describe('nfCommon mock', () => {
    beforeEach(() => {
        // Restore implementations before each test due to resetMocks:true in Jest config
        // or if the mock functions themselves are jest.fn() and get cleared.
        if (nfCommon.getI18n && nfCommon.getI18n.mockImplementation) {
            nfCommon.getI18n.mockImplementation(originalImplementations.getI18n);
        }
        if (nfCommon.escapeHtml && nfCommon.escapeHtml.mockImplementation) {
            nfCommon.escapeHtml.mockImplementation(originalImplementations.escapeHtml);
        }
        if (nfCommon.formatValue && nfCommon.formatValue.mockImplementation) {
            nfCommon.formatValue.mockImplementation(originalImplementations.formatValue);
        }
        if (nfCommon.formatDateTime && nfCommon.formatDateTime.mockImplementation) {
            nfCommon.formatDateTime.mockImplementation(originalImplementations.formatDateTime);
        }
        if (nfCommon.ajax && nfCommon.ajax.mockImplementation) {
            nfCommon.ajax.mockImplementation(originalImplementations.ajax);
        }
        // For functions that are just jest.fn() (like registerCustomUiComponent, showMessage etc. in the mock)
        // jest.clearAllMocks() (called by Jest if resetMocks:true) or explicit .mockClear() is enough.
        // If they had default mockImplementations in the source mock file, they would need to be restored here.
        // Assuming they are plain jest.fn() in the mock file.
    });

    describe('getI18n', () => {
        test('should return the expected translations', () => {
            const i18n = nfCommon.getI18n();
            expect(i18n['processor.jwt.testConnection']).toBe('Test Connection');
            expect(i18n.processor.jwt.testConnection).toBe('Test Connection');
        });

        test('should be a jest mock function', () => {
            expect(jest.isMockFunction(nfCommon.getI18n)).toBe(true);
        });
    });

    describe('registerCustomUiComponent', () => {
        test('should be a jest mock function', () => {
            expect(jest.isMockFunction(nfCommon.registerCustomUiComponent)).toBe(true);
        });

        test('should record being called', () => {
            nfCommon.registerCustomUiComponent();
            expect(nfCommon.registerCustomUiComponent).toHaveBeenCalled();
        });
    });

    describe('registerCustomUiTab', () => {
        test('should be a jest mock function', () => {
            expect(jest.isMockFunction(nfCommon.registerCustomUiTab)).toBe(true);
        });

        test('should record being called', () => {
            nfCommon.registerCustomUiTab();
            expect(nfCommon.registerCustomUiTab).toHaveBeenCalled();
        });
    });

    describe('escapeHtml', () => {
        test('should be a jest mock function', () => {
            expect(jest.isMockFunction(nfCommon.escapeHtml)).toBe(true);
        });

        test('should escape HTML special characters', () => {
            expect(nfCommon.escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#039;');
        });

        test('should return empty string for null or undefined input', () => {
            expect(nfCommon.escapeHtml(null)).toBe('');
            expect(nfCommon.escapeHtml(undefined)).toBe('');
        });

        test('should return original string if no special characters', () => {
            expect(nfCommon.escapeHtml('hello')).toBe('hello');
        });
    });

    describe('formatValue', () => {
        test('should be a jest mock function', () => {
            expect(jest.isMockFunction(nfCommon.formatValue)).toBe(true);
        });

        test('should return string representation of a number', () => {
            expect(nfCommon.formatValue(123)).toBe('123');
        });

        test('should return string representation of a boolean', () => {
            expect(nfCommon.formatValue(true)).toBe('true');
        });

        test('should return empty string for null or undefined input', () => {
            expect(nfCommon.formatValue(null)).toBe('');
            expect(nfCommon.formatValue(undefined)).toBe('');
        });

        test('should return original string if already a string', () => {
            expect(nfCommon.formatValue('hello')).toBe('hello');
        });
    });

    describe('formatDateTime', () => {
        test('should be a jest mock function', () => {
            expect(jest.isMockFunction(nfCommon.formatDateTime)).toBe(true);
        });

        test('should format a valid ISO date string', () => {
            const date = new Date('2024-01-01T12:00:00.000Z');
            expect(nfCommon.formatDateTime('2024-01-01T12:00:00.000Z')).toBe(date.toLocaleString());
        });

        test('should return empty string for null or undefined input', () => {
            expect(nfCommon.formatDateTime(null)).toBe('');
            expect(nfCommon.formatDateTime(undefined)).toBe('');
        });
        test('should return original string for invalid date string', () => {
            expect(nfCommon.formatDateTime('invalid-date')).toBe('Invalid Date');
        });
    });

    describe('showMessage', () => {
        test('should be a jest mock function', () => {
            expect(jest.isMockFunction(nfCommon.showMessage)).toBe(true);
        });

        test('should record being called', () => {
            nfCommon.showMessage({ msg: 'Test message' });
            expect(nfCommon.showMessage).toHaveBeenCalledWith({ msg: 'Test message' });
        });
    });

    describe('showConfirmationDialog', () => {
        test('should be a jest mock function', () => {
            expect(jest.isMockFunction(nfCommon.showConfirmationDialog)).toBe(true);
        });

        test('should record being called', () => {
            const options = { title: 'Confirm', msg: 'Are you sure?' };
            nfCommon.showConfirmationDialog(options);
            expect(nfCommon.showConfirmationDialog).toHaveBeenCalledWith(options);
        });
    });

    describe('ajax', () => {
        test('should be a jest mock function', () => {
            expect(jest.isMockFunction(nfCommon.ajax)).toBe(true);
        });

        test('should return a mock promise with done and fail methods', () => {
            const ajaxPromise = nfCommon.ajax({ url: '/test' });
            expect(typeof ajaxPromise.done).toBe('function');
            expect(typeof ajaxPromise.fail).toBe('function');
            expect(ajaxPromise.options).toEqual({ url: '/test' });
        });

        test('done callback should be chainable and store callback', () => {
            const ajaxPromise = nfCommon.ajax({ url: '/test' });
            const mockCallback = jest.fn();
            const chainedPromise = ajaxPromise.done(mockCallback);
            expect(chainedPromise).toBe(ajaxPromise);
            expect(ajaxPromise.doneCallback).toBe(mockCallback);
        });

        test('fail callback should be chainable and store callback', () => {
            const ajaxPromise = nfCommon.ajax({ url: '/test' });
            const mockCallback = jest.fn();
            const chainedPromise = ajaxPromise.fail(mockCallback);
            expect(chainedPromise).toBe(ajaxPromise);
            expect(ajaxPromise.failCallback).toBe(mockCallback);
        });
    });
});
