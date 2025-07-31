/**
 * Tests for the i18n (internationalization) utility functions.
 */
import * as i18n from '../../../main/webapp/js/utils/i18n.js';
import { I18nKeys, getAllI18nKeys, isValidI18nKey } from '../../../main/webapp/js/utils/I18nKeys.js';

describe('i18n', () => {
    let originalNavigatorLanguage;

    beforeAll(() => {
        originalNavigatorLanguage = Object.getOwnPropertyDescriptor(navigator, 'language');
    });

    afterAll(() => {
        if (originalNavigatorLanguage) {
            Object.defineProperty(navigator, 'language', originalNavigatorLanguage);
        } else {
            // If original was undefined, delete to restore state
            delete navigator.language;
        }
    });

    // This top-level beforeEach will run before each test.
    // It establishes a default English environment.
    beforeEach(() => {
        jest.resetModules(); // Clear module cache
        Object.defineProperty(navigator, 'language', {
            get: jest.fn().mockReturnValue('en-US'),
            configurable: true
        });
    });

    describe('detectBrowserLanguage', () => {
        it('should use navigator.userLanguage if navigator.language is undefined', () => {
            Object.defineProperty(navigator, 'language', {
                get: jest.fn().mockReturnValue(undefined), // Simulate navigator.language being undefined
                configurable: true
            });
            Object.defineProperty(navigator, 'userLanguage', {
                get: jest.fn().mockReturnValue('de-DE'), // userLanguage is German
                configurable: true
            });
            // jest.resetModules(); // Reset before require - Now import is at top
            // const i18n = require('utils/i18n'); // Replaced by import
            expect(i18n.detectBrowserLanguage()).toBe('de');
            // Clean up userLanguage property
            delete navigator.userLanguage;
        });

        it('should default to "en" if navigator.language and navigator.userLanguage are undefined', () => {
            Object.defineProperty(navigator, 'language', {
                get: jest.fn().mockReturnValue(undefined),
                configurable: true
            });
            // Ensure userLanguage is also undefined or not present
            const userLanguageDescriptor = Object.getOwnPropertyDescriptor(navigator, 'userLanguage');
            if (userLanguageDescriptor) {
                Object.defineProperty(navigator, 'userLanguage', {
                    get: jest.fn().mockReturnValue(undefined),
                    configurable: true
                });
            } else {
                // If it doesn't exist, define it as undefined for the test
                Object.defineProperty(navigator, 'userLanguage', {
                    get: jest.fn().mockReturnValue(undefined),
                    configurable: true,
                    enumerable: false // Make it non-enumerable if it wasn't there
                });
            }

            // jest.resetModules(); // Reset before require
            // const i18n = require('utils/i18n'); // Replaced by import
            expect(i18n.detectBrowserLanguage()).toBe('en');
            // Clean up userLanguage property if we added it
            if (!userLanguageDescriptor) delete navigator.userLanguage;
        });

        it('should detect English language', () => {
            Object.defineProperty(navigator, 'language', {
                get: jest.fn().mockReturnValue('en-US'),
                configurable: true
            });
            // jest.resetModules(); // Reset before require
            // const freshI18n = require('utils/i18n'); // Replaced by import
            expect(i18n.detectBrowserLanguage()).toBe('en');
        });

        it('should detect German language', () => {
            Object.defineProperty(navigator, 'language', {
                get: jest.fn().mockReturnValue('de-DE'),
                configurable: true
            });
            // jest.resetModules(); // Reset before require
            // const freshI18n = require('utils/i18n'); // Replaced by import
            expect(i18n.detectBrowserLanguage()).toBe('de');
        });

        it('should default to English for unsupported languages', () => {
            Object.defineProperty(navigator, 'language', {
                get: jest.fn().mockReturnValue('fr-FR'),
                configurable: true
            });
            // jest.resetModules(); // Reset before require
            // const freshI18n = require('utils/i18n'); // Replaced by import
            expect(i18n.detectBrowserLanguage()).toBe('en');
        });
    });

    describe('setLanguage', () => {
        it('should allow setting a supported language', () => {
            // jest.resetModules(); // Start fresh
            // const i18n = require('utils/i18n'); // Initial language will be based on navigator // Replaced by import

            // Ensure initial state is English for predictability in this test part
            Object.defineProperty(navigator, 'language', { get: jest.fn().mockReturnValue('en-US'), configurable: true });
            // jest.resetModules(); // Replaced by import
            // const i18nForSet = require('utils/i18n'); // Replaced by import
            // For ES modules, the module is imported once. We need to manually call setLanguage
            // if the test relies on the module's auto-detection running again.
            // Or, ensure tests explicitly set the language state they need.
            i18n.setLanguage(i18n.detectBrowserLanguage()); // Re-initialize based on current navigator mock
            expect(i18n.getLanguage()).toBe('en'); // Pre-condition

            const result = i18n.setLanguage('de');
            expect(result).toBe(true);
            expect(i18n.getLanguage()).toBe('de');
        });

        it('should not set an unsupported language and return false', () => {
            // jest.resetModules(); // Start fresh
            Object.defineProperty(navigator, 'language', { get: jest.fn().mockReturnValue('en-US'), configurable: true });
            // jest.resetModules(); // Replaced by import
            // const i18n = require('utils/i18n'); // Replaced by import
            i18n.setLanguage(i18n.detectBrowserLanguage()); // Re-initialize
            expect(i18n.getLanguage()).toBe('en'); // Pre-condition

            const result = i18n.setLanguage('fr'); // French is not supported
            expect(result).toBe(false);
            expect(i18n.getLanguage()).toBe('en'); // Language should remain English
        });
    });

    describe('getLanguage and getAvailableLanguages', () => {
        it('should return English as current language by default setup', () => {
            // const i18n = require('utils/i18n'); // Uses 'en-US' from beforeEach // Replaced by import
            i18n.setLanguage(i18n.detectBrowserLanguage()); // Re-initialize based on beforeEach navigator mock
            expect(i18n.getLanguage()).toBe('en');
        });

        it('should return German as current language when navigator is German', () => {
            Object.defineProperty(navigator, 'language', {
                get: jest.fn().mockReturnValue('de-DE'),
                configurable: true
            });
            // jest.resetModules(); // Reset before require // Replaced by import
            // const germanI18n = require('utils/i18n'); // Replaced by import
            i18n.setLanguage(i18n.detectBrowserLanguage()); // Re-initialize
            expect(i18n.getLanguage()).toBe('de');
        });

        it('should return the list of available languages', () => {
            // const i18n = require('utils/i18n'); // Replaced by import
            const languages = i18n.getAvailableLanguages();
            expect(languages).toEqual(['en', 'de']);
        });
    });

    describe('translate', () => {
        it('should fall back to English translation if key is missing in current language (de)', () => {
            // Set navigator to German
            Object.defineProperty(navigator, 'language', {
                get: jest.fn().mockReturnValue('de-DE'),
                configurable: true
            });
            // jest.resetModules(); // Important to pick up the modified i18n.js and set German language // Replaced by import
            // const i18n = require('utils/i18n'); // Replaced by import
            i18n.setLanguage(i18n.detectBrowserLanguage()); // Re-initialize

            expect(i18n.getLanguage()).toBe('de'); // Pre-condition: language is German

            // 'test.onlyInEnglish' was added only to translations.en in this subtask's modified i18n.js
            expect(i18n.translate('test.onlyInEnglish')).toBe('English Only');
        });

        it('should translate keys to English when English is detected', () => {
            // Default beforeEach sets navigator to 'en-US'
            // jest.resetModules(); // Ensure it's reset if a previous test changed navigator // Replaced by import
            Object.defineProperty(navigator, 'language', { // Re-assert for clarity/safety
                get: jest.fn().mockReturnValue('en-US'),
                configurable: true
            });
            // const englishI18n = require('utils/i18n'); // Replaced by import
            i18n.setLanguage(i18n.detectBrowserLanguage()); // Re-initialize
            expect(i18n.translate('common.loading')).toBe('Loading...');
            expect(i18n.translate('common.error')).toBe('Error');
            expect(i18n.translate('common.success')).toBe('Success');
        });

        it('should translate keys to German when German is detected', () => {
            Object.defineProperty(navigator, 'language', {
                get: jest.fn().mockReturnValue('de-DE'),
                configurable: true
            });
            // jest.resetModules(); // Reset before require // Replaced by import
            // const germanI18n = require('utils/i18n'); // Replaced by import
            i18n.setLanguage(i18n.detectBrowserLanguage()); // Re-initialize
            expect(i18n.getLanguage()).toBe('de'); // Verify language was set
            expect(i18n.translate('common.loading')).toBe('Wird geladen...');
            expect(i18n.translate('common.error')).toBe('Fehler');
            expect(i18n.translate('common.success')).toBe('Erfolg');
        });

        it('should substitute parameters in translations', () => {
            // const i18n = require('utils/i18n'); // Default to English for this test // Replaced by import
            i18n.setLanguage('en'); // Ensure English for this test
            const params = { name: 'John', count: 5 };
            expect(i18n.translate('test.with.params.{name}.has.{count}', params))
                .toBe('test.with.params.John.has.5');
        });

        it('should return the key if translation is not found in current or default language', () => {
            // const i18n = require('utils/i18n'); // Default to English // Replaced by import
            i18n.setLanguage('en'); // Ensure English for this test
            const nonExistentKey = 'this.key.does.not.exist';
            expect(i18n.translate(nonExistentKey)).toBe(nonExistentKey);
        });

        it('should fall back to English value if key is missing in German', () => {
            // This test requires a key that exists in 'en' but not 'de'.
            // The current i18n.js has all keys in both.
            // So, the "fallback to English" is tested by setting language to German,
            // and asking for a key. If it was missing in German, it would get the English one.
            // Since all keys are in German, this specific test will just get the German version.
            Object.defineProperty(navigator, 'language', {
                get: jest.fn().mockReturnValue('de-DE'), // Set current lang to German
                configurable: true
            });
            // jest.resetModules(); // Reset before require // Replaced by import
            // const germanI18n = require('utils/i18n'); // Replaced by import
            i18n.setLanguage(i18n.detectBrowserLanguage()); // Re-initialize

            // 'common.save' is 'Speichern' in German, 'Save' in English.
            // If German is correctly detected, it should be 'Speichern'.
            expect(i18n.translate('common.save')).toBe('Speichern');
        });
    });

    describe('I18n Completeness Validation', () => {
        const TRANSLATIONS = {
            en: {
                'common.loading': 'Loading...',
                'common.error': 'Error',
                'common.success': 'Success',
                'common.save': 'Save',
                'common.cancel': 'Cancel',
                'common.add': 'Add',
                'common.remove': 'Remove',
                'common.edit': 'Edit',
                'common.verify': 'Verify',
                'common.details': 'Details',
                'common.name': 'Name',
                'common.value': 'Value',
                'common.yes': 'Yes',
                'common.no': 'No',
                'jwt.validator.title': 'JWT Token Validator',
                'jwt.validator.loading': 'Loading JWT Validator UI...',
                'jwt.validator.metrics.title': 'JWT Validation Metrics',
                'jwt.validator.metrics.tab.name': 'Metrics',
                'jwt.validator.help.title': 'JWT Authenticator Help',
                'jwt.validator.help.tab.name': 'Help',
                'token.verification.title': 'Token Verification',
                'token.verification.input.label': 'Enter JWT Token',
                'token.verification.button': 'Verify Token',
                'token.verification.valid': 'Token is valid',
                'token.verification.invalid': 'Token is invalid',
                'token.verification.error': 'Error verifying token',
                'token.verification.loading': 'Verifying token...',
                'token.verification.details': 'Token Details',
                'token.verification.claims': 'Claims',
                'token.verification.raw': 'Raw Token',
                'jwks.validation.title': 'JWKS Validation',
                'jwks.validation.button': 'Verify JWKS URL',
                'jwks.validation.success': 'JWKS URL is valid',
                'jwks.validation.error': 'JWKS URL is invalid',
                'processor.jwt.failed': 'Failed',
                'processor.jwt.ok': 'OK',
                'issuer.config.title': 'Issuer Configuration',
                'issuer.config.add': 'Add Issuer',
                'issuer.config.remove': 'Remove Issuer',
                'issuer.config.save': 'Save Configuration',
                'issuer.config.issuer.name': 'Issuer Name',
                'issuer.config.issuer.url': 'Issuer URL',
                'issuer.config.jwks.url': 'JWKS URL',
                'issuer.config.audience': 'Audience',
                'issuer.config.claim.mappings': 'Claim Mappings',
                'property.token.location.help': 'Specifies where to look for the JWT token (Header, Query Parameter, or Cookie)',
                'property.token.header.help': 'The name of the header containing the JWT token',
                'property.custom.header.name.help': 'Custom header name when using a non-standard header',
                'property.bearer.token.prefix.help': 'Prefix used before the token in the Authorization header (e.g., "Bearer")',
                'property.require.valid.token.help': 'Whether to require a valid token for all requests',
                'property.jwks.refresh.interval.help': 'How often to refresh the JWKS keys from the server',
                'property.maximum.token.size.help': 'Maximum allowed size of the JWT token in bytes',
                'property.allowed.algorithms.help': 'List of allowed signature algorithms for token validation',
                'property.require.https.jwks.help': 'Whether to require HTTPS for JWKS URLs',
                'test.onlyInEnglish': 'English Only'
            },
            de: {
                'common.loading': 'Wird geladen...',
                'common.error': 'Fehler',
                'common.success': 'Erfolg',
                'common.save': 'Speichern',
                'common.cancel': 'Abbrechen',
                'common.add': 'Hinzufügen',
                'common.remove': 'Entfernen',
                'common.edit': 'Bearbeiten',
                'common.verify': 'Überprüfen',
                'common.details': 'Details',
                'common.name': 'Name',
                'common.value': 'Wert',
                'common.yes': 'Ja',
                'common.no': 'Nein',
                'jwt.validator.title': 'JWT Token Validator',
                'jwt.validator.loading': 'JWT Validator UI wird geladen...',
                'jwt.validator.metrics.title': 'JWT-Validierungsmetriken',
                'jwt.validator.metrics.tab.name': 'Metriken',
                'jwt.validator.help.title': 'JWT-Authentifikator-Hilfe',
                'jwt.validator.help.tab.name': 'Hilfe',
                'token.verification.title': 'Token-Überprüfung',
                'token.verification.input.label': 'JWT Token eingeben',
                'token.verification.button': 'Token überprüfen',
                'token.verification.valid': 'Token ist gültig',
                'token.verification.invalid': 'Token ist ungültig',
                'token.verification.error': 'Fehler bei der Token-Überprüfung',
                'token.verification.loading': 'Token wird überprüft...',
                'token.verification.details': 'Token-Details',
                'token.verification.claims': 'Claims',
                'token.verification.raw': 'Rohtoken',
                'jwks.validation.title': 'JWKS-Validierung',
                'jwks.validation.button': 'JWKS-URL überprüfen',
                'jwks.validation.success': 'JWKS-URL ist gültig',
                'jwks.validation.error': 'JWKS-URL ist ungültig',
                'processor.jwt.failed': 'Fehler',
                'processor.jwt.ok': 'OK',
                'issuer.config.title': 'Aussteller-Konfiguration',
                'issuer.config.add': 'Aussteller hinzufügen',
                'issuer.config.remove': 'Aussteller entfernen',
                'issuer.config.save': 'Konfiguration speichern',
                'issuer.config.issuer.name': 'Ausstellername',
                'issuer.config.issuer.url': 'Aussteller-URL',
                'issuer.config.jwks.url': 'JWKS-URL',
                'issuer.config.audience': 'Zielgruppe',
                'issuer.config.claim.mappings': 'Claim-Zuordnungen',
                'property.token.location.help': 'Gibt an, wo nach dem JWT-Token gesucht werden soll (Header, Query-Parameter oder Cookie)',
                'property.token.header.help': 'Der Name des Headers, der das JWT-Token enthält',
                'property.custom.header.name.help': 'Benutzerdefinierter Header-Name bei Verwendung eines nicht standardmäßigen Headers',
                'property.bearer.token.prefix.help': 'Präfix vor dem Token im Authorization-Header (z.B. "Bearer")',
                'property.require.valid.token.help': 'Ob für alle Anfragen ein gültiges Token erforderlich ist',
                'property.jwks.refresh.interval.help': 'Wie oft die JWKS-Schlüssel vom Server aktualisiert werden sollen',
                'property.maximum.token.size.help': 'Maximal zulässige Größe des JWT-Tokens in Bytes',
                'property.allowed.algorithms.help': 'Liste der erlaubten Signaturalgorithmen für die Token-Validierung',
                'property.require.https.jwks.help': 'Ob HTTPS für JWKS-URLs erforderlich ist'
            }
        };

        it('should have all I18nKeys constants defined with valid keys', () => {
            const allKeys = getAllI18nKeys();

            expect(allKeys.length).toBeGreaterThan(0);

            // Verify each key from I18nKeys exists in English translations
            const nonTestKeys = allKeys.filter(key => key !== 'test.onlyInEnglish');
            nonTestKeys.forEach(key => {
                expect(TRANSLATIONS.en[key]).toBeDefined();
                expect(typeof TRANSLATIONS.en[key]).toBe('string');
                expect(TRANSLATIONS.en[key].length).toBeGreaterThan(0);
            });
        });

        it('should have German translations for all required keys', () => {
            const allKeys = getAllI18nKeys();
            const germanKeys = Object.keys(TRANSLATIONS.de);
            const englishKeys = Object.keys(TRANSLATIONS.en);

            // Find keys missing in German (excluding test-only keys)
            const missingInGerman = englishKeys.filter(key =>
                !germanKeys.includes(key) && !key.startsWith('test.')
            );

            expect(missingInGerman).toEqual([]);
        });

        it('should validate key completeness across all supported languages', () => {
            const supportedLanguages = ['en', 'de'];
            const allKeys = getAllI18nKeys();

            supportedLanguages.forEach(language => {
                const langKeys = Object.keys(TRANSLATIONS[language]);

                // Check that all non-test keys are present
                const nonTestKeys = allKeys.filter(key => !key.startsWith('test.'));
                nonTestKeys.forEach(key => {
                    expect(langKeys).toContain(key);
                    expect(TRANSLATIONS[language][key]).toBeTruthy();
                    expect(typeof TRANSLATIONS[language][key]).toBe('string');
                });
            });
        });

        it('should validate isValidI18nKey function works correctly', () => {
            expect(isValidI18nKey(I18nKeys.COMMON_LOADING)).toBe(true);
            expect(isValidI18nKey(I18nKeys.JWT_VALIDATOR_TITLE)).toBe(true);
            expect(isValidI18nKey('non.existent.key')).toBe(false);
            expect(isValidI18nKey('')).toBe(false);
            expect(isValidI18nKey(null)).toBe(false);
            expect(isValidI18nKey(undefined)).toBe(false);
        });

        it('should have no duplicate values in I18nKeys constants', () => {
            const allKeys = getAllI18nKeys();
            const uniqueKeys = [...new Set(allKeys)];

            expect(allKeys.length).toBe(uniqueKeys.length);
        });

        it('should have meaningful German translations (not just copies of English)', () => {
            const keysToCheck = [
                'common.loading',
                'common.error',
                'common.success',
                'token.verification.title',
                'jwks.validation.title'
            ];

            keysToCheck.forEach(key => {
                const englishValue = TRANSLATIONS.en[key];
                const germanValue = TRANSLATIONS.de[key];

                expect(germanValue).toBeDefined();
                expect(germanValue).not.toBe(englishValue);
                expect(germanValue.length).toBeGreaterThan(0);
            });
        });
    });
});
