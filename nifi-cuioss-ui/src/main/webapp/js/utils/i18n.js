/**
 * Internationalization (i18n) module for MultiIssuerJWTTokenAuthenticator UI.
 * Provides localization support using the browser's language setting.
 */
define([], function () {
    'use strict';

    // Default language
    let currentLanguage = 'en';

    // Available languages
    const availableLanguages = ['en', 'de'];

    // Translation dictionaries
    const translations = {
        en: {
            // Common
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

            // JWT Validator
            'jwt.validator.title': 'JWT Token Validator',
            'jwt.validator.loading': 'Loading JWT Validator UI...',

            // Token Verification
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

            // JWKS Validation
            'jwks.validation.title': 'JWKS Validation',
            'jwks.validation.button': 'Verify JWKS URL',
            'jwks.validation.success': 'JWKS URL is valid',
            'jwks.validation.error': 'JWKS URL is invalid',
            'processor.jwt.failed': 'Failed',
            'processor.jwt.ok': 'OK',

            // Issuer Configuration
            'issuer.config.title': 'Issuer Configuration',
            'issuer.config.add': 'Add Issuer',
            'issuer.config.remove': 'Remove Issuer',
            'issuer.config.save': 'Save Configuration',
            'issuer.config.issuer.name': 'Issuer Name',
            'issuer.config.issuer.url': 'Issuer URL',
            'issuer.config.jwks.url': 'JWKS URL',
            'issuer.config.audience': 'Audience',
            'issuer.config.claim.mappings': 'Claim Mappings',

            // Property Help Text
            'property.token.location.help': 'Specifies where to look for the JWT token (Header, Query Parameter, or Cookie)',
            'property.token.header.help': 'The name of the header containing the JWT token',
            'property.custom.header.name.help': 'Custom header name when using a non-standard header',
            'property.bearer.token.prefix.help': 'Prefix used before the token in the Authorization header (e.g., "Bearer")',
            'property.require.valid.token.help': 'Whether to require a valid token for all requests',
            'property.jwks.refresh.interval.help': 'How often to refresh the JWKS keys from the server',
            'property.maximum.token.size.help': 'Maximum allowed size of the JWT token in bytes',
            'property.allowed.algorithms.help': 'List of allowed signature algorithms for token validation',
            'property.require.https.jwks.help': 'Whether to require HTTPS for JWKS URLs',
            'test.onlyInEnglish': 'English Only' // Added for the test case
        },
        de: {
            // Common
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

            // JWT Validator
            'jwt.validator.title': 'JWT Token Validator',
            'jwt.validator.loading': 'JWT Validator UI wird geladen...',

            // Token Verification
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

            // JWKS Validation
            'jwks.validation.title': 'JWKS-Validierung',
            'jwks.validation.button': 'JWKS-URL überprüfen',
            'jwks.validation.success': 'JWKS-URL ist gültig',
            'jwks.validation.error': 'JWKS-URL ist ungültig',
            'processor.jwt.failed': 'Fehler',
            'processor.jwt.ok': 'OK',

            // Issuer Configuration
            'issuer.config.title': 'Aussteller-Konfiguration',
            'issuer.config.add': 'Aussteller hinzufügen',
            'issuer.config.remove': 'Aussteller entfernen',
            'issuer.config.save': 'Konfiguration speichern',
            'issuer.config.issuer.name': 'Ausstellername',
            'issuer.config.issuer.url': 'Aussteller-URL',
            'issuer.config.jwks.url': 'JWKS-URL',
            'issuer.config.audience': 'Zielgruppe',
            'issuer.config.claim.mappings': 'Claim-Zuordnungen',

            // Property Help Text
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

    /**
     * Detects the browser language preference.
     *
     * @returns {string} The detected language code (e.g., 'en' from 'en-US')
     */
    const detectBrowserLanguage = function () {
        // Get browser language
        const browserLanguage = navigator.language || navigator.userLanguage || 'en';

        // Extract the language code (e.g., 'en' from 'en-US')
        const languageCode = browserLanguage.split('-')[0];

        // Return the language code if it's supported, otherwise return the default language
        return availableLanguages.includes(languageCode) ? languageCode : 'en';
    };

    /**
     * Sets the current language.
     *
     * @param {string} langCode - The language code to set
     * @returns {boolean} True if the language was set successfully, false otherwise
     */
    const setLanguage = function (langCode) {
        if (availableLanguages.includes(langCode)) {
            currentLanguage = langCode;
            return true;
        }
        return false;
    };

    /**
     * Gets the current language.
     *
     * @returns {string} The current language code
     */
    const getLanguage = function () {
        return currentLanguage;
    };

    /**
     * Gets the list of available languages.
     *
     * @returns {Array} The list of available language codes
     */
    const getAvailableLanguages = function () {
        return availableLanguages;
    };

    /**
     * Translates a key to the current language.
     *
     * @param {string} key - The translation key
     * @param {Object} [params] - Optional parameters to substitute in the translation
     * @returns {string} The translated text
     */
    const translate = function (key, params) {
        // Get the translation for the current language
        const translation = translations[currentLanguage] && translations[currentLanguage][key];

        // If the translation doesn't exist, try to get it from the default language
        const defaultTranslation = translations.en && translations.en[key];

        // Use the translation, the default translation, or the key itself
        let result = translation || defaultTranslation || key;

        // Substitute parameters if provided
        if (params) {
            Object.keys(params).forEach(function (param) {
                result = result.replace(new RegExp(`{${param}}`, 'g'), params[param]);
            });
        }

        return result;
    };

    // Initialize the language based on browser preference
    setLanguage(detectBrowserLanguage());

    // Return the public API
    return {
        getLanguage: getLanguage,
        setLanguage: setLanguage, // Export setLanguage
        getAvailableLanguages: getAvailableLanguages,
        translate: translate,
        detectBrowserLanguage: detectBrowserLanguage
    };
});
