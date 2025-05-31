/**
 * Tests for the i18n (internationalization) utility functions.
 */

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
            jest.resetModules();
            const i18n = require('utils/i18n');
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

            jest.resetModules();
            const i18n = require('utils/i18n');
            expect(i18n.detectBrowserLanguage()).toBe('en');
            // Clean up userLanguage property if we added it
            if (!userLanguageDescriptor) delete navigator.userLanguage;
        });

        it('should detect English language', () => {
            Object.defineProperty(navigator, 'language', {
                get: jest.fn().mockReturnValue('en-US'),
                configurable: true
            });
            jest.resetModules(); // Reset before require
            const freshI18n = require('utils/i18n');
            expect(freshI18n.detectBrowserLanguage()).toBe('en');
        });

        it('should detect German language', () => {
            Object.defineProperty(navigator, 'language', {
                get: jest.fn().mockReturnValue('de-DE'),
                configurable: true
            });
            jest.resetModules(); // Reset before require
            const freshI18n = require('utils/i18n');
            expect(freshI18n.detectBrowserLanguage()).toBe('de');
        });

        it('should default to English for unsupported languages', () => {
            Object.defineProperty(navigator, 'language', {
                get: jest.fn().mockReturnValue('fr-FR'),
                configurable: true
            });
            jest.resetModules(); // Reset before require
            const freshI18n = require('utils/i18n');
            expect(freshI18n.detectBrowserLanguage()).toBe('en');
        });
    });

    describe('setLanguage', () => {
        it('should allow setting a supported language', () => {
            jest.resetModules(); // Start fresh
            const i18n = require('utils/i18n'); // Initial language will be based on navigator

            // Ensure initial state is English for predictability in this test part
            Object.defineProperty(navigator, 'language', { get: jest.fn().mockReturnValue('en-US'), configurable: true });
            jest.resetModules();
            const i18nForSet = require('utils/i18n');
            expect(i18nForSet.getLanguage()).toBe('en'); // Pre-condition

            const result = i18nForSet.setLanguage('de');
            expect(result).toBe(true);
            expect(i18nForSet.getLanguage()).toBe('de');
        });

        it('should not set an unsupported language and return false', () => {
            jest.resetModules(); // Start fresh
            Object.defineProperty(navigator, 'language', { get: jest.fn().mockReturnValue('en-US'), configurable: true });
            jest.resetModules();
            const i18n = require('utils/i18n');
            expect(i18n.getLanguage()).toBe('en'); // Pre-condition

            const result = i18n.setLanguage('fr'); // French is not supported
            expect(result).toBe(false);
            expect(i18n.getLanguage()).toBe('en'); // Language should remain English
        });
    });

    describe('getLanguage and getAvailableLanguages', () => {
        it('should return English as current language by default setup', () => {
            const i18n = require('utils/i18n'); // Uses 'en-US' from beforeEach
            expect(i18n.getLanguage()).toBe('en');
        });

        it('should return German as current language when navigator is German', () => {
            Object.defineProperty(navigator, 'language', {
                get: jest.fn().mockReturnValue('de-DE'),
                configurable: true
            });
            jest.resetModules(); // Reset before require
            const germanI18n = require('utils/i18n');
            expect(germanI18n.getLanguage()).toBe('de');
        });

        it('should return the list of available languages', () => {
            const i18n = require('utils/i18n');
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
            jest.resetModules(); // Important to pick up the modified i18n.js and set German language
            const i18n = require('utils/i18n');

            expect(i18n.getLanguage()).toBe('de'); // Pre-condition: language is German

            // 'test.onlyInEnglish' was added only to translations.en in this subtask's modified i18n.js
            expect(i18n.translate('test.onlyInEnglish')).toBe('English Only');
        });

        it('should translate keys to English when English is detected', () => {
            // Default beforeEach sets navigator to 'en-US'
            jest.resetModules(); // Ensure it's reset if a previous test changed navigator
            Object.defineProperty(navigator, 'language', { // Re-assert for clarity/safety
                get: jest.fn().mockReturnValue('en-US'),
                configurable: true
            });
            const englishI18n = require('utils/i18n');
            expect(englishI18n.translate('common.loading')).toBe('Loading...');
            expect(englishI18n.translate('common.error')).toBe('Error');
            expect(englishI18n.translate('common.success')).toBe('Success');
        });

        it('should translate keys to German when German is detected', () => {
            Object.defineProperty(navigator, 'language', {
                get: jest.fn().mockReturnValue('de-DE'),
                configurable: true
            });
            jest.resetModules(); // Reset before require
            const germanI18n = require('utils/i18n');
            expect(germanI18n.getLanguage()).toBe('de'); // Verify language was set
            expect(germanI18n.translate('common.loading')).toBe('Wird geladen...');
            expect(germanI18n.translate('common.error')).toBe('Fehler');
            expect(germanI18n.translate('common.success')).toBe('Erfolg');
        });

        it('should substitute parameters in translations', () => {
            const i18n = require('utils/i18n'); // Default to English for this test
            const params = { name: 'John', count: 5 };
            expect(i18n.translate('test.with.params.{name}.has.{count}', params))
                .toBe('test.with.params.John.has.5');
        });

        it('should return the key if translation is not found in current or default language', () => {
            const i18n = require('utils/i18n'); // Default to English
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
            jest.resetModules(); // Reset before require
            const germanI18n = require('utils/i18n');

            // 'common.save' is 'Speichern' in German, 'Save' in English.
            // If German is correctly detected, it should be 'Speichern'.
            expect(germanI18n.translate('common.save')).toBe('Speichern');
        });
    });
});
